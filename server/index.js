import "dotenv/config";  // load .env first
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { createClient } from "@supabase/supabase-js";
import c2b from "./routes/c2b.js";
import b2c from "./routes/b2c.js";
import stkpush from "./routes/stkpush.js";
import createReportUser from "./routes/createReportUser.js";
import checkReportUserRoute from "./routes/checkReportUser.js";
import tenantRouter from "./routes/tenantRoutes.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());app.use(express.json());


// Initialize Supabase with service role key
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


app.use(cors({
  origin: "https://jasirilending.software/", 
}));


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

    console.log("=== Create User Request ===");
    console.log("Email:", email);
    console.log("Role:", role);
    console.log("Tenant ID:", logged_in_tenant_id);

    // Validation
    if (!email || !password || !full_name || !role) {
      console.error("Missing required fields");
      return res.status(400).json({ 
        success: false,
        error: "Missing required fields: email, password, full_name, and role are required" 
      });
    }

    if (!logged_in_tenant_id) {
      console.error("Missing tenant ID");
      return res.status(400).json({ 
        success: false,
        error: "Tenant ID is required" 
      });
    }

    if (password.length < 6) {
      console.error("Password too short");
      return res.status(400).json({ 
        success: false,
        error: "Password must be at least 6 characters" 
      });
    }

    console.log("Creating auth user...");

    // Step 1: Create auth user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          role,
          phone,
          branch_id,
          tenant_id: logged_in_tenant_id,
          region_id,
        },
      });

    if (authError) {
      console.error("Auth error:", authError);
      return res.status(400).json({ 
        success: false,
        error: authError.message 
      });
    }

    console.log("Auth user created:", authData.user.id);

    // Step 2: Insert into users table
    const { data: userData, error: usersError } = await supabaseAdmin
      .from("users")
      .insert({
        id: authData.user.id,
        auth_id: authData.user.id,
        full_name,
        email,
        role,
        tenant_id: logged_in_tenant_id,
        phone: phone || null,
      })
      .select()
      .single();

    if (usersError) {
      console.error("Users table error:", usersError);
      
      // Rollback: delete auth user
      console.log("Rolling back auth user...");
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return res.status(400).json({ 
        success: false,
        error: `Failed to create user record: ${usersError.message}` 
      });
    }

    console.log("User record created successfully");

    // Step 3: Insert into profiles table
    const { data: profileData, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authData.user.id,
        branch_id: branch_id || null,
        region_id: region_id || null,
        tenant_id: logged_in_tenant_id,
      })
      .select()
      .single();

    if (profilesError) {
      console.error("Profiles table error:", profilesError);
      
      // Rollback: delete auth user (cascade will handle users table)
      console.log("Rolling back auth user and users record...");
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return res.status(400).json({ 
        success: false,
        error: `Failed to create profile: ${profilesError.message}` 
      });
    }

    console.log("Profile created successfully");
    console.log("=== User Creation Complete ===");

    // Success response
    return res.status(201).json({ 
      success: true, 
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name,
        role,
      }
    });

  } catch (err) {
    console.error("=== Create User Crash ===");
    console.error("Error:", err);
    console.error("Stack:", err.stack);
    
    // Always return JSON, even on crash
    if (!res.headersSent) {
      return res.status(500).json({ 
        success: false,
        error: err.message || "Internal server error",
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    }
  }
});


// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Express error handler:", err);
  
  if (!res.headersSent) {
    res.status(500).json({ 
      success: false,
      error: "Internal server error" 
    });
  }
});

app.use("/mpesa/c2b",c2b );
app.use("/mpesa/b2c", b2c);
app.use("/mpesa/c2b", stkpush);
app.use("/api/report-users/create", createReportUser);
app.use("/api/checkReportUser", checkReportUserRoute);
app.use("/api/tenant", tenantRouter);


// Start server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
