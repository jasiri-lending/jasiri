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
  const { tenant_id, loan_id, customer_id, phone, amount, processed_by, notes, include_sms } = req.body;

  if (!tenant_id || !loan_id || !customer_id || !phone || !amount) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: tenant_id, loan_id, customer_id, phone, amount"
    });
  }

  let record; // Declare outside try so it's accessible in catch

  try {
    const tenantConfig = await getTenantConfig(tenant_id);

    // Fetch customer name for logging (optional)
    const { data: customer, error: custErr } = await supabaseAdmin
      .from("customers")
      .select("Firstname, Surname")
      .eq("id", customer_id)
      .maybeSingle();
    if (custErr || !customer) {
      log.warn({ customer_id }, "Customer not found for name lookup");
    }
    const customerName = customer ? `${customer.Firstname} ${customer.Surname}`.trim() : null;

    // Log disbursement record in loan_disbursement_transactions
    const insertResult = await supabaseAdmin
      .from("loan_disbursement_transactions")
      .insert({
        loan_id,
        customer_phone: phone,
        amount,
        customer_name: customerName,
        status: "pending",
        tenant_id,
        processed_by: processed_by || null,
        notes: notes || `Loan Disbursement #${loan_id}`,
        customer_id, // ✅ Add this to link the record to the customer
      })
      .select("id")
      .single();

    if (insertResult.error) throw new Error(`Failed to create disbursement record: ${insertResult.error.message}`);
    record = insertResult.data;

    // Prepare B2C request payload using per‑tenant initiator credentials
    const payload = {
      InitiatorName: tenantConfig.initiator_name,               // from tenant config
      SecurityCredential: tenantConfig.security_credential,     // from tenant config
      CommandID: "BusinessPayment",
      Amount: Math.round(amount),
      PartyA: tenantConfig.paybill_number || tenantConfig.till_number || tenantConfig.shortcode,
      PartyB: phone,
      Remarks: notes || `Loan Disbursement #${loan_id}`,
      QueueTimeOutURL: `${tenantConfig.callback_url}/mpesa/b2c/timeout`,
      ResultURL: `${tenantConfig.callback_url}/mpesa/b2c/result`,
      Occasion: `loan-${loan_id}`,
    };

    const mpesaRes = await mpesaRequest(tenantConfig, "POST", "/mpesa/b2c/v1/paymentrequest", payload);
    const convId = mpesaRes?.ConversationID;
    const originatorId = mpesaRes?.OriginatorConversationID;

    // Update the record with conversation IDs and set status to "processing"
    await supabaseAdmin
      .from("loan_disbursement_transactions")
      .update({
        conversation_id: convId,
        originator_conversation_id: originatorId,
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

    // If a record was created, mark it as failed
    if (record?.id) {
      await supabaseAdmin
        .from("loan_disbursement_transactions")
        .update({
          status: "failed",
          error_message: err.message
        })
        .eq("id", record.id);
    }

    res.status(500).json({ success: false, error: err.message });
  }
});

// ── B2C Result callback ─────────────────────────────────────────
b2c.post("/result", async (req, res) => {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { Result } = body;
  if (!Result) return res.json({ ResultCode: 0, ResultDesc: "Received" });

  const convId = Result.ConversationID;
  const originatorId = Result.OriginatorConversationID;

  log.info({ resultCode: Result?.ResultCode, convId }, "B2C result received");

  // Always ACK Safaricom immediately
  res.json({ ResultCode: 0, ResultDesc: "Received" });

  setImmediate(async () => {
    try {
      // Find the original transaction using either conversation_id or originator_conversation_id
      const { data: tx, error } = await supabaseAdmin
        .from("loan_disbursement_transactions")
        .select("tenant_id")
        .or(`conversation_id.eq.${convId},originator_conversation_id.eq.${originatorId}`)
        .maybeSingle();

      if (error || !tx) {
        log.error({ error, convId, originatorId }, "Could not find disbursement transaction for callback");
        return;
      }

      await enqueueJob({
        tenantId: tx.tenant_id,
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
  const { Result } = body;
  const convId = Result?.ConversationID;
  const originatorId = Result?.OriginatorConversationID;

  log.warn({ convId }, "B2C timeout received");
  res.json({ ResultCode: 0, ResultDesc: "Received" });

  setImmediate(async () => {
    try {
      const { data: tx, error } = await supabaseAdmin
        .from("loan_disbursement_transactions")
        .select("tenant_id")
        .or(`conversation_id.eq.${convId},originator_conversation_id.eq.${originatorId}`)
        .maybeSingle();

      if (error || !tx) {
        log.error({ error, convId }, "Could not find disbursement transaction for timeout");
        return;
      }

      await enqueueJob({
        tenantId: tx.tenant_id,
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