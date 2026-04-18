import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken, requirePermission } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Propose Reconciliation (Maker)
 * Sets status to 'pending_approval'
 */
router.post("/:id/propose", verifySupabaseToken, requirePermission('transaction.reconcile'), async (req, res) => {
    const { id } = req.params;
    const { tenant_id, proposed_customer_id, reason } = req.body;
    const userId = req.user.id;

    if (!proposed_customer_id) {
        return res.status(400).json({ success: false, error: "Proposed customer ID is required" });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('suspense_transactions')
            .update({
                status: 'pending_approval',
                proposed_customer_id,
                reconciled_by: userId,
                reason: reason || `Proposed reconciliation to customer ${proposed_customer_id}`
            })
            .eq('id', id)
            .eq('tenant_id', tenant_id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, message: "Reconciliation proposed successfully. Waiting for approval.", transaction: data });
    } catch (error) {
        console.error("Error proposing reconciliation:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Approve Reconciliation (Checker)
 * Validates proposal and credits wallet
 */
router.post("/:id/approve", verifySupabaseToken, requirePermission('transaction.approve'), async (req, res) => {
    const { id } = req.params;
    const { tenant_id } = req.body;
    const checkerId = req.user.id;

    try {
        // 1. Fetch the pending transaction
        const { data: transaction, error: fetchError } = await supabaseAdmin
            .from('suspense_transactions')
            .select('*')
            .eq('id', id)
            .eq('tenant_id', tenant_id)
            .single();

        if (fetchError || !transaction) {
            return res.status(404).json({ success: false, error: "Transaction not found" });
        }

        if (transaction.status !== 'pending_approval') {
            return res.status(400).json({ success: false, error: "Transaction is not pending approval" });
        }

        // 2. Prevent self-approval
        if (transaction.reconciled_by === checkerId) {
            return res.status(403).json({ success: false, error: "Maker cannot be the checker. Segregation of duties required." });
        }

        const customerId = transaction.proposed_customer_id;

        // 3. Finalize reconciliation
        const { error: updateError } = await supabaseAdmin
            .from('suspense_transactions')
            .update({
                status: 'reconciled',
                linked_customer_id: customerId,
                approved_by: checkerId,
                reason: `Approved reconciliation by user ${checkerId}: ${transaction.reason}`
            })
            .eq('id', id);

        if (updateError) throw updateError;

        // 4. Credit Customer Wallet
        const { error: walletError } = await supabaseAdmin
            .from('customer_wallets')
            .insert([{
                customer_id: customerId,
                tenant_id: tenant_id,
                amount: transaction.amount,
                credit: transaction.amount,
                debit: 0,
                type: 'credit',
                transaction_type: 'mpesa',
                mpesa_reference: transaction.transaction_id,
                billref: transaction.billref || transaction.reference,
                narration: `Manual reconciliation: ${transaction.transaction_id}`,
                description: `Payment reconciled from suspense (Approved)`
            }]);

        if (walletError) throw walletError;

        res.json({ success: true, message: "Reconciliation approved. Customer wallet credited." });
    } catch (error) {
        console.error("Error approving reconciliation:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Reject Reconciliation (Checker)
 * Reverts status to 'suspense'
 */
router.post("/:id/reject", verifySupabaseToken, requirePermission('transaction.approve'), async (req, res) => {
    const { id } = req.params;
    const { tenant_id, reason } = req.body;
    const checkerId = req.user.id;

    try {
        const { error } = await supabaseAdmin
            .from('suspense_transactions')
            .update({
                status: 'suspense', // Revert to suspense
                proposed_customer_id: null,
                reconciled_by: null,
                reason: reason || `Reconciliation rejected by checker ${checkerId}`
            })
            .eq('id', id)
            .eq('tenant_id', tenant_id);

        if (error) throw error;

        res.json({ success: true, message: "Reconciliation rejected. Transaction returned to suspense." });
    } catch (error) {
        console.error("Error rejecting reconciliation:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
