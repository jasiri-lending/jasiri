// server/routes/b2c.js
import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { getTenantConfig } from "../services/tenantResolver.js";
import { mpesaRequest } from "../services/mpesa.js";
import { enqueueJob } from "../queue/paymentQueue.js";
import { JOB_TYPES } from "../config/env.js";
import { createLogger } from "../utils/logger.js";

const b2c = express.Router();
const log = createLogger({ service: "b2c" });

// ── Initiate disbursement ───────────────────────────────────────
b2c.post("/disburse", async (req, res) => {
  const { tenant_id, loan_id, customer_id, phone, amount } = req.body;

  if (!tenant_id || !loan_id || !customer_id || !phone || !amount) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: tenant_id, loan_id, customer_id, phone, amount"
    });
  }

  try {
    const tenantConfig = await getTenantConfig(tenant_id);

    // Log disbursement record
    const { data: record, error: insertErr } = await supabaseAdmin
      .from("mpesa_b2c_transactions")
      .insert({
        tenant_id,
        loan_id,
        customer_id,
        phone_number: phone,
        amount,
        description: `Loan Disbursement #${loan_id}`,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr) throw new Error(`Failed to create B2C record: ${insertErr.message}`);

    // Prepare B2C request payload
    const payload = {
      InitiatorName: process.env.MPESA_INITIATOR,
      SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
      CommandID: "BusinessPayment",
      Amount: Math.round(amount),
      PartyA: tenantConfig.paybill_number || tenantConfig.till_number || tenantConfig.shortcode,
      PartyB: phone,
      Remarks: `Loan Disbursement #${loan_id}`,
      QueueTimeOutURL: `${tenantConfig.callback_url}/mpesa/b2c/timeout`,
      ResultURL: `${tenantConfig.callback_url}/mpesa/b2c/result`,
      Occasion: `loan-${loan_id}`,
    };

    const mpesaRes = await mpesaRequest(tenantConfig, "POST", "/mpesa/b2c/v1/paymentrequest", payload);
    const convId = mpesaRes?.ConversationID;
    const originatorId = mpesaRes?.OriginatorConversationID;

    await supabaseAdmin
      .from("mpesa_b2c_transactions")
      .update({
        conversation_id: convId,
        originator_id: originatorId,
        status: "processing"
      })
      .eq("id", record.id);

    log.info({ tenant_id, loan_id, convId }, "Disbursement initiated");
    res.json({
      success: true,
      data: { conversationId: convId, recordId: record.id }
    });

  } catch (err) {
    log.error({ err: err.message, tenant_id, loan_id }, "Disbursement failed");
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── B2C Result callback ─────────────────────────────────────────
b2c.post("/result", async (req, res) => {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  log.info({
    resultCode: body?.Result?.ResultCode,
    convId: body?.Result?.ConversationID
  }, "B2C result received");

  // Always ACK Safaricom immediately
  res.json({ ResultCode: 0, ResultDesc: "Received" });

  setImmediate(async () => {
    try {
      await enqueueJob({
        tenantId: "system", // or extract from body if possible
        jobType: JOB_TYPES.B2C_DISBURSEMENT,
        payload: body,
        priority: 1,
      });
    } catch (err) {
      log.error({ err: err.message }, "Failed to queue B2C result");
    }
  });
});

// ── B2C Timeout callback ────────────────────────────────────────
b2c.post("/timeout", async (req, res) => {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  log.warn({ convId: body?.Result?.ConversationID }, "B2C timeout received");
  res.json({ ResultCode: 0, ResultDesc: "Received" });

  setImmediate(async () => {
    try {
      await enqueueJob({
        tenantId: "system",
        jobType: JOB_TYPES.B2C_DISBURSEMENT,
        payload: { ...body, timeout: true },
        priority: 1,
      });
    } catch (err) {
      log.error({ err: err.message }, "Failed to queue B2C timeout");
    }
  });
});

export default b2c;