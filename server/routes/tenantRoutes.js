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
    from: process.env.EMAIL_FROM,
    to: adminEmail,
    subject: `Your Tenant Platform is Ready`,
    html: `
      <h2>Welcome to ${companyName} Dashboard!</h2>
      <p><strong>Login URL:</strong> ${loginUrl}</p>
      <p><strong>Email:</strong> ${adminEmail}</p>
      <p><strong>Password:</strong> ${adminPassword}</p>
      <p>Please change your password after first login.</p>
    `,
  });
}

// Create tenant + tenant admin
tenantRouter.post("/create-tenant", async (req, res) => {
  try {
    const {
      name,
      company_name,
      logo_url,
      primary_color,
      secondary_color,
      admin_full_name,
      admin_email
    } = req.body;

    if (!name || !company_name || !admin_email || !admin_full_name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const tenant_slug = name.toLowerCase().replace(/\s+/g, "");

    // 0️⃣ Pre-flight checks
    const { data: existingTenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("tenant_slug", tenant_slug)
      .maybeSingle();

    if (existingTenant) {
      return res.status(400).json({
        error: `A tenant with the name "${name}" already exists (slug: ${tenant_slug}). Please use a different name.`
      });
    }

    const { data: existingAuthUser } = await supabase.auth.admin.listUsers();
    const emailConflict = existingAuthUser?.users?.find(u => u.email === admin_email);

    if (emailConflict) {
      return res.status(400).json({
        error: `A user with the email ${admin_email} is already registered. Please use a different email.`
      });
    }

    const email_domain = admin_email.split('@')[1];
    const sms_sender_id = company_name
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 11)
      .toUpperCase();

    // 1️⃣ Insert tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .insert([{
        name,
        company_name,
        tenant_slug,
        admin_email,
        full_name: admin_full_name,
        email_domain,
        sms_sender_id,
        logo_url,
        primary_color,
        secondary_color,
        status: 'active',
        onboarding_completed: false
      }])
      .select()
      .single();

    if (tenantErr) {
      console.error("❌ Tenant Insertion Error:", tenantErr);
      throw tenantErr;
    }

    // 2️⃣ Random password for admin
    const admin_password = nanoid(12);

    // 3️⃣ Create Supabase auth user
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
      user_metadata: {
        full_name: admin_full_name,
        role: "admin",
        tenant_id: tenant.id
      }
    });

    if (authErr) {
      console.error("❌ Auth User Creation Error:", authErr);
      await supabase.from("tenants").delete().eq("id", tenant.id);
      throw authErr;
    }

    // 4️⃣ UPDATE the users table (trigger already created the record)
    // Wait a moment for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    const { error: userUpdateErr } = await supabase
      .from("users")
      .update({
        full_name: admin_full_name,
        role: "admin",
        tenant_id: tenant.id,
        must_change_password: true
      })
      .eq("id", authUser.user.id);

    if (userUpdateErr) {
      console.error("❌ User Update Error:", userUpdateErr);
      await supabase.auth.admin.deleteUser(authUser.user.id);
      await supabase.from("tenants").delete().eq("id", tenant.id);
      throw userUpdateErr;
    }

    // 5️⃣ Update profiles (if trigger created it)
    const { error: profileUpdateErr } = await supabase
      .from("profiles")
      .update({
        tenant_id: tenant.id,
        full_name: admin_full_name,
        role: "admin"
      })
      .eq("id", authUser.user.id);

    if (profileUpdateErr) {
      console.warn("⚠️ Profile update warning (non-critical):", profileUpdateErr);
    }

    // 6️⃣ Send credentials email
    console.log(`📧 Attempting to send onboarding email to: ${admin_email}`);
    try {
      await sendTenantEmail(admin_email, admin_password, tenant_slug, company_name);
      console.log(`✅ Onboarding email sent successfully to: ${admin_email}`);
    } catch (emailErr) {
      console.error(`❌ Failed to send onboarding email:`, emailErr);
      return res.status(200).json({
        message: "Tenant created, but email delivery failed.",
        warning: "Email delivery failed. Please check SMTP settings.",
        tenant,
        admin: {
          email: admin_email,
          temporary_password: admin_password,
        },
      });
    }

    res.status(200).json({
      message: "Tenant and admin created successfully",
      tenant,
      admin: {
        email: admin_email,
      },
    });

  } catch (err) {
    console.error("❌ Create Tenant Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default tenantRouter;