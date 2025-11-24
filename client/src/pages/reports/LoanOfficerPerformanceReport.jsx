import React, { useState, useEffect } from "react";
import { Download, Filter, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Search } from "lucide-react";
import { supabase } from "../../supabaseClient";

const LoanOfficerPerformanceReport = () => {
  const [reports, setReports] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loanOfficers, setLoanOfficers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [filters, setFilters] = useState({
    search: "",
    branch: "",
    loanOfficer: "",
    dateRange: "all",
  });

  // Fetch branches and loan officers
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [branchesRes, usersRes] = await Promise.all([
          supabase.from("branches").select("id, name"),
          supabase.from("users").select("id, full_name"),
        ]);
        
        if (branchesRes.error) throw new Error(`Branches error: ${branchesRes.error.message}`);
        if (usersRes.error) throw new Error(`Users error: ${usersRes.error.message}`);
        
        setBranches(branchesRes.data || []);
        setLoanOfficers(usersRes.data || []);
      } catch (error) {
        console.error("Error fetching initial data:", error.message);
      }
    };
    fetchInitialData();
  }, []);

  // Get date range based on filter
  const getDateRange = () => {
    const now = new Date();
    const start = new Date();
    
    switch (filters.dateRange) {
      case "today":
        start.setHours(0, 0, 0, 0);
        return { start: start.toISOString(), end: now.toISOString() };
      
      case "this_week":
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        return { start: start.toDateString(), end: now.toDateString() };
      
      case "this_month":
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        return { start: start.toDateString(), end: now.toDateString() };
      
      case "quarterly":
        const quarter = Math.floor(now.getMonth() / 3);
        start.setMonth(quarter * 3, 1);
        start.setHours(0, 0, 0, 0);
        return { start: start.toDateString(), end: now.toDateString() };
      
      case "yearly":
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        return { start: start.toDateString(), end: now.toDateString() };
      
      default:
        return { start: null, end: null };
    }
  };

  // Calculate PAR (Portfolio at Risk)
  const calculatePAR = (arrearsAmount, outstandingLoan) => {
    if (!outstandingLoan || outstandingLoan === 0) return 0;
    return (arrearsAmount / outstandingLoan) * 100;
  };

  // Fetch data & compute metrics
  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        setLoading(true);
        const dateRange = getDateRange();

        console.log("Fetching data with date range:", filters.dateRange, dateRange);

        // Build loans query based on date range - we'll get all loans and filter in memory
        let loansQuery = supabase
          .from("loans")
          .select(`
            id, 
            booked_by, 
            branch_id, 
            customer_id, 
            status, 
            scored_amount, 
            created_at, 
            disbursed_at, 
            disbursed_date,
            branches!inner (name)
          `);

        // Fetch all data first
        const [loansRes, installmentsRes, paymentsRes, usersRes] = await Promise.all([
          loansQuery,
          supabase.from("loan_installments").select("loan_id, due_date, due_amount, paid_amount, status, days_overdue"),
          supabase.from("loan_payments").select("loan_id, paid_amount, paid_at"),
          supabase.from("users").select("id, full_name"),
        ]);

        // Enhanced error handling
        const errors = [];
        if (loansRes.error) errors.push(`Loans: ${loansRes.error.message}`);
        if (installmentsRes.error) errors.push(`Installments: ${installmentsRes.error.message}`);
        if (paymentsRes.error) errors.push(`Payments: ${paymentsRes.error.message}`);
        if (usersRes.error) errors.push(`Users: ${usersRes.error.message}`);

        if (errors.length > 0) {
          throw new Error(errors.join("; "));
        }

        let loans = loansRes.data || [];
        const installments = installmentsRes.data || [];
        const payments = paymentsRes.data || [];
        const users = usersRes.data || [];

        console.log(`Fetched ${loans.length} loans, ${installments.length} installments, ${users.length} users`);

        // Apply date filtering in memory
        if (dateRange.start && filters.dateRange !== "all") {
          loans = loans.filter(loan => {
            const loanDate = new Date(loan.created_at);
            const startDate = new Date(dateRange.start);
            const endDate = new Date(dateRange.end);
            return loanDate >= startDate && loanDate <= endDate;
          });
          console.log(`Filtered to ${loans.length} loans after date filter`);
        }

        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        // Group loans by officer
        const officerStats = {};

        loans.forEach((loan) => {
          const officer = users.find((u) => u.id === loan.booked_by);
          
          if (!officer) {
            console.warn(`No officer found for loan ${loan.id} with booked_by: ${loan.booked_by}`);
            return;
          }

          const key = `${officer.id}`;
          if (!officerStats[key]) {
            officerStats[key] = {
              branch: loan.branches?.name || "N/A",
              officer: officer.full_name,
              officerId: officer.id,
              loan_due_yesterday_count: 0,
              loan_due_yesterday_amount: 0,
              loan_due_today_count: 0,
              loan_due_today_amount: 0,
              arrears_count: 0,
              arrears_amount: 0,
              outstanding_loan: 0,
              balance_yesterday: 0,
              active_customers: new Set(),
              inactive_customers: new Set(),
              disbursed_loans_count: 0,
              disbursed_loans_amount: 0,
              cleared_loans_count: 0,
              new_loans_count: 0,
              non_refunded_customers_count: 0,
              total_loans: 0,
              par: 0,
            };
          }

          const stat = officerStats[key];
          stat.total_loans++;

          // Disbursed loans - check both status and disbursed_date
          const isDisbursed = loan.status === "disbursed" || loan.disbursed_date || loan.disbursed_at;
          if (isDisbursed) {
            stat.disbursed_loans_count++;
            stat.disbursed_loans_amount += Number(loan.scored_amount) || 0;
          }

          // Cleared loans
          if (loan.status === "cleared") stat.cleared_loans_count++;

          // New loans in date range
          if (dateRange.start && loan.created_at) {
            const loanDate = new Date(loan.created_at);
            const startDate = new Date(dateRange.start);
            const endDate = new Date(dateRange.end);
            if (loanDate >= startDate && loanDate <= endDate) {
              stat.new_loans_count++;
            }
          } else if (!dateRange.start) {
            // If no date filter, count loans created today as new
            if (loan.created_at && new Date(loan.created_at).toDateString() === today.toDateString()) {
              stat.new_loans_count++;
            }
          }

          // Customer tracking
          if (loan.status === "disbursed" || loan.status === "active" || isDisbursed) {
            stat.active_customers.add(loan.customer_id);
          } else {
            stat.inactive_customers.add(loan.customer_id);
          }

          // Installments logic
          const loanInstallments = installments.filter((i) => i.loan_id === loan.id);
          let loanArrears = 0;
          let loanOutstanding = 0;

          loanInstallments.forEach((i) => {
            const dueDate = new Date(i.due_date);
            const dueAmount = Number(i.due_amount) || 0;
            const paidAmount = Number(i.paid_amount) || 0;
            const outstanding = dueAmount - paidAmount;

            if (dueDate.toDateString() === yesterday.toDateString()) {
              stat.loan_due_yesterday_count++;
              stat.loan_due_yesterday_amount += dueAmount;
            }

            if (dueDate.toDateString() === today.toDateString()) {
              stat.loan_due_today_count++;
              stat.loan_due_today_amount += dueAmount;
            }

            // Arrears - consider overdue or with days_overdue
            if (i.status === "overdue" || (i.days_overdue && i.days_overdue > 0)) {
              stat.arrears_count++;
              stat.arrears_amount += outstanding;
              loanArrears += outstanding;
            }

            if (["pending", "partial", "overdue"].includes(i.status)) {
              stat.outstanding_loan += outstanding;
              loanOutstanding += outstanding;
            }

            if (dueDate < yesterday && ["pending", "partial", "overdue"].includes(i.status)) {
              stat.balance_yesterday += outstanding;
            }
          });

          // Calculate PAR for this loan and accumulate
          if (loanOutstanding > 0) {
            const loanPAR = calculatePAR(loanArrears, loanOutstanding);
            // Weighted average PAR across loans
            stat.par = ((stat.par * (stat.total_loans - 1)) + loanPAR) / stat.total_loans;
          }
        });

        // Finalize formatting and calculate final PAR
        const formatted = Object.values(officerStats).map((stat) => {
          // Ensure PAR is calculated correctly for the entire portfolio
          const finalPAR = calculatePAR(stat.arrears_amount, stat.outstanding_loan);
          
          return {
            id: stat.officerId,
            ...stat,
            active_customers: stat.active_customers.size,
            inactive_customers: stat.inactive_customers.size,
            par: finalPAR,
          };
        });

        console.log("Processed officer stats:", formatted);
        setReports(formatted);
        setFiltered(formatted);
      } catch (err) {
        console.error("Error fetching officer performance:", err.message);
        // Set empty arrays to prevent further errors
        setReports([]);
        setFiltered([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [filters.dateRange]);

  // Filtering and sorting
  useEffect(() => {
    let result = [...reports];

    // Search filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((r) =>
        r.officer.toLowerCase().includes(q) ||
        r.branch.toLowerCase().includes(q)
      );
    }

    // Branch filter
    if (filters.branch) {
      result = result.filter((r) => r.branch === filters.branch);
    }

    // Loan officer filter
    if (filters.loanOfficer) {
      result = result.filter((r) => r.id === filters.loanOfficer);
    }

    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    setFiltered(result);
    setCurrentPage(1);
  }, [filters, reports, sortConfig]);

  const handleSort = (key) =>
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

  const SortableHeader = ({ label, sortKey }) => (
    <th
      onClick={() => handleSort(sortKey)}
      className="px-4 py-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors whitespace-nowrap text-left text-sm"
    >
      <div className="flex items-center gap-2">
        {label}
        {sortConfig.key === sortKey && (
          sortConfig.direction === "asc" ? 
            <ChevronUp className="w-4 h-4" /> : 
            <ChevronDown className="w-4 h-4" />
        )}
      </div>
    </th>
  );

  const handleFilterChange = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () =>
    setFilters({ search: "", branch: "", loanOfficer: "", dateRange: "all" });

  const formatCurrency = (num) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);

  const formatPercentage = (num) =>
    `${Math.round(num * 100) / 100}%`;

  const exportToCSV = () => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }

    const dateRangeLabel = filters.dateRange !== "all" ? `_${filters.dateRange}` : "";
    const branchLabel = filters.branch ? `_${filters.branch.replace(/\s+/g, "_")}` : "";
    
    const csv = [
      [
        "No",
        "Branch",
        "Loan Officer",
        "Loans Due Yesterday",
        "Amt Due Yesterday",
        "Loans Due Today",
        "Amt Due Today",
        "Arrears Count",
        "Arrears Amount",
        "Outstanding Loan",
        "PAR %",
        "Balance Yesterday",
        "Active Cust.",
        "Inactive Cust.",
        "Disbursed Loans",
        "Disbursed Amount",
        "Cleared Loans",
        "New Loans",
        "Non-refunded Customers",
        "Total Loans",
      ],
      ...filtered.map((r, i) => [
        i + 1,
        r.branch,
        r.officer,
        r.loan_due_yesterday_count,
        (r.loan_due_yesterday_amount || 0).toFixed(2),
        r.loan_due_today_count,
        (r.loan_due_today_amount || 0).toFixed(2),
        r.arrears_count,
        (r.arrears_amount || 0).toFixed(2),
        (r.outstanding_loan || 0).toFixed(2),
        (r.par || 0).toFixed(2),
        (r.balance_yesterday || 0).toFixed(2),
        r.active_customers,
        r.inactive_customers,
        r.disbursed_loans_count,
        (r.disbursed_loans_amount || 0).toFixed(2),
        r.cleared_loans_count,
        r.new_loans_count,
        r.non_refunded_customers_count,
        r.total_loans,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loan_officer_performance${dateRangeLabel}${branchLabel}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // Get loan officers filtered by selected branch
  const getFilteredLoanOfficers = () => {
    if (filters.branch) {
      // Filter officers based on reports data (officers who have loans in the selected branch)
      const officersInBranch = reports
        .filter(report => report.branch === filters.branch)
        .map(report => ({ id: report.id, full_name: report.officer }));
      
      // Remove duplicates
      return officersInBranch.filter((officer, index, self) => 
        index === self.findIndex(o => o.id === officer.id)
      );
    }
    // If no branch selected, return all unique officers from reports
    const allOfficers = reports.map(report => ({ id: report.id, full_name: report.officer }));
    return allOfficers.filter((officer, index, self) => 
      index === self.findIndex(o => o.id === officer.id)
    );
  };

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const currentData = filtered.slice(startIdx, endIdx);

  // Totals
  const totals = {
    disbursedLoans: filtered.reduce((sum, r) => sum + r.disbursed_loans_count, 0),
    disbursedAmount: filtered.reduce((sum, r) => sum + (r.disbursed_loans_amount || 0), 0),
    activeCustomers: filtered.reduce((sum, r) => sum + r.active_customers, 0),
    arrearsAmount: filtered.reduce((sum, r) => sum + (r.arrears_amount || 0), 0),
    outstandingLoan: filtered.reduce((sum, r) => sum + (r.outstanding_loan || 0), 0),
  };

  // Calculate overall PAR
  const overallPAR = calculatePAR(totals.arrearsAmount, totals.outstandingLoan);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Loan Officer Performance Report</h1>
            <p className="text-sm text-gray-600 mt-1">
              Track performance metrics and productivity of loan officers
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all ${
                showFilters
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>

            <button
              onClick={exportToCSV}
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">Filter Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by officer name or branch..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={filters.branch}
              onChange={(e) => {
                handleFilterChange("branch", e.target.value);
                handleFilterChange("loanOfficer", ""); // Reset loan officer when branch changes
              }}
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={filters.loanOfficer}
              onChange={(e) => handleFilterChange("loanOfficer", e.target.value)}
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Loan Officers</option>
              {getFilteredLoanOfficers().map((officer) => (
                <option key={officer.id} value={officer.id}>
                  {officer.full_name}
                </option>
              ))}
            </select>

            <select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange("dateRange", e.target.value)}
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          {(filters.search || filters.branch || filters.loanOfficer || filters.dateRange !== "all") && (
            <button
              onClick={clearFilters}
              className="text-red-600 text-sm font-medium flex items-center gap-1 mt-2 hover:text-red-700"
            >
              <X className="w-4 h-4" /> Clear Filters
            </button>
          )}
        </div>
      )}
{/* 
      Data Summary
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Total Officers</p>
          <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Disbursed Loans</p>
          <p className="text-2xl font-bold text-blue-600">{totals.disbursedLoans}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Total Disbursed</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.disbursedAmount)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Total Arrears</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.arrearsAmount)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Portfolio at Risk</p>
          <p className="text-2xl font-bold text-orange-600">{formatPercentage(overallPAR)}</p>
        </div>
      </div> */}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Loading performance data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No data available. {reports.length === 0 ? "Please check if loans have valid booked_by values and there are no connection issues." : "No results match your filters."}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b border-gray-200 sticky text-sm top-0">
                  <tr>
                    <th className="px-4 py-4 font-semibold text-gray-700 text-left whitespace-nowrap">#</th>
                    <SortableHeader label="Branch" sortKey="branch" />
                    <SortableHeader label="Loan Officer" sortKey="officer" />
                    <SortableHeader label="Due Yesterday (Cnt)" sortKey="loan_due_yesterday_count" />
                    <SortableHeader label="Due Yesterday (Amt)" sortKey="loan_due_yesterday_amount" />
                    <SortableHeader label="Due Today (Cnt)" sortKey="loan_due_today_count" />
                    <SortableHeader label="Due Today (Amt)" sortKey="loan_due_today_amount" />
                    <SortableHeader label="Arrears (Cnt)" sortKey="arrears_count" />
                    <SortableHeader label="Arrears (Amt)" sortKey="arrears_amount" />
                    <SortableHeader label="Outstanding" sortKey="outstanding_loan" />
                    <SortableHeader label="PAR %" sortKey="par" />
                    <SortableHeader label="Balance Yesterday" sortKey="balance_yesterday" />
                    <SortableHeader label="Active Cust." sortKey="active_customers" />
                    <SortableHeader label="Inactive Cust." sortKey="inactive_customers" />
                    <SortableHeader label="Disbursed (Cnt)" sortKey="disbursed_loans_count" />
                    <SortableHeader label="Disbursed (Amt)" sortKey="disbursed_loans_amount" />
                    <SortableHeader label="Cleared" sortKey="cleared_loans_count" />
                    <SortableHeader label="New Loans" sortKey="new_loans_count" />
                    <SortableHeader label="Total Loans" sortKey="total_loans" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {currentData.map((r, i) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors text-sm">
                      <td className="px-4 py-4 text-gray-900 font-medium whitespace-nowrap">{startIdx + i + 1}</td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">{r.branch}</td>
                      <td className="px-4 py-4 text-gray-900 font-medium whitespace-nowrap">{r.officer}</td>
                      <td className="px-4 py-4 text-center text-gray-700 whitespace-nowrap">{r.loan_due_yesterday_count}</td>
                      <td className="px-4 py-4 text-right text-gray-900 whitespace-nowrap">{formatCurrency(r.loan_due_yesterday_amount)}</td>
                      <td className="px-4 py-4 text-center text-gray-700 whitespace-nowrap">{r.loan_due_today_count}</td>
                      <td className="px-4 py-4 text-right text-gray-900 whitespace-nowrap">{formatCurrency(r.loan_due_today_amount)}</td>
                      <td className="px-4 py-4 text-center text-red-700 font-semibold whitespace-nowrap">{r.arrears_count}</td>
                      <td className="px-4 py-4 text-right text-red-700 font-semibold whitespace-nowrap">{formatCurrency(r.arrears_amount)}</td>
                      <td className="px-4 py-4 text-right text-orange-600 font-semibold whitespace-nowrap">{formatCurrency(r.outstanding_loan)}</td>
                      <td className="px-4 py-4 text-right text-purple-700 font-semibold whitespace-nowrap">
                        {formatPercentage(r.par || 0)}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-900 whitespace-nowrap">{formatCurrency(r.balance_yesterday)}</td>
                      <td className="px-4 py-4 text-center text-green-700 font-semibold whitespace-nowrap">{r.active_customers}</td>
                      <td className="px-4 py-4 text-center text-gray-700 whitespace-nowrap">{r.inactive_customers}</td>
                      <td className="px-4 py-4 text-center text-blue-700 font-semibold whitespace-nowrap">{r.disbursed_loans_count}</td>
                      <td className="px-4 py-4 text-right text-blue-700 font-semibold whitespace-nowrap">{formatCurrency(r.disbursed_loans_amount)}</td>
                      <td className="px-4 py-4 text-center text-green-700 whitespace-nowrap">{r.cleared_loans_count}</td>
                      <td className="px-4 py-4 text-center text-purple-700 font-semibold whitespace-nowrap">{r.new_loans_count}</td>
                      <td className="px-4 py-4 text-center text-gray-900 font-semibold whitespace-nowrap">{r.total_loans}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{startIdx + 1}</span> to{' '}
                <span className="font-semibold">{Math.min(endIdx, filtered.length)}</span> of{' '}
                <span className="font-semibold">{filtered.length}</span> officers
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-colors ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
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
                        className={`px-3 py-2 rounded-lg transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-colors ${
                    currentPage === totalPages
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoanOfficerPerformanceReport;