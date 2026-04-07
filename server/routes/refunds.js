import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken, checkTenantAccess } from "../middleware/authMiddleware.js";
import { createLogger } from "../utils/logger.js";
import { getTenantConfig } from "../services/tenantResolver.js";
import { mpesaRequest } from "../services/mpesa.js";

const router = express.Router();
const log = createLogger({ service: "refunds" });

const formatPhone = (phone) => {
  if (!phone) return "";
  const cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.startsWith("254") && cleaned.length === 12) return cleaned;
  if (cleaned.startsWith("0") && cleaned.length === 10) return "254" + cleaned.substring(1);
  if (cleaned.length === 9 && (cleaned.startsWith("7") || cleaned.startsWith("1"))) return "254" + cleaned;
  return cleaned;
};

// Apply authentication globally except for callbacks
router.use((req, res, next) => {
  if (req.path === "/result" || req.path === "/timeout") {
    return next();
  }
  return verifySupabaseToken(req, res, next);
});

/**
 * Initiate a refund request
 * POST /api/refunds/initiate
 */
router.post("/initiate", checkTenantAccess, async (req, res) => {
  const { customer_id, loan_id, amount, reason, tenant_id } = req.body;
  const initiator_id = req.user.id;

  if (!customer_id || !amount || !tenant_id) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    // 1. Verify permissions (simplified for now, assuming checkTenantAccess/middleware handles basic auth)
    // In a real scenario, we'd check req.user.role/permissions

    // 2. Calculate Current Wallet Balance
    const { data: walletData } = await supabaseAdmin
      .from("customer_wallets")
      .select("credit, debit")
      .eq("customer_id", customer_id)
      .eq("tenant_id", tenant_id);
    
    const currentBalance = (walletData || []).reduce((acc, row) => acc + (row.credit || 0) - (row.debit || 0), 0);
    
    // 3. Calculate Eligible Processing Fees
    let refundableLimit = currentBalance;
    
    if (loan_id) {
      const { data: loan } = await supabaseAdmin
        .from("loans")
        .select("status, repayment_state, processing_fee, processing_fee_paid")
        .eq("id", loan_id)
        .single();
      
      if (!loan) {
        return res.status(404).json({ success: false, error: "Loan not found" });
      }

      const isDisbursed = loan.status === 'disbursed';
      const isRepaymentActive = ['ongoing', 'partial', 'overdue', 'defaulted'].includes(loan.repayment_state);

      if (isDisbursed && isRepaymentActive) {
        return res.status(400).json({ 
          success: false, 
          error: "Refunds are not allowed for active disbursed loans." 
        });
      }

      const { data: feeLogs } = await supabaseAdmin
        .from("loan_fee_logs")
        .select("amount")
        .eq("loan_id", loan_id)
        .eq("fee_type", "processing");

      const loanFees = (feeLogs || []).reduce((sum, log) => sum + parseFloat(log.amount), 0) || (loan?.processing_fee_paid ? loan.processing_fee : 0);

      const { data: existingRefunds } = await supabaseAdmin
        .from("refund_requests")
        .select("amount")
        .eq("loan_id", loan_id)
        .eq("status", "approved");
      
      const totalRefunded = (existingRefunds || []).reduce((sum, ref) => sum + parseFloat(ref.amount), 0);
      refundableLimit += (loanFees - totalRefunded);
    } else {
      // If no loan_id, check total across all eligible loans
      const { data: allLoans } = await supabaseAdmin
        .from("loans")
        .select("id, processing_fee, processing_fee_paid, status, repayment_state")
        .eq("customer_id", customer_id);

      const eligibleLoans = (allLoans || []).filter(l => {
        if (!l.processing_fee_paid) return false;
        const isDisbursed = l.status === 'disbursed';
        const isRepaymentActive = ['ongoing', 'partial', 'overdue', 'defaulted'].includes(l.repayment_state);
        return !(isDisbursed && isRepaymentActive);
      });

      const totalFees = eligibleLoans.reduce((sum, l) => sum + (parseFloat(l.processing_fee) || 0), 0);
      
      const { data: allRefunds } = await supabaseAdmin
        .from("refund_requests")
        .select("amount")
        .eq("customer_id", customer_id)
        .eq("status", "approved");

      const totalRefunded = (allRefunds || []).reduce((sum, ref) => sum + parseFloat(ref.amount), 0);
      refundableLimit += (totalFees - totalRefunded);
    }

    // Combined Check
    if (amount > refundableLimit) {
      return res.status(400).json({ 
        success: false, 
        error: `Refund amount exceeds total refundable assets (Max: KES ${refundableLimit.toLocaleString()})` 
      });
    }

    // 4. Create Refund Request
    const { data: refund, error } = await supabaseAdmin
      .from("refund_requests")
      .insert({
        customer_id,
        loan_id,
        amount,
        reason,
        status: "pending",
        initiated_by: initiator_id,
        tenant_id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data: refund });
  } catch (err) {
    log.error({ err: err.message, customer_id }, "Refund initiation failed");
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get pending refunds
 * GET /api/refunds/pending
 */
router.get("/pending", checkTenantAccess, async (req, res) => {
  const { tenant_id } = req.query;
  try {
    const { data, error } = await supabaseAdmin
      .from("refund_requests")
      .select(`
        *,
        customers (Firstname, Surname, mobile),
        initiator:users!initiated_by (full_name)
      `)
      .eq("tenant_id", tenant_id)
      .eq("status", "pending");

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Approve a refund
 * POST /api/refunds/approve/:id
 */
router.post("/approve/:id", checkTenantAccess, async (req, res) => {
  const { id } = req.params;
  const approver_id = req.user.id;

  try {
    // 1. Fetch details
    const { data: refund, error: fetchErr } = await supabaseAdmin
      .from("refund_requests")
      .select("*, customers(mobile)")
      .eq("id", id)
      .single();

    if (fetchErr || !refund) return res.status(404).json({ error: "Refund request not found" });
    if (refund.status !== "pending") return res.status(400).json({ error: "Refund is not in pending state" });

    // 2. Maker-Checker check
    if (refund.initiated_by === approver_id) {
      return res.status(403).json({ error: "Maker-Checker violation: You cannot approve your own initiation." });
    }

    // 3. Trigger M-Pesa B2C
    const tenantConfig = await getTenantConfig(refund.tenant_id, "b2c");
    const formattedPhone = formatPhone(refund.customers?.mobile);

    if (!formattedPhone) {
      return res.status(400).json({ error: "Customer mobile number is missing or invalid for refund." });
    }

    const payload = {
      InitiatorName: tenantConfig.initiator_name,
      SecurityCredential: tenantConfig.security_credential,
      CommandID: "BusinessPayment",
      Amount: Math.round(refund.amount),
      PartyA: tenantConfig.paybill_number || tenantConfig.shortcode,
      PartyB: formattedPhone,
      Remarks: refund.reason || "Customer Refund",
      QueueTimeOutURL: `${tenantConfig.callback_url}${(tenantConfig.environment === "sandbox") ? "/api" : "/mpesa"}/b2c/timeout`,
      ResultURL: `${tenantConfig.callback_url}${(tenantConfig.environment === "sandbox") ? "/api" : "/mpesa"}/b2c/result`,
      Occasion: `refund-${refund.id}`,
    };

    const mpesaRes = await mpesaRequest(tenantConfig, "POST", "/mpesa/b2c/v1/paymentrequest", payload);
    
    // 4. Record initiation and M-Pesa attempt
    await supabaseAdmin
      .from("refund_requests")
      .update({
        status: "processing",
        approved_by: approver_id,
        approved_at: new Date().toISOString(),
        mpesa_transaction_id: mpesaRes?.ConversationID || "processing"
      })
      .eq("id", id);

    res.json({ success: true, message: "Refund approval initiated, waiting for M-Pesa callback" });
  } catch (err) {
    log.error({ err: err.message, refund_id: id }, "Refund approval failed");
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * B2C Result callback for Refunds
 * POST /api/refunds/result
 */
router.post("/result", async (req, res) => {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { Result } = body;
  if (!Result) return res.json({ ResultCode: 0, ResultDesc: "Received" });

  const convId = Result.ConversationID;
  log.info({ resultCode: Result?.ResultCode, convId }, "Refund B2C result received");

  // Acknowledge Safaricom immediately
  res.json({ ResultCode: 0, ResultDesc: "Received" });

  setImmediate(async () => {
    try {
      const isSuccess = Result.ResultCode === 0;
      const status = isSuccess ? "completed" : "failed";

      // Find the refund request using conversation ID
      const { data: refund, error } = await supabaseAdmin
        .from("refund_requests")
        .select("*")
        .eq("mpesa_transaction_id", convId)
        .maybeSingle();

      if (error || !refund) {
        log.error({ convId }, "Could not find refund request for B2C callback");
        return;
      }

      // Update refund status
      await supabaseAdmin
        .from("refund_requests")
        .update({
          status,
          mpesa_transaction_id: Result.TransactionID || convId, // Store actual transaction ID on success
          updated_at: new Date().toISOString()
        })
        .eq("id", refund.id);

      if (isSuccess) {
        // Debit Wallet ONLY on success
        await supabaseAdmin.rpc("wallet_transact", {
          p_tenant_id: refund.tenant_id,
          p_customer_id: refund.customer_id,
          p_amount: refund.amount,
          p_direction: "debit",
          p_narration: `Refund Completed: ${refund.reason || 'N/A'}`,
          p_reference: refund.id,
          p_ref_type: "refund"
        });
        log.info({ refund_id: refund.id }, "Refund wallet debit completed");
      } else {
        log.warn({ refund_id: refund.id, resultDesc: Result.ResultDesc }, "Refund B2C failed");
      }
    } catch (err) {
      log.error({ err: err.message }, "Failed to process refund B2C result");
    }
  });
});

/**
 * B2C Timeout callback for Refunds
 * POST /api/refunds/timeout
 */
router.post("/timeout", async (req, res) => {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { Result } = body;
  const convId = Result?.ConversationID;

  log.warn({ convId }, "Refund B2C timeout received");
  res.json({ ResultCode: 0, ResultDesc: "Received" });

  setImmediate(async () => {
    try {
      await supabaseAdmin
        .from("refund_requests")
        .update({
          status: "failed",
          updated_at: new Date().toISOString()
        })
        .eq("mpesa_transaction_id", convId);
    } catch (err) {
      log.error({ err: err.message }, "Failed to process refund B2C timeout");
    }
  });
});

/**
 * Reject a refund
 * POST /api/refunds/reject/:id
 */
router.post("/reject/:id", checkTenantAccess, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const approver_id = req.user.id;

  try {
    await supabaseAdmin
      .from("refund_requests")
      .update({
        status: "rejected",
        approved_by: approver_id,
        approved_at: new Date().toISOString(),
        rejection_reason: reason
      })
      .eq("id", id);

    res.json({ success: true, message: "Refund rejected" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
