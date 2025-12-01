// src/pages/registry/Customers.jsx
import { useState, useEffect } from "react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  EyeIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ChatBubbleLeftRightIcon,
  BanknotesIcon,
  HandRaisedIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../hooks/userAuth.js";
import { useNavigate } from "react-router-dom";

const AllCustomers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [relationshipOfficers, setRelationshipOfficers] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [allRelationshipOfficers, setAllRelationshipOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [quickSearchTerm, setQuickSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedRO, setSelectedRO] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const { profile } = useAuth();

  const handleOpenInteractions = (customer) => {
    navigate(`/customer/${customer.id}/interactions`);
    setQuickSearchTerm(""); // Clear search when opening
  };

  const handleOpenLoanDetails = (customer) => {
    navigate(`/customer/${customer.id}/loan-details`);
    setQuickSearchTerm(""); // Clear search when opening
  };

 // In Customers.jsx - Replace the handleOpenPromiseToPay function

const handleOpenPromiseToPay = async (customer) => {
  // Fetch the disbursed loan for this customer
  const { data: loan, error } = await supabase
    .from("loans")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("status", "disbursed")
    .single();

  if (loan && !error) {
    // Navigate with loan_id in the URL
    navigate(`/customer/${customer.id}/promise-to-pay?loan_id=${loan.id}`);
  } else {
    alert.error("No disbursed loan found for this customer");
  }
  setQuickSearchTerm(""); // Clear search when opening
};

  // const handleOpen360View = (customer) => {
  //   navigate(`/customer/${customer.id}/360`);
  //   setQuickSearchTerm(""); // Clear search when opening
  // };

  const handleViewCustomer = (customer) => {
    navigate(`/customer/${customer.id}/details`);
    setQuickSearchTerm(""); // Clear search when opening
  };

  // Fetch data based on user role
  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch customers based on role
      let customersQuery = supabase
        .from("customers")
        .select(`
          *,
          branches (
            id,
            name
          ),
          regions (
            id,
            name
          ),
          users:created_by (
            id,
            full_name
          )
        `)
        .eq("form_status", "submitted")
        .order("created_at", { ascending: false });

      // Apply filters based on user role
      if (profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') {
        // See all customers across all regions, all branches, all ROs
        // No additional filters needed
      } else if (profile?.role === 'regional_manager') {
        // See customers in their region and branches in their region
        if (profile.region_id) {
          customersQuery = customersQuery.eq("region_id", profile.region_id);
        }
      } else if (profile?.role === 'branch_manager') {
        // See customers from their branch and ROs in their branch
        if (profile.branch_id) {
          customersQuery = customersQuery.eq("branch_id", profile.branch_id);
        }
      } else if (profile?.role === 'relationship_officer') {
        // Only see customers they created
        if (profile.id) {
          customersQuery = customersQuery.eq("created_by", profile.id);
        }
      }

      const { data: customersData, error: customersError } = await customersQuery;

      if (customersError) {
        console.error("Error fetching customers:", customersError);
        return;
      }

      // Fetch additional data for filters based on role
      if (profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') {
        // Fetch all branches, regions, and ROs for global access
        const [branchesResult, regionsResult, roResult] = await Promise.all([
          supabase.from("branches").select("id, name, region_id").order("name"),
          supabase.from("regions").select("id, name").order("name"),
          supabase.from("users").select("id, full_name, branch_id, region_id").eq("role", "relationship_officer").order("full_name")
        ]);

        setAllBranches(branchesResult.data || []);
        setBranches(branchesResult.data || []);
        setRegions(regionsResult.data || []);
        setAllRelationshipOfficers(roResult.data || []);
        setRelationshipOfficers(roResult.data || []);
      } else if (profile?.role === 'regional_manager') {
        // Fetch branches in their region and ROs in those branches
        if (profile.region_id) {
          const [branchesResult, roResult] = await Promise.all([
            supabase.from("branches").select("id, name, region_id").eq("region_id", profile.region_id).order("name"),
            supabase
              .from("users")
              .select("id, full_name, branch_id, region_id")
              .eq("role", "relationship_officer")
              .eq("region_id", profile.region_id)
              .order("full_name")
          ]);

          setAllBranches(branchesResult.data || []);
          setBranches(branchesResult.data || []);
          setAllRelationshipOfficers(roResult.data || []);
          setRelationshipOfficers(roResult.data || []);
        }
      } else if (profile?.role === 'branch_manager') {
        // Fetch ROs in their branch
        if (profile.branch_id) {
          const { data: roData } = await supabase
            .from("users")
            .select("id, full_name, branch_id, region_id")
            .eq("role", "relationship_officer")
            .eq("branch_id", profile.branch_id)
            .order("full_name");

          setAllRelationshipOfficers(roData || []);
          setRelationshipOfficers(roData || []);
        }
      }

      // Process customers data
      if (customersData && customersData.length > 0) {
        const customersWithLoanStatus = await Promise.all(
          customersData.map(async (c) => {
            const { data: loan, error: loanError } = await supabase
              .from("loans")
              .select("id, status, repayment_state")
              .eq("customer_id", c.id)
              .eq("status", "disbursed")
              .maybeSingle();

            return {
              ...c,
              hasDisbursedLoan: !!loan && !loanError,
              loanRepaymentState: loan?.repayment_state || null,
            };
          })
        );
        setCustomers(customersWithLoanStatus);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchData();
    }
  }, [profile]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedBranch("");
    setSelectedRegion("");
    setSelectedRO("");
    setSelectedStatus("");
    setCurrentPage(1);
    
    // Reset cascading filters
    if (profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') {
      setBranches(allBranches);
      setRelationshipOfficers(allRelationshipOfficers);
    } else if (profile?.role === 'regional_manager') {
      setBranches(allBranches);
      setRelationshipOfficers(allRelationshipOfficers);
    }
  };

  // Handle region change - filter branches and ROs
  const handleRegionChange = (regionId) => {
    setSelectedRegion(regionId);
    setSelectedBranch(""); // Clear branch selection
    setSelectedRO(""); // Clear RO selection
    
    if (regionId) {
      // Filter branches by selected region
      const filteredBranches = allBranches.filter(
        (branch) => branch.region_id?.toString() === regionId
      );
      setBranches(filteredBranches);
      
      // Filter ROs by selected region
      const filteredROs = allRelationshipOfficers.filter(
        (ro) => ro.region_id?.toString() === regionId
      );
      setRelationshipOfficers(filteredROs);
    } else {
      // Reset to all branches and ROs
      setBranches(allBranches);
      setRelationshipOfficers(allRelationshipOfficers);
    }
  };

  // Handle branch change - filter ROs
  const handleBranchChange = (branchId) => {
    setSelectedBranch(branchId);
    setSelectedRO(""); // Clear RO selection
    
    if (branchId) {
      // Filter ROs by selected branch
      const filteredROs = allRelationshipOfficers.filter(
        (ro) => ro.branch_id?.toString() === branchId
      );
      setRelationshipOfficers(filteredROs);
    } else if (selectedRegion) {
      // If no branch but region is selected, show ROs for that region
      const filteredROs = allRelationshipOfficers.filter(
        (ro) => ro.region_id?.toString() === selectedRegion
      );
      setRelationshipOfficers(filteredROs);
    } else {
      // Reset to all ROs
      setRelationshipOfficers(allRelationshipOfficers);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      (c.Firstname || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.Surname || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.Middlename || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.mobile || "").toString().includes(searchTerm) ||
      (c.id_number || "").toString().includes(searchTerm);

    const matchesBranch =
      !selectedBranch ||
      c.branch_id?.toString() === selectedBranch ||
      c.branches?.id?.toString() === selectedBranch;

    const matchesRegion =
      !selectedRegion ||
      c.region_id?.toString() === selectedRegion;

    const matchesRO =
      !selectedRO ||
      c.created_by?.toString() === selectedRO;

    const matchesStatus =
      !selectedStatus ||
      c.status === selectedStatus ||
      c.verification_status === selectedStatus;

    return matchesSearch && matchesBranch && matchesRegion && matchesRO && matchesStatus;
  });

  // // Quick search filter (separate from main search)
  // const quickSearchResults = customers.filter((c) => {
  //   if (!quickSearchTerm) return false;
  //   return (
  //     (c.Firstname || "").toLowerCase().includes(quickSearchTerm.toLowerCase()) ||
  //     (c.Surname || "").toLowerCase().includes(quickSearchTerm.toLowerCase()) ||
  //     (c.mobile || "").toString().includes(quickSearchTerm) ||
  //     (c.id_number || "").toString().includes(quickSearchTerm)
  //   );
  // });

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCustomers = filteredCustomers.slice(startIndex, endIndex);

  // Pagination handlers
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const goToPage = (page) => setCurrentPage(page);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranch, selectedRegion, selectedRO, selectedStatus]);

  // Get unique statuses from customers
  const uniqueStatuses = [...new Set(customers.map((c) => c.verification_status).filter(Boolean))];

  // // Get role-specific display text
  // const getRoleSpecificText = () => {
  //   switch (profile?.role) {
  //     case 'credit_analyst_officer':
  //     case 'customer_service_officer':
  //       return "all customers across all regions";
  //     case 'regional_manager':
  //       return "customers in your region";
  //     case 'branch_manager':
  //       return "customers in your branch";
  //     case 'relationship_officer':
  //       return "customers you created";
  //     default:
  //       return "customers";
  //   }
  // };

  if (!profile || loading) {
    return (
      <div className="p-6">
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {!profile ? "Loading profile..." : "Loading customers..."}
          </p>
        </div>
      </div>
    );
  }

  // Check if user has necessary permissions/data
  if ((profile.role === 'regional_manager' && !profile.region_id) ||
      (profile.role === 'branch_manager' && !profile.branch_id)) {
    return (
      <div className="p-6">
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <p className="text-red-600">
            Error: Your profile is missing necessary information. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2  bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-gray-800 border-r border-gray-200 transition-all duration-300">
      {/* Page Header with 360 View Search */}
      
     

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-col gap-4">
          {/* First Row - Search and Action Buttons */}
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Customers
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name, mobile, or ID..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-indigo-500 focus:border-indigo-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-end space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center px-4 py-2 border rounded-md transition-colors ${
                  showFilters
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <FunnelIcon className="h-5 w-5 mr-2" />
                Filters
                {(selectedBranch || selectedRegion || selectedRO || selectedStatus) && (
                  <span className="ml-2 px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full">
                    {[selectedBranch, selectedRegion, selectedRO, selectedStatus].filter(Boolean).length}
                  </span>
                )}
              </button>
              <button className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Export
              </button>
            </div>
          </div>

          {/* Second Row - Advanced Filters (Collapsible) */}
          {showFilters && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Region Filter (only for global roles) */}
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Filter by Region
                    </label>
                    <select
                      value={selectedRegion}
                      onChange={(e) => handleRegionChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">All Regions</option>
                      {regions.map((region) => (
                        <option key={region.id} value={region.id.toString()}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Branch Filter */}
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer' || profile?.role === 'regional_manager') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Filter by Branch
                    </label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => handleBranchChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">All Branches</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id.toString()}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Relationship Officer Filter */}
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer' || profile?.role === 'regional_manager' || profile?.role === 'branch_manager') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Filter by Relationship Officer
                    </label>
                    <select
                      value={selectedRO}
                      onChange={(e) => setSelectedRO(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">All ROs</option>
                      {relationshipOfficers.map((ro) => (
                        <option key={ro.id} value={ro.id.toString()}>
                          {ro.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter by Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">All Statuses</option>
                    {uniqueStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters Button */}
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="flex items-center px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    Clear Filters
                  </button>
                </div>
              </div>

              {/* Active Filters Display */}
              {(selectedBranch || selectedRegion || selectedRO || selectedStatus) && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                  <span className="text-sm text-gray-600">Active filters:</span>
                  {selectedRegion && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      Region: {regions.find((r) => r.id.toString() === selectedRegion)?.name}
                      <button
                        onClick={() => handleRegionChange("")}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {selectedBranch && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      Branch: {branches.find((b) => b.id.toString() === selectedBranch)?.name}
                      <button
                        onClick={() => handleBranchChange("")}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {selectedRO && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                      RO: {relationshipOfficers.find((ro) => ro.id.toString() === selectedRO)?.full_name}
                      <button
                        onClick={() => setSelectedRO("")}
                        className="ml-1 text-purple-600 hover:text-purple-800"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {selectedStatus && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      Status: {selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}
                      <button
                        onClick={() => setSelectedStatus("")}
                        className="ml-1 text-green-600 hover:text-green-800"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      {/* Customers Table */}
      <div className=" bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50  border-r border-gray-200 transition-all duration-300 shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  First Name
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Surname
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                  Contact
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  ID Number
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Prequalified Amount
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  Status
                </th>
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') && (
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Region
                  </th>
                )}
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Branch
                </th>
                {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer' || profile?.role === 'regional_manager' || profile?.role === 'branch_manager') && (
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Relationship Officer
                  </th>
                )}
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 text-sm text-gray-900 truncate" title={customer.Firstname || "N/A"}>
                    {customer.Firstname || "N/A"}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 truncate" title={customer.Surname || "N/A"}>
                    {customer.Surname || "N/A"}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 truncate" title={customer.mobile || "N/A"}>
                    {customer.mobile || "N/A"}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 truncate" title={customer.id_number || "N/A"}>
                    {customer.id_number || "N/A"}
                  </td>
                  <td
                    className="px-3 py-2 text-sm text-gray-700 truncate"
                    title={
                      customer.prequalifiedAmount
                        ? customer.prequalifiedAmount.toLocaleString("en-KE", {
                            style: "currency",
                            currency: "KES",
                          })
                        : "N/A"
                    }
                  >
                    {customer.prequalifiedAmount
                      ? `KES ${customer.prequalifiedAmount.toLocaleString()}`
                      : "N/A"}
                  </td>
                  <td className="px-3 py-2 text-sm truncate" title={customer.status || "N/A"}>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        customer.status === "verified"
                          ? "bg-green-100 text-green-800"
                          : customer.status === "bm_review"
                          ? "bg-yellow-100 text-yellow-800"
                          : customer.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {customer.status || "N/A"}
                    </span>
                  </td>
                  {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer') && (
                    <td className="px-3 py-2 text-sm text-gray-900 truncate" title={customer.regions?.name || "N/A"}>
                      {customer.regions?.name || "N/A"}
                    </td>
                  )}
                  <td className="px-3 py-2 text-sm text-gray-900 truncate" title={customer.branches?.name || "N/A"}>
                    {customer.branches?.name || "N/A"}
                  </td>
                  {(profile?.role === 'credit_analyst_officer' || profile?.role === 'customer_service_officer' || profile?.role === 'regional_manager' || profile?.role === 'branch_manager') && (
                    <td className="px-3 py-2 text-sm text-gray-900 truncate" title={customer.users?.full_name || "N/A"}>
                      {customer.users?.full_name || "N/A"}
                    </td>
                  )}
                  <td className="px-3 py-2 text-sm font-medium space-x-1 flex items-center">
                    {/* View Customer */}
                    <button
                      onClick={() => handleViewCustomer(customer)}
                      className="p-1.5 rounded-md bg-green-50 border border-green-200 text-green-600 hover:bg-green-100 hover:text-green-700 transition"
                      title="View Customer"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>

                    {/* Interactions */}
                    <button
                      onClick={() => handleOpenInteractions(customer)}
                      className="p-1.5 rounded-md bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition"
                      title="Customer Interactions"
                    >
                      <ChatBubbleLeftRightIcon className="h-4 w-4" />
                    </button>

                    {/* Loan Details (only if disbursed) */}
                    {customer.hasDisbursedLoan && (
                      <button
                        onClick={() => handleOpenLoanDetails(customer)}
                        className="p-1.5 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700 transition"
                        title="Loan Details"
                      >
                        <BanknotesIcon className="h-4 w-4" />
                      </button>
                    )}

                    {/* Promise to Pay (only if disbursed AND repayment_state is ongoing or partial) */}
                    {customer.hasDisbursedLoan &&
                      ["ongoing", "partial"].includes(customer.loanRepaymentState) && (
                        <button
                          onClick={() => handleOpenPromiseToPay(customer)}
                          className="p-1.5 rounded-md bg-purple-50 border border-purple-200 text-purple-600 hover:bg-purple-100 hover:text-purple-700 transition"
                          title="Promise to Pay"
                        >
                          <HandRaisedIcon className="h-4 w-4" />
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

   
        {/* Pagination Controls */}
        {filteredCustomers.length > 0 && (
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  {/* Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
                  <span className="font-medium">{Math.min(endIndex, filteredCustomers.length)}</span> of{" "}
                  <span className="font-medium">{filteredCustomers.length}</span> results */}
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  {/* First Page Button */}
                  <button
                    onClick={goToFirstPage}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="First Page"
                  >
                    <ChevronDoubleLeftIcon className="h-5 w-5" />
                  </button>
                  
                  {/* Previous Page Button */}
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous Page"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>

                  {/* Page Numbers */}
                  {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === page
                            ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  ))}

                  {/* Next Page Button */}
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Next Page"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>

                  {/* Last Page Button */}
                  <button
                    onClick={goToLastPage}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Last Page"
                  >
                    <ChevronDoubleRightIcon className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

    
    </div>
  );
};

export default AllCustomers;