import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

// Use SERVICE ROLE KEY (NOT anon key)
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// DELETE USER PERMANENTLY
router.delete("/users/:id", async (req, res) => {
    const { id } = req.params; // this should be auth.users.id

    try {
        console.log(`🗑️ Attempting to delete user: ${id}`);

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
