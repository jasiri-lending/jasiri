import "dotenv/config";  // load .env first
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { createClient } from "@supabase/supabase-js";
import c2b from "./routes/c2b.js";
import b2c from "./routes/b2c.js";
import stkpush from "./routes/stkpush.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize Supabase with service role key
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create user endpoint
app.post("/create-user", async (req, res) => {
  try {
    const { email, password, full_name, role, phone, branch_id, region_id } = req.body;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        phone,
        branch_id,
        region_id,
      },
    });

    if (error) return res.status(400).json({ error: error.message });

    // Insert into users table
    await supabaseAdmin.from("users").upsert({
      id: data.user.id,
      full_name,
      email,
      role,
      phone,
    });

    // Insert into profiles table
    await supabaseAdmin.from("profiles").upsert({
      id: data.user.id,
      branch_id,
      region_id,
    });

    res.json({ user: data.user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.use("/mpesa/c2b",c2b );
app.use("/mpesa/b2c", b2c);
app.use("/mpesa/c2b", stkpush);
// Start server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
