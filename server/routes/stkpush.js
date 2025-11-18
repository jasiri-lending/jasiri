import express from "express";
import axios from "axios";
import { getMpesaToken } from "./mpesa.js";
import { createClient } from "@supabase/supabase-js";

const stkpush = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

//  Timestamp generator for M-Pesa format
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

// STK PUSH INITIATION
stkpush.post("/stkpush", async (req, res) => {
  try {
    console.log(" Incoming STK Push request:", req.body);

    const { amount, phone, accountReference, transactionDesc, loanId, customerId } = req.body;

    if (!amount || !phone) {
      return res.status(400).json({ success: false, message: "Amount and phone are required" });
    }

    //  Determine payment purpose and set description & type
    let billRef = "";
    let description = "";
    let paymentType = "other";

    const refType = accountReference?.toUpperCase();

    if (refType === "REGISTRATION") {
      billRef = `registration-${customerId}`;
      description = "Joining Fee Payment";
      paymentType = "registration";
      console.log(`Registration Fee: KES ${amount} for Customer ${customerId}`);
    } else if (refType === "PROCESSING") {
      billRef = `processing-${loanId}`;
      description = "Loan Processing Fee";
      paymentType = "processing";
      console.log(` Processing Fee: KES ${amount} for Loan ${loanId}`);
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

    console.log(` STK Reference: ${billRef}`);

    //  Log pending transaction before push
    const { data: tx, error: txError } = await supabaseAdmin
      .from("mpesa_c2b_transactions")
      .insert([
        {
          transaction_id: null, // will be updated after STK push
          phone_number: phone,
          amount,
          loan_id: loanId || null,
          customer_id: customerId || null,
          status: "pending",
          payment_type: paymentType,
          description,
          reference: billRef,
          raw_payload: {}, // placeholder
        },
      ])
      .select()
      .single();

    if (txError) {
      console.error(" Failed to insert pending transaction:", txError.message);
    } else {
      console.log(`Pending transaction logged with ID: ${tx?.id}`);
    }

    //  Get M-Pesa Access Token
    const token = await getMpesaToken();

    //  Prepare STK Payload
    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,   
      Password: process.env.MPESA_PASSKEY,
      Timestamp: getCurrentTimestamp(),
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: `${process.env.CALLBACK_URL}/mpesa/c2b/confirmation`,
      AccountReference: billRef,
      TransactionDesc: description,
    };

    console.log(" Sending STK Push payload:", payload);

    //  Send request to Safaricom
    const { data } = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log(" STK Push initiated successfully:", data);

    // Update record with CheckoutRequestID (for callback)
    if (tx?.id) {
      await supabaseAdmin
        .from("mpesa_c2b_transactions")
        .update({
          transaction_id: data.CheckoutRequestID,
          raw_payload: payload,
        })
        .eq("id", tx.id);
    }

    res.status(200).json({
      success: true,
      message: "STK Push sent successfully",
      data,
    });
  } catch (error) {
    console.error(" STK Push Error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

//  STK PUSH CALLBACK HANDLER
stkpush.post("/callback", async (req, res) => {
  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) throw new Error("Invalid callback payload");

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body;
    const status = ResultCode === 0 ? "applied" : "failed";
    const amount = CallbackMetadata?.Item?.find((i) => i.Name === "Amount")?.Value;
    const phone = CallbackMetadata?.Item?.find((i) => i.Name === "PhoneNumber")?.Value;

    console.log(` STK Callback received: ${ResultDesc} (Code: ${ResultCode})`);

    // Update the transaction
    await supabaseAdmin
      .from("mpesa_c2b_transactions")
      .update({
        status,
        amount,
        phone_number: phone,
        transaction_time: new Date().toISOString(),
        raw_payload: body,
      })
      .eq("transaction_id", CheckoutRequestID);

    console.log(` Transaction ${CheckoutRequestID} updated to status: ${status}`);

    res.json({ ResultCode: 0, ResultDesc: "Callback received successfully" });
  } catch (error) {
    console.error("STK Callback Error:", error.message);
    res.json({ ResultCode: 1, ResultDesc: "Callback processing failed" });
  }
});

export default stkpush;