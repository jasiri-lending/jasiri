// mpesa_configure.js
import express from "express";
import { supabase, supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken, checkTenantAccess } from "../middleware/authMiddleware.js";
import crypto from "crypto";

const mpesaConfigRouter = express.Router();

// Apply authentication directly to routes to avoid global leak
// mpesaConfigRouter.use(verifySupabaseToken);

// Basic encryption logic
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "jasiri_default_encryption_key_32ch";
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return null;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32)), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  } catch (err) {
    console.error("Encryption error:", err);
    return text; // Fallback to plain text if encryption fails (not ideal, but safer than crashing)
  }
}

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

  // 2️⃣ XOR Logic Validation: Paybill OR Till (not both, at least one)
  const hasPaybill = !!paybill_number;
  const hasTill = !!till_number;

  if ((hasPaybill && hasTill) || (!hasPaybill && !hasTill)) {
    return res.status(400).json({ error: "Each tenant must have either a Paybill OR a Till (not both)" });
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
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default mpesaConfigRouter;
