import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { verifySupabaseToken } from "../middleware/authMiddleware.js";

const mobileRouter = express.Router();

// Apply auth to all mobile routes
mobileRouter.use(verifySupabaseToken);

/**
 * GET /api/ro/dashboard-stats
 * Returns summary stats for the logged-in Relationship Officer.
 */
mobileRouter.get("/dashboard-stats", async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    // Fetch total customers registered by this RO
    const { count: totalCustomers } = await supabaseAdmin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("created_by", userId);

    // Fetch total leads
    const { count: totalLeads } = await supabaseAdmin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("created_by", userId);

    // Fetch total loan applications linked to this RO's customers
    const { count: totalLoans } = await supabaseAdmin
      .from("loan_applications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("created_by", userId);

    // Conversion rate: loans that were approved
    const { count: approvedLoans } = await supabaseAdmin
      .from("loan_applications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("created_by", userId)
      .in("status", ["approved", "disbursed"]);

    const conversionRate =
      totalLoans > 0
        ? `${Math.round((approvedLoans / totalLoans) * 100)}%`
        : "0%";

    // Recent activity: last 10 customers or leads
    const { data: recentCustomers } = await supabaseAdmin
      .from("customers")
      .select("id, Firstname, created_at")
      .eq("tenant_id", tenantId)
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: recentLeads } = await supabaseAdmin
      .from("leads")
      .select("id, name, created_at")
      .eq("tenant_id", tenantId)
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    // Merge and sort activity
    const activity = [
      ...(recentCustomers ?? []).map((c) => ({
        type: "customer",
        name: c.Firstname ?? "Customer",
        time: formatTime(c.created_at),
      })),
      ...(recentLeads ?? []).map((l) => ({
        type: "lead",
        name: l.name ?? "Lead",
        time: formatTime(l.created_at),
      })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);

    res.json({
      success: true,
      stats: {
        totalCustomers: totalCustomers ?? 0,
        totalLeads: totalLeads ?? 0,
        totalLoans: totalLoans ?? 0,
        conversionRate,
      },
      recentActivity: activity,
    });
  } catch (err) {
    console.error("❌ RO Dashboard Stats Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ro/customers
 * Returns paginated customers for this RO's tenant.
 */
mobileRouter.get("/customers", async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const { page = 1, limit = 30, search } = req.query;
    const from = (page - 1) * limit;
    const to = from + parseInt(limit) - 1;

    let query = supabaseAdmin
      .from("customers")
      .select("id, Firstname, Lastname, phone, id_number, status, created_at", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(
        `Firstname.ilike.%${search}%,Lastname.ilike.%${search}%,phone.ilike.%${search}%,id_number.ilike.%${search}%`
      );
    }

    const { data, count, error } = await query;
    if (error) throw error;

    const customers = (data ?? []).map((c) => ({
      id: c.id,
      first_name: c.Firstname,
      last_name: c.Lastname,
      phone: c.phone,
      id_number: c.id_number,
      status: c.status ?? "pending",
      created_at: c.created_at,
    }));

    res.json({ success: true, customers, total: count });
  } catch (err) {
    console.error("❌ RO Customers Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ro/leads
 * Returns leads for this RO.
 */
mobileRouter.get("/leads", async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("id, name, phone, status, source, created_at")
      .eq("tenant_id", tenantId)
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ success: true, leads: data ?? [] });
  } catch (err) {
    console.error("❌ RO Leads Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/ro/leads/:id
 * Update a lead's status.
 */
mobileRouter.patch("/leads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const tenantId = req.user.tenant_id;

    const validStatuses = ["hot", "warm", "cold", "converted"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status value" });
    }

    const { error } = await supabaseAdmin
      .from("leads")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) throw error;

    res.json({ success: true, message: "Lead status updated" });
  } catch (err) {
    console.error("❌ Update Lead Status Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/ro/customers/register
 * Register a new customer from the mobile app.
 * Accepts GPS coordinates and basic KYC data.
 */
mobileRouter.post("/customers/register", async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;
    const {
      first_name, last_name, dob, id_number, gender,
      phone, alt_phone, email,
      address, city, county, latitude, longitude,
      marital_status, employment_status, business_name,
    } = req.body;

    if (!first_name || !last_name || !id_number || !phone) {
      return res.status(400).json({
        success: false,
        error: "first_name, last_name, id_number and phone are required",
      });
    }

    // Check for duplicate ID
    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("id_number", id_number)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ success: false, error: "A customer with this ID number already exists." });
    }

    const { data: newCustomer, error: insertError } = await supabaseAdmin
      .from("customers")
      .insert([{
        Firstname: first_name,
        Lastname: last_name,
        dob,
        id_number,
        gender,
        phone,
        alt_phone: alt_phone || null,
        email: email || null,
        address,
        city,
        county,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        marital_status,
        employment_status,
        business_name,
        tenant_id: tenantId,
        created_by: userId,
        status: "pending",
        registration_channel: "mobile_app",
        created_at: new Date().toISOString(),
      }])
      .select("id")
      .single();

    if (insertError) throw insertError;

    res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      customerId: newCustomer.id,
    });
  } catch (err) {
    console.error("❌ Mobile Customer Register Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: human-readable time
function formatTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

export default mobileRouter;
