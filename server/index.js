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
app.use(bodyParser.json());

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

    // Validation
    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!logged_in_tenant_id) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    console.log("Creating auth user for:", email);

    // Create auth user
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
      return res.status(400).json({ error: authError.message });
    }

    console.log("Auth user created:", authData.user.id);

    // Insert into users table
    const { data: userData, error: usersError } = await supabaseAdmin
      .from("users")
      .insert({
        id: authData.user.id,
        auth_id: authData.user.id,
        full_name,
        email,
        role,
        tenant_id: logged_in_tenant_id,
        phone,
      })
      .select()
      .single();

    if (usersError) {
      console.error("Users table error:", usersError);
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: usersError.message });
    }

    console.log("User record created");

    // Insert into profiles table
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
      // Rollback: delete auth user (cascade will delete users record)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: profilesError.message });
    }

    console.log("Profile created successfully");

    return res.status(201).json({ 
      success: true, 
      user: authData.user 
    });

  } catch (err) {
    console.error("Create user crash:", err);
    
    // Ensure we always return JSON
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: err.message || "Internal server error",
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
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
