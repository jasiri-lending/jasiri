import express from "express";
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import { baseEmailTemplate, styledHighlightBox, infoBox } from "../utils/emailTemplates.js";
import transporter from "../utils/mailer.js";

const tenantRouter = express.Router();

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Email transporter is now handled in ../utils/mailer.js

// Send tenant credentials email
async function sendTenantEmail(adminEmail, adminPassword, tenantSlug, companyName) {
  const loginUrl = `https://jasirilending.software/login?tenant=${tenantSlug}`;
  await transporter.sendMail({
    from: '"Jasirilendingsoftware" <derickgreen18@gmail.com>',
    to: adminEmail,
    subject: `Your Tenant Platform is Ready`,
    html: baseEmailTemplate("Welcome to Jasiri", `
      <p>Congratulations! Your platform for <strong>${companyName}</strong> has been successfully provisioned.</p>
      <p>Below are your initial admin credentials. Please use these to access your customized dashboard.</p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
        <p style="margin: 5px 0;"><strong>Dashboard URL:</strong> <a href="${loginUrl}" style="color: #2E5E99; font-weight: bold;">Visit Dashboard</a></p>
        <p style="margin: 5px 0;"><strong>Admin Email:</strong> ${adminEmail}</p>
      </div>

      <p style="margin-bottom: 5px;"><strong>Temporary Password:</strong></p>
      ${styledHighlightBox(adminPassword)}
      
      <p>Please use these credentials to log in and begin your journey with Jasiri.</p>
      
      <p>If you have any questions during setup, feel free to reach out to our support team.</p>
    `)
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
    const { data: existingTenant } = await supabaseAdmin
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
    const { data: tenant, error: tenantErr } = await supabaseAdmin
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
      await supabaseAdmin.from("tenants").delete().eq("id", tenant.id);
      throw authErr;
    }

    // 4️⃣ UPDATE the users table (trigger already created the record)
    // Wait a moment for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    const { error: userUpdateErr } = await supabaseAdmin
      .from("users")
      .update({
        full_name: admin_full_name,
        role: "admin",
        tenant_id: tenant.id,
        must_change_password: false
      })
      .eq("id", authUser.user.id);

    if (userUpdateErr) {
      console.error("❌ User Update Error:", userUpdateErr);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin.from("tenants").delete().eq("id", tenant.id);
      throw userUpdateErr;
    }

    // 5️⃣ Update profiles (if trigger created it)
    const { error: profileUpdateErr } = await supabaseAdmin
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