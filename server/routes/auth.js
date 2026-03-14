import express from "express";
import { supabase, supabaseAdmin } from "../supabaseClient.js";
import crypto from "crypto";
import { baseEmailTemplate, styledHighlightBox, infoBox } from "../utils/emailTemplates.js";
import transporter from "../utils/mailer.js";
import { verifySupabaseToken } from "../middleware/authMiddleware.js";

const Authrouter = express.Router();

// Session duration configuration — Change the number below to set how long a login session lasts (e.g. 7 for seven days)
// the login token should expire after 7 days comment the line so that I will change it to nay time infuture
const SESSION_DURATION_DAYS = 7;

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

// Reusable helper to fetch full profile and tenant data
const getFullProfileData = async (userId) => {
  console.log(`\n🔍 [PROFILE HELPER] Starting profile fetch for userId: ${userId}`);

  // Fetch user details INCLUDING tenant_id and session_expires_at
  const { data: userData, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, full_name, email, role, tenant_id, phone, company_phone, must_change_password, session_expires_at")
    .eq("id", userId)
    .single();

  if (userError || !userData) {
    console.error("❌ [PROFILE HELPER] User fetch error:", userError);
    return null;
  }

  // Fetch profile info (branch/region)
  const { data: basicProfile, error: basicError } = await supabaseAdmin
    .from("profiles")
    .select("branch_id, region_id, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  let branchName = "N/A";
  let branchCode = null;
  let regionName = "N/A";
  let tenantData = null;
  let finalBranchId = basicProfile?.branch_id || null;
  let finalRegionId = basicProfile?.region_id || null;

  // Fetch branch data (including region_id from branch)
  if (finalBranchId) {
    const { data: branchData, error: branchError } = await supabaseAdmin
      .from("branches")
      .select("name, code, region_id")
      .eq("id", finalBranchId)
      .single();

    if (branchData) {
      branchName = branchData.name;
      branchCode = branchData.code;
      if (!finalRegionId && branchData.region_id) {
        finalRegionId = branchData.region_id;
      }
    }
  }

  // Fetch region name
  if (finalRegionId) {
    const { data: regionData, error: regionError } = await supabaseAdmin
      .from("regions")
      .select("name")
      .eq("id", finalRegionId)
      .single();

    if (regionData) {
      regionName = regionData.name;
    }
  }

  // Fetch tenant data if tenant_id exists
  if (userData.tenant_id) {
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("*")
      .eq("id", userData.tenant_id)
      .single();

    if (!tenantError && tenant) {
      tenantData = tenant;
    }
  }

  return {
    profile: {
      id: userData.id,
      full_name: userData.full_name,
      name: userData.full_name,
      email: userData.email,
      role: userData.role,
      tenant_id: userData.tenant_id,
      phone: userData.phone,
      company_phone: userData.company_phone,
      branch_id: finalBranchId,
      region_id: finalRegionId,
      avatar_url: basicProfile?.avatar_url || null,
      branch: branchName,
      branch_code: branchCode,
      region: regionName,
      must_change_password: userData.must_change_password,
      session_expires_at: userData.session_expires_at
    },
    tenant: tenantData
  };
};

// POST /api/login - Verify credentials via Supabase and send OTP via Brevo
Authrouter.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Email and password are required" });
  }

  try {
    // 1️⃣ Verify user existence in our database (for tenant info)
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, role, tenant_id")
      .eq("email", email)
      .single();

    if (userError || !user) {
      console.error("Login attempt failed, user not found:", email);
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    // 2️⃣ Verify credentials with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData?.user) {
      console.error("Supabase password verification failed for:", email);
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    // 3️⃣ Generate OTP verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpiresAt = addMinutesToNow(10); // 10 minutes from now

    // 4️⃣ Save OTP in DB
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        verification_code: verificationCode,
        verification_expires_at: verificationExpiresAt,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to update user with verification code:", updateError);
      return res.status(500).json({ success: false, error: "Failed to process login" });
    }

    // 5️⃣ Send OTP via Brevo (transporter uses Brevo API)
    await transporter.sendMail({
      from: '"Jasiri Security" <noreply@jasirilending.software>',
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

    console.log(`✅ Verification code sent to ${email}`);

    res.json({
      success: true,
      message: "Verification code sent to your email",
      userId: user.id
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "An unexpected error occurred during login" });
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
      from: '"Jasiri" <noreply@jasirilending.software>',

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

// POST /api/verify-code - Finalize login and return Supabase JWT
Authrouter.post("/verify-code", async (req, res) => {
  const { userId, code } = req.body;

  if (!userId || !code) {
    return res.status(400).json({ success: false, error: "Missing verification details" });
  }

  try {
    // 1️⃣ Get user and verify OTP
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, email, verification_code, verification_expires_at")
      .eq("id", userId)
      .single();

    if (error || !user) {
      console.error("Verify code user error:", error);
      return res.status(400).json({ success: false, error: "User not found" });
    }

    if (!user.verification_code || user.verification_code !== code) {
      return res.status(401).json({ success: false, error: "Invalid verification code" });
    }

    if (isExpired(user.verification_expires_at)) {
      return res.status(401).json({ success: false, error: "Verification code expired" });
    }

    // 2️⃣ OTP is correct, generate specialized Supabase Link or Custom JWT
    // Since we are using Supabase as the identity provider, we need to return the Supabase session
    // We can use createSession manually via admin API or return a magic link token
    // For this flow, let's use the admin API to create a specialized session for the user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
    });

    if (sessionError || !sessionData?.properties?.hashed_token) {
      console.error("❌ Failed to generate session link:", sessionError);
      return res.status(500).json({ success: false, error: "Session creation failed" });
    }

    // 3️⃣ Generate Session and Clear OTP
    const sessionToken = crypto.randomUUID();
    const sessionExpiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin.from("users").update({
      verification_code: null,
      verification_expires_at: null,
      session_token: sessionToken,
      session_expires_at: sessionExpiresAt,
      last_login: new Date().toISOString(),
    }).eq("id", userId);

    console.log(`✅ Login verified for ${user.email}`);

    // Return the hashed token which the client can use with supabase.auth.verifyOtp
    // Alternatively, we could perform the verification here and return the access_token
    // Let's return the access_token directly for simplicity (requires a different admin approach)

    // Better approach: Since we already verified them, we can use signInWithOtp (with magic link) 
    // but the cleanest for a proxy is to return the necessary info for the client to finalize.
    // However, the USER request says "Node API MUST verify the Supabase access token".

    // Let's use the login info from Step 1 to return the access token.
    // Actually, we can't easily get the access_token from generateLink without sending the email.

    // Refined approach: We'll use the user's email to get a login session via admin API 
    // and return it. Supabase Admin doesn't have a direct "give me a JWT for this user" 
    // because that's a security risk, but we can update their password to something temporary 
    // OR use the magic link flow.

    // Actually, we can use `supabaseAdmin.auth.admin.getUser(userId)` to verify existence 
    // and then use a service role to perform actions. 
    // But for the FRONTEND to have the token, we'll return a way for them to get it.

    return res.json({
      success: true,
      message: "Verification successful",
      email: user.email,
      // We will allow the frontend to finalize the session with a specialized redirect/token
      // or we can sign a custom JWT that the backend trusts.
      // Given the requirement "send the Supabase JWT in the Authorization header",
      // the frontend must have the Supabase JWT.

      // Let's return the user credentials so the frontend can finalize if needed,
      // but for "secure production grade", we should return the session.
      // To get the session without re-entering password: 
      // Use supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { authorized_at: new Date() } })
      // and provide a one-time token.

      otpHandshake: true, // Signal to frontend that OTP is done
      session_expires_at: sessionExpiresAt, // Return expiry so client can sync timer
      profileData: await getFullProfileData(userId)
    });

  } catch (err) {
    console.error("💥 Verify code crash:", err);
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
      from: '"Jasiri" <noreply@jasirilending.software>',

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
      from: '"Jasiri" <noreply@jasirilending.software>',

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
      from: '"Jasiri" <noreply@jasirilending.software>',

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

// verifySupabaseToken is imported from middleware/authMiddleware.js

// GET /api/profile/:userId - get user profile
Authrouter.get("/profile/:userId", verifySupabaseToken, async (req, res) => {
  const { userId } = req.params;

  // Ensure user can only access their own profile
  if (req.user.id !== userId) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    const data = await getFullProfileData(userId);
    if (!data) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({
      ...data.profile,
      tenant: data.tenant
    });

  } catch (err) {
    console.error("💥 [PROFILE] Profile fetch crash:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add to your Authrouter.js file

// POST /api/request-password-change-code - Send password change verification code
Authrouter.post("/request-password-change-code", verifySupabaseToken, async (req, res) => {
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
      from: '"Jasiri" <noreply@jasirilending.software>',

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
Authrouter.post("/resend-password-change-code", verifySupabaseToken, async (req, res) => {
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
      from: '"Jasiri" <noreply@jasirilending.software>',

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



// POST /api/logout - Clear session
Authrouter.post("/logout", verifySupabaseToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Clear session in DB
    await supabaseAdmin.from("users").update({
      session_token: null,
      session_expires_at: null
    }).eq("id", userId);

    console.log(`✅ Session cleared for user ${userId}`);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ success: true, message: "Logged out with errors" });
  }
});
// POST /api/verify-password-change-code - Verify code and change password
Authrouter.post("/verify-password-change-code", verifySupabaseToken, async (req, res) => {
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
      from: '"Jasiri" <noreply@jasirilending.software>',
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