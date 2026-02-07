import express from "express";
import { supabase, supabaseAdmin } from "../supabaseClient.js";
import crypto from "crypto";
import { baseEmailTemplate, styledHighlightBox, infoBox } from "../utils/emailTemplates.js";
import transporter from "../utils/mailer.js";

const Authrouter = express.Router();

// Email transporter is now handled in ../utils/mailer.js

// Email transporter is now handled in ../utils/mailer.js

// Helper function to get current UTC time as ISO string
const getCurrentUTC = () => {
  return new Date().toISOString();
};

// Helper function to add minutes to current time and return ISO string
const addMinutesToNow = (minutes) => {
  const now = new Date();
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString();
};

// Helper function to check if a timestamp has expired
const isExpired = (expiryTimestamp) => {
  if (!expiryTimestamp) return true;

  const now = new Date();
  const expiry = new Date(expiryTimestamp);

  // Log for debugging
  console.log('Expiry check:', {
    nowUTC: now.toISOString(),
    expiryUTC: expiry.toISOString(),
    nowTime: now.getTime(),
    expiryTime: expiry.getTime(),
    isExpired: expiry.getTime() < now.getTime()
  });

  return expiry.getTime() < now.getTime();
};

// POST /api/login - send verification code
Authrouter.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Get user by email
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (userError || !user) {
      console.error("Login attempt failed, user not found:", userError);
      return res.status(400).json({ success: false, error: "Invalid credentials" });
    }

    // Verify password using Supabase auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData?.user) {
      console.error("Login password verification failed:", authError);
      return res.status(400).json({ success: false, error: "Invalid credentials" });
    }

    // Generate verification code - Use consistent UTC time
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiresAt = addMinutesToNow(5); // 10 minutes from now
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionExpiresAt = addMinutesToNow(10080); // 7 days from now

    console.log(`Generated code for ${email}:`, {
      code: verificationCode,
      expiresAt: verificationExpiresAt,
      currentTime: getCurrentUTC()
    });

    // Save code and token in DB
    await supabaseAdmin.from("users").update({
      verification_code: verificationCode,
      verification_expires_at: verificationExpiresAt,
      session_token: sessionToken,
      session_expires_at: sessionExpiresAt
    }).eq("id", user.id);

    // Send code via email   change it to the company mail in future
    await transporter.sendMail({
      from: '"Jasirilendingsoftware" <malobaamazing@gmail.com>',
      to: email,
      subject: "Your Login Verification Code",
      text: `Your login code is ${verificationCode}. It expires in 10 minutes.`,
      html: baseEmailTemplate("Login Verification", `
        <p>Hello,</p>
        <p>Use the following secure code to complete your login. For your security, this code is valid for 10 minutes.</p>
        ${styledHighlightBox(verificationCode)}
        ${infoBox("If you didn't request this code, your account is still secure, but we recommend checking your security settings.")}
      `)
    });

    console.log(`Verification code sent to ${email}: ${verificationCode}`);

    res.json({ success: true, message: "Verification code sent", userId: user.id });
  } catch (err) {
    console.error("Login crash:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/resend-code - resend verification code
Authrouter.post("/resend-code", async (req, res) => {
  const { userId, email } = req.body;

  try {
    // Check if user exists
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .or(`id.eq.${userId},email.eq.${email}`)
      .single();

    if (error || !user) {
      console.error("Resend code user error:", error);
      return res.status(400).json({ success: false, error: "User not found" });
    }

    // Generate new code - Use consistent UTC time
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiresAt = addMinutesToNow(10); // 10 minutes from now

    // Update user with new code
    await supabaseAdmin.from("users").update({
      verification_code: verificationCode,
      verification_expires_at: verificationExpiresAt
    }).eq("id", user.id);

    // Send new code via email
    await transporter.sendMail({
      from: '"Jasirilendingsoftware" <malobaamazing@gmail.com>',
      to: user.email,
      subject: "Your New Verification Code",
      text: `Your new verification code is ${verificationCode}. It expires in 10 minutes.`,
      html: baseEmailTemplate("New Verification Code", `
        <p>Someone (hopefully you) requested a new verification code. This code replaces any previous codes and is valid for 10 minutes.</p>
        ${styledHighlightBox(verificationCode)}
        <p>Please enter this code on the verification screen to continue.</p>
      `)
    });

    console.log(`New verification code sent to ${user.email}: ${verificationCode}`);

    res.json({
      success: true,
      message: "New verification code sent",
      userId: user.id
    });
  } catch (err) {
    console.error("Resend code crash:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/verify-code - final login - UPDATED
Authrouter.post("/verify-code", async (req, res) => {
  const { userId, code } = req.body;

  if (!userId || !code) {
    return res.status(400).json({ success: false, error: "Missing verification details" });
  }

  try {
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !user) {
      console.error("Verify code user error:", error);
      return res.status(400).json({ success: false, error: "User not found" });
    }

    // Check code exists
    if (!user.verification_code) {
      return res.status(400).json({ success: false, error: "No active verification code" });
    }

    // Code verification
    if (user.verification_code !== code) {
      console.error(`Code mismatch for ${user.email}`);
      return res.status(400).json({ success: false, error: "Invalid code" });
    }

    // Expiry check
    if (!user.verification_expires_at || isExpired(user.verification_expires_at)) {
      console.error("Code expired for user:", user.email);
      return res.status(400).json({ success: false, error: "Code expired" });
    }

    // Generate NEW session
    const newSessionToken = crypto.randomBytes(32).toString("hex");
    const sessionExpiresAt = addMinutesToNow(10080);

    const { error: updateError } = await supabaseAdmin.from("users").update({
      verification_code: null,
      verification_expires_at: null,
      session_token: newSessionToken,
      session_expires_at: sessionExpiresAt,
      last_login: new Date().toISOString(), // Track login time
    }).eq("id", userId);

    if (updateError) {
      console.error("Session update error:", updateError);
      return res.status(500).json({ success: false, error: "Could not create session" });
    }

    console.log(`New session created for ${user.email}`);

    return res.json({
      success: true,
      message: "Verification successful",
      sessionToken: newSessionToken,
      expiresAt: sessionExpiresAt,
      userId: userId, // Explicitly return userId
      email: user.email // Return email for debugging
    });

  } catch (err) {
    console.error("Verify code crash:", err);
    res.status(500).json({ success: false, error: "Server error during verification" });
  }
});



// POST /api/forgot-password - send reset code
Authrouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user exists
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      console.error("Forgot password user error:", error);
      return res.status(400).json({ success: false, error: "User not found" });
    }

    // Generate reset code - Use consistent UTC time
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpiresAt = addMinutesToNow(15); // 15 minutes from now

    console.log(`Generated reset code for ${email}:`, {
      code: resetCode,
      expiresAt: resetCodeExpiresAt,
      currentTime: getCurrentUTC()
    });

    // Save reset code in DB
    await supabaseAdmin.from("users").update({
      reset_code: resetCode,
      reset_code_expires_at: resetCodeExpiresAt
    }).eq("id", user.id);

    // Send reset code via email
    await transporter.sendMail({
      from: '"Jasirilendingsoftware" <malobaamazing@gmail.com>',
      to: email,
      subject: "Password Reset Code",
      text: `Your password reset code is ${resetCode}. It expires in 15 minutes.`,
      html: baseEmailTemplate("Password Reset Request", `
        <p>Recently, a request was made to reset the password for your account.</p>
        <p>Please use the verification code below to proceed with resetting your password. This code is valid for 15 minutes.</p>
        ${styledHighlightBox(resetCode)}
        ${infoBox("If you did not request this reset, please ignore this email. No changes will be made to your account.")}
      `)
    });

    console.log(`Reset code sent to ${email}: ${resetCode}`);

    res.json({
      success: true,
      message: "Reset code sent to email",
      expiresIn: "15 minutes"
    });
  } catch (err) {
    console.error("Forgot password crash:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/resend-reset-code - resend password reset code
Authrouter.post("/resend-reset-code", async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user exists
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      console.error("Resend reset code user error:", error);
      return res.status(400).json({ success: false, error: "User not found" });
    }

    // Generate new reset code - Use consistent UTC time
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpiresAt = addMinutesToNow(15); // 15 minutes from now

    // Update user with new reset code
    await supabaseAdmin.from("users").update({
      reset_code: resetCode,
      reset_code_expires_at: resetCodeExpiresAt
    }).eq("id", user.id);

    // Send new reset code via email
    await transporter.sendMail({
      from: '"Jasirilendingsoftware" <malobaamazing@gmail.com>',
      to: email,
      subject: "Your New Password Reset Code",
      text: `Your new password reset code is ${resetCode}. It expires in 15 minutes.`,
      html: baseEmailTemplate("New Reset Code", `
        <p>A new password reset code has been generated as requested.</p>
        ${styledHighlightBox(resetCode)}
        <p>This code expires in 15 minutes from now.</p>
      `)
    });

    console.log(`New reset code sent to ${email}: ${resetCode}`);

    res.json({
      success: true,
      message: "New reset code sent to email",
      expiresIn: "15 minutes"
    });
  } catch (err) {
    console.error("Resend reset code crash:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/reset-password - verify reset code and update password
Authrouter.post("/reset-password", async (req, res) => {
  const { email, resetCode, newPassword } = req.body;

  try {
    // Check if user exists
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      console.error("Reset password user error:", error);
      return res.status(400).json({ success: false, error: "User not found" });
    }

    // Verify reset code
    if (user.reset_code !== resetCode) {
      console.error(`Reset code mismatch for ${email}`);
      return res.status(400).json({ success: false, error: "Invalid reset code" });
    }

    // Check if reset code expired using proper UTC comparison
    if (isExpired(user.reset_code_expires_at)) {
      console.error("Reset code expired for user:", email);
      return res.status(400).json({ success: false, error: "Reset code expired" });
    }

    // Use admin API to update password without requiring user session
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.auth_id,  // Use the auth.users ID, not your public.users ID
      { password: newPassword }
    );

    if (updateError) {
      console.error("Supabase admin password update error:", updateError);

      // Fallback: Try to update user password through auth API
      try {
        // Generate a reset token instead
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

        if (resetError) {
          throw new Error("Failed to reset password. Please try the forgot password process again.");
        }

        return res.json({
          success: true,
          message: "Password reset link sent to your email. Please check your inbox to complete the reset."
        });
      } catch (fallbackError) {
        console.error("Fallback password reset error:", fallbackError);
        throw new Error("Failed to update password. Please contact support.");
      }
    }

    // Clear reset code after successful password update
    await supabaseAdmin.from("users").update({
      reset_code: null,
      reset_code_expires_at: null,
      must_change_password: false
    }).eq("id", user.id);

    console.log(`Password reset successful for ${email}`);

    // Send confirmation email
    await transporter.sendMail({
      from: '"Jasirilendingsoftware" <malobaamazing@gmail.com>',
      to: email,
      subject: "Password Reset Successful",
      text: "Your password has been successfully reset. You can now login with your new password.",
      html: baseEmailTemplate("Password Reset Successful", `
        <p>Success! Your Jasiri account password has been updated.</p>
        <p>You can now use your new password to log in to the dashboard.</p>
        ${infoBox("If you did not perform this action, please contact our security team immediately to secure your account.", "Security Warning")}
      `)
    });

    res.json({
      success: true,
      message: "Password reset successful"
    });
  } catch (err) {
    console.error("Reset password crash:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add middleware to verify session token
const verifySession = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No session token provided' });
    }

    const sessionToken = authHeader.split(' ')[1];
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("session_token", sessionToken)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid session token' });
    }

    // Check if session expired
    if (isExpired(user.session_expires_at)) {
      return res.status(401).json({ success: false, error: 'Session expired' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Session verification error:", err);
    res.status(500).json({ success: false, error: 'Session verification failed' });
  }
};

// GET /api/profile/:userId - get user profile
Authrouter.get("/profile/:userId", verifySession, async (req, res) => {
  const { userId } = req.params;

  // Ensure user can only access their own profile
  if (req.user.id !== userId) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    console.log(`\n🔍 [PROFILE] Starting profile fetch for userId: ${userId}`);

    // Fetch user details INCLUDING tenant_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, full_name, email, role, tenant_id, must_change_password")
      .eq("id", userId)
      .single();

    if (userError || !userData) {
      console.error("❌ [PROFILE] User fetch error:", userError);
      return res.status(404).json({ success: false, error: "User not found" });
    }

    console.log(`✅ [PROFILE] User data:`, {
      email: userData.email,
      role: userData.role,
      tenant_id: userData.tenant_id
    });

    // Fetch profile info (branch/region)
    const { data: basicProfile, error: basicError } = await supabaseAdmin
      .from("profiles")
      .select("branch_id, region_id, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    console.log(`📋 [PROFILE] Profile table data:`, {
      exists: !!basicProfile,
      branch_id: basicProfile?.branch_id || 'null',
      region_id: basicProfile?.region_id || 'null',
      error: basicError?.message || 'none'
    });

    let branchName = "N/A";
    let branchCode = null;
    let regionName = "N/A";
    let tenantData = null;
    let finalBranchId = basicProfile?.branch_id || null;
    let finalRegionId = basicProfile?.region_id || null;

    // Fetch branch data (including region_id from branch)
    if (finalBranchId) {
      console.log(`🏢 [PROFILE] Fetching branch data for branch_id: ${finalBranchId}`);

      const { data: branchData, error: branchError } = await supabaseAdmin
        .from("branches")
        .select("name, code, region_id")
        .eq("id", finalBranchId)
        .single();

      console.log(`🏢 [PROFILE] Branch query result:`, {
        found: !!branchData,
        name: branchData?.name || 'null',
        code: branchData?.code || 'null',
        region_id: branchData?.region_id || 'null',
        error: branchError?.message || 'none'
      });

      if (branchData) {
        branchName = branchData.name;
        branchCode = branchData.code;

        // If no region_id in profile, use branch's region_id
        if (!finalRegionId && branchData.region_id) {
          finalRegionId = branchData.region_id;
          console.log(`📍 [PROFILE] Using region_id from branch: ${finalRegionId}`);
        }
      }
    } else {
      console.log(`⚠️ [PROFILE] No branch_id found in profile`);
    }

    // Fetch region name
    if (finalRegionId) {
      console.log(`🌍 [PROFILE] Fetching region data for region_id: ${finalRegionId}`);

      const { data: regionData, error: regionError } = await supabaseAdmin
        .from("regions")
        .select("name")
        .eq("id", finalRegionId)
        .single();

      console.log(`🌍 [PROFILE] Region query result:`, {
        found: !!regionData,
        name: regionData?.name || 'null',
        error: regionError?.message || 'none'
      });

      if (regionData) {
        regionName = regionData.name;
        console.log(`✅ [PROFILE] Region name resolved: ${regionName}`);
      } else {
        console.log(`❌ [PROFILE] Region not found for region_id: ${finalRegionId}`);
      }
    } else {
      console.log(`⚠️ [PROFILE] No region_id found (neither in profile nor branch)`);
    }

    // Fetch tenant data if tenant_id exists
    if (userData.tenant_id) {
      console.log(`🏭 [PROFILE] Fetching tenant data for tenant_id: ${userData.tenant_id}`);

      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .select("*")
        .eq("id", userData.tenant_id)
        .single();

      if (!tenantError && tenant) {
        tenantData = tenant;
        console.log(`✅ [PROFILE] Tenant fetched: ${tenant.company_name}`);
      } else {
        console.log(`❌ [PROFILE] Tenant fetch failed:`, tenantError?.message);
      }
    }

    const profileData = {
      id: userData.id,
      full_name: userData.full_name,
      name: userData.full_name,
      email: userData.email,
      role: userData.role,
      tenant_id: userData.tenant_id,
      branch_id: finalBranchId,
      region_id: finalRegionId,
      avatar_url: basicProfile?.avatar_url || null,
      branch: branchName,
      branch_code: branchCode,
      region: regionName,
      must_change_password: userData.must_change_password
    };

    console.log(`📊 [PROFILE] Final profile data:`, {
      email: profileData.email,
      role: profileData.role,
      branch_id: profileData.branch_id,
      branch: profileData.branch,
      region_id: profileData.region_id,
      region: profileData.region,
      tenant: tenantData?.company_name || 'null'
    });

    console.log(`✅ [PROFILE] Profile fetch complete for ${userData.email}\n`);

    // Return both profile and tenant data
    res.json({
      ...profileData,
      tenant: tenantData
    });

  } catch (err) {
    console.error("💥 [PROFILE] Profile fetch crash:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add to your Authrouter.js file

// POST /api/request-password-change-code - Send password change verification code
Authrouter.post("/request-password-change-code", verifySession, async (req, res) => {
  const { email } = req.body;

  try {
    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiresAt = addMinutesToNow(10);

    console.log(`Generated password change code for ${email}:`, {
      code: verificationCode,
      expiresAt: verificationExpiresAt
    });

    // Save code in DB
    await supabaseAdmin.from("users").update({
      password_change_code: verificationCode,
      password_change_expires_at: verificationExpiresAt
    }).eq("email", email);

    // Send code via email
    await transporter.sendMail({
      from: '"Jasirilendingsoftware" <malobaamazing@gmail.com>',
      to: email,
      subject: "Password Change Verification Code",
      html: baseEmailTemplate("Password Change Verification", `
        <p>You requested to change your password. For verification, please enter the following code:</p>
        ${styledHighlightBox(verificationCode)}
        <p>Wait, if this wasn't you, your account password won't be changed without this code. You may want to update your security settings if you didn't expect this.</p>
      `)
    });

    console.log(`Password change code sent to ${email}: ${verificationCode}`);

    res.json({
      success: true,
      message: "Verification code sent",
      expiresIn: "10 minutes"
    });
  } catch (err) {
    console.error("Password change code request crash:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/resend-password-change-code - Resend password change code
Authrouter.post("/resend-password-change-code", verifySession, async (req, res) => {
  const { email } = req.body;

  try {
    // Generate new code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiresAt = addMinutesToNow(10);

    // Update user with new code
    await supabaseAdmin.from("users").update({
      password_change_code: verificationCode,
      password_change_expires_at: verificationExpiresAt
    }).eq("email", email);

    // Send new code via email
    await transporter.sendMail({
      from: '"Jasirilendingsoftware" <malobaamazing@gmail.com>',
      to: email,
      subject: "New Password Change Code",
      html: baseEmailTemplate("New Verification Code", `
        <p>Your new verification code for password change is:</p>
        ${styledHighlightBox(verificationCode)}
        <p>This code is valid for 10 minutes. Please enter it to complete your request.</p>
      `)
    });

    console.log(`New password change code sent to ${email}: ${verificationCode}`);

    res.json({
      success: true,
      message: "New verification code sent",
      expiresIn: "10 minutes"
    });
  } catch (err) {
    console.error("Resend password change code crash:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});



// POST /api/logout - Clear session (without verifySession middleware since token might be expired)
Authrouter.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("⚠️ [LOGOUT] No session token provided");
      return res.status(200).json({ success: true, message: "Already logged out" });
    }

    const sessionToken = authHeader.split(' ')[1];

    // Find user by session token (even if expired)
    const { data: user, error: findError } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (findError || !user) {
      console.log("⚠️ [LOGOUT] Session token not found or already cleared");
      return res.status(200).json({ success: true, message: "Already logged out" });
    }

    // Clear session token and expiry in database
    const { error: updateError } = await supabaseAdmin.from("users").update({
      session_token: null,
      session_expires_at: null
    }).eq("id", user.id);

    if (updateError) {
      console.error("❌ [LOGOUT] Database update error:", updateError);
      return res.status(500).json({ success: false, error: "Failed to clear session" });
    }

    console.log(`✅ [LOGOUT] Session cleared for user: ${user.email}`);

    res.json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (err) {
    console.error("💥 [LOGOUT] Logout error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
// POST /api/verify-password-change-code - Verify code and change password
Authrouter.post("/verify-password-change-code", verifySession, async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    // Get user
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      console.error("Verify password change code user error:", error);
      return res.status(400).json({ success: false, error: "User not found" });
    }

    // Verify code
    if (user.password_change_code !== code) {
      console.error(`Code mismatch for ${email}`);
      return res.status(400).json({ success: false, error: "Invalid verification code" });
    }

    // Check if code expired
    if (isExpired(user.password_change_expires_at)) {
      console.error("Password change code expired for user:", email);
      return res.status(400).json({ success: false, error: "Verification code expired" });
    }

    // Update password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.auth_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Password update error:", updateError);
      return res.status(500).json({ success: false, error: "Failed to update password" });
    }

    // Clear password change code
    await supabaseAdmin.from("users").update({
      password_change_code: null,
      password_change_expires_at: null,
      must_change_password: false
    }).eq("id", user.id);

    console.log(`Password changed successfully for ${email}`);

    // Send confirmation email
    await transporter.sendMail({
      from: '"Jasirilendingsoftware" <malobaamazing@gmail.com>',
      to: email,
      subject: "Password Changed Successfully",
      html: baseEmailTemplate("Security Alert: Password Changed", `
         <p>The password for your Jasiri account was successfully changed.</p>
         <p>If this was you, you can now log in with your new credentials. If this was not you, please contact support immediately.</p>
         ${infoBox("This email was sent automatically to confirm recent security changes to your account.", "Security Notification")}
       `)
    });

    res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (err) {
    console.error("Verify password change code crash:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default Authrouter;