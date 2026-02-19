import { useState, useEffect } from "react";
import { XMarkIcon, PlusIcon, TrashIcon, PencilIcon, BuildingOfficeIcon, CalendarIcon, EyeIcon, ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../../supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../../../../config.js";

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
    // Mpesa config fields
    payment_type: "paybill", // 'paybill' or 'till'
    paybill_number: "",
    till_number: "",
    consumer_key: "",
    consumer_secret: "",
    passkey: "",
    shortcode: "",
    confirmation_url: "",
    validation_url: "",
    callback_url: "",
    // Optional fields
    cr12: "",
    company_certificate: "",
    license: "",
    tenant_id_number: "",
    phone_number: "",
  });

  const navigate = useNavigate();
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
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });

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
      const res = await fetch(`${API_BASE_URL}/api/tenant/create-tenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          company_name: formData.company_name,
          logo_url: formData.logo_url,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          admin_full_name: formData.admin_full_name,
          admin_full_name: formData.admin_full_name,
          admin_email: formData.admin_email,
          // Optional fields
          cr12: formData.cr12,
          company_certificate: formData.company_certificate,
          license: formData.license,
          tenant_id_number: formData.tenant_id_number,
          phone_number: formData.phone_number,
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
      const mpesaData = {
        tenant_id: newTenantId,
        paybill_number: formData.payment_type === "paybill" ? formData.paybill_number : null,
        till_number: formData.payment_type === "till" ? formData.till_number : null,
        consumer_key: formData.consumer_key,
        consumer_secret: formData.consumer_secret,
        passkey: formData.passkey,
        shortcode: formData.shortcode,
        confirmation_url: formData.confirmation_url,
        validation_url: formData.validation_url,
        callback_url: formData.callback_url,
        admin_id: (await supabase.auth.getUser()).data.user?.id
      };

      const res = await fetch(`${API_BASE_URL}/api/tenant-mpesa-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mpesaData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save Mpesa config");

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
      const res = await fetch(`${API_BASE_URL}/api/tenant/delete-tenant/${tenantId}`, {
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

  const openEditForm = (tenant) => {
    setEditingTenant(tenant);
    setFormData({
      ...formData,
      name: tenant.name || "",
      company_name: tenant.company_name || "",
      admin_full_name: "",
      admin_email: "",
    });
    setCurrentStep(1);
    setShowForm(true);
    setError("");
    setSuccess(false);
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
      payment_type: "paybill",
      paybill_number: "",
      till_number: "",
      consumer_key: "",
      consumer_secret: "",
      passkey: "",
      shortcode: "",
      confirmation_url: "",
      validation_url: "",
      validation_url: "",
      callback_url: "",
      cr12: "",
      company_certificate: "",
      license: "",
      tenant_id_number: "",
      phone_number: "",
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
      const updates = {
        name: formData.name,
        company_name: formData.company_name,
      };

      await handleUpdateTenant(editingTenant.id, updates);
      closeForm();
    } else {
      if (currentStep === 1) {
        await handleSubmitStep1(e);
      } else {
        await handleSubmitStep2(e);
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
                        </div>
                      )}
                      <h2 className="text-lg font-bold">
                        {editingTenant ? `Edit ${editingTenant.name}` : currentStep === 1 ? 'Tenant Onboarding' : 'Mpesa Gateway Configuration'}
                      </h2>
                      <p className="text-white/90 text-xs mt-1">
                        {editingTenant ? 'Update tenant details' : currentStep === 1 ? 'Step 1: Company & Admin details' : 'Step 2: Payment credentials'}
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
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Step 2: Mpesa Configuration */}
                          <div className="bg-brand-surface/40 rounded-xl p-6 border border-brand-surface">
                            <h3 className="text-sm font-bold text-brand-primary uppercase tracking-widest mb-4">Mpesa Gateway Type</h3>

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

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-2">
                                {formData.payment_type === 'paybill' ? 'Paybill Number' : 'Till Number'} *
                              </label>
                              <input
                                type="text" required
                                placeholder={formData.payment_type === 'paybill' ? "e.g. 4157991" : "e.g. 521234"}
                                value={formData.payment_type === 'paybill' ? formData.paybill_number : formData.till_number}
                                onChange={(e) => setFormData({ ...formData, [formData.payment_type === 'paybill' ? 'paybill_number' : 'till_number']: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-2">Shortcode *</label>
                              <input type="text" required value={formData.shortcode} onChange={e => setFormData({ ...formData, shortcode: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-2">Consumer Key *</label>
                              <input type="text" required value={formData.consumer_key} onChange={e => setFormData({ ...formData, consumer_key: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg font-mono text-[10px] focus:ring-1 focus:ring-brand-primary outline-none" />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-2">Consumer Secret *</label>
                              <input type="password" required value={formData.consumer_secret} onChange={e => setFormData({ ...formData, consumer_secret: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-2">Passkey *</label>
                              <input type="password" required value={formData.passkey} onChange={e => setFormData({ ...formData, passkey: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-gray-700 mb-2">Main Callback URL *</label>
                              <input type="url" required value={formData.callback_url} onChange={e => setFormData({ ...formData, callback_url: e.target.value })} placeholder="https://your-api.com/mpesa/callback" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Form Actions */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-5 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={() => currentStep === 2 ? setCurrentStep(1) : closeForm()}
                          className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
                        >
                          {currentStep === 2 ? 'Back' : 'Cancel'}
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
                            editingTenant ? 'Update Tenant' : currentStep === 1 ? 'Continue to Mpesa' : 'Complete Onboarding'
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
