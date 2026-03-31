import express from "express";
import bcrypt from "bcryptjs";
import { supabase, supabaseAdmin } from "../supabaseClient.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Apply auth rate limiter to this login endpoint
router.use(authLimiter);

// POST /api/checkReportUser
router.post("/", async (req, res) => {
  try {
    const { branch_id, password, tenant_id } = req.body;

    console.log("🔐 Report login attempt:", { branch_id, tenant_id });

    if (!password) {
      return res.status(400).json({
        error: "Password is required",
      });
    }

    if (!tenant_id) {
      return res.status(400).json({
        error: "Tenant ID is required",
      });
    }

    let authenticated = false;
    let displayName = "";
    let userId = "";

    if (branch_id) {
      // Fetch branch with tenant_id validation
      const { data: branch, error } = await supabaseAdmin
        .from("branches")
        .select("id, name, report_password, tenant_id")
        .eq("id", branch_id)
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (error) {
        console.error("❌ Supabase branch error:", error);
        return res.status(500).json({ error: "Database error during branch lookup" });
      }

      if (branch && branch.report_password) {
        authenticated = await bcrypt.compare(password, branch.report_password);
        displayName = branch.name;
        userId = branch.id;
      }
    } else {
      // If no branch_id, check tenant master password (for admins/HQ)
      const { data: tenant, error } = await supabaseAdmin
        .from("tenants")
        .select("id, name, report_password")
        .eq("id", tenant_id)
        .maybeSingle();

      if (error) {
        console.error("❌ Supabase tenant error:", error);
        return res.status(500).json({ error: "Database error during tenant lookup" });
      }

      if (tenant && tenant.report_password) {
        authenticated = await bcrypt.compare(password, tenant.report_password);
        displayName = `Admin (${tenant.name})`;
        userId = `admin-${tenant.id}`;
      }
    }

    if (!authenticated) {
      console.warn("⚠️ Authentication failed for:", { branch_id, tenant_id });
      return res.status(401).json({ error: "Invalid password for selected branch or admin access" });
    }

    console.log("✅ Report login success:", { userId, tenant_id, displayName });

    res.json({
      success: true,
      message: "Login success",
      userId,
      branchName: displayName,
      tenant_id: tenant_id,
    });

  } catch (err) {
    console.error("🔥 Report login server error:", err);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;