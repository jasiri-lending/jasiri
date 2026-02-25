// supabase/functions/process-payments/index.ts
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
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
      Deno.env.get("SUPABASE_URL")         ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.json().catch(() => ({}));
    const { action, transaction_id, tenant_id, limit = 50 } = body;
    const workerId = `edge-${crypto.randomUUID().slice(0, 12)}`;

    console.log(`[${workerId}] Action: ${action}, tenant: ${tenant_id || "all"}`);

    switch (action) {
      case "process-pending":
        return jsonResponse(await processPending(supabaseAdmin, workerId, tenant_id, limit));
      case "process-single":
        if (!transaction_id) throw new Error("transaction_id is required");
        return jsonResponse(await processSingle(supabaseAdmin, workerId, transaction_id));
      case "process-queue":
        return jsonResponse(await processQueue(supabaseAdmin, workerId, tenant_id));
      case "recover-stuck":
        return jsonResponse(await recoverStuck(supabaseAdmin));
      default:
        throw new Error(`Unknown action: "${action}"`);
    }
  } catch (err) {
    console.error("Edge function error:", err.message);
    return jsonResponse({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// ACTION: process-pending
// Scans mpesa_c2b_transactions for pending rows and processes them.
// Optionally filtered by tenant_id.
// Each transaction is atomically claimed before processing —
// safe to call from multiple edge function instances simultaneously.
// ═══════════════════════════════════════════════════════════════════
async function processPending(
  db: SupabaseClient,
  workerId: string,
  tenantId?: string,
  limit = 50
) {
  console.log(`[${workerId}] Scanning pending transactions...`);

  let query = db
    .from("mpesa_c2b_transactions")
    .select("transaction_id, tenant_id, amount, billref, phone_number")
    .eq("status", "pending")
    .order("transaction_time", { ascending: true })
    .limit(limit);

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data: rows, error } = await query;
  if (error) throw new Error(`Failed to fetch pending transactions: ${error.message}`);

  console.log(`[${workerId}] Found ${rows?.length ?? 0} pending transactions`);

  const results = [];

  for (const row of rows ?? []) {
    const result = await processOneTransaction(db, workerId, row.transaction_id);
    results.push(result);
  }

  const succeeded = results.filter(r => r.status === "applied").length;
  const skipped   = results.filter(r => r.status === "skipped").length;
  const failed    = results.filter(r => r.status === "error").length;

  console.log(`[${workerId}] Done. applied=${succeeded} skipped=${skipped} failed=${failed}`);

  return { workerId, total: results.length, succeeded, skipped, failed, results };
}

// ═══════════════════════════════════════════════════════════════════
// ACTION: process-single
// Process exactly one transaction by its transaction_id.
// ═══════════════════════════════════════════════════════════════════
async function processSingle(db: SupabaseClient, workerId: string, transactionId: string) {
  console.log(`[${workerId}] Processing single: ${transactionId}`);
  const result = await processOneTransaction(db, workerId, transactionId);
  return { workerId, ...result };
}

// ═══════════════════════════════════════════════════════════════════
// ACTION: process-queue
// Drain the payment_queue table (enqueued by C2B webhook handler).
// Uses claim_queue_job() which uses SELECT FOR UPDATE SKIP LOCKED.
// Now also handles "send_sms" jobs.
// ═══════════════════════════════════════════════════════════════════
async function processQueue(db: SupabaseClient, workerId: string, tenantId?: string) {
  console.log(`[${workerId}] Draining payment queue...`);

  const jobTypes = ["c2b_repayment", "registration", "processing_fee", "b2c_disbursement", "send_sms"];
  let processed  = 0;
  let failed     = 0;

  while (true) {
    const { data: job, error: claimErr } = await db
      .rpc("claim_queue_job", { p_worker_id: workerId, p_job_types: jobTypes });

    if (claimErr || !job?.id) break;

    if (tenantId && job.tenant_id !== tenantId) {
      await db.from("payment_queue").update({ status: "queued", claimed_at: null, claimed_by: null }).eq("id", job.id);
      break;
    }

    const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
    const jobType = job.job_type;

    try {
      if (jobType === "b2c_disbursement") {
        await handleB2cResult(db, payload);
        await db.from("payment_queue").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
        processed++;
      } else if (jobType === "send_sms") {
        await handleSmsJob(db, job);
        await db.from("payment_queue").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
        processed++;
      } else {
        // C2B related (repayment, registration, processing_fee)
        const txId = payload?.transaction_id;
        if (!txId) {
          await markJobFailed(db, job.id, job.attempts, job.max_attempts, "Missing transaction_id in payload");
          failed++;
          continue;
        }
        const result = await processOneTransaction(db, workerId, txId);
        if (result.status === "error") {
          await markJobFailed(db, job.id, job.attempts, job.max_attempts, result.error ?? "Unknown error");
          failed++;
        } else {
          await db.from("payment_queue").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
          processed++;
        }
      }
    } catch (err) {
      await markJobFailed(db, job.id, job.attempts, job.max_attempts, err.message);
      failed++;
    }
  }

  console.log(`[${workerId}] Queue drained. processed=${processed} failed=${failed}`);
  return { workerId, processed, failed };
}

// ═══════════════════════════════════════════════════════════════════
// ACTION: recover-stuck
// Resets processing jobs that have been stuck > 5 minutes.
// Call from a cron job every minute.
// ═══════════════════════════════════════════════════════════════════
async function recoverStuck(db: SupabaseClient) {
  const { data, error } = await db.rpc("recover_stuck_queue_jobs");
  if (error) throw new Error(`Recovery failed: ${error.message}`);
  console.log(`Recovered ${data} stuck jobs`);
  return { recovered: data ?? 0 };
}

// ═══════════════════════════════════════════════════════════════════
// CORE: processOneTransaction
// Atomically claims ONE mpesa_c2b_transactions row, then routes
// to the correct handler based on payment intent (billref).
// Returns a result object — never throws to the caller.
// ═══════════════════════════════════════════════════════════════════
async function processOneTransaction(
  db: SupabaseClient,
  workerId: string,
  transactionId: string
): Promise<ProcessResult> {
  try {
    // ── Atomic claim (PL/pgSQL FOR UPDATE) ──────────────────────
    const { data: tx, error: claimErr } = await db
      .rpc("claim_c2b_transaction", {
        p_transaction_id: transactionId,
        p_worker_id:      workerId,
      });

    if (claimErr || !tx) {
      console.log(`[${workerId}] ${transactionId}: already claimed or not found — skipping`);
      return { transaction_id: transactionId, status: "skipped", reason: "already_claimed_or_not_found" };
    }

    const { phone_number, amount, billref, firstname, transaction_time, tenant_id } = tx;

    // ── Resolve tenant ───────────────────────────────────────────
    const tenantId = tenant_id ?? await resolveTenantFromPhone(db, phone_number);

    if (!tenantId) {
      await moveToSuspense(db, tx, "Could not resolve tenant");
      return { transaction_id: transactionId, status: "suspense", reason: "tenant_not_resolved" };
    }

    console.log(`[${workerId}] ${transactionId}: tenant=${tenantId} billref=${billref} amount=${amount}`);

    // ── Detect payment intent from billref ───────────────────────
    const intent = parseIntent(billref);
    console.log(`[${workerId}] Intent: ${intent.type}`);

    // ── Resolve customer ─────────────────────────────────────────
    const customer = await resolveCustomer(db, phone_number, intent);

    if (!customer) {
      await moveToSuspense(db, tx, "Customer not found in system");
      return { transaction_id: transactionId, status: "suspense", reason: "customer_not_found" };
    }

    // ── Route to correct handler ─────────────────────────────────
    let result: string;

    if (intent.type === "registration") {
      result = await handleRegistration(db, tx, customer, tenantId, intent);
    } else if (intent.type === "processing") {
      result = await handleProcessingFee(db, tx, customer, tenantId, intent);
    } else {
      result = await handleRepayment(db, tx, customer, tenantId, parseFloat(amount));
    }

    // ── Mark applied ─────────────────────────────────────────────
    await db
      .from("mpesa_c2b_transactions")
      .update({
        status:       "applied",
        description:  result,
        processed_at: new Date().toISOString(),
        customer_id:  customer.id,
      })
      .eq("transaction_id", transactionId);

    console.log(`[${workerId}] ${transactionId}: applied — ${result}`);
    return { transaction_id: transactionId, status: "applied", result };

  } catch (err) {
    console.error(`[${workerId}] ${transactionId}: ERROR — ${err.message}`);

    // Mark failed (don't re-throw — caller collects results)
    await db
      .from("mpesa_c2b_transactions")
      .update({ status: "failed", last_error: err.message })
      .eq("transaction_id", transactionId)
      .eq("status", "processing"); // Only update if WE own it

    return { transaction_id: transactionId, status: "error", error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: Registration Fee
// New customer  → deduct registration fee + processing fee
// Repeat customer → deduct processing fee only
// ═══════════════════════════════════════════════════════════════════
async function handleRegistration(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  intent: PaymentIntent
): Promise<string> {
  const { transaction_id, amount } = tx;
  const paidAmount = parseFloat(amount);

  console.log(`Registration fee: customer=${customer.id} new=${customer.is_new_customer}`);

  // Find pending loan for this customer
  const { data: loan } = await db
    .from("loans")
    .select("id, registration_fee, processing_fee, registration_fee_paid, processing_fee_paid")
    .eq("customer_id", customer.id)
    .eq("tenant_id", tenantId)
    .not("status", "in", '("rejected","disbursed")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!loan) {
    // No pending loan — credit wallet
    await walletCredit(db, tenantId, customer.id, paidAmount, "Registration fee — no pending loan", transaction_id, "registration");
    return "No pending loan — credited to wallet";
  }

  let remaining    = paidAmount;
  let feesDeducted = 0;

  const isNewCustomer   = customer.is_new_customer !== false;
  const registrationFee = parseFloat(loan.registration_fee ?? 0);
  const processingFee   = parseFloat(loan.processing_fee   ?? 0);

  // ── New customer: registration fee first ────────────────────────
  if (isNewCustomer && !loan.registration_fee_paid && registrationFee > 0) {
    if (remaining < registrationFee) {
      // Not enough — park in wallet
      await walletCredit(db, tenantId, customer.id, remaining, "Insufficient for registration fee", transaction_id, "registration");
      return `Insufficient for registration fee (KES ${registrationFee}) — parked in wallet`;
    }

    remaining    -= registrationFee;
    feesDeducted += registrationFee;

    // Record in loan_payments
    await insertLoanPayment(db, { loanId: loan.id, amount: registrationFee, type: "registration", description: "Registration Fee", receipt: transaction_id, tenantId, customerId: customer.id });

    await db.from("customers").update({ registration_fee_paid: true, is_new_customer: false }).eq("id", customer.id);
    await db.from("loans").update({ registration_fee_paid: true }).eq("id", loan.id);
  }

  // ── All customers: processing fee ───────────────────────────────
  if (!loan.processing_fee_paid && processingFee > 0 && remaining >= processingFee) {
    remaining    -= processingFee;
    feesDeducted += processingFee;

    await insertLoanPayment(db, { loanId: loan.id, amount: processingFee, type: "processing", description: "Loan Processing Fee", receipt: transaction_id, tenantId, customerId: customer.id });

    await db.from("loans").update({ processing_fee_paid: true }).eq("id", loan.id);
  }

  // ── Any remaining → wallet ───────────────────────────────────────
  if (remaining > 0.005) {
    await walletCredit(db, tenantId, customer.id, remaining, "Excess after fees", transaction_id, "registration");
  }

  return `Fees deducted KES ${feesDeducted}${remaining > 0.005 ? `, KES ${remaining.toFixed(2)} to wallet` : ""}`;
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: Processing Fee (standalone payment)
// ═══════════════════════════════════════════════════════════════════
async function handleProcessingFee(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  intent: PaymentIntent
): Promise<string> {
  const { transaction_id, amount } = tx;
  const loanId    = intent.loanId;
  const paidAmount = parseFloat(amount);

  if (!loanId) throw new Error("loanId missing from processing fee intent");

  const { data: loan } = await db
    .from("loans")
    .select("id, processing_fee, processing_fee_paid")
    .eq("id", loanId)
    .eq("tenant_id", tenantId)
    .single();

  if (!loan) throw new Error(`Loan ${loanId} not found`);
  if (loan.processing_fee_paid) return "Processing fee already paid";

  const fee = parseFloat(loan.processing_fee ?? 0);

  if (paidAmount < fee) {
    await walletCredit(db, tenantId, customer.id, paidAmount, "Insufficient for processing fee", transaction_id, "fee");
    return `Insufficient (paid KES ${paidAmount}, need KES ${fee}) — credited to wallet`;
  }

  await insertLoanPayment(db, { loanId, amount: fee, type: "processing", description: "Loan Processing Fee", receipt: transaction_id, tenantId, customerId: customer.id });

  await db.from("loans").update({ processing_fee_paid: true }).eq("id", loanId);

  const excess = paidAmount - fee;
  if (excess > 0.005) {
    await walletCredit(db, tenantId, customer.id, excess, "Excess processing fee payment", transaction_id, "fee");
  }

  return `Processing fee KES ${fee} deducted${excess > 0.005 ? `, KES ${excess.toFixed(2)} to wallet` : ""}`;
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: Loan Repayment
// Priority order: Penalty → Interest → Principal
// Wallet is drained first and combined with incoming amount.
// Overpayment is credited back to wallet.
// Each allocation creates a row in loan_payments.
// ═══════════════════════════════════════════════════════════════════
async function handleRepayment(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  mpesaAmount: number
): Promise<string> {
  const { transaction_id, phone_number } = tx;
  const customerId = customer.id;

  // ── Find active disbursed loan (tenant-scoped) ────────────────
  const { data: loan } = await db
    .from("loans")
    .select("id, repayment_state")
    .eq("customer_id", customerId)
    .eq("tenant_id",   tenantId)
    .eq("status",      "disbursed")
    .in("repayment_state", ["ongoing", "partial", "overdue"])
    .order("disbursed_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!loan) {
    // No active loan — credit everything to wallet
    await walletCredit(db, tenantId, customerId, mpesaAmount, "Payment with no active loan", transaction_id, "mpesa");
    return `No active loan — KES ${mpesaAmount} credited to wallet`;
  }

  const loanId = loan.id;

  // ── Drain wallet first (atomic DB function) ───────────────────
  const { data: drained, error: drainErr } = await db
    .rpc("drain_wallet_for_repayment", {
      p_tenant_id:   tenantId,
      p_customer_id: customerId,
      p_reference:   transaction_id,
    });

  const walletDrained = parseFloat(drained ?? 0);
  let remaining       = mpesaAmount + walletDrained;

  console.log(`Loan ${loanId}: mpesa=${mpesaAmount} wallet=${walletDrained} total=${remaining}`);

  // ── Fetch unpaid installments (ascending — never skip ahead) ─────
  const { data: installments, error: instErr } = await db
    .from("loan_installments")
    .select("*")
    .eq("loan_id", loanId)
    .in("status", ["pending", "partial", "overdue"])
    .order("installment_number", { ascending: true });

  if (instErr) throw new Error(`Failed to fetch installments: ${instErr.message}`);

  let totalApplied = 0;

  for (const inst of installments ?? []) {
    if (remaining <= 0) break;

    const applied = await allocateInstallment(db, {
      inst, loanId, tenantId, customerId,
      available: remaining,
      transactionId: transaction_id,
      phoneNumber:   phone_number,
    });

    remaining    -= applied;
    totalApplied += applied;
  }

  // ── Overpayment → wallet ────────────────────────────────────────
  if (remaining > 0.005) {
    await walletCredit(db, tenantId, customerId, remaining, `Overpayment on loan #${loanId}`, transaction_id, "overpayment");
  }

  return `Applied KES ${totalApplied.toFixed(2)} to loan #${loanId}${walletDrained > 0 ? ` (incl. KES ${walletDrained} from wallet)` : ""}${remaining > 0.005 ? `, KES ${remaining.toFixed(2)} overpayment to wallet` : ""}`;
}

// ═══════════════════════════════════════════════════════════════════
// ALLOCATOR: One installment — Penalty → Interest → Principal
// Inserts one loan_payments row per payment type bucket.
// Updates installment paid totals and status atomically.
// ═══════════════════════════════════════════════════════════════════
async function allocateInstallment(
  db: SupabaseClient,
  ctx: AllocationContext
): Promise<number> {
  const { inst, loanId, tenantId, customerId, available, transactionId, phoneNumber } = ctx;

  // Compute what's still owed
  const penaltyDue   = parseFloat(inst.net_penalty     ?? inst.penalty_amount ?? 0);
  const interestDue  = parseFloat(inst.interest_amount ?? 0);
  const principalDue = parseFloat(inst.principal_amount ?? 0);
  const interestPaid = parseFloat(inst.interest_paid   ?? 0);
  const principalPaid = parseFloat(inst.principal_paid ?? 0);

  // Get penalty already paid for this installment (from loan_payments)
  const { data: paidRows } = await db
    .from("loan_payments")
    .select("penalty_paid")
    .eq("installment_id", inst.id);
  const penaltyPaid = (paidRows ?? []).reduce((s, r) => s + parseFloat(r.penalty_paid ?? 0), 0);

  const unpaidPenalty   = Math.max(0, penaltyDue   - penaltyPaid);
  const unpaidInterest  = Math.max(0, interestDue  - interestPaid);
  const unpaidPrincipal = Math.max(0, principalDue - principalPaid);
  const totalUnpaid     = unpaidPenalty + unpaidInterest + unpaidPrincipal;

  if (totalUnpaid <= 0) return 0;

  type PaymentBucket = { type: string; amount: number; penaltyPaid: number; interestPaid: number; principalPaid: number };
  const buckets: PaymentBucket[] = [];
  let budget  = available;
  let applied = 0;

  // ── Priority 1: Penalties ──────────────────────────────────────
  if (budget > 0 && unpaidPenalty > 0) {
    const pay = Math.min(budget, unpaidPenalty);
    buckets.push({ type: "penalty", amount: pay, penaltyPaid: pay, interestPaid: 0, principalPaid: 0 });
    budget  -= pay;
    applied += pay;
  }

  // ── Priority 2: Interest ───────────────────────────────────────
  if (budget > 0 && unpaidInterest > 0) {
    const pay = Math.min(budget, unpaidInterest);
    buckets.push({ type: "interest", amount: pay, penaltyPaid: 0, interestPaid: pay, principalPaid: 0 });
    budget  -= pay;
    applied += pay;
  }

  // ── Priority 3: Principal ──────────────────────────────────────
  if (budget > 0 && unpaidPrincipal > 0) {
    const pay = Math.min(budget, unpaidPrincipal);
    buckets.push({ type: "principal", amount: pay, penaltyPaid: 0, interestPaid: 0, principalPaid: pay });
    budget  -= pay;
    applied += pay;
  }

  if (buckets.length === 0) return 0;

  // ── Insert loan_payments rows ──────────────────────────────────
  let balanceBefore = totalUnpaid;
  for (const b of buckets) {
    const balanceAfter = balanceBefore - b.amount;

    const { error: payErr } = await db.from("loan_payments").insert({
      loan_id:            loanId,
      installment_id:     inst.id,
      paid_amount:        b.amount,
      payment_type:       b.type,
      description:        `${capitalize(b.type)} Repayment`,
      mpesa_receipt:      transactionId,
      phone_number:       phoneNumber,
      payment_method:     "mpesa_c2b",
      tenant_id:          tenantId,
      payer_reference_id: customerId,
      payer_type:         "customer",
      penalty_paid:       b.penaltyPaid,
      interest_paid:      b.interestPaid,
      principal_paid:     b.principalPaid,
      balanceBefore:      balanceBefore,
      balance_after:      balanceAfter,
    });

    if (payErr) throw new Error(`loan_payments insert failed (${b.type}): ${payErr.message}`);
    balanceBefore = balanceAfter;
  }

  // ── Update installment totals ──────────────────────────────────
  const newInterestPaid  = interestPaid  + (buckets.find(b => b.type === "interest")?.amount  ?? 0);
  const newPrincipalPaid = principalPaid + (buckets.find(b => b.type === "principal")?.amount ?? 0);
  const newPenaltyPaid   = penaltyPaid   + (buckets.find(b => b.type === "penalty")?.amount   ?? 0);
  const newTotalPaid     = newInterestPaid + newPrincipalPaid + newPenaltyPaid;
  const totalDue         = interestDue + principalDue + penaltyDue;
  const newStatus        = newTotalPaid >= totalDue - 0.005 ? "paid"
                         : applied > 0                      ? "partial"
                                                            : inst.status;

  const { error: updateErr } = await db
    .from("loan_installments")
    .update({
      interest_paid:  newInterestPaid,
      principal_paid: newPrincipalPaid,
      paid_amount:    newTotalPaid,
      status:         newStatus,
    })
    .eq("id", inst.id);

  if (updateErr) throw new Error(`Installment update failed: ${updateErr.message}`);

  console.log(`  Installment #${inst.installment_number}: applied=${applied.toFixed(2)} status=${newStatus}`);
  return applied;
}

// ═══════════════════════════════════════════════════════════════════
// B2C result handler (unchanged)
// ═══════════════════════════════════════════════════════════════════
async function handleB2cResult(db: SupabaseClient, payload: any) {
  const { Result } = payload;
  if (!Result) throw new Error("Invalid B2C result payload");

  const {
    ResultCode, ResultDesc, ConversationID, OriginatorConversationID,
    TransactionID, ReferenceData
  } = Result;
  const isSuccess = ResultCode === 0;

  // Extract loan ID from Occasion field (format "loan-123")
  const items = ReferenceData?.ReferenceItem;
  const occasion = Array.isArray(items)
    ? items.find(i => i.Key === "Occasion")?.Value
    : items?.Value;
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
    .or(`conversation_id.eq.${ConversationID},originator_id.eq.${OriginatorConversationID}`);

  if (isSuccess && loanId) {
    await db
      .from("loan_disbursement_transactions")
      .update({ status: "success", transaction_id: TransactionID, processed_at: new Date().toISOString() })
      .eq("loan_id", loanId)
      .eq("status", "processing");

    await db
      .from("loans")
      .update({ status: "disbursed", disbursed_at: new Date().toISOString(), mpesa_transaction_id: TransactionID })
      .eq("id", loanId)
      .eq("status", "ready_for_disbursement");

    console.log(`Loan ${loanId} marked disbursed with TX ${TransactionID}`);
  } else if (!isSuccess && loanId) {
    await db
      .from("loans")
      .update({ status: "ready_for_disbursement" })
      .eq("id", loanId)
      .in("status", ["disbursed", "processing"]);
  }
}

// ═══════════════════════════════════════════════════════════════════
// UPDATED: Multitenant SMS handler using customer_id column
// ═══════════════════════════════════════════════════════════════════
async function handleSmsJob(db: SupabaseClient, job: any) {
  const { transaction_id } = job.payload;
  const tenantId = job.tenant_id;

  console.log(`[SMS] Processing SMS for transaction ${transaction_id}, tenant ${tenantId}`);

  // Fetch transaction with all needed fields
  const { data: tx, error: txErr } = await db
    .from("mpesa_c2b_transactions")
    .select(`
      id,
      amount,
      loan_id,
      customer_id,
      phone_number,
      payment_sms_sent,
      tenant_id
    `)
    .eq("transaction_id", transaction_id)
    .eq("tenant_id", tenantId)
    .single();

  if (txErr || !tx) {
    console.error(`[SMS] Transaction not found for ${transaction_id}`);
    throw new Error(`Transaction not found: ${transaction_id}`);
  }

  if (tx.payment_sms_sent) {
    console.log(`[SMS] SMS already sent for ${transaction_id}, skipping`);
    return;
  }

  // If no loan_id, no SMS should be sent (wallet payment)
  if (!tx.loan_id) {
    console.log(`[SMS] No loan associated – marking as sent without SMS`);
    await db
      .from("mpesa_c2b_transactions")
      .update({ payment_sms_sent: true })
      .eq("id", tx.id);
    return;
  }

  // Determine customer mobile – first try using customer_id
  let customerMobile: string | null = null;
  let customerId = tx.customer_id;

  if (customerId) {
    const { data: cust } = await db
      .from("customers")
      .select("mobile")
      .eq("id", customerId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (cust) customerMobile = cust.mobile;
  }

  // Fallback: try to find customer by phone number from transaction
  if (!customerMobile && tx.phone_number) {
    const phoneFormats = normalizePhone(tx.phone_number);
    if (phoneFormats.length) {
      const { data: custByPhone } = await db
        .from("customers")
        .select("id, mobile")
        .in("mobile", phoneFormats)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (custByPhone) {
        customerMobile = custByPhone.mobile;
        customerId = custByPhone.id;
      }
    }
  }

  if (!customerMobile) {
    console.error(`[SMS] No customer mobile found for transaction ${transaction_id}`);
    // Mark as sent to avoid infinite retries, but log failure
    await db
      .from("mpesa_c2b_transactions")
      .update({ payment_sms_sent: true })
      .eq("id", tx.id);
    throw new Error("Customer mobile not found");
  }

  // Calculate outstanding loan balance
  let outstandingBalance = 0;
  if (tx.loan_id) {
    const { data: loan } = await db
      .from("loans")
      .select("total_payable")
      .eq("id", tx.loan_id)
      .single();

    const { data: payments } = await db
      .from("loan_payments")
      .select("paid_amount")
      .eq("loan_id", tx.loan_id);

    const totalPaid = payments?.reduce((sum, p) => sum + Number(p.paid_amount), 0) || 0;
    outstandingBalance = Math.max(0, Number(loan?.total_payable || 0) - totalPaid);
  }

  // Compose SMS message
  const amount = Number(tx.amount).toLocaleString();
  const balance = outstandingBalance.toLocaleString();
  const message = `Dear Customer,\nWe have received your payment of KES ${amount}.\nYour outstanding loan balance is KES ${balance}.\nThank you for being our valued client.`;

  // Fetch tenant SMS settings
  const { data: smsConfig, error: cfgErr } = await db
    .from("tenant_sms_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (cfgErr || !smsConfig) {
    console.error(`[SMS] No SMS config for tenant ${tenantId}`);
    throw new Error(`SMS config missing for tenant ${tenantId}`);
  }

  // Send SMS using tenant's provider
  const encodedMsg = encodeURIComponent(message.trim());
  const url = `${smsConfig.base_url}?apikey=${smsConfig.api_key}&partnerID=${smsConfig.partner_id}&message=${encodedMsg}&shortcode=${smsConfig.shortcode}&mobile=${customerMobile}`;

  console.log(`[SMS] Sending to ${customerMobile} via ${smsConfig.base_url}`);
  const response = await fetch(url);
  if (!response.ok) {
    const errText = await response.text();
    console.error(`[SMS] Send failed: ${response.status} - ${errText}`);
    throw new Error(`SMS send failed (${response.status})`);
  }

  // Log SMS in sms_logs table
  await db.from("sms_logs").insert({
    customer_id: customerId,
    recipient_phone: customerMobile,
    message,
    status: "sent",
    message_id: `sms-${Date.now()}`,
    tenant_id: tenantId,
    created_at: new Date().toISOString()
  });

  // Mark SMS as sent and optionally attach customer_id if it was missing
  const updateData: any = { payment_sms_sent: true };
  if (customerId && !tx.customer_id) updateData.customer_id = customerId;
  await db.from("mpesa_c2b_transactions").update(updateData).eq("id", tx.id);

  console.log(`[SMS] Successfully sent for transaction ${transaction_id}`);
}

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════

// Atomic wallet credit via PL/pgSQL function
async function walletCredit(
  db: SupabaseClient,
  tenantId: string,
  customerId: string,
  amount: number,
  narration: string,
  reference: string,
  refType: string
) {
  const { error } = await db.rpc("wallet_transact", {
    p_tenant_id:   tenantId,
    p_customer_id: customerId,
    p_amount:      amount,
    p_direction:   "credit",
    p_narration:   narration,
    p_reference:   reference,
    p_ref_type:    refType,
  });
  if (error) throw new Error(`Wallet credit failed: ${error.message}`);
}

// Insert a loan_payments row
async function insertLoanPayment(db: SupabaseClient, opts: {
  loanId: string | number;
  amount: number;
  type: string;
  description: string;
  receipt: string;
  tenantId: string;
  customerId: string;
}) {
  const { error } = await db.from("loan_payments").insert({
    loan_id:            opts.loanId,
    paid_amount:        opts.amount,
    payment_type:       opts.type,
    description:        opts.description,
    mpesa_receipt:      opts.receipt,
    payment_method:     "mpesa_c2b",
    tenant_id:          opts.tenantId,
    payer_reference_id: opts.customerId,
    payer_type:         "customer",
    penalty_paid:       0,
    interest_paid:      opts.type === "interest"  ? opts.amount : 0,
    principal_paid:     opts.type === "principal" ? opts.amount : 0,
  });
  if (error) throw new Error(`loan_payments insert failed: ${error.message}`);
}

// Move a transaction to suspense (customer unknown or unresolvable)
async function moveToSuspense(db: SupabaseClient, tx: Transaction, reason: string) {
  console.log(`Moving ${tx.transaction_id} to suspense: ${reason}`);

  await db.from("suspense_transactions").upsert({
    tenant_id:        tx.tenant_id ?? null,
    payer_name:       tx.firstname?.trim() ?? "Unknown",
    phone_number:     tx.phone_number,
    amount:           tx.amount,
    transaction_id:   tx.transaction_id,
    transaction_time: tx.transaction_time ?? new Date().toISOString(),
    billref:          tx.billref,
    status:           "suspense",
    reason,
  }, { onConflict: "transaction_id" });

  await db
    .from("mpesa_c2b_transactions")
    .update({ status: "suspense" })
    .eq("transaction_id", tx.transaction_id);
}

// Detect payment intent from billref
function parseIntent(billref: string | null): PaymentIntent {
  if (!billref) return { type: "repayment" };
  const ref = billref.trim().toLowerCase();
  if (ref === "registration_fee")       return { type: "registration" };
  if (ref.startsWith("registration-"))  return { type: "registration", customerId: ref.split("-")[1] };
  if (ref.startsWith("processing-"))    return { type: "processing",   loanId:     ref.split("-").slice(1).join("-") };
  return { type: "repayment", accountRef: billref.trim() };
}

// Resolve tenant from phone number (fallback when tenant_id not on transaction)
async function resolveTenantFromPhone(db: SupabaseClient, phone: string | null): Promise<string | null> {
  if (!phone) return null;
  const formats = normalizePhone(phone);
  const { data } = await db.from("customers").select("tenant_id").in("mobile", formats).limit(1).maybeSingle();
  return data?.tenant_id ?? null;
}

// Resolve customer by billref (ID number) or phone (all formats)
async function resolveCustomer(db: SupabaseClient, phone: string, intent: PaymentIntent): Promise<Customer | null> {
  // 1. By national ID number (most reliable for repayments)
  if (intent.type === "repayment" && intent.accountRef) {
    const { data } = await db
      .from("customers")
      .select("id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer")
      .eq("id_number", intent.accountRef)
      .maybeSingle();
    if (data) return data as Customer;
  }

  // 2. By explicit customer ID embedded in billref
  if (intent.customerId) {
    const { data } = await db
      .from("customers")
      .select("id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer")
      .eq("id", intent.customerId)
      .maybeSingle();
    if (data) return data as Customer;
  }

  // 3. By phone — try all Kenyan format variants
  const formats = normalizePhone(phone);
  if (formats.length) {
    const { data } = await db
      .from("customers")
      .select("id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer")
      .in("mobile", formats)
      .maybeSingle();
    if (data) return data as Customer;
  }

  return null;
}

// Generate all phone format variants for matching
function normalizePhone(phone: string): string[] {
  if (!phone) return [];
  const clean = String(phone).replace(/[\s\-\(\)\+]/g, "");
  const out   = new Set<string>();
  if (clean.startsWith("254") && clean.length === 12) {
    out.add(clean);                      // 254711000000
    out.add("0" + clean.slice(3));       // 0711000000
    out.add("+" + clean);               // +254711000000
  } else if (clean.startsWith("0") && clean.length === 10) {
    out.add(clean);                      // 0711000000
    out.add("254" + clean.slice(1));     // 254711000000
    out.add("+254" + clean.slice(1));    // +254711000000
  } else {
    out.add(clean);
  }
  return [...out];
}

// Mark a queue job as failed or dead
async function markJobFailed(db: SupabaseClient, jobId: string, attempts: number, maxAttempts: number, error: string) {
  const isDead = attempts >= maxAttempts;
  await db.from("payment_queue").update({
    status:       isDead ? "dead" : "queued",
    last_error:   error,
    failed_at:    new Date().toISOString(),
    claimed_at:   null,
    claimed_by:   null,
    scheduled_at: isDead ? null : new Date(Date.now() + 30_000).toISOString(),
  }).eq("id", jobId);
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ═══════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════
interface Transaction {
  transaction_id:   string;
  phone_number:     string;
  amount:           string | number;
  billref:          string | null;
  firstname:        string | null;
  transaction_time: string | null;
  tenant_id:        string | null;
  retry_count?:     number;
}

interface Customer {
  id:               string;
  Firstname:        string;
  Surname:          string;
  mobile:           string;
  id_number:        string | null;
  tenant_id:        string;
  is_new_customer:  boolean | null;
}

interface PaymentIntent {
  type:        "repayment" | "registration" | "processing";
  accountRef?: string;
  customerId?: string;
  loanId?:     string;
}

interface AllocationContext {
  inst:          Record<string, unknown>;
  loanId:        number | string;
  tenantId:      string;
  customerId:    string;
  available:     number;
  transactionId: string;
  phoneNumber:   string;
}

interface ProcessResult {
  transaction_id: string;
  status:         "applied" | "skipped" | "suspense" | "error";
  result?:        string;
  reason?:        string;
  error?:         string;
}