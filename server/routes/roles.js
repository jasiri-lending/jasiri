import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// 1. Get all roles for the tenant
router.get("/", verifySupabaseToken, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("roles")
            .select(`
                *,
                role_permissions(
                    permissions(*)
                )
            `)
            .eq("tenant_id", req.user.tenant_id)
            .order("name");

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Get available system permissions
router.get("/permissions", verifySupabaseToken, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("permissions")
            .select("*")
            .order("category", { ascending: true })
            .order("name", { ascending: true });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Create a new role
router.post("/", verifySupabaseToken, async (req, res) => {
    const { name, description, base_role, is_system } = req.body;
    try {
        const { data, error } = await supabaseAdmin
            .from("roles")
            .insert({
                tenant_id: req.user.tenant_id,
                name,
                description,
                base_role: base_role || 'VIEWER',
                is_system: is_system || false
            })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Update a role
router.put("/:id", verifySupabaseToken, async (req, res) => {
    const { id } = req.params;
    const { name, description, base_role } = req.body;
    try {
        const { data, error } = await supabaseAdmin
            .from("roles")
            .update({ name, description, base_role, updated_at: new Date() })
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

// 5. Update role permissions
router.post("/:id/permissions", verifySupabaseToken, async (req, res) => {
    const { id } = req.params;
    const { permission_ids } = req.body; // Array of UUIDs

    try {
        // First, delete existing permissions for this role
        await supabaseAdmin.from("role_permissions").delete().eq("role_id", id);

        if (permission_ids && permission_ids.length > 0) {
            const inserts = permission_ids.map(p_id => ({
                role_id: id,
                permission_id: p_id
            }));

            const { error } = await supabaseAdmin.from("role_permissions").insert(inserts);
            if (error) throw error;
        }

        res.json({ success: true, message: "Permissions updated successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. Delete a role
router.delete("/:id", verifySupabaseToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Check if role is system role
        const { data: role } = await supabaseAdmin.from("roles").select("is_system").eq("id", id).single();
        if (role?.is_system) {
            return res.status(403).json({ success: false, error: "System roles cannot be deleted" });
        }

        const { error } = await supabaseAdmin
            .from("roles")
            .delete()
            .eq("id", id)
            .eq("tenant_id", req.user.tenant_id);

        if (error) throw error;
        res.json({ success: true, message: "Role deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
