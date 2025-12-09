import express from "express";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simple: save email + password in report_users table
router.post("/", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const hashed = await bcrypt.hash(password, 10);

    const { error } = await supabase
      .from("report_users")
      .insert([{ email, password: hashed }]);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Report user created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
