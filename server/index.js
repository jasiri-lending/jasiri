import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { auditMiddleware } from "./utils/auditLogger.js";

import supabase, { supabaseAdmin } from "./supabaseClient.js";
import { baseEmailTemplate, styledHighlightBox, infoBox } from "./utils/emailTemplates.js";
import transporter from "./utils/mailer.js";
import c2b from "./routes/c2b.js";
import b2c from "./routes/b2c.js";
import stkpush from "./routes/stkpush.js";
import { verifySupabaseToken } from "./middleware/authMiddleware.js";
import tenantRouter from "./routes/tenantRoutes.js";
import mpesaConfigRouter from "./routes/mpesa_configure.js";
import Authrouter from "./routes/auth.js";
import AvatarRouter from "./routes/avator.js";
import deleteUserRouter from "./routes/deleteUser.js";
import loanProductsRouter from "./routes/loanProducts.js";
import JournalRouter from "./routes/journals.js";
import JournalEntryRouter from "./routes/journalEntries.js";
import LoanDueRouter from "./routes/loanDue.js";
import createReportUser from "./routes/createReportUser.js";
import checkReportUserRoute from "./routes/checkReportUser.js";
import AccountRouter from "./routes/accounts.js";
import scoringRouter from "./routes/scoring.js";

// import "./cron/loanInstallmentCron.js"; // 



// Initialize Express app
const app = express();

// ✅ CORS Configuration - MUST be first (before Helmet) to handle preflight OPTIONS requests
app.use(cors({
  origin: [
    "https://jasirilending.software",
    "http://localhost:5000",
    "http://localhost:3000",  // React dev server
    "http://localhost:5173",  // Vite default port
    "http://localhost:5174",  // Vite alternate port
    "http://127.0.0.1:5000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// ✅ Security Headers (Helmet) - after CORS so preflight isn't blocked
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ✅ Global Rate Limiting
app.use(globalLimiter);

// ✅ Password generation utility
function generateSecurePassword(length = 12) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const all = uppercase + lowercase + numbers + symbols;

  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = 4; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// ✅ JSON Parser (with limit for large payloads protection)
app.use(express.json({ limit: '10kb' }));

// ✅ Audit Logging Middleware
app.use(auditMiddleware);



// ✅ Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 5000
  });
});

// ✅ Register routes - ORDER MATTERS (Public routes first)
app.use("/api", Authrouter); // Contains /login, /verify-code, /forgot-password (Public)
app.use("/mpesa/c2b", c2b);
app.use("/mpesa/b2c", b2c);
app.use("/api/tenant", tenantRouter);
app.use("/api", mpesaConfigRouter);
app.use("/api", AvatarRouter);
app.use("/api/admin", deleteUserRouter);
app.use("/api/loan-products", loanProductsRouter);

app.use("/api/journals", JournalRouter);
app.use("/api/journal-entries", JournalEntryRouter);
app.use("/api/chart-of-accounts", AccountRouter);
app.use("/api/loan-due", LoanDueRouter);
app.use("/mpesa/c2b", stkpush); // Move STK push here for group
app.use("/api/report-users/create", verifySupabaseToken, createReportUser); // Secure report user creation
app.use("/api/checkReportUser", checkReportUserRoute);
app.use("/api/scoring", scoringRouter);

// import "./cron/loanInstallmentCron.js"; // 

// Create user endpoint - SECURED
app.post("/create-user", verifySupabaseToken, async (req, res) => {
  const requester = req.user;
  try {
    const {
      email,
      full_name,
      role,
      phone,
      branch_id,
      region_id,
      logged_in_tenant_id,
    } = req.body;

    // Generate secure password
    const generatedPassword = generateSecurePassword(12);

    console.log("=== Create User Request ===", {
      email,
      role,
      logged_in_tenant_id,
      requester: requester.email
    });

    // 0️⃣ RBAC: Only admin or superadmin
    if (requester.role !== "superadmin" && requester.role !== "admin") {
      return res.status(403).json({ success: false, error: "Unauthorized. Admin role required." });
    }

    // 0.5️⃣ Tenant Isolation: Admin can only create users for their own tenant
    if (requester.role === "admin" && requester.tenant_id !== logged_in_tenant_id) {
      return res.status(403).json({ success: false, error: "Access denied. Cannot create user for another tenant." });
    }

    // 1️⃣ Validation
    if (!email || !full_name || !role) {
      return res.status(400).json({
        success: false,
        error: "email, full_name and role are required",
      });
    }

    if (!logged_in_tenant_id) {
      return res.status(400).json({
        success: false,
        error: "Tenant ID is required",
      });
    }

    // 1.5️⃣ Domain Enforcement - Partially disabled for testing
    const userDomain = email.split('@')[1]?.toLowerCase();

    // Check for common personal email providers (block list)
    /*
    const personalProviders = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "live.com", "aol.com", "protonmail.com"];

    if (personalProviders.includes(userDomain)) {
      return res.status(400).json({
        success: false,
        error: `Personal email addresses (${userDomain}) are not allowed. Please use your company/business email domain.`,
      });
    }
    */

    // Optional: If tenant has a preferred domain, you can log it but not enforce it
    const { data: tenant } = await supabase
      .from("tenants")
      .select("email_domain")
      .eq("id", logged_in_tenant_id)
      .single();

    if (tenant?.email_domain) {
      console.log(`ℹ️ Tenant prefers domain @${tenant.email_domain}, but user provided @${userDomain}`);
    }

    console.log(`🔐 Generated password for ${email}: ${generatedPassword}`);

    // 2️⃣ Create Supabase Auth user using ADMIN client (service role)
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: generatedPassword,
        email_confirm: false, // Set to false to allow setup link to confirm it
        user_metadata: {
          full_name,
          role,
          phone,
          branch_id,
          region_id,
          tenant_id: logged_in_tenant_id,
        },
      });

    if (authError) {
      console.error("Auth error:", authError);
      return res.status(400).json({
        success: false,
        error: authError.message,
      });
    }

    const userId = authData.user.id;

    // 2.5️⃣ Generate Setup Code (No more fragile Supabase sessions)
    const setupCode = Math.floor(100000 + Math.random() * 900000).toString();
    const setupLink = `${process.env.FRONTEND_URL}/passwordsetup?email=${encodeURIComponent(email)}&code=${setupCode}`;
    
    console.log(`📝 Generated Setup Code for ${email}`);

    // 3️⃣ Upsert into users table
    const { error: usersError } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          id: userId,
          auth_id: userId,
          full_name,
          email,
          role,
          phone: phone || null,
          company_phone: req.body.company_phone || null,
          tenant_id: logged_in_tenant_id,
          must_change_password: true, // Force password change on first login via link
          verification_code: setupCode,
          verification_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        },
        { onConflict: "id" }
      );

    if (usersError) {
      console.error("Users table error:", usersError);
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return res.status(400).json({
        success: false,
        error: usersError.message,
      });
    }



    if (usersError) {
      console.error("Users table error:", usersError);
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return res.status(400).json({
        success: false,
        error: usersError.message,
      });
    }

    // 4️⃣ Send welcome email with credentials
    try {
      const frontendUrl = process.env.FRONTEND_URL || "https://jasirilending.software";
      const loginUrl = `${frontendUrl}/login`;
      await transporter.sendMail({
        from: '"Jasiri" <noreply@jasirilending.software>',
        to: email,
        subject: "Welcome to Jasiri - Complete Your Account Setup",
        html: baseEmailTemplate("Welcome to Jasiri!", `
          <p>Hello ${full_name},</p>
          <p>Your account has been created successfully. To complete your setup and access the Jasiri portal, please set your password by clicking the button below.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${setupLink}" style="background-color: #586ab1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Set Up Your Password</a>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
             <p style="margin: 5px 0;"><strong>Access Email:</strong> ${email}</p>
             <p style="margin: 5px 0;"><strong>Platform Link:</strong> <a href="${loginUrl}" style="color: #586ab1;">${loginUrl}</a></p>
          </div>

          <p>After setting your password, you will be redirected to the dashboard.</p>
          
          <p>If you have any questions or need assistance, please contact your internal administrator.</p>
        `)
      });
      console.log(`✅ Welcome email sent to ${email}`);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail user creation if email fails
    }

    // ✅ Success
    return res.status(201).json({
      success: true,
      message: "User created successfully. Login credentials have been sent to their email.",
      user: {
        id: userId,
        email,
        full_name,
        role,
      },
    });

  } catch (err) {
    console.error("Create user crash:", err);

    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  }
});

// ✅ 404 Handler (for unmatched routes)
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.path
  });
});

// ✅ Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error("Express error handler:", err);

  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 Report users: http://localhost:${PORT}/api/report-users/create`);
});