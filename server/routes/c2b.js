import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { resolveTransaction } from "../services/tenantResolver.js";
import { createLogger } from "../utils/logger.js";

const c2b = express.Router();
const log = createLogger({ service: "c2b" });

/**
 * Connectivity test endpoint
 */
c2b.get("/test", (req, res) => {
  res.json({ success: true, message: "C2B callback route is reachable", timestamp: new Date().toISOString() });
});

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
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
}

// C2B Validation and Confirmation are public callbacks from Safaricom
// Do NOT apply verifySupabaseToken here

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

  // Respond to Safaricom immediately — never make Safaricom wait
  res.json({ ResultCode: 0, ResultDesc: "Received" });

  setImmediate(async () => {
    try {
      // Idempotency check — skip if already inserted and not pending
      const { data: existing } = await supabaseAdmin
        .from("mpesa_c2b_transactions")
        .select("id, status")
        .eq("transaction_id", TransID)
        .maybeSingle();

      if (existing && existing.status !== "pending") {
        log.info({ TransID, status: existing.status }, "Duplicate — already processed, skipping");
        return;
      }

      // Resolve tenant from BusinessShortCode (or phone fallback)
      const tenantConfig = await resolveTransaction(BusinessShortCode, MSISDN);

      if (!tenantConfig) {
        log.warn({ TransID, BusinessShortCode, MSISDN }, "Tenant not resolved — saving to suspense");
        const { error: suspenseErr } = await supabaseAdmin.from("suspense_transactions").upsert({
          payer_name: FirstName || "Unknown",
          phone_number: MSISDN,
          amount: TransAmount,
          transaction_id: TransID,
          transaction_time: parseMpesaTimestamp(TransTime),
          billref: BillRefNumber,
          status: "suspense",
          reason: "Tenant not resolved from shortcode or phone",
        }, { onConflict: "transaction_id" });

        if (suspenseErr) {
          log.error({ suspenseErr, TransID }, "CRITICAL: Failed to save suspense transaction");
        }
        return;
      }

      const tenantId = tenantConfig.tenant_id;

      // Insert with status=pending — the DB trigger 'trg_payment_processing'
      // fires automatically after INSERT and invokes the Edge Function to
      // handle all downstream processing (repayment, fees, wallet, SMS, etc.)
      const { error: upsertErr } = await supabaseAdmin.from("mpesa_c2b_transactions").upsert({
        transaction_id: TransID,
        phone_number: MSISDN,
        amount: TransAmount,
        transaction_time: parseMpesaTimestamp(TransTime),
        status: "pending",
        raw_payload: body,
        billref: BillRefNumber,
        firstname: FirstName,
        business_shortcode: BusinessShortCode,
        transaction_type: TransactionType,
        tenant_id: tenantId,
      }, { onConflict: "transaction_id", ignoreDuplicates: true });

      if (upsertErr) {
        log.error({ upsertErr, TransID, tenantId }, "CRITICAL: Failed to insert C2B transaction into database");
        return;
      }

      log.info({ TransID, tenantId }, "C2B transaction inserted as pending — Edge Function trigger will process it");

    } catch (err) {
      log.error({ err: err.message, stack: err.stack, TransID }, "C2B confirmation handler error");
    }
  });
});

export default c2b;
