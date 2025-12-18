import "dotenv/config";
import express from "express";
import cors from "cors";
import supabase from "./supabaseClient.js";
import c2b from "./routes/c2b.js";
import b2c from "./routes/b2c.js";
import stkpush from "./routes/stkpush.js";
import createReportUser from "./routes/createReportUser.js";
import checkReportUserRoute from "./routes/checkReportUser.js";
import tenantRouter from "./routes/tenantRoutes.js";

// import "./cron/loanInstallmentCron.js"; // 


const app = express();

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

// Create user endpoint
app.post("/create-user", async (req, res) => {
  try {
    const {
      email,
      password,
      full_name,
      role,
      phone,
      branch_id,
      region_id,
      logged_in_tenant_id,
    } = req.body;

    console.log("=== Create User Request ===", {
      email,
      role,
      logged_in_tenant_id,
    });

    // 1️⃣ Validation
    if (!email || !password || !full_name || !role) {
      return res.status(400).json({
        success: false,
        error: "email, password, full_name and role are required",
      });
    }

    if (!logged_in_tenant_id) {
      return res.status(400).json({
        success: false,
        error: "Tenant ID is required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters",
      });
    }

    // 2️⃣ Create Supabase Auth user
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
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
const { error: usersError } = await supabase
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
    },
    { onConflict: "id" }
  );

if (usersError) {
  console.error("Users table error:", usersError);
  await supabase.auth.admin.deleteUser(userId);

  return res.status(400).json({
    success: false,
    error: usersError.message,
  });
}



    if (usersError) {
      console.error("Users table error:", usersError);
      await supabase.auth.admin.deleteUser(userId);

      return res.status(400).json({
        success: false,
        error: usersError.message,
      });
    }


// // Insert into profiles
// const { error: profilesError } = await supabaseAdmin
//   .from("profiles")
//   .insert({
//     id: userId,
//     branch_id: branch_id || null,
//     region_id: region_id || null,
//     tenant_id: logged_in_tenant_id,
//   });


    // if (profilesError) {
    //   console.error("Profiles table error:", profilesError);
    //   await supabaseAdmin.auth.admin.deleteUser(userId);

    //   return res.status(400).json({
    //     success: false,
    //     error: profilesError.message,
    //   });
    // }

    // ✅ Success
    return res.status(201).json({
      success: true,
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