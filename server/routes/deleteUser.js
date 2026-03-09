import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply authentication to all routes
router.use(verifySupabaseToken);

// DELETE USER PERMANENTLY
router.delete("/users/:id", async (req, res) => {
    const { id } = req.params; // this should be auth.users.id
    const requester = req.user;

    // RBAC: Only admin or superadmin
    if (requester.role !== "superadmin" && requester.role !== "admin") {
        return res.status(403).json({ success: false, error: "Unauthorized. Admin role required." });
    }

    try {
        console.log(`🗑️ Attempting to delete user: ${id}`);

        // Fetch target user to check tenant if requester is just an admin
        const { data: targetUser, error: fetchError } = await supabaseAdmin
            .from("users")
            .select("tenant_id")
            .eq("id", id)
            .single();

        if (fetchError || !targetUser) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        if (requester.role === "admin" && requester.tenant_id !== targetUser.tenant_id) {
            return res.status(403).json({ success: false, error: "Access denied. Cannot delete user from another tenant." });
        }

        // 1️⃣ Delete from Supabase Auth (THIS IS THE IMPORTANT PART)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (authError) {
            console.error("Auth delete error:", authError);
            return res.status(400).json({
                success: false,
                error: authError.message
            });
        }

        console.log(`✅ User ${id} permanently deleted from auth and database`);

        // 2️⃣ No need to delete from public.users manually
        // Your FK `ON DELETE CASCADE` handles it automatically

        res.json({
            success: true,
            message: "User permanently deleted"
        });

    } catch (err) {
        console.error("Delete user error:", err);
        res.status(500).json({
            success: false,
            error: "Server error"
        });
    }
});

export default router;
