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

    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    // 1️⃣ Look for user in report_users
    const { data: user, error } = await supabase
      .from("report_users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user)
      return res.status(401).json({ error: "Invalid email or password" });

    // 2️⃣ Compare password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: "Invalid email or password" });

    // 3️⃣ SUCCESS
    res.json({ message: "Login success", userId: user.id });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
