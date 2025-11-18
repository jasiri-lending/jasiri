import express from "express";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { getMpesaToken } from "./mpesa.js";

const b2c = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


//  B2C DISBURSEMENT INITIATION
b2c.post("/disburse", async (req, res) => {
  try {
    const { amount, phone, loanId, customerId } = req.body;

    if (!amount || !phone || !loanId || !customerId) {
      return res.status(400).json({
        success: false,
        message: "Amount, phone, loanId, and customerId are required",
      });
    }

    //  Log the transaction first
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
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (recordError) throw recordError;

    //  Get M-Pesa access token
    const token = await getMpesaToken();

    //  Prepare B2C payload
    const payload = {
      InitiatorName: process.env.MPESA_INITIATOR,
      SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
      CommandID: "BusinessPayment",
      Amount: amount,
      PartyA: process.env.MPESA_SHORTCODE,
      PartyB: phone,
      Remarks: "Loan Disbursement",
      QueueTimeOutURL: `${process.env.CALLBACK_URL}/mpesa/b2c/timeout`,
      ResultURL: `${process.env.CALLBACK_URL}/mpesa/b2c/result`,
      Occasion: `loan-${loanId}`,
    };

    console.log("Sending B2C disbursement:", payload);

    //  Send request to M-Pesa
    const { data } = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log(" B2C Request accepted:", data);

    //  Update record with transaction ID
    await supabaseAdmin
      .from("mpesa_b2c_transactions")
      .update({
        transaction_id: data?.ConversationID || data?.OriginatorConversationID,
      })
      .eq("id", record.id);

    res.status(200).json({
      success: true,
      message: "Disbursement initiated successfully",
      data,
    });
  } catch (error) {
    console.error("B2C Disbursement Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// B2C RESULT CALLBACK
b2c.post("/result", async (req, res) => {
  try {
    const body = req.body?.Result || {};
    const { ResultCode, ResultDesc, ResultParameters, OriginatorConversationID } = body;

    const status = ResultCode === 0 ? "success" : "failed";
    const amount =
      ResultParameters?.ResultParameter?.find((p) => p.Key === "TransactionAmount")?.Value;
    const phone =
      ResultParameters?.ResultParameter?.find((p) => p.Key === "ReceiverPartyPublicName")?.Value;
    const transaction_time = new Date().toISOString();

    //  Update record
    await supabaseAdmin
      .from("mpesa_b2c_transactions")
      .update({
        status,
        amount,
        phone_number: phone,
        transaction_time,
        raw_payload: body,
        failure_reason: status === "failed" ? ResultDesc : null,
      })
      .eq("transaction_id", OriginatorConversationID);

    console.log(` B2C Callback received: ${ResultDesc}`);

    //  If success, mark loan as disbursed
    if (status === "success") {
      const { data: tx } = await supabaseAdmin
        .from("mpesa_b2c_transactions")
        .select("loan_id")
        .eq("transaction_id", OriginatorConversationID)
        .single();

      if (tx?.loan_id) {
        await supabaseAdmin
          .from("loans")
          .update({ status: "disbursed", disbursed_at: transaction_time })
          .eq("id", tx.loan_id);

        console.log(` Loan ${tx.loan_id} marked as disbursed`);
      }
    }

    res.json({ ResultCode: 0, ResultDesc: "Callback processed successfully" });
  } catch (error) {
    console.error(" B2C Callback Error:", error.message);
    res.json({ ResultCode: 1, ResultDesc: "Callback processing failed" });
  }
});

//  TIMEOUT HANDLER (optional)
b2c.post("/timeout", (req, res) => {
  console.warn(" B2C Timeout:", req.body);
  res.json({ ResultCode: 1, ResultDesc: "Timeout received" });
});

export default b2c;
