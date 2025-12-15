import express from "express";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { nanoid } from "nanoid";

const tenantRouter = express.Router();

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Email transporter using .env variables
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE, 
  auth: {
    user: process.env.EMAIL_USERNAME,   
    pass: process.env.EMAIL_PASSWORD,   
  },
});

// Send tenant credentials email
async function sendTenantEmail(adminEmail, adminPassword, tenantSlug, companyName) {
const loginUrl = `https://jasirilending.software/login?tenant=${tenantSlug}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,  // e.g., '"Super Admin" <no-reply@yourapp.com>'
    to: adminEmail,
    subject: `Your Tenant Platform is Ready`,
    html: `
      <h3>Welcome to ${companyName} Dashboard!</h3>
      <p>Login URL: <a href="${loginUrl}">${loginUrl}</a></p>
      <p>Email: ${adminEmail}</p>
      <p>Password: ${adminPassword}</p>
      <p>Please change your password after first login.</p>
    `,
  });
}

// Create tenant + tenant admin
tenantRouter.post("/create-tenant", async (req, res) => {
  try {
    const { name, company_name, logo_url, primary_color, secondary_color, admin_full_name, admin_email } = req.body;

    if (!name || !company_name || !admin_email || !admin_full_name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const tenant_slug = name.toLowerCase().replace(/\s+/g, "");

    // 1️⃣ Insert tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .insert([{ name, company_name, tenant_slug }])
      .select()
      .single();
    if (tenantErr) throw tenantErr;

    // 2️⃣ Random password for admin
    const admin_password = nanoid(10);

    // 3️⃣ Create Supabase auth user
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
    });
    if (authErr) throw authErr;

    // 4️⃣ Insert into users table (full_name goes here)
    const { error: userErr } = await supabase
      .from("users")
      .insert({
        id: authUser.user.id,
        full_name: admin_full_name,
        email: admin_email,
        role: "admin",          // or "tenant_admin" if you prefer
        tenant_id: tenant.id,
        auth_id: authUser.user.id
      });
    if (userErr) {
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw userErr;
    }

    // 5️⃣ Insert into profiles (optional, minimal info)
    const { error: profileErr } = await supabase
      .from("profiles")
      .insert({ id: authUser.user.id, tenant_id: tenant.id });
    if (profileErr) {
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw profileErr;
    }

    // 6️⃣ Send credentials email
    await sendTenantEmail(admin_email, admin_password, tenant_slug, company_name);

    res.status(200).json({
      message: "Tenant and admin created successfully",
      tenant,
      admin: { email: admin_email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default tenantRouter;
