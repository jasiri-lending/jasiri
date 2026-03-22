import express from "express";
import { verifySupabaseToken, checkTenantAccess } from "../middleware/authMiddleware.js";
import { calculateCreditScore } from "../services/scoringService.js";
import { supabase, supabaseAdmin } from "../supabaseClient.js";

const router = express.Router();

// Apply auth and tenant checks
router.use(verifySupabaseToken);
router.use(checkTenantAccess);

/**
 * POST /api/scoring/calculate/:customerId
 * Trigger a new credit score calculation
 */
router.post("/calculate/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;
    const tenantId = req.user.tenant_id;

    if (!customerId) {
      return res.status(400).json({ success: false, error: "Customer ID is required" });
    }

    const result = await calculateCreditScore(customerId, tenantId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scoring/:customerId
 * Fetch latest score for a customer
 */
router.get("/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;
    const tenantId = req.user.tenant_id;

    const { data, error } = await supabase
      .from("credit_scores")
      .select("*")
      .eq("customer_id", customerId)
      .eq("tenant_id", tenantId)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "No records found"

    res.json({ success: true, data: data || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scoring/rules
 * Create or update a scoring rule
 */
router.post("/rules", async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { rule_name, rule_type, condition, score_impact, is_active } = req.body;

    if (!rule_name || !condition || score_impact === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const { data, error } = await supabaseAdmin
      .from("scoring_rules")
      .insert({
        tenant_id: tenantId,
        rule_name,
        rule_type,
        condition,
        score_impact,
        is_active: is_active !== undefined ? is_active : true
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scoring/rules
 * List rules for tenant
 */
router.get("/rules", async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    const { data, error } = await supabase
      .from("scoring_rules")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
