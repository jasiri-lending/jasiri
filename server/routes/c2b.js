import express from "express";
import axios from "axios";
import { getMpesaToken } from "./mpesa.js";
import { createClient } from "@supabase/supabase-js";

const c2b = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// VALIDATION URL
c2b.post("/validation", (req, res) => {
  return res.json({
    ResultCode: 0,
    ResultDesc: "Validation Passed",
  });
});



c2b.get("/register", async (req, res) => {
  try {
    const token = await getMpesaToken();

    const url = "https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl"; 

    const payload = {
      ShortCode: process.env.MPESA_SHORTCODE,
      ResponseType: "Completed",
      ConfirmationURL: `${process.env.DOMAIN}/mpesa/c2b/confirmation`,
      ValidationURL: `${process.env.DOMAIN}/mpesa/c2b/validation`,
    };

    const { data } = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    res.json({
      message: "LIVE C2B URLs Registered Successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// CONFIRMATION URL
c2b.post("/confirmation", async (req, res) => {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { TransID, TransAmount, MSISDN, BillRefNumber,FirstName } = body;
    const localNumber = MSISDN.replace(/^254/, "0");

    if (!TransID || !MSISDN || !TransAmount || !BillRefNumber)
      throw new Error("Missing required transaction fields.");

    const totalPaidAmount = parseFloat(TransAmount);
    const transaction_time = new Date().toISOString();

    let paymentType = "repayment";
    let description = "Loan Repayment";
    let loanId = null;
    let customerId = null;

    // Determine payment type
    if (BillRefNumber === "registration_fee") {
      paymentType = "registration";
      description = "Joining Fee Payment";
    } else if (BillRefNumber.startsWith("registration-")) {
      paymentType = "registration";
      description = "Joining Fee Payment";
      customerId = BillRefNumber.split("-")[1];
    } else if (BillRefNumber.startsWith("processing-")) {
      paymentType = "processing";
      description = "Loan Processing Fee";
      loanId = BillRefNumber.split("-")[1];
    }

    // Prevent duplicate transactions
    const { data: existingTx } = await supabaseAdmin
      .from("mpesa_c2b_transactions")
      .select("id")
      .eq("transaction_id", TransID)
      .maybeSingle();

    if (existingTx) {
      console.log(`Duplicate transaction ${TransID} ignored.`);
      return res.json({ ResultCode: 0, ResultDesc: "Duplicate transaction" });
    }

    // Log raw transaction
    await supabaseAdmin.from("mpesa_c2b_transactions").insert([
      {
        transaction_id: TransID,
        phone_number: MSISDN,
        amount: totalPaidAmount,
        transaction_time,
        raw_payload: body,
        status: "pending",
        loan_id: loanId || null,
        payment_type: paymentType,
        description,
        reference: TransID,
          billref: BillRefNumber, 
         firstname: FirstName?.trim(),
    
   
      },
    ]);

    // REPAYMENT HANDLING
    if (paymentType === "repayment") {
      const nationalId = BillRefNumber.trim();

      // Find the customer
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, Firstname, Middlename, Surname")
        .eq("id_number", nationalId)
        .maybeSingle();

if (!customer) {
  // Move to suspense if customer not found
  await supabaseAdmin.from("suspense_transactions").insert([
    {
      payer_name: FirstName?.trim() || "Unknown", //  ensure name captured
      phone_number: MSISDN,
      amount: totalPaidAmount,
      transaction_id: TransID,
      transaction_time,
        billref: BillRefNumber, 
      status: "suspense",
      linked_customer_id: null,
      reason: "Customer not found in system",
    },
  ]);

  console.log(`Payment from ${FirstName || "Unknown"} moved to suspense - no customer found.`);

  return res.json({
    ResultCode: 0,
    ResultDesc: "Customer not found. Payment moved to suspense.",
  });
}

      customerId = customer.id;

      // Find active loan
      const { data: activeLoan } = await supabaseAdmin
        .from("loans")
        .select("*")
        .eq("customer_id", customerId)
        .eq("status", "disbursed")
        .in("repayment_state", ["ongoing", "partial", "overdue"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      // If no active loan → credit wallet
      if (!activeLoan) {
        await supabaseAdmin.from("customer_wallets").insert([
          {
            customer_id: customerId,
            amount: totalPaidAmount,
            type: "credit",
            description: " credited to wallet",
            transaction_id: (
              await supabaseAdmin
                .from("mpesa_c2b_transactions")
                .select("id")
                .eq("transaction_id", TransID)
                .maybeSingle()
            ).data?.id || null,
          },
        ]);

        await supabaseAdmin
          .from("mpesa_c2b_transactions")
          .update({
            status: "applied",
            applied_amount: 0,
            description: "credited to wallet",
          })
          .eq("transaction_id", TransID);

        return res.json({
          ResultCode: 0,
          ResultDesc: "Customer has no active loan. Amount credited to wallet.",
        });
      }

      loanId = activeLoan.id;

      // Attach loan_id to transaction
      await supabaseAdmin
        .from("mpesa_c2b_transactions")
        .update({ loan_id: loanId })
        .eq("transaction_id", TransID);

      // Fetch installments
      const { data: installments, error: fetchError } = await supabaseAdmin
        .from("loan_installments")
        .select("*")
        .eq("loan_id", loanId)
        .in("status", ["pending", "partial"])
        .order("installment_number", { ascending: true });

      if (fetchError) throw fetchError;

      let remainingAmount = totalPaidAmount;
      let nextPaymentPriority = "interest"; // alternates dynamically

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

        // Check what was left unpaid last time — that determines the priority
        if (unpaidPrincipal > 0 && unpaidInterest === 0) {
          nextPaymentPriority = "principal";
        } else if (unpaidInterest > 0 && unpaidPrincipal === 0) {
          nextPaymentPriority = "interest";
        }

        // Dynamically alternate interest → principal → interest → principal
        const priorities =
          nextPaymentPriority === "interest"
            ? ["interest", "principal"]
            : ["principal", "interest"];

        for (const type of priorities) {
          if (remainingAmount <= 0) break;

          if (type === "interest" && unpaidInterest > 0) {
            const payAmt = Math.min(remainingAmount, unpaidInterest);
            remainingAmount -= payAmt;

            await supabaseAdmin.from("loan_payments").insert([
              {
                loan_id: loanId,
                installment_id: installmentId,
                paid_amount: payAmt,
                payment_type: "interest",
                description: "Interest Repayment",
                mpesa_receipt: TransID,
                phone_number: MSISDN,
                payment_method: "mpesa_c2b",
                balanceBefore,
                balance_after: balanceBefore - payAmt,
              },
            ]);

            await supabaseAdmin
              .from("loan_installments")
              .update({ interest_paid: interestPaid + payAmt })
              .eq("id", installmentId);
          }

          if (type === "principal" && unpaidPrincipal > 0) {
            const payAmt = Math.min(remainingAmount, unpaidPrincipal);
            remainingAmount -= payAmt;

            await supabaseAdmin.from("loan_payments").insert([
              {
                loan_id: loanId,
                installment_id: installmentId,
                paid_amount: payAmt,
                payment_type: "principal",
                description: "Principal Repayment",
                mpesa_receipt: TransID,
                phone_number: MSISDN,
                payment_method: "mpesa_c2b",
                balanceBefore,
                balance_after: balanceBefore - payAmt,
              },
            ]);

            await supabaseAdmin
              .from("loan_installments")
              .update({ principal_paid: principalPaid + payAmt })
              .eq("id", installmentId);
          }
        }

        // Check if installment is now fully paid
        const newInterestPaid = Math.min(interestDue, interestPaid + (interestDue - unpaidInterest));
        const newPrincipalPaid = Math.min(principalDue, principalPaid + (principalDue - unpaidPrincipal));
        const totalPaidNow = newInterestPaid + newPrincipalPaid;
        const fullyPaid = totalPaidNow >= interestDue + principalDue;

        await supabaseAdmin
          .from("loan_installments")
          .update({
            paid_amount: totalPaidNow,
            status: fullyPaid ? "paid" : "partial",
          })
          .eq("id", installmentId);

        // Flip next round’s priority
        nextPaymentPriority =
          nextPaymentPriority === "interest" ? "principal" : "interest";
      }

      // Handle overpayment
      if (remainingAmount > 0) {
        await supabaseAdmin.from("customer_wallets").insert([
          {
            customer_id: customerId,
            amount: remainingAmount,
            type: "credit",
            description: "Overpayment credited to wallet",
            transaction_id: (
              await supabaseAdmin
                .from("mpesa_c2b_transactions")
                .select("id")
                .eq("transaction_id", TransID)
                .maybeSingle()
            ).data?.id || null,
          },
        ]);
      }

      await supabaseAdmin
        .from("mpesa_c2b_transactions")
        .update({
          status: "applied",
          applied_amount: totalPaidAmount - remainingAmount,
        })
        .eq("transaction_id", TransID);

      return res.json({
        ResultCode: 0,
        ResultDesc: "Loan repayment processed successfully with alternating order",
      });
    }

    // REGISTRATION FEE
    if (paymentType === "registration") {
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id")
        .in("mobile", [MSISDN, localNumber])
        .single();

      if (!customer) throw new Error("Customer not found");

      await supabaseAdmin
        .from("customers")
        .update({ registration_fee_paid: true, is_new_customer: false })
        .eq("id", customer.id);

      await supabaseAdmin
        .from("mpesa_c2b_transactions")
        .update({ status: "applied" })
        .eq("transaction_id", TransID);

      return res.json({
        ResultCode: 0,
        ResultDesc: "Registration fee processed successfully",
      });
    }

    // PROCESSING FEE
    if (paymentType === "processing") {
      await supabaseAdmin
        .from("loans")
        .update({
          processing_fee_paid: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", loanId);

      await supabaseAdmin
        .from("mpesa_c2b_transactions")
        .update({ status: "applied" })
        .eq("transaction_id", TransID);

      return res.json({
        ResultCode: 0,
        ResultDesc: "Processing fee processed successfully",
      });
    }



// Move to suspense if the referenced customer (BillRefNumber) is not found
const { data: suspenseData, error: suspenseError } = await supabaseAdmin
  .from("suspense_transactions")
  .insert([
    {
      payer_name: FirstName?.trim() || "Unknown",
      phone_number: MSISDN,
      amount: totalPaidAmount,
      transaction_id: TransID,
      transaction_time,
      status: "suspense",
      linked_customer_id: null,
      reason: `Recipient with ID ${BillRefNumber} not found in system`,
    },
  ])
  .select();

if (suspenseError) {
  console.error(" Failed to insert suspense record:", suspenseError.message);
  return res.json({
    ResultCode: 1,
    ResultDesc: `Failed to move to suspense: ${suspenseError.message}`,
  });
}

console.log(" Suspense record created:", suspenseData);

return res.json({
  ResultCode: 0,
  ResultDesc: "Recipient not found. Payment moved to suspense.",
});


  } catch (error) {
    console.error("C2B Confirmation Error:", error.message);
    res.json({
      ResultCode: 1,
      ResultDesc: `Processing failed: ${error.message}`,
    });
  }
});

export default c2b;
