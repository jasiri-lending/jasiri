import React, { useState, useEffect } from "react";
import { Download, Filter, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Search } from "lucide-react";
import { supabase } from "../../supabaseClient";

const NonPerformingLoansReport = () => {
  const [reports, setReports] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [filters, setFilters] = useState({
    search: "",
    branch: "",
    loanOfficer: "",
    status: "all",
  });

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase.from("branches").select("id, name");
      if (!error) setBranches(data);
    };
    fetchBranches();
  }, []);

  // Fetch data & compute metrics
  useEffect(() => {
    const fetchNonPerformingLoans = async () => {
      try {
        setLoading(true);

        const [loansRes, installmentsRes, paymentsRes, customersRes, usersRes, branchesRes] = await Promise.all([
          supabase
            .from("loans")
            .select("id, customer_id, booked_by, branch_id, product_name, scored_amount, disbursed_at, status, repayment_state, duration_weeks, total_interest, total_payable, weekly_payment")
            .in("repayment_state", ["overdue", "defaulted"]),
          supabase.from("loan_installments").select("loan_id, installment_number, due_date, due_amount, principal_amount, interest_amount, paid_amount, status, days_overdue"),
          supabase.from("loan_payments").select("loan_id, paid_amount, paid_at"),
          supabase.from("customers").select("id, Firstname, Middlename, Surname, id_number, mobile"),
          supabase.from("users").select("id, full_name"),
          supabase.from("branches").select("id, name"),
        ]);

        if (loansRes.error || installmentsRes.error || paymentsRes.error || customersRes.error || usersRes.error || branchesRes.error) {
          throw new Error("Error fetching one or more tables.");
        }

        const loans = loansRes.data || [];
        const installments = installmentsRes.data || [];
        const payments = paymentsRes.data || [];
        const customers = customersRes.data || [];
        const users = usersRes.data || [];
        const branchData = branchesRes.data || [];

        // Process each non-performing loan
        const nplReports = loans.map((loan) => {
          const customer = customers.find((c) => c.id === loan.customer_id);
          const loanOfficer = users.find((u) => u.id === loan.booked_by);
          const branch = branchData.find((b) => b.id === loan.branch_id);

          const fullName = customer ? [customer.Firstname, customer.Middlename, customer.Surname].filter(Boolean).join(" ") : "N/A";

          // Get all installments for this loan
          const loanInstallments = installments.filter((i) => i.loan_id === loan.id);
          
          // Calculate totals
          let totalPrincipalDue = 0;
          let totalInterestDue = 0;
          let principalPaid = 0;
          let interestPaid = 0;
          let arrearsAmount = 0;
          let overdueDays = 0;
          let nextPaymentDate = null;

          loanInstallments.forEach((installment) => {
            totalPrincipalDue += Number(installment.principal_amount) || 0;
            totalInterestDue += Number(installment.interest_amount) || 0;

            const paidAmount = Number(installment.paid_amount) || 0;
            const dueAmount = Number(installment.due_amount) || 0;
            
            if (dueAmount > 0) {
              const principalRatio = (Number(installment.principal_amount) || 0) / dueAmount;
              const interestRatio = (Number(installment.interest_amount) || 0) / dueAmount;
              
              principalPaid += paidAmount * principalRatio;
              interestPaid += paidAmount * interestRatio;
            }

            if (["overdue", "partial", "defaulted"].includes(installment.status)) {
              arrearsAmount += (dueAmount - paidAmount);
              overdueDays = Math.max(overdueDays, installment.days_overdue || 0);
            }

            if (["pending", "partial", "overdue"].includes(installment.status)) {
              const dueDate = new Date(installment.due_date);
              if (!nextPaymentDate || dueDate < nextPaymentDate) {
                nextPaymentDate = dueDate;
              }
            }
          });

          let loanEndDate = null;
          if (loan.disbursed_at && loan.duration_weeks) {
            const startDate = new Date(loan.disbursed_at);
            loanEndDate = new Date(startDate);
            loanEndDate.setDate(startDate.getDate() + (loan.duration_weeks * 7));
          }

          return {
            id: loan.id,
            customer_name: fullName,
            customer_id: customer?.id_number || "N/A",
            mobile: customer?.mobile || "N/A",
            branch: branch?.name || "N/A",
            loan_officer: loanOfficer?.full_name || "N/A",
            loan_product: loan.product_name || "N/A",
            disbursement_amount: Number(loan.scored_amount) || 0,
            installment_amount: Number(loan.weekly_payment) || 0,
            total_principal_due: totalPrincipalDue,
            total_interest_due: totalInterestDue,
            principal_paid: principalPaid,
            interest_paid: interestPaid,
            arrears_amount: arrearsAmount,
            overdue_days: overdueDays,
            loan_start_date: loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : "N/A",
            next_payment_date: nextPaymentDate ? nextPaymentDate.toLocaleDateString() : "N/A",
            loan_end_date: loanEndDate ? loanEndDate.toLocaleDateString() : "N/A",
            repayment_state: loan.repayment_state,
          };
        });

        setReports(nplReports);
        setFiltered(nplReports);

        // Extract unique officers
        const uniqueOfficers = [...new Set(nplReports.map(r => r.loan_officer).filter(o => o !== "N/A"))];
        setOfficers(uniqueOfficers);
      } catch (err) {
        console.error("Error fetching non-performing loans:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNonPerformingLoans();
  }, []);

  // Filters and sorting
  useEffect(() => {
    let result = [...reports];
    
    // Search filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((r) =>
        r.customer_name.toLowerCase().includes(q) ||
        r.mobile.includes(q) ||
        r.customer_id.includes(q)
      );
    }

    if (filters.branch) {
      result = result.filter((r) => r.branch === filters.branch);
    }
    
    if (filters.loanOfficer) {
      result = result.filter((r) => r.loan_officer === filters.loanOfficer);
    }
    
    if (filters.status !== "all") {
      result = result.filter((r) => r.repayment_state === filters.status);
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
    setFilters({ search: "", branch: "", loanOfficer: "", status: "all" });

  const formatCurrency = (num) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);

  const exportToCSV = () => {
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
        "Loan Product",
        "Disbursement Amount",
        "Installment Amount",
        "Total Principal Due",
        "Total Interest Due",
        "Principal Paid",
        "Interest Paid",
        "Arrears Amount",
        "Overdue Days",
        "Loan Start Date",
        "Next Payment Date",
        "Loan End Date",
        "Status",
      ],
      ...filtered.map((r, i) => [
        i + 1,
        `"${r.customer_name}"`,
        r.customer_id,
        r.mobile,
        r.branch,
        r.loan_officer,
        r.loan_product,
        r.disbursement_amount.toFixed(2),
        r.installment_amount.toFixed(2),
        r.total_principal_due.toFixed(2),
        r.total_interest_due.toFixed(2),
        r.principal_paid.toFixed(2),
        r.interest_paid.toFixed(2),
        r.arrears_amount.toFixed(2),
        r.overdue_days,
        r.loan_start_date,
        r.next_payment_date,
        r.loan_end_date,
        r.repayment_state,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `non_performing_loans_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const currentData = filtered.slice(startIdx, endIdx);

  // Totals
  const totals = {
    arrearsAmount: filtered.reduce((sum, r) => sum + r.arrears_amount, 0),
    disbursementAmount: filtered.reduce((sum, r) => sum + r.disbursement_amount, 0),
    overdueCount: filtered.filter(r => r.repayment_state === "overdue").length,
  };

  return (
    <div className="space-y-6">
 
   {/* HEADER */}
<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Non-Performing Loans Report</h1>
      <p className="text-sm text-gray-600 mt-1">
        Track and manage defaulted and overdue loans
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
                placeholder="Search by customer, ID, or mobile..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={filters.branch}
              onChange={(e) => handleFilterChange("branch", e.target.value)}
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
              <option value="">All Officers</option>
              {officers.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="overdue">Overdue</option>
              <option value="defaulted">Defaulted</option>
            </select>
          </div>
          {(filters.search || filters.branch || filters.loanOfficer || filters.status !== "all") && (
            <button
              onClick={clearFilters}
              className="text-red-600 text-sm font-medium flex items-center gap-1 mt-2 hover:text-red-700"
            >
              <X className="w-4 h-4" /> Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Data Summary
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Total NPLs</p>
          <p className="text-2xl font-bold text-red-600">{filtered.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Total Arrears</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(totals.arrearsAmount)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Overdue Loans</p>
          <p className="text-2xl font-bold text-yellow-600">{totals.overdueCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm font-medium">Total Disbursed</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totals.disbursementAmount)}</p>
        </div>
      </div> */}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Loading non-performing loans data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No non-performing loans found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 text-sm">
                  <tr>
                    <th className="px-4 py-4 font-semibold text-slate-600 text-left whitespace-nowrap">#</th>
                    <SortableHeader label="Customer Name" sortKey="customer_name" />
                    <SortableHeader label="ID Number" sortKey="customer_id" />
                    <SortableHeader label="Mobile" sortKey="mobile" />
                    <SortableHeader label="Branch" sortKey="branch" />
                    <SortableHeader label="Loan Officer" sortKey="loan_officer" />
                    <SortableHeader label="Product" sortKey="loan_product" />
                    <SortableHeader label="Disbursement Amt" sortKey="disbursement_amount" />
                    <SortableHeader label="Principal Due" sortKey="total_principal_due" />
                    <SortableHeader label="Interest Due" sortKey="total_interest_due" />
                    <SortableHeader label="Principal Paid" sortKey="principal_paid" />
                    <SortableHeader label="Interest Paid" sortKey="interest_paid" />
                    <SortableHeader label="Arrears Amount" sortKey="arrears_amount" />
                    <SortableHeader label="Overdue Days" sortKey="overdue_days" />
                    <SortableHeader label="Loan Start" sortKey="loan_start_date" />
                    <SortableHeader label="Next Payment" sortKey="next_payment_date" />
                    <SortableHeader label="Loan End" sortKey="loan_end_date" />
                    <SortableHeader label="Status" sortKey="repayment_state" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentData.map((r, i) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 text-gray-900 font-medium whitespace-nowrap">{startIdx + i + 1}</td>
                      <td className="px-4 py-4 text-gray-900 font-medium whitespace-nowrap">{r.customer_name}</td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">{r.customer_id}</td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">{r.mobile}</td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">{r.branch}</td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">{r.loan_officer}</td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">{r.loan_product}</td>
                      <td className="px-4 py-4 text-right text-gray-900 whitespace-nowrap">{formatCurrency(r.disbursement_amount)}</td>
                      <td className="px-4 py-4 text-right text-gray-900 whitespace-nowrap">{formatCurrency(r.total_principal_due)}</td>
                      <td className="px-4 py-4 text-right text-gray-900 whitespace-nowrap">{formatCurrency(r.total_interest_due)}</td>
                      <td className="px-4 py-4 text-right text-green-700 font-semibold whitespace-nowrap">{formatCurrency(r.principal_paid)}</td>
                      <td className="px-4 py-4 text-right text-green-700 font-semibold whitespace-nowrap">{formatCurrency(r.interest_paid)}</td>
                      <td className="px-4 py-4 text-right text-red-700 font-semibold whitespace-nowrap">{formatCurrency(r.arrears_amount)}</td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          r.overdue_days > 30 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {r.overdue_days} days
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">{r.loan_start_date}</td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">{r.next_payment_date}</td>
                      <td className="px-4 py-4 text-gray-700 whitespace-nowrap">{r.loan_end_date}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs uppercase font-semibold ${
                          r.repayment_state === 'defaulted' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {r.repayment_state}
                        </span>
                      </td>
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
                <span className="font-semibold">{filtered.length}</span> loans
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

export default NonPerformingLoansReport;