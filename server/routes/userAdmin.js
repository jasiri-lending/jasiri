import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken } from "../middleware/authMiddleware.js";

const userAdminRouter = express.Router();

/**
 * @route GET /api/user-admin/usage/:userId
 * @desc Get record counts owned by a user (customers, loans, leads)
 */
userAdminRouter.get("/usage/:userId", verifySupabaseToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const tenant_id = req.user.tenant_id;

        // Verify the user being checked belongs to the same tenant
        const { data: targetUser, error: userError } = await supabaseAdmin
            .from("users")
            .select("tenant_id")
            .eq("id", userId)
            .single();

        if (userError || !targetUser || targetUser.tenant_id !== tenant_id) {
            return res.status(403).json({ success: false, error: "Unauthorized or user not found" });
        }

        const [customers, loans, leads] = await Promise.all([
            supabaseAdmin.from("customers").select("id", { count: "exact", head: true }).eq("created_by", userId).eq("tenant_id", tenant_id),
            supabaseAdmin.from("loans").select("id", { count: "exact", head: true }).eq("booked_by", userId).eq("tenant_id", tenant_id),
            supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("created_by", userId).eq("tenant_id", tenant_id)
        ]);

        res.json({
            success: true,
            usage: {
                customers: customers.count || 0,
                loans: loans.count || 0,
                leads: leads.count || 0
            }
        });
    } catch (err) {
        console.error("Usage fetch error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch usage data" });
    }
});

/**
 * @route POST /api/user-admin/lock/:userId
 * @desc Lock user account and transfer their data to another user
 */
userAdminRouter.post("/lock/:userId", verifySupabaseToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { transferToUserId, reason } = req.body;
        const adminId = req.user.id;
        const tenant_id = req.user.tenant_id;

        if (!reason) {
            return res.status(400).json({ success: false, error: "Reason is required for locking" });
        }

        // 1. Verify target user belongs to the same tenant
        const { data: targetUser, error: targetErr } = await supabaseAdmin
            .from("users")
            .select("id, tenant_id")
            .eq("id", userId)
            .eq("tenant_id", tenant_id)
            .single();

        if (targetErr || !targetUser) {
            return res.status(400).json({ success: false, error: "Invalid user or tenant mismatch" });
        }

        // 2. Perform transfer ONLY if transferToUserId is provided
        if (transferToUserId) {
            // Verify transfer recipient is in the same tenant and active
            const { data: recipientUser, error: recipientErr } = await supabaseAdmin
                .from("users")
                .select("id, tenant_id")
                .eq("id", transferToUserId)
                .eq("tenant_id", tenant_id)
                .eq("status", "ACTIVE")
                .single();

            if (recipientErr || !recipientUser) {
                return res.status(400).json({ success: false, error: "Invalid transfer recipient" });
            }

            const { error: transferErr } = await supabaseAdmin.rpc("transfer_user_data", {
                p_from_user_id: userId,
                p_to_user_id: transferToUserId,
                p_tenant_id: tenant_id,
                p_admin_id: adminId
            });

            if (transferErr) {
                console.error("Transfer RPC Error:", transferErr);
                return res.status(500).json({ success: false, error: "Failed to transfer records" });
            }
        }

        // 3. Update user status to LOCKED
        const { error: lockErr } = await supabaseAdmin
            .from("users")
            .update({
                status: 'LOCKED',
                locked_at: new Date().toISOString(),
                locked_by: adminId,
                locked_reason: reason
            })
            .eq("id", userId);

        if (lockErr) {
            console.error("Lock Update Error:", lockErr);
            return res.status(500).json({ success: false, error: "Failed to update user status" });
        }

        res.json({ 
            success: true, 
            message: transferToUserId ? "User locked and records transferred successfully" : "User account locked successfully" 
        });
    } catch (err) {
        console.error("Lock error:", err);
        res.status(500).json({ success: false, error: "Lock process failed" });
    }
});

/**
 * @route POST /api/user-admin/unlock/:userId
 * @desc Unlock user account
 */
userAdminRouter.post("/unlock/:userId", verifySupabaseToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const tenant_id = req.user.tenant_id;

        // Verify user belongs to same tenant
        const { data: user, error: userErr } = await supabaseAdmin
            .from("users")
            .select("tenant_id")
            .eq("id", userId)
            .single();

        if (userErr || user.tenant_id !== tenant_id) {
            return res.status(403).json({ success: false, error: "Unauthorized" });
        }

        const { error: unlockErr } = await supabaseAdmin
            .from("users")
            .update({
                status: 'ACTIVE',
                locked_at: null,
                locked_by: null,
                locked_reason: null
            })
            .eq("id", userId);

        if (unlockErr) {
            return res.status(500).json({ success: false, error: "Failed to unlock user" });
        }

        res.json({ success: true, message: "User account unlocked" });
    } catch (err) {
        console.error("Unlock error:", err);
        res.status(500).json({ success: false, error: "Unlock process failed" });
    }
});

export default userAdminRouter;
