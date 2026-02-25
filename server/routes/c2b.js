// backend/routes/c2b.js
import express from "express";
import { supabaseAdmin }      from "../supabaseClient.js";
import { resolveTransaction } from "../services/tenantResolver.js";
import { enqueueJob }         from "../queue/paymentQueue.js";
import { JOB_TYPES }          from "../config/env.js";
import { createLogger }       from "../utils/logger.js";

const c2b = express.Router();
const log = createLogger({ service: "c2b" });

/**
 * Convert Safaricom timestamp (YYYYMMDDHHmmss) to ISO 8601 string
 * @param {string} timestamp - e.g., "20250101120000"
 * @returns {string} ISO date string (UTC)
 */
function parseMpesaTimestamp(timestamp) {
  if (!timestamp || timestamp.length !== 14) return new Date().toISOString();
  const year = timestamp.slice(0, 4);
  const month = timestamp.slice(4, 6);
  const day = timestamp.slice(6, 8);
  const hour = timestamp.slice(8, 10);
  const minute = timestamp.slice(10, 12);
  const second = timestamp.slice(12, 14);
  // Month is 0-indexed in Date.UTC, so subtract 1
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
}

c2b.post("/validation", (req, res) => {
  log.info("C2B validation received");
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

c2b.post("/confirmation", async (req, res) => {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const {
    TransID, TransAmount, MSISDN, BillRefNumber,
    FirstName, BusinessShortCode, TransactionType, TransTime,
  } = body;

  log.info({ TransID, MSISDN, TransAmount, BillRefNumber }, "C2B confirmation received");

  // Respond to Safaricom immediately
  res.json({ ResultCode: 0, ResultDesc: "Received" });

  setImmediate(async () => {
    try {
      // Idempotency check
      const { data: existing } = await supabaseAdmin
        .from("mpesa_c2b_transactions")
        .select("id, status")
        .eq("transaction_id", TransID)
        .maybeSingle();

      if (existing && existing.status !== "pending") {
        log.info({ TransID, status: existing.status }, "Duplicate — skipping");
        return;
      }

      // Resolve tenant from BusinessShortCode (or phone fallback)
      const tenantConfig = await resolveTransaction(BusinessShortCode, MSISDN);

      if (!tenantConfig) {
        log.warn({ TransID, BusinessShortCode, MSISDN }, "Tenant not resolved — suspense");
        await supabaseAdmin.from("suspense_transactions").upsert({
          payer_name:       FirstName || "Unknown",
          phone_number:     MSISDN,
          amount:           TransAmount,
          transaction_id:   TransID,
          transaction_time: parseMpesaTimestamp(TransTime),
          billref:          BillRefNumber,
          status:           "suspense",
          reason:           "Tenant not resolved from shortcode or phone",
        }, { onConflict: "transaction_id" });
        return;
      }

      const tenantId = tenantConfig.tenant_id;

      // Determine job type from billref
      const ref = (BillRefNumber || "").toLowerCase();
      let jobType  = JOB_TYPES.C2B_REPAYMENT;
      let priority = 5;
      if (ref.startsWith("registration")) { jobType = JOB_TYPES.REGISTRATION;   priority = 2; }
      else if (ref.startsWith("processing")) { jobType = JOB_TYPES.PROCESSING_FEE; priority = 3; }

      // Insert transaction record (idempotent)
      await supabaseAdmin.from("mpesa_c2b_transactions").upsert({
        transaction_id:     TransID,
        phone_number:       MSISDN,
        amount:             TransAmount,
        transaction_time:   parseMpesaTimestamp(TransTime),
        status:             "pending",
        raw_payload:        body,
        billref:            BillRefNumber,
        firstname:          FirstName,
        business_shortcode: BusinessShortCode,
        transaction_type:   TransactionType,
        tenant_id:          tenantId,
      }, { onConflict: "transaction_id", ignoreDuplicates: true });

      // Enqueue for processing
      await enqueueJob({ tenantId, jobType, payload: { transaction_id: TransID }, priority });
      log.info({ TransID, tenantId, jobType }, "Transaction queued");

    } catch (err) {
      log.error({ err: err.message, TransID }, "Failed to queue C2B transaction");
    }
  });
});

export default c2b;