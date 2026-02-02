import express from "express";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST /api/checkReportUser
router.post("/", async (req, res) => {
  try {
    const { email, password, tenant_id } = req.body;

    console.log("🔐 Login attempt:", { email, tenant_id });

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    if (!tenant_id) {
      return res.status(400).json({
        error: "Tenant ID is required",
      });
    }

    // Fetch user with tenant_id validation
    const { data: user, error } = await supabaseAdmin
      .from("report_users")
      .select("id, email, password, tenant_id, created_at")
      .eq("email", email)
      .eq("tenant_id", tenant_id) // Must match the logged-in user's tenant
      .maybeSingle();

    if (error) {
      console.error("❌ Supabase error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    if (!user) {
      console.warn("⚠️ User not found or tenant mismatch:", email);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      console.warn("⚠️ Invalid password:", email);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    console.log("✅ Login success:", { userId: user.id, tenant: user.tenant_id });

    res.json({
      success: true,
      message: "Login success",
      userId: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
    });

  } catch (err) {
    console.error("🔥 Login server error:", err);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;