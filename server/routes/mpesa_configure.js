// mpesa_configure.js
import express from "express";
import { supabase, supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken, checkTenantAccess } from "../middleware/authMiddleware.js";
import { encrypt, decrypt } from "../utils/encryption.js";

const mpesaConfigRouter = express.Router();

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
    initiator_password,
    security_credential,
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
    if (!initiator_name || !initiator_password || !security_credential) {
      return res.status(400).json({ error: "Initiator Name, Password and Security Credential are required for B2C" });
    }
  }

  try {
    // 3️⃣ Encrypt sensitive credentials
    const encryptedKey = encrypt(consumer_key);
    const encryptedSecret = encrypt(consumer_secret);
    const encryptedPasskey = encrypt(passkey);
    const encryptedInitiatorPassword = encrypt(initiator_password);
    const encryptedSecurityCredential = encrypt(security_credential);

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
      confirmation_url,
      validation_url,
      callback_url,
      initiator_name,
      initiator_password: encryptedInitiatorPassword,
      security_credential: encryptedSecurityCredential,
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

    res.json({ success: true, message: "Tenant MPESA config saved and onboarding completed", data });
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
      data.consumer_key = decrypt(data.consumer_key);
      data.consumer_secret = decrypt(data.consumer_secret);
      data.passkey = decrypt(data.passkey);
      data.initiator_password = decrypt(data.initiator_password);
      data.security_credential = decrypt(data.security_credential);
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
    const decryptedConfigs = data.map(config => ({
      ...config,
      consumer_key: decrypt(config.consumer_key),
      consumer_secret: decrypt(config.consumer_secret),
      passkey: decrypt(config.passkey),
      initiator_password: decrypt(config.initiator_password),
      security_credential: decrypt(config.security_credential),
    }));

    res.json({ data: decryptedConfigs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default mpesaConfigRouter;
