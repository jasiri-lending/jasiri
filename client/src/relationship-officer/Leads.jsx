import { useState, useEffect, useRef } from "react";
import {
  UserPlusIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowPathIcon,
  FireIcon,
  SunIcon,
  CloudIcon,
  UserCircleIcon,
  DevicePhoneMobileIcon,
  BuildingOffice2Icon,
  MapPinIcon,
  TagIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  XMarkIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../hooks/userAuth";
import { supabase } from "../supabaseClient";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from 'react-router-dom';
import Spinner from "../components/Spinner.jsx";

const Leads = () => {
  const [leads, setLeads] = useState([]);
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [statusFilter, setStatusFilter] = useState("all");
  const [newLead, setNewLead] = useState({
    Firstname: "",
    Surname: "",
    mobile: "",
    business_name: "",
    business_location: "",
    business_type: "",
    status: "Cold",
  });

  // Use ref to track if data has been fetched
  const hasFetchedData = useRef(false);

  const handleConvertToCustomer = (lead) => {
    navigate('/officer/customer-form', {
      state: {
        leadData: lead,
        fromLeads: true
      }
    });
  };

  //  Fetch leads for logged-in officer
  const fetchLeads = async () => {
    try {
      if (!profile?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("created_by", profile.id);

      if (error) {
        toast.error("Failed to fetch leads");
        console.error("Error fetching leads:", error);
      } else {
        setLeads(data || []);
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
      toast.error("Failed to fetch leads");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch data once when profile is available
    if (profile && !hasFetchedData.current) {
      hasFetchedData.current = true;
      fetchLeads();
    }
  }, [profile]);

  // Handle form changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewLead({ ...newLead, [name]: value });
  };

  // Check uniqueness of mobile across ALL relevant tables
  const checkUniqueMobile = async (mobile) => {
    try {
      console.log("🔍 [LEADS] Starting mobile uniqueness check for:", mobile);

      // normalize number (remove spaces/dashes)
      const cleanMobile = mobile.replace(/\D/g, "");

      // tables that store phone numbers
      const tablesToCheck = [
        { table: "leads", column: "mobile" },
        { table: "customers", column: "mobile" },
        { table: "guarantors", column: "mobile" },
        { table: "next_of_kin", column: "mobile" },
      ];

      for (const { table, column } of tablesToCheck) {
        console.log(`📡 [LEADS] Checking table: ${table}, column: ${column} for value: ${cleanMobile}`);
        const { data, error } = await supabase
          .from(table)
          .select("id")
          .eq(column, cleanMobile)
          .eq("tenant_id", profile?.tenant_id);

        if (error) {
          console.error(`❌ [LEADS] Error checking mobile in ${table}:`, {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          toast.error(`Failed checking uniqueness in ${table}`);
          return false;
        }

        if (data && data.length > 0) {
          // phone already exists in this table
          console.warn(`⚠️ [LEADS] Duplicate found in table: ${table}, ID:`, data[0].id);
          toast.error(`This phone number already exists in ${table}`);
          return false;
        }
      }

      //  Passed all checks
      console.log("✅ [LEADS] Mobile uniqueness check passed");
      return true;
    } catch (err) {
      console.error("💥 [LEADS] Fatal error in uniqueness check:", err);
      toast.error("Error checking mobile uniqueness");
      return false;
    }
  };

  // Add new lead
  const addLead = async (e) => {
    e.preventDefault();
    console.log("📝 [LEADS] addLead triggered");
    console.log("👤 [LEADS] Current Profile:", profile);
    console.log("📋 [LEADS] New Lead Form Data:", newLead);
    setIsSaving(true);

    try {
      // Validation
      const cleanMobile = newLead.mobile.replace(/\D/g, "");
      if (!/^[0-9]{10,15}$/.test(cleanMobile)) {
        toast.error("Please enter a valid mobile number (10–15 digits).");
        setIsSaving(false);
        return;
      }

      // Check across all tables
      const isUnique = await checkUniqueMobile(cleanMobile);
      if (!isUnique) {
        setIsSaving(false);
        return;
      }

      const leadData = {
        ...newLead,
        mobile: cleanMobile,
        created_by: profile?.id,
        tenant_id: profile?.tenant_id,
        branch_id: profile?.branch_id,
        region_id: profile?.region_id,
        created_at: new Date().toISOString(),
      };

      console.log("🚀 [LEADS] Attempting to insert lead data:", leadData);

      const { data, error } = await supabase.from("leads").insert([leadData]).select();

      if (error) {
        console.error("❌ [LEADS] Supabase Insert Error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        toast.error(`Error saving lead: ${error.message}`);
        setIsSaving(false);
        return;
      }

      console.log("✅ [LEADS] Lead saved successfully:", data);

      setLeads([...leads, data[0]]);
      setNewLead({
        Firstname: "",
        Surname: "",
        mobile: "",
        business_name: "",
        business_location: "",
        business_type: "",
        status: "Cold",
      });
      setShowLeadForm(false);
      toast.success("Lead saved successfully");
    } catch (err) {
      console.error("Error saving lead:", err);
      toast.error("Error saving lead");
    } finally {
      setIsSaving(false);
    }
  };

  // Sorting
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortedLeads = (leadsList) => {
    if (!sortConfig.key) return leadsList;
    return [...leadsList].sort((a, b) => {
      const aValue = a[sortConfig.key] ?? "";
      const bValue = b[sortConfig.key] ?? "";
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  //  Filter + sort
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      (lead.Firstname || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.Surname || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.mobile || "").toString().includes(searchTerm) ||
      (lead.business_name || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedLeads = getSortedLeads(filteredLeads);

  //  Status helpers
  const getStatusIcon = (status) => {
    switch (status) {
      case "Hot":
        return <FireIcon className="h-3 w-3" />;
      case "Warm":
        return <SunIcon className="h-3 w-3" />;
      case "Cold":
        return <CloudIcon className="h-3 w-3" />;
      default:
        return <CloudIcon className="h-3 w-3" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Hot":
        return "#ef4444";
      case "Warm":
        return "#f59e0b";
      case "Cold":
        return "#3b82f6";
      default:
        return "#6b7280";
    }
  };

  // Sort button
  const SortButton = ({ column, label }) => (
    <button
      onClick={() => handleSort(column)}
      className="flex items-center gap-1 text-left hover:text-gray-900 transition-colors w-full"
    >
      <span>{label}</span>
      {sortConfig.key === column && (
        <span>
          {sortConfig.direction === "asc" ? (
            <ArrowUpIcon className="h-3 w-3" />
          ) : (
            <ArrowDownIcon className="h-3 w-3" />
          )}
        </span>
      )}
    </button>
  );

  if (isLoading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
        <Spinner text="Loading leads..." />
      </div>
    );
  }

  return (
    <div className="h-full bg-brand-surface p-8 min-h-screen font-body">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Leads Management
      </h1>

      {/* Search and Actions Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-xl px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="Hot">Hot</option>
                  <option value="Warm">Warm</option>
                  <option value="Cold">Cold</option>
                </select>
                <TagIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={fetchLeads}
                className="px-4 py-2 bg-white border border-gray-300 text-text rounded-xl hover:bg-brand-surface transition-all font-medium shadow-sm flex items-center gap-2"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Refresh
              </button>

              <button
                onClick={() => setShowLeadForm(true)}
                className="px-4 py-2 bg-brand-primary text-white rounded-xl hover:bg-brand-primary/90 transition-all font-bold shadow-lg hover:shadow-brand-primary/20 flex items-center gap-2"
              >
                <PlusIcon className="h-5 w-5" />
                Add Lead
              </button>
            </div>
          </div>
        </div>

        {/* Results Info */}
        <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
          <span>
            Showing {sortedLeads.length} of {leads.length} leads
          </span>
          {(searchTerm || statusFilter !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
              }}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <XMarkIcon className="h-3 w-3" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {sortedLeads.length === 0 ? (
          <div className="p-8 text-center">
            <UserPlusIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900 mb-2">No leads found</h3>
            <p className="text-xs text-gray-500 mb-4">
              {searchTerm || statusFilter !== "all"
                ? "No leads match your current filters. Try adjusting your search or filter criteria."
                : "Start building your pipeline by adding your first lead."
              }
            </p>
            <button
              onClick={() => setShowLeadForm(true)}
              className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-all font-medium mx-auto shadow-md flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              Add Your First Lead
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                    <SortButton column="Firstname" label="First Name" />
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                    <SortButton column="Surname" label="Surname" />
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                    <SortButton column="mobile" label="Phone" />
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                    <SortButton column="business_name" label="Business" />
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                    <SortButton column="business_type" label="Type" />
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                    <SortButton column="business_location" label="Location" />
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">
                    <SortButton column="status" label="Status" />
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis" title={lead.Firstname}>
                      {lead.Firstname}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis" title={lead.Surname}>
                      {lead.Surname}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap" title={lead.mobile}>
                      {lead.mobile}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis" title={lead.business_name}>
                      {lead.business_name}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis" title={lead.business_type}>
                      {lead.business_type}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis" title={lead.business_location}>
                      {lead.business_location}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: getStatusColor(lead.status) }}
                      >
                        {getStatusIcon(lead.status)}
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleConvertToCustomer(lead)}
                        className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-all font-medium text-xs flex items-center gap-2 shadow-sm"
                        title="Convert to Customer"
                      >
                        <ArrowPathIcon className="h-3 w-3" />
                        Convert
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination info */}
        {sortedLeads.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <div className="text-xs text-gray-600">
              Total leads: <span className="font-medium">{leads.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      {
        showLeadForm && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8 border border-brand-surface max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-8 border-b border-brand-surface pb-4">
                <h2 className="text-xl font-bold text-text flex items-center gap-2">
                  <UserPlusIcon className="h-6 w-6 text-brand-primary" />
                  Add New Lead
                </h2>
                <button
                  onClick={() => setShowLeadForm(false)}
                  className="p-2 hover:bg-brand-surface rounded-full transition-colors text-muted hover:text-text"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={addLead} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      name="Firstname"
                      value={newLead.Firstname}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                      placeholder="Enter first name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">
                      Surname *
                    </label>
                    <input
                      type="text"
                      name="Surname"
                      value={newLead.Surname}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                      placeholder="Enter surname"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      name="mobile"
                      value={newLead.mobile}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      value={newLead.status}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all cursor-pointer"
                    >
                      <option value="Hot">Hot</option>
                      <option value="Warm">Warm</option>
                      <option value="Cold">Cold</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-text mb-2">
                      Business Name *
                    </label>
                    <input
                      type="text"
                      name="business_name"
                      value={newLead.business_name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                      placeholder="Enter business name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">
                      Business Type *
                    </label>
                    <input
                      type="text"
                      name="business_type"
                      value={newLead.business_type}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                      placeholder="e.g., Retail, Restaurant, Service"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">
                      Business Location *
                    </label>
                    <input
                      type="text"
                      name="business_location"
                      value={newLead.business_location}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                      placeholder="Enter business location"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-6 border-t border-brand-surface mt-8">
                  <button
                    type="button"
                    onClick={() => setShowLeadForm(false)}
                    className="px-8 py-3 bg-brand-surface text-text rounded-xl hover:bg-brand-secondary/20 transition-all font-medium shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-8 py-3 bg-brand-primary text-white rounded-xl hover:bg-brand-primary/90 transition-all font-bold shadow-lg hover:shadow-brand-primary/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-5 w-5" />
                        Save Lead
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
};

export default Leads;