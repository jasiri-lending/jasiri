// server/routes/b2c.js
import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken, checkTenantAccess } from "../middleware/authMiddleware.js";
import { getTenantConfig } from "../services/tenantResolver.js";
import { mpesaRequest } from "../services/mpesa.js";
import { JOB_TYPES } from "../config/env.js";
import { createLogger } from "../utils/logger.js";
import { decrypt } from "../utils/encryption.js";

const b2c = express.Router();
const log = createLogger({ service: "b2c" });

// Apply authentication globally to this router (except for callbacks)
b2c.use((req, res, next) => {
  // Skip auth for Safaricom callbacks (result and timeout)
  if (req.path === "/result" || req.path === "/timeout") {
    return next();
  }
  return verifySupabaseToken(req, res, next);
});

// ── Initiate disbursement ───────────────────────────────────────
b2c.post("/disburse", checkTenantAccess, async (req, res) => {
  const { tenant_id, loan_id, customer_id, phone, amount, processed_by, notes, include_sms } = req.body;

  if (!tenant_id || !loan_id || !customer_id || !phone || !amount) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: tenant_id, loan_id, customer_id, phone, amount"
    });
  }

  let record; // Declare outside try so it's accessible in catch

  try {
    const tenantConfig = await getTenantConfig(tenant_id, "b2c");

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
      SecurityCredential: decrypt(tenantConfig.security_credential),     // from tenant config
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

    // Update loan status in loans table to fire installment generation trigger
    // We do this here using supabaseAdmin to bypass RLS issues on loan_installments table
    const { error: loanUpdateError } = await supabaseAdmin
      .from("loans")
      .update({
        status: 'disbursed',
        disbursed_at: new Date().toISOString(),
        mpesa_transaction_id: convId,
        disbursement_notes: notes || `Loan Disbursement #${loan_id}`,
        disbursed_by: processed_by || null
      })
      .eq("id", loan_id);

    if (loanUpdateError) {
      log.error({ err: loanUpdateError.message, loan_id }, "Failed to update loan status in backend");
      // We don't throw here to avoid failing the whole request if the M-Pesa part succeeded, 
      // but it's a serious issue that should be investigated.
    }

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
      const isSuccess = Result.ResultCode === 0;
      const status = isSuccess ? "success" : "failed";

      const items = Result.ReferenceData?.ReferenceItem;
      const occasion = Array.isArray(items) 
         ? items.find((i) => i.Key === "Occasion")?.Value 
         : items?.Value;
      const loanId = occasion?.replace("loan-", "");

      // Find the original transaction
      const { data: tx, error } = await supabaseAdmin
        .from("loan_disbursement_transactions")
        .select("*")
        .or(`conversation_id.eq.${convId},originator_conversation_id.eq.${originatorId}`)
        .maybeSingle();

      if (error || !tx) {
        log.error({ error, convId, originatorId }, "Could not find disbursement transaction for callback");
        return;
      }

      // Update the transaction record directly
      const { error: updateError } = await supabaseAdmin
        .from("loan_disbursement_transactions")
        .update({
          status,
          result_code: Number(Result.ResultCode),
          result_desc: Result.ResultDesc,
          transaction_id: Result.TransactionID || null,
          raw_result: Result,
          completed_at: new Date().toISOString(),
          processed_at: new Date().toISOString()
        })
        .eq("id", tx.id);

      if (updateError) {
        log.error({ updateError, txId: tx.id }, "Failed to update disbursement transaction");
        return; // Abort further processing
      }

      // Update loan status based on success/failure
      if (isSuccess && loanId) {
        await supabaseAdmin
          .from("loans")
          .update({
            status: "disbursed",
            disbursed_at: new Date().toISOString(),
            mpesa_transaction_id: Result.TransactionID,
          })
          .eq("id", loanId)
          .eq("status", "ready_for_disbursement");
          
        log.info({ loanId, transactionId: Result.TransactionID }, "Loan marked as disbursed");

        // Handle SMS instantly instead of queueing
        try {
          const tenantId = tx.tenant_id;
          const { data: cust, error: custErr } = await supabaseAdmin
            .from("customers")
            .select("Firstname, mobile")
            .eq("id", tx.customer_id)
            .eq("tenant_id", tenantId)
            .maybeSingle();

          if (custErr || !cust) throw new Error(`Customer not found: ${tx.customer_id}`);
          const firstName = cust.Firstname || "Customer";
          const customerMobile = cust.mobile;
          if (!customerMobile) throw new Error("Customer mobile missing");

          const { data: tenantConfig, error: cfgErr } = await supabaseAdmin
            .from("tenant_mpesa_config")
            .select("paybill_number, till_number, shortcode")
            .eq("tenant_id", tenantId)
            .eq("service_type", "c2b")
            .eq("is_active", true)
            .maybeSingle();

          if (cfgErr || !tenantConfig) throw new Error(`Tenant config missing for tenant ${tenantId}`);
          const paybill = tenantConfig.paybill_number || tenantConfig.till_number || tenantConfig.shortcode || "N/A";

          const { data: loan, error: loanErr } = await supabaseAdmin
            .from("loans")
            .select("weekly_payment")
            .eq("id", loanId)
            .maybeSingle();

          if (loanErr || !loan) throw new Error(`Loan not found: ${loanId}`);
          const weeklyPayment = Number(loan.weekly_payment).toLocaleString();
          const amountFormatted = Number(tx.amount).toLocaleString();

          const message = `Dear ${firstName}, we have disbursed KES ${amountFormatted} via M-PESA. Your weekly installment is KES ${weeklyPayment} due to paybill ${paybill}.`;

          const { data: smsConfig, error: smsErr } = await supabaseAdmin
            .from("tenant_sms_settings")
            .select("*")
            .eq("tenant_id", tenantId)
            .maybeSingle();

          if (smsErr || !smsConfig) {
            throw new Error(`SMS config missing for tenant ${tenantId}`);
          }

          const encodedMsg = encodeURIComponent(message.trim());
          const url = `${smsConfig.base_url}?apikey=${smsConfig.api_key}&partnerID=${smsConfig.partner_id}&message=${encodedMsg}&shortcode=${smsConfig.shortcode}&mobile=${customerMobile}`;
          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(`SMS send failed (${response.status})`);
          }

          await supabaseAdmin.from("sms_logs").insert({
            customer_id: tx.customer_id,
            recipient_phone: customerMobile,
            message,
            status: "sent",
            message_id: `sms-${Date.now()}`,
            tenant_id: tenantId,
            created_at: new Date().toISOString(),
          });

          log.info({ loan_id: loanId }, "Successfully sent SMS for loan");
        } catch (smsErr) {
          log.error({ err: smsErr.message, loan_id: loanId }, "Failed to send disbursement SMS instantly");
        }
      } else if (!isSuccess && loanId) {
        // Revert loan status on failure so they can try again
        await supabaseAdmin
          .from("loans")
          .update({ status: "ready_for_disbursement" })
          .eq("id", loanId)
          .in("status", ["disbursed", "processing"]);
          
        log.warn({ loanId, resultDesc: Result.ResultDesc }, "Disbursement failed, reverted loan status");
      }
    } catch (err) {
      log.error({ err: err.message }, "Failed to process B2C result directly");
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
        .select("*")
        .or(`conversation_id.eq.${convId},originator_conversation_id.eq.${originatorId}`)
        .maybeSingle();

      if (error || !tx) {
        log.error({ error, convId }, "Could not find disbursement transaction for timeout");
        return;
      }

      // Mark as failed in DB directly due to timeout
      await supabaseAdmin
        .from("loan_disbursement_transactions")
        .update({
          status: "failed",
          result_code: 408,
          result_desc: "Transaction Timed Out",
          raw_result: Result,
          completed_at: new Date().toISOString(),
          processed_at: new Date().toISOString()
        })
        .eq("id", tx.id);
        
      // Revert the loan status
      const items = Result.ReferenceData?.ReferenceItem;
      const occasion = Array.isArray(items) ? items.find((i) => i.Key === "Occasion")?.Value : items?.Value;
      const loanId = occasion?.replace("loan-", "");
      if (loanId) {
        await supabaseAdmin
          .from("loans")
          .update({ status: "ready_for_disbursement" })
          .eq("id", loanId)
          .in("status", ["disbursed", "processing"]);
      }
    } catch (err) {
      log.error({ err: err.message }, "Failed to process B2C timeout directly");
    }
  });
});

export default b2c;