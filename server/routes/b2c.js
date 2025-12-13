// b2c.js
import express from "express";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { getMpesaToken } from "./mpesa.js";

const b2c = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Fetch tenant MPESA config helper
async function getTenantConfig(tenantId) {
  const { data, error } = await supabaseAdmin
    .from("tenant_mpesa_config")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  if (error) throw new Error("Tenant MPESA config not found");
  return data;
}

// B2C Disbursement
b2c.post("/b2c/disburse", async (req, res) => {
  try {
    const { tenant_id, amount, phone, loanId, customerId } = req.body;
    if (!tenant_id || !amount || !phone || !loanId || !customerId)
      return res.status(400).json({ error: "Missing required fields" });

    // Log transaction
    const { data: record, error: recordError } = await supabaseAdmin
      .from("mpesa_b2c_transactions")
      .insert([
        {
          loan_id: loanId,
          customer_id: customerId,
          phone_number: phone,
          amount,
          description: "Loan Disbursement",
          status: "pending",
        },
      ])
      .select()
      .single();

    if (recordError) throw recordError;

    // Fetch tenant MPESA config
    const tenantConfig = await getTenantConfig(tenant_id);
const token = await getMpesaToken(tenantConfig);

    // B2C payload
    const payload = {
      InitiatorName: process.env.MPESA_INITIATOR,
      SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
      CommandID: "BusinessPayment",
      Amount: amount,
      PartyA: tenantConfig.paybill_number || tenantConfig.shortcode,
      PartyB: phone,
      Remarks: "Loan Disbursement",
      QueueTimeOutURL: tenantConfig.callback_url + "/b2c/timeout",
      ResultURL: tenantConfig.callback_url + "/b2c/result",
      Occasion: `loan-${loanId}`,
    };

    const { data } = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Update transaction with ID
    await supabaseAdmin
      .from("mpesa_b2c_transactions")
      .update({
        transaction_id: data?.ConversationID || data?.OriginatorConversationID,
      })
      .eq("id", record.id);

    res.json({ success: true, message: "Disbursement initiated", data });
  } catch (err) {
    console.error("B2C Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default b2c;
