import { useState, useEffect } from "react";
import {
  XMarkIcon,
  UserPlusIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../supabaseClient";
import { API_BASE_URL } from "../../../config.js";

// Assuming you have a way to get the current user profile
import { useAuth } from "../../hooks/userAuth"; // replace with your auth hook

export default function AddUsers() {
  const { profile } = useAuth(); // profile contains role, tenant_id, etc.

  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState("");
  const [tenantDomain, setTenantDomain] = useState("");

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "",
    phone: "",
    branch_id: "",
    region_id: "",
  });

  const filteredRoles =
    profile?.role === "superadmin"
      ? availableRoles
      : availableRoles.filter((r) => r.value !== "admin"); // Admins cannot create other admins

  const roleRequiresBranchRegion = (role) => {
    return role && role !== "admin" && role !== "operation_officer";
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchQuery = supabase.from("branches").select("*");
      const regionQuery = supabase.from("regions").select("*");

      if (profile?.role !== "superadmin") {
        branchQuery.eq("tenant_id", profile.tenant_id);
        regionQuery.eq("tenant_id", profile.tenant_id);
      }

      const [branchesRes, regionsRes] = await Promise.all([
        branchQuery,
        regionQuery,
      ]);

      // Fetch dynamic roles
      let rolesQuery = supabase.from("roles").select("name").order("name");
      if (profile?.tenant_id) {
        rolesQuery = rolesQuery.eq("tenant_id", profile.tenant_id);
      }
      const { data: rolesData, error: rolesError } = await rolesQuery;

      if (rolesError) console.error("Error fetching roles:", rolesError);

      if (rolesData) {
        const formattedRoles = rolesData.map(r => ({
          value: r.name,
          label: r.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        }));
        setAvailableRoles(formattedRoles);
      }

      if (branchesRes.data) setBranches(branchesRes.data);
      if (regionsRes.data) setRegions(regionsRes.data);

      // Fetch tenant email domain
      if (profile?.tenant_id) {
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("email_domain")
          .eq("id", profile.tenant_id)
          .single();
        if (tenantData?.email_domain) {
          setTenantDomain(tenantData.email_domain);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load branches or regions.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      if (!formData.email || !formData.password || !formData.full_name || !formData.role) {
        throw new Error("All required fields must be filled");
      }

      if (formData.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      if (tenantDomain && !formData.email.endsWith(`@${tenantDomain}`)) {
        throw new Error(`Email must belong to the company domain: @${tenantDomain}`);
      }

      const logged_in_tenant_id = profile?.tenant_id;
      if (!logged_in_tenant_id) {
        throw new Error("Tenant ID not found. Please login again.");
      }

      const response = await fetch(`${API_BASE_URL}/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          password: formData.password.trim(),
          role: formData.role,
          phone: formData.phone || null,
          branch_id: formData.branch_id || null,
          region_id: formData.region_id || null,
          logged_in_tenant_id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "User creation failed");
      }

      setShowSuccess(true);
      setFormData({
        full_name: "",
        email: "",
        password: "",
        role: "",
        phone: "",
        branch_id: "",
        region_id: "",
      });

      setTimeout(() => setShowSuccess(false), 5000);

    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        {showSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                User created successfully!
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
            <button onClick={() => setError("")} className="ml-auto">
              <XMarkIcon className="h-5 w-5 text-red-400" />
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <UserPlusIcon className="h-6 w-6 text-indigo-600 mr-2" />
              <h2 className="text-sm font-semibold text-slate-600">User Information</h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-6">
              {/* Full Name & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder={tenantDomain ? `user@${tenantDomain}` : "john@example.com"}
                  />
                  {tenantDomain && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      Must use company domain: <strong>@{tenantDomain}</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Password & Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Min 6 characters"
                    minLength={6}
                  />
                  <p className="text-[10px] text-gray-400 mt-1 italic">
                    User will be forced to change this on first login.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="+254 700 000 000"
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select a role</option>
                  {filteredRoles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch & Region */}
              {roleRequiresBranchRegion(formData.role) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Region
                    </label>
                    <select
                      value={formData.region_id}
                      onChange={(e) =>
                        setFormData({ ...formData, region_id: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select Region</option>
                      {regions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Branch
                    </label>
                    <select
                      value={formData.branch_id}
                      onChange={(e) =>
                        setFormData({ ...formData, branch_id: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select Branch</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* System-wide note */}
              {!roleRequiresBranchRegion(formData.role) && formData.role && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-blue-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-800">
                        <strong>System-wide Access:</strong> This role has access
                        to all branches and regions.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="mt-8 flex justify-end space-x-4">
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    full_name: "",
                    email: "",
                    password: "",
                    role: "",
                    phone: "",
                    branch_id: "",
                    region_id: "",
                  })
                }
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Clear Form
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {submitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="h-5 w-5 mr-2" />
                    Create User
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
