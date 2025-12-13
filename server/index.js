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

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!logged_in_tenant_id) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    const { data, error } =
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

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { error: usersError } = await supabaseAdmin
      .from("users")
      .upsert({
        id: data.user.id,
        auth_id: data.user.id,
        full_name,
        email,
        role,
        tenant_id: logged_in_tenant_id,
        phone,
      });

    if (usersError) {
      return res.status(400).json({ error: usersError.message });
    }

    const { error: profilesError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: data.user.id,
        branch_id,
        region_id,
        tenant_id: logged_in_tenant_id,
      });

    if (profilesError) {
      return res.status(400).json({ error: profilesError.message });
    }

    return res.json({ success: true, user: data.user });
  } catch (err) {
    console.error("Create user crash:", err);
    return res.status(500).json({ error: err.message });
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
