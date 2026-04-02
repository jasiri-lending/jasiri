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

// ─── C2B‑specific job types ─────────────────────────────────────────
const C2B_JOB_TYPES = ["c2b_repayment", "registration", "processing_fee", "send_sms", "auto_repay"];

// ═══════════════════════════════════════════════════════════════════
// processPending – scans pending C2B transactions and processes them
// ═══════════════════════════════════════════════════════════════════
async function processPending(
  db: SupabaseClient,
  workerId: string,
  tenantId?: string,
  limit = 50
) {
  console.log(`[${workerId}] Scanning pending C2B transactions...`);
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

  const succeeded = results.filter((r) => r.status === "applied").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "error").length;

  console.log(`[${workerId}] Done. applied=${succeeded} skipped=${skipped} failed=${failed}`);
  return { workerId, total: results.length, succeeded, skipped, failed, results };
}

// ═══════════════════════════════════════════════════════════════════
// processSingle – processes one specific transaction
// ═══════════════════════════════════════════════════════════════════
async function processSingle(db: SupabaseClient, workerId: string, transactionId: string) {
  console.log(`[${workerId}] Processing single: ${transactionId}`);
  const result = await processOneTransaction(db, workerId, transactionId);
  return { workerId, ...result };
}

// ═══════════════════════════════════════════════════════════════════
// processQueue – drains the payment queue for C2B jobs only
// ═══════════════════════════════════════════════════════════════════
async function processQueue(db: SupabaseClient, workerId: string, tenantId?: string) {
  console.log(`[${workerId}] Draining C2B payment queue...`);
  let processed = 0,
    failed = 0;

  while (true) {
    const { data: job, error: claimErr } = await db
      .rpc("claim_queue_job", { p_worker_id: workerId, p_job_types: C2B_JOB_TYPES });
    if (claimErr || !job?.id) break;

    if (tenantId && job.tenant_id !== tenantId) {
      await db.from("payment_queue").update({ status: "queued", claimed_at: null, claimed_by: null }).eq("id", job.id);
      continue;
    }

    const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
    const jobType = job.job_type;

    try {
      if (jobType === "send_sms") {
        await handleSmsJob(db, job);
        await db.from("payment_queue").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
        processed++;
      } else if (jobType === "auto_repay") {
        await handleAutoRepay(db, job);
        await db.from("payment_queue").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
        processed++;
      } else {
        // C2B repayment, registration, processing_fee
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

  console.log(`[${workerId}] C2B queue drained. processed=${processed} failed=${failed}`);
  return { workerId, processed, failed };
}

// ═══════════════════════════════════════════════════════════════════
// recoverStuck – resets jobs stuck in processing
// ═══════════════════════════════════════════════════════════════════
async function recoverStuck(db: SupabaseClient) {
  const { data, error } = await db.rpc("recover_stuck_queue_jobs");
  if (error) throw new Error(`Recovery failed: ${error.message}`);
  console.log(`Recovered ${data} stuck jobs`);
  return { recovered: data ?? 0 };
}

// ═══════════════════════════════════════════════════════════════════
// CORE: processOneTransaction – atomic claim + C2B processing
// ═══════════════════════════════════════════════════════════════════
async function processOneTransaction(
  db: SupabaseClient,
  workerId: string,
  transactionId: string
): Promise<ProcessResult> {
  try {
    const { data: tx, error: claimErr } = await db
      .rpc("claim_c2b_transaction", {
        p_transaction_id: transactionId,
        p_worker_id: workerId,
      });

    if (claimErr || !tx) {
      console.log(`[${workerId}] ${transactionId}: already claimed or not found — skipping`);
      return { transaction_id: transactionId, status: "skipped", reason: "already_claimed_or_not_found" };
    }

    const { phone_number, amount, billref, firstname, transaction_time, tenant_id } = tx;

    const tenantId = tenant_id ?? (await resolveTenantFromPhone(db, phone_number));
    if (!tenantId) {
      await moveToSuspense(db, tx, "Could not resolve tenant");
      return { transaction_id: transactionId, status: "suspense", reason: "tenant_not_resolved" };
    }

    console.log(`[${workerId}] ${transactionId}: tenant=${tenantId} billref=${billref} amount=${amount}`);

    const intent = parseIntent(billref);
    console.log(`[${workerId}] Intent: ${intent.type}`);

    const customer = await resolveCustomer(db, phone_number, intent);
    if (!customer) {
      await moveToSuspense(db, tx, "Customer not found in system");
      return { transaction_id: transactionId, status: "suspense", reason: "customer_not_found" };
    }

    let result: string;
    let loanId: string | number | null = null;

    if (intent.type === "registration") {
      const handlerResult = await handleRegistration(db, tx, customer, tenantId, intent);
      result = handlerResult.result;
      loanId = handlerResult.loanId;
    } else if (intent.type === "processing") {
      const handlerResult = await handleProcessingFee(db, tx, customer, tenantId, intent);
      result = handlerResult.result;
      loanId = handlerResult.loanId;
    } else {
      const handlerResult = await handleRepayment(db, tx, customer, tenantId, parseFloat(amount));
      result = handlerResult.result;
      loanId = handlerResult.loanId;
    }

    const updateData: any = {
      status: "applied",
      description: result,
      customer_id: customer.id,
    };
    if (loanId) {
      updateData.loan_id = loanId;
      console.log(`[${workerId}] Setting loan_id=${loanId} for transaction ${transactionId}`);
    }

    const { error: updateError } = await db
      .from("mpesa_c2b_transactions")
      .update(updateData)
      .eq("transaction_id", transactionId);

    if (updateError) {
      throw new Error(`Failed to update transaction status: ${updateError.message}`);
    }

    console.log(`[${workerId}] ${transactionId}: applied — ${result}`);
    return { transaction_id: transactionId, status: "applied", result };
  } catch (err) {
    console.error(`[${workerId}] ${transactionId}: ERROR — ${err.message}`);
    await db
      .from("mpesa_c2b_transactions")
      .update({ status: "failed", last_error: err.message })
      .eq("transaction_id", transactionId)
      .eq("status", "processing");
    return { transaction_id: transactionId, status: "error", error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: Registration Fee
// ═══════════════════════════════════════════════════════════════════
async function handleRegistration(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  intent: PaymentIntent
): Promise<{ result: string; loanId?: string | number }> {
  const { transaction_id, amount } = tx;
  const paidAmount = parseFloat(amount);

  console.log(`Registration fee: customer=${customer.id} new=${customer.is_new_customer}`);

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
    await walletCredit(db, tenantId, customer.id, paidAmount, "Registration fee — no pending loan", transaction_id, "registration");
    return { result: "No pending loan — credited to wallet" };
  }

  let remaining = paidAmount;
  let feesDeducted = 0;

  const isNewCustomer = customer.is_new_customer !== false;
  const registrationFee = parseFloat(loan.registration_fee ?? 0);
  const processingFee = parseFloat(loan.processing_fee ?? 0);

  if (isNewCustomer && !loan.registration_fee_paid && registrationFee > 0) {
    if (remaining < registrationFee) {
      await walletCredit(db, tenantId, customer.id, remaining, "Insufficient for registration fee", transaction_id, "registration");
      return { result: `Insufficient for registration fee (KES ${registrationFee}) — parked in wallet` };
    }
    remaining -= registrationFee;
    feesDeducted += registrationFee;
    await insertLoanPayment(db, {
      loanId: loan.id,
      amount: registrationFee,
      type: "registration",
      description: "Registration Fee",
      receipt: transaction_id,
      tenantId,
      customerId: customer.id,
    });
    await db.from("customers").update({ registration_fee_paid: true, is_new_customer: false }).eq("id", customer.id);
    await db.from("loans").update({ registration_fee_paid: true }).eq("id", loan.id);
  }

  if (!loan.processing_fee_paid && processingFee > 0 && remaining >= processingFee) {
    remaining -= processingFee;
    feesDeducted += processingFee;
    await insertLoanPayment(db, {
      loanId: loan.id,
      amount: processingFee,
      type: "processing",
      description: "Loan Processing Fee",
      receipt: transaction_id,
      tenantId,
      customerId: customer.id,
    });
    await db.from("loans").update({ processing_fee_paid: true }).eq("id", loan.id);
  }

  if (remaining > 0.005) {
    await walletCredit(db, tenantId, customer.id, remaining, "Excess after fees", transaction_id, "registration");
  }

  const result = `Fees deducted KES ${feesDeducted}${remaining > 0.005 ? `, KES ${remaining.toFixed(2)} to wallet` : ""}`;
  return { result, loanId: loan.id };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: Processing Fee (standalone)
// ═══════════════════════════════════════════════════════════════════
async function handleProcessingFee(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  intent: PaymentIntent
): Promise<{ result: string; loanId: string | number }> {
  const { transaction_id, amount } = tx;
  const loanId = intent.loanId!;
  const paidAmount = parseFloat(amount);

  const { data: loan } = await db
    .from("loans")
    .select("id, processing_fee, processing_fee_paid")
    .eq("id", loanId)
    .eq("tenant_id", tenantId)
    .single();

  if (!loan) throw new Error(`Loan ${loanId} not found`);
  if (loan.processing_fee_paid) return { result: "Processing fee already paid", loanId };

  const fee = parseFloat(loan.processing_fee ?? 0);

  if (paidAmount < fee) {
    await walletCredit(db, tenantId, customer.id, paidAmount, "Insufficient for processing fee", transaction_id, "fee");
    return { result: `Insufficient (paid KES ${paidAmount}, need KES ${fee}) — credited to wallet`, loanId };
  }

  await insertLoanPayment(db, {
    loanId,
    amount: fee,
    type: "processing",
    description: "Loan Processing Fee",
    receipt: transaction_id,
    tenantId,
    customerId: customer.id,
  });
  await db.from("loans").update({ processing_fee_paid: true }).eq("id", loanId);

  const excess = paidAmount - fee;
  if (excess > 0.005) {
    await walletCredit(db, tenantId, customer.id, excess, "Excess processing fee payment", transaction_id, "fee");
  }

  const result = `Processing fee KES ${fee} deducted${excess > 0.005 ? `, KES ${excess.toFixed(2)} to wallet` : ""}`;
  return { result, loanId };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: Loan Repayment – drains wallet, applies to loan
// ═══════════════════════════════════════════════════════════════════
async function handleRepayment(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  mpesaAmount: number
): Promise<{ result: string; loanId: string | number | null }> {
  const { transaction_id, phone_number } = tx;
  const customerId = customer.id;

  const { data: loan } = await db
    .from("loans")
    .select("id, repayment_state")
    .eq("customer_id", customerId)
    .eq("tenant_id", tenantId)
    .eq("status", "disbursed")
    .in("repayment_state", ["ongoing", "partial", "overdue"])
    .order("disbursed_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!loan) {
    await walletCredit(db, tenantId, customerId, mpesaAmount, "Payment with no active loan", transaction_id, "mpesa");
    return { result: `No active loan — KES ${mpesaAmount} credited to wallet`, loanId: null };
  }

  const loanId = loan.id;

  const { data: drained, error: drainErr } = await db
    .rpc("drain_wallet_for_repayment", {
      p_tenant_id: tenantId,
      p_customer_id: customerId,
      p_reference: transaction_id,
    });

  const walletDrained = parseFloat(drained ?? 0);
  let remaining = mpesaAmount + walletDrained;

  console.log(`Loan ${loanId}: mpesa=${mpesaAmount} wallet=${walletDrained} total=${remaining}`);

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
      inst,
      loanId,
      tenantId,
      customerId,
      available: remaining,
      transactionId: transaction_id,
      phoneNumber: phone_number,
    });
    remaining -= applied;
    totalApplied += applied;
  }

  if (remaining > 0.005) {
    await walletCredit(db, tenantId, customerId, remaining, `Overpayment on loan #${loanId}`, transaction_id, "overpayment");
  }

  const result = `Applied KES ${totalApplied.toFixed(2)} to loan #${loanId}${
    walletDrained > 0 ? ` (incl. KES ${walletDrained} from wallet)` : ""
  }${remaining > 0.005 ? `, KES ${remaining.toFixed(2)} overpayment to wallet` : ""}`;
  return { result, loanId };
}

// ═══════════════════════════════════════════════════════════════════
// ALLOCATOR: One installment – Penalty → Interest → Principal
// ═══════════════════════════════════════════════════════════════════
async function allocateInstallment(db: SupabaseClient, ctx: AllocationContext): Promise<number> {
  const { inst, loanId, tenantId, customerId, available, transactionId, phoneNumber } = ctx;

  const penaltyDue = parseFloat(inst.net_penalty ?? inst.penalty_amount ?? 0);
  const interestDue = parseFloat(inst.interest_amount ?? 0);
  const principalDue = parseFloat(inst.principal_amount ?? 0);
  const interestPaid = parseFloat(inst.interest_paid ?? 0);
  const principalPaid = parseFloat(inst.principal_paid ?? 0);

  const { data: paidRows } = await db
    .from("loan_payments")
    .select("penalty_paid")
    .eq("installment_id", inst.id);
  const penaltyPaid = (paidRows ?? []).reduce((s, r) => s + parseFloat(r.penalty_paid ?? 0), 0);

  const unpaidPenalty = Math.max(0, penaltyDue - penaltyPaid);
  const unpaidInterest = Math.max(0, interestDue - interestPaid);
  const unpaidPrincipal = Math.max(0, principalDue - principalPaid);
  const totalUnpaid = unpaidPenalty + unpaidInterest + unpaidPrincipal;

  if (totalUnpaid <= 0) return 0;

  type PaymentBucket = {
    type: string;
    amount: number;
    penaltyPaid: number;
    interestPaid: number;
    principalPaid: number;
  };
  const buckets: PaymentBucket[] = [];
  let budget = available;
  let applied = 0;

  if (budget > 0 && unpaidPenalty > 0) {
    const pay = Math.min(budget, unpaidPenalty);
    buckets.push({ type: "penalty", amount: pay, penaltyPaid: pay, interestPaid: 0, principalPaid: 0 });
    budget -= pay;
    applied += pay;
  }
  if (budget > 0 && unpaidInterest > 0) {
    const pay = Math.min(budget, unpaidInterest);
    buckets.push({ type: "interest", amount: pay, penaltyPaid: 0, interestPaid: pay, principalPaid: 0 });
    budget -= pay;
    applied += pay;
  }
  if (budget > 0 && unpaidPrincipal > 0) {
    const pay = Math.min(budget, unpaidPrincipal);
    buckets.push({ type: "principal", amount: pay, penaltyPaid: 0, interestPaid: 0, principalPaid: pay });
    budget -= pay;
    applied += pay;
  }

  if (buckets.length === 0) return 0;

  let balanceBefore = totalUnpaid;
  for (const b of buckets) {
    const balanceAfter = balanceBefore - b.amount;
    const { error: payErr } = await db.from("loan_payments").insert({
      loan_id: loanId,
      installment_id: inst.id,
      paid_amount: b.amount,
      payment_type: b.type,
      description: `${capitalize(b.type)} Repayment`,
      mpesa_receipt: transactionId,
      phone_number: phoneNumber,
      payment_method: "mpesa_c2b",
      tenant_id: tenantId,
      payer_reference_id: customerId,
      payer_type: "customer",
      penalty_paid: b.penaltyPaid,
      interest_paid: b.interestPaid,
      principal_paid: b.principalPaid,
      balanceBefore: balanceBefore,
      balance_after: balanceAfter,
    });
    if (payErr) throw new Error(`loan_payments insert failed (${b.type}): ${payErr.message}`);
    balanceBefore = balanceAfter;
  }

  const newInterestPaid = interestPaid + (buckets.find((b) => b.type === "interest")?.amount ?? 0);
  const newPrincipalPaid = principalPaid + (buckets.find((b) => b.type === "principal")?.amount ?? 0);
  const newPenaltyPaid = penaltyPaid + (buckets.find((b) => b.type === "penalty")?.amount ?? 0);
  const newTotalPaid = newInterestPaid + newPrincipalPaid + newPenaltyPaid;
  const totalDue = interestDue + principalDue + penaltyDue;
  const newStatus = newTotalPaid >= totalDue - 0.005 ? "paid" : applied > 0 ? "partial" : inst.status;

  const { error: updateErr } = await db
    .from("loan_installments")
    .update({
      interest_paid: newInterestPaid,
      principal_paid: newPrincipalPaid,
      paid_amount: newTotalPaid,
      status: newStatus,
    })
    .eq("id", inst.id);
  if (updateErr) throw new Error(`Installment update failed: ${updateErr.message}`);

  console.log(`  Installment #${inst.installment_number}: applied=${applied.toFixed(2)} status=${newStatus}`);
  return applied;
}

// ═══════════════════════════════════════════════════════════════════
// AUTO‑REPAY Handler (triggered by wallet credit)
// ═══════════════════════════════════════════════════════════════════
async function handleAutoRepay(db: SupabaseClient, job: any) {
  const { customer_id } = job.payload;
  const tenantId = job.tenant_id;

  console.log(`[AutoRepay] Starting auto repayment for customer ${customer_id}, tenant ${tenantId}`);

  try {
    const balance = await getWalletBalance(db, tenantId, customer_id);
    console.log(`[AutoRepay] Wallet balance: ${balance}`);
    if (balance <= 0) {
      console.log(`[AutoRepay] Wallet balance is zero – nothing to apply`);
      return;
    }

    const { data: loan } = await db
      .from("loans")
      .select("id, repayment_state")
      .eq("customer_id", customer_id)
      .eq("tenant_id", tenantId)
      .eq("status", "disbursed")
      .in("repayment_state", ["ongoing", "partial", "overdue"])
      .order("disbursed_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!loan) {
      console.log(`[AutoRepay] No active loan – nothing to apply`);
      return;
    }

    console.log(`[AutoRepay] Active loan found: ${loan.id}`);

    const { data: drained, error: drainErr } = await db
      .rpc("drain_wallet_for_repayment", {
        p_tenant_id: tenantId,
        p_customer_id: customer_id,
        p_reference: `auto-${Date.now()}`,
      });

    if (drainErr) {
      console.error(`[AutoRepay] Wallet drain failed: ${drainErr.message}`);
      throw new Error(`Wallet drain failed: ${drainErr.message}`);
    }

    const walletDrained = parseFloat(drained ?? 0);
    console.log(`[AutoRepay] Drained KES ${walletDrained} from wallet`);

    if (walletDrained <= 0) {
      console.log(`[AutoRepay] Nothing drained – probably race condition`);
      return;
    }

    const loanId = loan.id;
    let remaining = walletDrained;
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
        inst,
        loanId,
        tenantId,
        customerId: customer_id,
        available: remaining,
        transactionId: `auto-${Date.now()}`,
        phoneNumber: null,
      });
      remaining -= applied;
      totalApplied += applied;
    }

    if (remaining > 0.005) {
      await walletCredit(
        db,
        tenantId,
        customer_id,
        remaining,
        `Auto-repay overpayment on loan #${loanId}`,
        `auto-${Date.now()}`,
        "overpayment"
      );
    }

    console.log(`[AutoRepay] Completed: total applied KES ${totalApplied} to loan #${loanId}`);
  } catch (err) {
    console.error(`[AutoRepay] Unhandled error: ${err.message}`);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SMS handler for payment received (C2B)
// ═══════════════════════════════════════════════════════════════════
async function handleSmsJob(db: SupabaseClient, job: any) {
  const { transaction_id } = job.payload;
  const tenantId = job.tenant_id;

  console.log(`[SMS] Processing SMS for transaction ${transaction_id}, tenant ${tenantId}`);

  const { data: tx, error: txErr } = await db
    .from("mpesa_c2b_transactions")
    .select(`id, amount, loan_id, customer_id, phone_number, payment_sms_sent, tenant_id`)
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
  if (!tx.loan_id) {
    console.log(`[SMS] No loan associated – marking as sent without SMS`);
    await db.from("mpesa_c2b_transactions").update({ payment_sms_sent: true }).eq("id", tx.id);
    return;
  }

  // Resolve customer name and mobile
  let customerMobile: string | null = null;
  let firstName = "Customer";
  let customerId = tx.customer_id;

  if (customerId) {
    const { data: cust } = await db
      .from("customers")
      .select("Firstname, mobile")
      .eq("id", customerId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (cust) {
      customerMobile = cust.mobile;
      firstName = cust.Firstname || "Customer";
    }
  }
  if (!customerMobile && tx.phone_number) {
    const phoneFormats = normalizePhone(tx.phone_number);
    if (phoneFormats.length) {
      const { data: custByPhone } = await db
        .from("customers")
        .select("id, Firstname, mobile")
        .in("mobile", phoneFormats)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (custByPhone) {
        customerMobile = custByPhone.mobile;
        customerId = custByPhone.id;
        firstName = custByPhone.Firstname || "Customer";
      }
    }
  }
  if (!customerMobile) {
    console.error(`[SMS] No customer mobile found for transaction ${transaction_id}`);
    await db.from("mpesa_c2b_transactions").update({ payment_sms_sent: true }).eq("id", tx.id);
    throw new Error("Customer mobile not found");
  }

  // Calculate outstanding balance
  let outstandingBalance = 0;
  if (tx.loan_id) {
    const { data: loan } = await db.from("loans").select("total_payable").eq("id", tx.loan_id).single();
    const { data: payments } = await db.from("loan_payments").select("paid_amount").eq("loan_id", tx.loan_id);
    const totalPaid = payments?.reduce((sum, p) => sum + Number(p.paid_amount), 0) || 0;
    outstandingBalance = Math.max(0, Number(loan?.total_payable || 0) - totalPaid);
  }

  const amount = Number(tx.amount).toLocaleString();
  const balance = outstandingBalance.toLocaleString();
  const message = `Dear ${firstName},\nWe have received your payment of KES ${amount}.\nYour outstanding loan balance is KES ${balance}.\nThank you for being our valued client.`;

  const { data: smsConfig, error: cfgErr } = await db
    .from("tenant_sms_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (cfgErr || !smsConfig) throw new Error(`SMS config missing for tenant ${tenantId}`);

  const encodedMsg = encodeURIComponent(message.trim());
  const url = `${smsConfig.base_url}?apikey=${smsConfig.api_key}&partnerID=${smsConfig.partner_id}&message=${encodedMsg}&shortcode=${smsConfig.shortcode}&mobile=${customerMobile}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`SMS send failed (${response.status})`);
  }

  await db.from("sms_logs").insert({
    customer_id: customerId,
    recipient_phone: customerMobile,
    message,
    status: "sent",
    message_id: `sms-${Date.now()}`,
    tenant_id: tenantId,
    created_at: new Date().toISOString(),
  });

  await db.from("mpesa_c2b_transactions").update({ payment_sms_sent: true }).eq("id", tx.id);
  console.log(`[SMS] Successfully sent for transaction ${transaction_id}`);
}

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════

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
    p_tenant_id: tenantId,
    p_customer_id: customerId,
    p_amount: amount,
    p_direction: "credit",
    p_narration: narration,
    p_reference: reference,
    p_ref_type: refType,
  });
  if (error) throw new Error(`Wallet credit failed: ${error.message}`);
}

async function getWalletBalance(db: SupabaseClient, tenantId: string, customerId: string): Promise<number> {
  const { data, error } = await db
    .from("customer_wallets")
    .select("credit, debit")
    .eq("customer_id", customerId)
    .eq("tenant_id", tenantId);
  if (error) throw error;
  const balance = (data ?? []).reduce((acc, row) => acc + (row.credit || 0) - (row.debit || 0), 0);
  return balance;
}

async function insertLoanPayment(
  db: SupabaseClient,
  opts: {
    loanId: string | number;
    amount: number;
    type: string;
    description: string;
    receipt: string;
    tenantId: string;
    customerId: string;
  }
) {
  const { error } = await db.from("loan_payments").insert({
    loan_id: opts.loanId,
    paid_amount: opts.amount,
    payment_type: opts.type,
    description: opts.description,
    mpesa_receipt: opts.receipt,
    payment_method: "mpesa_c2b",
    tenant_id: opts.tenantId,
    payer_reference_id: opts.customerId,
    payer_type: "customer",
    penalty_paid: 0,
    interest_paid: opts.type === "interest" ? opts.amount : 0,
    principal_paid: opts.type === "principal" ? opts.amount : 0,
  });
  if (error) throw new Error(`loan_payments insert failed: ${error.message}`);
}

async function moveToSuspense(db: SupabaseClient, tx: Transaction, reason: string) {
  console.log(`Moving ${tx.transaction_id} to suspense: ${reason}`);
  await db.from("suspense_transactions").upsert(
    {
      tenant_id: tx.tenant_id ?? null,
      payer_name: tx.firstname?.trim() ?? "Unknown",
      phone_number: tx.phone_number,
      amount: tx.amount,
      transaction_id: tx.transaction_id,
      transaction_time: tx.transaction_time ?? new Date().toISOString(),
      billref: tx.billref,
      status: "suspense",
      reason,
    },
    { onConflict: "transaction_id" }
  );
  await db.from("mpesa_c2b_transactions").update({ status: "suspense" }).eq("transaction_id", tx.transaction_id);
}

function parseIntent(billref: string | null): PaymentIntent {
  if (!billref) return { type: "repayment" };
  const ref = billref.trim().toLowerCase();
  if (ref === "registration_fee") return { type: "registration" };
  if (ref.startsWith("registration-")) return { type: "registration", customerId: ref.split("-")[1] };
  if (ref.startsWith("processing-")) return { type: "processing", loanId: ref.split("-").slice(1).join("-") };
  return { type: "repayment", accountRef: billref.trim() };
}

async function resolveTenantFromPhone(db: SupabaseClient, phone: string | null): Promise<string | null> {
  if (!phone) return null;
  const formats = normalizePhone(phone);
  const { data } = await db.from("customers").select("tenant_id").in("mobile", formats).limit(1).maybeSingle();
  return data?.tenant_id ?? null;
}

async function resolveCustomer(
  db: SupabaseClient,
  phone: string,
  intent: PaymentIntent
): Promise<Customer | null> {
  if (intent.type === "repayment" && intent.accountRef) {
    const { data } = await db
      .from("customers")
      .select("id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer")
      .eq("id_number", intent.accountRef)
      .maybeSingle();
    if (data) return data as Customer;
  }
  if (intent.customerId) {
    const { data } = await db
      .from("customers")
      .select("id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer")
      .eq("id", intent.customerId)
      .maybeSingle();
    if (data) return data as Customer;
  }
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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ═══════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════
interface Transaction {
  transaction_id: string;
  phone_number: string;
  amount: string | number;
  billref: string | null;
  firstname: string | null;
  transaction_time: string | null;
  tenant_id: string | null;
  retry_count?: number;
}

interface Customer {
  id: string;
  Firstname: string;
  Surname: string;
  mobile: string;
  id_number: string | null;
  tenant_id: string;
  is_new_customer: boolean | null;
}

interface PaymentIntent {
  type: "repayment" | "registration" | "processing";
  accountRef?: string;
  customerId?: string;
  loanId?: string;
}

interface AllocationContext {
  inst: any;
  loanId: number | string;
  tenantId: string;
  customerId: string;
  available: number;
  transactionId: string;
  phoneNumber: string | null;
}

interface ProcessResult {
  transaction_id: string;
  status: "applied" | "skipped" | "suspense" | "error";
  result?: string;
  reason?: string;
  error?: string;
}





















// =============================================================================
// FILE: supabase/functions/process-c2b-payment/index.ts
// PURPOSE: Process M-Pesa C2B transactions — registration fees, processing
//          fees, loan repayments, SMS notifications, queue draining.
// DEPLOYED AS: Supabase Edge Function (Deno)
// CALLED BY:
//   - trigger_payment_processing() DB trigger via pg_net (action=process-single)
//   - Cron / manual invocations (action=process-pending, process-queue, recover-stuck)
// =============================================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// -----------------------------------------------------------------------------
// CORS — allow all origins (tighten to your domain in production if needed)
// -----------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// -----------------------------------------------------------------------------
// C2B job types the queue drainer handles
// Must stay in sync with payment_queue.job_type values inserted by triggers
// -----------------------------------------------------------------------------
const C2B_JOB_TYPES = [
  "c2b_repayment",
  "registration",
  "processing_fee",
  "send_sms",
  "auto_repay",
];

// =============================================================================
// ENTRY POINT
// =============================================================================
Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Admin client — bypasses RLS, needed for cross-tenant operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.json().catch(() => ({}));
    const {
      action,
      transaction_id,
      tenant_id,
      limit = 50,
    } = body as {
      action: string;
      transaction_id?: string;
      tenant_id?: string;
      limit?: number;
    };

    // Unique worker ID for log tracing across concurrent invocations
    const workerId = `edge-${crypto.randomUUID().slice(0, 12)}`;

    console.log(
      `[${workerId}] action=${action} tenant=${tenant_id ?? "all"} tx=${
        transaction_id ?? "-"
      }`
    );

    switch (action) {
      case "process-pending":
        return jsonResponse(
          await processPending(supabaseAdmin, workerId, tenant_id, limit)
        );

      case "process-single":
        if (!transaction_id) throw new Error("transaction_id is required");
        return jsonResponse(
          await processSingle(supabaseAdmin, workerId, transaction_id)
        );

      case "process-queue":
        return jsonResponse(
          await processQueue(supabaseAdmin, workerId, tenant_id)
        );

      case "recover-stuck":
        return jsonResponse(await recoverStuck(supabaseAdmin));

      default:
        return jsonResponse(
          { error: `Unknown action: "${action}". Valid: process-pending | process-single | process-queue | recover-stuck` },
          400
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[process-c2b-payment] Unhandled error:", message);
    return jsonResponse({ error: message }, 500);
  }
});

// =============================================================================
// ACTION: processPending
// Scans all pending transactions and processes each one.
// Use for: scheduled cron job, manual backfill, recovery.
// =============================================================================
async function processPending(
  db: SupabaseClient,
  workerId: string,
  tenantId?: string,
  limit = 50
): Promise<object> {
  console.log(`[${workerId}] Scanning pending C2B transactions (limit=${limit})`);

  let query = db
    .from("mpesa_c2b_transactions")
    .select("transaction_id, tenant_id, amount, billref, phone_number")
    .eq("status", "pending")
    .order("transaction_time", { ascending: true })
    .limit(limit);

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data: rows, error } = await query;
  if (error) throw new Error(`Failed to fetch pending: ${error.message}`);

  console.log(`[${workerId}] Found ${rows?.length ?? 0} pending transactions`);

  const results: ProcessResult[] = [];
  for (const row of rows ?? []) {
    const result = await processOneTransaction(db, workerId, row.transaction_id);
    results.push(result);
  }

  const succeeded = results.filter((r) => r.status === "applied").length;
  const skipped   = results.filter((r) => r.status === "skipped").length;
  const failed    = results.filter((r) => r.status === "error").length;
  const suspense  = results.filter((r) => r.status === "suspense").length;

  console.log(
    `[${workerId}] Done. applied=${succeeded} skipped=${skipped} failed=${failed} suspense=${suspense}`
  );

  return { workerId, total: results.length, succeeded, skipped, failed, suspense, results };
}

// =============================================================================
// ACTION: processSingle
// Process one specific transaction by transaction_id.
// Called directly by the DB trigger via pg_net.
// =============================================================================
async function processSingle(
  db: SupabaseClient,
  workerId: string,
  transactionId: string
): Promise<object> {
  console.log(`[${workerId}] Processing single: ${transactionId}`);
  const result = await processOneTransaction(db, workerId, transactionId);
  return { workerId, ...result };
}

// =============================================================================
// ACTION: processQueue
// Drains payment_queue for C2B job types. Handles send_sms, auto_repay,
// and transaction processing jobs. Stops when no more claimable jobs.
// =============================================================================
async function processQueue(
  db: SupabaseClient,
  workerId: string,
  tenantId?: string
): Promise<object> {
  console.log(`[${workerId}] Draining C2B payment queue...`);
  let processed = 0;
  let failed    = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Atomically claim the next available job
    const { data: job, error: claimErr } = await db.rpc("claim_queue_job", {
      p_worker_id: workerId,
      p_job_types: C2B_JOB_TYPES,
    });

    if (claimErr || !job?.id) {
      // No more claimable jobs — queue is drained
      break;
    }

    // Tenant filter — release job back to queue if not our tenant
    if (tenantId && job.tenant_id !== tenantId) {
      await db
        .from("payment_queue")
        .update({ status: "queued", claimed_at: null, claimed_by: null })
        .eq("id", job.id);
      continue;
    }

    const payload =
      typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;

    try {
      if (job.job_type === "send_sms") {
        // ── SMS send ──────────────────────────────────────────────────────
        await handleSmsJob(db, job);
        await db
          .from("payment_queue")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", job.id);
        processed++;
      } else if (job.job_type === "auto_repay") {
        // ── Auto-repay from wallet ─────────────────────────────────────────
        await handleAutoRepay(db, job);
        await db
          .from("payment_queue")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", job.id);
        processed++;
      } else {
        // ── c2b_repayment | registration | processing_fee ─────────────────
        const txId = payload?.transaction_id as string | undefined;
        if (!txId) {
          await markJobFailed(
            db, job.id, job.attempts, job.max_attempts,
            "Missing transaction_id in payload"
          );
          failed++;
          continue;
        }
        const result = await processOneTransaction(db, workerId, txId);
        if (result.status === "error") {
          await markJobFailed(
            db, job.id, job.attempts, job.max_attempts,
            result.error ?? "Unknown error"
          );
          failed++;
        } else {
          await db
            .from("payment_queue")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", job.id);
          processed++;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markJobFailed(db, job.id, job.attempts, job.max_attempts, message);
      failed++;
    }
  }

  console.log(`[${workerId}] Queue drained. processed=${processed} failed=${failed}`);
  return { workerId, processed, failed };
}

// =============================================================================
// ACTION: recoverStuck
// Resets processing jobs that have been stuck (claimed but not completed).
// Calls the recover_stuck_queue_jobs DB function (set threshold there).
// =============================================================================
async function recoverStuck(db: SupabaseClient): Promise<object> {
  const { data, error } = await db.rpc("recover_stuck_queue_jobs");
  if (error) throw new Error(`Recovery failed: ${error.message}`);
  const recovered = data ?? 0;
  console.log(`[recoverStuck] Recovered ${recovered} stuck jobs`);
  return { recovered };
}

// =============================================================================
// CORE: processOneTransaction
// Atomically claims a transaction then routes it to the correct handler.
//
// Flow:
//   1. claim_c2b_transaction RPC — sets status=processing atomically
//   2. Resolve tenant (from tx or by phone lookup)
//   3. Parse intent from billref
//   4. Resolve customer (by id_number, customerId, or phone)
//   5. Route: registration | processing_fee | repayment
//   6. UPDATE transaction to status=applied (fires SMS trigger)
//
// Returns: ProcessResult — status is one of applied|skipped|suspense|error
// =============================================================================
async function processOneTransaction(
  db: SupabaseClient,
  workerId: string,
  transactionId: string
): Promise<ProcessResult> {
  try {
    // Step 1: Atomically claim the transaction.
    // claim_c2b_transaction sets status=processing and returns the row.
    // Returns null if already claimed (concurrent duplicate trigger call).
    const { data: tx, error: claimErr } = await db.rpc(
      "claim_c2b_transaction",
      { p_transaction_id: transactionId, p_worker_id: workerId }
    );

    if (claimErr || !tx) {
      console.log(
        `[${workerId}] ${transactionId}: already claimed or not found — skipping`
      );
      return {
        transaction_id: transactionId,
        status: "skipped",
        reason: "already_claimed_or_not_found",
      };
    }

    const {
      phone_number,
      amount,
      billref,
      firstname,
      transaction_time,
      tenant_id,
    } = tx as Transaction;

    // Step 2: Resolve tenant
    const tenantId =
      tenant_id ?? (await resolveTenantFromPhone(db, phone_number));
    if (!tenantId) {
      await moveToSuspense(db, tx as Transaction, "Could not resolve tenant");
      return {
        transaction_id: transactionId,
        status: "suspense",
        reason: "tenant_not_resolved",
      };
    }

    console.log(
      `[${workerId}] ${transactionId}: tenant=${tenantId} billref=${billref} amount=${amount}`
    );

    // Step 3: Parse intent from billref
    const intent = parseIntent(billref);
    console.log(`[${workerId}] Intent: ${intent.type}`);

    // Step 4: Resolve customer
    const customer = await resolveCustomer(db, phone_number, intent);
    if (!customer) {
      await moveToSuspense(db, tx as Transaction, "Customer not found in system");
      return {
        transaction_id: transactionId,
        status: "suspense",
        reason: "customer_not_found",
      };
    }

    // Step 5: Route to handler
    let result: string;
    let loanId: string | number | null = null;

    if (intent.type === "registration") {
      const r = await handleRegistration(
        db, tx as Transaction, customer, tenantId, intent
      );
      result = r.result;
      loanId = r.loanId ?? null;
    } else if (intent.type === "processing") {
      const r = await handleProcessingFee(
        db, tx as Transaction, customer, tenantId, intent
      );
      result = r.result;
      loanId = r.loanId;
    } else {
      const r = await handleRepayment(
        db, tx as Transaction, customer, tenantId, parseFloat(String(amount))
      );
      result = r.result;
      loanId = r.loanId;
    }

    // Step 6: Mark transaction as applied.
    // This UPDATE on status triggers trg_enqueue_sms_on_payment_applied.
    const updatePayload: Record<string, unknown> = {
      status:      "applied",
      description: result,
      customer_id: customer.id,
    };
    if (loanId != null) {
      updatePayload.loan_id = loanId;
    }

    const { error: updateError } = await db
      .from("mpesa_c2b_transactions")
      .update(updatePayload)
      .eq("transaction_id", transactionId);

    if (updateError) {
      throw new Error(`Failed to mark applied: ${updateError.message}`);
    }

    console.log(`[${workerId}] ${transactionId}: applied — ${result}`);
    return { transaction_id: transactionId, status: "applied", result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${workerId}] ${transactionId}: ERROR — ${message}`);

    // Only update to failed if still in processing (don't overwrite applied/suspense)
    await db
      .from("mpesa_c2b_transactions")
      .update({ status: "failed" })
      .eq("transaction_id", transactionId)
      .eq("status", "processing");

    return { transaction_id: transactionId, status: "error", error: message };
  }
}

// =============================================================================
// HANDLER: handleRegistration
// Processes registration_fee payments.
// Deducts registration fee → processing fee → excess to wallet.
// Marks customer as registered and flags paid on the loan.
// =============================================================================
async function handleRegistration(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  intent: PaymentIntent
): Promise<{ result: string; loanId?: string | number }> {
  const { transaction_id, amount } = tx;
  const paidAmount = parseFloat(String(amount));

  console.log(
    `[Registration] customer=${customer.id} is_new=${customer.is_new_customer}`
  );

  // Find the most recent pending loan for this customer
  const { data: loan } = await db
    .from("loans")
    .select(
      "id, registration_fee, processing_fee, registration_fee_paid, processing_fee_paid"
    )
    .eq("customer_id", customer.id)
    .eq("tenant_id", tenantId)
    .not("status", "in", '("rejected","disbursed")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!loan) {
    // No pending loan — park money in wallet
    await walletCredit(
      db, tenantId, customer.id, paidAmount,
      "Registration fee — no pending loan", transaction_id, "registration"
    );
    return { result: "No pending loan — credited to wallet" };
  }

  let remaining    = paidAmount;
  let feesDeducted = 0;

  const isNewCustomer    = customer.is_new_customer !== false;
  const registrationFee  = parseFloat(String(loan.registration_fee ?? 0));
  const processingFee    = parseFloat(String(loan.processing_fee ?? 0));

  // Deduct registration fee (new customers only, if not already paid)
  if (isNewCustomer && !loan.registration_fee_paid && registrationFee > 0) {
    if (remaining < registrationFee) {
      await walletCredit(
        db, tenantId, customer.id, remaining,
        "Insufficient for registration fee", transaction_id, "registration"
      );
      return {
        result: `Insufficient for registration fee (KES ${registrationFee}) — parked in wallet`,
        loanId: loan.id,
      };
    }
    remaining    -= registrationFee;
    feesDeducted += registrationFee;

    await insertLoanPayment(db, {
      loanId:      loan.id,
      amount:      registrationFee,
      type:        "registration",
      description: "Registration Fee",
      receipt:     transaction_id,
      tenantId,
      customerId:  customer.id,
    });

    // Mark customer and loan as registration paid
    await db
      .from("customers")
      .update({ registration_fee_paid: true, is_new_customer: false })
      .eq("id", customer.id);
    await db
      .from("loans")
      .update({ registration_fee_paid: true })
      .eq("id", loan.id);
  }

  // Deduct processing fee if enough remaining and not already paid
  if (!loan.processing_fee_paid && processingFee > 0 && remaining >= processingFee) {
    remaining    -= processingFee;
    feesDeducted += processingFee;

    await insertLoanPayment(db, {
      loanId:      loan.id,
      amount:      processingFee,
      type:        "processing",
      description: "Loan Processing Fee",
      receipt:     transaction_id,
      tenantId,
      customerId:  customer.id,
    });

    await db
      .from("loans")
      .update({ processing_fee_paid: true })
      .eq("id", loan.id);
  }

  // Any excess after fees → wallet
  if (remaining > 0.005) {
    await walletCredit(
      db, tenantId, customer.id, remaining,
      "Excess after registration/processing fees", transaction_id, "registration"
    );
  }

  const excessNote =
    remaining > 0.005 ? `, KES ${remaining.toFixed(2)} to wallet` : "";
  return {
    result: `Fees deducted KES ${feesDeducted}${excessNote}`,
    loanId: loan.id,
  };
}

// =============================================================================
// HANDLER: handleProcessingFee
// Processes standalone processing fee payments (billref = "processing-{loanId}").
// =============================================================================
async function handleProcessingFee(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  intent: PaymentIntent
): Promise<{ result: string; loanId: string | number }> {
  const { transaction_id, amount } = tx;
  const loanId    = intent.loanId!;
  const paidAmount = parseFloat(String(amount));

  const { data: loan } = await db
    .from("loans")
    .select("id, processing_fee, processing_fee_paid")
    .eq("id", loanId)
    .eq("tenant_id", tenantId)
    .single();

  if (!loan) throw new Error(`Loan ${loanId} not found for tenant ${tenantId}`);

  if (loan.processing_fee_paid) {
    // Fee already paid — credit to wallet instead
    await walletCredit(
      db, tenantId, customer.id, paidAmount,
      "Processing fee already paid — excess to wallet", transaction_id, "fee"
    );
    return { result: "Processing fee already paid — credited to wallet", loanId };
  }

  const fee = parseFloat(String(loan.processing_fee ?? 0));

  if (paidAmount < fee) {
    await walletCredit(
      db, tenantId, customer.id, paidAmount,
      "Insufficient for processing fee", transaction_id, "fee"
    );
    return {
      result: `Insufficient (paid KES ${paidAmount}, need KES ${fee}) — credited to wallet`,
      loanId,
    };
  }

  await insertLoanPayment(db, {
    loanId,
    amount:      fee,
    type:        "processing",
    description: "Loan Processing Fee",
    receipt:     transaction_id,
    tenantId,
    customerId:  customer.id,
  });

  await db.from("loans").update({ processing_fee_paid: true }).eq("id", loanId);

  const excess = paidAmount - fee;
  if (excess > 0.005) {
    await walletCredit(
      db, tenantId, customer.id, excess,
      "Excess after processing fee", transaction_id, "fee"
    );
  }

  const excessNote = excess > 0.005 ? `, KES ${excess.toFixed(2)} to wallet` : "";
  return {
    result: `Processing fee KES ${fee} deducted${excessNote}`,
    loanId,
  };
}

// =============================================================================
// HANDLER: handleRepayment
// Processes loan repayments.
// 1. Drains customer wallet (applies any existing balance first)
// 2. Combines wallet + M-Pesa amount
// 3. Allocates across installments: Penalty → Interest → Principal
// 4. Excess after all installments → wallet (overpayment)
// =============================================================================
async function handleRepayment(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  mpesaAmount: number
): Promise<{ result: string; loanId: string | number | null }> {
  const { transaction_id, phone_number } = tx;
  const customerId = customer.id;

  // Find the earliest disbursed active loan
  const { data: loan } = await db
    .from("loans")
    .select("id, repayment_state")
    .eq("customer_id", customerId)
    .eq("tenant_id", tenantId)
    .eq("status", "disbursed")
    .in("repayment_state", ["ongoing", "partial", "overdue"])
    .order("disbursed_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!loan) {
    // No active loan — park in wallet
    await walletCredit(
      db, tenantId, customerId, mpesaAmount,
      "Payment with no active loan", transaction_id, "mpesa"
    );
    return {
      result: `No active loan — KES ${mpesaAmount} credited to wallet`,
      loanId: null,
    };
  }

  const loanId = loan.id;

  // Drain customer wallet and combine with this payment
  const { data: drained, error: drainErr } = await db.rpc(
    "drain_wallet_for_repayment",
    { p_tenant_id: tenantId, p_customer_id: customerId, p_reference: transaction_id }
  );

  if (drainErr) {
    console.warn(`[handleRepayment] Wallet drain warning: ${drainErr.message}`);
  }

  const walletDrained = parseFloat(String(drained ?? 0));
  let remaining = mpesaAmount + walletDrained;

  console.log(
    `[Repayment] loan=${loanId} mpesa=${mpesaAmount} wallet=${walletDrained} total=${remaining}`
  );

  // Fetch all unpaid/partial installments in order
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
      inst,
      loanId,
      tenantId,
      customerId,
      available:     remaining,
      transactionId: transaction_id,
      phoneNumber:   phone_number,
    });
    remaining    -= applied;
    totalApplied += applied;
  }

  // Any remaining after all installments → overpayment wallet
  if (remaining > 0.005) {
    await walletCredit(
      db, tenantId, customerId, remaining,
      `Overpayment on loan #${loanId}`, transaction_id, "overpayment"
    );
  }

  const walletNote =
    walletDrained > 0 ? ` (incl. KES ${walletDrained} from wallet)` : "";
  const overpayNote =
    remaining > 0.005 ? `, KES ${remaining.toFixed(2)} overpayment to wallet` : "";

  return {
    result: `Applied KES ${totalApplied.toFixed(2)} to loan #${loanId}${walletNote}${overpayNote}`,
    loanId,
  };
}

// =============================================================================
// ALLOCATOR: allocateInstallment
// Allocates available funds to a single installment in priority order:
//   1. Penalty (late charges)
//   2. Interest
//   3. Principal
// Inserts one loan_payment row per bucket, updates installment totals and status.
// Returns: amount actually applied to this installment.
// =============================================================================
async function allocateInstallment(
  db: SupabaseClient,
  ctx: AllocationContext
): Promise<number> {
  const {
    inst, loanId, tenantId, customerId,
    available, transactionId, phoneNumber,
  } = ctx;

  const penaltyDue     = parseFloat(String(inst.net_penalty ?? inst.penalty_amount ?? 0));
  const interestDue    = parseFloat(String(inst.interest_amount ?? 0));
  const principalDue   = parseFloat(String(inst.principal_amount ?? 0));
  const interestPaid   = parseFloat(String(inst.interest_paid ?? 0));
  const principalPaid  = parseFloat(String(inst.principal_paid ?? 0));

  // Sum any penalty already paid across existing loan_payment rows
  const { data: paidRows } = await db
    .from("loan_payments")
    .select("penalty_paid")
    .eq("installment_id", inst.id);
  const penaltyPaid = (paidRows ?? []).reduce(
    (s: number, r: { penalty_paid?: string }) => s + parseFloat(String(r.penalty_paid ?? 0)),
    0
  );

  const unpaidPenalty   = Math.max(0, penaltyDue - penaltyPaid);
  const unpaidInterest  = Math.max(0, interestDue - interestPaid);
  const unpaidPrincipal = Math.max(0, principalDue - principalPaid);
  const totalUnpaid     = unpaidPenalty + unpaidInterest + unpaidPrincipal;

  if (totalUnpaid <= 0) return 0; // Already fully paid

  // Build payment buckets: Penalty → Interest → Principal
  type Bucket = {
    type: string;
    amount: number;
    penaltyPaid: number;
    interestPaid: number;
    principalPaid: number;
  };

  const buckets: Bucket[] = [];
  let budget  = available;
  let applied = 0;

  if (budget > 0 && unpaidPenalty > 0) {
    const pay = Math.min(budget, unpaidPenalty);
    buckets.push({ type: "penalty", amount: pay, penaltyPaid: pay, interestPaid: 0, principalPaid: 0 });
    budget  -= pay;
    applied += pay;
  }
  if (budget > 0 && unpaidInterest > 0) {
    const pay = Math.min(budget, unpaidInterest);
    buckets.push({ type: "interest", amount: pay, penaltyPaid: 0, interestPaid: pay, principalPaid: 0 });
    budget  -= pay;
    applied += pay;
  }
  if (budget > 0 && unpaidPrincipal > 0) {
    const pay = Math.min(budget, unpaidPrincipal);
    buckets.push({ type: "principal", amount: pay, penaltyPaid: 0, interestPaid: 0, principalPaid: pay });
    budget  -= pay;
    applied += pay;
  }

  if (buckets.length === 0) return 0;

  // Insert one loan_payment row per bucket with running balance
  let balanceBefore = totalUnpaid;
  for (const b of buckets) {
    const balanceAfter = balanceBefore - b.amount;
    const { error: payErr } = await db.from("loan_payments").insert({
      loan_id:           loanId,
      installment_id:    inst.id,
      paid_amount:       b.amount,
      payment_type:      b.type,
      description:       `${capitalize(b.type)} Repayment`,
      mpesa_receipt:     transactionId,
      phone_number:      phoneNumber,
      payment_method:    "mpesa_c2b",
      tenant_id:         tenantId,
      payer_reference_id: customerId,
      payer_type:        "customer",
      penalty_paid:      b.penaltyPaid,
      interest_paid:     b.interestPaid,
      principal_paid:    b.principalPaid,
      "balanceBefore":   balanceBefore,   // camelCase — matches loan_payments schema
      balance_after:     balanceAfter,
    });
    if (payErr) {
      throw new Error(`loan_payments insert failed (${b.type}): ${payErr.message}`);
    }
    balanceBefore = balanceAfter;
  }

  // Update installment totals and status
  const newInterestPaid  = interestPaid + (buckets.find((b) => b.type === "interest")?.amount ?? 0);
  const newPrincipalPaid = principalPaid + (buckets.find((b) => b.type === "principal")?.amount ?? 0);
  const newPenaltyPaid   = penaltyPaid + (buckets.find((b) => b.type === "penalty")?.amount ?? 0);
  const newTotalPaid     = newInterestPaid + newPrincipalPaid + newPenaltyPaid;
  const totalDue         = interestDue + principalDue + penaltyDue;

  // Status: paid if within 0.5 cents of full amount (floating point tolerance)
  const newStatus =
    newTotalPaid >= totalDue - 0.005
      ? "paid"
      : applied > 0
      ? "partial"
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

  if (updateErr) {
    throw new Error(`Installment update failed: ${updateErr.message}`);
  }

  console.log(
    `  [Installment #${inst.installment_number}] applied=${applied.toFixed(2)} status=${newStatus}`
  );
  return applied;
}

// =============================================================================
// HANDLER: handleAutoRepay
// Triggered by a queue job when a wallet credit happens and a loan is active.
// Drains the wallet and applies it to the loan's installments.
// =============================================================================
async function handleAutoRepay(db: SupabaseClient, job: QueueJob): Promise<void> {
  const { customer_id } = job.payload as { customer_id: string };
  const tenantId = job.tenant_id;

  console.log(
    `[AutoRepay] customer=${customer_id} tenant=${tenantId}`
  );

  const balance = await getWalletBalance(db, tenantId, customer_id);
  console.log(`[AutoRepay] Wallet balance: ${balance}`);
  if (balance <= 0) {
    console.log("[AutoRepay] Zero balance — nothing to apply");
    return;
  }

  const { data: loan } = await db
    .from("loans")
    .select("id, repayment_state")
    .eq("customer_id", customer_id)
    .eq("tenant_id", tenantId)
    .eq("status", "disbursed")
    .in("repayment_state", ["ongoing", "partial", "overdue"])
    .order("disbursed_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!loan) {
    console.log("[AutoRepay] No active loan — nothing to apply");
    return;
  }

  const reference = `auto-${Date.now()}`;
  const { data: drained, error: drainErr } = await db.rpc(
    "drain_wallet_for_repayment",
    { p_tenant_id: tenantId, p_customer_id: customer_id, p_reference: reference }
  );

  if (drainErr) throw new Error(`Wallet drain failed: ${drainErr.message}`);

  const walletDrained = parseFloat(String(drained ?? 0));
  console.log(`[AutoRepay] Drained KES ${walletDrained}`);
  if (walletDrained <= 0) return;

  const loanId = loan.id;
  let remaining = walletDrained;

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
      inst,
      loanId,
      tenantId,
      customerId:    customer_id,
      available:     remaining,
      transactionId: reference,
      phoneNumber:   null,
    });
    remaining    -= applied;
    totalApplied += applied;
  }

  if (remaining > 0.005) {
    await walletCredit(
      db, tenantId, customer_id, remaining,
      `Auto-repay overpayment on loan #${loanId}`, reference, "overpayment"
    );
  }

  console.log(
    `[AutoRepay] Done. Applied KES ${totalApplied} to loan #${loanId}`
  );
}

// =============================================================================
// HANDLER: handleSmsJob
// Sends payment confirmation SMS to the customer.
// Reads tenant SMS settings, calculates outstanding balance,
// sends via SMS gateway, logs to sms_logs, marks payment_sms_sent = true.
// =============================================================================
async function handleSmsJob(db: SupabaseClient, job: QueueJob): Promise<void> {
  const { transaction_id } = job.payload as { transaction_id: string };
  const tenantId = job.tenant_id;

  console.log(`[SMS] tx=${transaction_id} tenant=${tenantId}`);

  // Fetch the transaction
  const { data: tx, error: txErr } = await db
    .from("mpesa_c2b_transactions")
    .select("id, amount, loan_id, customer_id, phone_number, payment_sms_sent, tenant_id")
    .eq("transaction_id", transaction_id)
    .eq("tenant_id", tenantId)
    .single();

  if (txErr || !tx) {
    throw new Error(`Transaction not found: ${transaction_id}`);
  }

  // Idempotency guard — SMS already sent
  if (tx.payment_sms_sent) {
    console.log(`[SMS] Already sent for ${transaction_id} — skipping`);
    return;
  }

  // No loan associated — mark sent without sending
  if (!tx.loan_id) {
    console.log(`[SMS] No loan for ${transaction_id} — skipping SMS`);
    await db
      .from("mpesa_c2b_transactions")
      .update({ payment_sms_sent: true })
      .eq("id", tx.id);
    return;
  }

  // Resolve customer name + mobile
  let customerMobile: string | null = null;
  let firstName = "Customer";
  let customerId = tx.customer_id as string | null;

  if (customerId) {
    const { data: cust } = await db
      .from("customers")
      .select("Firstname, mobile")
      .eq("id", customerId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (cust) {
      customerMobile = cust.mobile;
      firstName = (cust.Firstname as string) || "Customer";
    }
  }

  // Fallback: resolve by phone number
  if (!customerMobile && tx.phone_number) {
    const phoneFormats = normalizePhone(tx.phone_number as string);
    if (phoneFormats.length) {
      const { data: custByPhone } = await db
        .from("customers")
        .select("id, Firstname, mobile")
        .in("mobile", phoneFormats)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (custByPhone) {
        customerMobile = custByPhone.mobile as string;
        customerId     = String(custByPhone.id);
        firstName      = (custByPhone.Firstname as string) || "Customer";
      }
    }
  }

  if (!customerMobile) {
    // Mark sent to avoid retrying forever on missing customer
    await db
      .from("mpesa_c2b_transactions")
      .update({ payment_sms_sent: true })
      .eq("id", tx.id);
    throw new Error(`No mobile found for ${transaction_id} — marked as sent`);
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
    const totalPaid = (payments ?? []).reduce(
      (sum: number, p: { paid_amount: number }) => sum + Number(p.paid_amount),
      0
    );
    outstandingBalance = Math.max(
      0,
      Number(loan?.total_payable ?? 0) - totalPaid
    );
  }

  // Build SMS message
  const amountFmt  = Number(tx.amount).toLocaleString("en-KE");
  const balanceFmt = outstandingBalance.toLocaleString("en-KE");
  const message = [
    `Dear ${firstName},`,
    `We have received your payment of KES ${amountFmt}.`,
    `Your outstanding loan balance is KES ${balanceFmt}.`,
    `Thank you for being our valued client.`,
  ].join("\n");

  // Load tenant SMS config
  const { data: smsConfig, error: cfgErr } = await db
    .from("tenant_sms_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (cfgErr || !smsConfig) {
    throw new Error(`SMS config missing for tenant ${tenantId}`);
  }

  // Send via SMS gateway
  const encodedMsg = encodeURIComponent(message.trim());
  const smsUrl = `${smsConfig.base_url}?apikey=${smsConfig.api_key}&partnerID=${smsConfig.partner_id}&message=${encodedMsg}&shortcode=${smsConfig.shortcode}&mobile=${customerMobile}`;

  const smsResp = await fetch(smsUrl);
  if (!smsResp.ok) {
    throw new Error(`SMS gateway error (HTTP ${smsResp.status}) for ${transaction_id}`);
  }

  // Log SMS
  await db.from("sms_logs").insert({
    customer_id:     customerId,
    recipient_phone: customerMobile,
    message,
    status:          "sent",
    message_id:      `sms-${Date.now()}`,
    tenant_id:       tenantId,
    created_at:      new Date().toISOString(),
  });

  // Mark SMS as sent on the transaction
  await db
    .from("mpesa_c2b_transactions")
    .update({ payment_sms_sent: true })
    .eq("id", tx.id);

  console.log(`[SMS] Sent for ${transaction_id} to ${customerMobile}`);
}

// =============================================================================
// UTILITIES
// =============================================================================

async function walletCredit(
  db: SupabaseClient,
  tenantId: string,
  customerId: string,
  amount: number,
  narration: string,
  reference: string,
  refType: string
): Promise<void> {
  const { error } = await db.rpc("wallet_transact", {
    p_tenant_id:  tenantId,
    p_customer_id: customerId,
    p_amount:     amount,
    p_direction:  "credit",
    p_narration:  narration,
    p_reference:  reference,
    p_ref_type:   refType,
  });
  if (error) throw new Error(`Wallet credit failed: ${error.message}`);
}

async function getWalletBalance(
  db: SupabaseClient,
  tenantId: string,
  customerId: string
): Promise<number> {
  const { data, error } = await db
    .from("customer_wallets")
    .select("credit, debit")
    .eq("customer_id", customerId)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`Wallet balance error: ${error.message}`);
  return (data ?? []).reduce(
    (acc: number, row: { credit?: number; debit?: number }) =>
      acc + (row.credit ?? 0) - (row.debit ?? 0),
    0
  );
}

async function insertLoanPayment(
  db: SupabaseClient,
  opts: {
    loanId: string | number;
    amount: number;
    type: string;
    description: string;
    receipt: string;
    tenantId: string;
    customerId: string;
  }
): Promise<void> {
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
    interest_paid:      opts.type === "interest" ? opts.amount : 0,
    principal_paid:     opts.type === "principal" ? opts.amount : 0,
  });
  if (error) throw new Error(`loan_payments insert failed: ${error.message}`);
}

async function moveToSuspense(
  db: SupabaseClient,
  tx: Transaction,
  reason: string
): Promise<void> {
  console.log(`[Suspense] ${tx.transaction_id} — ${reason}`);
  await db.from("suspense_transactions").upsert(
    {
      tenant_id:        tx.tenant_id ?? null,
      payer_name:       tx.firstname?.trim() ?? "Unknown",
      phone_number:     tx.phone_number,
      amount:           tx.amount,
      transaction_id:   tx.transaction_id,
      transaction_time: tx.transaction_time ?? new Date().toISOString(),
      billref:          tx.billref,
      status:           "suspense",
      reason,
    },
    { onConflict: "transaction_id" }
  );
  await db
    .from("mpesa_c2b_transactions")
    .update({ status: "suspense" })
    .eq("transaction_id", tx.transaction_id);
}

// Parses billref to determine payment intent:
//   "registration_fee"    → registration (generic)
//   "registration-{id}"   → registration for specific customer
//   "processing-{loanId}" → standalone processing fee for specific loan
//   anything else          → repayment (use billref as account reference)
function parseIntent(billref: string | null): PaymentIntent {
  if (!billref) return { type: "repayment" };
  const ref = billref.trim().toLowerCase();
  if (ref === "registration_fee") return { type: "registration" };
  if (ref.startsWith("registration-")) {
    return { type: "registration", customerId: billref.split("-")[1] };
  }
  if (ref.startsWith("processing-")) {
    return { type: "processing", loanId: billref.split("-").slice(1).join("-") };
  }
  return { type: "repayment", accountRef: billref.trim() };
}

// Resolves tenant by looking up the phone number in customers
async function resolveTenantFromPhone(
  db: SupabaseClient,
  phone: string | null
): Promise<string | null> {
  if (!phone) return null;
  const formats = normalizePhone(phone);
  const { data } = await db
    .from("customers")
    .select("tenant_id")
    .in("mobile", formats)
    .limit(1)
    .maybeSingle();
  return data?.tenant_id ?? null;
}

// Resolves customer in priority order:
//   1. By id_number (if repayment with accountRef)
//   2. By explicit customerId (if in intent)
//   3. By phone number (all normalized formats)
async function resolveCustomer(
  db: SupabaseClient,
  phone: string,
  intent: PaymentIntent
): Promise<Customer | null> {
  const fields = "id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer";

  if (intent.type === "repayment" && intent.accountRef) {
    const { data } = await db
      .from("customers")
      .select(fields)
      .eq("id_number", intent.accountRef)
      .maybeSingle();
    if (data) return data as Customer;
  }

  if (intent.customerId) {
    const { data } = await db
      .from("customers")
      .select(fields)
      .eq("id", intent.customerId)
      .maybeSingle();
    if (data) return data as Customer;
  }

  const formats = normalizePhone(phone);
  if (formats.length) {
    const { data } = await db
      .from("customers")
      .select(fields)
      .in("mobile", formats)
      .maybeSingle();
    if (data) return data as Customer;
  }

  return null;
}

// Normalizes a phone number to all valid Kenyan formats:
//   254XXXXXXXXX, 0XXXXXXXXX, +254XXXXXXXXX
function normalizePhone(phone: string): string[] {
  if (!phone) return [];
  const clean = String(phone).replace(/[\s\-()+ ]/g, "");
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

// Marks a queue job as failed or dead based on attempt count
async function markJobFailed(
  db: SupabaseClient,
  jobId: string,
  attempts: number,
  maxAttempts: number,
  error: string
): Promise<void> {
  const isDead = attempts >= maxAttempts;
  await db.from("payment_queue").update({
    status:      isDead ? "dead" : "queued",
    last_error:  error,
    failed_at:   new Date().toISOString(),
    claimed_at:  null,
    claimed_by:  null,
    // Retry after 30s unless dead
    scheduled_at: isDead ? null : new Date(Date.now() + 30_000).toISOString(),
  }).eq("id", jobId);
}

const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface Transaction {
  transaction_id: string;
  phone_number: string;
  amount: string | number;
  billref: string | null;
  firstname: string | null;
  transaction_time: string | null;
  tenant_id: string | null;
}

interface Customer {
  id: string;
  Firstname: string;
  Surname: string;
  mobile: string;
  id_number: string | null;
  tenant_id: string;
  is_new_customer: boolean | null;
}

interface PaymentIntent {
  type: "repayment" | "registration" | "processing";
  accountRef?: string;
  customerId?: string;
  loanId?: string;
}

interface AllocationContext {
  inst: Record<string, unknown>;
  loanId: number | string;
  tenantId: string;
  customerId: string;
  available: number;
  transactionId: string;
  phoneNumber: string | null;
}

interface QueueJob {
  id: string;
  job_type: string;
  tenant_id: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

interface ProcessResult {
  transaction_id: string;
  status: "applied" | "skipped" | "suspense" | "error";
  result?: string;
  reason?: string;
  error?: string;
}
















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

const C2B_JOB_TYPES = ["c2b_repayment", "registration", "processing_fee", "send_sms", "auto_repay"];

async function processPending(db: SupabaseClient, workerId: string, tenantId?: string, limit = 50) {
  console.log(`[${workerId}] Scanning pending C2B transactions...`);
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

  const succeeded = results.filter((r) => r.status === "applied").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "error").length;

  console.log(`[${workerId}] Done. applied=${succeeded} skipped=${skipped} failed=${failed}`);
  return { workerId, total: results.length, succeeded, skipped, failed, results };
}

async function processSingle(db: SupabaseClient, workerId: string, transactionId: string) {
  console.log(`[${workerId}] Processing single: ${transactionId}`);
  const result = await processOneTransaction(db, workerId, transactionId);
  return { workerId, ...result };
}

async function processQueue(db: SupabaseClient, workerId: string, tenantId?: string) {
  console.log(`[${workerId}] Draining C2B payment queue...`);
  let processed = 0, failed = 0;

  while (true) {
    const { data: job, error: claimErr } = await db
      .rpc("claim_queue_job", { p_worker_id: workerId, p_job_types: C2B_JOB_TYPES });
    if (claimErr || !job?.id) break;

    if (tenantId && job.tenant_id !== tenantId) {
      await db.from("payment_queue").update({ status: "queued", claimed_at: null, claimed_by: null }).eq("id", job.id);
      continue;
    }

    const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
    const jobType = job.job_type;

    try {
      if (jobType === "send_sms") {
        await handleSmsJob(db, job);
        await db.from("payment_queue").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
        processed++;
      } else if (jobType === "auto_repay") {
        await handleAutoRepay(db, job);
        await db.from("payment_queue").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
        processed++;
      } else {
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

  console.log(`[${workerId}] C2B queue drained. processed=${processed} failed=${failed}`);
  return { workerId, processed, failed };
}

async function recoverStuck(db: SupabaseClient) {
  const { data, error } = await db.rpc("recover_stuck_queue_jobs");
  if (error) throw new Error(`Recovery failed: ${error.message}`);
  console.log(`Recovered ${data} stuck jobs`);
  return { recovered: data ?? 0 };
}

// ═══════════════════════════════════════════════════════════════════
// CORE: processOneTransaction
// ═══════════════════════════════════════════════════════════════════
async function processOneTransaction(
  db: SupabaseClient,
  workerId: string,
  transactionId: string
): Promise<ProcessResult> {
  try {
    const { data: tx, error: claimErr } = await db
      .rpc("claim_c2b_transaction", {
        p_transaction_id: transactionId,
        p_worker_id: workerId,
      });

    if (claimErr || !tx) {
      console.log(`[${workerId}] ${transactionId}: already claimed or not found — skipping`);
      return { transaction_id: transactionId, status: "skipped", reason: "already_claimed_or_not_found" };
    }

    const { phone_number, amount, billref, transaction_time, tenant_id } = tx;

    const tenantId = tenant_id ?? (await resolveTenantFromPhone(db, phone_number));
    if (!tenantId) {
      await moveToSuspense(db, tx, "Could not resolve tenant");
      return { transaction_id: transactionId, status: "suspense", reason: "tenant_not_resolved" };
    }

    console.log(`[${workerId}] ${transactionId}: tenant=${tenantId} billref=${billref} amount=${amount}`);

    const intent = parseIntent(billref);
    console.log(`[${workerId}] Intent: ${intent.type}`);

    const customer = await resolveCustomer(db, phone_number, intent, tenantId);
    if (!customer) {
      await moveToSuspense(db, tx, "Customer not found in system");
      return { transaction_id: transactionId, status: "suspense", reason: "customer_not_found" };
    }

    let result: string;
    let loanId: string | number | null = null;

    if (intent.type === "registration") {
      // ── FEE PAYMENT: goes to wallets only, never into loan_repayment ──
      const handlerResult = await handleRegistration(db, tx, customer, tenantId, intent);
      result = handlerResult.result;
      loanId = handlerResult.loanId ?? null;
    } else if (intent.type === "processing") {
      // ── FEE PAYMENT: goes to wallets only, never into loan_repayment ──
      const handlerResult = await handleProcessingFee(db, tx, customer, tenantId, intent);
      result = handlerResult.result;
      loanId = handlerResult.loanId ?? null;
    } else {
      // ── REPAYMENT: only path that writes to loan_repayment table ──
      const handlerResult = await handleRepayment(db, tx, customer, tenantId, parseFloat(String(amount)));
      result = handlerResult.result;
      loanId = handlerResult.loanId;
    }

    const updateData: Record<string, unknown> = {
      status: "applied",
      description: result,
      customer_id: customer.id,
    };
    if (loanId != null) {
      updateData.loan_id = loanId;
      console.log(`[${workerId}] Setting loan_id=${loanId} for transaction ${transactionId}`);
    }

    const { error: updateError } = await db
      .from("mpesa_c2b_transactions")
      .update(updateData)
      .eq("transaction_id", transactionId);

    if (updateError) throw new Error(`Failed to update transaction status: ${updateError.message}`);

    console.log(`[${workerId}] ${transactionId}: applied — ${result}`);

    // SMS only for actual repayments to an active loan
    if (intent.type === "repayment" && loanId != null) {
      handlePaymentSms(db, transactionId, tenantId).catch((smsErr) => {
        console.error(`[${workerId}] SMS failed for ${transactionId}:`, smsErr.message);
      });
    }

    // Auto-repay: drain wallet into loan if there's an active loan
    // Only triggered for repayment intent — fee payments that land in wallet
    // are handled separately by deductPendingFeesFromWallet, NOT this path.
    if (intent.type === "repayment") {
      Promise.resolve().then(() => {
        handleAutoRepayByCustomer(db, customer.id, tenantId).catch((err) => {
          console.error(`[${workerId}] Auto-repay failed for customer ${customer.id}:`, err.message);
        });
      });
    }

    return { transaction_id: transactionId, status: "applied", result };
  } catch (err) {
    console.error(`[${workerId}] ${transactionId}: ERROR — ${err.message}`);
    await db
      .from("mpesa_c2b_transactions")
      .update({ status: "failed", last_error: err.message })
      .eq("transaction_id", transactionId)
      .eq("status", "processing");
    return { transaction_id: transactionId, status: "error", error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: Registration Fee
// ─ Writes ONLY to customer_wallets (via walletCredit/walletDebit).
// ─ Does NOT write to loan_payments (loan_repayment).
// ═══════════════════════════════════════════════════════════════════
async function handleRegistration(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  intent: PaymentIntent
): Promise<{ result: string; loanId?: string | number }> {
  const { transaction_id, amount } = tx;
  const paidAmount = parseFloat(String(amount));

  console.log(`Registration fee: customer=${customer.id} new=${customer.is_new_customer}`);

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
    // No pending loan — park in wallet. Fee handling only; never loan_repayment.
    await walletCredit(db, tenantId, customer.id, paidAmount, "Registration fee — no pending loan", transaction_id, "registration");
    return { result: "No pending loan — credited to wallet" };
  }

  let remaining = paidAmount;
  let feesDeducted = 0;

  const isNewCustomer = customer.is_new_customer !== false;
  const registrationFee = parseFloat(String(loan.registration_fee ?? 0));
  const processingFee = parseFloat(String(loan.processing_fee ?? 0));

  // ── Registration fee: record in loan_fees_log (NOT loan_payments) ──
  if (isNewCustomer && !loan.registration_fee_paid && registrationFee > 0) {
    if (remaining < registrationFee) {
      await walletCredit(db, tenantId, customer.id, remaining, "Insufficient for registration fee", transaction_id, "registration");
      return { result: `Insufficient for registration fee (KES ${registrationFee}) — parked in wallet` };
    }
    remaining -= registrationFee;
    feesDeducted += registrationFee;
    await insertFeePayment(db, {
      loanId: loan.id,
      amount: registrationFee,
      type: "registration",
      description: "Registration Fee",
      receipt: transaction_id,
      tenantId,
      customerId: customer.id,
    });
    await db.from("customers").update({ registration_fee_paid: true, is_new_customer: false }).eq("id", customer.id);
    await db.from("loans").update({ registration_fee_paid: true }).eq("id", loan.id);
  }

  // ── Processing fee: record in loan_fees_log (NOT loan_payments) ──
  if (!loan.processing_fee_paid && processingFee > 0 && remaining >= processingFee) {
    remaining -= processingFee;
    feesDeducted += processingFee;
    await insertFeePayment(db, {
      loanId: loan.id,
      amount: processingFee,
      type: "processing",
      description: "Loan Processing Fee",
      receipt: transaction_id,
      tenantId,
      customerId: customer.id,
    });
    await db.from("loans").update({ processing_fee_paid: true }).eq("id", loan.id);
  }

  // Excess after fees → wallet. This wallet balance must NOT auto-drain
  // into loan_repayment because this was a fee payment transaction.
  if (remaining > 0.005) {
    await walletCredit(db, tenantId, customer.id, remaining, "Excess after registration/processing fees", transaction_id, "fee_excess");
    // Do NOT call deductPendingFeesFromWallet or handleAutoRepayByCustomer here —
    // the excess from a fee payment stays in wallet and is only consumed by the
    // next explicit repayment transaction or wallet-drain repayment flow.
  }

  const result = `Fees deducted KES ${feesDeducted}${remaining > 0.005 ? `, KES ${remaining.toFixed(2)} to wallet` : ""}`;
  return { result, loanId: loan.id };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: Processing Fee (standalone)
// ─ Writes ONLY to customer_wallets / loan_fees_log.
// ─ Does NOT write to loan_payments (loan_repayment).
// ═══════════════════════════════════════════════════════════════════
async function handleProcessingFee(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  intent: PaymentIntent
): Promise<{ result: string; loanId: string | number }> {
  const { transaction_id, amount } = tx;
  const loanId = intent.loanId!;
  const paidAmount = parseFloat(String(amount));

  const { data: loan } = await db
    .from("loans")
    .select("id, processing_fee, processing_fee_paid")
    .eq("id", loanId)
    .eq("tenant_id", tenantId)
    .single();

  if (!loan) throw new Error(`Loan ${loanId} not found`);
  if (loan.processing_fee_paid) return { result: "Processing fee already paid", loanId };

  const fee = parseFloat(String(loan.processing_fee ?? 0));

  if (paidAmount < fee) {
    await walletCredit(db, tenantId, customer.id, paidAmount, "Insufficient for processing fee", transaction_id, "fee");
    return { result: `Insufficient (paid KES ${paidAmount}, need KES ${fee}) — credited to wallet`, loanId };
  }

  await insertFeePayment(db, {
    loanId,
    amount: fee,
    type: "processing",
    description: "Loan Processing Fee",
    receipt: transaction_id,
    tenantId,
    customerId: customer.id,
  });
  await db.from("loans").update({ processing_fee_paid: true }).eq("id", loanId);

  const excess = paidAmount - fee;
  if (excess > 0.005) {
    await walletCredit(db, tenantId, customer.id, excess, "Excess processing fee payment", transaction_id, "fee_excess");
    // Same rule: fee excess stays in wallet, NOT drained to loan repayment.
  }

  const result = `Processing fee KES ${fee} deducted${excess > 0.005 ? `, KES ${excess.toFixed(2)} to wallet` : ""}`;
  return { result, loanId };
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER: Loan Repayment
// ─ THIS IS THE ONLY HANDLER THAT WRITES TO loan_payments.
// ─ Wallet drain here only applies wallet funds that were credited
//   via a prior repayment or overpayment — fee_excess entries in
//   the wallet are tagged differently and excluded by the RPC.
// ═══════════════════════════════════════════════════════════════════
async function handleRepayment(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  mpesaAmount: number
): Promise<{ result: string; loanId: string | number | null }> {
  const { transaction_id, phone_number } = tx;
  const customerId = customer.id;

  // First, clear any pending fees from wallet (registration/processing)
  // before touching the loan. This ensures fee_excess wallet entries are
  // consumed as fees, not double-counted as loan repayments.
  await deductPendingFeesFromWallet(db, tenantId, customerId, transaction_id);

  const { data: loan } = await db
    .from("loans")
    .select("id, repayment_state")
    .eq("customer_id", customerId)
    .eq("tenant_id", tenantId)
    .eq("status", "disbursed")
    .in("repayment_state", ["ongoing", "partial", "overdue"])
    .order("disbursed_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!loan) {
    // No active loan: park the incoming M-Pesa amount in wallet.
    // Do NOT drain wallet into loan_payments — there is no loan.
    await walletCredit(db, tenantId, customerId, mpesaAmount, "Payment with no active loan", transaction_id, "mpesa");
    return { result: `No active loan — KES ${mpesaAmount} credited to wallet`, loanId: null };
  }

  const loanId = loan.id;

  // drain_wallet_for_repayment RPC must exclude wallet entries whose
  // transaction_type IN ('registration','processing','fee','fee_excess')
  // — enforce this in the RPC, not here.
  const { data: drained, error: drainErr } = await db
    .rpc("drain_wallet_for_repayment", {
      p_tenant_id: tenantId,
      p_customer_id: customerId,
      p_reference: transaction_id,
    });

  if (drainErr) throw new Error(`Wallet drain failed: ${drainErr.message}`);

  const walletDrained = parseFloat(String(drained ?? 0));
  let remaining = mpesaAmount + walletDrained;

  console.log(`Loan ${loanId}: mpesa=${mpesaAmount} wallet=${walletDrained} total=${remaining}`);

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
      inst,
      loanId,
      tenantId,
      customerId,
      available: remaining,
      transactionId: transaction_id,
      phoneNumber: phone_number,
    });
    remaining -= applied;
    totalApplied += applied;
  }

  if (remaining > 0.005) {
    await walletCredit(db, tenantId, customerId, remaining, `Overpayment on loan #${loanId}`, transaction_id, "overpayment");
  }

  const result = `Applied KES ${totalApplied.toFixed(2)} to loan #${loanId}${
    walletDrained > 0 ? ` (incl. KES ${walletDrained} from wallet)` : ""
  }${remaining > 0.005 ? `, KES ${remaining.toFixed(2)} overpayment to wallet` : ""}`;
  return { result, loanId };
}

// ═══════════════════════════════════════════════════════════════════
// ALLOCATOR: One installment – Penalty → Interest → Principal
// ═══════════════════════════════════════════════════════════════════
async function allocateInstallment(db: SupabaseClient, ctx: AllocationContext): Promise<number> {
  const { inst, loanId, tenantId, customerId, available, transactionId, phoneNumber } = ctx;

  const penaltyDue = parseFloat(inst.net_penalty ?? inst.penalty_amount ?? 0);
  const interestDue = parseFloat(inst.interest_amount ?? 0);
  const principalDue = parseFloat(inst.principal_amount ?? 0);
  const interestPaid = parseFloat(inst.interest_paid ?? 0);
  const principalPaid = parseFloat(inst.principal_paid ?? 0);

  const { data: paidRows } = await db
    .from("loan_payments")
    .select("penalty_paid")
    .eq("installment_id", inst.id);
  const penaltyPaid = (paidRows ?? []).reduce((s, r) => s + parseFloat(r.penalty_paid ?? 0), 0);

  const unpaidPenalty = Math.max(0, penaltyDue - penaltyPaid);
  const unpaidInterest = Math.max(0, interestDue - interestPaid);
  const unpaidPrincipal = Math.max(0, principalDue - principalPaid);
  const totalUnpaid = unpaidPenalty + unpaidInterest + unpaidPrincipal;

  if (totalUnpaid <= 0) return 0;

  type PaymentBucket = {
    type: string;
    amount: number;
    penaltyPaid: number;
    interestPaid: number;
    principalPaid: number;
  };
  const buckets: PaymentBucket[] = [];
  let budget = available;
  let applied = 0;

  if (budget > 0 && unpaidPenalty > 0) {
    const pay = Math.min(budget, unpaidPenalty);
    buckets.push({ type: "penalty", amount: pay, penaltyPaid: pay, interestPaid: 0, principalPaid: 0 });
    budget -= pay;
    applied += pay;
  }
  if (budget > 0 && unpaidInterest > 0) {
    const pay = Math.min(budget, unpaidInterest);
    buckets.push({ type: "interest", amount: pay, penaltyPaid: 0, interestPaid: pay, principalPaid: 0 });
    budget -= pay;
    applied += pay;
  }
  if (budget > 0 && unpaidPrincipal > 0) {
    const pay = Math.min(budget, unpaidPrincipal);
    buckets.push({ type: "principal", amount: pay, penaltyPaid: 0, interestPaid: 0, principalPaid: pay });
    budget -= pay;
    applied += pay;
  }

  if (buckets.length === 0) return 0;

  let balanceBefore = totalUnpaid;
  for (const b of buckets) {
    const balanceAfter = balanceBefore - b.amount;
    const { error: payErr } = await db.from("loan_payments").insert({
      loan_id: loanId,
      installment_id: inst.id,
      paid_amount: b.amount,
      payment_type: b.type,
      description: `${capitalize(b.type)} Repayment`,
      mpesa_receipt: transactionId,
      phone_number: phoneNumber,
      payment_method: "mpesa_c2b",
      tenant_id: tenantId,
      payer_reference_id: customerId,
      payer_type: "customer",
      penalty_paid: b.penaltyPaid,
      interest_paid: b.interestPaid,
      principal_paid: b.principalPaid,
      balanceBefore: balanceBefore,   // column is "balanceBefore" (camelCase) in DB
      balance_after: balanceAfter,
    });
    if (payErr) throw new Error(`loan_payments insert failed (${b.type}): ${payErr.message}`);
    balanceBefore = balanceAfter;
  }

  const newInterestPaid = interestPaid + (buckets.find((b) => b.type === "interest")?.amount ?? 0);
  const newPrincipalPaid = principalPaid + (buckets.find((b) => b.type === "principal")?.amount ?? 0);
  const newPenaltyPaid = penaltyPaid + (buckets.find((b) => b.type === "penalty")?.amount ?? 0);
  const newTotalPaid = newInterestPaid + newPrincipalPaid + newPenaltyPaid;
  const totalDue = interestDue + principalDue + penaltyDue;
  const newStatus = newTotalPaid >= totalDue - 0.005 ? "paid" : applied > 0 ? "partial" : inst.status;

  const { error: updateErr } = await db
    .from("loan_installments")
    .update({
      interest_paid: newInterestPaid,
      principal_paid: newPrincipalPaid,
      paid_amount: newTotalPaid,
      status: newStatus,
    })
    .eq("id", inst.id);
  if (updateErr) throw new Error(`Installment update failed: ${updateErr.message}`);

  console.log(`  Installment #${inst.installment_number}: applied=${applied.toFixed(2)} status=${newStatus}`);
  return applied;
}

// ═══════════════════════════════════════════════════════════════════
// AUTO-REPAY: triggered by wallet credit during a repayment flow.
// ─ Never called from fee payment handlers.
// ═══════════════════════════════════════════════════════════════════
async function handleAutoRepayByCustomer(db: SupabaseClient, customerId: string, tenantId: string) {
  try {
    // Clear any pending fees first — so fee balances are not mistakenly
    // drained into loan installments.
    await deductPendingFeesFromWallet(db, tenantId, customerId, "auto-repay-trigger");

    const balance = await getWalletBalance(db, tenantId, customerId);
    console.log(`[AutoRepay] Wallet balance after fee deductions: ${balance}`);
    if (balance <= 0) {
      console.log(`[AutoRepay] Wallet balance is zero – nothing to apply`);
      return;
    }

    const { data: loan } = await db
      .from("loans")
      .select("id, repayment_state")
      .eq("customer_id", customerId)
      .eq("tenant_id", tenantId)
      .eq("status", "disbursed")
      .in("repayment_state", ["ongoing", "partial", "overdue"])
      .order("disbursed_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!loan) {
      console.log(`[AutoRepay] No active loan – nothing to apply`);
      return;
    }

    console.log(`[AutoRepay] Active loan found: ${loan.id}`);

    const autoRef = `auto-${Date.now()}`;
    const { data: drained, error: drainErr } = await db
      .rpc("drain_wallet_for_repayment", {
        p_tenant_id: tenantId,
        p_customer_id: customerId,
        p_reference: autoRef,
      });

    if (drainErr) throw new Error(`Wallet drain failed: ${drainErr.message}`);

    const walletDrained = parseFloat(String(drained ?? 0));
    console.log(`[AutoRepay] Drained KES ${walletDrained} from wallet`);

    if (walletDrained <= 0) {
      console.log(`[AutoRepay] Nothing drained – probably race condition or only fee balances remain`);
      return;
    }

    const loanId = loan.id;
    let remaining = walletDrained;
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
        inst,
        loanId,
        tenantId,
        customerId,
        available: remaining,
        transactionId: autoRef,
        phoneNumber: null,
      });
      remaining -= applied;
      totalApplied += applied;
    }

    if (remaining > 0.005) {
      await walletCredit(db, tenantId, customerId, remaining, `Auto-repay overpayment on loan #${loanId}`, autoRef, "overpayment");
    }

    console.log(`[AutoRepay] Completed: total applied KES ${totalApplied} to loan #${loanId}`);
  } catch (err) {
    console.error(`[AutoRepay] Unhandled error: ${err.message}`);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SMS handler
// ═══════════════════════════════════════════════════════════════════
async function handlePaymentSms(db: SupabaseClient, transactionId: string, tenantId: string) {
  console.log(`[SMS] Processing SMS for transaction ${transactionId}, tenant ${tenantId}`);

  const { data: tx, error: txErr } = await db
    .from("mpesa_c2b_transactions")
    .select(`id, amount, loan_id, customer_id, phone_number, payment_sms_sent, tenant_id`)
    .eq("transaction_id", transactionId)
    .eq("tenant_id", tenantId)
    .single();

  if (txErr || !tx) throw new Error(`Transaction not found: ${transactionId}`);
  if (tx.payment_sms_sent) {
    console.log(`[SMS] SMS already sent for ${transactionId}, skipping`);
    return;
  }

  if (!tx.loan_id) {
    console.log(`[SMS] No loan associated – marking as sent without SMS`);
    await db.from("mpesa_c2b_transactions").update({ payment_sms_sent: true }).eq("id", tx.id);
    return;
  }

  const { data: loan, error: loanErr } = await db
    .from("loans")
    .select("status, repayment_state, total_payable")
    .eq("id", tx.loan_id)
    .single();

  if (loanErr || !loan) {
    await db.from("mpesa_c2b_transactions").update({ payment_sms_sent: true }).eq("id", tx.id);
    return;
  }

  const isActive =
    loan.status === "disbursed" && ["ongoing", "partial", "overdue"].includes(loan.repayment_state);

  if (!isActive) {
    console.log(`[SMS] Loan not active – skipping SMS`);
    await db.from("mpesa_c2b_transactions").update({ payment_sms_sent: true }).eq("id", tx.id);
    return;
  }

  let customerMobile: string | null = null;
  let firstName = "Customer";
  let customerId = tx.customer_id;

  if (customerId) {
    const { data: cust } = await db
      .from("customers")
      .select("Firstname, mobile")
      .eq("id", customerId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (cust) { customerMobile = cust.mobile; firstName = cust.Firstname || "Customer"; }
  }
  if (!customerMobile && tx.phone_number) {
    const phoneFormats = normalizePhone(tx.phone_number);
    if (phoneFormats.length) {
      const { data: custByPhone } = await db
        .from("customers")
        .select("id, Firstname, mobile")
        .in("mobile", phoneFormats)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (custByPhone) {
        customerMobile = custByPhone.mobile;
        customerId = custByPhone.id;
        firstName = custByPhone.Firstname || "Customer";
      }
    }
  }

  const formatPhone = (phone: string) => {
    if (!phone) return "";
    const cleaned = String(phone).replace(/\D/g, "");
    if (cleaned.startsWith("254") && cleaned.length === 12) return cleaned;
    if (cleaned.startsWith("0") && cleaned.length === 10) return "254" + cleaned.substring(1);
    if (cleaned.length === 9 && (cleaned.startsWith("7") || cleaned.startsWith("1"))) return "254" + cleaned;
    return cleaned;
  };

  if (!customerMobile && tx.phone_number) customerMobile = tx.phone_number;
  customerMobile = formatPhone(customerMobile ?? "");

  if (!customerMobile) {
    await db.from("mpesa_c2b_transactions").update({ payment_sms_sent: true }).eq("id", tx.id);
    throw new Error("Customer mobile not found");
  }

  const { data: payments } = await db.from("loan_payments").select("paid_amount").eq("loan_id", tx.loan_id);
  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.paid_amount), 0) || 0;
  const outstandingBalance = Math.max(0, Number(loan.total_payable || 0) - totalPaid);

  const amount = Number(tx.amount).toLocaleString();
  const balance = outstandingBalance.toLocaleString();
  const message = `Dear ${firstName},\nWe have received your payment of KES ${amount}.\nYour outstanding loan balance is KES ${balance}.\nThank you for being our valued customer.`;

  const { data: smsConfig, error: cfgErr } = await db
    .from("tenant_sms_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (cfgErr || !smsConfig) throw new Error(`SMS config missing for tenant ${tenantId}`);

  const apiKey = smsConfig.api_key.trim();
  const partnerId = smsConfig.partner_id.trim();
  const shortcode = smsConfig.shortcode.trim();
  const baseUrl = smsConfig.base_url.trim().replace(/\/+$/, "");

  const encodedMsg = encodeURIComponent(message.trim());
  const url = `${baseUrl}/?apikey=${apiKey}&partnerID=${partnerId}&message=${encodedMsg}&shortcode=${shortcode}&mobile=${customerMobile}`;

  const response = await fetch(url);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`SMS send failed (${response.status}): ${errText.substring(0, 100)}`);
  }

  await db.from("sms_logs").insert({
    customer_id: customerId || null,
    recipient_phone: customerMobile,
    message,
    status: "sent",
    message_id: `sms-c2b-${Date.now()}`,
    tenant_id: tenantId,
    sender_id: shortcode,
    created_at: new Date().toISOString(),
  });

  await db.from("mpesa_c2b_transactions").update({ payment_sms_sent: true }).eq("id", tx.id);
  console.log(`[SMS] Successfully sent for transaction ${transactionId}`);
}

// ═══════════════════════════════════════════════════════════════════
// insertFeePayment – writes to loan_fees_log, NOT loan_payments.
// ─ Call this ONLY from fee handlers (registration, processing).
// ─ This keeps fee records completely separate from loan_repayment.
// ═══════════════════════════════════════════════════════════════════
async function insertFeePayment(
  db: SupabaseClient,
  opts: {
    loanId: string | number;
    amount: number;
    type: string;
    description: string;
    receipt: string;
    tenantId: string;
    customerId: string;
  }
) {
  const { error } = await db.from("loan_fees_log").insert({
    loan_id: opts.loanId,
    paid_amount: opts.amount,
    fee_type: opts.type,
    description: opts.description,
    mpesa_receipt: opts.receipt,
    payment_method: "mpesa_c2b",
    tenant_id: opts.tenantId,
    customer_id: opts.customerId,
    created_at: new Date().toISOString(),
  });
  // FALLBACK: if loan_fees_log doesn't exist yet, write to loan_payments
  // with a clear fee marker so it can be excluded from repayment queries.
  if (error) {
    console.warn(`[FeePayment] loan_fees_log insert failed (${error.message}), falling back to loan_payments with fee marker`);
    const { error: fallbackErr } = await db.from("loan_payments").insert({
      loan_id: opts.loanId,
      paid_amount: opts.amount,
      payment_type: opts.type,           // "registration" | "processing"
      description: opts.description,
      mpesa_receipt: opts.receipt,
      payment_method: "mpesa_c2b",
      tenant_id: opts.tenantId,
      payer_reference_id: opts.customerId,
      payer_type: "customer",
      is_fee: true,                       // ← flag: exclude from repayment sums
      penalty_paid: 0,
      interest_paid: 0,
      principal_paid: 0,
    });
    if (fallbackErr) throw new Error(`Fee payment insert failed: ${fallbackErr.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// deductPendingFeesFromWallet
// ─ Debits registration/processing fees from wallet balance.
// ─ Records in loan_fees_log (NOT loan_payments).
// ═══════════════════════════════════════════════════════════════════
async function deductPendingFeesFromWallet(
  db: SupabaseClient,
  tenantId: string,
  customerId: string,
  reference: string
): Promise<{ registrationDeducted: number; processingDeducted: number }> {
  console.log(`[FeeDeduction] Checking for pending fees for customer ${customerId}`);

  const { data: loan, error: loanErr } = await db
    .from("loans")
    .select("id, registration_fee, processing_fee, registration_fee_paid, processing_fee_paid")
    .eq("customer_id", customerId)
    .eq("tenant_id", tenantId)
    .not("status", "in", '("disbursed","rejected")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (loanErr) {
    console.error(`[FeeDeduction] Error fetching loan: ${loanErr.message}`);
    return { registrationDeducted: 0, processingDeducted: 0 };
  }
  if (!loan) {
    console.log(`[FeeDeduction] No undisbursed loan found for customer ${customerId}`);
    return { registrationDeducted: 0, processingDeducted: 0 };
  }

  const { data: customer, error: custErr } = await db
    .from("customers")
    .select("is_new_customer")
    .eq("id", customerId)
    .single();
  if (custErr) {
    console.error(`[FeeDeduction] Error fetching customer: ${custErr.message}`);
    return { registrationDeducted: 0, processingDeducted: 0 };
  }

  let registrationDeducted = 0;
  let processingDeducted = 0;

  const registrationFee = parseFloat(String(loan.registration_fee ?? 0));
  if (customer.is_new_customer === true && !loan.registration_fee_paid && registrationFee > 0) {
    const balance = await getWalletBalance(db, tenantId, customerId);
    if (balance >= registrationFee) {
      await walletDebit(db, tenantId, customerId, registrationFee, "Registration fee deducted from wallet", reference, "registration");
      await insertFeePayment(db, {
        loanId: loan.id,
        amount: registrationFee,
        type: "registration",
        description: "Registration Fee (auto-deducted from wallet)",
        receipt: reference,
        tenantId,
        customerId,
      });
      await db.from("loans").update({ registration_fee_paid: true }).eq("id", loan.id);
      await db.from("customers").update({ registration_fee_paid: true, is_new_customer: false }).eq("id", customerId);
      registrationDeducted = registrationFee;
      console.log(`[FeeDeduction] Deducted registration fee KES ${registrationFee}`);
    } else {
      console.log(`[FeeDeduction] Insufficient wallet (${balance}) for registration fee KES ${registrationFee}`);
    }
  }

  const processingFee = parseFloat(String(loan.processing_fee ?? 0));
  if (!loan.processing_fee_paid && processingFee > 0) {
    const balance = await getWalletBalance(db, tenantId, customerId);
    if (balance >= processingFee) {
      await walletDebit(db, tenantId, customerId, processingFee, "Processing fee deducted from wallet", reference, "processing");
      await insertFeePayment(db, {
        loanId: loan.id,
        amount: processingFee,
        type: "processing",
        description: "Processing Fee (auto-deducted from wallet)",
        receipt: reference,
        tenantId,
        customerId,
      });
      await db.from("loans").update({ processing_fee_paid: true }).eq("id", loan.id);
      processingDeducted = processingFee;
      console.log(`[FeeDeduction] Deducted processing fee KES ${processingFee}`);
    } else {
      console.log(`[FeeDeduction] Insufficient wallet (${balance}) for processing fee KES ${processingFee}`);
    }
  }

  return { registrationDeducted, processingDeducted };
}

// ═══════════════════════════════════════════════════════════════════
// Wallet helpers
// ═══════════════════════════════════════════════════════════════════
async function walletDebit(
  db: SupabaseClient,
  tenantId: string,
  customerId: string,
  amount: number,
  narration: string,
  reference: string,
  refType: string
) {
  const customerIdNum = typeof customerId === "string" ? parseInt(customerId, 10) : customerId;
  if (isNaN(customerIdNum)) throw new Error(`Invalid customer_id: ${customerId}`);

  const { error } = await db.from("customer_wallets").insert({
    customer_id: customerIdNum,
    tenant_id: tenantId,
    amount,
    credit: null,
    debit: amount,
    type: "debit",
    transaction_type: refType,
    narration,
    mpesa_reference: reference,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Wallet debit failed: ${error.message}`);
}

async function walletCredit(
  db: SupabaseClient,
  tenantId: string,
  customerId: string,
  amount: number,
  narration: string,
  reference: string,
  refType: string
) {
  const customerIdNum = typeof customerId === "string" ? parseInt(customerId, 10) : customerId;
  if (isNaN(customerIdNum)) throw new Error(`Invalid customer_id: ${customerId}`);

  const { error } = await db.from("customer_wallets").insert({
    customer_id: customerIdNum,
    tenant_id: tenantId,
    amount,
    credit: amount,
    debit: null,
    type: "credit",
    transaction_type: refType,
    narration,
    mpesa_reference: reference,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Wallet credit failed: ${error.message}`);
}

async function getWalletBalance(db: SupabaseClient, tenantId: string, customerId: string): Promise<number> {
  const { data, error } = await db
    .from("customer_wallets")
    .select("credit, debit")
    .eq("customer_id", customerId)
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data ?? []).reduce((acc, row) => acc + (row.credit || 0) - (row.debit || 0), 0);
}

// ═══════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════
async function moveToSuspense(db: SupabaseClient, tx: Transaction, reason: string) {
  console.log(`Moving ${tx.transaction_id} to suspense: ${reason}`);
  await db.from("suspense_transactions").upsert(
    {
      tenant_id: tx.tenant_id ?? null,
      payer_name: tx.firstname?.trim() ?? "Unknown",
      phone_number: tx.phone_number,
      amount: tx.amount,
      transaction_id: tx.transaction_id,
      transaction_time: tx.transaction_time ?? new Date().toISOString(),
      billref: tx.billref,
      status: "suspense",
      reason,
    },
    { onConflict: "transaction_id" }
  );
  await db.from("mpesa_c2b_transactions").update({ status: "suspense" }).eq("transaction_id", tx.transaction_id);
}

function parseIntent(billref: string | null): PaymentIntent {
  if (!billref) return { type: "repayment" };
  const ref = billref.trim().toLowerCase();
  if (ref === "registration_fee") return { type: "registration" };
  if (ref.startsWith("registration-")) return { type: "registration", customerId: ref.split("-")[1] };
  if (ref.startsWith("processing-")) return { type: "processing", loanId: ref.split("-").slice(1).join("-") };
  return { type: "repayment", accountRef: billref.trim() };
}

async function resolveTenantFromPhone(db: SupabaseClient, phone: string | null): Promise<string | null> {
  if (!phone) return null;
  const formats = normalizePhone(phone);
  const { data } = await db.from("customers").select("tenant_id").in("mobile", formats).limit(1).maybeSingle();
  return data?.tenant_id ?? null;
}

async function resolveCustomer(
  db: SupabaseClient,
  phone: string,
  intent: PaymentIntent,
  tenantId: string
): Promise<Customer | null> {
  if (intent.type === "repayment" && intent.accountRef) {
    const { data } = await db
      .from("customers")
      .select("id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer")
      .eq("id_number", intent.accountRef)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (data) return data as Customer;
  }
  if (intent.customerId) {
    const { data } = await db
      .from("customers")
      .select("id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer")
      .eq("id", intent.customerId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (data) return data as Customer;
  }
  const formats = normalizePhone(phone);
  if (formats.length) {
    const { data } = await db
      .from("customers")
      .select("id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer")
      .in("mobile", formats)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (data) return data as Customer;
  }
  return null;
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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ═══════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════
interface Transaction {
  transaction_id: string;
  phone_number: string;
  amount: string | number;
  billref: string | null;
  firstname: string | null;
  transaction_time: string | null;
  tenant_id: string | null;
  retry_count?: number;
}

interface Customer {
  id: string;
  Firstname: string;
  Surname: string;
  mobile: string;
  id_number: string | null;
  tenant_id: string;
  is_new_customer: boolean | null;
}

interface PaymentIntent {
  type: "repayment" | "registration" | "processing";
  accountRef?: string;
  customerId?: string;
  loanId?: string;
}

interface AllocationContext {
  inst: any;
  loanId: number | string;
  tenantId: string;
  customerId: string;
  available: number;
  transactionId: string;
  phoneNumber: string | null;
}

interface ProcessResult {
  transaction_id: string;
  status: "applied" | "skipped" | "suspense" | "error";
  result?: string;
  reason?: string;
  error?: string;
}

// Stub – implement if you have a handleAutoRepay job handler
async function handleAutoRepay(db: SupabaseClient, job: any) {
  const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
  await handleAutoRepayByCustomer(db, payload.customer_id, payload.tenant_id);
}

// Stub – implement if you have a handleSmsJob queue handler
async function handleSmsJob(db: SupabaseClient, job: any) {
  const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
  await handlePaymentSms(db, payload.transaction_id, payload.tenant_id);
}





























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

const C2B_JOB_TYPES = ["c2b_repayment", "registration", "processing_fee", "send_sms", "auto_repay"];

// ----------------------------------------------------------------------
// CORE: process pending transactions
// ----------------------------------------------------------------------
async function processPending(db: SupabaseClient, workerId: string, tenantId?: string, limit = 50) {
  console.log(`[${workerId}] Scanning pending C2B transactions...`);
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

  const succeeded = results.filter((r) => r.status === "applied").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "error").length;

  console.log(`[${workerId}] Done. applied=${succeeded} skipped=${skipped} failed=${failed}`);
  return { workerId, total: results.length, succeeded, skipped, failed, results };
}

async function processSingle(db: SupabaseClient, workerId: string, transactionId: string) {
  console.log(`[${workerId}] Processing single: ${transactionId}`);
  const result = await processOneTransaction(db, workerId, transactionId);
  return { workerId, ...result };
}

async function processQueue(db: SupabaseClient, workerId: string, tenantId?: string) {
  console.log(`[${workerId}] Draining C2B payment queue...`);
  let processed = 0, failed = 0;

  while (true) {
    const { data: job, error: claimErr } = await db
      .rpc("claim_queue_job", { p_worker_id: workerId, p_job_types: C2B_JOB_TYPES });
    if (claimErr || !job?.id) break;

    if (tenantId && job.tenant_id !== tenantId) {
      await db.from("payment_queue").update({ status: "queued", claimed_at: null, claimed_by: null }).eq("id", job.id);
      continue;
    }

    const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
    const jobType = job.job_type;

    try {
      if (jobType === "send_sms") {
        await handleSmsJob(db, job);
        await db.from("payment_queue").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
        processed++;
      } else if (jobType === "auto_repay") {
        await handleAutoRepay(db, job);
        await db.from("payment_queue").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", job.id);
        processed++;
      } else {
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

  console.log(`[${workerId}] C2B queue drained. processed=${processed} failed=${failed}`);
  return { workerId, processed, failed };
}

async function recoverStuck(db: SupabaseClient) {
  const { data, error } = await db.rpc("recover_stuck_queue_jobs");
  if (error) throw new Error(`Recovery failed: ${error.message}`);
  console.log(`Recovered ${data} stuck jobs`);
  return { recovered: data ?? 0 };
}

// ----------------------------------------------------------------------
// processOneTransaction – main dispatcher
// ----------------------------------------------------------------------
async function processOneTransaction(
  db: SupabaseClient,
  workerId: string,
  transactionId: string
): Promise<ProcessResult> {
  try {
    const { data: tx, error: claimErr } = await db
      .rpc("claim_c2b_transaction", {
        p_transaction_id: transactionId,
        p_worker_id: workerId,
      });

    if (claimErr || !tx) {
      console.log(`[${workerId}] ${transactionId}: already claimed or not found — skipping`);
      return { transaction_id: transactionId, status: "skipped", reason: "already_claimed_or_not_found" };
    }

    const { phone_number, amount, billref, transaction_time, tenant_id } = tx;

    const tenantId = tenant_id ?? (await resolveTenantFromPhone(db, phone_number));
    if (!tenantId) {
      await moveToSuspense(db, tx, "Could not resolve tenant");
      return { transaction_id: transactionId, status: "suspense", reason: "tenant_not_resolved" };
    }

    console.log(`[${workerId}] ${transactionId}: tenant=${tenantId} billref=${billref} amount=${amount}`);

    const intent = parseIntent(billref);
    console.log(`[${workerId}] Intent: ${intent.type}`);

    const customer = await resolveCustomer(db, phone_number, intent, tenantId);
    if (!customer) {
      await moveToSuspense(db, tx, "Customer not found in system");
      return { transaction_id: transactionId, status: "suspense", reason: "customer_not_found" };
    }

    let result: string;
    let loanId: string | number | null = null;

    if (intent.type === "registration") {
      const handlerResult = await handleRegistration(db, tx, customer, tenantId, intent);
      result = handlerResult.result;
      loanId = handlerResult.loanId ?? null;
    } else if (intent.type === "processing") {
      const handlerResult = await handleProcessingFee(db, tx, customer, tenantId, intent);
      result = handlerResult.result;
      loanId = handlerResult.loanId ?? null;
    } else {
      const handlerResult = await handleRepayment(db, tx, customer, tenantId, parseFloat(String(amount)));
      result = handlerResult.result;
      loanId = handlerResult.loanId;
    }

    const updateData: Record<string, unknown> = {
      status: "applied",
      description: result,
      customer_id: customer.id,
    };
    if (loanId != null) {
      updateData.loan_id = loanId;
      console.log(`[${workerId}] Setting loan_id=${loanId} for transaction ${transactionId}`);
    }

    const { error: updateError } = await db
      .from("mpesa_c2b_transactions")
      .update(updateData)
      .eq("transaction_id", transactionId);

    if (updateError) throw new Error(`Failed to update transaction status: ${updateError.message}`);

    console.log(`[${workerId}] ${transactionId}: applied — ${result}`);

    // SMS only for actual repayments to an active loan
    if (intent.type === "repayment" && loanId != null) {
      handlePaymentSms(db, transactionId, tenantId).catch((smsErr) => {
        console.error(`[${workerId}] SMS failed for ${transactionId}:`, smsErr.message);
      });
    }

    // Auto-repay: drain wallet into loan if there's an active loan
    if (intent.type === "repayment") {
      Promise.resolve().then(() => {
        handleAutoRepayByCustomer(db, customer.id, tenantId).catch((err) => {
          console.error(`[${workerId}] Auto-repay failed for customer ${customer.id}:`, err.message);
        });
      });
    }

    return { transaction_id: transactionId, status: "applied", result };
  } catch (err) {
    console.error(`[${workerId}] ${transactionId}: ERROR — ${err.message}`);
    await db
      .from("mpesa_c2b_transactions")
      .update({ status: "failed", last_error: err.message })
      .eq("transaction_id", transactionId)
      .eq("status", "processing");
    return { transaction_id: transactionId, status: "error", error: err.message };
  }
}

// ----------------------------------------------------------------------
// HANDLER: Registration Fee (dedicated M-Pesa payment)
// ----------------------------------------------------------------------
async function handleRegistration(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  intent: PaymentIntent
): Promise<{ result: string; loanId?: string | number }> {
  const { transaction_id, amount } = tx;
  const paidAmount = parseFloat(String(amount));

  console.log(`Registration fee: customer=${customer.id} new=${customer.is_new_customer}`);

  // Fetch the latest pending loan (not yet disbursed or rejected)
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
    // No pending loan – park in wallet as credit
    await walletCredit(db, tenantId, customer.id, paidAmount, "Registration fee received (no active loan)", transaction_id, "registration");
    return { result: "No pending loan – funds credited to wallet" };
  }

  let remaining = paidAmount;
  let feesDeducted = 0;

  const isNewCustomer = customer.is_new_customer !== false;
  const registrationFee = parseFloat(String(loan.registration_fee ?? 0));
  const processingFee = parseFloat(String(loan.processing_fee ?? 0));

  // --- Registration fee (only for new customers, only once) ---
  if (isNewCustomer && !loan.registration_fee_paid && registrationFee > 0) {
    if (remaining < registrationFee) {
      await walletCredit(db, tenantId, customer.id, remaining, "Insufficient funds for registration fee", transaction_id, "registration");
      return { result: `Insufficient payment (KES ${paidAmount}) for registration fee of KES ${registrationFee} – funds credited to wallet` };
    }
    remaining -= registrationFee;
    feesDeducted += registrationFee;
    await insertFeePayment(db, {
      loanId: loan.id,
      amount: registrationFee,
      type: "registration",
      description: "Registration Fee Paid",
      receipt: transaction_id,
      tenantId,
      customerId: customer.id,
    });
    await db.from("customers").update({ registration_fee_paid: true, is_new_customer: false }).eq("id", customer.id);
    await db.from("loans").update({ registration_fee_paid: true }).eq("id", loan.id);
  }

  // --- Processing fee (if not yet paid and remaining balance covers it) ---
  if (!loan.processing_fee_paid && processingFee > 0 && remaining >= processingFee) {
    remaining -= processingFee;
    feesDeducted += processingFee;
    await insertFeePayment(db, {
      loanId: loan.id,
      amount: processingFee,
      type: "processing",
      description: "Loan Processing Fee Paid",
      receipt: transaction_id,
      tenantId,
      customerId: customer.id,
    });
    await db.from("loans").update({ processing_fee_paid: true }).eq("id", loan.id);
  }

  // Excess goes to wallet (cannot be used for loan repayment until a future repayment transaction)
  if (remaining > 0.005) {
    await walletCredit(db, tenantId, customer.id, remaining, "Excess payment credited to wallet", transaction_id, "fee_excess");
  }

  const result = `KES ${feesDeducted} in fees paid${remaining > 0.005 ? `, KES ${remaining.toFixed(2)} credited to wallet` : ""}`;
  return { result, loanId: loan.id };
}

// ----------------------------------------------------------------------
// HANDLER: Processing Fee (dedicated M-Pesa payment for a specific loan)
// ----------------------------------------------------------------------
async function handleProcessingFee(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  intent: PaymentIntent
): Promise<{ result: string; loanId: string | number }> {
  const { transaction_id, amount } = tx;
  const loanId = intent.loanId!;
  const paidAmount = parseFloat(String(amount));

  const { data: loan } = await db
    .from("loans")
    .select("id, processing_fee, processing_fee_paid")
    .eq("id", loanId)
    .eq("tenant_id", tenantId)
    .single();

  if (!loan) throw new Error(`Loan ${loanId} not found`);
  if (loan.processing_fee_paid) return { result: "Processing fee already paid", loanId };

  const fee = parseFloat(String(loan.processing_fee ?? 0));

  if (paidAmount < fee) {
    await walletCredit(db, tenantId, customer.id, paidAmount, "Insufficient funds for processing fee", transaction_id, "fee");
    return { result: `Insufficient payment (KES ${paidAmount}) for processing fee of KES ${fee} – funds credited to wallet`, loanId };
  }

  await insertFeePayment(db, {
    loanId,
    amount: fee,
    type: "processing",
    description: "Loan Processing Fee Paid",
    receipt: transaction_id,
    tenantId,
    customerId: customer.id,
  });
  await db.from("loans").update({ processing_fee_paid: true }).eq("id", loanId);

  const excess = paidAmount - fee;
  if (excess > 0.005) {
    await walletCredit(db, tenantId, customer.id, excess, "Excess payment credited to wallet", transaction_id, "fee_excess");
  }

  const result = `Processing fee of KES ${fee} paid${excess > 0.005 ? `, KES ${excess.toFixed(2)} credited to wallet` : ""}`;
  return { result, loanId };
}

// ----------------------------------------------------------------------
// HANDLER: Loan Repayment (only this handler writes to loan_payments)
// ----------------------------------------------------------------------
async function handleRepayment(
  db: SupabaseClient,
  tx: Transaction,
  customer: Customer,
  tenantId: string,
  mpesaAmount: number
): Promise<{ result: string; loanId: string | number | null }> {
  const { transaction_id, phone_number } = tx;
  const customerId = customer.id;

  // Clear any pending fees from wallet before applying to loan
  await deductPendingFeesFromWallet(db, tenantId, customerId, transaction_id);

  // Find the oldest active loan (disbursed and not fully repaid)
  const { data: loan } = await db
    .from("loans")
    .select("id, repayment_state")
    .eq("customer_id", customerId)
    .eq("tenant_id", tenantId)
    .eq("status", "disbursed")
    .in("repayment_state", ["ongoing", "partial", "overdue"])
    .order("disbursed_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!loan) {
    // No active loan – park the entire M-Pesa amount in wallet
    await walletCredit(db, tenantId, customerId, mpesaAmount, "Payment received (no active loan)", transaction_id, "mpesa");
    return { result: `No active loan – KES ${mpesaAmount} credited to wallet`, loanId: null };
  }

  const loanId = loan.id;

  // Drain wallet funds that are eligible for loan repayment (excludes fee_excess, registration, processing)
  const { data: drained, error: drainErr } = await db
    .rpc("drain_wallet_for_repayment", {
      p_tenant_id: tenantId,
      p_customer_id: customerId,
      p_reference: transaction_id,
    });

  if (drainErr) throw new Error(`Wallet drain failed: ${drainErr.message}`);

  const walletDrained = parseFloat(String(drained ?? 0));
  let remaining = mpesaAmount + walletDrained;

  console.log(`Loan ${loanId}: mpesa=${mpesaAmount} wallet=${walletDrained} total=${remaining}`);

  // Fetch unpaid installments in order
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
      inst,
      loanId,
      tenantId,
      customerId,
      available: remaining,
      transactionId: transaction_id,
      phoneNumber: phone_number,
    });
    remaining -= applied;
    totalApplied += applied;
  }

  // Any leftover after all installments becomes overpayment (stays in wallet)
  if (remaining > 0.005) {
    await walletCredit(db, tenantId, customerId, remaining, `Overpayment on loan #${loanId}`, transaction_id, "overpayment");
  }

  const result = `KES ${totalApplied.toFixed(2)} applied to loan #${loanId}${
    walletDrained > 0 ? ` (incl. KES ${walletDrained} from wallet)` : ""
  }${remaining > 0.005 ? `, KES ${remaining.toFixed(2)} overpayment credited to wallet` : ""}`;
  return { result, loanId };
}

// ----------------------------------------------------------------------
// ALLOCATOR: Apply payment to a single installment (Penalty → Interest → Principal)
// ----------------------------------------------------------------------
async function allocateInstallment(db: SupabaseClient, ctx: AllocationContext): Promise<number> {
  const { inst, loanId, tenantId, customerId, available, transactionId, phoneNumber } = ctx;

  const penaltyDue = parseFloat(inst.net_penalty ?? inst.penalty_amount ?? 0);
  const interestDue = parseFloat(inst.interest_amount ?? 0);
  const principalDue = parseFloat(inst.principal_amount ?? 0);
  const interestPaid = parseFloat(inst.interest_paid ?? 0);
  const principalPaid = parseFloat(inst.principal_paid ?? 0);

  // Penalty might be split across multiple payments, so sum all penalties paid
  const { data: paidRows } = await db
    .from("loan_payments")
    .select("penalty_paid")
    .eq("installment_id", inst.id);
  const penaltyPaid = (paidRows ?? []).reduce((s, r) => s + parseFloat(r.penalty_paid ?? 0), 0);

  const unpaidPenalty = Math.max(0, penaltyDue - penaltyPaid);
  const unpaidInterest = Math.max(0, interestDue - interestPaid);
  const unpaidPrincipal = Math.max(0, principalDue - principalPaid);
  const totalUnpaid = unpaidPenalty + unpaidInterest + unpaidPrincipal;

  if (totalUnpaid <= 0) return 0;

  type PaymentBucket = {
    type: string;
    amount: number;
    penaltyPaid: number;
    interestPaid: number;
    principalPaid: number;
  };
  const buckets: PaymentBucket[] = [];
  let budget = available;
  let applied = 0;

  if (budget > 0 && unpaidPenalty > 0) {
    const pay = Math.min(budget, unpaidPenalty);
    buckets.push({ type: "penalty", amount: pay, penaltyPaid: pay, interestPaid: 0, principalPaid: 0 });
    budget -= pay;
    applied += pay;
  }
  if (budget > 0 && unpaidInterest > 0) {
    const pay = Math.min(budget, unpaidInterest);
    buckets.push({ type: "interest", amount: pay, penaltyPaid: 0, interestPaid: pay, principalPaid: 0 });
    budget -= pay;
    applied += pay;
  }
  if (budget > 0 && unpaidPrincipal > 0) {
    const pay = Math.min(budget, unpaidPrincipal);
    buckets.push({ type: "principal", amount: pay, penaltyPaid: 0, interestPaid: 0, principalPaid: pay });
    budget -= pay;
    applied += pay;
  }

  if (buckets.length === 0) return 0;

  let balanceBefore = totalUnpaid;
  for (const b of buckets) {
    const balanceAfter = balanceBefore - b.amount;
    const { error: payErr } = await db.from("loan_payments").insert({
      loan_id: loanId,
      installment_id: inst.id,
      paid_amount: b.amount,
      payment_type: b.type,
      description: `${capitalize(b.type)} Repayment`,
      mpesa_receipt: transactionId,
      phone_number: phoneNumber,
      payment_method: "mpesa_c2b",
      tenant_id: tenantId,
      payer_reference_id: customerId,
      payer_type: "customer",
      penalty_paid: b.penaltyPaid,
      interest_paid: b.interestPaid,
      principal_paid: b.principalPaid,
      balanceBefore: balanceBefore,
      balance_after: balanceAfter,
    });
    if (payErr) throw new Error(`loan_payments insert failed (${b.type}): ${payErr.message}`);
    balanceBefore = balanceAfter;
  }

  const newInterestPaid = interestPaid + (buckets.find((b) => b.type === "interest")?.amount ?? 0);
  const newPrincipalPaid = principalPaid + (buckets.find((b) => b.type === "principal")?.amount ?? 0);
  const newPenaltyPaid = penaltyPaid + (buckets.find((b) => b.type === "penalty")?.amount ?? 0);
  const newTotalPaid = newInterestPaid + newPrincipalPaid + newPenaltyPaid;
  const totalDue = interestDue + principalDue + penaltyDue;
  const newStatus = newTotalPaid >= totalDue - 0.005 ? "paid" : applied > 0 ? "partial" : inst.status;

  const { error: updateErr } = await db
    .from("loan_installments")
    .update({
      interest_paid: newInterestPaid,
      principal_paid: newPrincipalPaid,
      paid_amount: newTotalPaid,
      status: newStatus,
    })
    .eq("id", inst.id);
  if (updateErr) throw new Error(`Installment update failed: ${updateErr.message}`);

  console.log(`  Installment #${inst.installment_number}: applied=${applied.toFixed(2)} status=${newStatus}`);
  return applied;
}

// ----------------------------------------------------------------------
// AUTO-REPAY: called after any wallet credit (but not from fee handlers)
// ----------------------------------------------------------------------
async function handleAutoRepayByCustomer(db: SupabaseClient, customerId: string, tenantId: string) {
  try {
    // First, use any wallet balance to pay pending fees
    await deductPendingFeesFromWallet(db, tenantId, customerId, "auto-repay-trigger");

    const balance = await getWalletBalance(db, tenantId, customerId);
    console.log(`[AutoRepay] Wallet balance after fee deductions: ${balance}`);
    if (balance <= 0) {
      console.log(`[AutoRepay] Wallet balance is zero – nothing to apply`);
      return;
    }

    // Find active loan
    const { data: loan } = await db
      .from("loans")
      .select("id, repayment_state")
      .eq("customer_id", customerId)
      .eq("tenant_id", tenantId)
      .eq("status", "disbursed")
      .in("repayment_state", ["ongoing", "partial", "overdue"])
      .order("disbursed_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!loan) {
      console.log(`[AutoRepay] No active loan – nothing to apply`);
      return;
    }

    console.log(`[AutoRepay] Active loan found: ${loan.id}`);

    const autoRef = `auto-${Date.now()}`;
    const { data: drained, error: drainErr } = await db
      .rpc("drain_wallet_for_repayment", {
        p_tenant_id: tenantId,
        p_customer_id: customerId,
        p_reference: autoRef,
      });

    if (drainErr) throw new Error(`Wallet drain failed: ${drainErr.message}`);

    const walletDrained = parseFloat(String(drained ?? 0));
    console.log(`[AutoRepay] Drained KES ${walletDrained} from wallet`);

    if (walletDrained <= 0) {
      console.log(`[AutoRepay] Nothing drained – probably only fee balances remain`);
      return;
    }

    const loanId = loan.id;
    let remaining = walletDrained;
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
        inst,
        loanId,
        tenantId,
        customerId,
        available: remaining,
        transactionId: autoRef,
        phoneNumber: null,
      });
      remaining -= applied;
      totalApplied += applied;
    }

    if (remaining > 0.005) {
      await walletCredit(db, tenantId, customerId, remaining, `Auto-repay overpayment on loan #${loanId}`, autoRef, "overpayment");
    }

    console.log(`[AutoRepay] Completed: total applied KES ${totalApplied} to loan #${loanId}`);
  } catch (err) {
    console.error(`[AutoRepay] Unhandled error: ${err.message}`);
    throw err;
  }
}

// ----------------------------------------------------------------------
// FEE HELPERS (exclusive use of loan_fees_log)
// ----------------------------------------------------------------------
async function insertFeePayment(
  db: SupabaseClient,
  opts: {
    loanId: string | number;
    amount: number;
    type: string;
    description: string;
    receipt: string;
    tenantId: string;
    customerId: string;
  }
) {
  // Write only to loan_fees_log – no fallback to loan_payments
  const { error } = await db.from("loan_fees_log").insert({
    loan_id: opts.loanId,
    paid_amount: opts.amount,
    fee_type: opts.type,
    description: opts.description,
    mpesa_receipt: opts.receipt,
    payment_method: "mpesa_c2b",
    tenant_id: opts.tenantId,
    customer_id: opts.customerId,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Fee payment insert failed: ${error.message}`);
}

// ----------------------------------------------------------------------
// deductPendingFeesFromWallet – uses wallet balance to pay outstanding fees
// ----------------------------------------------------------------------
async function deductPendingFeesFromWallet(
  db: SupabaseClient,
  tenantId: string,
  customerId: string,
  reference: string
): Promise<{ registrationDeducted: number; processingDeducted: number }> {
  console.log(`[FeeDeduction] Checking for pending fees for customer ${customerId}`);

  const { data: loan, error: loanErr } = await db
    .from("loans")
    .select("id, registration_fee, processing_fee, registration_fee_paid, processing_fee_paid")
    .eq("customer_id", customerId)
    .eq("tenant_id", tenantId)
    .not("status", "in", '("disbursed","rejected")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (loanErr) {
    console.error(`[FeeDeduction] Error fetching loan: ${loanErr.message}`);
    return { registrationDeducted: 0, processingDeducted: 0 };
  }
  if (!loan) {
    console.log(`[FeeDeduction] No undisbursed loan found for customer ${customerId}`);
    return { registrationDeducted: 0, processingDeducted: 0 };
  }

  const { data: customer, error: custErr } = await db
    .from("customers")
    .select("is_new_customer")
    .eq("id", customerId)
    .single();
  if (custErr) {
    console.error(`[FeeDeduction] Error fetching customer: ${custErr.message}`);
    return { registrationDeducted: 0, processingDeducted: 0 };
  }

  let registrationDeducted = 0;
  let processingDeducted = 0;

  const registrationFee = parseFloat(String(loan.registration_fee ?? 0));
  if (customer.is_new_customer === true && !loan.registration_fee_paid && registrationFee > 0) {
    const balance = await getWalletBalance(db, tenantId, customerId);
    if (balance >= registrationFee) {
      await walletDebit(db, tenantId, customerId, registrationFee, "Registration Fee Payment", reference, "registration");
      await insertFeePayment(db, {
        loanId: loan.id,
        amount: registrationFee,
        type: "registration",
        description: "Registration Fee Paid (auto-deducted from wallet)",
        receipt: reference,
        tenantId,
        customerId,
      });
      await db.from("loans").update({ registration_fee_paid: true }).eq("id", loan.id);
      await db.from("customers").update({ registration_fee_paid: true, is_new_customer: false }).eq("id", customerId);
      registrationDeducted = registrationFee;
      console.log(`[FeeDeduction] Deducted registration fee KES ${registrationFee}`);
    } else {
      console.log(`[FeeDeduction] Insufficient wallet (${balance}) for registration fee KES ${registrationFee}`);
    }
  }

  const processingFee = parseFloat(String(loan.processing_fee ?? 0));
  if (!loan.processing_fee_paid && processingFee > 0) {
    const balance = await getWalletBalance(db, tenantId, customerId);
    if (balance >= processingFee) {
      await walletDebit(db, tenantId, customerId, processingFee, "Processing Fee Payment", reference, "processing");
      await insertFeePayment(db, {
        loanId: loan.id,
        amount: processingFee,
        type: "processing",
        description: "Processing Fee Paid (auto-deducted from wallet)",
        receipt: reference,
        tenantId,
        customerId,
      });
      await db.from("loans").update({ processing_fee_paid: true }).eq("id", loan.id);
      processingDeducted = processingFee;
      console.log(`[FeeDeduction] Deducted processing fee KES ${processingFee}`);
    } else {
      console.log(`[FeeDeduction] Insufficient wallet (${balance}) for processing fee KES ${processingFee}`);
    }
  }

  return { registrationDeducted, processingDeducted };
}

// ----------------------------------------------------------------------
// WALLET HELPERS (with professional narration)
// ----------------------------------------------------------------------
async function walletDebit(
  db: SupabaseClient,
  tenantId: string,
  customerId: string,
  amount: number,
  narration: string,
  reference: string,
  refType: string
) {
  const customerIdNum = typeof customerId === "string" ? parseInt(customerId, 10) : customerId;
  if (isNaN(customerIdNum)) throw new Error(`Invalid customer_id: ${customerId}`);

  const { error } = await db.from("customer_wallets").insert({
    customer_id: customerIdNum,
    tenant_id: tenantId,
    amount,
    credit: null,
    debit: amount,
    type: "debit",
    transaction_type: refType,
    narration,
    mpesa_reference: reference,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Wallet debit failed: ${error.message}`);
}

async function walletCredit(
  db: SupabaseClient,
  tenantId: string,
  customerId: string,
  amount: number,
  narration: string,
  reference: string,
  refType: string
) {
  const customerIdNum = typeof customerId === "string" ? parseInt(customerId, 10) : customerId;
  if (isNaN(customerIdNum)) throw new Error(`Invalid customer_id: ${customerId}`);

  const { error } = await db.from("customer_wallets").insert({
    customer_id: customerIdNum,
    tenant_id: tenantId,
    amount,
    credit: amount,
    debit: null,
    type: "credit",
    transaction_type: refType,
    narration,
    mpesa_reference: reference,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Wallet credit failed: ${error.message}`);
}

async function getWalletBalance(db: SupabaseClient, tenantId: string, customerId: string): Promise<number> {
  const { data, error } = await db
    .from("customer_wallets")
    .select("credit, debit")
    .eq("customer_id", customerId)
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data ?? []).reduce((acc, row) => acc + (row.credit || 0) - (row.debit || 0), 0);
}

// ----------------------------------------------------------------------
// UTILITIES (unchanged from original, but included for completeness)
// ----------------------------------------------------------------------
async function handlePaymentSms(db: SupabaseClient, transactionId: string, tenantId: string) {
  console.log(`[SMS] Processing SMS for transaction ${transactionId}, tenant ${tenantId}`);

  // ── 1. Fetch the transaction ───────────────────────────────────────────────
  const { data: tx, error: txErr } = await db
    .from("mpesa_c2b_transactions")
    .select("id, amount, loan_id, customer_id, phone_number, payment_sms_sent, tenant_id")
    .eq("transaction_id", transactionId)
    .eq("tenant_id", tenantId)
    .single();

  if (txErr || !tx) throw new Error(`Transaction not found: ${transactionId}`);

  // Idempotency guard – never send twice
  if (tx.payment_sms_sent) {
    console.log(`[SMS] Already sent for ${transactionId} – skipping`);
    return;
  }

  // ── 2. Guard: no loan means no repayment SMS ───────────────────────────────
  if (!tx.loan_id) {
    console.log(`[SMS] No loan associated – marking sent without SMS`);
    await db
      .from("mpesa_c2b_transactions")
      .update({ payment_sms_sent: true })
      .eq("id", tx.id);
    return;
  }

  // ── 3. Validate that the loan is still active ──────────────────────────────
  const { data: loan, error: loanErr } = await db
    .from("loans")
    .select("status, repayment_state, total_payable")
    .eq("id", tx.loan_id)
    .single();

  if (loanErr || !loan) {
    console.log(`[SMS] Loan not found – marking sent without SMS`);
    await db
      .from("mpesa_c2b_transactions")
      .update({ payment_sms_sent: true })
      .eq("id", tx.id);
    return;
  }

  const isActive =
    loan.status === "disbursed" &&
    ["ongoing", "partial", "overdue"].includes(loan.repayment_state);

  if (!isActive) {
    console.log(`[SMS] Loan not active (${loan.status}/${loan.repayment_state}) – skipping SMS`);
    await db
      .from("mpesa_c2b_transactions")
      .update({ payment_sms_sent: true })
      .eq("id", tx.id);
    return;
  }

  // ── 4. Resolve customer: id → mobile → alternative_mobile ─────────────────
  //
  // Schema note:
  //   customers."Firstname"  → returned as key "Firstname" by PostgREST
  //   customers.mobile       → primary phone
  //   customers.alternative_mobile → secondary phone (FIX: was never checked before)
  //   customers.id           → bigint
  //
  let customerMobile: string | null = null;
  let firstName = "Customer";
  let resolvedCustomerId: number | null =
    tx.customer_id != null ? Number(tx.customer_id) : null;

  if (resolvedCustomerId) {
    const { data: cust } = await db
      .from("customers")
      .select('"Firstname", mobile, alternative_mobile')
      .eq("id", resolvedCustomerId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (cust) {
      // PostgREST returns the quoted column exactly as "Firstname"
      firstName = (cust as any)["Firstname"] || "Customer";
      customerMobile = cust.mobile ?? cust.alternative_mobile ?? null;
    }
  }

  // Fallback: look up by phone number across both mobile columns
  if (!customerMobile && tx.phone_number) {
    const phoneFormats = normalizePhone(tx.phone_number);

    if (phoneFormats.length) {
      // FIX: use .or() to also check alternative_mobile
      const orFilter = phoneFormats
        .map((p) => `mobile.eq.${p},alternative_mobile.eq.${p}`)
        .join(",");

      const { data: custByPhone } = await db
        .from("customers")
        .select('id, "Firstname", mobile, alternative_mobile')
        .or(orFilter)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (custByPhone) {
        resolvedCustomerId = Number(custByPhone.id);
        firstName = (custByPhone as any)["Firstname"] || "Customer";
        // Prefer the primary mobile; fall back to alternative
        customerMobile = custByPhone.mobile ?? custByPhone.alternative_mobile ?? null;
      }
    }
  }

  // Last resort: use the raw M-Pesa phone from the transaction
  if (!customerMobile && tx.phone_number) {
    customerMobile = tx.phone_number;
  }

  // Normalise to 254XXXXXXXXX format required by the SMS gateway
  const formatPhone = (phone: string): string => {
    const cleaned = String(phone).replace(/\D/g, "");
    if (cleaned.startsWith("254") && cleaned.length === 12) return cleaned;
    if (cleaned.startsWith("0") && cleaned.length === 10) return "254" + cleaned.slice(1);
    if (cleaned.length === 9 && /^[71]/.test(cleaned)) return "254" + cleaned;
    return cleaned;
  };

  customerMobile = customerMobile ? formatPhone(customerMobile) : null;

  if (!customerMobile) {
    await db
      .from("mpesa_c2b_transactions")
      .update({ payment_sms_sent: true })
      .eq("id", tx.id);
    throw new Error(`No valid mobile number found for transaction ${transactionId}`);
  }

  // ── 5. Calculate outstanding balance ──────────────────────────────────────
  const { data: payments, error: paymentsErr } = await db
    .from("loan_payments")
    .select("paid_amount")
    .eq("loan_id", tx.loan_id);

  if (paymentsErr) throw new Error(`Failed to fetch loan payments: ${paymentsErr.message}`);

  const totalPaid = (payments ?? []).reduce(
    (sum, p) => sum + Number(p.paid_amount ?? 0),
    0
  );
  const outstandingBalance = Math.max(
    0,
    Number(loan.total_payable ?? 0) - totalPaid
  );

  // ── 6. Build the SMS message ───────────────────────────────────────────────
  const fmt = (n: number) =>
    n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const message =
    `Dear ${firstName},\n` +
    `We have received your payment of KES ${fmt(Number(tx.amount))}.\n` +
    `Your outstanding loan balance is KES ${fmt(outstandingBalance)}.\n` +
    `Thank you for being our valued customer.`;

  // ── 7. Fetch tenant SMS gateway config ────────────────────────────────────
  const { data: smsConfig, error: cfgErr } = await db
    .from("tenant_sms_settings")
    .select("api_key, partner_id, shortcode, base_url")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (cfgErr || !smsConfig) {
    throw new Error(`SMS config missing for tenant ${tenantId}`);
  }

  const apiKey    = smsConfig.api_key.trim();
  const partnerId = smsConfig.partner_id.trim();
  const shortcode = smsConfig.shortcode.trim();
  const baseUrl   = smsConfig.base_url.trim().replace(/\/+$/, "");

  // ── 8. Send the SMS ───────────────────────────────────────────────────────
  const url =
    `${baseUrl}/?apikey=${apiKey}` +
    `&partnerID=${partnerId}` +
    `&message=${encodeURIComponent(message)}` +
    `&shortcode=${shortcode}` +
    `&mobile=${customerMobile}`;

  const response = await fetch(url);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`SMS gateway error (HTTP ${response.status}): ${errText.slice(0, 200)}`);
  }

  // ── 9. Log the SMS and mark transaction as sent ────────────────────────────
  const { error: logErr } = await db.from("sms_logs").insert({
    customer_id: resolvedCustomerId,          // bigint — stored as number, not string
    recipient_phone: customerMobile,
    message,
    status: "sent",
    message_id: `sms-c2b-${transactionId}-${Date.now()}`, // unique per transaction
    tenant_id: tenantId,
    sender_id: shortcode,
    created_at: new Date().toISOString(),
  });

  if (logErr) {
    // Non-fatal: log the error but don't block marking the transaction as sent
    console.error(`[SMS] sms_logs insert failed: ${logErr.message}`);
  }

  await db
    .from("mpesa_c2b_transactions")
    .update({ payment_sms_sent: true })
    .eq("id", tx.id);

  console.log(
    `[SMS] Sent to ${customerMobile} (customer ${resolvedCustomerId}) ` +
    `for transaction ${transactionId}. Balance: KES ${fmt(outstandingBalance)}`
  );
}

async function handleAutoRepay(db: SupabaseClient, job: any) {
  const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
  await handleAutoRepayByCustomer(db, payload.customer_id, payload.tenant_id);
}

async function handleSmsJob(db: SupabaseClient, job: any) {
  const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
  await handlePaymentSms(db, payload.transaction_id, payload.tenant_id);
}

async function moveToSuspense(db: SupabaseClient, tx: Transaction, reason: string) {
  console.log(`Moving ${tx.transaction_id} to suspense: ${reason}`);
  await db.from("suspense_transactions").upsert(
    {
      tenant_id: tx.tenant_id ?? null,
      payer_name: tx.firstname?.trim() ?? "Unknown",
      phone_number: tx.phone_number,
      amount: tx.amount,
      transaction_id: tx.transaction_id,
      transaction_time: tx.transaction_time ?? new Date().toISOString(),
      billref: tx.billref,
      status: "suspense",
      reason,
    },
    { onConflict: "transaction_id" }
  );
  await db.from("mpesa_c2b_transactions").update({ status: "suspense" }).eq("transaction_id", tx.transaction_id);
}

function parseIntent(billref: string | null): PaymentIntent {
  if (!billref) return { type: "repayment" };
  const ref = billref.trim().toLowerCase();
  if (ref === "registration_fee") return { type: "registration" };
  if (ref.startsWith("registration-")) return { type: "registration", customerId: ref.split("-")[1] };
  if (ref.startsWith("processing-")) return { type: "processing", loanId: ref.split("-").slice(1).join("-") };
  return { type: "repayment", accountRef: billref.trim() };
}

async function resolveTenantFromPhone(db: SupabaseClient, phone: string | null): Promise<string | null> {
  if (!phone) return null;
  const formats = normalizePhone(phone);
  const { data } = await db.from("customers").select("tenant_id").in("mobile", formats).limit(1).maybeSingle();
  return data?.tenant_id ?? null;
}

async function resolveCustomer(
  db: SupabaseClient,
  phone: string,
  intent: PaymentIntent,
  tenantId: string
): Promise<Customer | null> {
  if (intent.type === "repayment" && intent.accountRef) {
    const { data } = await db
      .from("customers")
      .select("id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer")
      .eq("id_number", intent.accountRef)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (data) return data as Customer;
  }
  if (intent.customerId) {
    const { data } = await db
      .from("customers")
      .select("id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer")
      .eq("id", intent.customerId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (data) return data as Customer;
  }
  const formats = normalizePhone(phone);
  if (formats.length) {
    const { data } = await db
      .from("customers")
      .select("id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer")
      .in("mobile", formats)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (data) return data as Customer;
  }
  return null;
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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ----------------------------------------------------------------------
// TYPE DEFINITIONS
// ----------------------------------------------------------------------
interface Transaction {
  transaction_id: string;
  phone_number: string;
  amount: string | number;
  billref: string | null;
  firstname: string | null;
  transaction_time: string | null;
  tenant_id: string | null;
  retry_count?: number;
}

interface Customer {
  id: string;
  Firstname: string;
  Surname: string;
  mobile: string;
  id_number: string | null;
  tenant_id: string;
  is_new_customer: boolean | null;
}

interface PaymentIntent {
  type: "repayment" | "registration" | "processing";
  accountRef?: string;
  customerId?: string;
  loanId?: string;
}

interface AllocationContext {
  inst: any;
  loanId: number | string;
  tenantId: string;
  customerId: string;
  available: number;
  transactionId: string;
  phoneNumber: string | null;
}

interface ProcessResult {
  transaction_id: string;
  status: "applied" | "skipped" | "suspense" | "error";
  result?: string;
  reason?: string;
  error?: string;
}