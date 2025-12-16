import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
  EyeIcon,
  CalendarIcon,
  ClockIcon,
  BuildingOfficeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import Spinner from "../../components/Spinner";

const LoanPendingDisbursement = () => {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [loans, setLoans] = useState([]);
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [branchFilter, setBranchFilter] = useState("all");
  const [branches, setBranches] = useState({});

  // Use refs to track if data has been loaded
  const hasLoadedRef = useRef(false);
  const profileIdRef = useRef(null);

  const isCreditAnalyst = profile?.role === "credit_analyst_officer";

  // Memoized fetch functions
  const fetchBranches = useCallback(async () => {
    if (!profile) return;
    
    try {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .order("name");
      if (error) throw error;
      
      const branchesMap = {};
      data?.forEach(branch => {
        branchesMap[branch.id] = branch.name;
      });
      setBranches(branchesMap);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  }, [profile]);

  const fetchPendingDisbursementLoans = useCallback(async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
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
              region_id
            )
          )
        `)
        .eq('status', 'ca_review')
        .order('created_at', { ascending: false });

      // Filter by branch for branch managers
      if (profile?.role === "branch_manager" && profile?.branch_id) {
        query = query.eq('branch_id', profile.branch_id);
      }
      // Filter by region for regional level roles
      else if (profile?.region_id && profile?.role !== "branch_manager") {
        const { data: branchesInRegion } = await supabase
          .from("branches")
          .select("id")
          .eq("region_id", profile.region_id);
        
        const branchIds = branchesInRegion?.map(b => b.id) || [];
        if (branchIds.length > 0) {
          query = query.in("branch_id", branchIds);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      setLoans(data || []);
      setFilteredLoans(data || []);
    } catch (error) {
      console.error("Error fetching pending disbursement loans:", error);
      toast.error("Failed to load loans");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // Load data only once when profile becomes available
  useEffect(() => {
    if (profile && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      profileIdRef.current = profile.id;
      
      // Fetch both branches and loans in parallel
      Promise.all([fetchBranches(), fetchPendingDisbursementLoans()]);
    }
    
    // If profile changes (user switches accounts), reload
    if (profile && profileIdRef.current !== profile.id) {
      hasLoadedRef.current = false;
      profileIdRef.current = profile.id;
      Promise.all([fetchBranches(), fetchPendingDisbursementLoans()]);
    }
  }, [profile, fetchBranches, fetchPendingDisbursementLoans]);

  // Memoized filter function
  const filterLoans = useCallback(() => {
    let filtered = loans;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((loan) => {
        const loanId = loan.id?.toString().toLowerCase() || "";
        const firstName = loan.customers?.Firstname?.toLowerCase() || "";
        const surname = loan.customers?.Surname?.toLowerCase() || "";
        const fullName = `${firstName} ${surname}`;
        const mobile = loan.customers?.mobile?.toLowerCase() || "";
        const idNumber = loan.customers?.id_number?.toLowerCase() || "";
        
        return (
          loanId.includes(search) ||
          firstName.includes(search) ||
          surname.includes(search) ||
          fullName.includes(search) ||
          mobile.includes(search) ||
          idNumber.includes(search)
        );
      });
    }

    if (branchFilter !== "all") {
      filtered = filtered.filter((loan) => 
        loan.branch_id?.toString() === branchFilter
      );
    }

    setFilteredLoans(filtered);
    setCurrentPage(1);
  }, [loans, searchTerm, branchFilter]);

  // Apply filters when dependencies change
  useEffect(() => {
    filterLoans();
  }, [filterLoans]);

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLoans = filteredLoans.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  }, [currentPage, totalPages]);

  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  }, [currentPage]);

  const goToPage = useCallback((pageNumber) => {
    setCurrentPage(pageNumber);
  }, []);

  const getPageNumbers = useCallback(() => {
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
  }, [currentPage, totalPages]);

  const handleViewLoan = useCallback((loanId) => {
    navigate(`/view-disbursed-loans/${loanId}`);
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    fetchPendingDisbursementLoans();
    fetchBranches();
  }, [fetchPendingDisbursementLoans, fetchBranches]);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setBranchFilter("all");
    setCurrentPage(1);
  }, []);

  if (authLoading || loading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
        <Spinner text="Loading pending disbursements..." />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Loans Pending Disbursement
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
                placeholder="Search by loan ID, customer name, ID number, or mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-gray-300 rounded-md pl-8 pr-3 py-1.5 w-full text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {!isCreditAnalyst && (
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-colors border ${
                    showFilters ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <FunnelIcon className="h-4 w-4" />
                  Filters
                </button>
              )}
              
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
          {showFilters && !isCreditAnalyst && (
            <>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Branch Filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Branch
                    </label>
                    <select
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Branches</option>
                      {Object.entries(branches).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Active Filters */}
                {(searchTerm || branchFilter !== "all") && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-gray-600">Active filters:</span>
                      {branchFilter !== "all" && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          Branch: {branches[branchFilter]}
                          <button onClick={() => setBranchFilter("all")} className="ml-1">
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {searchTerm && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          Search: {searchTerm}
                          <button onClick={() => setSearchTerm("")} className="ml-1">
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
              </div>
            </>
          )}

          {/* Results Info */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-gray-600">
              {filteredLoans.length} pending loan{filteredLoans.length !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-gradient-to-r from-green-100 to-emerald-100 border border-green-200">
              <ClockIcon className="h-3 w-3 text-green-600" />
              <span className="font-medium text-xs text-green-700">
                {filteredLoans.length} Ready for Disbursement
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <thead>
              <tr style={{ backgroundColor: "#fff" }}>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Loan ID</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Customer</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">ID Number</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Mobile</th>
                {!isCreditAnalyst && (
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Branch</th>
                )}
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">Product</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600 whitespace-nowrap">Amount</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Weeks</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Status</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={isCreditAnalyst ? 10 : 11} className="px-6 py-12 text-center">
                    <div className="text-center">
                      <CheckCircleIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-sm font-medium text-gray-900 mb-2">
                        {searchTerm || branchFilter !== "all" ? "No loans found" : "No Pending Disbursements"}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {searchTerm || branchFilter !== "all"
                          ? "Try adjusting your filters or search criteria."
                          : isCreditAnalyst
                          ? "All loans have been disbursed. Great work!"
                          : "There are no loans pending disbursement in your area."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentLoans.map((loan) => (
                  <tr key={loan.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3 text-gray-400" />
                        {new Date(loan.created_at).toLocaleDateString("en-GB")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                      <span className="font-mono">#{loan.id}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {loan.customers?.Firstname} {loan.customers?.Surname}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {loan.customers?.id_number || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {loan.customers?.mobile || 'N/A'}
                    </td>
                    {!isCreditAnalyst && (
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {loan.customers?.branches?.name || 'N/A'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span>{loan.product_name || 'N/A'}</span>
                        {loan.is_new_loan && (
                          <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            New Customer
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 text-right whitespace-nowrap">
                      <div className="font-medium text-emerald-600">
                        KES {loan.scored_amount?.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        Weekly: KES {loan.weekly_payment?.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {loan.duration_weeks || "N/A"} weeks
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                        Ready for Disbursement
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewLoan(loan.id)}
                          className="px-3 py-1.5 text-xs font-medium rounded-md transition"
                          style={{ 
                            backgroundColor: "#586ab1",
                            color: "white",
                            borderColor: "#586ab1"
                          }}
                        >
                          <EyeIcon className="h-4 w-4 inline mr-1" />
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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

export default LoanPendingDisbursement;