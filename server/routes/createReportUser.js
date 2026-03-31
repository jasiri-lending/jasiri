import express from "express";
import bcrypt from "bcryptjs";
import { supabase, supabaseAdmin } from "../supabaseClient.js";
import crypto from "crypto";

const router = express.Router();

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

// Create/Update branch or tenant master report access password
router.post("/", async (req, res) => {
  try {
    const { branch_id, tenant_id } = req.body;

    console.log("📝 Setting report password:", { branch_id, tenant_id });

    if (!tenant_id) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    let targetName = "";
    let updateTable = "";
    let updateId = "";

    if (branch_id) {
      // Branch-specific password
      const { data: branch, error: branchError } = await supabaseAdmin
        .from("branches")
        .select("id, name")
        .eq("id", branch_id)
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      if (branchError || !branch) {
        return res.status(400).json({ error: "Invalid branch ID or tenant mismatch" });
      }
      targetName = `Branch: ${branch.name}`;
      updateTable = "branches";
      updateId = branch_id;
    } else {
      // Tenant master password
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .select("id, name")
        .eq("id", tenant_id)
        .maybeSingle();

      if (tenantError || !tenant) {
        return res.status(400).json({ error: "Invalid tenant ID" });
      }
      targetName = `Tenant Master (HQ): ${tenant.name}`;
      updateTable = "tenants";
      updateId = tenant_id;
    }

    // Generate a secure password
    const generatedPassword = generatePassword(12);
    console.log("🔑 Generated password for:", targetName);

    // Hash the password
    const hashed = await bcrypt.hash(generatedPassword, 10);

    // Update record
    const { error: updateError } = await supabaseAdmin
      .from(updateTable)
      .update({
        report_password: hashed
      })
      .eq("id", updateId);

    if (updateError) {
      console.error("❌ Database update error:", updateError);
      return res.status(400).json({ error: updateError.message });
    }

    console.log("✅ Report password set successfully for:", targetName);

    res.json({
      success: true,
      message: `Report password for ${targetName} set successfully`,
      target: targetName,
      password: generatedPassword,
      tenant_id: tenant_id,
    });

  } catch (err) {
    console.error("🔥 Server error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;