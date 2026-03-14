import { useState, useEffect } from "react";
import { XMarkIcon, PlusIcon, TrashIcon, PencilIcon, BuildingOfficeIcon, CalendarIcon, EyeIcon, ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../../supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../hooks/userAuth";
import { apiFetch } from "../../../utils/api.js";

// Define color constants for consistency
const PRIMARY_COLOR = "#586ab1";
const PRIMARY_LIGHT = "#6d7fc5";
const PRIMARY_DARK = "#49589d";
const BACKGROUND_GRADIENT = "linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%)";

export default function AdminCreateTenant() {
  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    logo_url: "",
    primary_color: PRIMARY_COLOR,
    secondary_color: "#6366f1",
    admin_full_name: "",
    admin_email: "",
    // C2B (Collections / Repayments)
    payment_type: "paybill",
    paybill_number: "",
    till_number: "",
    consumer_key: "",
    consumer_secret: "",
    passkey: "",
    shortcode: "",
    confirmation_url: "",
    validation_url: "",
    callback_url: "",
    c2b_environment: "sandbox",
    // B2C (Disbursements / Refunds)
    b2c_shortcode: "",
    b2c_consumer_key: "",
    b2c_consumer_secret: "",
    initiator_name: "",
    initiator_password: "",
    security_credential: "",
    b2c_callback_url: "",
    b2c_environment: "sandbox",
    // Optional fields
    cr12: "",
    company_certificate: "",
    license: "",
    tenant_id_number: "",
    phone_number: "",
    // SMS config fields
    sms_base_url: "",
    sms_api_key: "",
    sms_partner_id: "",
    sms_shortcode: "",
    document_upload_enabled: false,
    image_upload_enabled: false,
  });

  const navigate = useNavigate();
  const { profile } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [fetchingTenants, setFetchingTenants] = useState(false);
  const [tableError, setTableError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [newTenantId, setNewTenantId] = useState(null);

  // Derive SMS Sender ID preview
  const smsPreview = formData.company_name
    ? formData.company_name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 11).toUpperCase()
    : "PREVIEW";

  const location = useLocation();

  // Fetch tenants on component mount
  useEffect(() => {
    fetchTenants();

    // Check if we should open the form
    const queryParams = new URLSearchParams(location.search);
    if (queryParams.get('openForm') === 'true') {
      openCreateForm();
    }
  }, [location.search]);

  const fetchTenants = async () => {
    setFetchingTenants(true);
    setTableError("");
    try {
      let query = supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });

      // If user is admin (not superadmin), only show their tenant
      if (profile?.role === 'admin' && profile?.tenant_id) {
        query = query.eq("id", profile.tenant_id);
      }

      const { data: tenantsData, error: tenantsError } = await query;

      if (tenantsError) throw tenantsError;

      setTenants(tenantsData || []);
    } catch (err) {
      setTableError(err.message);
      console.error("Error fetching tenants:", err);
    } finally {
      setFetchingTenants(false);
    }
  };

  const handleSubmitStep1 = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await apiFetch(`/api/tenant/create-tenant`, {
        method: "POST",
        body: JSON.stringify({
          name: formData.name,
          company_name: formData.company_name,
          logo_url: formData.logo_url,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          admin_full_name: formData.admin_full_name,
          admin_email: formData.admin_email,
          // Optional fields
          cr12: formData.cr12,
          company_certificate: formData.company_certificate,
          license: formData.license,
          tenant_id_number: formData.tenant_id_number,
          phone_number: formData.phone_number,
          document_upload_enabled: formData.document_upload_enabled,
          image_upload_enabled: formData.image_upload_enabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create tenant");

      setNewTenantId(data.tenant.id);

      if (data.warning) {
        setError(data.warning);
        // If there's a temporary password, maybe show it?
        // But for now, just moving to step 2 is the priority.
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }

      setCurrentStep(2);
      await fetchTenants();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitStep2 = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const adminId = (await supabase.auth.getUser()).data.user?.id;

      // Save C2B config (repayments)
      const c2bRes = await apiFetch(`/api/tenant-mpesa-config`, {
        method: "POST",
        body: JSON.stringify({
          tenant_id: newTenantId,
          service_type: "c2b",
          paybill_number: formData.payment_type === "paybill" ? formData.paybill_number : null,
          till_number: formData.payment_type === "till" ? formData.till_number : null,
          consumer_key: formData.consumer_key,
          consumer_secret: formData.consumer_secret,
          passkey: formData.passkey,
          shortcode: formData.shortcode,
          confirmation_url: formData.confirmation_url,
          validation_url: formData.validation_url,
          callback_url: formData.callback_url,
          environment: formData.c2b_environment,
          admin_id: adminId,
        }),
      });
      const c2bData = await c2bRes.json();
      if (!c2bRes.ok) throw new Error(c2bData.error || "Failed to save C2B config");

      // Save B2C config (disbursements & refunds) — only if any B2C field is filled
      if (formData.b2c_shortcode || formData.initiator_name || formData.b2c_consumer_key) {
        const b2cRes = await apiFetch(`/api/tenant-mpesa-config`, {
          method: "POST",
          body: JSON.stringify({
            tenant_id: newTenantId,
            service_type: "b2c",
            shortcode: formData.b2c_shortcode,
            consumer_key: formData.b2c_consumer_key,
            consumer_secret: formData.b2c_consumer_secret,
            initiator_name: formData.initiator_name,
            initiator_password: formData.initiator_password,
            security_credential: formData.security_credential,
            callback_url: formData.b2c_callback_url,
            environment: formData.b2c_environment,
            admin_id: adminId,
          }),
        });
        const b2cData = await b2cRes.json();
        if (!b2cRes.ok) throw new Error(b2cData.error || "Failed to save B2C config");
      }

      // Advance to step 3 (SMS config)
      setCurrentStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitStep3 = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const smsData = {
        tenant_id: newTenantId,
        base_url: formData.sms_base_url,
        api_key: formData.sms_api_key,
        partner_id: formData.sms_partner_id,
        shortcode: formData.sms_shortcode,
      };

      const res = await apiFetch(`/api/tenant/sms-config`, {
        method: "POST",
        body: JSON.stringify(smsData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save SMS config");

      setSuccess(true);
      setTimeout(() => {
        closeForm();
        fetchTenants();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTenant = async (tenantId, updates) => {
    try {
      const { error } = await supabase
        .from("tenants")
        .update(updates)
        .eq("id", tenantId);

      if (error) throw error;

      await fetchTenants();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(`Failed to update tenant: ${err.message}`);
    }
  };

  const handleDeleteTenant = async (tenantId) => {
    if (!window.confirm("Are you sure you want to delete this tenant? This will also delete the associated admin user. This action cannot be undone.")) {
      return;
    }

    try {
      // Use the new backend endpoint for cascading delete
      const res = await apiFetch(`/api/tenant/delete-tenant/${tenantId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete tenant");
      }

      setTenants(tenants.filter(tenant => tenant.id !== tenantId));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Delete error details:", err);
      setError(`Failed to delete tenant: ${err.message}`);
    }
  };

  const openEditForm = async (tenant) => {
    setEditingTenant(tenant);
    // Pre-fill basic tenant fields immediately
    setFormData(prev => ({
      ...prev,
      name: tenant.name || "",
      company_name: tenant.company_name || "",
      cr12: tenant.cr12 || "",
      company_certificate: tenant.company_certificate || "",
      license: tenant.license || "",
      tenant_id_number: tenant.tenant_id_number || "",
      phone_number: tenant.phone_number || "",
      admin_full_name: "",
      admin_email: "",
      // reset C2B fields
      payment_type: "paybill",
      paybill_number: "",
      till_number: "",
      consumer_key: "",
      consumer_secret: "",
      passkey: "",
      shortcode: "",
      confirmation_url: "",
      validation_url: "",
      callback_url: "",
      c2b_environment: "sandbox",
      // reset B2C fields
      b2c_shortcode: "",
      b2c_consumer_key: "",
      b2c_consumer_secret: "",
      initiator_name: "",
      initiator_password: "",
      security_credential: "",
      b2c_callback_url: "",
      b2c_environment: "sandbox",
      sms_base_url: "",
      sms_api_key: "",
      sms_partner_id: "",
      sms_shortcode: "",
      document_upload_enabled: false,
      image_upload_enabled: false,
    }));
    setCurrentStep(1);
    setShowForm(true);
    setError("");
    setSuccess(false);

    // Fetch all MPESA configs, SMS config and Tenant Features
    try {
      const [mpesaAllRes, smsRes, featuresRes] = await Promise.all([
        apiFetch(`/api/tenant-mpesa-config/${tenant.id}/all`),
        apiFetch(`/api/tenant/sms-config/${tenant.id}`),
        supabase.from('tenant_features').select('document_upload_enabled, image_upload_enabled').eq('tenant_id', tenant.id).maybeSingle(),
      ]);

      const updates = {};

      if (featuresRes.data) {
        updates.document_upload_enabled = featuresRes.data.document_upload_enabled;
        updates.image_upload_enabled = featuresRes.data.image_upload_enabled;
      }

      if (mpesaAllRes.ok) {
        const { data: configs } = await mpesaAllRes.json();
        if (Array.isArray(configs)) {
          const c2b = configs.find(c => c.service_type === "c2b");
          const b2c = configs.find(c => c.service_type === "b2c");
          if (c2b) {
            updates.payment_type = c2b.paybill_number ? "paybill" : "till";
            updates.paybill_number = c2b.paybill_number || "";
            updates.till_number = c2b.till_number || "";
            updates.consumer_key = c2b.consumer_key || "";
            updates.consumer_secret = c2b.consumer_secret || "";
            updates.passkey = c2b.passkey || "";
            updates.shortcode = c2b.shortcode || "";
            updates.confirmation_url = c2b.confirmation_url || "";
            updates.validation_url = c2b.validation_url || "";
            updates.callback_url = c2b.callback_url || "";
            updates.c2b_environment = c2b.environment || "sandbox";
          }
          if (b2c) {
            updates.b2c_shortcode = b2c.shortcode || "";
            updates.b2c_consumer_key = b2c.consumer_key || "";
            updates.b2c_consumer_secret = b2c.consumer_secret || "";
            updates.initiator_name = b2c.initiator_name || "";
            updates.initiator_password = b2c.initiator_password || "";
            updates.security_credential = b2c.security_credential || "";
            updates.b2c_callback_url = b2c.callback_url || "";
            updates.b2c_environment = b2c.environment || "sandbox";
          }
        } else if (configs) {
          // Fallback: single config object (old API)
          const c = configs;
          updates.payment_type = c.paybill_number ? "paybill" : "till";
          updates.paybill_number = c.paybill_number || "";
          updates.till_number = c.till_number || "";
          updates.consumer_key = c.consumer_key || "";
          updates.consumer_secret = c.consumer_secret || "";
          updates.passkey = c.passkey || "";
          updates.shortcode = c.shortcode || "";
          updates.confirmation_url = c.confirmation_url || "";
          updates.validation_url = c.validation_url || "";
          updates.callback_url = c.callback_url || "";
          updates.c2b_environment = c.environment || "sandbox";
        }
      }

      if (smsRes.ok) {
        const { data: sms } = await smsRes.json();
        if (sms) {
          updates.sms_base_url = sms.base_url || "";
          updates.sms_api_key = sms.api_key || "";
          updates.sms_partner_id = sms.partner_id || "";
          updates.sms_shortcode = sms.shortcode || "";
        }
      }

      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({ ...prev, ...updates }));
      }
    } catch (err) {
      console.warn("Could not pre-fill configs:", err);
    }
  };

  const openCreateForm = () => {
    setEditingTenant(null);
    setFormData({
      name: "",
      company_name: "",
      logo_url: "",
      primary_color: PRIMARY_COLOR,
      secondary_color: "#6366f1",
      admin_full_name: "",
      admin_email: "",
      // C2B
      payment_type: "paybill",
      paybill_number: "",
      till_number: "",
      consumer_key: "",
      consumer_secret: "",
      passkey: "",
      shortcode: "",
      confirmation_url: "",
      validation_url: "",
      callback_url: "",
      c2b_environment: "sandbox",
      // B2C
      b2c_shortcode: "",
      b2c_consumer_key: "",
      b2c_consumer_secret: "",
      initiator_name: "",
      initiator_password: "",
      security_credential: "",
      b2c_callback_url: "",
      b2c_environment: "sandbox",
      cr12: "",
      company_certificate: "",
      license: "",
      tenant_id_number: "",
      phone_number: "",
      sms_base_url: "",
      sms_api_key: "",
      sms_partner_id: "",
      sms_shortcode: "",
      document_upload_enabled: false,
      image_upload_enabled: false,
    });
    setCurrentStep(1);
    setNewTenantId(null);
    setShowForm(true);
    setError("");
    setSuccess(false);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTenant(null);
    setCurrentStep(1);
    setNewTenantId(null);
    setError("");
    setSuccess(false);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (editingTenant) {
      setLoading(true);
      setError("");
      try {
        // 1. Update basic tenant info + optional fields
        const { error: updateErr } = await supabase
          .from("tenants")
          .update({
            name: formData.name,
            company_name: formData.company_name,
            cr12: formData.cr12 || null,
            company_certificate: formData.company_certificate || null,
            license: formData.license || null,
            tenant_id_number: formData.tenant_id_number || null,
            phone_number: formData.phone_number || null,
          })
          .eq("id", editingTenant.id);
        if (updateErr) throw updateErr;

        // 1.5 Update tenant features
        const { error: featureErr } = await supabase
          .from("tenant_features")
          .upsert({
            tenant_id: editingTenant.id,
            document_upload_enabled: formData.document_upload_enabled,
            image_upload_enabled: formData.image_upload_enabled,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'tenant_id' });
        if (featureErr) throw featureErr;

        // 2. Save C2B config (repayments)
        const adminId = (await supabase.auth.getUser()).data.user?.id;
        if (formData.consumer_key || formData.passkey || formData.paybill_number || formData.till_number) {
          const c2bRes = await apiFetch(`/api/tenant-mpesa-config`, {
            method: "POST",
            body: JSON.stringify({
              tenant_id: editingTenant.id,
              service_type: "c2b",
              paybill_number: formData.payment_type === "paybill" ? formData.paybill_number : null,
              till_number: formData.payment_type === "till" ? formData.till_number : null,
              consumer_key: formData.consumer_key,
              consumer_secret: formData.consumer_secret,
              passkey: formData.passkey,
              shortcode: formData.shortcode,
              confirmation_url: formData.confirmation_url,
              validation_url: formData.validation_url,
              callback_url: formData.callback_url,
              environment: formData.c2b_environment,
              admin_id: adminId,
            }),
          });
          const c2bData = await c2bRes.json();
          if (!c2bRes.ok) throw new Error(c2bData.error || "Failed to save C2B config");
        }

        // 3. Save B2C config (disbursements & refunds)
        if (formData.b2c_shortcode || formData.initiator_name || formData.b2c_consumer_key) {
          const b2cRes = await apiFetch(`/api/tenant-mpesa-config`, {
            method: "POST",
            body: JSON.stringify({
              tenant_id: editingTenant.id,
              service_type: "b2c",
              shortcode: formData.b2c_shortcode,
              consumer_key: formData.b2c_consumer_key,
              consumer_secret: formData.b2c_consumer_secret,
              initiator_name: formData.initiator_name,
              initiator_password: formData.initiator_password,
              security_credential: formData.security_credential,
              callback_url: formData.b2c_callback_url,
              environment: formData.b2c_environment,
              admin_id: adminId,
            }),
          });
          const b2cData = await b2cRes.json();
          if (!b2cRes.ok) throw new Error(b2cData.error || "Failed to save B2C config");
        }

        // 3. Save SMS config if any field is filled
        if (formData.sms_base_url || formData.sms_api_key || formData.sms_partner_id || formData.sms_shortcode) {
          const smsRes = await apiFetch(`/api/tenant/sms-config`, {
            method: "POST",
            body: JSON.stringify({
              tenant_id: editingTenant.id,
              base_url: formData.sms_base_url,
              api_key: formData.sms_api_key,
              partner_id: formData.sms_partner_id,
              shortcode: formData.sms_shortcode,
            }),
          });
          const smsData = await smsRes.json();
          if (!smsRes.ok) throw new Error(smsData.error || "Failed to save SMS config");
        }

        await fetchTenants();
        setSuccess(true);
        setTimeout(() => {
          closeForm();
          setSuccess(false);
        }, 1500);
      } catch (err) {
        setError(`Failed to update tenant: ${err.message}`);
      } finally {
        setLoading(false);
      }
    } else {
      if (currentStep === 1) {
        await handleSubmitStep1(e);
      } else if (currentStep === 2) {
        await handleSubmitStep2(e);
      } else {
        await handleSubmitStep3(e);
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const getTenantsThisMonth = () => {
    const now = new Date();
    return tenants.filter(t => {
      const created = new Date(t.created_at);
      return created.getMonth() === now.getMonth() &&
        created.getFullYear() === now.getFullYear();
    }).length;
  };

  const handleViewTenant = (tenantId) => {
    navigate(`/tenants_details/${tenantId}`);
  };

  return (
    <div className="min-h-screen p-4 md:p-6 bg-brand-surface" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header - Smaller */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-lg md:text-sm font-bold text-brand-primary mb-1">Tenant Management</h1>
            </div>
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-white transition-colors bg-brand-primary hover:bg-brand-btn shadow-md"
            >
              <PlusIcon className="h-4 w-4" />
              New Tenant
            </button>
          </div>
        </div>

        {/* Stats Cards - Smaller */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div
            className="relative overflow-hidden rounded-lg p-4 text-white shadow-md bg-brand-primary"
          >
            <div className="relative z-10">
              <p className="text-xs font-medium text-white/90 mb-1">Total Tenants</p>
              <p className="text-2xl font-bold mb-2">{tenants.length}</p>
              <BuildingOfficeIcon className="h-5 w-5 text-white/80" />
            </div>
            <div className="absolute top-2 right-2 h-16 w-16 rounded-full bg-white/10"></div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Created This Month</p>
                <p className="text-2xl font-bold text-gray-900 mb-2">{getTenantsThisMonth()}</p>
              </div>
              <div className="h-8 w-8 rounded flex items-center justify-center bg-brand-surface">
                <CalendarIcon className="h-4 w-4 text-brand-primary" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Active Status</p>
                <p className="text-2xl font-bold text-gray-900 mb-2">{tenants.length}</p>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs text-gray-600">All Active</span>
                </div>
              </div>
              <div className="h-8 w-8 rounded flex items-center justify-center bg-brand-surface">
                <div className="h-4 w-4 rounded-full bg-brand-primary"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Tenants Table - More compact */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-brand-primary">All Tenants</h2>
                <p className="text-gray-500 text-xs mt-1">View and manage tenant organizations</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchTenants}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors bg-brand-surface text-brand-primary hover:bg-brand-surface/70"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {tableError && (
            <div className="mx-5 mt-4 p-3 rounded-lg border bg-rose-50 border-rose-200">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="h-3 w-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-red-700 text-sm font-medium">Error: {tableError}</p>
              </div>
            </div>
          )}

          {fetchingTenants ? (
            <div className="p-8 text-center">
              <div className="inline-flex flex-col items-center">
                <div
                  className="animate-spin rounded-full h-10 w-10 border-3 mb-4 border-brand-surface border-t-brand-primary"
                ></div>
                <p className="text-gray-700 text-sm font-medium">Loading tenants...</p>
                <p className="text-gray-500 text-xs mt-1">Fetching your tenant data</p>
              </div>
            </div>
          ) : tenants.length === 0 ? (
            <div className="p-8 text-center">
              <div className="max-w-xs mx-auto">
                <div
                  className="h-16 w-16 mx-auto mb-4 rounded-xl flex items-center justify-center bg-brand-surface"
                >
                  <BuildingOfficeIcon className="h-8 w-8 text-brand-primary" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">No tenants found</h3>
                <p className="text-gray-500 text-sm mb-6">Create your first tenant organization to get started</p>
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-white transition-colors bg-brand-primary hover:bg-brand-btn shadow-md"
                >
                  <PlusIcon className="h-4 w-4" />
                  Create First Tenant
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-brand-surface/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary uppercase tracking-wider">
                      Tenant Details
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary uppercase tracking-wider">
                      Company Info
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary uppercase tracking-wider text-center">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary uppercase tracking-wider">
                      Created Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tenants.map((tenant) => {
                    const { date, time } = formatDate(tenant.created_at);
                    return (
                      <tr key={tenant.id} className="group hover:bg-brand-surface/10 transition-colors duration-150">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-700">
                                {tenant.name}
                              </h3>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded flex items-center justify-center bg-brand-surface">
                              <BuildingOfficeIcon className="h-3.5 w-3.5 text-brand-primary" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-900">{tenant.company_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {tenant.onboarding_completed ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 border border-green-200">
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-200 animate-pulse">
                              Pending Config
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            <div className="text-sm text-gray-900 flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3 text-brand-primary" />
                              {date}
                            </div>
                            <div className="text-xs text-gray-500">
                              {time}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewTenant(tenant.id)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors bg-brand-surface text-brand-primary hover:bg-brand-surface/70"
                              title="View Details"
                            >
                              <EyeIcon className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditForm(tenant)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-colors bg-white"
                              title="Edit"
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteTenant(tenant.id)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors bg-white"
                              title="Delete"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Success/Error Toast - High Z-index */}
        {(success || error) && (
          <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] w-full max-w-sm px-4 animate-slide-down">
            {success && (
              <div className="bg-white rounded-xl shadow-2xl p-4 border border-green-100 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">Success!</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {editingTenant ? 'Tenant updated' : 'Tenant created successfully'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccess(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            )}
            {error && (
              <div className="bg-white rounded-xl shadow-2xl p-4 border border-red-100 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">Action Required</p>
                  <p className="text-xs text-gray-600 mt-0.5">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError("")}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Form Modal - More compact */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="w-full max-w-2xl my-4 animate-scale-in">
              <div className="bg-white rounded-xl shadow-xl overflow-hidden">
                <div
                  className="px-6 py-4 text-white relative overflow-hidden bg-brand-primary"
                >
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      {!editingTenant && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${currentStep === 1 ? 'bg-white text-brand-primary' : 'bg-white/20 text-white'}`}>Step 1</span>
                          <div className="h-px w-4 bg-white/30"></div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${currentStep === 2 ? 'bg-white text-brand-primary' : 'bg-white/20 text-white'}`}>Step 2</span>
                          <div className="h-px w-4 bg-white/30"></div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${currentStep === 3 ? 'bg-white text-brand-primary' : 'bg-white/20 text-white'}`}>Step 3</span>
                        </div>
                      )}
                      <h2 className="text-lg font-bold">
                        {editingTenant
                          ? `Edit ${editingTenant.name}`
                          : currentStep === 1 ? 'Tenant Onboarding'
                            : currentStep === 2 ? 'Mpesa Gateway Configuration'
                              : 'SMS Gateway Configuration'}
                      </h2>
                      <p className="text-white/90 text-xs mt-1">
                        {editingTenant
                          ? 'Update tenant details & SMS config'
                          : currentStep === 1 ? 'Step 1: Company & Admin details'
                            : currentStep === 2 ? 'Step 2: Payment credentials'
                              : 'Step 3: SMS gateway credentials'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeForm}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="max-h-[calc(100vh-100px)] overflow-y-auto">
                  <div className="p-6">
                    <form onSubmit={handleFormSubmit} className="space-y-6">
                      {currentStep === 1 ? (
                        <div className="space-y-6">
                          {/* Tenant Information */}
                          <div className="space-y-4">
                            <div className="pb-3 border-b border-gray-100">
                              <h3 className="text-sm font-semibold text-gray-900">Tenant Information</h3>
                              <p className="text-gray-500 text-xs mt-1">Basic details about the tenant</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">
                                  Display Name *
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g., Biz Money Inc."
                                  value={formData.name}
                                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all outline-none"
                                />
                                <p className="text-xs text-gray-500 mt-1">Public facing name</p>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">
                                  Company Legal Name *
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Company Legal Name"
                                  value={formData.company_name}
                                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Optional Documents & IDs */}
                          <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="pb-2">
                              <h3 className="text-sm font-semibold text-gray-900">Additional Details (Optional)</h3>
                              <p className="text-gray-500 text-xs mt-1">Legal documents and contact info</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">
                                  CR12 Number
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. CR12-12345"
                                  value={formData.cr12}
                                  onChange={(e) => setFormData({ ...formData, cr12: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">
                                  Company Certificate
                                </label>
                                <input
                                  type="text"
                                  placeholder="Certificate No."
                                  value={formData.company_certificate}
                                  onChange={(e) => setFormData({ ...formData, company_certificate: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">
                                  Business License
                                </label>
                                <input
                                  type="text"
                                  placeholder="License No."
                                  value={formData.license}
                                  onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">
                                  Tenant ID / Registration No.
                                </label>
                                <input
                                  type="text"
                                  placeholder="Reg No."
                                  value={formData.tenant_id_number}
                                  onChange={(e) => setFormData({ ...formData, tenant_id_number: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">
                                  Phone Number
                                </label>
                                <input
                                  type="tel"
                                  placeholder="+254..."
                                  value={formData.phone_number}
                                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Feature Toggles */}
                          <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="pb-2">
                              <h3 className="text-sm font-semibold text-gray-900">Feature Settings</h3>
                              <p className="text-gray-500 text-xs mt-1">Enable or disable specific features for this tenant</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                              <div className="flex items-center justify-between">
                                <div>
                                  <label className="text-xs font-bold text-gray-700 block">Document Uploads</label>
                                  <p className="text-[10px] text-gray-500">Allow relationship officers to upload customer documents</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setFormData({ ...formData, document_upload_enabled: !formData.document_upload_enabled })}
                                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.document_upload_enabled ? 'bg-brand-primary' : 'bg-gray-200'}`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.document_upload_enabled ? 'translate-x-5' : 'translate-x-0'}`}
                                  />
                                </button>
                              </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 mt-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <label className="text-xs font-bold text-gray-700 block">Image Uploads</label>
                                  <p className="text-[10px] text-gray-500">Allow relationship officers to upload customer photos and business images</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setFormData({ ...formData, image_upload_enabled: !formData.image_upload_enabled })}
                                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.image_upload_enabled ? 'bg-brand-primary' : 'bg-gray-200'}`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.image_upload_enabled ? 'translate-x-5' : 'translate-x-0'}`}
                                  />
                                </button>
                              </div>
                            </div>

                          </div>

                          {/* SMS Sender ID Preview */}
                          <div className="bg-brand-surface rounded-xl p-4 border border-brand-surface/50">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-xs font-bold text-brand-primary uppercase tracking-tight">SMS Sender ID Preview</h4>
                                <p className="text-[10px] text-gray-500">Auto-generated from legal name (max 11 chars)</p>
                              </div>
                              <span className="text-sm font-mono font-black text-brand-primary bg-white px-3 py-1 rounded border border-brand-surface shadow-sm">
                                {smsPreview}
                              </span>
                            </div>
                          </div>

                          {/* Admin Information - Only for new tenants */}
                          {!editingTenant && (
                            <div className="space-y-4">
                              <div className="pb-3 border-b border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-900">Admin Account</h3>
                                <p className="text-gray-500 text-xs mt-1">Create initial admin user</p>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">
                                    Admin Full Name *
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="John Doe"
                                    value={formData.admin_full_name}
                                    onChange={(e) => setFormData({ ...formData, admin_full_name: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">
                                    Admin Email *
                                  </label>
                                  <input
                                    type="email"
                                    required
                                    placeholder="admin@company.com"
                                    value={formData.admin_email}
                                    onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all outline-none"
                                  />
                                  <p className="text-xs text-gray-500 mt-1 italic">Password setup link will be emailed</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* SMS Config - shown when editing */}
                          {editingTenant && (
                            <>
                              {/* Optional Details */}
                              <div className="space-y-4 pt-4 border-t border-gray-100">
                                <div className="pb-2">
                                  <h3 className="text-sm font-semibold text-gray-900">Additional Details</h3>
                                  <p className="text-gray-500 text-xs mt-1">Legal documents and contact info</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">CR12 Number</label>
                                    <input type="text" placeholder="e.g. CR12-12345" value={formData.cr12}
                                      onChange={e => setFormData({ ...formData, cr12: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Company Certificate</label>
                                    <input type="text" placeholder="Certificate number" value={formData.company_certificate}
                                      onChange={e => setFormData({ ...formData, company_certificate: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">License Number</label>
                                    <input type="text" placeholder="License number" value={formData.license}
                                      onChange={e => setFormData({ ...formData, license: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">ID Number</label>
                                    <input type="text" placeholder="Tenant ID / KRA PIN" value={formData.tenant_id_number}
                                      onChange={e => setFormData({ ...formData, tenant_id_number: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Phone Number</label>
                                    <input type="tel" placeholder="+254..." value={formData.phone_number}
                                      onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                  </div>
                                </div>
                              </div>

                              {/* MPESA Config */}
                              <div className="space-y-4 pt-4 border-t border-gray-100">
                                <div className="pb-2">
                                  <h3 className="text-sm font-semibold text-gray-900">MPESA Configuration</h3>
                                  <p className="text-gray-500 text-xs mt-1">Update payment gateway credentials</p>
                                </div>
                                {/* Payment type toggle */}
                                <div className="flex gap-3">
                                  {['paybill', 'till'].map(type => (
                                    <button key={type} type="button"
                                      onClick={() => setFormData({ ...formData, payment_type: type })}
                                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${formData.payment_type === type
                                        ? 'bg-brand-primary text-white border-brand-primary'
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                        }`}>
                                      {type === 'paybill' ? 'Paybill' : 'Till Number'}
                                    </button>
                                  ))}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700 mb-2">
                                      {formData.payment_type === 'paybill' ? 'Paybill Number' : 'Till Number'}
                                    </label>
                                    <input type="text"
                                      placeholder={formData.payment_type === 'paybill' ? 'e.g. 4157991' : 'e.g. 521234'}
                                      value={formData.payment_type === 'paybill' ? formData.paybill_number : formData.till_number}
                                      onChange={e => setFormData({ ...formData, [formData.payment_type === 'paybill' ? 'paybill_number' : 'till_number']: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Shortcode</label>
                                    <input type="text" value={formData.shortcode}
                                      onChange={e => setFormData({ ...formData, shortcode: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Consumer Key</label>
                                    <input type="text" value={formData.consumer_key}
                                      onChange={e => setFormData({ ...formData, consumer_key: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono text-[10px] focus:ring-1 focus:ring-brand-primary outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Consumer Secret</label>
                                    <input type="password" value={formData.consumer_secret}
                                      onChange={e => setFormData({ ...formData, consumer_secret: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Passkey</label>
                                    <input type="password" value={formData.passkey}
                                      onChange={e => setFormData({ ...formData, passkey: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Callback URL</label>
                                    <input type="url" placeholder="https://..." value={formData.callback_url}
                                      onChange={e => setFormData({ ...formData, callback_url: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Confirmation URL</label>
                                    <input type="url" placeholder="https://..." value={formData.confirmation_url}
                                      onChange={e => setFormData({ ...formData, confirmation_url: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Validation URL</label>
                                    <input type="url" placeholder="https://..." value={formData.validation_url}
                                      onChange={e => setFormData({ ...formData, validation_url: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Environment</label>
                                    <select value={formData.environment} onChange={e => setFormData({ ...formData, environment: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none bg-white">
                                      <option value="sandbox">Sandbox</option>
                                      <option value="production">Production</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Service Type</label>
                                    <select value={formData.service_type} onChange={e => setFormData({ ...formData, service_type: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none bg-white">
                                      <option value="c2b">C2B (Customer to Business)</option>
                                      <option value="b2c">B2C (Business to Customer)</option>
                                    </select>
                                  </div>
                                  <div className="md:col-span-2 pt-2 border-t border-gray-100">
                                    <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-3">Initiator Credentials (B2C)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <div>
                                        <label className="block text-[10px] font-medium text-gray-700 mb-1">Initiator Name</label>
                                        <input type="text" placeholder="e.g. Jasiri_B2C" value={formData.initiator_name}
                                          onChange={e => setFormData({ ...formData, initiator_name: e.target.value })}
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium text-gray-700 mb-1">Initiator Password</label>
                                        <input type="password" placeholder="••••••••" value={formData.initiator_password}
                                          onChange={e => setFormData({ ...formData, initiator_password: e.target.value })}
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium text-gray-700 mb-1">Security Credential</label>
                                        <input type="password" placeholder="••••••••" value={formData.security_credential}
                                          onChange={e => setFormData({ ...formData, security_credential: e.target.value })}
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* SMS Gateway */}
                              <div className="space-y-4 pt-4 border-t border-gray-100">
                                <div className="pb-2">
                                  <h3 className="text-sm font-semibold text-gray-900">SMS Gateway Configuration</h3>
                                  <p className="text-gray-500 text-xs mt-1">Set or update the SMS provider credentials</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Base URL</label>
                                    <input
                                      type="url"
                                      placeholder="https://sms-gateway.example.com/api"
                                      value={formData.sms_base_url}
                                      onChange={e => setFormData({ ...formData, sms_base_url: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">API Key</label>
                                    <input
                                      type="password"
                                      placeholder="Enter API key"
                                      value={formData.sms_api_key}
                                      onChange={e => setFormData({ ...formData, sms_api_key: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Partner ID</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. 1234"
                                      value={formData.sms_partner_id}
                                      onChange={e => setFormData({ ...formData, sms_partner_id: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">Shortcode (SMS)</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. COMPANY or 12345"
                                      value={formData.sms_shortcode}
                                      onChange={e => setFormData({ ...formData, sms_shortcode: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ) : currentStep === 3 ? (
                        /* Step 3: SMS Gateway Configuration */
                        <div className="space-y-6">
                          <div className="bg-brand-surface/40 rounded-xl p-6 border border-brand-surface">
                            <h3 className="text-sm font-bold text-brand-primary uppercase tracking-widest mb-1">SMS Gateway</h3>
                            <p className="text-xs text-gray-500 mb-4">Configure the SMS provider credentials for this tenant</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-700 mb-2">Base URL *</label>
                                <input
                                  type="url"
                                  required
                                  placeholder="https://sms-gateway.example.com/api"
                                  value={formData.sms_base_url}
                                  onChange={e => setFormData({ ...formData, sms_base_url: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">API Key *</label>
                                <input
                                  type="password"
                                  required
                                  placeholder="Enter API key"
                                  value={formData.sms_api_key}
                                  onChange={e => setFormData({ ...formData, sms_api_key: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">Partner ID *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. 1234"
                                  value={formData.sms_partner_id}
                                  onChange={e => setFormData({ ...formData, sms_partner_id: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-2">Shortcode *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. COMPANY or 12345"
                                  value={formData.sms_shortcode}
                                  onChange={e => setFormData({ ...formData, sms_shortcode: e.target.value })}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Collection method toggle */}
                          <div className="bg-brand-surface/40 rounded-xl p-5 border border-brand-surface">
                            <h3 className="text-sm font-bold text-brand-primary uppercase tracking-widest mb-3">Collection Method</h3>
                            <div className="flex gap-4">
                              <label className={`flex-1 flex flex-col items-center justify-center p-4 bg-white border-2 rounded-xl cursor-pointer transition-all ${formData.payment_type === 'paybill' ? 'border-brand-primary bg-brand-surface/20 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}>
                                <input type="radio" name="payment_type" value="paybill" checked={formData.payment_type === 'paybill'} onChange={e => setFormData({ ...formData, payment_type: e.target.value })} className="hidden" />
                                <span className={`text-xs font-black uppercase tracking-widest ${formData.payment_type === 'paybill' ? 'text-brand-primary' : 'text-gray-500'}`}>Paybill</span>
                                <p className="text-[10px] text-gray-400 mt-1">Corporate Collections</p>
                              </label>
                              <label className={`flex-1 flex flex-col items-center justify-center p-4 bg-white border-2 rounded-xl cursor-pointer transition-all ${formData.payment_type === 'till' ? 'border-brand-primary bg-brand-surface/20 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}>
                                <input type="radio" name="payment_type" value="till" checked={formData.payment_type === 'till'} onChange={e => setFormData({ ...formData, payment_type: e.target.value })} className="hidden" />
                                <span className={`text-xs font-black uppercase tracking-widest ${formData.payment_type === 'till' ? 'text-brand-primary' : 'text-gray-500'}`}>Buy Goods Till</span>
                                <p className="text-[10px] text-gray-400 mt-1">Merchant Collections</p>
                              </label>
                            </div>
                          </div>

                          {/* C2B Card */}
                          <div className="rounded-xl border-2 border-green-100 overflow-hidden">
                            <div className="bg-green-50 px-5 py-3 flex items-center gap-2 border-b border-green-100">
                              <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-green-800 uppercase tracking-wider">C2B &mdash; Collections (Repayments)</p>
                                <p className="text-[10px] text-green-600">Customer pays to business &middot; Used for loan repayments</p>
                              </div>
                            </div>
                            <div className="p-5 bg-white">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-medium text-gray-700 mb-2">{formData.payment_type === 'paybill' ? 'Paybill Number' : 'Till Number'} *</label>
                                  <input type="text" required
                                    placeholder={formData.payment_type === 'paybill' ? 'e.g. 4157991' : 'e.g. 521234'}
                                    value={formData.payment_type === 'paybill' ? formData.paybill_number : formData.till_number}
                                    onChange={(e) => setFormData({ ...formData, [formData.payment_type === 'paybill' ? 'paybill_number' : 'till_number']: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-green-400 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">Shortcode *</label>
                                  <input type="text" required value={formData.shortcode} onChange={e => setFormData({ ...formData, shortcode: e.target.value })} placeholder="Same as paybill/till" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-green-400 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">Environment *</label>
                                  <select value={formData.c2b_environment} onChange={e => setFormData({ ...formData, c2b_environment: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-green-400 outline-none bg-white">
                                    <option value="sandbox">Sandbox</option>
                                    <option value="production">Production</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">Consumer Key *</label>
                                  <input type="text" required value={formData.consumer_key} onChange={e => setFormData({ ...formData, consumer_key: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono text-[10px] focus:ring-1 focus:ring-green-400 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">Consumer Secret *</label>
                                  <input type="password" required value={formData.consumer_secret} onChange={e => setFormData({ ...formData, consumer_secret: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-green-400 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">Passkey *</label>
                                  <input type="password" required value={formData.passkey} onChange={e => setFormData({ ...formData, passkey: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-green-400 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">Callback URL *</label>
                                  <input type="url" required value={formData.callback_url} onChange={e => setFormData({ ...formData, callback_url: e.target.value })} placeholder="https://your-api.com/mpesa/c2b/callback" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-green-400 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">Confirmation URL</label>
                                  <input type="url" value={formData.confirmation_url} onChange={e => setFormData({ ...formData, confirmation_url: e.target.value })} placeholder="https://your-api.com/mpesa/confirm" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-green-400 outline-none" />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="block text-xs font-medium text-gray-700 mb-2">Validation URL</label>
                                  <input type="url" value={formData.validation_url} onChange={e => setFormData({ ...formData, validation_url: e.target.value })} placeholder="https://your-api.com/mpesa/validate" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-green-400 outline-none" />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* B2C Card */}
                          <div className="rounded-xl border-2 border-blue-100 overflow-hidden">
                            <div className="bg-blue-50 px-5 py-3 flex items-center gap-2 border-b border-blue-100">
                              <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">B2C &mdash; Disbursements &amp; Refunds</p>
                                <p className="text-[10px] text-blue-600">Business pays to customer &middot; Used for loan disbursements and refunds</p>
                              </div>
                            </div>
                            <div className="p-5 bg-white">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">B2C Shortcode</label>
                                  <input type="text" value={formData.b2c_shortcode} onChange={e => setFormData({ ...formData, b2c_shortcode: e.target.value })} placeholder="e.g. 600XXX" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-400 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">Environment</label>
                                  <select value={formData.b2c_environment} onChange={e => setFormData({ ...formData, b2c_environment: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-400 outline-none bg-white">
                                    <option value="sandbox">Sandbox</option>
                                    <option value="production">Production</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">Consumer Key</label>
                                  <input type="text" value={formData.b2c_consumer_key} onChange={e => setFormData({ ...formData, b2c_consumer_key: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono text-[10px] focus:ring-1 focus:ring-blue-400 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">Consumer Secret</label>
                                  <input type="password" value={formData.b2c_consumer_secret} onChange={e => setFormData({ ...formData, b2c_consumer_secret: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-400 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">Initiator Name</label>
                                  <input type="text" placeholder="e.g. JasiriAPI" value={formData.initiator_name} onChange={e => setFormData({ ...formData, initiator_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-400 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">Initiator Password</label>
                                  <input type="password" placeholder="••••••••" value={formData.initiator_password} onChange={e => setFormData({ ...formData, initiator_password: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-400 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">Security Credential</label>
                                  <input type="password" placeholder="••••••••" value={formData.security_credential} onChange={e => setFormData({ ...formData, security_credential: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-400 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">B2C Callback URL</label>
                                  <input type="url" value={formData.b2c_callback_url} onChange={e => setFormData({ ...formData, b2c_callback_url: e.target.value })} placeholder="https://your-api.com/mpesa/b2c/result" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-400 outline-none" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Form Actions */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-5 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={() => {
                            if (currentStep === 3) setCurrentStep(2);
                            else if (currentStep === 2) setCurrentStep(1);
                            else closeForm();
                          }}
                          className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
                        >
                          {currentStep > 1 ? 'Back' : 'Cancel'}
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-2.5 px-4 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-btn shadow-md"
                        >
                          {loading ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                              {editingTenant ? 'Updating...' : 'Processing...'}
                            </>
                          ) : (
                            editingTenant ? 'Update Tenant'
                              : currentStep === 1 ? 'Continue to Mpesa'
                                : currentStep === 2 ? 'Continue to SMS'
                                  : 'Complete Onboarding'
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
