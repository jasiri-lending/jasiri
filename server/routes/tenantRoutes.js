import express from "express";
import { supabase, supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken, checkTenantAccess } from "../middleware/authMiddleware.js";
import crypto from "crypto";
import { nanoid } from "nanoid";
import { baseEmailTemplate, styledHighlightBox, infoBox } from "../utils/emailTemplates.js";
import transporter from "../utils/mailer.js";

const tenantRouter = express.Router();

// Email transporter is now handled in ../utils/mailer.js

// Send tenant credentials email
async function sendTenantEmail(adminEmail, invitationLink, tenantSlug, companyName) {
  const frontendUrl = process.env.FRONTEND_URL || "https://jasirilending.software";
  const loginUrl = `${frontendUrl}/login?tenant=${tenantSlug}`;
  await transporter.sendMail({
    from: '"Jasiri" <noreply@jasirilending.software>',
    to: adminEmail,
    subject: `Your Tenant Platform is Ready - Set Up Your Account`,
    html: baseEmailTemplate("Welcome to Jasiri", `
      <p>Congratulations! Your platform for <strong>${companyName}</strong> has been successfully provisioned.</p>
      <p>To complete your setup and access your customized dashboard, please set your administrator password by clicking the button below.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${invitationLink}" style="background-color: #586ab1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Set Up Your Password</a>
      </div>

      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
        <p style="margin: 5px 0;"><strong>Dashboard URL:</strong> <a href="${loginUrl}" style="color: #586ab1;">Visit Dashboard</a></p>
        <p style="margin: 5px 0;"><strong>Admin Email:</strong> ${adminEmail}</p>
      </div>

      <p>After setting your password, you can use the Dashboard URL above to log in anytime.</p>
      
      <p>If you have any questions during setup, feel free to reach out to our support team.</p>
    `)
  });
}

// Create tenant (Restricted to Superadmin/Admin)
tenantRouter.post("/create-tenant", verifySupabaseToken, async (req, res) => {
  // Only superadmin can create new tenants
  if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: "Unauthorized. Superadmin/Admin role required." });
  }
  try {
    const {
      name,
      company_name,
      admin_email,
      admin_full_name,
      logo_url,
      primary_color,
      secondary_color,
      cr12,
      company_certificate,
      license,
      tenant_id_number,
      phone_number,
      document_upload_enabled,
      image_upload_enabled
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

    const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers();
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
        onboarding_completed: false,
        cr12,
        company_certificate,
        license,
        tenant_id_number,
        phone_number
      }])
      .select()
      .single();

    if (tenantErr) {
      console.error("❌ Tenant Insertion Error:", tenantErr);
      throw tenantErr;
    }

    // 1.5️⃣ Insert tenant features
    const { error: featuresErr } = await supabaseAdmin
      .from("tenant_features")
      .insert([{
        tenant_id: tenant.id,
        document_upload_enabled: !!document_upload_enabled,
        image_upload_enabled: !!image_upload_enabled
      }]);

    if (featuresErr) {
      console.error("❌ Tenant Features Insertion Error:", featuresErr);
      // Not critical enough to fail the whole process, but logged
    }

    // 2️⃣ Random password for admin
    const admin_password = nanoid(12);

    // 3️⃣ Create Supabase auth user
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: false, // Set to false to allow setup link to confirm it
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

    // 3.5️⃣ Generate Setup Code (No more fragile Supabase sessions)
    const setupCode = Math.floor(100000 + Math.random() * 900000).toString();
    const setupLink = `${process.env.FRONTEND_URL}/passwordsetup?email=${encodeURIComponent(admin_email)}&code=${setupCode}`;
    
    console.log(`📝 Generated Tenant Setup Code for ${admin_email}`);

    // 4️⃣ UPDATE the users table (trigger already created the record)
    // Wait a moment for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    const { error: userUpdateErr } = await supabaseAdmin
      .from("users")
      .update({
        full_name: admin_full_name,
        role: "admin",
        tenant_id: tenant.id,
        must_change_password: true, // Force password change
        verification_code: setupCode,
        verification_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
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
      await sendTenantEmail(admin_email, setupLink, tenant_slug, company_name);
      console.log(`✅ Onboarding email sent successfully to: ${admin_email}`);
    } catch (emailErr) {
      console.error(`❌ Failed to send onboarding email:`, emailErr);
      return res.status(200).json({
        message: "Tenant created, but email delivery failed.",
        warning: "Email delivery failed. Please check SMTP settings.",
        tenant,
        admin: {
          email: admin_email,
          setup_link: setupLink,
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

// Delete tenant endpoint (Cascading Delete) - Restricted to Superadmin
tenantRouter.delete("/delete-tenant/:id", verifySupabaseToken, async (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: "Unauthorized. Superadmin role required." });
  }
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }

    console.log(`🗑️ Attempting to delete tenant: ${id}`);

    // 1️⃣ Fetch all admin users associated with this tenant (to delete from Auth)
    // We need to delete auth users first or in parallel
    const { data: tenantUsers, error: usersFetchError } = await supabaseAdmin
      .from("users")
      .select("auth_id")
      .eq("tenant_id", id);

    if (usersFetchError) {
      throw new Error(`Failed to fetch tenant users: ${usersFetchError.message}`);
    }

    // 2️⃣ Delete Auth Users
    if (tenantUsers && tenantUsers.length > 0) {
      const deleteAuthPromises = tenantUsers
        .filter(u => u.auth_id)
        .map(u => supabaseAdmin.auth.admin.deleteUser(u.auth_id));

      await Promise.all(deleteAuthPromises);
      console.log(`✅ Deleted ${tenantUsers.length} auth users`);
    }

    // 3️⃣ Delete Branches (Foreign Key Constraint)
    const { error: branchesError } = await supabaseAdmin
      .from("branches")
      .delete()
      .eq("tenant_id", id);

    if (branchesError) throw new Error(`Failed to delete branches: ${branchesError.message}`);

    // 4️⃣ Delete Regions (Foreign Key Constraint)
    const { error: regionsError } = await supabaseAdmin
      .from("regions")
      .delete()
      .eq("tenant_id", id);

    if (regionsError) throw new Error(`Failed to delete regions: ${regionsError.message}`);

    // 5️⃣ Delete Users (Public Table - cascaded from auth deletion usually, but manual safety check)
    const { error: usersError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("tenant_id", id);

    if (usersError) throw new Error(`Failed to delete users: ${usersError.message}`);

    // 6️⃣ Delete Tenant
    const { error: tenantError } = await supabaseAdmin
      .from("tenants")
      .delete()
      .eq("id", id);

    if (tenantError) throw new Error(`Failed to delete tenant: ${tenantError.message}`);

    console.log(`✅ Tenant ${id} deleted successfully`);
    res.status(200).json({ message: "Tenant deleted successfully" });

  } catch (err) {
    console.error("❌ Delete Tenant Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Upsert tenant SMS settings - Restricted to Admin/Superadmin
tenantRouter.post("/sms-config", verifySupabaseToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenant_id, base_url, api_key, partner_id, shortcode } = req.body;

    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: "Unauthorized. Admin role required." });
    }

    if (!tenant_id || !base_url || !api_key || !partner_id || !shortcode) {
      return res.status(400).json({ error: "Missing required SMS config fields" });
    }

    const { data, error } = await supabase
      .from("tenant_sms_settings")
      .upsert(
        { tenant_id, base_url, api_key, partner_id, shortcode, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id" }
      )
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ message: "SMS config saved successfully", data });
  } catch (err) {
    console.error("❌ SMS Config Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get tenant SMS settings - Restricted to Admin/Superadmin
tenantRouter.get("/sms-config/:tenantId", verifySupabaseToken, checkTenantAccess, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const { data, error } = await supabase
      .from("tenant_sms_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) throw error;

    res.status(200).json({ data });
  } catch (err) {
    console.error("❌ Fetch SMS Config Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default tenantRouter;