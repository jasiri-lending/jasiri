import "dotenv/config";
import express from "express";
import cors from "cors";

import supabase, { supabaseAdmin } from "./supabaseClient.js";
import { baseEmailTemplate, styledHighlightBox, infoBox } from "./utils/emailTemplates.js";
import transporter from "./utils/mailer.js";
import c2b from "./routes/c2b.js";
import b2c from "./routes/b2c.js";
import stkpush from "./routes/stkpush.js";
import createReportUser from "./routes/createReportUser.js";
import checkReportUserRoute from "./routes/checkReportUser.js";
import tenantRouter from "./routes/tenantRoutes.js";
import mpesaConfigRouter from "./routes/mpesa_configure.js";
import Authrouter from "./routes/auth.js";
import AvatarRouter from "./routes/avator.js";
import deleteUserRouter from "./routes/deleteUser.js";
import loanProductsRouter from "./routes/loanProducts.js";
import JournalRouter from "./routes/journals.js";
import JournalEntryRouter from "./routes/journalEntries.js";
import LoanDueRouter from "./routes/loanDue.js";

// import "./cron/loanInstallmentCron.js"; // 



// Email transporter is now handled in ./utils/mailer.js
const app = express();

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

// ✅ CORS Configuration - Allows both local and production
app.use(cors({
  origin: [
    "https://jasirilending.software",
    "http://localhost:3000",  // React dev server
    "http://localhost:5173",  // Vite default port
    "http://localhost:5174",  // Vite alternate port
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// ✅ JSON Parser (before routes)
app.use(express.json());



// ✅ Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 5000
  });
});

// ✅ Register routes
app.use("/mpesa/c2b", c2b);
app.use("/mpesa/b2c", b2c);
app.use("/mpesa/c2b", stkpush);
app.use("/api/report-users/create", createReportUser);
app.use("/api/checkReportUser", checkReportUserRoute);
app.use("/api/tenant", tenantRouter);
app.use("/api", mpesaConfigRouter);
app.use("/api", AvatarRouter);
app.use("/api", Authrouter);
app.use("/api/admin", deleteUserRouter);
app.use("/api/loan-products", loanProductsRouter);



app.use("/api/journals", JournalRouter);
app.use("/api/journal-entries", JournalEntryRouter);
app.use("/api/loan-due", LoanDueRouter);

// Create user endpoint
app.post("/create-user", async (req, res) => {
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
    });

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
        email_confirm: true,
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
          tenant_id: logged_in_tenant_id,
          must_change_password: false // No longer forced to change password on first login
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
      await transporter.sendMail({
        from: '"Jasirilendingsoftware" <derickgreen18@gmail.com>',
        to: email,
        subject: "Welcome to Jasiri - Your Account Credentials",
        html: baseEmailTemplate("Welcome to Jasiri!", `
          <p>Hello ${full_name},</p>
          <p>Your account has been created successfully. Below are the login credentials for your new access portal.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
             <p style="margin: 5px 0;"><strong>Access Email:</strong> ${email}</p>
          </div>

          <p style="margin-bottom: 5px;"><strong>Temporary Password:</strong></p>
          ${styledHighlightBox(generatedPassword)}
          
          <p>You can now log in to the platform with these credentials. We recommend keeping your password secure.</p>
          
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