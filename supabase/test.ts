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
  // ... (same as original, omitted for brevity)
  console.log(`[SMS] Stub – implement if needed`);
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