// mpesa_configure.js
import express from "express";
import { createClient } from "@supabase/supabase-js";

const mpesaConfigRouter = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CREATE OR UPDATE TENANT MPESA CONFIG
mpesaConfigRouter.post("/api/tenant-mpesa-config", async (req, res) => {
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
  } = req.body;

  if (!tenant_id) return res.status(400).json({ error: "Tenant required" });

  try {
    // Upsert tenant MPESA config
    const { data, error } = await supabaseAdmin
      .from("tenant_mpesa_config")
      .upsert(
        [
          {
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
          },
        ],
        { onConflict: ["tenant_id"] }
      )
      .select();

    if (error) throw error;

    res.json({ message: "Tenant MPESA config saved", data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET tenant MPESA config
mpesaConfigRouter.get("/api/tenant-mpesa-config/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { data, error } = await supabaseAdmin
      .from("tenant_mpesa_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default mpesaConfigRouter;
