import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken, checkTenantAccess } from "../middleware/authMiddleware.js";

const accountRouter = express.Router();

// Apply authentication to all account routes
accountRouter.use(verifySupabaseToken);

// GET /api/chart-of-accounts - Get accounts for tenant
accountRouter.get("/", checkTenantAccess, async (req, res) => {
    try {
        const tenant_id = req.user.tenant_id;
        const { account_type } = req.query;

        let query = supabaseAdmin
            .from("chart_of_accounts")
            .select("*")
            .eq("tenant_id", tenant_id);

        if (account_type) {
            query = query.ilike("account_type", account_type);
        }

        const { data: accounts, error } = await query.order("created_at", { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            accounts: accounts || []
        });
    } catch (error) {
        console.error("Error fetching accounts:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch accounts",
            details: error.message
        });
    }
});

// POST /api/chart-of-accounts - Create or update account
accountRouter.post("/", async (req, res) => {
    try {
        const tenant_id = req.user.tenant_id;
        const { id, account_name, account_type, account_category, code, status } = req.body;

        if (!account_name || !account_type || !account_category) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: account_name, account_type, account_category"
            });
        }

        const accountData = {
            tenant_id,
            account_name,
            account_type,
            account_category,
            code: code || null,
            status: status || "Active"
        };

        let result;
        if (id) {
            // Update
            result = await supabaseAdmin
                .from("chart_of_accounts")
                .update(accountData)
                .eq("id", id)
                .eq("tenant_id", tenant_id)
                .select()
                .single();
        } else {
            // Create
            result = await supabaseAdmin
                .from("chart_of_accounts")
                .insert([accountData])
                .select()
                .single();
        }

        if (result.error) throw result.error;

        res.json({
            success: true,
            message: id ? "Account updated successfully" : "Account created successfully",
            account: result.data
        });
    } catch (error) {
        console.error("Error saving account:", error);
        res.status(500).json({
            success: false,
            error: "Failed to save account",
            details: error.message
        });
    }
});

// DELETE /api/chart-of-accounts/:id - Delete account
accountRouter.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const tenant_id = req.user.tenant_id;

        const { error } = await supabaseAdmin
            .from("chart_of_accounts")
            .delete()
            .eq("id", id)
            .eq("tenant_id", tenant_id);

        if (error) throw error;

        res.json({
            success: true,
            message: "Account deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting account:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete account",
            details: error.message
        });
    }
});

export default accountRouter;
