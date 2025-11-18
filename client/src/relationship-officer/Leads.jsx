import { useState, useEffect } from "react";
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
  XCircleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../hooks/userAuth";
import { supabase } from "../supabaseClient";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from 'react-router-dom';

const Leads = () => {
  const [leads, setLeads] = useState([]);
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
      if (!profile?.id) return;

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
    }
  };

  useEffect(() => {
    if (profile) fetchLeads();
  }, [profile]);

  // Handle form changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewLead({ ...newLead, [name]: value });
  };

  // Check uniqueness of mobile across ALL relevant tables
  const checkUniqueMobile = async (mobile) => {
    try {
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
        const { data, error } = await supabase
          .from(table)
          .select("id")
          .eq(column, cleanMobile);

        if (error) {
          console.error(`Error checking mobile in ${table}:`, error);
          toast.error(`Failed checking uniqueness in ${table}`);
          return false;
        }

        if (data.length > 0) {
          // phone already exists in this table
          toast.error(`This phone number already exists in ${table}`);
          return false;
        }
      }

      //  Passed all checks
      return true;
    } catch (err) {
      console.error("Error checking mobile uniqueness:", err);
      toast.error("Error checking mobile uniqueness");
      return false;
    }
  };

  // Add new lead
  const addLead = async (e) => {
    e.preventDefault();
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
        branch_id: profile?.branch_id,
        region_id: profile?.region_id,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from("leads").insert([leadData]).select();

      if (error) {
        toast.error("Error saving lead");
        console.error("Error saving lead:", error);
        setIsSaving(false);
        return;
      }

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
      toast.success("Lead saved successfully ");
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
        return <FireIcon className="h-4 w-4 text-red-600" />;
      case "Warm":
        return <SunIcon className="h-4 w-4 text-yellow-600" />;
      case "Cold":
        return <CloudIcon className="h-4 w-4 text-blue-600" />;
      default:
        return <CloudIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Hot":
        return "bg-red-100 text-red-700 border-red-200";
      case "Warm":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "Cold":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  // Sort button
  const SortButton = ({ column, label, icon: Icon }) => (
    <button
      onClick={() => handleSort(column)}
      className="flex items-center gap-2 text-left hover:text-indigo-600 transition-colors group w-full"
    >
      <Icon className="h-4 w-4 text-gray-500 group-hover:text-indigo-600" />
      <span className="font-medium">{label}</span>
      {sortConfig.key === column && (
        <span className="ml-1">
          {sortConfig.direction === "asc" ? (
            <ArrowUpIcon className="h-3 w-3" />
          ) : (
            <ArrowDownIcon className="h-3 w-3" />
          )}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-indigo-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-xl px-4 py-3 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors h-[46px]"
                >
                  <option value="all">All Status</option>
                  <option value="Hot">Hot</option>
                  <option value="Warm">Warm</option>
                  <option value="Cold">Cold</option>
                </select>
                <TagIcon className="absolute right-3 top-3.5 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Add Lead Button */}
            <button
              onClick={() => setShowLeadForm(true)}
              className="flex items-center gap-2 px-4 py-3 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg h-[46px]"
              style={{ backgroundColor: "#586ab1" }}              
            >
              <PlusIcon className="h-5 w-5" />
              Add Lead
            </button>
          </div>

          {/* Results Info */}
          {/* <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing {sortedLeads.length} of {leads.length} leads
            </span>
            {(searchTerm || statusFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                }}
                className="text-indigo-600 hover:text-indigo-800 underline"
              >
                Clear filters
              </button>
            )}
          </div> */}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden">
          {/* Total Leads Badge - Top Right */}
          <div className="flex justify-end p-4 pb-0">
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-200">
              <UserPlusIcon className="h-5 w-5 text-emerald-600" />
              <span className="text-emerald-700 font-semibold text-sm">{leads.length} Total Leads</span>
            </div>
          </div>

          {sortedLeads.length === 0 ? (
            <div className="p-12 text-center">
              <UserPlusIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
              <p className="text-gray-500 mb-6">
                {searchTerm || statusFilter !== "all" 
                  ? "No leads match your current filters. Try adjusting your search or filter criteria."
                  : "Start building your pipeline by adding your first lead."
                }
              </p>
              <button
                onClick={() => setShowLeadForm(true)}
                className="flex items-center gap-1 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                style={{ backgroundColor: "#586ab1" }}
              >
                <PlusIcon className="h-5 w-5" />
                Add Your First Lead
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse text-sm text-gray-700">
                <thead>
                  <tr className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100 text-xs uppercase tracking-wide text-gray-600">
                    <th className="p-4 font-semibold text-left whitespace-nowrap">
                      <SortButton column="Firstname" label="First Name" icon={UserCircleIcon} />
                    </th>
                    <th className="p-4 font-semibold text-left whitespace-nowrap">
                      <SortButton column="Surname" label="Surname" icon={UserCircleIcon} />
                    </th>
                    <th className="p-4 font-semibold text-left whitespace-nowrap">
                      <SortButton column="mobile" label="Phone" icon={DevicePhoneMobileIcon} />
                    </th>
                    <th className="p-4 font-semibold text-left whitespace-nowrap">
                      <SortButton column="business_name" label="Business" icon={BuildingOffice2Icon} />
                    </th>
                    <th className="p-4 font-semibold text-left whitespace-nowrap">
                      <SortButton column="business_type" label="Type" icon={TagIcon} />
                    </th>
                    <th className="p-4 font-semibold text-left whitespace-nowrap">
                      <SortButton column="business_location" label="Location" icon={MapPinIcon} />
                    </th>
                    <th className="p-4 font-semibold text-left whitespace-nowrap">
                      <SortButton column="status" label="Status" icon={TagIcon} />
                    </th>
                    <th className="p-4 font-semibold text-center whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {sortedLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 transition-all duration-200 text-sm"
                    >
                      <td className="p-4 truncate whitespace-nowrap" title={lead.Firstname}>
                        {lead.Firstname}
                      </td>
                      <td className="p-4 truncate whitespace-nowrap" title={lead.Surname}>
                        {lead.Surname}
                      </td>
                      <td className="p-4 truncate whitespace-nowrap" title={lead.mobile}>
                        {lead.mobile}
                      </td>
                      <td className="p-4 truncate whitespace-nowrap" title={lead.business_name}>
                        {lead.business_name}
                      </td>
                      <td className="p-4 truncate whitespace-nowrap" title={lead.business_type}>
                        {lead.business_type}
                      </td>
                      <td className="p-4 truncate whitespace-nowrap" title={lead.business_location}>
                        {lead.business_location}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            lead.status
                          )}`}
                        >
                          {getStatusIcon(lead.status)}
                          {lead.status}
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleConvertToCustomer(lead)}
                          className="flex items-center gap-1 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                          style={{ backgroundColor: "#586ab1" }}
                          title="Convert to Customer"
                        >
                          <ArrowPathIcon className="h-3.5 w-3.5" />
                          Convert
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Lead Modal */}
        {showLeadForm && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8 m-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-semibold bg-gradient-to-r from-slate-700 to-slate-700 bg-clip-text text-transparent">
                  Add New Lead
                </h2>
                <button
                  onClick={() => setShowLeadForm(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircleIcon className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={addLead} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      name="Firstname"
                      value={newLead.Firstname}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Enter first name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Surname *
                    </label>
                    <input
                      type="text"
                      name="Surname"
                      value={newLead.Surname}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      placeholder="Enter surname"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      name="mobile"
                      value={newLead.mobile}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      value={newLead.status}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                    >
                      <option value="Hot">Hot</option>
                      <option value="Warm">Warm</option>
                      <option value="Cold">Cold</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Name *
                    </label>
                    <input
                      type="text"
                      name="business_name"
                      value={newLead.business_name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      placeholder="Enter business name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Type *
                    </label>
                    <input
                      type="text"
                      name="business_type"
                      value={newLead.business_type}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      placeholder="e.g., Retail, Restaurant, Service"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Location *
                    </label>
                    <input
                      type="text"
                      name="business_location"
                      value={newLead.business_location}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                      placeholder="Enter business location"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowLeadForm(false)}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`flex items-center gap-2 px-6 py-3 text-white rounded-xl font-medium transition-all ${
                      isSaving
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-300 to-blue-300 hover:from-blue-300 hover:to-green-500 shadow-lg hover:shadow-xl"
                    }`}
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
    </div>
  );
};

export default Leads;