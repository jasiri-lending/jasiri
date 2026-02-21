import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";

const router = express.Router();

// Get all loan products for a tenant
router.get("/", async (req, res) => {
    try {
        const { tenant_id } = req.query;

        if (!tenant_id) {
            return res.status(400).json({ success: false, error: "Tenant ID is required" });
        }

        const { data, error } = await supabaseAdmin
            .from("loan_products")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error("Error fetching loan products:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create a new loan product
router.post("/", async (req, res) => {
    try {
        const { tenant_id, product_name, min_amount, max_amount, registration_fee } = req.body;

        if (!tenant_id || !product_name || !min_amount) {
            return res.status(400).json({ success: false, error: "Missing required fields" });
        }

        const { data, error } = await supabaseAdmin
            .from("loan_products")
            .insert([
                {
                    tenant_id,
                    product_name,
                    min_amount,
                    max_amount: max_amount || null,
                    registration_fee: registration_fee || 0,
                },
            ])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error("Error creating loan product:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update a loan product
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { tenant_id, product_name, min_amount, max_amount, registration_fee } = req.body;

        if (!tenant_id || !product_name || !min_amount) {
            return res.status(400).json({ success: false, error: "Missing required fields (tenant_id, name, min_amount)" });
        }

        const { data, error } = await supabaseAdmin
            .from("loan_products")
            .update({
                product_name,
                min_amount,
                max_amount: max_amount || null,
                registration_fee: registration_fee || 0,
            })
            .eq("id", id)
            .eq("tenant_id", tenant_id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error("Error updating loan product:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update registration_fee for ALL products of a tenant (Global Joining Fee)
router.put("/global/registration-fee", async (req, res) => {
    try {
        const { tenant_id, registration_fee } = req.body;

        if (!tenant_id || registration_fee === undefined) {
            return res.status(400).json({ success: false, error: "Tenant ID and registration fee are required" });
        }

        const { data, error } = await supabaseAdmin
            .from("loan_products")
            .update({ registration_fee })
            .eq("tenant_id", tenant_id);

        if (error) throw error;

        res.json({ success: true, message: `Registration fee updated to ${registration_fee} for all products.` });
    } catch (error) {
        console.error("Error updating global registration fee:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete a loan product
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { tenant_id } = req.query;

        if (!tenant_id) {
            return res.status(400).json({ success: false, error: "Tenant ID is required for deletion" });
        }

        const { error } = await supabaseAdmin
            .from("loan_products")
            .delete()
            .eq("id", id)
            .eq("tenant_id", tenant_id);

        if (error) throw error;

        res.json({ success: true, message: "Product deleted successfully" });
    } catch (error) {
        console.error("Error deleting loan product:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all loan product types (optionally filtered by loan_product_id)
router.get("/types", async (req, res) => {
    try {
        const { tenant_id, loan_product_id } = req.query;

        if (!tenant_id) {
            return res.status(400).json({ success: false, error: "Tenant ID is required" });
        }

        let query = supabaseAdmin
            .from("loan_product_types")
            .select(`
        *,
        loan_products (
          product_name
        )
      `)
            .eq("tenant_id", tenant_id)
            .order("created_at", { ascending: false });

        if (loan_product_id) {
            query = query.eq("loan_product_id", loan_product_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error("Error fetching loan product types:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create a new loan product type
router.post("/types", async (req, res) => {
    try {
        const {
            tenant_id,
            loan_product_id,
            product_type,
            duration_weeks,
            interest_rate,
            processing_fee_rate,
            processing_fee_mode,
            registration_fee,
            penalty_rate
        } = req.body;

        if (
            !tenant_id ||
            !loan_product_id ||
            !product_type ||
            !duration_weeks ||
            interest_rate === undefined ||
            !processing_fee_mode
        ) {
            return res.status(400).json({ success: false, error: "Missing required fields" });
        }

        const { data, error } = await supabaseAdmin
            .from("loan_product_types")
            .insert([
                {
                    tenant_id,
                    loan_product_id,
                    product_type,
                    duration_weeks,
                    interest_rate,
                    processing_fee_rate: processing_fee_rate || 0,
                    processing_fee_mode: processing_fee_mode || 'percentage',
                    registration_fee: registration_fee || 0,
                    penalty_rate: penalty_rate || 0,
                },
            ])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error("Error creating loan product type:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update a loan product type
router.put("/types/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const {
            tenant_id,
            product_type,
            duration_weeks,
            interest_rate,
            processing_fee_rate,
            processing_fee_mode,
            registration_fee,
            penalty_rate
        } = req.body;

        if (
            !tenant_id ||
            !product_type ||
            !duration_weeks ||
            interest_rate === undefined ||
            !processing_fee_mode
        ) {
            return res.status(400).json({ success: false, error: "Missing required fields" });
        }

        const { data, error } = await supabaseAdmin
            .from("loan_product_types")
            .update({
                product_type,
                duration_weeks,
                interest_rate,
                processing_fee_rate: processing_fee_rate || 0,
                processing_fee_mode: processing_fee_mode || 'percentage',
                registration_fee: registration_fee || 0,
                penalty_rate: penalty_rate || 0,
            })
            .eq("id", id)
            .eq("tenant_id", tenant_id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error("Error updating loan product type:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete a loan product type
router.delete("/types/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { tenant_id } = req.query;

        if (!tenant_id) {
            return res.status(400).json({ success: false, error: "Tenant ID is required" });
        }

        const { error } = await supabaseAdmin
            .from("loan_product_types")
            .delete()
            .eq("id", id)
            .eq("tenant_id", tenant_id);

        if (error) throw error;

        res.json({ success: true, message: "Product type deleted successfully" });
    } catch (error) {
        console.error("Error deleting loan product type:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
