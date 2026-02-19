import express from "express";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { getTenantMpesaToken } from "./mpesa.js";

const b2c = express.Router();
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// B2C Disbursement Endpoint
b2c.post("/b2c/disburse", async (req, res) => {
  try {
    const { tenant_id, amount, phone, loan_id, customer_id } = req.body;
    if (!tenant_id || !amount || !phone || !loan_id || !customer_id)
      return res.status(400).json({ error: "Missing required fields" });

    // 1️⃣ Fetch tenant MPESA config
    const tenantConfig = await supabaseAdmin
      .from("tenant_mpesa_config")
      .select("*")
      .eq("tenant_id", tenant_id)
      .single()
      .then(r => {
        if (r.error || !r.data) throw new Error("Tenant MPESA config not found");
        return r.data;
      });

    // 2️⃣ Generate tenant-specific MPESA token
    const token = await getTenantMpesaToken(tenantConfig);

    // 3️⃣ Log transaction in B2C table
    const { data: txRecord, error: insertError } = await supabaseAdmin
      .from("mpesa_b2c_transactions")
      .insert([
        {
          tenant_id,
          loan_id,
          customer_id,
          phone_number: phone,
          amount,
          description: "Loan Disbursement",
          status: "pending"
        }
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    // 4️⃣ Build B2C request payload
    const payload = {
      InitiatorName: process.env.MPESA_INITIATOR,
      SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
      CommandID: "BusinessPayment",
      Amount: amount,
      PartyA: tenantConfig.paybill_number || tenantConfig.till_number || tenantConfig.shortcode,
      PartyB: phone,
      Remarks: `Loan Disbursement - ${loan_id}`,
      QueueTimeOutURL: tenantConfig.callback_url + "/b2c/timeout",
      ResultURL: tenantConfig.callback_url + "/b2c/result",
      Occasion: `loan-${loan_id}`,
    };

    // 5️⃣ Call Safaricom B2C API
    const { data: mpesaResponse } = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // 6️⃣ Update transaction with conversation ID
    await supabaseAdmin
      .from("mpesa_b2c_transactions")
      .update({
        transaction_id: mpesaResponse?.ConversationID || mpesaResponse?.OriginatorConversationID
      })
      .eq("id", txRecord.id);

    res.json({ success: true, data: mpesaResponse, txRecord });
  } catch (err) {
    console.error("B2C Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default b2c;
