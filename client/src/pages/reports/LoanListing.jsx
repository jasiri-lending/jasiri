import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Download,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Search,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../../supabaseClient";

const LoanListing = () => {
  const [loans, setLoans] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [statusTypes, setStatusTypes] = useState([]);
  const [repaymentStates, setRepaymentStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // Changed to 50 per page
  const [sortConfig, setSortConfig] = useState({ key: "booked_date", direction: "desc" });
  const [filters, setFilters] = useState({
    search: "",
    branch: "",
    loanOfficer: "",
    productType: "all",
    status: "all",
    repaymentState: "all",
  });

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .order("name");
      if (!error && data) setBranches(data);
    };
    fetchBranches();
  }, []);

  // Fetch all loans with installments data
  const fetchAllLoans = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      
      // Fetch all relevant data in parallel
      const [
        loansRes,
        customersRes,
        usersRes,
        branchesRes,
        installmentsRes
      ] = await Promise.all([
        supabase
          .from("loans")
          .select(`
            id,
            customer_id,
            branch_id,
            booked_by,
            product_name,
            product_type,
            status,
            repayment_state,
            total_payable,
            duration_weeks,
            interest_rate,
            disbursed_at,
            booked_at,
            processing_fee,
            registration_fee,
            weekly_payment,
            approved_by_bm,
            approved_by_bm_at,
            approved_by_rm,
            approved_by_rm_at,
            bm_decision,
            rm_decision,
            scored_amount,
            prequalified_amount
          `)
          .order("booked_at", { ascending: false }),

        supabase
          .from("customers")
          .select("id, Firstname, Middlename, Surname, id_number, mobile"),

        supabase
          .from("users")
          .select("id, full_name"),

        supabase
          .from("branches")
          .select("id, name"),

        supabase
          .from("loan_installments")
          .select("loan_id, paid_amount, due_amount, status")
      ]);

      // Error checking
      if (
        loansRes.error ||
        customersRes.error ||
        usersRes.error ||
        branchesRes.error ||
        installmentsRes.error
      ) {
        console.error("Fetch errors:", {
          loans: loansRes.error,
          customers: customersRes.error,
          users: usersRes.error,
          branches: branchesRes.error,
          installments: installmentsRes.error
        });
        throw new Error("Error fetching one or more tables.");
      }

      const loansData = loansRes.data || [];
      const customers = customersRes.data || [];
      const users = usersRes.data || [];
      const branchesData = branchesRes.data || [];
      const installmentsData = installmentsRes.data || [];

      const processedLoans = loansData.map((loan) => {
        const customer = customers.find((c) => c.id === loan.customer_id);
        const branch = branchesData.find((b) => b.id === loan.branch_id);
        const loanOfficer = users.find((u) => u.id === loan.booked_by);
        const branchManager = users.find((u) => u.id === loan.approved_by_bm);
        const regionManager = users.find((u) => u.id === loan.approved_by_rm);

        // Calculate total repaid from loan_installments
        const loanInstallments = installmentsData.filter((inst) => inst.loan_id === loan.id);
        const totalRepaid = loanInstallments.reduce((sum, inst) => {
          return sum + (Number(inst.paid_amount) || 0);
        }, 0);

        // Calculate total due from loan_installments
        const totalDue = loanInstallments.reduce((sum, inst) => {
          return sum + (Number(inst.due_amount) || 0);
        }, 0);

        // Calculate overdue installments
        const overdueInstallments = loanInstallments.filter(
          (inst) => inst.status === 'overdue' || inst.status === 'defaulted'
        ).length;

        const customerName = customer
          ? `${customer.Firstname || ""} ${customer.Middlename || ""} ${
              customer.Surname || ""
            }`.trim()
          : "N/A";

        // CHANGED: Get prequalified amount directly from loans table
        const prequalifiedAmount = Number(loan.prequalified_amount) || 0;

        // CHANGED: Get disbursed amount from loan.scored_amount field
        const disbursedAmount = Number(loan.scored_amount) || 0;

        // Calculate days difference
        const bookedDate = loan.booked_at ? new Date(loan.booked_at) : null;
        const disbursedDate = loan.disbursed_at ? new Date(loan.disbursed_at) : null;
        const bmApprovedDate = loan.approved_by_bm_at ? new Date(loan.approved_by_bm_at) : null;
        const rmApprovedDate = loan.approved_by_rm_at ? new Date(loan.approved_by_rm_at) : null;
        
        const now = new Date();
        const daysSinceBooking = bookedDate ? Math.floor((now - bookedDate) / (1000 * 60 * 60 * 24)) : 0;
        const daysSinceDisbursement = disbursedDate ? Math.floor((now - disbursedDate) / (1000 * 60 * 60 * 24)) : null;
        const daysSinceBMApproval = bmApprovedDate ? Math.floor((now - bmApprovedDate) / (1000 * 60 * 60 * 24)) : null;
        const daysSinceRMApproval = rmApprovedDate ? Math.floor((now - rmApprovedDate) / (1000 * 60 * 60 * 24)) : null;

        return {
          id: loan.id,
          customer_name: customerName,
          customer_id: customer?.id_number || "N/A",
          mobile: customer?.mobile || "N/A",
          branch: branch?.name || "N/A",
          loan_officer: loanOfficer?.full_name || "N/A",
          branch_manager: branchManager?.full_name || "N/A",
          region_manager: regionManager?.full_name || "N/A",
          loan_product: loan.product_name || "N/A",
          product_type: loan.product_type || "N/A",
          applied_amount: prequalifiedAmount, // CHANGED: Now using prequalified_amount from loans table
          disbursed_amount: disbursedAmount, // CHANGED: Now using scored_amount from loans table
          total_repaid: totalRepaid,
          total_payable: Number(loan.total_payable) || 0,
          weekly_payment: Number(loan.weekly_payment) || 0,
          duration_weeks: loan.duration_weeks || 0,
          interest_rate: Number(loan.interest_rate) || 0,
          booked_date: loan.booked_at,
          disbursed_date: loan.disbursed_at,
          status: loan.status || "N/A",
          repayment_state: loan.repayment_state || "N/A",
          total_due: totalDue,
          overdue_installments: overdueInstallments,
          total_installments: loanInstallments.length,
          // For export
          processing_fee: Number(loan.processing_fee) || 0,
          registration_fee: Number(loan.registration_fee) || 0,
          net_disbursement: disbursedAmount - (Number(loan.processing_fee) || 0) - (Number(loan.registration_fee) || 0),
          bm_approved_date: loan.approved_by_bm_at,
          rm_approved_date: loan.approved_by_rm_at,
          days_since_booking: daysSinceBooking,
          days_since_disbursement: daysSinceDisbursement,
          days_since_bm_approval: daysSinceBMApproval,
          days_since_rm_approval: daysSinceRMApproval,
          bm_decision: loan.bm_decision || "N/A",
          rm_decision: loan.rm_decision || "N/A",
        };
      });

      setLoans(processedLoans);
      setFiltered(processedLoans);

      // Generate unique filter options
      const uniqueOfficers = [...new Set(processedLoans.map((r) => r.loan_officer).filter((o) => o !== "N/A"))];
      const uniqueProductTypes = [...new Set(processedLoans.map((r) => r.product_type).filter(Boolean))];
      const uniqueStatusTypes = [...new Set(processedLoans.map((r) => r.status).filter(Boolean))];
      const uniqueRepaymentStates = [...new Set(processedLoans.map((r) => r.repayment_state).filter(Boolean))];
      
      setOfficers(uniqueOfficers);
      setProductTypes(uniqueProductTypes);
      setStatusTypes(uniqueStatusTypes);
      setRepaymentStates(uniqueRepaymentStates);
    } catch (err) {
      console.error("Error fetching loan listings:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllLoans();
  }, [fetchAllLoans]);

  // Filtering logic
  useEffect(() => {
    if (loading) return;

    let result = [...loans];
    const { search, branch, loanOfficer, productType, status, repaymentState } = filters;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.customer_name.toLowerCase().includes(q) ||
          r.mobile.includes(q) ||
          r.customer_id.includes(q)
      );
    }

    if (branch) {
      result = result.filter((r) => r.branch === branch);
    }

    if (loanOfficer) {
      result = result.filter((r) => r.loan_officer === loanOfficer);
    }

    if (productType !== "all") {
      result = result.filter((r) => r.product_type === productType);
    }

    if (status !== "all") {
      result = result.filter((r) => r.status === status);
    }

    if (repaymentState !== "all") {
      result = result.filter(
        (r) => r.repayment_state === repaymentState
      );
    }

    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortConfig.direction === "asc" 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    setFiltered(result);
    setCurrentPage(1);
  }, [filters, loans, sortConfig, loading]);

  // Sorting handler
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Sortable Header Component
  const SortableHeader = useCallback(({ label, sortKey }) => (
    <th
      onClick={() => handleSort(sortKey)}
      className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-50 whitespace-nowrap text-left text-xs tracking-wider border-b"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium" style={{ color: "#586ab1" }}>{label}</span>
        {sortConfig.key === sortKey &&
          (sortConfig.direction === "asc" ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          ))}
      </div>
    </th>
  ), [sortConfig, handleSort]);

  // Filter handlers
  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      branch: "",
      loanOfficer: "",
      productType: "all",
      status: "all",
      repaymentState: "all",
    });
  }, []);

  // Currency formatter
  const formatCurrency = useCallback((num) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);
  }, []);

  // Date formatter
  const formatDate = useCallback((dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-KE", {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  // CSV Export
  const exportToCSV = useCallback(() => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }

    const csv = [
      [
        "No",
        "Customer Name",
        "ID Number",
        "Mobile",
        "Branch",
        "Loan Officer",
        "Branch Manager",
        "Region Manager",
        "Loan Product",
        "Product Type",
        "Prequalified Amount", // CHANGED: Label updated
        "Processing Fee",
        "Registration Fee",
        "Disbursed Amount", // CHANGED: Label updated
        "Net Disbursement",
        "Total Payable",
        "Total Due",
        "Total Repaid",
        "Weekly Payment",
        "Duration (Weeks)",
        "Interest Rate (%)",
        "Booked Date",
        "Disbursed Date",
        "BM Approved Date",
        "RM Approved Date",
        "Days Since Booking",
        "Days Since Disbursement",
        "Days Since BM Approval",
        "Days Since RM Approval",
        "BM Decision",
        "RM Decision",
        "Status",
        "Repayment State",
        "Total Installments",
        "Overdue Installments",
      ],
      ...filtered.map((r, i) => [
        i + 1,
        `"${r.customer_name}"`,
        r.customer_id,
        r.mobile,
        r.branch,
        r.loan_officer,
        r.branch_manager,
        r.region_manager,
        r.loan_product,
        r.product_type,
        r.applied_amount.toFixed(2), // This now contains prequalified amount
        r.processing_fee.toFixed(2),
        r.registration_fee.toFixed(2),
        r.disbursed_amount.toFixed(2), // This now contains scored amount
        r.net_disbursement.toFixed(2),
        r.total_payable.toFixed(2),
        r.total_due.toFixed(2),
        r.total_repaid.toFixed(2),
        r.weekly_payment.toFixed(2),
        r.duration_weeks,
        r.interest_rate.toFixed(2),
        formatDate(r.booked_date),
        r.disbursed_date ? formatDate(r.disbursed_date) : "N/A",
        r.bm_approved_date ? formatDate(r.bm_approved_date) : "N/A",
        r.rm_approved_date ? formatDate(r.rm_approved_date) : "N/A",
        r.days_since_booking,
        r.days_since_disbursement || "N/A",
        r.days_since_bm_approval || "N/A",
        r.days_since_rm_approval || "N/A",
        r.bm_decision,
        r.rm_decision,
        r.status,
        r.repayment_state,
        r.total_installments,
        r.overdue_installments,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loan_listing_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filtered, formatDate]);

  // Status badge component
  const getStatusBadge = useCallback((status) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    
    switch (status?.toLowerCase()) {
      case "disbursed":
      case "completed":
      case "paid":
      case "current":
        return `${baseClasses} bg-emerald-100 text-emerald-800 border border-emerald-200`;
      case "approved":
        return `${baseClasses} bg-blue-100 text-blue-800 border border-blue-200`;
      case "pending":
      case "ca_review":
      case "processing":
        return `${baseClasses} bg-amber-100 text-amber-800 border border-amber-200`;
      case "rejected":
      case "defaulted":
      case "overdue":
        return `${baseClasses} bg-red-100 text-red-800 border border-red-200`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 border border-gray-200`;
    }
  }, []);

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, filtered.length);
  const currentData = filtered.slice(startIdx, endIdx);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalLoans = filtered.length;
    const totalPrincipal = filtered.reduce((sum, r) => sum + (r.disbursed_amount || 0), 0);
    const totalPayable = filtered.reduce((sum, r) => sum + (r.total_payable || 0), 0);
    const totalRepaid = filtered.reduce((sum, r) => sum + (r.total_repaid || 0), 0);
    const totalDue = filtered.reduce((sum, r) => sum + (r.total_due || 0), 0);
    const totalOutstanding = totalPayable - totalRepaid;
    
    // Count by status
    const activeLoans = filtered.filter(r => 
      r.status.toLowerCase() === 'disbursed' || 
      r.repayment_state.toLowerCase() === 'current'
    ).length;
    
    const overdueLoans = filtered.filter(r => 
      r.repayment_state.toLowerCase() === 'overdue' || 
      r.repayment_state.toLowerCase() === 'defaulted'
    ).length;

    return {
      totalLoans,
      totalPrincipal,
      totalPayable,
      totalRepaid,
      totalDue,
      totalOutstanding,
      activeLoans,
      overdueLoans
    };
  }, [filtered]);

  // Pagination controls component
  const PaginationControls = useCallback(() => (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 rounded-b-lg">
      <div className="text-xs text-gray-600">
        Showing <span className="font-semibold">{startIdx + 1}</span> to{" "}
        <span className="font-semibold">{endIdx}</span> of{" "}
        <span className="font-semibold">{filtered.length}</span> entries
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="p-1.5 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-8 h-8 rounded text-xs transition-colors ${
                  currentPage === pageNum
                    ? "bg-blue-600 text-white"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  ), [startIdx, endIdx, filtered.length, totalPages, currentPage]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-3 md:p-4">
      {/* HEADER */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#586ab1" }}>Complete Loan Listing</h1>
            <p className="text-sm text-gray-600">Comprehensive view of all loans in the system</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fetchAllLoans(true)}
              disabled={refreshing}
              className="px-3 py-1.5 bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-sm font-medium transition-colors ${
                showFilters
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>Filters</span>
              {Object.values(filters).some(val => val && val !== "all") && (
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </button>

            <button
              onClick={exportToCSV}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow border border-white/20">
            <p className="text-xs font-medium text-gray-600 mb-1">Total Loans</p>
            <p className="text-base font-bold text-blue-700">{stats.totalLoans}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow border border-white/20">
            <p className="text-xs font-medium text-gray-600 mb-1">Total Disbursed</p>
            <p className="text-base font-bold text-purple-700">{formatCurrency(stats.totalPrincipal)}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow border border-white/20">
            <p className="text-xs font-medium text-gray-600 mb-1">Total Payable</p>
            <p className="text-base font-bold text-gray-900">{formatCurrency(stats.totalPayable)}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow border border-white/20">
            <p className="text-xs font-medium text-gray-600 mb-1">Total Repaid</p>
            <p className="text-base font-bold text-emerald-700">{formatCurrency(stats.totalRepaid)}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow border border-white/20">
            <p className="text-xs font-medium text-gray-600 mb-1">Outstanding Balance</p>
            <p className="text-base font-bold text-red-600">{formatCurrency(stats.totalOutstanding)}</p>
          </div>
        </div>
      </div>

      {/* FILTER PANEL */}
      {showFilters && (
        <div className="mb-4 bg-white/80 backdrop-blur-sm rounded-lg border border-white/20 p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Filter Loans</h3>
            <button
              onClick={clearFilters}
              className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear all
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by customer, ID, mobile..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="pl-7 w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Branch</label>
              <select
                value={filters.branch}
                onChange={(e) => handleFilterChange("branch", e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Loan Officer */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Loan Officer</label>
              <select
                value={filters.loanOfficer}
                onChange={(e) => handleFilterChange("loanOfficer", e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="">All Officers</option>
                {officers.map((officer) => (
                  <option key={officer} value={officer}>
                    {officer}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Type */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Product Type</label>
              <select
                value={filters.productType}
                onChange={(e) => handleFilterChange("productType", e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="all">All Products</option>
                {productTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="all">All Statuses</option>
                {statusTypes.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {/* Repayment State */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Repayment State</label>
              <select
                value={filters.repaymentState}
                onChange={(e) => handleFilterChange("repaymentState", e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="all">All States</option>
                {repaymentStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* TABLE WITH PAGINATION */}
      <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-white/20 shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-xs font-medium tracking-wider whitespace-nowrap text-[#586ab1]">#</th>
                <SortableHeader label="Customer Name" sortKey="customer_name" />
                <SortableHeader label="ID Number" sortKey="customer_id" />
                <SortableHeader label="Mobile" sortKey="mobile" />
                <SortableHeader label="Branch" sortKey="branch" />
                <SortableHeader label="Loan Officer" sortKey="loan_officer" />
                <SortableHeader label="Product" sortKey="loan_product" />
                <SortableHeader label="Type" sortKey="product_type" />
                <SortableHeader label="Prequalified Amount" sortKey="applied_amount" />
                <SortableHeader label="Disbursed Amount" sortKey="disbursed_amount" />
                <SortableHeader label="Total Payable" sortKey="total_payable" />
                <SortableHeader label="Total Repaid" sortKey="total_repaid" />
                <SortableHeader label="Weekly Payment" sortKey="weekly_payment" />
                <SortableHeader label="Duration" sortKey="duration_weeks" />
                <SortableHeader label="Interest" sortKey="interest_rate" />
                <SortableHeader label="Booked Date" sortKey="booked_date" />
                <SortableHeader label="Disbursed Date" sortKey="disbursed_date" />
                <SortableHeader label="Status" sortKey="status" />
                <SortableHeader label="Repayment State" sortKey="repayment_state" />
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={19} className="px-4 py-12 text-center">
                    <div className="flex justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Loading loan listings...</p>
                  </td>
                </tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan={19} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="w-12 h-12 text-gray-400 mb-3" />
                      <p className="text-sm text-gray-500">No loans found</p>
                      {Object.values(filters).some(val => val && val !== "all") && (
                        <button
                          onClick={clearFilters}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                        >
                          Clear filters to see all loans
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                currentData.map((loan, i) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{startIdx + i + 1}</td>
                    
                    {/* Customer Name */}
                    <td className="px-4 py-3 text-xs text-gray-700 font-medium min-w-[150px] max-w-xs break-words">
                      {loan.customer_name}
                    </td>

                    {/* ID Number */}
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{loan.customer_id}</td>

                    {/* Mobile */}
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap w-36">{loan.mobile}</td>

                    {/* Branch */}
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{loan.branch}</td>

                    {/* Loan Officer */}
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{loan.loan_officer}</td>

                    {/* Product */}
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{loan.loan_product}</td>

                    {/* Type */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                        {loan.product_type}
                      </span>
                    </td>

                    {/* Prequalified Amount */}
                    <td className="px-4 py-3 text-right text-xs font-semibold text-gray-900 whitespace-nowrap">
                      {formatCurrency(loan.applied_amount)}
                    </td>

                    {/* Disbursed Amount */}
                    <td className="px-4 py-3 text-right text-xs font-semibold text-green-700 whitespace-nowrap">
                      {formatCurrency(loan.disbursed_amount)}
                    </td>

                    {/* Total Payable */}
                    <td className="px-4 py-3 text-right text-xs font-semibold text-gray-900 whitespace-nowrap">
                      {formatCurrency(loan.total_payable)}
                    </td>

                    {/* Total Repaid */}
                    <td className="px-4 py-3 text-right text-xs font-semibold text-emerald-700 whitespace-nowrap">
                      {formatCurrency(loan.total_repaid)}
                    </td>

                    {/* Weekly Payment */}
                    <td className="px-4 py-3 text-right text-xs text-gray-700 whitespace-nowrap">
                      {formatCurrency(loan.weekly_payment)}
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3 text-center text-xs text-gray-700 whitespace-nowrap">
                      {loan.duration_weeks} weeks
                    </td>

                    {/* Interest */}
                    <td className="px-4 py-3 text-center text-xs text-gray-700 whitespace-nowrap">
                      {loan.interest_rate.toFixed(2)}%
                    </td>

                    {/* Booked Date */}
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {formatDate(loan.booked_date)}
                    </td>

                    {/* Disbursed Date */}
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {loan.disbursed_date ? formatDate(loan.disbursed_date) : "Pending"}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={getStatusBadge(loan.status)}>
                        {loan.status.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Repayment State */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={getStatusBadge(loan.repayment_state)}>
                        {loan.repayment_state.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan="8" className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
                  Totals ({filtered.length} loans):
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-gray-700 text-right">
                  {formatCurrency(stats.totalPrincipal)}
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-gray-700 text-right">
                  {formatCurrency(stats.totalPayable)}
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-emerald-700 text-right">
                  {formatCurrency(stats.totalRepaid)}
                </td>
                <td colSpan="7" className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        {/* PAGINATION */}
        {filtered.length > itemsPerPage && (
          <PaginationControls />
        )}
      </div>
    </div>
  );
};

export default LoanListing;