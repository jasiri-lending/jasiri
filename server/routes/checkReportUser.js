import express from "express";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST /api/checkReportUser
router.post("/", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("🔐 Login attempt:", email);

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const { data: user, error } = await supabase
      .from("report_users")
      .select("id, email, password")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("❌ Supabase error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    if (!user) {
      console.warn("⚠️ User not found:", email);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      console.warn("⚠️ Invalid password:", email);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    console.log("✅ Login success:", user.id);

    res.json({
      message: "Login success",
      userId: user.id,
    });

  } catch (err) {
    console.error("🔥 Login server error:", err);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

export default router;
