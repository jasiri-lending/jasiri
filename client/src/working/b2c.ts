// supabase/functions/process-b2c-disbursements/index.ts
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

const B2C_JOB_TYPES = ["b2c_disbursement", "disbursement_sms"];

async function processQueue(db: SupabaseClient, workerId: string, tenantId?: string) {
  console.log(`[${workerId}] Draining B2C queue...`);
  let processed = 0, failed = 0;

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

async function recoverStuck(db: SupabaseClient) {
  const { data, error } = await db.rpc("recover_stuck_queue_jobs");
  if (error) throw new Error(`Recovery failed: ${error.message}`);
  console.log(`Recovered ${data} stuck jobs`);
  return { recovered: data ?? 0 };
}

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

  // Update the disbursement transaction record
  await db
    .from("loan_disbursement_transactions")
    .update({
      status,
      result_code: ResultCode,
      result_desc: ResultDesc,
      transaction_id: TransactionID || null,
      raw_result: Result,
      completed_at: new Date().toISOString(),
    })
    .or(`conversation_id.eq.${ConversationID},originator_conversation_id.eq.${OriginatorConversationID}`);

  if (isSuccess && loanId) {
    // Update loan status
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

    // Fetch the transaction record to get customer_id and amount for SMS
    const { data: disbursementTx } = await db
      .from("loan_disbursement_transactions")
      .select("customer_id, amount, tenant_id")
      .or(`conversation_id.eq.${ConversationID},originator_conversation_id.eq.${OriginatorConversationID}`)
      .maybeSingle();

    if (disbursementTx) {
      let customerId = disbursementTx.customer_id;

      // If customer_id is missing, try to get it from the loans table
      if (!customerId) {
        console.log(`[B2C] customer_id missing in transaction, looking up from loans table for loan ${loanId}`);
        const { data: loan } = await db
          .from("loans")
          .select("customer_id")
          .eq("id", loanId)
          .maybeSingle();
        if (loan?.customer_id) {
          customerId = loan.customer_id;
          console.log(`[B2C] Found customer_id ${customerId} from loans table`);
        } else {
          console.error(`[B2C] Cannot enqueue SMS – customer_id missing for transaction with conversation ${ConversationID}`);
          return; // Skip SMS
        }
      }

      await enqueueJobDirect(db, disbursementTx.tenant_id, "disbursement_sms", {
        loan_id: loanId,
        customer_id: customerId,
        amount: disbursementTx.amount,
        tenant_id: disbursementTx.tenant_id,
        transaction_id: TransactionID,
      });
    } else {
      console.error(`Could not find disbursement transaction for conversation ${ConversationID} to enqueue SMS`);
    }
  } else if (!isSuccess && loanId) {
    // Optionally reset loan status for retry
    await db
      .from("loans")
      .update({ status: "ready_for_disbursement" })
      .eq("id", loanId)
      .in("status", ["disbursed", "processing"]);
  }
}

async function handleDisbursementSmsJob(db: SupabaseClient, job: any) {
  const { loan_id, customer_id, amount, tenant_id, transaction_id } = job.payload;
  const tenantId = tenant_id;

  console.log(`[DisbursementSMS] Processing SMS for loan ${loan_id}, customer ${customer_id}`);

  try {
    // Fetch customer details
    const { data: cust, error: custErr } = await db
      .from("customers")
      .select("Firstname, mobile")
      .eq("id", customer_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (custErr || !cust) {
      throw new Error(`Customer not found for id ${customer_id}`);
    }
    console.log(`[DisbursementSMS] Customer found:`, cust);

    const firstName = cust.Firstname || "Customer";
    const customerMobile = cust.mobile;
    if (!customerMobile) throw new Error("Customer mobile missing");

    // Fetch tenant M‑Pesa config (for paybill)
    const { data: tenantConfig, error: cfgErr } = await db
      .from("tenant_mpesa_config")
      .select("paybill_number, till_number, shortcode")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle();

    if (cfgErr || !tenantConfig) throw new Error(`Tenant config missing for tenant ${tenantId}`);
    console.log(`[DisbursementSMS] Tenant M‑Pesa config:`, tenantConfig);

    const paybill = tenantConfig.paybill_number || tenantConfig.till_number || tenantConfig.shortcode || "N/A";

    // Fetch loan's weekly payment
    const { data: loan, error: loanErr } = await db
      .from("loans")
      .select("weekly_payment")
      .eq("id", loan_id)
      .maybeSingle();

    if (loanErr || !loan) throw new Error(`Loan not found: ${loan_id}`);
    console.log(`[DisbursementSMS] Loan weekly payment: ${loan.weekly_payment}`);

    const weeklyPayment = Number(loan.weekly_payment).toLocaleString();
    const amountFormatted = Number(amount).toLocaleString();

    const message = `Dear ${firstName}, we have disbursed KES ${amountFormatted} via M-PESA. Your weekly installment is KES ${weeklyPayment} due to paybill ${paybill}.`;
    console.log(`[DisbursementSMS] Message: ${message}`);

    // Fetch tenant SMS config
    const { data: smsConfig, error: smsErr } = await db
      .from("tenant_sms_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (smsErr || !smsConfig) throw new Error(`SMS config missing for tenant ${tenantId}`);
    console.log(`[DisbursementSMS] SMS config:`, smsConfig);

    // Send SMS
    const encodedMsg = encodeURIComponent(message.trim());
    const url = `${smsConfig.base_url}?apikey=${smsConfig.api_key}&partnerID=${smsConfig.partner_id}&message=${encodedMsg}&shortcode=${smsConfig.shortcode}&mobile=${customerMobile}`;
    console.log(`[DisbursementSMS] Sending to URL: ${url}`);

    const response = await fetch(url);
    const responseText = await response.text();
    console.log(`[DisbursementSMS] SMS API response status: ${response.status}, body: ${responseText}`);

    if (!response.ok) {
      throw new Error(`SMS send failed (${response.status}): ${responseText}`);
    }

    // Log SMS in database
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
  } catch (error) {
    console.error(`[DisbursementSMS] Error:`, error);
    throw error; // rethrow to mark job failed
  }
}

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