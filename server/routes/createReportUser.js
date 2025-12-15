import express from "express";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Generate a secure random password
function generatePassword(length = 12) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  
  // Ensure at least one of each type
  password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
  password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
  password += "0123456789"[Math.floor(Math.random() * 10)];
  password += "!@#$%^&*"[Math.floor(Math.random() * 8)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Create report user with auto-generated password
router.post("/", async (req, res) => {
  try {
    const { email, tenant_id } = req.body;

    console.log("📝 Creating report user:", { email, tenant_id });

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!tenant_id) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if tenant exists
    const { data: tenantExists, error: tenantError } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", tenant_id)
      .maybeSingle();

    if (tenantError) {
      console.error("❌ Tenant lookup error:", tenantError);
      return res.status(500).json({ error: "Failed to verify tenant" });
    }

    if (!tenantExists) {
      return res.status(400).json({ error: "Invalid tenant ID" });
    }

    // Check if user already exists for this tenant
    const { data: existingUser } = await supabase
      .from("report_users")
      .select("email")
      .eq("email", email)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ 
        error: "User with this email already exists for this tenant" 
      });
    }

    // Generate a secure password
    const generatedPassword = generatePassword(12);
    console.log("🔑 Generated password for:", email);

    // Hash the password
    const hashed = await bcrypt.hash(generatedPassword, 10);

    // Insert into database
    const { data, error } = await supabase
      .from("report_users")
      .insert([{ 
        email, 
        password: hashed,
        tenant_id 
      }])
      .select();

    if (error) {
      console.error("❌ Database error:", error);
      return res.status(400).json({ error: error.message });
    }

    console.log("✅ Report user created successfully");

    // Return the plain password so it can be shown to admin once
    res.json({
      success: true,
      message: "Report user created successfully",
      email: email,
      password: generatedPassword, // Return plain password for one-time display
      tenant_id: tenant_id,
    });

  } catch (err) {
    console.error("🔥 Server error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;