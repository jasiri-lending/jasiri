// backend/routes/stkpush.js
import express from "express";
import { supabaseAdmin }                   from "../supabaseClient.js";
import { getTenantConfig }                 from "../services/tenantResolver.js";
import { mpesaRequest, getMpesaTimestamp, buildStkPassword } from "../services/mpesa.js";
import { enqueueJob }                      from "../queue/paymentQueue.js";
import { JOB_TYPES }                       from "../config/env.js";
import { createLogger }                    from "../utils/logger.js";

const stkpush = express.Router();
const log     = createLogger({ service: "stkpush" });

stkpush.post("/stkpush", async (req, res) => {
  const { tenant_id, amount, phone, account_reference, loan_id, customer_id } = req.body;

  if (!tenant_id || !amount || !phone) {
    return res.status(400).json({ success: false, message: "tenant_id, amount, phone are required" });
  }

  try {
    const tenantConfig = await getTenantConfig(tenant_id);
    const shortcode    = tenantConfig.paybill_number || tenantConfig.till_number;
    const timestamp    = getMpesaTimestamp();
    const password     = buildStkPassword(shortcode, tenantConfig.passkey, timestamp);

    const { billRef, description, paymentType, jobType } = buildBillRef(account_reference, loan_id, customer_id);

    // Pre-log pending C2B transaction
    const { data: pendingTx } = await supabaseAdmin
      .from("mpesa_c2b_transactions")
      .insert({
        phone_number:  phone,
        amount,
        status:        "pending",
        raw_payload:   {},
        billref:       billRef,
        reference:     billRef,
        payment_type:  paymentType,
        description,
        loan_id:       loan_id || null,
        tenant_id,
      })
      .select("id")
      .single();

    // Send STK Push to Safaricom
    const stkPayload = {
      BusinessShortCode: shortcode,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   "CustomerPayBillOnline",
      Amount:            Math.round(parseFloat(amount)),
      PartyA:            phone,
      PartyB:            shortcode,
      PhoneNumber:       phone,
      CallBackURL:       `${tenantConfig.callback_url}/mpesa/c2b/stkpush/callback`,
      AccountReference:  billRef,
      TransactionDesc:   description,
    };

    const mpesaData = await mpesaRequest(tenantConfig, "POST", "/mpesa/stkpush/v1/processrequest", stkPayload);

    // Update pending record with CheckoutRequestID
    if (pendingTx?.id && mpesaData.CheckoutRequestID) {
      await supabaseAdmin
        .from("mpesa_c2b_transactions")
        .update({ transaction_id: mpesaData.CheckoutRequestID, raw_payload: stkPayload })
        .eq("id", pendingTx.id);
    }

    log.info({ checkoutRequestId: mpesaData.CheckoutRequestID, tenant_id }, "STK Push sent");
    res.json({ success: true, message: "STK Push sent", data: mpesaData, pending_tx_id: pendingTx?.id });

  } catch (err) {
    log.error({ err: err.message, tenant_id, phone }, "STK Push failed");
    res.status(500).json({ success: false, message: err.message });
  }
});

stkpush.post("/stkpush/callback", async (req, res) => {
  const callback = req.body?.Body?.stkCallback;
  if (!callback) return res.json({ ResultCode: 0, ResultDesc: "Received" });

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;
  log.info({ CheckoutRequestID, ResultCode }, "STK Push callback received");

  res.json({ ResultCode: 0, ResultDesc: "Received" });

  setImmediate(async () => {
    try {
      const isSuccess = ResultCode === 0;
      const meta      = CallbackMetadata?.Item || [];
      const getVal    = (name) => meta.find(i => i.Name === name)?.Value;

      const mpesaCode   = getVal("MpesaReceiptNumber");
      const paidAmount  = getVal("Amount");
      const phoneNumber = getVal("PhoneNumber");

      // Find the pending transaction by CheckoutRequestID
      const { data: tx } = await supabaseAdmin
        .from("mpesa_c2b_transactions")
        .select("id, tenant_id, billref, payment_type")
        .eq("transaction_id", CheckoutRequestID)
        .maybeSingle();

      await supabaseAdmin
        .from("mpesa_c2b_transactions")
        .update({
          status:           isSuccess ? "pending" : "failed",
          transaction_id:   isSuccess ? mpesaCode : CheckoutRequestID,
          amount:           paidAmount || undefined,
          phone_number:     phoneNumber ? String(phoneNumber) : undefined,
          transaction_time: new Date().toISOString(),
          raw_payload:      callback,
          callback_status:  ResultDesc,
        })
        .eq("transaction_id", CheckoutRequestID);

      // Enqueue for worker processing if payment succeeded
      if (isSuccess && mpesaCode && tx?.tenant_id) {
        const billref   = (tx.billref || "").toLowerCase();
        let jobType     = JOB_TYPES.C2B_REPAYMENT;
        if (billref.startsWith("registration")) jobType = JOB_TYPES.REGISTRATION;
        else if (billref.startsWith("processing")) jobType = JOB_TYPES.PROCESSING_FEE;

        await enqueueJob({ tenantId: tx.tenant_id, jobType, payload: { transaction_id: mpesaCode }, priority: 5 });
        log.info({ mpesaCode, jobType }, "STK callback payment queued for processing");
      }

    } catch (err) {
      log.error({ err: err.message, CheckoutRequestID }, "STK callback error");
    }
  });
});

function buildBillRef(accountReference, loanId, customerId) {
  const ref = (accountReference || "").toLowerCase();
  if (ref === "registration") return { billRef: `registration-${customerId || "unknown"}`, description: "Registration Fee", paymentType: "registration", jobType: JOB_TYPES.REGISTRATION };
  if (ref === "processing")   return { billRef: `processing-${loanId || "unknown"}`,       description: "Loan Processing Fee", paymentType: "processing",   jobType: JOB_TYPES.PROCESSING_FEE };
  return { billRef: loanId ? `repayment-${loanId}` : `general-${customerId || "unknown"}`, description: "Loan Repayment", paymentType: "repayment", jobType: JOB_TYPES.C2B_REPAYMENT };
}

export default stkpush;