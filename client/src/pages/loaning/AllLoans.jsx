import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon,
  CalendarIcon,
  ClockIcon,
  BuildingOfficeIcon,
  UserIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import Spinner from "../../components/Spinner";

const AllLoans = () => {
  const { profile } = useAuth();
  const [loans, setLoans] = useState([]);
  const [customers, setCustomers] = useState({}); // Store customer data
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [branches, setBranches] = useState({});
  const [regions, setRegions] = useState({});
  const [roUsers, setRoUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [roFilter, setRoFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const navigate = useNavigate();
  const hasFetchedData = useRef(false);

  const isCreditAnalyst = profile?.role === "credit_analyst_officer";
  const isCustomerService = profile?.role === "customer_service_officer";
  const isRegionalManager = profile?.role === "regional_manager";
  const isBranchManager = profile?.role === "branch_manager";
  const isRelationshipOfficer = profile?.role === "relationship_officer";
  const isSuperAdmin = profile?.role === "super_admin";
  const isGlobalRole = isCreditAnalyst || isCustomerService || isSuperAdmin;

  useEffect(() => {
    if (profile && !hasFetchedData.current) {
      hasFetchedData.current = true;
      fetchReferenceData();
      fetchLoans();
    }
  }, [profile?.id]);

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

  const fetchReferenceData = async () => {
    try {
      const [branchesResponse, regionsResponse, usersResponse, customersResponse] = await Promise.all([
        supabase.from('branches').select('id, name, region_id'),
        supabase.from('regions').select('id, name'),
        supabase.from('users').select('id, full_name'),
        supabase.from('customers').select('id, prefix, "Firstname", "Surname", "Middlename", id_number, mobile') // Use exact column names
      ]);

      if (branchesResponse.data) {
        const branchesMap = {};
        branchesResponse.data.forEach(branch => {
          branchesMap[branch.id] = { name: branch.name, region_id: branch.region_id };
        });
        setBranches(branchesMap);
      }

      if (regionsResponse.data) {
        const regionsMap = {};
        regionsResponse.data.forEach(region => {
          regionsMap[region.id] = region.name;
        });
        setRegions(regionsMap);
      }

      if (usersResponse.data) {
        const usersMap = {};
        usersResponse.data.forEach(user => {
          usersMap[user.id] = user.full_name;
        });
        setRoUsers(usersMap);
      }

      if (customersResponse.data) {
        const customersMap = {};
        customersResponse.data.forEach(customer => {
          customersMap[customer.id] = {
            fullName: `${customer.prefix ? customer.prefix + ' ' : ''}${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.replace(/\s+/g, ' ').trim(),
            idNumber: customer.id_number,
            mobile: customer.mobile
          };
        });
        setCustomers(customersMap);
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  };

  const fetchLoans = async () => {
    if (!profile) {
      console.warn("No profile available, skipping fetch");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("loans")
        .select("*")
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

  const filterLoans = () => {
    let filtered = loans;

    if (statusFilter !== "all") filtered = filtered.filter((loan) => loan.status === statusFilter);
    if (regionFilter !== "all") filtered = filtered.filter((loan) => loan.branch_id && branches[loan.branch_id]?.region_id?.toString() === regionFilter);
    if (branchFilter !== "all") filtered = filtered.filter((loan) => loan.branch_id?.toString() === branchFilter);
    if (roFilter !== "all") filtered = filtered.filter((loan) => loan.booked_by?.toString() === roFilter);

    if (searchTerm) {
      filtered = filtered.filter(
        (loan) => {
          const customer = customers[loan.customer_id];
          return (
            (customer?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (customer?.idNumber?.toString().includes(searchTerm)) ||
            (customer?.mobile?.includes(searchTerm)) ||
            loan.id?.toString().includes(searchTerm)
          );
        }
      );
    }

    setFilteredLoans(filtered);
  };

  const getCustomerName = (customerId) => {
    if (!customerId) return "N/A";
    const customer = customers[customerId];
    return customer?.fullName || "N/A";
  };

  const getCustomerIdNumber = (customerId) => {
    if (!customerId) return "N/A";
    const customer = customers[customerId];
    return customer?.idNumber || "N/A";
  };

  const getCustomerMobile = (customerId) => {
    if (!customerId) return "N/A";
    const customer = customers[customerId];
    return customer?.mobile || "N/A";
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

  const handleRegionChange = (regionId) => {
    setRegionFilter(regionId);
    setBranchFilter("all");
    setRoFilter("all");
  };

  const handleBranchChange = (branchId) => {
    setBranchFilter(branchId);
    setRoFilter("all");
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setRegionFilter("all");
    setBranchFilter("all");
    setRoFilter("all");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleRefresh = () => {
    fetchLoans();
    fetchReferenceData();
  };

  const handleViewLoan = (loanId) => navigate(`/loans/${loanId}`);
  const handleAddInteraction = (loanId) => navigate(`/loans/${loanId}/interactions`);

  if (!profile) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
        <Spinner text="Loading user information..." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center">
        <Spinner text="Loading loans..." />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        All Loans
      </h1>

      {/* Search and Actions Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="h-4 w-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer name, ID number, mobile, or loan ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-gray-300 rounded-md pl-8 pr-3 py-1.5 w-full text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-colors border ${
                  showFilters ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <FunnelIcon className="h-4 w-4" />
                Filters
              </button>
              
              <button 
                onClick={handleRefresh}
                className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-colors border whitespace-nowrap"
                style={{ 
                  backgroundColor: "#586ab1",
                  color: "white",
                  borderColor: "#586ab1"
                }}
              >
                <ArrowPathIcon className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Filters Section */}
          {showFilters && (
            <>
              <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Region Filter */}
                {(isGlobalRole || isRegionalManager) && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Region
                    </label>
                    <select
                      value={regionFilter}
                      onChange={(e) => handleRegionChange(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Regions</option>
                      {Object.entries(regions).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Branch Filter */}
                {(isGlobalRole || isRegionalManager || isBranchManager) && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Branch
                    </label>
                    <select
                      value={branchFilter}
                      onChange={(e) => handleBranchChange(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Branches</option>
                      {Object.entries(branches)
                        .filter(([id, branch]) => 
                          regionFilter === "all" || branch.region_id?.toString() === regionFilter
                        )
                        .map(([id, branch]) => (
                          <option key={id} value={id}>
                            {branch.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* RO Filter */}
                {!isRelationshipOfficer && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Relationship Officer
                    </label>
                    <select
                      value={roFilter}
                      onChange={(e) => setRoFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All ROs</option>
                      {Object.entries(roUsers).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Status ({statusCounts.all})</option>
                    <option value="booked">Booked ({statusCounts.booked})</option>
                    <option value="bm_review">Pending BM ({statusCounts.bm_review})</option>
                    <option value="rm_review">Pending RM ({statusCounts.rm_review})</option>
                    <option value="ca_review">Pending CA ({statusCounts.ca_review})</option>
                    <option value="disbursed">Disbursed ({statusCounts.disbursed})</option>
                    <option value="rejected">Rejected ({statusCounts.rejected})</option>
                  </select>
                </div>
              </div>

              {/* Active Filters */}
              {(statusFilter !== "all" || regionFilter !== "all" || branchFilter !== "all" || roFilter !== "all") && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-600">Active filters:</span>
                    {regionFilter !== "all" && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        Region: {regions[regionFilter]}
                        <button onClick={() => handleRegionChange("all")} className="ml-1">
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {branchFilter !== "all" && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        Branch: {branches[branchFilter]?.name}
                        <button onClick={() => handleBranchChange("all")} className="ml-1">
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {roFilter !== "all" && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        RO: {roUsers[roFilter]}
                        <button onClick={() => setRoFilter("all")} className="ml-1">
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {statusFilter !== "all" && (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        Status: {statusFilter.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        <button onClick={() => setStatusFilter("all")} className="ml-1">
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    <button
                      onClick={clearFilters}
                      className="text-xs text-gray-600 hover:text-gray-800 inline-flex items-center gap-1"
                    >
                      <XMarkIcon className="h-3 w-3" />
                      Clear all
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Results Info */}
       
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <thead>
              <tr style={{ backgroundColor: "#ffff" }}>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Customer</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">ID Number</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Mobile</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Region</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Branch</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Booked By</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Product</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Amount</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Weeks</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Status</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Date</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan="12" className="px-6 py-12 text-center">
                    <div className="text-center">
                      <BuildingOfficeIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-sm font-medium text-gray-900 mb-2">No loans found</h3>
                      <p className="text-xs text-gray-500">
                        {searchTerm || statusFilter !== "all" || regionFilter !== "all" || branchFilter !== "all" || roFilter !== "all"
                          ? "Try adjusting your filters or search criteria."
                          : "No loans available."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentLoans.map((loan) => {
                  const branch = branches[loan.branch_id];
                  const regionName = branch ? regions[branch.region_id] : 'N/A';
                  const branchName = branch?.name || 'N/A';
                  const roName = roUsers[loan.booked_by] || 'N/A';
                  const customerName = getCustomerName(loan.customer_id);
                  const customerIdNumber = getCustomerIdNumber(loan.customer_id);
                  const customerMobile = getCustomerMobile(loan.customer_id);

                  return (
                    <tr key={loan.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {customerName}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {customerIdNumber}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {customerMobile}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {regionName}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {branchName}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {roName}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {loan.product_name || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 text-right font-medium whitespace-nowrap">
                        {loan.scored_amount
                          ? `Ksh ${Number(loan.scored_amount).toLocaleString()}`
                          : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {loan.duration_weeks || "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(loan.status)}`}>
                          <ClockIcon className="h-3 w-3" />
                          {loan.status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <CalendarIcon className="h-3 w-3 text-gray-400" />
                          {loan.created_at ? new Date(loan.created_at).toLocaleDateString("en-GB") : "N/A"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewLoan(loan.id)}
                            className="p-1.5 rounded-md bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition"
                            title="View Details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAddInteraction(loan.id)}
                            className="p-1.5 rounded-md bg-green-50 border border-green-200 text-green-600 hover:bg-green-100 hover:text-green-700 transition"
                            title="Add Interaction"
                          >
                            <ChatBubbleLeftRightIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredLoans.length > 0 && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-xs text-gray-600">
                Page {currentPage} of {totalPages} • {filteredLoans.length} total records
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border ${
                    currentPage === 1
                      ? "text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed"
                      : "text-white"
                  }`}
                  style={currentPage === 1 ? {} : { backgroundColor: "#586ab1", borderColor: "#586ab1" }}
                >
                  <ChevronLeftIcon className="h-3 w-3" />
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {getPageNumbers().map((page, index) => (
                    <button
                      key={index}
                      onClick={() => typeof page === 'number' && goToPage(page)}
                      className={`min-w-[32px] px-2 py-1.5 text-xs font-medium rounded-md border ${
                        page === currentPage
                          ? "text-white border-transparent"
                          : page === '...'
                          ? "text-gray-500 border-transparent cursor-default"
                          : "text-gray-700 bg-white border-gray-300 hover:bg-gray-50"
                      }`}
                      style={page === currentPage ? { backgroundColor: "#586ab1" } : {}}
                      disabled={page === '...'}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border ${
                    currentPage === totalPages
                      ? "text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed"
                      : "text-white"
                  }`}
                  style={currentPage === totalPages ? {} : { backgroundColor: "#586ab1", borderColor: "#586ab1" }}
                >
                  Next
                  <ChevronRightIcon className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllLoans;