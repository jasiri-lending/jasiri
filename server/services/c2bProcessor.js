import fetch from "node-fetch";
import { supabaseAdmin } from "../supabaseClient.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ service: "c2bProcessor" });

export async function processC2BTransaction(transactionId, overrideTenantId) {
  try {
    const { data: tx, error: claimErr } = await supabaseAdmin
      .rpc("claim_c2b_transaction", {
        p_transaction_id: transactionId,
        p_worker_id: "server-c2b",
      });

    if (claimErr || !tx) {
      log.info({ transactionId }, "Already claimed or not found — skipping");
      return { status: "skipped", reason: "already_claimed_or_not_found" };
    }

    const { phone_number, amount, billref, firstname, transaction_time, tenant_id } = tx;
    const tenantId = tenant_id ?? overrideTenantId ?? (await resolveTenantFromPhone(phone_number));
    
    if (!tenantId) {
      await moveToSuspense(tx, "Could not resolve tenant");
      return { status: "suspense", reason: "tenant_not_resolved" };
    }

    log.info({ transactionId, tenantId, billref, amount }, "Processing C2B Transaction");

    const intent = parseIntent(billref);
    const customer = await resolveCustomer(phone_number, intent, tenantId);

    if (!customer) {
      await moveToSuspense(tx, "Customer not found in system");
      return { status: "suspense", reason: "customer_not_found" };
    }

    let result = "";
    let loanId = null;

    if (intent.type === "registration") {
      const handlerResult = await handleRegistration(tx, customer, tenantId);
      result = handlerResult.result;
      loanId = handlerResult.loanId;
    } else if (intent.type === "processing" && intent.loanId) {
      const handlerResult = await handleProcessingFee(tx, customer, tenantId, intent.loanId);
      result = handlerResult.result;
      loanId = handlerResult.loanId;
    } else {
      const handlerResult = await handleRepayment(tx, customer, tenantId, parseFloat(amount));
      result = handlerResult.result;
      loanId = handlerResult.loanId;
    }

    const updateData = {
      status: "applied",
      description: result,
      customer_id: customer.id,
    };
    
    if (loanId) {
      updateData.loan_id = loanId;
    }

    await supabaseAdmin
      .from("mpesa_c2b_transactions")
      .update(updateData)
      .eq("transaction_id", transactionId);

    log.info({ transactionId, status: "applied", result }, "Transaction applied successfully");

    // Instantly send SMS after applying successfully
    await handlePaymentSms(transactionId, tenantId).catch((smsErr) => {
      log.error({ err: smsErr.message, transactionId }, "Failed to send C2B SMS");
    });

    // Fire auto-repay check if wallet was credited
    setImmediate(() => {
      handleAutoRepay(customer.id, tenantId).catch(err => {
         log.error({ err: err.message, customerId: customer.id }, "Background auto-repay failed");
      });
    });

    return { status: "applied", result };
  } catch (err) {
    log.error({ err: err.message, transactionId }, "C2B processing error");
    await supabaseAdmin
      .from("mpesa_c2b_transactions")
      .update({ status: "failed", last_error: err.message })
      .eq("transaction_id", transactionId)
      .eq("status", "processing"); // Revert from processing to failed
    return { status: "error", error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════

async function handleRegistration(tx, customer, tenantId) {
  const { transaction_id, amount } = tx;
  const paidAmount = parseFloat(amount);

  const { data: loan } = await supabaseAdmin
    .from("loans")
    .select("id, registration_fee, processing_fee, registration_fee_paid, processing_fee_paid")
    .eq("customer_id", customer.id)
    .eq("tenant_id", tenantId)
    .not("status", "in", '("rejected","disbursed")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!loan) {
    await walletCredit(tenantId, customer.id, paidAmount, "Registration fee — no pending loan", transaction_id, "registration");
    return { result: "No pending loan — credited to wallet" };
  }

  let remaining = paidAmount;
  let feesDeducted = 0;

  const isNewCustomer = customer.is_new_customer !== false;
  const registrationFee = parseFloat(loan.registration_fee || 0);
  const processingFee = parseFloat(loan.processing_fee || 0);

  if (isNewCustomer && !loan.registration_fee_paid && registrationFee > 0) {
    if (remaining < registrationFee) {
      await walletCredit(tenantId, customer.id, remaining, "Insufficient for registration fee", transaction_id, "registration");
      return { result: `Insufficient for registration fee (KES ${registrationFee}) — parked in wallet` };
    }
    remaining -= registrationFee;
    feesDeducted += registrationFee;
    await insertLoanPayment({
      loanId: loan.id, amount: registrationFee, type: "registration", description: "Registration Fee", receipt: transaction_id, tenantId, customerId: customer.id
    });
    await supabaseAdmin.from("customers").update({ registration_fee_paid: true, is_new_customer: false }).eq("id", customer.id);
    await supabaseAdmin.from("loans").update({ registration_fee_paid: true }).eq("id", loan.id);
  }

  if (!loan.processing_fee_paid && processingFee > 0 && remaining >= processingFee) {
    remaining -= processingFee;
    feesDeducted += processingFee;
    await insertLoanPayment({
      loanId: loan.id, amount: processingFee, type: "processing", description: "Loan Processing Fee", receipt: transaction_id, tenantId, customerId: customer.id
    });
    await supabaseAdmin.from("loans").update({ processing_fee_paid: true }).eq("id", loan.id);
  }

  if (remaining > 0.005) {
    await walletCredit(tenantId, customer.id, remaining, "Excess after fees", transaction_id, "registration");
  }

  const result = `Fees deducted KES ${feesDeducted}${remaining > 0.005 ? `, KES ${remaining.toFixed(2)} to wallet` : ""}`;
  return { result, loanId: loan.id };
}

async function handleProcessingFee(tx, customer, tenantId, loanId) {
  const { transaction_id, amount } = tx;
  const paidAmount = parseFloat(amount);

  const { data: loan } = await supabaseAdmin
    .from("loans")
    .select("id, processing_fee, processing_fee_paid")
    .eq("id", loanId)
    .eq("tenant_id", tenantId)
    .single();

  if (!loan) throw new Error(`Loan ${loanId} not found`);
  if (loan.processing_fee_paid) return { result: "Processing fee already paid", loanId };

  const fee = parseFloat(loan.processing_fee || 0);

  if (paidAmount < fee) {
    await walletCredit(tenantId, customer.id, paidAmount, "Insufficient for processing fee", transaction_id, "fee");
    return { result: `Insufficient (paid KES ${paidAmount}, need KES ${fee}) — credited to wallet`, loanId };
  }

  await insertLoanPayment({
    loanId, amount: fee, type: "processing", description: "Loan Processing Fee", receipt: transaction_id, tenantId, customerId: customer.id
  });
  await supabaseAdmin.from("loans").update({ processing_fee_paid: true }).eq("id", loanId);

  const excess = paidAmount - fee;
  if (excess > 0.005) {
    await walletCredit(tenantId, customer.id, excess, "Excess processing fee payment", transaction_id, "fee");
  }

  const result = `Processing fee KES ${fee} deducted${excess > 0.005 ? `, KES ${excess.toFixed(2)} to wallet` : ""}`;
  return { result, loanId };
}

async function handleRepayment(tx, customer, tenantId, mpesaAmount) {
  const { transaction_id, phone_number } = tx;
  const customerId = customer.id;

  const { data: loan } = await supabaseAdmin
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
    await walletCredit(tenantId, customerId, mpesaAmount, "Payment with no active loan", transaction_id, "mpesa");
    return { result: `No active loan — KES ${mpesaAmount} credited to wallet`, loanId: null };
  }

  const loanId = loan.id;

  const { data: drained, error: drainErr } = await supabaseAdmin
    .rpc("drain_wallet_for_repayment", {
      p_tenant_id: tenantId,
      p_customer_id: customerId,
      p_reference: transaction_id,
    });

  const walletDrained = parseFloat(drained || 0);
  let remaining = mpesaAmount + walletDrained;

  const { data: installments, error: instErr } = await supabaseAdmin
    .from("loan_installments")
    .select("*")
    .eq("loan_id", loanId)
    .in("status", ["pending", "partial", "overdue"])
    .order("installment_number", { ascending: true });

  if (instErr) throw new Error(`Failed to fetch installments: ${instErr.message}`);

  let totalApplied = 0;

  for (const inst of (installments || [])) {
    if (remaining <= 0) break;
    const applied = await allocateInstallment({
      inst, loanId, tenantId, customerId, available: remaining, transactionId: transaction_id, phoneNumber: phone_number,
    });
    remaining -= applied;
    totalApplied += applied;
  }

  if (remaining > 0.005) {
    await walletCredit(tenantId, customerId, remaining, `Overpayment on loan #${loanId}`, transaction_id, "overpayment");
  }

  const result = `Applied KES ${totalApplied.toFixed(2)} to loan #${loanId}${
    walletDrained > 0 ? ` (incl. KES ${walletDrained} from wallet)` : ""
  }${remaining > 0.005 ? `, KES ${remaining.toFixed(2)} overpayment to wallet` : ""}`;
  
  return { result, loanId };
}

async function allocateInstallment(ctx) {
  const { inst, loanId, tenantId, customerId, available, transactionId, phoneNumber } = ctx;

  const penaltyDue = parseFloat(inst.net_penalty ?? inst.penalty_amount ?? 0);
  const interestDue = parseFloat(inst.interest_amount ?? 0);
  const principalDue = parseFloat(inst.principal_amount ?? 0);
  const interestPaid = parseFloat(inst.interest_paid ?? 0);
  const principalPaid = parseFloat(inst.principal_paid ?? 0);

  const { data: paidRows } = await supabaseAdmin
    .from("loan_payments")
    .select("penalty_paid")
    .eq("installment_id", inst.id);
    
  const penaltyPaid = (paidRows || []).reduce((s, r) => s + parseFloat(r.penalty_paid || 0), 0);

  const unpaidPenalty = Math.max(0, penaltyDue - penaltyPaid);
  const unpaidInterest = Math.max(0, interestDue - interestPaid);
  const unpaidPrincipal = Math.max(0, principalDue - principalPaid);
  const totalUnpaid = unpaidPenalty + unpaidInterest + unpaidPrincipal;

  if (totalUnpaid <= 0) return 0;

  const buckets = [];
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
    const { error: payErr } = await supabaseAdmin.from("loan_payments").insert({
      loan_id: loanId,
      installment_id: inst.id,
      paid_amount: b.amount,
      payment_type: b.type,
      description: `${b.type.charAt(0).toUpperCase() + b.type.slice(1)} Repayment`,
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

  const newInterestPaid = interestPaid + (buckets.find((b) => b.type === "interest")?.amount || 0);
  const newPrincipalPaid = principalPaid + (buckets.find((b) => b.type === "principal")?.amount || 0);
  const newPenaltyPaid = penaltyPaid + (buckets.find((b) => b.type === "penalty")?.amount || 0);
  const newTotalPaid = newInterestPaid + newPrincipalPaid + newPenaltyPaid;
  const totalDue = interestDue + principalDue + penaltyDue;
  const newStatus = newTotalPaid >= totalDue - 0.005 ? "paid" : applied > 0 ? "partial" : inst.status;

  await supabaseAdmin
    .from("loan_installments")
    .update({
      interest_paid: newInterestPaid,
      principal_paid: newPrincipalPaid,
      paid_amount: newTotalPaid,
      status: newStatus,
    })
    .eq("id", inst.id);

  return applied;
}

// ═══════════════════════════════════════════════════════════════════
// AUTO REPAY
// ═══════════════════════════════════════════════════════════════════

async function handleAutoRepay(customer_id, tenantId) {
  try {
    const balance = await getWalletBalance(tenantId, customer_id);
    if (balance <= 0) return;

    const { data: loan } = await supabaseAdmin
      .from("loans")
      .select("id, repayment_state")
      .eq("customer_id", customer_id)
      .eq("tenant_id", tenantId)
      .eq("status", "disbursed")
      .in("repayment_state", ["ongoing", "partial", "overdue"])
      .order("disbursed_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!loan) return;

    const { data: drained, error: drainErr } = await supabaseAdmin
      .rpc("drain_wallet_for_repayment", {
        p_tenant_id: tenantId,
        p_customer_id: customer_id,
        p_reference: `auto-${Date.now()}`,
      });

    const walletDrained = parseFloat(drained || 0);
    if (walletDrained <= 0) return;

    const loanId = loan.id;
    let remaining = walletDrained;
    const { data: installments } = await supabaseAdmin
      .from("loan_installments")
      .select("*")
      .eq("loan_id", loanId)
      .in("status", ["pending", "partial", "overdue"])
      .order("installment_number", { ascending: true });

    let totalApplied = 0;
    for (const inst of (installments || [])) {
      if (remaining <= 0) break;
      const applied = await allocateInstallment({
        inst, loanId, tenantId, customerId: customer_id, available: remaining, transactionId: `auto-${Date.now()}`, phoneNumber: null,
      });
      remaining -= applied;
      totalApplied += applied;
    }

    if (remaining > 0.005) {
      await walletCredit(
        tenantId, customer_id, remaining, `Auto-repay overpayment on loan #${loanId}`, `auto-${Date.now()}`, "overpayment"
      );
    }
  } catch (err) {
    log.error({ err: err.message, customerId: customer_id }, "AutoRepay Error");
  }
}

// ═══════════════════════════════════════════════════════════════════
// SMS HANDLER
// ═══════════════════════════════════════════════════════════════════

async function handlePaymentSms(transaction_id, tenantId) {
  const { data: tx, error: txErr } = await supabaseAdmin
    .from("mpesa_c2b_transactions")
    .select(`id, amount, loan_id, customer_id, phone_number, payment_sms_sent, tenant_id`)
    .eq("transaction_id", transaction_id)
    .eq("tenant_id", tenantId)
    .single();

  if (txErr || !tx) throw new Error(`Transaction not found: ${transaction_id}`);
  if (tx.payment_sms_sent) return;
  if (!tx.loan_id) {
    await supabaseAdmin.from("mpesa_c2b_transactions").update({ payment_sms_sent: true }).eq("id", tx.id);
    return;
  }

  let customerMobile = null;
  let firstName = "Customer";
  let customerId = tx.customer_id;

  if (customerId) {
    const { data: cust } = await supabaseAdmin
      .from("customers").select("Firstname, mobile").eq("id", customerId).eq("tenant_id", tenantId).maybeSingle();
    if (cust) {
      customerMobile = cust.mobile;
      firstName = cust.Firstname || "Customer";
    }
  }
  if (!customerMobile && tx.phone_number) {
    const phoneFormats = normalizePhone(tx.phone_number);
    if (phoneFormats.length) {
      const { data: custByPhone } = await supabaseAdmin
        .from("customers").select("id, Firstname, mobile").in("mobile", phoneFormats).eq("tenant_id", tenantId).maybeSingle();
      if (custByPhone) {
        customerMobile = custByPhone.mobile;
        customerId = custByPhone.id;
        firstName = custByPhone.Firstname || "Customer";
      }
    }
  }
  if (!customerMobile) {
    await supabaseAdmin.from("mpesa_c2b_transactions").update({ payment_sms_sent: true }).eq("id", tx.id);
    return;
  }

  let outstandingBalance = 0;
  if (tx.loan_id) {
    const { data: loan } = await supabaseAdmin.from("loans").select("total_payable").eq("id", tx.loan_id).single();
    const { data: payments } = await supabaseAdmin.from("loan_payments").select("paid_amount").eq("loan_id", tx.loan_id);
    const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.paid_amount), 0);
    outstandingBalance = Math.max(0, Number(loan?.total_payable || 0) - totalPaid);
  }

  const amount = Number(tx.amount).toLocaleString();
  const balance = outstandingBalance.toLocaleString();
  const message = `Dear ${firstName},\nWe have received your payment of KES ${amount}.\nYour outstanding loan balance is KES ${balance}.\nThank you for being our valued client.`;

  const { data: smsConfig, error: cfgErr } = await supabaseAdmin
    .from("tenant_sms_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (cfgErr || !smsConfig) throw new Error(`SMS config missing for tenant ${tenantId}`);

  const encodedMsg = encodeURIComponent(message.trim());
  const url = `${smsConfig.base_url}?apikey=${smsConfig.api_key}&partnerID=${smsConfig.partner_id}&message=${encodedMsg}&shortcode=${smsConfig.shortcode}&mobile=${customerMobile}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`SMS send failed (${response.status})`);

  await supabaseAdmin.from("sms_logs").insert({
    customer_id: customerId,
    recipient_phone: customerMobile,
    message,
    status: "sent",
    message_id: `sms-${Date.now()}`,
    tenant_id: tenantId,
    created_at: new Date().toISOString(),
  });

  await supabaseAdmin.from("mpesa_c2b_transactions").update({ payment_sms_sent: true }).eq("id", tx.id);
}

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════

async function walletCredit(tenantId, customerId, amount, narration, reference, refType) {
  await supabaseAdmin.rpc("wallet_transact", {
    p_tenant_id: tenantId,
    p_customer_id: customerId,
    p_amount: amount,
    p_direction: "credit",
    p_narration: narration,
    p_reference: reference,
    p_ref_type: refType,
  });
}

async function getWalletBalance(tenantId, customerId) {
  const { data } = await supabaseAdmin
    .from("customer_wallets")
    .select("credit, debit")
    .eq("customer_id", customerId)
    .eq("tenant_id", tenantId);
  return (data || []).reduce((acc, row) => acc + (row.credit || 0) - (row.debit || 0), 0);
}

async function insertLoanPayment(opts) {
  await supabaseAdmin.from("loan_payments").insert({
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
}

async function moveToSuspense(tx, reason) {
  await supabaseAdmin.from("suspense_transactions").upsert({
    tenant_id: tx.tenant_id || null,
    payer_name: tx.firstname?.trim() || "Unknown",
    phone_number: tx.phone_number,
    amount: tx.amount,
    transaction_id: tx.transaction_id,
    transaction_time: tx.transaction_time || new Date().toISOString(),
    billref: tx.billref,
    status: "suspense",
    reason,
  }, { onConflict: "transaction_id" });
  await supabaseAdmin.from("mpesa_c2b_transactions").update({ status: "suspense" }).eq("transaction_id", tx.transaction_id);
}

function parseIntent(billref) {
  if (!billref) return { type: "repayment" };
  const ref = billref.trim().toLowerCase();
  if (ref === "registration_fee") return { type: "registration" };
  if (ref.startsWith("registration-")) return { type: "registration", customerId: ref.split("-")[1] };
  if (ref.startsWith("processing-")) return { type: "processing", loanId: ref.split("-").slice(1).join("-") };
  return { type: "repayment", accountRef: billref.trim() };
}

async function resolveTenantFromPhone(phone) {
  if (!phone) return null;
  const formats = normalizePhone(phone);
  const { data } = await supabaseAdmin.from("customers").select("tenant_id").in("mobile", formats).limit(1).maybeSingle();
  return data?.tenant_id || null;
}

// 🚨 UPDATED WITH TENANT ID PROTECTION
async function resolveCustomer(phone, intent, tenantId) {
  if (intent.type === "repayment" && intent.accountRef) {
    const { data } = await supabaseAdmin
      .from("customers")
      .select("id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer")
      .eq("id_number", intent.accountRef)
      .eq("tenant_id", tenantId) // ADDED TENANT FILTER
      .maybeSingle();
    if (data) return data;
  }
  if (intent.customerId) {
    const { data } = await supabaseAdmin
      .from("customers")
      .select("id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer")
      .eq("id", intent.customerId)
      .eq("tenant_id", tenantId) // ADDED TENANT FILTER
      .maybeSingle();
    if (data) return data;
  }
  const formats = normalizePhone(phone);
  if (formats.length) {
    const { data } = await supabaseAdmin
      .from("customers")
      .select("id, Firstname, Surname, mobile, id_number, tenant_id, is_new_customer")
      .in("mobile", formats)
      .eq("tenant_id", tenantId) // ADDED TENANT FILTER
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

function normalizePhone(phone) {
  if (!phone) return [];
  const clean = String(phone).replace(/[\s\-\(\)\+]/g, "");
  const out = new Set();
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
