import express from "express";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { getTenantMpesaToken } from "./mpesa.js";

const stkpush = express.Router();
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Timestamp generator for MPESA
const getCurrentTimestamp = () => {
  const date = new Date();
  const YYYY = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const DD = String(date.getDate()).padStart(2, "0");
  const HH = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${YYYY}${MM}${DD}${HH}${mm}${ss}`;
};

// STK Push initiation
stkpush.post("/stkpush", async (req, res) => {
  try {
    const { tenant_id, amount, phone, accountReference, transactionDesc, loanId, customerId } = req.body;

    if (!tenant_id || !amount || !phone) {
      return res.status(400).json({ success: false, message: "Tenant ID, amount and phone are required" });
    }

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

    // 2️⃣ Determine payment purpose
    let billRef = "";
    let description = "";
    let paymentType = "other";

    const refType = accountReference?.toUpperCase();

    if (refType === "REGISTRATION") {
      billRef = `registration-${customerId}`;
      description = "Joining Fee Payment";
      paymentType = "registration";
    } else if (refType === "PROCESSING") {
      billRef = `processing-${loanId}`;
      description = "Loan Processing Fee";
      paymentType = "processing";
    } else if (refType === "INTEREST") {
      billRef = `interest-${loanId}`;
      description = "Interest Repayment";
      paymentType = "interest";
    } else if (refType === "PRINCIPAL") {
      billRef = `principal-${loanId}`;
      description = "Principal Repayment";
      paymentType = "principal";
    } else {
      billRef = `general-${customerId || "unknown"}`;
      description = "General Payment";
      paymentType = "other";
    }

    // 3️⃣ Log pending transaction
    const { data: tx, error: txError } = await supabaseAdmin
      .from("mpesa_c2b_transactions")
      .insert([
        {
          tenant_id,
          transaction_id: null, // will be updated after STK push
          phone_number: phone,
          amount,
          loan_id: loanId || null,
          customer_id: customerId || null,
          status: "pending",
          payment_type: paymentType,
          description,
          reference: billRef,
          raw_payload: {},
        },
      ])
      .select()
      .single();

    if (txError) console.error("Failed to insert pending transaction:", txError.message);

    // 4️⃣ Get tenant-specific MPESA token
    const token = await getTenantMpesaToken(tenantConfig);

    // 5️⃣ Prepare STK Push payload
    const payload = {
      BusinessShortCode: tenantConfig.paybill_number || tenantConfig.till_number || tenantConfig.shortcode,
      Password: tenantConfig.passkey,
      Timestamp: getCurrentTimestamp(),
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: tenantConfig.paybill_number || tenantConfig.till_number || tenantConfig.shortcode,
      PhoneNumber: phone,
      CallBackURL: `${tenantConfig.callback_url}/mpesa/stkpush/callback`,
      AccountReference: billRef,
      TransactionDesc: description,
    };

    console.log("STK Push payload:", payload);

    // 6️⃣ Send STK Push request
    const { data } = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // 7️⃣ Update transaction with CheckoutRequestID
    if (tx?.id) {
      await supabaseAdmin
        .from("mpesa_c2b_transactions")
        .update({ transaction_id: data.CheckoutRequestID, raw_payload: payload })
        .eq("id", tx.id);
    }

    res.status(200).json({ success: true, message: "STK Push sent successfully", data, txId: tx?.id });
  } catch (error) {
    console.error("STK Push Error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// STK Push callback handler
stkpush.post("/callback", async (req, res) => {
  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) throw new Error("Invalid callback payload");

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body;
    const status = ResultCode === 0 ? "applied" : "failed";
    const amount = CallbackMetadata?.Item?.find(i => i.Name === "Amount")?.Value;
    const phone = CallbackMetadata?.Item?.find(i => i.Name === "PhoneNumber")?.Value;

    // Update transaction in database
    await supabaseAdmin
      .from("mpesa_c2b_transactions")
      .update({ status, amount, phone_number: phone, transaction_time: new Date().toISOString(), raw_payload: body })
      .eq("transaction_id", CheckoutRequestID);

    res.json({ ResultCode: 0, ResultDesc: "Callback received successfully" });
  } catch (error) {
    console.error("STK Callback Error:", error.message);
    res.json({ ResultCode: 1, ResultDesc: "Callback processing failed" });
  }
});

export default stkpush;
