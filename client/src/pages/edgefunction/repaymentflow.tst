
// new function 
// supabase/functions/process-payments/index.ts
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('PROJECT_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    const { action, transaction_id } = await req.json();

    if (action === 'process-pending') {
      const result = await processPendingTransactions(supabaseAdmin);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'process-single' && transaction_id) {
      const result = await processSingleTransaction(transaction_id, supabaseAdmin);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processPendingTransactions(supabaseAdmin: SupabaseClient) {
  console.log(' Starting to process pending transactions...');
  
  const { data: pendingTransactions, error } = await supabaseAdmin
    .from("mpesa_c2b_transactions")
    .select("*")
    .eq("status", "pending")
    .order("transaction_time", { ascending: true });

  if (error) {
    console.error(' Failed to fetch pending transactions:', error);
    throw error;
  }

  console.log(` Found ${pendingTransactions?.length || 0} pending transactions`);

  const results = [];
  for (const transaction of pendingTransactions || []) {
    try {
      const result = await processTransactionLogic(transaction, supabaseAdmin);
      results.push({
        transaction_id: transaction.transaction_id,
        status: "success",
        result
      });
    } catch (txError) {
      console.error(` Failed to process transaction ${transaction.transaction_id}:`, txError);
      results.push({
        transaction_id: transaction.transaction_id,
        status: "error",
        error: txError.message
      });
      await supabaseAdmin
        .from("mpesa_c2b_transactions")
        .update({ status: "failed" })
        .eq("transaction_id", transaction.transaction_id);
    }
  }

  console.log(` Completed processing. Results:`, results);
  return {
    message: `Processed ${results.length} transactions`,
    processed: results.length,
    results
  };
}

async function processSingleTransaction(transaction_id: string, supabaseAdmin: SupabaseClient) {
  const { data: transaction, error } = await supabaseAdmin
    .from("mpesa_c2b_transactions")
    .select("*")
    .eq("transaction_id", transaction_id)
    .single();

  if (error) throw error;

  const result = await processTransactionLogic(transaction, supabaseAdmin);
  return { transaction_id, status: "success", result };
}

// COMPLETE PROCESSING LOGIC
async function processTransactionLogic(transaction: any, supabaseAdmin: SupabaseClient) {
  const { transaction_id, phone_number, amount, billref, firstname, transaction_time } = transaction;
  
  console.log(' START Processing transaction:', transaction_id, 'billref:', billref, 'amount:', amount);

  const totalPaidAmount = parseFloat(amount);

  // Payment type detection
  let paymentType = "repayment";
  let loanId = null;
  let customerId = null;

  if (billref === "registration_fee") {
    paymentType = "registration";
  } else if (billref.startsWith("registration-")) {
    paymentType = "registration";
    customerId = billref.split("-")[1];
  } else if (billref.startsWith("processing-")) {
    paymentType = "processing";
    loanId = billref.split("-")[1];
  }

  console.log('Payment type detected:', paymentType);

  // Duplicate check
  const { data: existingTx } = await supabaseAdmin
    .from("mpesa_c2b_transactions")
    .select("id")
    .eq("transaction_id", transaction_id)
    .neq("status", "pending")
    .maybeSingle();

  if (existingTx) {
    console.log(' Duplicate transaction found, ignoring:', transaction_id);
    await supabaseAdmin
      .from("mpesa_c2b_transactions")
      .update({ status: "applied" })
      .eq("transaction_id", transaction_id);
    return "Duplicate transaction ignored";
  }

  // REPAYMENT PROCESSING
  if (paymentType === "repayment") {
    const accountRef = billref.trim();
    
    // IMPROVED CUSTOMER LOOKUP
    console.log('👤 Looking up customer with account ref:', accountRef);
    
    // Try ID number first
    let { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, Firstname, Middlename, Surname, mobile, id_number")
      .eq("id_number", accountRef)
      .maybeSingle();

    if (!customer) {
      // If not found by ID → try by phone with ALL possible formats
      const phoneFormats: string[] = [];
      
      // Remove any spaces, dashes, or special characters
      const cleanRef = accountRef.replace(/[\s\-\(\)]/g, '');
      
      // Generate all possible format variations
      if (cleanRef.startsWith("0")) {
        
        phoneFormats.push(cleanRef);                           
        phoneFormats.push(cleanRef.replace(/^0/, "254"));      
        phoneFormats.push(cleanRef.replace(/^0/, "+254"));     
      } else if (cleanRef.startsWith("254")) {
        // e.g., 254111269996
        phoneFormats.push(cleanRef);                           // 254111269996
        phoneFormats.push(cleanRef.replace(/^254/, "0"));      // 0111269996
        phoneFormats.push("+" + cleanRef);                     // +254111269996
      } else if (cleanRef.startsWith("+254")) {
        // e.g., +254111269996
        phoneFormats.push(cleanRef);                           // +254111269996
        phoneFormats.push(cleanRef.replace(/^\+254/, "254"));  // 254111269996
        phoneFormats.push(cleanRef.replace(/^\+254/, "0"));    // 0111269996
      } else if (cleanRef.startsWith("+")) {
        // e.g., +254111269996 (handle + prefix generically)
        phoneFormats.push(cleanRef);
        phoneFormats.push(cleanRef.replace(/^\+/, ""));
      } else {
        // Unknown format, just try as-is
        phoneFormats.push(cleanRef);
      }

      // Remove duplicates
      const uniqueFormats = [...new Set(phoneFormats)];
      console.log('📞 Trying phone formats:', uniqueFormats);

      const { data: customerByPhone } = await supabaseAdmin
        .from("customers")
        .select("id, Firstname, Middlename, Surname, mobile, id_number")
        .in("mobile", uniqueFormats)
        .maybeSingle();

      customer = customerByPhone;
    }

    console.log('👤 Customer lookup result:', customer);

    if (!customer) {
      console.log('❌ Customer not found, moving to suspense');
      await supabaseAdmin.from("suspense_transactions").insert([{
        payer_name: firstname?.trim() || "Unknown",
        phone_number: phone_number,
        amount: totalPaidAmount,
        transaction_id: transaction_id,
        transaction_time: transaction_time,
        billref: billref,
        status: "suspense",
        linked_customer_id: null,
        reason: "Customer not found in system"
      }]);

      await supabaseAdmin
        .from("mpesa_c2b_transactions")
        .update({ status: "suspense" })
        .eq("transaction_id", transaction_id);

      return "Customer not found. Payment moved to suspense.";
    }

    customerId = customer.id;
    console.log('✅ Customer found:', customerId, customer.Firstname);

    // Find active loan
    console.log('💰 Looking for active loans for customer:', customerId);
    const { data: activeLoan, error: loanError } = await supabaseAdmin
      .from("loans")
      .select("*")
      .eq("customer_id", customerId)
      .eq("status", "disbursed")
      .in("repayment_state", ["ongoing", "partial", "overdue"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    console.log('💰 Active loan result:', activeLoan, 'Error:', loanError);

    // If no active loan → credit wallet
    if (!activeLoan) {
      console.log('🔍 No active loan found - crediting wallet');
      
      const { data: walletData, error: walletError } = await supabaseAdmin
        .from("customer_wallets")
        .insert([{
          customer_id: customerId,
          amount: totalPaidAmount,
          credit: totalPaidAmount,
          debit: 0,
          transaction_type: "credit",
          narration: "Credited to wallet - no active loan",
          mpesa_reference: transaction_id
        }])
        .select();

      if (walletError) {
        console.error('❌ Wallet insert FAILED:', walletError);
        throw new Error(`Failed to credit wallet: ${walletError.message}`);
      }

      console.log('✅ Wallet credited successfully');

      await supabaseAdmin
        .from("mpesa_c2b_transactions")
        .update({
          status: "applied",
          applied_amount: 0,
          description: "Credited to wallet - no active loan"
        })
        .eq("transaction_id", transaction_id);

      return "No active loan - amount credited to customer wallet";
    }

    loanId = activeLoan.id;
    console.log('📝 Processing loan repayment for loan:', loanId);

    let remainingAmount = totalPaidAmount;

    // Process loan installments
    const { data: installments, error: fetchError } = await supabaseAdmin
      .from("loan_installments")
      .select("*")
      .eq("loan_id", loanId)
      .in("status", ["pending", "partial"])
      .order("installment_number", { ascending: true });

    if (fetchError) throw fetchError;

    let nextPaymentPriority: "interest" | "principal" = "interest";

    for (const inst of installments || []) {
      if (remainingAmount <= 0) break;

      const installmentId = inst.id;
      const interestDue = parseFloat(inst.interest_amount || 0);
      const principalDue = parseFloat(inst.principal_amount || 0);
      const interestPaid = parseFloat(inst.interest_paid || 0);
      const principalPaid = parseFloat(inst.principal_paid || 0);

      const unpaidInterest = interestDue - interestPaid;
      const unpaidPrincipal = principalDue - principalPaid;
      const balanceBefore = unpaidInterest + unpaidPrincipal;

      console.log(`📊 Installment ${inst.installment_number}:`, {
        unpaidInterest,
        unpaidPrincipal,
        balanceBefore,
        remainingAmount
      });

      // Determine payment priority
      if (unpaidPrincipal > 0 && unpaidInterest === 0) {
        nextPaymentPriority = "principal";
      } else if (unpaidInterest > 0 && unpaidPrincipal === 0) {
        nextPaymentPriority = "interest";
      }

      const priorities = nextPaymentPriority === "interest" 
        ? ["interest", "principal"] as const
        : ["principal", "interest"] as const;

      let newInterestPaid = interestPaid;
      let newPrincipalPaid = principalPaid;

      for (const type of priorities) {
        if (remainingAmount <= 0) break;

        if (type === "interest" && unpaidInterest > 0) {
          const payAmt = Math.min(remainingAmount, unpaidInterest);
          remainingAmount -= payAmt;
          newInterestPaid += payAmt;

          console.log(`💵 Paying ${payAmt} to INTEREST for installment ${inst.installment_number}`);

          // FIXED: Ensure all required fields are present
          const { error: paymentError } = await supabaseAdmin
            .from("loan_payments")
            .insert([{
              loan_id: loanId,  // ✅ Now using the correct loanId variable
              installment_id: installmentId,  // ✅ Using the correct installmentId
              paid_amount: payAmt,
              payment_type: "interest",  // ✅ Correctly set
              description: "Interest Repayment",
              mpesa_receipt: transaction_id,
              phone_number: phone_number,
              payment_method: "mpesa_c2b",
              balanceBefore: balanceBefore,
              balance_after: balanceBefore - payAmt
            }]);

          if (paymentError) {
            console.error('❌ Interest payment insert failed:', paymentError);
            throw new Error(`Failed to record interest payment: ${paymentError.message}`);
          }

          await supabaseAdmin
            .from("loan_installments")
            .update({ interest_paid: newInterestPaid })
            .eq("id", installmentId);
        }

        if (type === "principal" && unpaidPrincipal > 0) {
          const payAmt = Math.min(remainingAmount, unpaidPrincipal);
          remainingAmount -= payAmt;
          newPrincipalPaid += payAmt;

          console.log(`💵 Paying ${payAmt} to PRINCIPAL for installment ${inst.installment_number}`);

          // FIXED: Ensure all required fields are present
          const { error: paymentError } = await supabaseAdmin
            .from("loan_payments")
            .insert([{
              loan_id: loanId,  // ✅ Now using the correct loanId variable
              installment_id: installmentId,  // ✅ Using the correct installmentId
              paid_amount: payAmt,
              payment_type: "principal",  // ✅ Correctly set
              description: "Principal Repayment",
              mpesa_receipt: transaction_id,
              phone_number: phone_number,
              payment_method: "mpesa_c2b",
              balanceBefore: balanceBefore - (newInterestPaid - interestPaid),
              balance_after: balanceBefore - (newInterestPaid - interestPaid) - payAmt
            }]);

          if (paymentError) {
            console.error('❌ Principal payment insert failed:', paymentError);
            throw new Error(`Failed to record principal payment: ${paymentError.message}`);
          }

          await supabaseAdmin
            .from("loan_installments")
            .update({ principal_paid: newPrincipalPaid })
            .eq("id", installmentId);
        }
      }

      // Update installment status
      const totalPaidNow = newInterestPaid + newPrincipalPaid;
      const fullyPaid = totalPaidNow >= (interestDue + principalDue);

      await supabaseAdmin
        .from("loan_installments")
        .update({
          paid_amount: totalPaidNow,
          status: fullyPaid ? "paid" : "partial"
        })
        .eq("id", installmentId);

      nextPaymentPriority = nextPaymentPriority === "interest" ? "principal" : "interest";
    }

    // Handle overpayment
    if (remainingAmount > 0) {
      console.log('💵 Handling overpayment:', remainingAmount);
      await supabaseAdmin.from("customer_wallets").insert([{
        customer_id: customerId,
        amount: remainingAmount,
        credit: remainingAmount,
        debit: 0,
        transaction_type: "credit",
        narration: "Overpayment credited to wallet",
        mpesa_reference: transaction_id
      }]);
    }

    // Update transaction status
    await supabaseAdmin
      .from("mpesa_c2b_transactions")
      .update({
        status: "applied",
        applied_amount: totalPaidAmount - remainingAmount,
        description: "Loan repayment processed"
      })
      .eq("transaction_id", transaction_id);

    return "Loan repayment processed successfully";
  }

  // REGISTRATION FEE PROCESSING
  if (paymentType === "registration") {
    console.log('🎫 Processing registration fee');
    
    if (!customerId) {
      const phoneFormats = [
        phone_number,
        phone_number.replace(/^254/, "0"),
        phone_number.replace(/^0/, "254"),
        phone_number.replace(/^\+254/, "0"),
        phone_number.replace(/^\+/, "")
      ].filter(Boolean);

      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id")
        .in("mobile", phoneFormats)
        .maybeSingle();

      if (!customer) {
        return await moveToSuspense(transaction, supabaseAdmin, "Customer not found for registration fee");
      }
      customerId = customer.id;
    }

    await supabaseAdmin
      .from("customers")
      .update({
        registration_fee_paid: true,
        is_new_customer: false
      })
      .eq("id", customerId);

    await supabaseAdmin
      .from("mpesa_c2b_transactions")
      .update({ status: "applied" })
      .eq("transaction_id", transaction_id);

    return "Registration fee processed successfully";
  }

  // PROCESSING FEE PROCESSING
  if (paymentType === "processing") {
    console.log('⚙️ Processing processing fee');
    
    await supabaseAdmin
      .from("loans")
      .update({
        processing_fee_paid: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", loanId);

    await supabaseAdmin
      .from("mpesa_c2b_transactions")
      .update({ status: "applied" })
      .eq("transaction_id", transaction_id);

    return "Processing fee processed successfully";
  }

  // FALLBACK TO SUSPENSE
  console.log('❓ Unknown payment type, moving to suspense');
  return await moveToSuspense(transaction, supabaseAdmin, "Unknown payment type");
}

async function moveToSuspense(transaction: any, supabaseAdmin: SupabaseClient, reason: string) {
  const { transaction_id, phone_number, amount, firstname, transaction_time, billref } = transaction;
  
  console.log('📦 Moving to suspense:', transaction_id, 'Reason:', reason);

  await supabaseAdmin.from("suspense_transactions").insert([{
    payer_name: firstname?.trim() || "Unknown",
    phone_number: phone_number,
    amount: amount,
    transaction_id: transaction_id,
    transaction_time: transaction_time,
    billref: billref,
    status: "suspense",
    linked_customer_id: null,
    reason: reason
  }]);

  await supabaseAdmin
    .from("mpesa_c2b_transactions")
    .update({ status: "suspense" })
    .eq("transaction_id", transaction_id);

  return `Payment moved to suspense: ${reason}`;
}




