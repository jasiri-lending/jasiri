import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// 1. Get all groups for the tenant
router.get("/", verifySupabaseToken, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("user_groups")
            .select(`
                *,
                user_group_members(count)
            `)
            .eq("tenant_id", req.user.tenant_id)
            .order("name");

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Get group members
router.get("/:id/members", verifySupabaseToken, async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabaseAdmin
            .from("user_group_members")
            .select(`
                user_id,
                users (
                    id,
                    full_name,
                    email,
                    role
                )
            `)
            .eq("group_id", id);

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Create a group
router.post("/", verifySupabaseToken, async (req, res) => {
    const { name, description } = req.body;
    try {
        const { data, error } = await supabaseAdmin
            .from("user_groups")
            .insert({
                tenant_id: req.user.tenant_id,
                name,
                description
            })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3.5 Update a group
router.put("/:id", verifySupabaseToken, async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    try {
        const { data, error } = await supabaseAdmin
            .from("user_groups")
            .update({ name, description, updated_at: new Date() })
            .eq("id", id)
            .eq("tenant_id", req.user.tenant_id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Add member to group
router.post("/:id/members", verifySupabaseToken, async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body;
    try {
        const { error } = await supabaseAdmin
            .from("user_group_members")
            .insert({
                group_id: id,
                user_id
            });

        if (error) throw error;
        res.json({ success: true, message: "Member added successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Remove member from group
router.delete("/:id/members/:user_id", verifySupabaseToken, async (req, res) => {
    const { id, user_id } = req.params;
    try {
        const { error } = await supabaseAdmin
            .from("user_group_members")
            .delete()
            .eq("group_id", id)
            .eq("user_id", user_id);

        if (error) throw error;
        res.json({ success: true, message: "Member removed successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. Delete a group
router.delete("/:id", verifySupabaseToken, async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabaseAdmin
            .from("user_groups")
            .delete()
            .eq("id", id)
            .eq("tenant_id", req.user.tenant_id);

        if (error) throw error;
        res.json({ success: true, message: "Group deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
