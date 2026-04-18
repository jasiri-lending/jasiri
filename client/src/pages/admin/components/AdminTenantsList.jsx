import { useState, useEffect } from "react";
import { XMarkIcon, PlusIcon, TrashIcon, PencilIcon, BuildingOfficeIcon, CalendarIcon, EyeIcon } from "@heroicons/react/24/outline";
import { supabase } from "../../../supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../hooks/userAuth";
import { apiFetch } from "../../../utils/api.js";

export default function AdminTenantsList() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [fetchingTenants, setFetchingTenants] = useState(false);
  const [tableError, setTableError] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const location = useLocation();

  // Fetch tenants on component mount
  useEffect(() => {
    fetchTenants();
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

  const handleDeleteTenant = async (tenantId) => {
    if (!window.confirm("Are you sure you want to delete this tenant? This will also delete the associated admin user. This action cannot be undone.")) {
      return;
    }

    try {
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

  const openEditForm = (tenant) => {
    navigate(`/users/edit-tenant/${tenant.id}/admin`);
  };

  const openCreateForm = () => {
    navigate(`/users/create-tenant/admin`);
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
          <div className="relative overflow-hidden rounded-lg p-4 text-white shadow-md bg-brand-primary">
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
                <div className="animate-spin rounded-full h-10 w-10 border-3 mb-4 border-brand-surface border-t-brand-primary" />
                <p className="text-gray-700 text-sm font-medium">Loading tenants...</p>
                <p className="text-gray-500 text-xs mt-1">Fetching your tenant data</p>
              </div>
            </div>
          ) : tenants.length === 0 ? (
            <div className="p-8 text-center">
              <div className="max-w-xs mx-auto">
                <div className="h-16 w-16 mx-auto mb-4 rounded-xl flex items-center justify-center bg-brand-surface">
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary uppercase tracking-wider">Tenant Details</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary uppercase tracking-wider">Company Info</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary uppercase tracking-wider text-center">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary uppercase tracking-wider">Created Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-brand-primary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tenants.map((tenant) => {
                    const { date, time } = formatDate(tenant.created_at);
                    return (
                      <tr key={tenant.id} className="group hover:bg-brand-surface/10 transition-colors duration-150">
                        <td className="px-4 py-3">
                          <h3 className="text-sm font-semibold text-slate-700">{tenant.name}</h3>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded flex items-center justify-center bg-brand-surface">
                              <BuildingOfficeIcon className="h-3.5 w-3.5 text-brand-primary" />
                            </div>
                            <p className="text-sm text-gray-900">{tenant.company_name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {tenant.onboarding_completed ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 border border-green-200">Completed</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-200 animate-pulse">Pending Config</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900 flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3 text-brand-primary" />
                            {date}
                          </div>
                          <div className="text-xs text-gray-500">{time}</div>
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

        {/* Success/Error Toast */}
        {(success || error) && (
          <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] w-full max-w-sm px-4">
            {success && (
              <div className="bg-white rounded-xl shadow-2xl p-4 border border-green-100 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">Success!</p>
                  <p className="text-xs text-gray-600 mt-0.5">Operation successful</p>
                </div>
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
                  <p className="text-sm font-bold text-gray-900">Error</p>
                  <p className="text-xs text-gray-600 mt-0.5">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
