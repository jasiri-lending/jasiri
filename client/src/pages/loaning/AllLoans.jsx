import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import {
  CurrencyDollarIcon,
  CalendarIcon,
  ClockIcon,
  XCircleIcon,
  BanknotesIcon,
  EyeIcon,
  FunnelIcon,
  BuildingOfficeIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

const AllLoans = () => {
  const { profile, loading: authLoading } = useAuth();
  const [allROs, setAllROs] = useState([]);
  const [loans, setLoans] = useState([]);
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [relationshipOfficers, setRelationshipOfficers] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [roFilter, setRoFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const isCreditAnalyst = profile?.role === "credit_analyst_officer";
  const isCustomerService = profile?.role === "customer_service_officer";
  const isRegionalManager = profile?.role === "regional_manager";
  const isBranchManager = profile?.role === "branch_manager";
  const isRelationshipOfficer = profile?.role === "relationship_officer";
  const isSuperAdmin = profile?.role === "super_admin";

  const isGlobalRole = isCreditAnalyst || isCustomerService || isSuperAdmin;

  const navigate = useNavigate();

  useEffect(() => {
    if (profile) {
      fetchRegions();
      fetchBranches();
      fetchRelationshipOfficers();
      fetchLoans();
    }
  }, [profile]);

  useEffect(() => {
    filterLoans();
    setCurrentPage(1);
  }, [loans, statusFilter, branchFilter, regionFilter, roFilter, searchTerm]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLoans = filteredLoans.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);

  const goToNextPage = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
  const goToPreviousPage = () => currentPage > 1 && setCurrentPage(currentPage - 1);
  const goToPage = (pageNumber) => setCurrentPage(pageNumber);

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pageNumbers.push(i);
        pageNumbers.push("...");
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pageNumbers.push(1);
        pageNumbers.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pageNumbers.push(i);
      } else {
        pageNumbers.push(1);
        pageNumbers.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pageNumbers.push(i);
        pageNumbers.push("...");
        pageNumbers.push(totalPages);
      }
    }

    return pageNumbers;
  };

  const fetchRegions = async () => {
    try {
      if (isGlobalRole) {
        // Super Admin, Credit Analyst, Customer Service can see all regions
        const { data, error } = await supabase.from("regions").select("id, name").order("name");
        if (error) throw error;
        setRegions(data || []);
      } else if (isRegionalManager && profile?.region_id) {
        // Regional Manager can only see their assigned region
        const { data, error } = await supabase.from("regions").select("id, name").eq("id", profile.region_id);
        if (error) throw error;
        setRegions(data || []);
        setRegionFilter(profile.region_id.toString()); // Auto-select their region
      } else if (isBranchManager && profile?.branch_id) {
        // Branch Manager - get their region from branch
        const { data: branchData, error: branchError } = await supabase
          .from("branches")
          .select("region_id")
          .eq("id", profile.branch_id)
          .single();
        
        if (branchError) throw branchError;
        
        if (branchData?.region_id) {
          const { data: regionData, error: regionError } = await supabase
            .from("regions")
            .select("id, name")
            .eq("id", branchData.region_id);
          
          if (regionError) throw regionError;
          setRegions(regionData || []);
          setRegionFilter(branchData.region_id.toString()); // Auto-select their region
        }
      } else if (isRelationshipOfficer && profile?.branch_id) {
        // Relationship Officer - get their region from branch
        const { data: branchData, error: branchError } = await supabase
          .from("branches")
          .select("region_id")
          .eq("id", profile.branch_id)
          .single();
        
        if (branchError) throw branchError;
        
        if (branchData?.region_id) {
          const { data: regionData, error: regionError } = await supabase
            .from("regions")
            .select("id, name")
            .eq("id", branchData.region_id);
          
          if (regionError) throw regionError;
          setRegions(regionData || []);
          setRegionFilter(branchData.region_id.toString()); // Auto-select their region
        }
      }
    } catch (error) {
      console.error("Error fetching regions:", error);
    }
  };

  const fetchBranches = async () => {
    try {
      let query = supabase.from("branches").select("id, name, region_id").order("name");
      
      if (isBranchManager && profile?.branch_id) {
        // Branch Manager can only see their branch
        query = query.eq("id", profile.branch_id);
        setBranchFilter(profile.branch_id.toString()); // Auto-select their branch
      } else if (isRegionalManager && profile?.region_id) {
        // Regional Manager can see all branches in their region
        query = query.eq("region_id", profile.region_id);
      } else if (isRelationshipOfficer && profile?.branch_id) {
        // Relationship Officer can only see their branch
        query = query.eq("id", profile.branch_id);
        setBranchFilter(profile.branch_id.toString()); // Auto-select their branch
      }

      const { data, error } = await query;
      if (error) throw error;
      setAllBranches(data || []);
      setBranches(data || []);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchRelationshipOfficers = async () => {
    try {
      let query = supabase
        .from("users")
        .select(`
          id,
          full_name,
          role,
          profiles:profiles_user_id_fkey (
            branch_id,
            region_id
          )
        `)
        .eq("role", "relationship_officer")
        .order("full_name");

      if (isBranchManager && profile?.branch_id) {
        // Branch Manager can only see ROs in their branch
        query = query.eq("profiles.branch_id", profile.branch_id);
      } else if (isRegionalManager && profile?.region_id) {
        // Regional Manager can see all ROs in their region
        query = query.eq("profiles.region_id", profile.region_id);
      } else if (isRelationshipOfficer) {
        // Relationship Officer can only see themselves
        query = query.eq("id", profile.id);
        setRoFilter(profile.id.toString()); // Auto-select themselves
      }

      const { data, error } = await query;
      if (error) throw error;

      const formatted = data.map((ro) => ({
        id: ro.id,
        full_name: ro.full_name,
        branch_id: ro.profiles?.branch_id,
        region_id: ro.profiles?.region_id,
      }));

      setAllROs(formatted);
      setRelationshipOfficers(formatted);
    } catch (error) {
      console.error("Error fetching relationship officers:", error);
    }
  };

  const fetchLoans = async () => {
    try {
      let query = supabase
        .from("loans")
        .select(`
          *,
          customers (
            Firstname,
            Surname,
            mobile,
            id_number,
            branches (
              id,
              name,
              region_id,
              regions (
                id,
                name
              )
            )
          ),
          users!loans_created_by_fkey (
            id,
            full_name
          )
        `)
        .order("created_at", { ascending: false });

      // Role-based filtering for loans
      if (isRelationshipOfficer && profile?.id) {
        query = query.eq("booked_by", profile.id);
      } else if (isBranchManager && profile?.branch_id) {
        query = query.eq("branch_id", profile.branch_id);
      } else if (isRegionalManager && profile?.region_id) {
        const { data: branchesInRegion } = await supabase
          .from("branches")
          .select("id")
          .eq("region_id", profile.region_id);
        const branchIds = branchesInRegion?.map((b) => b.id) || [];
        if (branchIds.length > 0) query = query.in("branch_id", branchIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLoans(data || []);
    } catch (error) {
      console.error("Error fetching loans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegionChange = (regionId) => {
    setRegionFilter(regionId);
    setBranchFilter("all");
    setRoFilter("all");

    if (regionId === "all") {
      // Show all branches and ROs when "All Regions" is selected
      setBranches(allBranches);
      setRelationshipOfficers(allROs);
      return;
    }

    // Filter branches by selected region
    const filteredBranches = allBranches.filter((b) => b.region_id?.toString() === regionId);
    setBranches(filteredBranches);

    // Filter ROs by selected region
    const filteredROs = allROs.filter((ro) => ro.region_id?.toString() === regionId);
    setRelationshipOfficers(filteredROs);
  };

  const handleBranchChange = (branchId) => {
    setBranchFilter(branchId);
    setRoFilter("all");

    if (branchId === "all") {
      // If "All Branches" is selected, show ROs filtered by current region (if any)
      if (regionFilter !== "all") {
        setRelationshipOfficers(allROs.filter((ro) => ro.region_id?.toString() === regionFilter));
      } else {
        setRelationshipOfficers(allROs);
      }
      return;
    }

    // Filter ROs by selected branch
    const filteredROs = allROs.filter((ro) => ro.branch_id?.toString() === branchId);
    setRelationshipOfficers(filteredROs);
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setRegionFilter("all");
    setBranchFilter("all");
    setRoFilter("all");
    setSearchTerm("");

    // Reset dropdown options based on user role
    setBranches(allBranches);
    
    if (isRegionalManager && profile?.region_id) {
      // Regional Manager should only see their region's ROs after clear
      setRelationshipOfficers(allROs.filter((ro) => ro.region_id?.toString() === profile.region_id.toString()));
    } else if (isBranchManager && profile?.branch_id) {
      // Branch Manager should only see their branch's ROs after clear
      setRelationshipOfficers(allROs.filter((ro) => ro.branch_id?.toString() === profile.branch_id.toString()));
    } else if (isRelationshipOfficer) {
      // Relationship Officer should only see themselves after clear
      setRelationshipOfficers(allROs.filter((ro) => ro.id === profile.id));
      setRoFilter(profile.id.toString());
    } else {
      setRelationshipOfficers(allROs);
    }
    
    setCurrentPage(1);
  };

  const filterLoans = () => {
    let filtered = loans;

    if (statusFilter !== "all") filtered = filtered.filter((loan) => loan.status === statusFilter);
    if (regionFilter !== "all") filtered = filtered.filter((loan) => loan.customers?.branches?.region_id?.toString() === regionFilter);
    if (branchFilter !== "all") filtered = filtered.filter((loan) => loan.customers?.branches?.id?.toString() === branchFilter);
    if (roFilter !== "all") filtered = filtered.filter((loan) => loan.booked_by?.toString() === roFilter);

    if (searchTerm) {
      filtered = filtered.filter(
        (loan) =>
          loan.customers?.Firstname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          loan.customers?.Surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          loan.customers?.mobile?.includes(searchTerm) ||
          loan.id?.toString().includes(searchTerm)
      );
    }

    setFilteredLoans(filtered);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "booked":
        return <ClockIcon className="h-4 w-4 text-amber-600" />;
      case "bm_review":
        return <ClockIcon className="h-4 w-4 text-orange-600" />;
      case "rm_review":
        return <ClockIcon className="h-4 w-4 text-blue-600" />;
      case "ca_review":
        return <ClockIcon className="h-4 w-4 text-purple-600" />;
      case "disbursed":
        return <BanknotesIcon className="h-4 w-4 text-emerald-600" />;
      case "rejected":
        return <XCircleIcon className="h-4 w-4 text-red-600" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      booked: "bg-amber-100 text-amber-800 border-amber-200",
      bm_review: "bg-orange-100 text-orange-800 border-orange-200",
      rm_review: "bg-blue-100 text-blue-800 border-blue-200",
      ca_review: "bg-purple-100 text-purple-800 border-purple-200",
      disbursed: "bg-emerald-100 text-emerald-800 border-emerald-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
    };
    return badges[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const statusCounts = {
    all: loans.length,
    booked: loans.filter((l) => l.status === "booked").length,
    bm_review: loans.filter((l) => l.status === "bm_review").length,
    rm_review: loans.filter((l) => l.status === "rm_review").length,
    ca_review: loans.filter((l) => l.status === "ca_review").length,
    disbursed: loans.filter((l) => l.status === "disbursed").length,
    rejected: loans.filter((l) => l.status === "rejected").length,
  };

  const handleViewLoan = (loanId) => navigate(`/loans/${loanId}`);
  const handleAddInteraction = (loanId) => navigate(`/loans/${loanId}/interactions`);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading loans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        {/* Filters */}
      
 <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-indigo-100">
          <div className="flex flex-col gap-4">
            {/* First Row - Search and Action Buttons */}
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              {/* Search Input */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Loans
                </label>
                <input
                  type="text"
                  placeholder="Search by customer name, mobile, or loan ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-end space-x-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center px-4 py-3 border rounded-lg transition-colors text-sm ${
                    showFilters
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <FunnelIcon className="h-5 w-5 mr-2" />
                  Filters
                  {(statusFilter !== "all" ||
                    regionFilter !== "all" ||
                    branchFilter !== "all" ||
                    roFilter !== "all") && (
                    <span className="ml-2 px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full">
                      {[
                        statusFilter !== "all",
                        regionFilter !== "all",
                        branchFilter !== "all",
                        roFilter !== "all",
                      ].filter(Boolean).length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Second Row - Advanced Filters (Collapsible) */}
            {showFilters && (
              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Region Filter - For global roles */}
                  {isGlobalRole && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Filter by Region
                      </label>
                      <select
                        value={regionFilter}
                        onChange={(e) => handleRegionChange(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      >
                        <option value="all">All Regions</option>
                        {regions.map((region) => (
                          <option key={region.id} value={region.id.toString()}>
                            {region.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Branch Filter - For global and regional roles */}
                  {(isGlobalRole || isRegionalManager) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Filter by Branch
                      </label>
                      <div className="flex items-center gap-2">
                        <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
                        <select
                          value={branchFilter}
                          onChange={(e) => handleBranchChange(e.target.value)}
                          className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        >
                          <option value="all">All Branches</option>
                          {branches.map((branch) => (
                            <option key={branch.id} value={branch.id.toString()}>
                              {branch.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* RO Filter - For all roles except RO */}
                  {!isRelationshipOfficer && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Filter by RO
                      </label>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-5 w-5 text-gray-400" />
                        <select
                          value={roFilter}
                          onChange={(e) => setRoFilter(e.target.value)}
                          className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        >
                          <option value="all">All ROs</option>
                          {relationshipOfficers.map((ro) => (
                            <option key={ro.id} value={ro.id.toString()}>
                              {ro.full_name} 
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Status Filter - Available for all roles */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Filter by Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    >
                      <option value="all">All Status ({statusCounts.all})</option>
                      <option value="booked">
                        Booked ({statusCounts.booked})
                      </option>
                      <option value="bm_review">
                        Pending BM ({statusCounts.bm_review})
                      </option>
                      <option value="rm_review">
                        Pending RM ({statusCounts.rm_review})
                      </option>
                      <option value="ca_review">
                        Pending Disbursement ({statusCounts.ca_review})
                      </option>
                      <option value="disbursed">
                        Disbursed ({statusCounts.disbursed})
                      </option>
                      <option value="rejected">
                        Rejected ({statusCounts.rejected})
                      </option>
                    </select>
                  </div>

                  {/* Clear Filters Button */}
                  <div className="flex items-end">
                    <button
                      onClick={clearFilters}
                      className="flex items-center px-4 py-3 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <XMarkIcon className="h-4 w-4 mr-1" />
                      Clear Filters
                    </button>
                  </div>
                </div>

                {/* Active Filters Display */}
                {(statusFilter !== "all" ||
                  regionFilter !== "all" ||
                  branchFilter !== "all" ||
                  roFilter !== "all") && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                    <span className="text-xs text-gray-600">Active filters:</span>
                    {regionFilter !== "all" && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        Region:{" "}
                        {regions.find((r) => r.id.toString() === regionFilter)
                          ?.name}
                        <button
                          onClick={() => handleRegionChange("all")}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {branchFilter !== "all" && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        Branch:{" "}
                        {branches.find((b) => b.id.toString() === branchFilter)
                          ?.name}
                        <button
                          onClick={() => handleBranchChange("all")}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {roFilter !== "all" && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        RO:{" "}
                        {relationshipOfficers.find((ro) => ro.id.toString() === roFilter)
                          ? `${relationshipOfficers.find((ro) => ro.id.toString() === roFilter).full_name}`
                          : ""}
                        <button
                          onClick={() => setRoFilter("all")}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {statusFilter !== "all" && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        Status:{" "}
                        {statusFilter
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                        <button
                          onClick={() => setStatusFilter("all")}
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

        {/* Results Summary */}
        {loans.length > 0 && (
          <div className="mb-4 flex justify-between items-center">
            <p className="text-xs text-gray-600">
              Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredLoans.length)} of {filteredLoans.length} loans
              {(searchTerm ||
                statusFilter !== "all" ||
                regionFilter !== "all" ||
                branchFilter !== "all" ||
                roFilter !== "all") &&
                " (filtered)"}
            </p>
            <p className="text-xs font-medium text-gray-900">
              Total Records: <span className="text-indigo-600">{loans.length}</span>
            </p>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-x-auto">
          <table className="w-full border-collapse min-w-[1200px]">
            <thead>
              <tr className="text-white text-xs" style={{ backgroundColor: "#586ab1" }}>
                <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">
                  Customer
                </th>
                <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">
                  ID Number
                </th>
                <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">
                  Phone
                </th>
                {isGlobalRole && (
                  <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">
                    Region
                  </th>
                )}
                {(isGlobalRole || isRegionalManager) && (
                  <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">
                    Branch
                  </th>
                )}
                {!isRelationshipOfficer && (
                  <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">
                    Booked By
                  </th>
                )}
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">
                  Product
                </th>
                <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                  Amount
                </th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">
                  Weeks
                </th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">
                  Status
                </th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">
                  Date
                </th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 text-xs">
              {currentLoans.map((loan, index) => (
                <tr
                  key={loan.id}
                  className={`${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-indigo-50 transition-colors`}
                >
                  <td className="px-3 py-3 whitespace-nowrap">
                    {loan.customers?.Firstname} {loan.customers?.Surname}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {loan.customers?.id_number}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {loan.customers?.mobile}
                  </td>
                  {isGlobalRole && (
                    <td className="px-3 py-3 whitespace-nowrap">
                      {loan.customers?.branches?.regions?.name || "N/A"}
                    </td>
                  )}
                  {(isGlobalRole || isRegionalManager) && (
                    <td className="px-3 py-3 whitespace-nowrap">
                      {loan.customers?.branches?.name}
                    </td>
                  )}
                  {!isRelationshipOfficer && (
                    <td className="px-3 py-3 whitespace-nowrap">
                      {loan.users?.Firstname} {loan.users?.Surname}
                    </td>
                  )}
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    {loan.product_name || loan.product}
                  </td>
                  <td className="px-3 py-3 text-right font-bold whitespace-nowrap" style={{ color: "#10b981" }}>
                    KES {loan.scored_amount?.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "#dbeafe", color: "#1e40af" }}>
                      {loan.duration_weeks}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                        loan.status
                      )}`}
                    >
                      {getStatusIcon(loan.status)}
                      <span className="whitespace-nowrap">
                        {loan.status.replace(/_/g, " ")}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center text-gray-600">
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {new Date(loan.created_at).toLocaleDateString("en-GB")}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleViewLoan(loan.id)}
                        className="flex items-center gap-1 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                        style={{ backgroundColor: "#586ab1" }}
                        title="View Loan Details"
                      >
                        <EyeIcon className="h-4 w-4" />
                        view
                      </button>
                      <button
                        onClick={() => handleAddInteraction(loan.id)}
                        className="flex items-center gap-1 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                        style={{ backgroundColor: "#586ab1" }}
                        title="Add Interaction"
                      >
                        <ChatBubbleLeftRightIcon className="h-4 w-4" />
                        log
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredLoans.length === 0 && (
            <div className="text-center py-12">
              <ClockIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">
                No loans found
              </h3>
              <p className="text-sm text-gray-600">
                {searchTerm ||
                statusFilter !== "all" ||
                regionFilter !== "all" ||
                branchFilter !== "all" ||
                roFilter !== "all"
                  ? "Try adjusting your filters or search criteria."
                  : "No loans available."}
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredLoans.length > 0 && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between bg-white rounded-xl shadow-lg p-4 border border-indigo-100">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Previous Button */}
              <button
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className={`flex items-center px-3 py-2 text-xs font-medium rounded-lg border ${
                  currentPage === 1
                    ? "text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed"
                    : "text-white hover:shadow-lg transition-all duration-300"
                }`}
                style={currentPage === 1 ? {} : { backgroundColor: "#586ab1" }}
              >
                <ChevronLeftIcon className="h-4 w-4 mr-1" />
                Previous
              </button>

              {/* Page Numbers */}
              <div className="flex space-x-1">
                {getPageNumbers().map((page, index) => (
                  <button
                    key={index}
                    onClick={() => typeof page === 'number' && goToPage(page)}
                    className={`min-w-[36px] px-3 py-2 text-xs font-medium rounded-lg border transition-all duration-300 ${
                      page === currentPage
                        ? "text-white border-transparent hover:shadow-lg"
                        : page === '...'
                        ? "text-gray-500 border-transparent cursor-default bg-white"
                        : "text-gray-700 bg-white border-gray-300 hover:bg-gray-50"
                    }`}
                    style={page === currentPage ? { backgroundColor: "#586ab1" } : {}}
                    disabled={page === '...'}
                  >
                    {page}
                  </button>
                ))}
              </div>

              {/* Next Button */}
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className={`flex items-center px-3 py-2 text-xs font-medium rounded-lg border ${
                  currentPage === totalPages
                    ? "text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed"
                    : "text-white hover:shadow-lg transition-all duration-300"
                }`}
                style={currentPage === totalPages ? {} : { backgroundColor: "#586ab1" }}
              >
                Next
                <ChevronRightIcon className="h-4 w-4 ml-1" />
              </button>
            </div>

            <div className="text-xs text-gray-500">
              {itemsPerPage} per page
            </div>
          </div>
        )}
      </div>
    </div>
      </div>
    </div>
  );
};

export default AllLoans;