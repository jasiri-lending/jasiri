import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken, requirePermission } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Bulk Bank Reconciliation
 * Processes a list of transactions, credits customer wallets, or moves to suspense.
 */
router.post("/bulk-process", verifySupabaseToken, requirePermission('transaction.reconcile'), async (req, res) => {
    const { transactions, bank_name } = req.body;
    const tenantId = req.user.tenant_id || req.body.tenant_id;
    const userId = req.user.id;

    if (!transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ success: false, error: "Invalid transactions data" });
    }

    const results = { successful: 0, failed: 0, details: [] };

    try {
        for (const t of transactions) {
            const reference = (t.mpesa_ref || t.bank_ref || "").trim();
            
            try {
                if (!reference || reference === "N/A") {
                    throw new Error("Missing transaction reference");
                }

                // 1. Check for duplicates in customer_wallets
                const { data: existing } = await supabaseAdmin
                    .from("customer_wallets")
                    .select("id")
                    .eq("mpesa_reference", reference)
                    .eq("tenant_id", tenantId)
                    .maybeSingle();

                if (existing) {
                    throw new Error(`Transaction ${reference} already processed in wallet`);
                }

                // 2. Resolve Customer by mobile
                const { data: customer } = await supabaseAdmin
                    .from("customers")
                    .select("id, Firstname, Surname, mobile")
                    .eq("mobile", t.mobile)
                    .eq("tenant_id", tenantId)
                    .maybeSingle();

                if (!customer) {
                    // Move to suspense_transactions
                    await supabaseAdmin.from("suspense_transactions").upsert({
                        tenant_id: tenantId,
                        payer_name: t.name || "Unknown",
                        phone_number: t.mobile,
                        amount: parseFloat(t.amount),
                        transaction_id: reference,
                        transaction_time: t.date || new Date().toISOString(),
                        status: "suspense",
                        reason: `Customer not found during bulk ${bank_name} reconciliation`,
                        bank_name: bank_name
                    }, { onConflict: "transaction_id" });

                    throw new Error("Customer not found. Transaction moved to suspense.");
                }

                // 3. Credit Customer Wallet
                // Using wallet_transact RPC if available, or direct insert
                const { error: walletError } = await supabaseAdmin
                    .from('customer_wallets')
                    .insert([{
                        customer_id: customer.id,
                        tenant_id: tenantId,
                        amount: parseFloat(t.amount),
                        credit: parseFloat(t.amount),
                        debit: 0,
                        type: 'credit',
                        transaction_type: 'bank_transfer',
                        mpesa_reference: reference,
                        billref: bank_name,
                        narration: `Bank Reconciliation (${bank_name}): ${reference}`,
                        description: `Automated bulk reconciliation from ${bank_name} export`
                    }]);

                if (walletError) throw walletError;

                // 4. Log in bank_reconciliation for tracking
                await supabaseAdmin.from("bank_reconciliation").insert({
                    customer_id: customer.id,
                    customer_name: t.name,
                    mobile: t.mobile,
                    amount: t.amount,
                    mpesa_ref: t.mpesa_ref,
                    bank_ref: t.bank_ref,
                    payment_date: t.date || new Date().toISOString().split('T')[0],
                    status: "reconciled",
                    tenant_id: tenantId,
                    bank_name: bank_name
                });

                results.successful++;
                results.details.push({ reference, status: "Success", message: `KES ${t.amount} credited to ${customer.Firstname}'s wallet` });

            } catch (err) {
                console.warn(`Bank reconciliation error for ${reference}:`, err.message);
                results.failed++;
                results.details.push({ reference, status: "Failed", message: err.message });
                
                // If it wasn't a duplicate, log it in bank_reconciliation as mismatch
                if (!err.message.includes("already processed")) {
                    await supabaseAdmin.from("bank_reconciliation").insert({
                        customer_name: t.name,
                        mobile: t.mobile,
                        amount: t.amount,
                        mpesa_ref: t.mpesa_ref,
                        bank_ref: t.bank_ref,
                        payment_date: t.date || new Date().toISOString().split('T')[0],
                        status: "mismatch",
                        tenant_id: tenantId,
                        bank_name: bank_name,
                        error_message: err.message
                    });
                }
            }
        }

        res.json({ success: true, results });
    } catch (error) {
        console.error("Bulk bank reconciliation error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
