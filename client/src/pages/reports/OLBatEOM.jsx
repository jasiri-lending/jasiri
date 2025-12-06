import React, { useState, useEffect } from "react";
import {
  Download,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { supabase } from "../../supabaseClient";

const OutstandingLoanBalanceReportEOM = () => {
  const [reports, setReports] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [selectedMonth, setSelectedMonth] = useState("current");
  const [filters, setFilters] = useState({
    search: "",
    branch: "",
    loanOfficer: "",
    status: "all",
  });

  const formatCurrency = (num) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);

  const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

  const getCutoffDate = () => {
    const now = new Date();
    if (selectedMonth === "current") return endOfMonth(now);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return endOfMonth(prev);
  };

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data, error } = await supabase.from("branches").select("id, name");
        if (error) throw error;
        if (data) setBranches(data);
      } catch (err) {
        console.error("Error fetching branches:", err);
      }
    };
    fetchBranches();
  }, []);

  const fetchOutstandingLoans = async () => {
    setLoading(true);
    try {
      const cutoffDate = getCutoffDate();
      cutoffDate.setHours(23, 59, 59, 999);

      const [loansRes, installmentsRes, customersRes, usersRes, branchesRes] =
        await Promise.all([
          supabase
            .from("loans")
            .select(
              "id, customer_id, booked_by, branch_id, product_name, scored_amount, disbursed_at, status, repayment_state, duration_weeks, total_interest, total_payable, weekly_payment"
            )
            .in("status", ["disbursed", "approved", "ready_for_disbursement"])
            .neq("repayment_state", "completed"),
          supabase
            .from("loan_installments")
            .select(
              "loan_id, installment_number, due_date, due_amount, principal_amount, interest_amount, paid_amount, principal_paid, interest_paid, status, days_overdue"
            ),
          supabase.from("customers").select("id, Firstname, Middlename, Surname, id_number, mobile"),
          supabase.from("users").select("id, full_name"),
          supabase.from("branches").select("id, name"),
        ]);

      if (loansRes.error) throw new Error(loansRes.error.message);
      if (installmentsRes.error) throw new Error(installmentsRes.error.message);
      if (customersRes.error) throw new Error(customersRes.error.message);
      if (usersRes.error) throw new Error(usersRes.error.message);
      if (branchesRes.error) throw new Error(branchesRes.error.message);

      const loans = loansRes.data || [];
      const installments = installmentsRes.data || [];
      const customers = customersRes.data || [];
      const users = usersRes.data || [];
      const branchesData = branchesRes.data || [];

      const reports = loans.map((loan) => {
        const customer = customers.find((c) => c.id === loan.customer_id);
        const loanOfficer = users.find((u) => u.id === loan.booked_by);
        const branch = branchesData.find((b) => b.id === loan.branch_id);

        const customer_name = customer
          ? `${customer.Firstname || ""} ${customer.Middlename || ""} ${customer.Surname || ""}`.trim()
          : "N/A";

        const loanInstallments = installments
          .filter((inst) => inst.loan_id === loan.id)
          .sort((a, b) => a.installment_number - b.installment_number);

        // Calculate overdue days based on installment status and due_date
        const todayDate = new Date();
        
        // Find the first overdue installment to calculate max overdue days
        let maxOverdueDays = 0;
        let hasOverdueInstallment = false;
        
        loanInstallments.forEach((inst) => {
          const dueDate = new Date(inst.due_date);
          const isOverdue = inst.status === 'overdue' || inst.status === 'defaulted';
          
          if (isOverdue) {
            hasOverdueInstallment = true;
            // Calculate days between due date and today (or cutoff date if before cutoff)
            const comparisonDate = cutoffDate < todayDate ? cutoffDate : todayDate;
            const daysDiff = Math.max(0, Math.floor((comparisonDate - dueDate) / (1000 * 60 * 60 * 24)));
            
            // If installment has days_overdue field, use it, otherwise calculate
            const overdueDays = inst.days_overdue || daysDiff;
            maxOverdueDays = Math.max(maxOverdueDays, overdueDays);
          }
        });

        // Outstanding installments: all installments with status not 'paid'
        const outstandingInstallments = loanInstallments.filter(
          (inst) => inst.status !== 'paid'
        );

        // Installments due by cutoff date that are not fully paid
        const installmentsDueByCutoff = loanInstallments.filter(
          (inst) => new Date(inst.due_date) <= cutoffDate
        );

        // Arrears amount: sum of unpaid amounts for overdue/defaulted installments
        let arrearsAmount = 0;
        loanInstallments.forEach((inst) => {
          if (inst.status === 'overdue' || inst.status === 'defaulted') {
            const unpaidAmount = Math.max(0, 
              (Number(inst.due_amount) || 0) - (Number(inst.paid_amount) || 0)
            );
            arrearsAmount += unpaidAmount;
          }
        });

        // Total paid amounts (from loan_installments table)
        const totalPrincipalPaid = loanInstallments.reduce(
          (sum, inst) => sum + (Number(inst.principal_paid) || 0),
          0
        );
        
        const totalInterestPaid = loanInstallments.reduce(
          (sum, inst) => sum + (Number(inst.interest_paid) || 0),
          0
        );
        
        const totalAmountPaid = loanInstallments.reduce(
          (sum, inst) => sum + (Number(inst.paid_amount) || 0),
          0
        );

        const principal = Number(loan.scored_amount) || 0;
        const interest = Number(loan.total_interest) || 0;
        const total_payable = Number(loan.total_payable) || 0;

        const outstanding_balance = Math.max(0, total_payable - totalAmountPaid);
        const percent_paid = total_payable > 0 ? (totalAmountPaid / total_payable) * 100 : 0;
        const percent_unpaid = Math.max(0, 100 - percent_paid);

        // Determine repayment status
        let repaymentStatus = "ongoing";
        if (hasOverdueInstallment) {
          if (maxOverdueDays > 30) {
            repaymentStatus = "defaulted";
          } else {
            repaymentStatus = "overdue";
          }
        }

        return {
          id: loan.id,
          customer_name,
          customer_id: customer?.id_number || "N/A",
          mobile: customer?.mobile || "N/A",
          product_name: loan.product_name || "N/A",
          branch: branch?.name || "N/A",
          branch_id: branch?.id || "N/A",
          loan_officer: loanOfficer?.full_name || "N/A",
          loan_officer_id: loanOfficer?.id || "N/A",
          disbursement_date: loan.disbursed_at
            ? new Date(loan.disbursed_at).toLocaleDateString()
            : "N/A",
          loan_end_date:
            loan.duration_weeks && loan.disbursed_at
              ? new Date(
                  new Date(loan.disbursed_at).getTime() +
                    loan.duration_weeks * 7 * 24 * 60 * 60 * 1000
                ).toLocaleDateString()
              : "N/A",
          repayment_state: repaymentStatus,
          status: loan.status,

          principal,
          interest,
          total_payable,
          
          // Total outstanding installments (all unpaid ones)
          outstanding_installments: outstandingInstallments.length,

          principal_paid: totalPrincipalPaid,
          interest_paid: totalInterestPaid,
          total_amount_paid: totalAmountPaid,

          outstanding_balance,

          percent_paid,
          percent_unpaid,

          arrears_amount: arrearsAmount,
          overdue_days: maxOverdueDays,
        };
      });

      setReports(reports);
      const grouped = groupByBranchAndOfficer(reports);
      setFiltered(grouped);

      const uniqueOfficers = [
        ...new Set(reports.map((r) => r.loan_officer).filter((o) => o !== "N/A")),
      ];
      setOfficers(uniqueOfficers);
    } catch (err) {
      console.error("fetchOutstandingLoans error:", err);
      alert(`Error loading data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutstandingLoans();
  }, [selectedMonth]);

  const groupByBranchAndOfficer = (data) => {
    const grouped = {};

    data.forEach((loan) => {
      const branchName = loan.branch || "N/A";
      const officerName = loan.loan_officer || "N/A";

      if (!grouped[branchName]) {
        grouped[branchName] = {
          branchName,
          totalLoanAmount: 0,
          totalOutstanding: 0,
          officers: {},
        };
      }

      if (!grouped[branchName].officers[officerName]) {
        grouped[branchName].officers[officerName] = {
          officerName,
          portfolioOutstanding: 0,
          loans: [],
        };
      }

      grouped[branchName].totalLoanAmount += loan.total_payable;
      grouped[branchName].totalOutstanding += loan.outstanding_balance;
      grouped[branchName].officers[officerName].portfolioOutstanding += loan.outstanding_balance;
      grouped[branchName].officers[officerName].loans.push(loan);
    });

    return Object.values(grouped).map((branch) => ({
      ...branch,
      officers: Object.values(branch.officers),
    }));
  };

  useEffect(() => {
    let result = [...reports];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) =>
          (r.customer_name || "").toLowerCase().includes(q) ||
          (r.mobile || "").includes(q) ||
          (r.customer_id || "").includes(q)
      );
    }

    if (filters.branch) result = result.filter((r) => r.branch === filters.branch);
    if (filters.loanOfficer) result = result.filter((r) => r.loan_officer === filters.loanOfficer);
    if (filters.status !== "all") result = result.filter((r) => r.repayment_state === filters.status);

    const grouped = groupByBranchAndOfficer(result);
    setFiltered(grouped);
    setCurrentPage(1);
  }, [filters, reports]);

  const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const clearFilters = () => setFilters({ search: "", branch: "", loanOfficer: "", status: "all" });

  const exportToCSV = () => {
    const allLoans = filtered.flatMap((branch) => branch.officers.flatMap((o) => o.loans));
    if (allLoans.length === 0) {
      alert("No data to export");
      return;
    }

    const header = [
      "Branch",
      "Loan Officer",
      "Customer Name",
      "Phone Number",
      "ID Number",
      "Principal",
      "Interest",
      "Total Payable",
      "Outstanding Installments",
      "Principal Paid",
      "Interest Paid",
      "Total Amount Paid",
      "% Paid",
      "% Unpaid",
      "Outstanding Balance",
      "Arrears",
      "Overdue Days",
      "Disbursement Date",
      "Loan End Date",
    ];

    const rows = allLoans.map((r) => [
      r.branch,
      r.loan_officer,
      `"${r.customer_name}"`,
      r.mobile,
      r.customer_id,
      (r.principal || 0).toFixed(2),
      (r.interest || 0).toFixed(2),
      (r.total_payable || 0).toFixed(2),
      r.outstanding_installments || 0,
      (r.principal_paid || 0).toFixed(2),
      (r.interest_paid || 0).toFixed(2),
      (r.total_amount_paid || 0).toFixed(2),
      (r.percent_paid || 0).toFixed(2),
      (r.percent_unpaid || 0).toFixed(2),
      (r.outstanding_balance || 0).toFixed(2),
      (r.arrears_amount || 0).toFixed(2),
      r.overdue_days || 0,
      r.disbursement_date,
      r.loan_end_date,
    ]);

    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outstanding_loan_balance_eom_${selectedMonth}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const allLoans = filtered.flatMap((branch) => branch.officers.flatMap((officer) => officer.loans));
  const totalPages = Math.ceil(allLoans.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;

  // const totalOutstanding = allLoans.reduce((s, r) => s + (r.outstanding_balance || 0), 0);
  // const totalPaid = allLoans.reduce((s, r) => s + (r.total_amount_paid || 0), 0);
  // const totalArrears = allLoans.reduce((s, r) => s + (r.arrears_amount || 0), 0);

  const cutoffDate = getCutoffDate();

  return (
    <div className="space-y-6 p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "#586ab1" }}>
              Outstanding Loan Balance Report as at EOM 
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Snapshot as at: <span className="font-semibold">{cutoffDate.toLocaleDateString()}</span>
          
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all ${showFilters ? "bg-blue-600 text-white shadow-md" : "bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"}`}
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
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="ongoing">Ongoing</option>
              <option value="overdue">Overdue</option>
              <option value="defaulted">Defaulted</option>
            </select>
          </div>

          {(filters.search || filters.branch || filters.loanOfficer || filters.status !== "all") && (
            <button onClick={clearFilters} className="text-red-600 text-sm font-medium flex items-center gap-1 mt-2 hover:text-red-700">
              <X className="w-4 h-4" /> Clear Filters
            </button>
          )}
        </div>
      )}

    

      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Loading outstanding loans data...</p>
          </div>
        ) : allLoans.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No outstanding loans found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2 border-gray-300 sticky top-0">
                  <tr>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Branch</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Loan Amount</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Total Outstanding</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Loan Officer</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Officer Portfolio</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Customer Name</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Phone</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">ID Number</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Principal</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Interest</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Total Payable</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">Outstanding Installments</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Principal Paid</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Interest Paid</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Total Paid</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">% Paid</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">% Unpaid</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Outstanding Balance</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Arrears</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">Overdue Days</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Disbursement</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">End Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((branch, branchIdx) => {
                    let loanCounter = 0;
                    return branch.officers.map((officer, officerIdx) => {
                      const officerLoans = officer.loans.slice(
                        Math.max(0, startIdx - loanCounter),
                        Math.max(0, endIdx - loanCounter)
                      );
                      loanCounter += officer.loans.length;

                      if (officerLoans.length === 0) return null;

                      return officerLoans.map((loan, loanIdx) => {
                        const isFirstInBranch = officerIdx === 0 && loanIdx === 0;
                        const isFirstInOfficer = loanIdx === 0;
                        const officerLoanCount = officer.loans.length;

                        return (
                          <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                            {isFirstInBranch ? (
                              <>
                                <td rowSpan={branch.officers.reduce((sum, o) => sum + o.loans.length, 0)}
                                  className="px-3 py-3 text-gray-900 font-bold bg-blue-50 border-r-2 border-blue-200 align-top whitespace-nowrap">
                                  {branch.branchName}
                                </td>
                                <td rowSpan={branch.officers.reduce((sum, o) => sum + o.loans.length, 0)}
                                  className="px-3 py-3 text-right text-blue-700 font-bold bg-blue-50 border-r-2 border-blue-200 align-top whitespace-nowrap">
                                  {formatCurrency(branch.totalLoanAmount)}
                                </td>
                                <td rowSpan={branch.officers.reduce((sum, o) => sum + o.loans.length, 0)}
                                  className="px-3 py-3 text-right text-blue-700 font-bold bg-blue-50 border-r-2 border-blue-200 align-top whitespace-nowrap">
                                  {formatCurrency(branch.totalOutstanding)}
                                </td>
                              </>
                            ) : null}

                            {isFirstInOfficer ? (
                              <>
                                <td rowSpan={officerLoanCount}
                                  className="px-3 py-3 text-gray-800 font-semibold bg-green-50 border-r border-green-200 align-top whitespace-nowrap">
                                  {officer.officerName}
                                </td>
                                <td rowSpan={officerLoanCount}
                                  className="px-3 py-3 text-right text-green-700 font-bold bg-green-50 border-r border-green-200 align-top whitespace-nowrap">
                                  {formatCurrency(officer.portfolioOutstanding)}
                                </td>
                              </>
                            ) : null}

                            <td className="px-3 py-3 text-gray-900 font-medium whitespace-nowrap">{loan.customer_name}</td>
                            <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{loan.mobile}</td>
                            <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{loan.customer_id}</td>
                            <td className="px-3 py-3 text-right text-gray-900 whitespace-nowrap">{formatCurrency(loan.principal)}</td>
                            <td className="px-3 py-3 text-right text-gray-900 whitespace-nowrap">{formatCurrency(loan.interest)}</td>
                            <td className="px-3 py-3 text-right text-gray-900 font-semibold whitespace-nowrap">{formatCurrency(loan.total_payable)}</td>
                            <td className="px-3 py-3 text-center text-gray-700 whitespace-nowrap">{loan.outstanding_installments}</td>

                            <td className="px-3 py-3 text-right text-green-700 font-semibold whitespace-nowrap">{formatCurrency(loan.principal_paid)}</td>
                            <td className="px-3 py-3 text-right text-green-700 font-semibold whitespace-nowrap">{formatCurrency(loan.interest_paid)}</td>

                            <td className="px-3 py-3 text-right text-green-700 font-semibold whitespace-nowrap">{formatCurrency(loan.total_amount_paid)}</td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                loan.percent_paid >= 75 ? 'bg-green-100 text-green-800' :
                                loan.percent_paid >= 50 ? 'bg-blue-100 text-blue-800' :
                                loan.percent_paid >= 25 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {(loan.percent_paid || 0).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                loan.percent_unpaid <= 25 ? 'bg-green-100 text-green-800' :
                                loan.percent_unpaid <= 50 ? 'bg-blue-100 text-blue-800' :
                                loan.percent_unpaid <= 75 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {(loan.percent_unpaid || 0).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right text-blue-700 font-bold whitespace-nowrap">{formatCurrency(loan.outstanding_balance)}</td>
                            <td className="px-3 py-3 text-right text-red-700 font-semibold whitespace-nowrap">{formatCurrency(loan.arrears_amount)}</td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              {(loan.overdue_days || 0) > 0 ? (
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  (loan.overdue_days || 0) <= 7 ? 'bg-yellow-100 text-yellow-800' :
                                  (loan.overdue_days || 0) <= 30 ? 'bg-orange-100 text-orange-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {loan.overdue_days}
                                </span>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{loan.disbursement_date}</td>
                            <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{loan.loan_end_date}</td>
                          </tr>
                        );
                      });
                    });
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{startIdx + 1}</span> to{' '}
                <span className="font-semibold">{Math.min(endIdx, allLoans.length)}</span> of{' '}
                <span className="font-semibold">{allLoans.length}</span> loans
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

export default OutstandingLoanBalanceReportEOM;