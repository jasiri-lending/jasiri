import express from "express";
import { supabase, supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken, checkTenantAccess } from "../middleware/authMiddleware.js";
import { encrypt, decrypt } from "../utils/encryption.js";
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

    // 1.6️⃣ Initialize Tenant M-Pesa Configurations (C2B and B2C)
    const { error: mpesaInitErr } = await supabaseAdmin
      .from("tenant_mpesa_config")
      .insert([
        { tenant_id: tenant.id, service_type: 'c2b', is_active: false, environment: 'sandbox' },
        { tenant_id: tenant.id, service_type: 'b2c', is_active: false, environment: 'sandbox' }
      ]);

    if (mpesaInitErr) {
      console.error("❌ Tenant M-Pesa Initialization Error:", mpesaInitErr);
      // Non-critical, but logged
    }

    // 1.7️⃣ Insert standard Chart of Accounts
    const defaultAccounts = [
      { account_name: 'Loan Insurance Fee Income', account_type: 'Income', account_category: 'Loan Income', code: '4030', status: 'Active' },
      { account_name: 'Registration Fees Receivable', account_type: 'Asset', account_category: 'Receivables', code: '1140', status: 'Active' },
      { account_name: 'Accounts Payable', account_type: 'Liability', account_category: 'Operations', code: '2200', status: 'Active' },
      { account_name: 'Withdrawal Fee Income', account_type: 'Income', account_category: 'Wallet Income', code: '4040', status: 'Active' },
      { account_name: 'Payment Gateway Clearing Account', account_type: 'Asset', account_category: 'Current Asset', code: '1030', status: 'Active' },
      { account_name: 'Bank Account', account_type: 'Asset', account_category: 'Current Asset', code: '1010', status: 'Active' },
      { account_name: 'Accrued Expenses', account_type: 'Liability', account_category: 'Operations', code: '2300', status: 'Active' },
      { account_name: 'Customer Wallet Balances', account_type: 'Liability', account_category: 'Customer Funds', code: '2000', status: 'Active' },
      { account_name: 'Loan Interest Receivable', account_type: 'Asset', account_category: 'Loan Assets', code: '1110', status: 'Active' },
      { account_name: 'Marketing & Advertising Expense', account_type: 'Expense', account_category: 'Growth', code: '5400', status: 'Active' },
      { account_name: 'Commission Income', account_type: 'Income', account_category: 'Platform Income', code: '4070', status: 'Active' },
      { account_name: 'Provision for Bad Debts', account_type: 'Expense', account_category: 'Credit Risk', code: '5010', status: 'Active' },
      { account_name: 'Staff Advances', account_type: 'Asset', account_category: 'Other Assets', code: '1200', status: 'Active' },
      { account_name: 'Late Payment Penalty Income', account_type: 'Income', account_category: 'Loan Income', code: '4020', status: 'Active' },
      { account_name: 'Retained Earnings', account_type: 'Equity', account_category: 'Equity', code: '3100', status: 'Active' },
      { account_name: 'Account Maintenance Fee Income', account_type: 'Income', account_category: 'Platform Income', code: '4090', status: 'Active' },
      { account_name: 'Agent Commission Expense', account_type: 'Expense', account_category: 'Operations', code: '5110', status: 'Active' },
      { account_name: 'SMS & Communication Expense', account_type: 'Expense', account_category: 'IT', code: '5210', status: 'Active' },
      { account_name: 'Customer Loan Receivables – Principal', account_type: 'Asset', account_category: 'Loan Assets', code: '1100', status: 'Active' },
      { account_name: 'Loan Processing Fee Income', account_type: 'Income', account_category: 'Loan Income', code: '4010', status: 'Active' },
      { account_name: 'Cash on Hand', account_type: 'Asset', account_category: 'Current Asset', code: '1000', status: 'Active' },
      { account_name: 'Loans Payable (Borrowed Capital)', account_type: 'Liability', account_category: 'Financing', code: '2100', status: 'Active' },
      { account_name: 'Customer Savings Deposits', account_type: 'Liability', account_category: 'Customer Funds', code: '2010', status: 'Active' },
      { account_name: 'Owner Capital', account_type: 'Equity', account_category: 'Equity', code: '3000', status: 'Active' },
      { account_name: 'Staff Salaries Expense', account_type: 'Expense', account_category: 'Operations', code: '5100', status: 'Active' },
      { account_name: 'Loan Penalty Receivable', account_type: 'Asset', account_category: 'Loan Assets', code: '1120', status: 'Active' },
      { account_name: 'Customer Registration Fee Income', account_type: 'Income', account_category: 'Platform Income', code: '4080', status: 'Active' },
      { account_name: 'Agent Float Account', account_type: 'Asset', account_category: 'Current Asset', code: '1040', status: 'Active' },
      { account_name: 'Current Year Earnings', account_type: 'Equity', account_category: 'Equity', code: '3200', status: 'Active' },
      { account_name: 'Refunds Payable to Customers', account_type: 'Liability', account_category: 'Customer Funds', code: '2030', status: 'Active' },
      { account_name: 'Loan Processing Fees Receivable', account_type: 'Asset', account_category: 'Loan Assets', code: '1130', status: 'Active' },
      { account_name: 'Loan Loss Expense', account_type: 'Expense', account_category: 'Credit Risk', code: '5000', status: 'Active' },
      { account_name: 'Deposit Fee Income', account_type: 'Income', account_category: 'Wallet Income', code: '4050', status: 'Active' },
      { account_name: 'Prepaid Expenses', account_type: 'Asset', account_category: 'Other Assets', code: '1300', status: 'Active' },
      { account_name: 'Service Charge Income', account_type: 'Income', account_category: 'Platform Income', code: '4060', status: 'Active' },
      { account_name: 'Payment Gateway Charges', account_type: 'Expense', account_category: 'Finance', code: '5220', status: 'Active' },
      { account_name: 'Unallocated Customer Payments', account_type: 'Liability', account_category: 'Customer Funds', code: '2020', status: 'Active' },
      { account_name: 'Loan Interest Income', account_type: 'Income', account_category: 'Loan Income', code: '4000', status: 'Active' },
      { account_name: 'Taxes Payable', account_type: 'Liability', account_category: 'Tax', code: '2400', status: 'Active' },
      { account_name: 'Mobile Money Paybill Balance', account_type: 'Asset', account_category: 'Current Asset', code: '1020', status: 'Active' },
      { account_name: 'System Hosting Expense', account_type: 'Expense', account_category: 'IT', code: '5200', status: 'Active' }
    ].map(acc => ({ ...acc, tenant_id: tenant.id }));

    const { error: coaErr } = await supabaseAdmin.from('chart_of_accounts').insert(defaultAccounts);
    if (coaErr) {
       console.error("❌ Chart of Accounts Initialization Error:", coaErr);
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
    const tenantFrontendUrl = process.env.FRONTEND_URL || "https://jasirilending.software";
    const setupLink = `${tenantFrontendUrl}/passwordsetup?email=${encodeURIComponent(admin_email)}&code=${setupCode}`;
    
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

    const encryptedApiKey = api_key;

    const { data, error } = await supabaseAdmin
      .from("tenant_sms_settings")
      .upsert(
        { tenant_id, base_url, api_key: encryptedApiKey, partner_id, shortcode, updated_at: new Date().toISOString() },
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

    const { data, error } = await supabaseAdmin
      .from("tenant_sms_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      data.api_key = data.api_key;
    }

    res.status(200).json({ data });
  } catch (err) {
    console.error("❌ Fetch SMS Config Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default tenantRouter;