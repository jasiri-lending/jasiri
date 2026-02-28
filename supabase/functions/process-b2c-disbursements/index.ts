import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.json().catch(() => ({}));
    const { action, tenant_id } = body;
    const workerId = `edge-${crypto.randomUUID().slice(0, 12)}`;

    console.log(`[${workerId}] Action: ${action}, tenant: ${tenant_id || "all"}`);

    switch (action) {
      case "process-queue":
        return jsonResponse(await processQueue(supabaseAdmin, workerId, tenant_id));
      case "recover-stuck":
        return jsonResponse(await recoverStuck(supabaseAdmin));
      default:
        throw new Error(`Unknown action: "${action}". Valid: process-queue, recover-stuck`);
    }
  } catch (err) {
    console.error("Edge function error:", err.message);
    return jsonResponse({ error: err.message }, 500);
  }
});

// ─── B2C‑specific job types ───────────────────────────────────────
const B2C_JOB_TYPES = ["b2c_disbursement", "disbursement_sms"];

// ═══════════════════════════════════════════════════════════════════
// processQueue – claims and processes B2C jobs only
// ═══════════════════════════════════════════════════════════════════
async function processQueue(db: SupabaseClient, workerId: string, tenantId?: string) {
  console.log(`[${workerId}] Draining B2C queue...`);
  let processed = 0,
    failed = 0;

  while (true) {
    const { data: job, error: claimErr } = await db
      .rpc("claim_queue_job", { p_worker_id: workerId, p_job_types: B2C_JOB_TYPES });
    if (claimErr || !job?.id) break;

    if (tenantId && job.tenant_id !== tenantId) {
      await db.from("payment_queue").update({ status: "queued", claimed_at: null, claimed_by: null }).eq("id", job.id);
      continue;
    }

    const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
    const jobType = job.job_type;

    try {
      if (jobType === "b2c_disbursement") {
        await handleB2cResult(db, payload);
        await db.from("payment_queue").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
        processed++;
      } else if (jobType === "disbursement_sms") {
        await handleDisbursementSmsJob(db, job);
        await db.from("payment_queue").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
        processed++;
      }
    } catch (err) {
      await markJobFailed(db, job.id, job.attempts, job.max_attempts, err.message);
      failed++;
    }
  }

  console.log(`[${workerId}] B2C queue drained. processed=${processed} failed=${failed}`);
  return { workerId, processed, failed };
}

// ═══════════════════════════════════════════════════════════════════
// recoverStuck – resets stuck jobs
// ═══════════════════════════════════════════════════════════════════
async function recoverStuck(db: SupabaseClient) {
  const { data, error } = await db.rpc("recover_stuck_queue_jobs");
  if (error) throw new Error(`Recovery failed: ${error.message}`);
  console.log(`Recovered ${data} stuck jobs`);
  return { recovered: data ?? 0 };
}

// ═══════════════════════════════════════════════════════════════════
// B2C result handler – updates transaction and enqueues disbursement SMS
// ═══════════════════════════════════════════════════════════════════
async function handleB2cResult(db: SupabaseClient, payload: any) {
  const { Result } = payload;
  if (!Result) throw new Error("Invalid B2C result payload");

  const {
    ResultCode,
    ResultDesc,
    ConversationID,
    OriginatorConversationID,
    TransactionID,
    ReferenceData,
  } = Result;
  const isSuccess = ResultCode === 0;

  const items = ReferenceData?.ReferenceItem;
  const occasion = Array.isArray(items) ? items.find((i) => i.Key === "Occasion")?.Value : items?.Value;
  const loanId = occasion?.replace("loan-", "");

  const status = isSuccess ? "completed" : "failed";

  await db
    .from("mpesa_b2c_transactions")
    .update({
      status,
      result_code: String(ResultCode),
      result_desc: ResultDesc,
      transaction_id: TransactionID || null,
      raw_result: Result,
      completed_at: new Date().toISOString(),
    })
    .or(`conversation_id.eq.${ConversationID},originator_conversation_id.eq.${OriginatorConversationID}`);

  if (isSuccess && loanId) {
    await db
      .from("loan_disbursement_transactions")
      .update({ status: "success", transaction_id: TransactionID, processed_at: new Date().toISOString() })
      .eq("loan_id", loanId)
      .eq("status", "processing");

    await db
      .from("loans")
      .update({
        status: "disbursed",
        disbursed_at: new Date().toISOString(),
        mpesa_transaction_id: TransactionID,
      })
      .eq("id", loanId)
      .eq("status", "ready_for_disbursement");

    console.log(`Loan ${loanId} marked disbursed with TX ${TransactionID}`);

    // Enqueue disbursement SMS
    const { data: b2cTx } = await db
      .from("mpesa_b2c_transactions")
      .select("customer_id, amount, tenant_id")
      .or(`conversation_id.eq.${ConversationID},originator_conversation_id.eq.${OriginatorConversationID}`)
      .maybeSingle();

    if (b2cTx) {
      await enqueueJobDirect(db, b2cTx.tenant_id, "disbursement_sms", {
        loan_id: loanId,
        customer_id: b2cTx.customer_id,
        amount: b2cTx.amount,
        tenant_id: b2cTx.tenant_id,
        transaction_id: TransactionID,
      });
    } else {
      console.error(`Could not find B2C transaction for conversation ${ConversationID} to enqueue SMS`);
    }
  } else if (!isSuccess && loanId) {
    await db
      .from("loans")
      .update({ status: "ready_for_disbursement" })
      .eq("id", loanId)
      .in("status", ["disbursed", "processing"]);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Disbursement SMS handler – sends personalised SMS with loan details
// ═══════════════════════════════════════════════════════════════════
async function handleDisbursementSmsJob(db: SupabaseClient, job: any) {
  const { loan_id, customer_id, amount, tenant_id, transaction_id } = job.payload;
  const tenantId = tenant_id;

  console.log(`[DisbursementSMS] Processing SMS for loan ${loan_id}, customer ${customer_id}`);

  const { data: cust, error: custErr } = await db
    .from("customers")
    .select("Firstname, mobile")
    .eq("id", customer_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (custErr || !cust) throw new Error(`Customer not found: ${customer_id}`);
  const firstName = cust.Firstname || "Customer";
  const customerMobile = cust.mobile;
  if (!customerMobile) throw new Error("Customer mobile missing");

  const { data: tenantConfig, error: cfgErr } = await db
    .from("tenant_mpesa_config")
    .select("paybill_number, till_number, shortcode")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();
  if (cfgErr || !tenantConfig) throw new Error(`Tenant config missing for tenant ${tenantId}`);
  const paybill = tenantConfig.paybill_number || tenantConfig.till_number || tenantConfig.shortcode || "N/A";

  const { data: loan, error: loanErr } = await db
    .from("loans")
    .select("weekly_payment")
    .eq("id", loan_id)
    .maybeSingle();
  if (loanErr || !loan) throw new Error(`Loan not found: ${loan_id}`);
  const weeklyPayment = Number(loan.weekly_payment).toLocaleString();
  const amountFormatted = Number(amount).toLocaleString();

  const message = `Dear ${firstName}, we have disbursed KES ${amountFormatted} via M-PESA. Your weekly installment is KES ${weeklyPayment} due to paybill ${paybill}.`;

  const { data: smsConfig, error: smsErr } = await db
    .from("tenant_sms_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (smsErr || !smsConfig) throw new Error(`SMS config missing for tenant ${tenantId}`);

  const encodedMsg = encodeURIComponent(message.trim());
  const url = `${smsConfig.base_url}?apikey=${smsConfig.api_key}&partnerID=${smsConfig.partner_id}&message=${encodedMsg}&shortcode=${smsConfig.shortcode}&mobile=${customerMobile}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`SMS send failed (${response.status})`);
  }

  await db.from("sms_logs").insert({
    customer_id,
    recipient_phone: customerMobile,
    message,
    status: "sent",
    message_id: `sms-${Date.now()}`,
    tenant_id: tenantId,
    created_at: new Date().toISOString(),
  });

  console.log(`[DisbursementSMS] Successfully sent for loan ${loan_id}`);
}

// ═══════════════════════════════════════════════════════════════════
// Helper to enqueue a job directly
// ═══════════════════════════════════════════════════════════════════
async function enqueueJobDirect(db: SupabaseClient, tenantId: string, jobType: string, payload: any, priority = 5) {
  const { error } = await db.from("payment_queue").insert({
    tenant_id: tenantId,
    job_type: jobType,
    payload,
    priority,
    status: "queued",
    scheduled_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to enqueue job: ${error.message}`);
}

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════
function normalizePhone(phone: string): string[] {
  if (!phone) return [];
  const clean = String(phone).replace(/[\s\-\(\)\+]/g, "");
  const out = new Set<string>();
  if (clean.startsWith("254") && clean.length === 12) {
    out.add(clean);
    out.add("0" + clean.slice(3));
    out.add("+" + clean);
  } else if (clean.startsWith("0") && clean.length === 10) {
    out.add(clean);
    out.add("254" + clean.slice(1));
    out.add("+254" + clean.slice(1));
  } else {
    out.add(clean);
  }
  return [...out];
}

async function markJobFailed(
  db: SupabaseClient,
  jobId: string,
  attempts: number,
  maxAttempts: number,
  error: string
) {
  const isDead = attempts >= maxAttempts;
  await db.from("payment_queue").update({
    status: isDead ? "dead" : "queued",
    last_error: error,
    failed_at: new Date().toISOString(),
    claimed_at: null,
    claimed_by: null,
    scheduled_at: isDead ? null : new Date(Date.now() + 30_000).toISOString(),
  }).eq("id", jobId);
}