import { useState, useEffect } from "react";
import { XMarkIcon, PlusIcon, TrashIcon, PencilIcon, BuildingOfficeIcon, CalendarIcon, EyeIcon, ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../../supabaseClient";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../../../config.js";

// Define color constants for consistency
const PRIMARY_COLOR = "#586ab1";
const PRIMARY_LIGHT = "#6d7fc5";
const PRIMARY_DARK = "#49589d";
const BACKGROUND_GRADIENT = "linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%)";

export default function AdminCreateTenant() {
  const [loading, setLoading] = useState(false);
  const [fetchingTenants, setFetchingTenants] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [tableError, setTableError] = useState("");
  const [tenants, setTenants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    logo_url: "",
    primary_color: PRIMARY_COLOR,
    secondary_color: "#6366f1",
    admin_full_name: "",
    admin_email: "",
  });

  // Fetch tenants on component mount
  useEffect(() => {
    fetchTenants();
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
     const res = await fetch(`${API_BASE_URL}/api/tenant/create-tenant`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(formData),
});

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create tenant");

      setSuccess(true);
      setFormData({
        name: "",
        company_name: "",
        logo_url: "",
        primary_color: PRIMARY_COLOR,
        secondary_color: "#6366f1",
        admin_full_name: "",
        admin_email: "",
      });
      
      await fetchTenants();
      
      setTimeout(() => {
        setShowForm(false);
        setEditingTenant(null);
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
      const { data: adminUser, error: userError } = await supabase
        .from("users")
        .select("id, auth_id")
        .eq("tenant_id", tenantId)
        .eq("role", "admin")
        .maybeSingle();

      if (userError) throw userError;

      if (adminUser) {
        const { error: deleteUserError } = await supabase
          .from("users")
          .delete()
          .eq("id", adminUser.id);

        if (deleteUserError) throw deleteUserError;
      }

      const { error } = await supabase
        .from("tenants")
        .delete()
        .eq("id", tenantId);

      if (error) throw error;
      
      setTenants(tenants.filter(tenant => tenant.id !== tenantId));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Delete error details:", err);
      setError(`Failed to delete tenant: ${err.message}. Please check if there are other users (non-admin) associated with this tenant.`);
    }
  };

  const openEditForm = (tenant) => {
    setEditingTenant(tenant);
    setFormData({
      name: tenant.name || "",
      company_name: tenant.company_name || "",
      logo_url: tenant.logo_url || "",
      primary_color: tenant.primary_color || PRIMARY_COLOR,
      secondary_color: tenant.secondary_color || "#6366f1",
      admin_full_name: "",
      admin_email: "",
    });
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
    });
    setShowForm(true);
    setError("");
    setSuccess(false);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTenant(null);
    setError("");
    setSuccess(false);
    setFormData({
      name: "",
      company_name: "",
      logo_url: "",
      primary_color: PRIMARY_COLOR,
      secondary_color: "#6366f1",
      admin_full_name: "",
      admin_email: "",
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    if (editingTenant) {
      const updates = {
        name: formData.name,
        company_name: formData.company_name,
        logo_url: formData.logo_url,
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
      };
      
      await handleUpdateTenant(editingTenant.id, updates);
      closeForm();
    } else {
      await handleSubmit(e);
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
    <div className="min-h-screen p-4 md:p-6" style={{ background: BACKGROUND_GRADIENT, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header - Smaller */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-lg md:text-sm  text-slate-600 mb-1">Tenant Management</h1>
            </div>
            <button
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-white transition-colors"
              style={{ 
                background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_DARK} 100%)`,
              }}
            >
              <PlusIcon className="h-4 w-4" />
              New Tenant
            </button>
          </div>
        </div>

        {/* Stats Cards - Smaller */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div 
            className="relative overflow-hidden rounded-lg p-4 text-white shadow-md"
            style={{ background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_DARK} 100%)` }}
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
              <div className="h-8 w-8 rounded flex items-center justify-center" style={{ background: `${PRIMARY_COLOR}15` }}>
                <CalendarIcon className="h-4 w-4" style={{ color: PRIMARY_COLOR }} />
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
              <div className="h-8 w-8 rounded flex items-center justify-center" style={{ background: `${PRIMARY_COLOR}15` }}>
                <div className="h-4 w-4 rounded-full" style={{ background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_DARK} 100%)` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Tenants Table - More compact */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">All Tenants</h2>
                <p className="text-gray-500 text-xs mt-1">View and manage tenant organizations</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchTenants}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                  style={{ 
                    background: `${PRIMARY_COLOR}10`,
                    color: PRIMARY_COLOR
                  }}
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
            <div className="mx-5 mt-4 p-3 rounded-lg border" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
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
                  className="animate-spin rounded-full h-10 w-10 border-3 mb-4"
                  style={{ 
                    borderColor: `${PRIMARY_COLOR}30`,
                    borderTopColor: PRIMARY_COLOR 
                  }}
                ></div>
                <p className="text-gray-700 text-sm font-medium">Loading tenants...</p>
                <p className="text-gray-500 text-xs mt-1">Fetching your tenant data</p>
              </div>
            </div>
          ) : tenants.length === 0 ? (
            <div className="p-8 text-center">
              <div className="max-w-xs mx-auto">
                <div 
                  className="h-16 w-16 mx-auto mb-4 rounded-xl flex items-center justify-center"
                  style={{ background: `${PRIMARY_COLOR}10` }}
                >
                  <BuildingOfficeIcon className="h-8 w-8" style={{ color: PRIMARY_COLOR }} />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">No tenants found</h3>
                <p className="text-gray-500 text-sm mb-6">Create your first tenant organization to get started</p>
                <button
                  onClick={openCreateForm}
                  className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-white transition-colors"
                  style={{ 
                    background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_DARK} 100%)`
                  }}
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
                  <tr style={{ background: `${PRIMARY_COLOR}05` }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tenant Details
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Company Info
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Created Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tenants.map((tenant) => {
                    const { date, time } = formatDate(tenant.created_at);
                    return (
                      <tr key={tenant.id} className="group hover:bg-gray-50/50 transition-colors duration-150">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              {tenant.logo_url ? (
                                <img 
                                  src={tenant.logo_url} 
                                  alt={tenant.name}
                                  className="h-8 w-8 rounded-lg object-cover border border-gray-200"
                                />
                              ) : (
                                <div 
                                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                                  style={{ background: `linear-gradient(135deg, ${tenant.primary_color || PRIMARY_COLOR} 0%, ${tenant.secondary_color || PRIMARY_DARK} 100%)` }}
                                >
                                  {tenant.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border border-white"
                                style={{ backgroundColor: tenant.primary_color || PRIMARY_COLOR }}
                              ></div>
                            </div>
                            <div>
                              <h3 className="text-sm font-medium text-gray-900">
                                {tenant.name}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex items-center gap-1">
                                  <div className="h-2 w-2 rounded-full border border-white shadow-xs"
                                    style={{ backgroundColor: tenant.primary_color || PRIMARY_COLOR }}
                                  />
                                  <div className="h-2 w-2 rounded-full border border-white shadow-xs"
                                    style={{ backgroundColor: tenant.secondary_color || PRIMARY_LIGHT }}
                                  />
                                </div>
                                {tenant.tenant_slug && (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                                    style={{ 
                                      background: `${PRIMARY_COLOR}10`,
                                      color: PRIMARY_COLOR
                                    }}
                                  >
                                    {tenant.tenant_slug}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded flex items-center justify-center"
                              style={{ background: `${PRIMARY_COLOR}10` }}
                            >
                              <BuildingOfficeIcon className="h-3.5 w-3.5" style={{ color: PRIMARY_COLOR }} />
                            </div>
                            <div>
                              <p className="text-sm text-gray-900">{tenant.company_name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">Legal entity</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            <div className="text-sm text-gray-900 flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" style={{ color: PRIMARY_COLOR }} />
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
                              onClick={() => handleViewTenant(tenant.id)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors"
                              style={{ 
                                background: `${PRIMARY_COLOR}10`,
                                color: PRIMARY_COLOR
                              }}
                              title="View Details"
                            >
                              <EyeIcon className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">View</span>
                            </button>
                            
                            <button
                              onClick={() => openEditForm(tenant)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-colors"
                              title="Edit"
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                            
                            <button
                              onClick={() => handleDeleteTenant(tenant.id)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
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

        {/* Success/Error Toast - Smaller */}
        {(success || error) && (
          <div className="fixed bottom-4 right-4 z-50 max-w-xs animate-slide-up">
            {success && (
              <div className="bg-white rounded-lg shadow-lg p-3 border border-green-100">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Success!</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {editingTenant ? 'Tenant updated' : 'Tenant created'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSuccess(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            {error && (
              <div className="bg-white rounded-lg shadow-lg p-3 border border-red-100">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg className="h-3.5 w-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Error</p>
                    <p className="text-xs text-gray-600 mt-0.5">{error}</p>
                  </div>
                  <button
                    onClick={() => setError("")}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
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
                  className="px-6 py-4 text-white relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_DARK} 100%)` }}
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold">
                          {editingTenant ? `Edit ${editingTenant.name}` : 'Create New Tenant'}
                        </h2>
                        <p className="text-white/90 text-xs mt-1">
                          {editingTenant ? 'Update tenant details' : 'Set up new tenant organization'}
                        </p>
                      </div>
                      <button
                        onClick={closeForm}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="max-h-[calc(100vh-100px)] overflow-y-auto">
                  <div className="p-6">
                    <form onSubmit={handleFormSubmit} className="space-y-6">
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
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-2">
                            Logo URL
                          </label>
                          <input
                            type="text"
                            placeholder="https://example.com/logo.png"
                            value={formData.logo_url}
                            onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          />
                          <p className="text-xs text-gray-500 mt-1">Optional. Displayed on dashboard</p>
                        </div>
                      </div>

                      {/* Color Settings */}
                      <div className="space-y-4">
                        <div className="pb-3 border-b border-gray-100">
                          <h3 className="text-sm font-semibold text-gray-900">Brand Colors</h3>
                          <p className="text-gray-500 text-xs mt-1">Customize dashboard appearance</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-2">
                              Primary Color
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={formData.primary_color}
                                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                className="h-8 w-8 cursor-pointer rounded border border-gray-300"
                              />
                              <input
                                type="text"
                                value={formData.primary_color}
                                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                className="flex-1 px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-2">
                              Secondary Color
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={formData.secondary_color}
                                onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                                className="h-8 w-8 cursor-pointer rounded border border-gray-300"
                              />
                              <input
                                type="text"
                                value={formData.secondary_color}
                                onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                                className="flex-1 px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg"
                              />
                            </div>
                          </div>
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
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                              />
                              <p className="text-xs text-gray-500 mt-1">Invitation email will be sent</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Form Actions */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-5 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={closeForm}
                          className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-2.5 px-4 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          style={{ 
                            background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_DARK} 100%)`
                          }}
                        >
                          {loading ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                              {editingTenant ? 'Updating...' : 'Creating...'}
                            </>
                          ) : (
                            editingTenant ? 'Update Tenant' : 'Create Tenant'
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