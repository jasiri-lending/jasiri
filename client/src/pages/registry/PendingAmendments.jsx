import React, { useState, useEffect, useCallback } from "react";
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  EyeIcon,
  DocumentTextIcon,
  PhoneIcon,
  CalendarIcon,
  PencilSquareIcon,
  IdentificationIcon,
  ExclamationTriangleIcon,
  BuildingStorefrontIcon,
  MapPinIcon,
  UserCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { useNavigate } from "react-router-dom";
import ViewCustomer from "./ViewCustomer";
import CustomerVerification from "./CustomerVerification";
import Verification from "./Verification";
import Spinner from "../../components/Spinner";

// Role configuration mapping
const ROLE_CONFIG = {
  branch_manager: {
    title: "Branch Manager",
    idField: "branch_id",
    profileField: "branch_id",
    status: "bm_review_amend",
    useVerificationComponent: false,
  },
  credit_analyst_officer: {
    title: "Credit Analyst Officer",
    idField: "region_id",
    profileField: "region_id",
    status: "ca_review_amend",
    useVerificationComponent: false,
  },
  customer_service_officer: {
    title: "Customer Service Officer",
    idField: "region_id",
    profileField: "region_id",
    status: "cso_review_amend",
    useVerificationComponent: true,
  },
};

// Local Storage keys
const STORAGE_KEYS = {
  SEARCH_TERM: "pending_amendments_search",
  CUSTOMERS: "pending_amendments_customers",
  LAST_FETCH: "pending_amendments_last_fetch",
  TABLE_STATE: "pending_amendments_table_state",
};

const PendingAmendments = () => {
  const { profile, loading: authLoading } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [customerDetails, setCustomerDetails] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  // Get role from profile
  const userRole = profile?.role;
  const config = userRole ? ROLE_CONFIG[userRole] : null;
  const navigate = useNavigate();

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedSearchTerm = localStorage.getItem(STORAGE_KEYS.SEARCH_TERM);
    const savedCustomers = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    const lastFetch = localStorage.getItem(STORAGE_KEYS.LAST_FETCH);
    const savedCustomerDetails = localStorage.getItem(STORAGE_KEYS.TABLE_STATE);
    
    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
    }
    
    if (savedCustomerDetails) {
      try {
        setCustomerDetails(JSON.parse(savedCustomerDetails));
      } catch (error) {
        console.error("Error parsing cached customer details:", error);
      }
    }
    
    // Use cached data if it's less than 5 minutes old
    if (savedCustomers && lastFetch) {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      if (parseInt(lastFetch) > fiveMinutesAgo) {
        try {
          const parsedCustomers = JSON.parse(savedCustomers);
          setCustomers(parsedCustomers);
          setFilteredCustomers(parsedCustomers);
          setLoading(false);
        } catch (error) {
          console.error("Error parsing cached customers:", error);
        }
      }
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SEARCH_TERM, searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    if (customers.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
      localStorage.setItem(STORAGE_KEYS.LAST_FETCH, Date.now().toString());
    }
  }, [customers]);

  useEffect(() => {
    if (Object.keys(customerDetails).length > 0) {
      localStorage.setItem(STORAGE_KEYS.TABLE_STATE, JSON.stringify(customerDetails));
    }
  }, [customerDetails]);

  const getStatusDisplay = useCallback((customer) => {
    const sentBackStatuses = ["sent_back_by_bm", "sent_back_by_ca", "sent_back_by_cso"];
    const isROActionNeeded = sentBackStatuses.includes(customer.status);
    
    return {
      text: isROActionNeeded ? "RO Action Needed" : "Manager Approval Needed",
      color: isROActionNeeded ? "text-amber-600" : "text-blue-600",
      bgColor: isROActionNeeded ? "bg-amber-50" : "bg-blue-50",
      borderColor: isROActionNeeded ? "border-amber-200" : "border-blue-200",
      icon: ExclamationTriangleIcon,
      isROActionNeeded,
    };
  }, []);

  // Fetch customer details (branch, region, and RO name)
  const fetchCustomerDetails = useCallback(async (customer) => {
    try {
      // Fetch branch name
      let branchName = "N/A";
      if (customer.branch_id) {
        const { data: branchData, error: branchError } = await supabase
          .from("branches")
          .select("name")
          .eq("id", customer.branch_id)
          .single();
        
        if (!branchError && branchData) {
          branchName = branchData.name || "N/A";
        }
      }

      // Fetch region name
      let regionName = "N/A";
      if (customer.region_id) {
        const { data: regionData, error: regionError } = await supabase
          .from("regions")
          .select("name")
          .eq("id", customer.region_id)
          .single();
        
        if (!regionError && regionData) {
          regionName = regionData.name || "N/A";
        }
      }

      // Fetch RO name from created_by
      let roName = "N/A";
      if (customer.created_by) {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", customer.created_by)
          .single();
        
        if (!userError && userData) {
          roName = userData.full_name || "N/A";
        }
      }

      const customerDetail = {
        branch: branchName,
        region: regionName,
        roName: roName,
      };

      // Update state and localStorage
      setCustomerDetails(prev => ({
        ...prev,
        [customer.id]: customerDetail
      }));

      return customerDetail;
    } catch (error) {
      console.error("Error fetching customer details:", error);
      return null;
    }
  }, []);

  const fetchAmendmentCustomers = useCallback(async () => {
    if (authLoading) return;

    // Validate we have necessary data
    if (!profile || !userRole || !config) {
      console.error("Missing profile, role, or config:", { profile, userRole, config });
      setLoading(false);
      return;
    }

    setRefreshing(true);
    try {
      const userLocationId = profile[config.profileField];
      if (!userLocationId) {
        console.error(`Missing ${config.profileField} for user`);
        setRefreshing(false);
        return;
      }

      // ✅ Include the default status plus sent-back status based on role
      const statusesToInclude = [config.status];
      if (userRole === "branch_manager") statusesToInclude.push("sent_back_by_bm");
      if (userRole === "credit_analyst_officer") statusesToInclude.push("sent_back_by_ca");
      if (userRole === "customer_service_officer") statusesToInclude.push("sent_back_by_cso");

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq(config.idField, userLocationId)
        .in("status", statusesToInclude)
        .order("edited_at", { ascending: false });

      if (error) {
        console.error("Error fetching amendment customers:", error.message);
      } else {
        // Only keep amended customers (edited_at > created_at)
        const amendedCustomers = (data || []).filter((customer) => {
          if (!customer.edited_at || !customer.created_at) return false;
          return new Date(customer.edited_at) > new Date(customer.created_at);
        });

        setCustomers(amendedCustomers);
        setFilteredCustomers(amendedCustomers);

        // Fetch details for all customers
        amendedCustomers.forEach(customer => {
          if (!customerDetails[customer.id]) {
            fetchCustomerDetails(customer);
          }
        });
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, authLoading, userRole, config, customerDetails, fetchCustomerDetails]);

  useEffect(() => {
    fetchAmendmentCustomers();
  }, [fetchAmendmentCustomers]);

  useEffect(() => {
    // Only set up real-time subscription if we have valid config
    if (!config) return;

    const subscription = supabase
      .channel("pending-amendments")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "customers" },
        (payload) => {
          console.log("Customer updated:", payload);
          fetchAmendmentCustomers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [config, fetchAmendmentCustomers]);

  // Search filter
  useEffect(() => {
    if (!customers || customers.length === 0) {
      setFilteredCustomers([]);
      return;
    }

    const filtered = customers.filter(
      (customer) =>
        (customer.Firstname?.toLowerCase() || "").includes(
          searchTerm.toLowerCase()
        ) ||
        (customer.Surname?.toLowerCase() || "").includes(
          searchTerm.toLowerCase()
        ) ||
        (customer.id_number?.toString() || "").includes(
          searchTerm.toLowerCase()
        ) ||
        (customer.mobile || "").includes(searchTerm) ||
        (customer.business_type?.toLowerCase() || "").includes(
          searchTerm.toLowerCase()
        ) ||
        (customer.business_name?.toLowerCase() || "").includes(
          searchTerm.toLowerCase()
        )
    );
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  const handleApproveAmendment = useCallback((customer) => {
    if (config.useVerificationComponent) {
      navigate(`/customer/${customer.id}/verify-amendment?role=customer_service_officer`);
    } else {
      navigate(`/customer/${customer.id}/verify-amendment?role=${userRole}`);
    }
  }, [config, navigate, userRole]);

  const handleViewChanges = useCallback((customer) => {
    navigate(`/customer/${customer.id}/details`);
  }, [navigate]);

  // Clear localStorage cache
  const clearCache = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.SEARCH_TERM);
    localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
    localStorage.removeItem(STORAGE_KEYS.LAST_FETCH);
    localStorage.removeItem(STORAGE_KEYS.TABLE_STATE);
    setSearchTerm("");
    setCustomerDetails({});
    fetchAmendmentCustomers();
  }, [fetchAmendmentCustomers]);

  // Combine first name and surname
  const getFullName = useCallback((customer) => {
    const firstName = customer.Firstname || "";
    const surname = customer.Surname || "";
    return `${firstName} ${surname}`.trim() || "N/A";
  }, []);

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-6 flex items-center justify-center">
       <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center ">
        <Spinner text="Loading ..." />
      </div>
      </div>
    );
  }

  // Show error if role is not configured
  if (!config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md border border-gray-200">
          <DocumentTextIcon className="w-16 h-16 text-red-400 mb-4 mx-auto" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
            Access Error
          </h3>
          <p className="text-gray-600 text-center">
            Your role ({userRole || "unknown"}) does not have access to this feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-sm  text-slate-900">Pending Amendments   </h1>
              {/* <p className="text-gray-600 mt-2 text-xs">
                Recently updated customer records requiring review ({filteredCustomers.length})
              </p> */}
            </div>
            <button
              onClick={clearCache}
              disabled={refreshing}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID number, phone, or business..."
              className="w-full pl-12 pr-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-gray-400 font-normal"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    { name: "Name", width: "w-48" },
                    { name: "ID Number", width: "w-32" },
                    { name: "Contact Info", width: "w-32" },
                    { name: "Last Updated", width: "w-40" },
                    { name: "Status", width: "w-48" },
                    { name: "Branch", width: "w-32" },
                    { name: "Region", width: "w-32" },
                    { name: "RO Name", width: "w-40" },
                    { name: "Actions", width: "w-32" },
                  ].map((head) => (
                    <th
                      key={head.name}
                      className={`px-4 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider ${head.width}`}
                    >
                      {head.name}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-500 text-sm font-medium">
                          Loading amendments...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => {
                    const statusInfo = getStatusDisplay(customer);
                    const StatusIcon = statusInfo.icon;
                    const customerDetail = customerDetails[customer.id] || {};
                    
                    return (
                      <tr 
                        key={customer.id} 
                        className="hover:bg-gray-50 transition-colors duration-150 group"
                      >
                        {/* Name */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {/* <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium text-white">
                                {getFullName(customer).split(' ').map(n => n[0]).join('').toUpperCase()}
                              </span>
                            </div> */}
                            <div className="ml-4">
                              <div className="text-sm font-semibold text-gray-900">
                                {getFullName(customer)}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* ID Number */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900 font-medium">
                            <IdentificationIcon className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{customer.id_number || "N/A"}</span>
                          </div>
                        </td>

                        {/* Contact Info */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <PhoneIcon className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{customer.mobile || "N/A"}</span>
                          </div>
                        </td>

                        {/* Last Updated */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <div className="font-medium">
                              {customer.edited_at
                                ? new Date(customer.edited_at).toLocaleDateString()
                                : "N/A"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {customer.edited_at
                                ? new Date(customer.edited_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color} border ${statusInfo.borderColor}`}>
                            <StatusIcon className="w-3 h-3 mr-1.5 flex-shrink-0" />
                            {statusInfo.text}
                          </div>
                        </td>

                        {/* Branch */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <BuildingStorefrontIcon className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{customerDetail.branch || "Loading..."}</span>
                          </div>
                        </td>

                        {/* Region */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <MapPinIcon className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{customerDetail.region || "Loading..."}</span>
                          </div>
                        </td>

                        {/* RO Name */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <UserCircleIcon className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{customerDetail.roName || "Loading..."}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewChanges(customer)}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white rounded-lg hover:opacity-90 transition-all shadow-sm"
                              style={{ backgroundColor: "#586ab1" }}
                              title="View Changes"
                            >
                              <EyeIcon className="w-3 h-3 mr-1" />
                              View
                            </button>
                            {!statusInfo.isROActionNeeded && (
                              <button
                                onClick={() => handleApproveAmendment(customer)}
                                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-all shadow-sm"
                                title="Approve Changes"
                              >
                                <CheckCircleIcon className="w-3 h-3 mr-1" />
                                Approve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="px-6 py-16 text-center">
                      <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No pending amendments
                      </h3>
                      <p className="text-gray-500 text-sm max-w-md mx-auto">
                        {searchTerm
                          ? "No customers match your search criteria."
                          : "All customer information changes have been reviewed."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-6xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold z-50"
            >
              ✕
            </button>
            <div className="p-6">
              <ViewCustomer
                customer={selectedCustomer}
                onClose={() => setIsModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Approval Form Modal - Conditionally render based on role */}
      {showForm && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white w-full h-full max-w-6xl max-h-[90vh] relative rounded-lg shadow-xl">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 text-2xl font-bold z-50"
            >
              ✕
            </button>
            <div className="p-6 h-full overflow-y-auto">
              {config.useVerificationComponent ? (
                <Verification
                  customerId={selectedCustomer?.id}
                  onClose={() => {
                    setShowForm(false);
                    fetchAmendmentCustomers();
                  }}
                />
              ) : (
                <CustomerVerification
                  customerId={selectedCustomer?.id}
                  onClose={() => {
                    setShowForm(false);
                    fetchAmendmentCustomers();
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingAmendments;