// mpesa_configure.js
import express from "express";
import { supabase, supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken, checkTenantAccess } from "../middleware/authMiddleware.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { mpesaRequest } from "../services/mpesa.js";
import { createLogger } from "../utils/logger.js";

const mpesaConfigRouter = express.Router();
const log = createLogger({ service: "mpesa_configure" });

// CREATE OR UPDATE TENANT MPESA CONFIG
mpesaConfigRouter.post("/tenant-mpesa-config", verifySupabaseToken, checkTenantAccess, async (req, res) => {
  const {
    tenant_id,
    paybill_number,
    till_number,
    consumer_key,
    consumer_secret,
    passkey,
    shortcode,
    confirmation_url,
    validation_url,
    callback_url,
    initiator_name,
    security_credential,
    environment,
    admin_id, // Passing admin_id to verify role
    service_type = "c2b" // Default to c2b if not provided
  } = req.body;

  if (!tenant_id) return res.status(400).json({ error: "Tenant required" });

  // RBAC and Tenant Isolation handled by middlewares

  // 2️⃣ Validation based on service_type
  if (service_type === "c2b") {
    const hasPaybill = !!paybill_number;
    const hasTill = !!till_number;
    if ((hasPaybill && hasTill) || (!hasPaybill && !hasTill)) {
      return res.status(400).json({ error: "For C2B, either Paybill OR Till must be present (not both)" });
    }
    if (!passkey) {
      return res.status(400).json({ error: "Passkey is required for C2B (STK Push)" });
    }
  } else if (service_type === "b2c") {
    if (!shortcode) {
      return res.status(400).json({ error: "Shortcode is required for B2C" });
    }
    if (!initiator_name || !security_credential) {
      return res.status(400).json({ error: "Initiator Name and Security Credential are required for B2C" });
    }
  }

  try {
    // 3️⃣ Encrypt sensitive credentials
    const encryptedKey = (consumer_key || "").trim();
    const encryptedSecret = (consumer_secret || "").trim();
    const encryptedPasskey = (passkey || "").trim();
    const encryptedSecurityCredential = (security_credential || "").trim();

    // Improved helper for URL formatting to prevent path duplication
    const formatAppEndpoint = (baseUrl, endpoint) => {
      if (!baseUrl) return "";
      try {
        // Try to get just the origin (domain) to avoid duplicating paths like /mpesa/c2b/...
        const url = new URL(baseUrl.trim());
        return `${url.origin}${endpoint}`;
      } catch (e) {
        // Fallback if the provided baseUrl isn't a full URL
        let cleaned = baseUrl.trim().replace(/\/$/, "");
        // Remove existing suffixes if they exist
        cleaned = cleaned.replace(/\/mpesa\/c2b\/(confirmation|validation)$/i, "");
        cleaned = cleaned.replace(/\/api\/c2b\/(confirmation|validation)$/i, "");
        return `${cleaned}${endpoint}`;
      }
    };

    let finalConfirmationUrl = confirmation_url;
    let finalValidationUrl = validation_url;

    if (service_type === "c2b") {
      const mpesaPath = (environment === "sandbox") ? "/api" : "/mpesa";
      finalConfirmationUrl = formatAppEndpoint(confirmation_url, `${mpesaPath}/c2b/confirmation`) || formatAppEndpoint(callback_url, `${mpesaPath}/c2b/confirmation`) || "";
      finalValidationUrl = formatAppEndpoint(validation_url, `${mpesaPath}/c2b/validation`) || formatAppEndpoint(callback_url, `${mpesaPath}/c2b/validation`) || "";
    }

    const finalCallbackUrl = (callback_url || "").trim().replace(/\/$/, "");

    // 4️⃣ Manual Upsert: check if config exists for this tenant
    const { data: existingConfig } = await supabaseAdmin
      .from("tenant_mpesa_config")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("service_type", service_type)
      .maybeSingle();

    const configData = {
      tenant_id,
      service_type,
      paybill_number: paybill_number || null,
      till_number: till_number || null,
      consumer_key: encryptedKey,
      consumer_secret: encryptedSecret,
      passkey: encryptedPasskey,
      shortcode,
      confirmation_url: finalConfirmationUrl,
      validation_url: finalValidationUrl,
      callback_url: finalCallbackUrl,
      initiator_name,
      initiator_password: null, // Clear unused field from DB
      security_credential: encryptedSecurityCredential,
      environment: environment || 'sandbox',
      is_active: true
    };

    let result;
    if (existingConfig) {
      // Update existing
      result = await supabaseAdmin
        .from("tenant_mpesa_config")
        .update(configData)
        .eq("tenant_id", tenant_id)
        .eq("service_type", service_type)
        .select();
    } else {
      // Insert new
      result = await supabaseAdmin
        .from("tenant_mpesa_config")
        .insert([configData])
        .select();
    }

    if (result.error) throw result.error;
    const data = result.data;

    // 5️⃣ Mark onboarding as completed in tenants table
    const { error: tenantInitError } = await supabaseAdmin
      .from("tenants")
      .update({ onboarding_completed: true })
      .eq("id", tenant_id);

    if (tenantInitError) console.error("Error updating onboarding status:", tenantInitError);

    if (service_type === "c2b") {
      log.info({ tenant_id }, "Starting automated Safaricom C2B URL registration...");
      try {
        const c2bShortcode = paybill_number || shortcode; 
        if (!c2bShortcode) {
          log.warn({ tenant_id }, "No paybill/shortcode found for C2B registration — skipping");
        } else if (!finalConfirmationUrl || !finalValidationUrl) {
          log.warn({ tenant_id }, "Candidate URLs missing for registration — skipping");
        } else {
          const registerPayload = {
            ShortCode: c2bShortcode,
            ResponseType: (environment === "sandbox") ? "Cancelled" : "Completed",
            ConfirmationURL: finalConfirmationUrl,
            ValidationURL: finalValidationUrl
          };

          log.info({ tenant_id, registerPayload }, "Registering C2B URLs with Safaricom...");
          
          const registerResult = await mpesaRequest(
            configData, // plain text
            "POST",
            "/mpesa/c2b/v1/registerurl",
            registerPayload
          );
          
          log.info({ tenant_id, registerResult }, "Safaricom RegisterURL Response Received");

          if (registerResult.ResponseCode === "0" || registerResult.ResponseCode === 0) {
            log.info({ tenant_id }, "Safaricom C2B URLs registered successfully");
          } else {
            log.error({ tenant_id, registerResult }, "CRITICAL: Safaricom URL Registration Rejected");
          }
        }
      } catch (mpesaErr) {
        log.error({ 
          err: mpesaErr.message, 
          tenant_id, 
          response: mpesaErr.response?.data 
        }, "CRITICAL: Safaricom URL Registration Failed");
      }
    }

    res.json({ 
      success: true, 
      message: "Tenant MPESA config saved and onboarding completed", 
      data,
      urls: {
        confirmation: finalConfirmationUrl,
        validation: finalValidationUrl
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET tenant MPESA config (single by type)
mpesaConfigRouter.get("/tenant-mpesa-config/:tenant_id", verifySupabaseToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const { service_type = "c2b" } = req.query; // Default to c2b if not specified
    const { data, error } = await supabaseAdmin
      .from("tenant_mpesa_config")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("service_type", service_type)
      .maybeSingle();

    if (error) throw error;
    
    // Decrypt sensitive fields
    if (data) {
      data.consumer_key = data.consumer_key || null;
      data.consumer_secret = data.consumer_secret || null;
      data.passkey = data.passkey || null;
      data.security_credential = data.security_credential || null;
      // Completely remove initiator_password from response
      delete data.initiator_password;
    }

    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all tenant MPESA configs
mpesaConfigRouter.get("/tenant-mpesa-config/:tenant_id/all", verifySupabaseToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const { data, error } = await supabaseAdmin
      .from("tenant_mpesa_config")
      .select("*")
      .eq("tenant_id", tenant_id);

    if (error) throw error;

    // Decrypt sensitive fields for all configs
    const decryptedConfigs = data.map(config => {
      const { initiator_password, ...rest } = config; // Remove initiator_password from output
      return {
        ...rest,
        consumer_key: config.consumer_key || null,
        consumer_secret: config.consumer_secret || null,
        passkey: config.passkey || null,
        security_credential: config.security_credential || null,
      };
    });

    res.json({ data: decryptedConfigs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DIAGNOSTIC ONLY: Force register URLs for a tenant
mpesaConfigRouter.get("/diagnostic/register-urls/:tenant_id", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const { service_type = "c2b" } = req.query;
    
    const { data: config, error: fetchErr } = await supabaseAdmin
      .from("tenant_mpesa_config")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("service_type", service_type)
      .single();

    if (fetchErr || !config) return res.status(404).json({ error: "Config not found in DB" });

    // Decrypt credentials
    config.consumer_key = config.consumer_key;
    config.consumer_secret = config.consumer_secret;

    const payload = {
      ShortCode: config.paybill_number || config.shortcode,
      ResponseType: "Completed",
      ConfirmationURL: config.confirmation_url,
      ValidationURL: config.validation_url
    };

    log.info({ tenant_id, payload }, "DIAGNOSTIC: Triggering Safaricom registration");

    const registerResult = await mpesaRequest(
      config, 
      "POST", 
      "/mpesa/c2b/v1/registerurl", 
      payload
    );

    res.json({ 
      success: true, 
      sent_payload: payload,
      safaricom_response: registerResult 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default mpesaConfigRouter;
