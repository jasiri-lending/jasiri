import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken } from "../middleware/authMiddleware.js";
import { createLogger } from "../utils/logger.js";
import { getTenantConfig } from "../services/tenantResolver.js";
import { mpesaRequest } from "../services/mpesa.js";

const router = express.Router();
const log = createLogger({ service: "mpesa-transaction-status" });

// Apply authentication globally to this router (except for callbacks)
router.use((req, res, next) => {
  // Skip auth for Safaricom callbacks (result and timeout)
  if (req.path === "/result" || req.path === "/timeout") {
    return next();
  }
  return verifySupabaseToken(req, res, next);
});

// ── Initiate Transaction Status Query ───────────────────────────────────────
router.post("/query", async (req, res) => {
  const { tenant_id, transaction_id, type = "c2b", remarks = "Querying status" } = req.body;

  if (!tenant_id || !transaction_id) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields: tenant_id, transaction_id"
    });
  }

  try {
    const tenantConfig = await getTenantConfig(tenant_id, type);

    const payload = {
      Initiator: tenantConfig.initiator_name,
      SecurityCredential: tenantConfig.security_credential, // assuming already decrypted / handled by mpesaRequest if needed or we need to decrypt here
      CommandID: "TransactionStatusQuery",
      TransactionID: transaction_id,
      PartyA: tenantConfig.shortcode || tenantConfig.paybill_number || tenantConfig.till_number,
      IdentifierType: "4", // 4 for Organization shortcode
      ResultURL: `${tenantConfig.callback_url}${(tenantConfig.environment === "sandbox") ? "/api" : "/mpesa"}/transaction-status/result`,
      QueueTimeOutURL: `${tenantConfig.callback_url}${(tenantConfig.environment === "sandbox") ? "/api" : "/mpesa"}/transaction-status/timeout`,
      Remarks: remarks,
      Occasion: `status-${transaction_id}`,
    };

    // No decryption needed - credentials are plain text
    payload.SecurityCredential = tenantConfig.security_credential;

    const mpesaRes = await mpesaRequest(tenantConfig, "POST", "/mpesa/transactionstatus/v1/query", payload);
    const convId = mpesaRes?.ConversationID;
    const originatorId = mpesaRes?.OriginatorConversationID;

    log.info({ tenant_id, transaction_id, convId }, "Transaction status query initiated");
    res.json({
      success: true,
      data: { conversationId: convId, originatorId }
    });

  } catch (err) {
    log.error({ err: err.message, tenant_id, transaction_id }, "Transaction status query failed");
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Transaction Status Result callback ─────────────────────────────────────────
router.post("/result", async (req, res) => {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { Result } = body;
  
  if (!Result) return res.json({ ResultCode: 0, ResultDesc: "Received" });

  const convId = Result.ConversationID;
  const originatorId = Result.OriginatorConversationID;

  log.info({ resultCode: Result?.ResultCode, convId }, "Transaction status result received");
  
  // Always ACK Safaricom immediately
  res.json({ ResultCode: 0, ResultDesc: "Received" });

  // Currently we just log the transaction status result. 
  // Depending on requirements, we could update database tables (loans, db, etc.) here.
  log.info("TransactionStatus Result details payload: ", JSON.stringify(body, null, 2));
});

// ── Transaction Status Timeout callback ────────────────────────────────────────
router.post("/timeout", async (req, res) => {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { Result } = body;
  const convId = Result?.ConversationID;

  log.warn({ convId }, "Transaction status timeout received");
  res.json({ ResultCode: 0, ResultDesc: "Received" });

  log.warn("TransactionStatus Timeout details payload: ", JSON.stringify(body, null, 2));
});

export default router;
