import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  EyeIcon,
  DocumentTextIcon,
  PhoneIcon,
  ExclamationTriangleIcon,
  BuildingStorefrontIcon,
  MapPinIcon,
  UserCircleIcon,
  ArrowPathIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
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

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedRO, setSelectedRO] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [relationshipOfficers, setRelationshipOfficers] = useState([]);

  // Use ref to prevent infinite re-fetching
  const hasFetchedData = useRef(false);
  const hasFetchedFilterData = useRef(false);

  // Get role from profile
  const userRole = profile?.role;
  const config = userRole ? ROLE_CONFIG[userRole] : null;
  const navigate = useNavigate();

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedSearchTerm = localStorage.getItem(STORAGE_KEYS.SEARCH_TERM);
    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
    }
  }, []);

  // Save search term to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SEARCH_TERM, searchTerm);
  }, [searchTerm]);

  const getStatusDisplay = useCallback((customer) => {
    const sentBackStatuses = ["sent_back_by_bm", "sent_back_by_ca", "sent_back_by_cso"];
    const isROActionNeeded = sentBackStatuses.includes(customer.status);

    return {
      text: isROActionNeeded ? "RO Action Needed" : "Manager Approval Needed",
      color: isROActionNeeded ? "#f59e0b" : "#3b82f6", // amber-500 : blue-500
      bgColor: isROActionNeeded ? "#fffbeb" : "#eff6ff", // amber-50 : blue-50
      borderColor: isROActionNeeded ? "#fbbf24" : "#93c5fd", // amber-300 : blue-300
      icon: ExclamationTriangleIcon,
      isROActionNeeded,
    };
  }, []);

  // Fetch customer details (branch, region, and RO name) - Optimized
  const fetchCustomerDetails = useCallback(async (customer) => {
    try {
      // If we already have the details, return them
      if (customerDetails[customer.id]) {
        return customerDetails[customer.id];
      }

      // Fetch all data in parallel
      const [branchPromise, regionPromise, roPromise] = [
        customer.branch_id
          ? supabase.from("branches").select("name").eq("id", customer.branch_id).single()
          : Promise.resolve({ data: null, error: null }),
        customer.region_id
          ? supabase.from("regions").select("name").eq("id", customer.region_id).single()
          : Promise.resolve({ data: null, error: null }),
        customer.created_by
          ? supabase.from("users").select("full_name").eq("id", customer.created_by).single()
          : Promise.resolve({ data: null, error: null })
      ];

      const [branchResult, regionResult, roResult] = await Promise.all([
        branchPromise,
        regionPromise,
        roPromise
      ]);

      const customerDetail = {
        branch: branchResult.data?.name || "N/A",
        region: regionResult.data?.name || "N/A",
        roName: roResult.data?.full_name || "N/A",
      };

      // Update state
      setCustomerDetails(prev => ({
        ...prev,
        [customer.id]: customerDetail
      }));

      return customerDetail;
    } catch (error) {
      console.error("Error fetching customer details:", error);
      return null;
    }
  }, [customerDetails]);

  // Fetch filter data based on user role
  const fetchFilterData = useCallback(async () => {
    if (!profile || hasFetchedFilterData.current) return;

    try {
      hasFetchedFilterData.current = true;

      if (profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') {
        // Fetch all branches and regions for these roles
        const [branchesResult, regionsResult] = await Promise.all([
          supabase
            .from("branches")
            .select("id, name, region_id, tenant_id")
            .eq("tenant_id", profile.tenant_id)
            .order("name"),
          supabase
            .from("regions")
            .select("id, name, tenant_id")
            .eq("tenant_id", profile.tenant_id)
            .order("name")
        ]);

        setBranches(branchesResult.data || []);
        setRegions(regionsResult.data || []);
      } else if (profile?.role === 'regional_manager' && profile.region_id) {
        // Fetch branches in their region
        const { data: branchesData } = await supabase
          .from("branches")
          .select("id, name, region_id, tenant_id")
          .eq("region_id", profile.region_id)
          .eq("tenant_id", profile.tenant_id)
          .order("name");

        setBranches(branchesData || []);
      } else if (profile?.role === 'branch_manager' && profile.branch_id) {
        // Just set their branch
        setBranches([{ id: profile.branch_id, name: "Current Branch" }]);
      }

      // Fetch ROs based on role
      if (profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') {
        const { data: roData } = await supabase
          .from("users")
          .select("id, full_name, tenant_id")
          .eq("role", "relationship_officer")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name");

        setRelationshipOfficers(roData || []);
      } else if (profile?.role === 'regional_manager' && profile.region_id) {
        // Fetch ROs in their region
        const { data: roData } = await supabase
          .from("users")
          .select("id, full_name, tenant_id")
          .eq("role", "relationship_officer")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name");

        setRelationshipOfficers(roData || []);
      } else if (profile?.role === 'branch_manager' && profile.branch_id) {
        // Fetch ROs in their branch
        const { data: roData } = await supabase
          .from("users")
          .select("id, full_name, tenant_id")
          .eq("role", "relationship_officer")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name");

        setRelationshipOfficers(roData || []);
      }
    } catch (error) {
      console.error("Error fetching filter data:", error);
    }
  }, [profile]);

  const fetchAmendmentCustomers = useCallback(async () => {
    if (authLoading || hasFetchedData.current) return;

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
        setLoading(false);
        return;
      }

      // Include the default status plus sent-back status based on role
      const statusesToInclude = [config.status];
      if (userRole === "branch_manager") statusesToInclude.push("sent_back_by_bm");
      if (userRole === "credit_analyst_officer") statusesToInclude.push("sent_back_by_ca");
      if (userRole === "customer_service_officer") statusesToInclude.push("sent_back_by_cso");

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("tenant_id", profile?.tenant_id)
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
        hasFetchedData.current = true;

        // Fetch details for all customers in batches
        const batchSize = 5;
        for (let i = 0; i < amendedCustomers.length; i += batchSize) {
          const batch = amendedCustomers.slice(i, i + batchSize);
          await Promise.all(
            batch.map(customer => fetchCustomerDetails(customer))
          );
        }
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, authLoading, userRole, config, fetchCustomerDetails]);

  // Initial data fetch
  useEffect(() => {
    if (profile && !authLoading) {
      fetchFilterData();
      if (!hasFetchedData.current) {
        fetchAmendmentCustomers();
      }
    }
  }, [profile, authLoading, fetchFilterData, fetchAmendmentCustomers]);

  // Search and filter effect
  useEffect(() => {
    if (!customers || customers.length === 0) {
      setFilteredCustomers([]);
      return;
    }

    const filtered = customers.filter((customer) => {
      const fullName = `${customer.Firstname || ""} ${customer.Surname || ""}`.toLowerCase();
      const matchesSearch =
        fullName.includes(searchTerm.toLowerCase()) ||
        (customer.id_number?.toString() || "").includes(searchTerm) ||
        (customer.mobile || "").includes(searchTerm) ||
        (customer.business_type?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (customer.business_name?.toLowerCase() || "").includes(searchTerm.toLowerCase());

      const matchesBranch = !selectedBranch ||
        customer.branch_id?.toString() === selectedBranch;

      const matchesRegion = !selectedRegion ||
        customer.region_id?.toString() === selectedRegion;

      const matchesRO = !selectedRO ||
        customer.created_by?.toString() === selectedRO;

      const matchesStatus = !selectedStatus ||
        getStatusDisplay(customer).text === selectedStatus;

      return matchesSearch && matchesBranch && matchesRegion && matchesRO && matchesStatus;
    });

    setFilteredCustomers(filtered);
  }, [searchTerm, customers, selectedBranch, selectedRegion, selectedRO, selectedStatus, getStatusDisplay]);

  // Handle filter changes
  const handleRegionChange = (regionId) => {
    setSelectedRegion(regionId);
    setSelectedBranch(""); // Clear branch selection when region changes
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedBranch("");
    setSelectedRegion("");
    setSelectedRO("");
    setSelectedStatus("");
  };

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
    setSearchTerm("");
    setCustomerDetails({});
    hasFetchedData.current = false;
    fetchAmendmentCustomers();
  }, [fetchAmendmentCustomers]);

  // Combine first name and surname
  const getFullName = useCallback((customer) => {
    const firstName = customer.Firstname || "";
    const surname = customer.Surname || "";
    return `${firstName} ${surname}`.trim() || "N/A";
  }, []);

  // Get unique statuses for filter dropdown
  const uniqueStatuses = ["RO Action Needed", "Manager Approval Needed"];

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center font-sans">
        <Spinner text="Loading ..." />
      </div>
    );
  }

  // Show error if role is not configured
  if (!config) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen font-sans">
        <div className="bg-white shadow-lg rounded-xl p-8 text-center">
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
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-gray-800 border-r border-gray-200 transition-all duration-300 p-6 min-h-screen font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xs text-slate-600 mb-1  tracking-wide">
            Registry / Pending Amendments
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={clearCache}
            disabled={refreshing}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-1.5 border border-gray-300"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <div className="text-xs text-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm" style={{ backgroundColor: "#586ab1" }}>
            <span className="font-medium text-white">{filteredCustomers.length}</span> pending amendments
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Search and Filters Header */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search and Filter Container */}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {/* Search Bar */}
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID number, phone, or business..."
                  className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all duration-200 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Filter Button and Clear Filters */}
              <div className="flex items-center gap-2">
                {(selectedBranch || selectedRegion || selectedRO || selectedStatus) && (
                  <button
                    onClick={clearFilters}
                    className="px-3 py-2 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-1.5 border border-gray-300"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-all duration-200 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 hover:text-gray-900"
                >
                  <AdjustmentsHorizontalIcon className="h-4 w-4" />
                  Filters
                  {(selectedBranch || selectedRegion || selectedRO || selectedStatus) && (
                    <span className="ml-1 px-1.5 py-0.5 bg-gray-700 text-white rounded-full text-xs">
                      {[selectedBranch, selectedRegion, selectedRO, selectedStatus].filter(Boolean).length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Region Filter */}
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Region
                    </label>
                    <div className="relative">
                      <select
                        value={selectedRegion}
                        onChange={(e) => handleRegionChange(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white"
                      >
                        <option value="" className="text-gray-400">All Regions</option>
                        {regions.map((region) => (
                          <option key={region.id} value={region.id.toString()}>
                            {region.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <ChevronDownIcon className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Branch Filter */}
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer' || profile?.role === 'regional_manager' || profile?.role === 'branch_manager') && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Branch
                    </label>
                    <div className="relative">
                      <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white"
                      >
                        <option value="" className="text-gray-400">All Branches</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id.toString()}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <ChevronDownIcon className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Relationship Officer Filter */}
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer' || profile?.role === 'regional_manager' || profile?.role === 'branch_manager') && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Relationship Officer
                    </label>
                    <div className="relative">
                      <select
                        value={selectedRO}
                        onChange={(e) => setSelectedRO(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white"
                      >
                        <option value="" className="text-gray-400">All ROs</option>
                        {relationshipOfficers.map((ro) => (
                          <option key={ro.id} value={ro.id.toString()}>
                            {ro.full_name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <ChevronDownIcon className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Status Filter */}
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Status
                  </label>
                  <div className="relative">
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white"
                    >
                      <option value="" className="text-gray-400">All Statuses</option>
                      {uniqueStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <ChevronDownIcon className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Filters Display */}
              {(selectedBranch || selectedRegion || selectedRO || selectedStatus) && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-xs text-gray-500 mr-2">Active filters:</span>
                    {selectedRegion && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                        Region: {regions.find((r) => r.id.toString() === selectedRegion)?.name}
                        <button
                          onClick={() => setSelectedRegion("")}
                          className="ml-1 text-gray-500 hover:text-gray-700"
                        >
                          <XMarkIcon className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )}
                    {selectedBranch && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                        Branch: {branches.find((b) => b.id.toString() === selectedBranch)?.name}
                        <button
                          onClick={() => setSelectedBranch("")}
                          className="ml-1 text-gray-500 hover:text-gray-700"
                        >
                          <XMarkIcon className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )}
                    {selectedRO && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                        RO: {relationshipOfficers.find((ro) => ro.id.toString() === selectedRO)?.full_name}
                        <button
                          onClick={() => setSelectedRO("")}
                          className="ml-1 text-gray-500 hover:text-gray-700"
                        >
                          <XMarkIcon className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )}
                    {selectedStatus && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                        Status: {selectedStatus}
                        <button
                          onClick={() => setSelectedStatus("")}
                          className="ml-1 text-gray-500 hover:text-gray-700"
                        >
                          <XMarkIcon className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-800">{filteredCustomers.length}</span> amendments
            {searchTerm && (
              <span className="ml-2">
                for "<span className="font-medium text-blue-600">{searchTerm}"</span>"
              </span>
            )}
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto font-sans">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ backgroundColor: '#E7F0FA' }}>
                <th className="px-4 py-3 text-left text-xs  tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs  tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  ID Number
                </th>
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs  tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Last Updated
                </th>
                <th className="px-4 py-3 text-left text-xs  tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs  tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Branch
                </th>
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Region
                </th>
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  RO Name
                </th>
                <th className="px-4 py-3 text-center text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
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
                filteredCustomers.map((customer, index) => {
                  const statusInfo = getStatusDisplay(customer);
                  const StatusIcon = statusInfo.icon;
                  const customerDetail = customerDetails[customer.id] || {};

                  return (
                    <tr
                      key={customer.id}
                      className={`border-b transition-colors hover:bg-gray-50 ${index % 2 === 0 ? '' : 'bg-gray-50'}`}
                    >
                      {/* Name */}
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                        {getFullName(customer) || "N/A"}
                      </td>

                      {/* ID Number */}
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                        {customer.id_number || "N/A"}
                      </td>

                      {/* Contact Info */}
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                        {customer.mobile || "N/A"}
                      </td>

                      {/* Last Updated */}
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                        <div>
                          <div className="font-normal">
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div
                          className="inline-flex items-center px-3 py-1 rounded text-xs border"
                          style={{
                            backgroundColor: statusInfo.bgColor,
                            color: statusInfo.color,
                            borderColor: statusInfo.borderColor
                          }}
                        >
                          <StatusIcon className="w-3 h-3 mr-1.5 flex-shrink-0" />
                          {statusInfo.text}
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                        {customerDetail.branch || "Loading..."}
                      </td>

                      {/* Region */}
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                        {customerDetail.region || "Loading..."}
                      </td>

                      {/* RO Name */}
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                        {customerDetail.roName || "Loading..."}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleViewChanges(customer)}
                            className="p-2 rounded-lg bg-gradient-to-r from-green-50 to-green-100 border border-green-200 text-green-600 hover:from-green-100 hover:to-green-200 hover:text-green-700 hover:border-green-300 transition-all duration-200 shadow-sm hover:shadow"
                            title="View Changes"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          {!statusInfo.isROActionNeeded && (
                            <button
                              onClick={() => handleApproveAmendment(customer)}
                              className="p-2 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 text-blue-600 hover:from-blue-100 hover:to-blue-200 hover:text-blue-700 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow"
                              title="Approve Changes"
                            >
                              <CheckCircleIcon className="h-4 w-4" />
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
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center">
                      <MagnifyingGlassIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">No pending amendments found</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      {searchTerm
                        ? "Try adjusting your search"
                        : "All customer information changes have been reviewed."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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