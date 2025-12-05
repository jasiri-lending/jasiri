import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Download,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Calendar,
  Clock,
  DollarSign,
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "../../supabaseClient";

// Helper functions
const num = (v) => (v == null ? 0 : Number(v) || 0);

const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalYYYYMMDD = (dateString) => {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (!d || isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Kenyan Shilling Currency Formatter
const formatKES = (amount) => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return 'KSh 0.00';
  
  return `KSh ${numAmount.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

// Format for CSV export (without currency symbol)
const formatNumberForCSV = (amount) => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '0.00';
  return numAmount.toFixed(2);
};

// Calculate days overdue between two dates (YYYY-MM-DD format)
const calculateDaysOverdue = (dueDateStr, todayStr) => {
  if (!dueDateStr) return 0;
  
  const dueDate = new Date(dueDateStr);
  const today = new Date(todayStr);
  
  if (isNaN(dueDate.getTime()) || isNaN(today.getTime())) return 0;
  
  // Set both dates to midnight for accurate day difference
  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const diffTime = today - dueDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

const calculateLoanArrears = (loan, installments = []) => {
  const today = getTodayDate();
  
  if (!loan || !loan.id) return null;
  
  const sorted = [...installments].sort(
    (a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0)
  );

  // Calculate total paid across all installments
  const totalPaid = sorted.reduce((sum, i) => {
    const interestPaid = num(i.interest_paid) || 0;
    const principalPaid = num(i.principal_paid) || 0;
    return sum + interestPaid + principalPaid;
  }, 0);
  
  const totalPayable = num(loan.total_payable);
  const totalOutstanding = Math.max(0, totalPayable - totalPaid);
  const disbursedAmount = num(loan.scored_amount) || 0;

  // Find overdue installments
  const overdueInstallments = sorted.filter((inst) => {
    if (!inst.due_date) return false;
    
    const dueDate = inst.due_date;
    const isOverdue = dueDate <= today;
    
    if (!isOverdue) return false;
    
    // Calculate paid amount for this installment
    const paidAmount = (num(inst.interest_paid) || 0) + (num(inst.principal_paid) || 0);
    const dueAmount = num(inst.due_amount) || 0;
    
    // If it's overdue and not fully paid, include it
    if (paidAmount < dueAmount) {
      return true;
    }
    
    // Also include if status is 'overdue' or 'partial' even if paid amount matches
    if (inst.status === 'overdue' || inst.status === 'partial') {
      return true;
    }
    
    return false;
  });

  if (overdueInstallments.length === 0) {
    return null;
  }

  let principalDue = 0;
  let interestDue = 0;
  let totalArrears = 0;
  let totalDue = 0;

  const overdueInstallmentsDetailed = overdueInstallments.map((inst) => {
    const dueDate = inst.due_date;
    const daysOverdue = calculateDaysOverdue(dueDate, today);
    
    // Calculate arrears for this installment
    const dueAmount = num(inst.due_amount) || 0;
    const paidAmount = (num(inst.interest_paid) || 0) + (num(inst.principal_paid) || 0);
    const instArrears = Math.max(0, dueAmount - paidAmount);
    
    // Calculate principal and interest due
    const instPrincipalAmount = num(inst.principal_amount) || 0;
    const instInterestAmount = num(inst.interest_amount) || 0;
    const instPrincipalPaid = num(inst.principal_paid) || 0;
    const instInterestPaid = num(inst.interest_paid) || 0;
    
    const instPrincipalDue = Math.max(0, instPrincipalAmount - instPrincipalPaid);
    const instInterestDue = Math.max(0, instInterestAmount - instInterestPaid);

    principalDue += instPrincipalDue;
    interestDue += instInterestDue;
    totalArrears += instArrears;
    totalDue += dueAmount;

    return {
      installment_number: inst.installment_number,
      due_date: inst.due_date,
      due_amount: dueAmount.toFixed(2),
      paid_amount: paidAmount.toFixed(2),
      outstanding: instArrears.toFixed(2),
      principal_amount: instPrincipalAmount.toFixed(2),
      interest_amount: instInterestAmount.toFixed(2),
      principal_paid: instPrincipalPaid.toFixed(2),
      interest_paid: instInterestPaid.toFixed(2),
      principal_due: instPrincipalDue.toFixed(2),
      interest_due: instInterestDue.toFixed(2),
      status: inst.status || "overdue",
      days_overdue: daysOverdue,
    };
  });

  // Calculate earliest overdue date for overall loan overdue days
  const overdueDates = overdueInstallments
    .map(i => new Date(i.due_date))
    .filter(d => !isNaN(d.getTime()));
    
  const earliestDueDate = overdueDates.length > 0 
    ? new Date(Math.min(...overdueDates))
    : new Date(today);
    
  const overallOverdueDays = calculateDaysOverdue(
    earliestDueDate.toISOString().split('T')[0], 
    today
  );

  // Calculate loan end date
  let loanEndDate = null;
  const disbursedDate = loan.disbursed_at || loan.disbursed_date;
  if (disbursedDate && loan.duration_weeks) {
    const startDate = new Date(disbursedDate);
    if (!isNaN(startDate.getTime())) {
      loanEndDate = new Date(startDate);
      loanEndDate.setDate(loanEndDate.getDate() + (loan.duration_weeks * 7));
    }
  }

  // Find next payment
  const nextPaymentInstallment = sorted.find(
    (i) => {
      const dueDate = i.due_date;
      if (!dueDate) return false;
      
      const isFuture = dueDate > today;
      if (!isFuture) return false;
      
      const paidAmount = (num(i.interest_paid) || 0) + (num(i.principal_paid) || 0);
      const dueAmount = num(i.due_amount) || 0;
      
      return paidAmount < dueAmount;
    }
  );
  
  const nextPayment = nextPaymentInstallment ? nextPaymentInstallment.due_date : null;

  // Get customer info
  const customer = loan.customer || {};
  const branch = loan.branch || {};
  const loanOfficer = loan.loan_officer || {};

  const result = {
    id: loan.id,
    loan_id: loan.id,
    branch_name: branch.name || loan.branch_name || "N/A",
    customer_name: [customer.Firstname, customer.Middlename, customer.Surname]
      .filter(Boolean)
      .join(" ") || loan.customer_name || "N/A",
    phone: customer.mobile || loan.phone || "N/A",
    id_number: customer.id_number || loan.id_number || "N/A",
    loan_officer: loanOfficer.full_name || loanOfficer.name || loan.loan_officer || "N/A",
    loan_product: loan.product_name || loan.product || "N/A",
    disbursed_amount: disbursedAmount.toFixed(2),
    principal_due: principalDue.toFixed(2),
    interest_due: interestDue.toFixed(2),
    total_payable: totalPayable.toFixed(2),
    total_outstanding: totalOutstanding.toFixed(2),
    arrears_amount: totalArrears.toFixed(2),
    total_due: totalDue.toFixed(2),
    overdue_days: overallOverdueDays,
    no_of_installments: sorted.length,
    number_elapsed_schedule: overdueInstallments.length,
    loan_start_date: disbursedDate ? getLocalYYYYMMDD(disbursedDate) : "N/A",
    loan_end_date: loanEndDate ? loanEndDate.toISOString().split("T")[0] : "N/A",
    next_payment: nextPayment ? nextPayment : "N/A",
    disbursed_date: disbursedDate ? getLocalYYYYMMDD(disbursedDate) : "N/A",
    total_paid: totalPaid.toFixed(2),
    overdueInstallments: overdueInstallmentsDetailed,
  };

  return result;
};

const useLoanArrears = () => {
  const [data, setData] = useState({
    arrears: [],
    branches: [],
    officers: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        if (!mounted) return;
        setData((d) => ({ ...d, loading: true }));

        // Fetch loans with related data
        const { data: loansWithInstallments, error: loansError } = await supabase
          .from("loans")
          .select(`
            id, 
            disbursed_at,
            disbursed_date,
            duration_weeks, 
            product_name, 
            total_payable,
            scored_amount,
            status,
            repayment_state,
            branch:branch_id(name), 
            customer:customer_id(Firstname, Middlename, Surname, mobile, id_number),
            loan_officer:booked_by(full_name)
          `)
          .eq('status', 'disbursed')
          .neq('repayment_state', 'completed')
          .not('disbursed_at', 'is', null);

        if (loansError) throw loansError;

        // Filter loans that are disbursed and not completed
        const loansForArrears = (loansWithInstallments || []).filter(
          (loan) => {
            const hasDisbursedDate = loan.disbursed_at || loan.disbursed_date;
            const isNotCompleted = loan.repayment_state?.toLowerCase() !== 'completed';
            return hasDisbursedDate && isNotCompleted;
          }
        );

        const loanIds = loansForArrears.map((l) => l.id);
        if (loanIds.length === 0) {
          return setData({ 
            arrears: [], 
            branches: [], 
            officers: [], 
            loading: false, 
            error: null 
          });
        }

        // Fetch installments for these loans
        const { data: installments, error: instError } = await supabase
          .from("loan_installments")
          .select("*")
          .in("loan_id", loanIds)
          .order("due_date", { ascending: true });

        if (instError) throw instError;

        // Group installments by loan_id
        const grouped = {};
        (installments || []).forEach((inst) => {
          const key = String(inst.loan_id);
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(inst);
        });

        // Calculate arrears for each loan
        const arrearsData = [];
        loansForArrears.forEach((loan, idx) => {
          const calced = calculateLoanArrears(loan, grouped[String(loan.id)] || []);
          if (calced) {
            arrearsData.push({ ...calced, no: idx + 1 });
          }
        });

        const uniqueBranches = [...new Set(arrearsData.map((r) => r.branch_name))].filter(Boolean).sort();
        const uniqueOfficers = [...new Set(arrearsData.map((r) => r.loan_officer))].filter(Boolean).sort();

        if (!mounted) return;
        setData({ 
          arrears: arrearsData, 
          branches: uniqueBranches, 
          officers: uniqueOfficers, 
          loading: false, 
          error: null 
        });
      } catch (err) {
        console.error("Error in fetchData:", err);
        if (!mounted) return;
        setData({ 
          arrears: [], 
          branches: [], 
          officers: [], 
          loading: false, 
          error: err.message 
        });
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, []);

  return data;
};

const LoanArrearsReport = () => {
  const { arrears, branches, officers, loading, error } = useLoanArrears();

  const [filtered, setFiltered] = useState([]);
  const [filters, setFilters] = useState({ 
    search: "", 
    branch: "", 
    officer: "", 
    minArrears: "", 
    maxArrears: "", 
    minDays: "", 
    maxDays: "" 
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => { 
    setFiltered(arrears); 
    setCurrentPage(1); 
  }, [arrears]);

  // Filter logic
  useEffect(() => {
    let result = arrears.slice();
    const q = (filters.search || "").trim().toLowerCase();
    
    if (q) {
      result = result.filter(r =>
        r.customer_name.toLowerCase().includes(q) ||
        (r.phone || "").includes(q) ||
        (r.id_number || "").includes(q) ||
        (r.loan_product || "").toLowerCase().includes(q) ||
        r.loan_id.toString().includes(q)
      );
    }
    
    if (filters.branch) result = result.filter(r => r.branch_name === filters.branch);
    if (filters.officer) result = result.filter(r => r.loan_officer === filters.officer);
    if (filters.minArrears) result = result.filter(r => parseFloat(r.arrears_amount) >= parseFloat(filters.minArrears));
    if (filters.maxArrears) result = result.filter(r => parseFloat(r.arrears_amount) <= parseFloat(filters.maxArrears));
    if (filters.minDays) result = result.filter(r => r.overdue_days >= parseInt(filters.minDays));
    if (filters.maxDays) result = result.filter(r => r.overdue_days <= parseInt(filters.maxDays));
    
    setFiltered(result);
    setCurrentPage(1);
  }, [filters, arrears]);

  const clearFilters = useCallback(() => setFilters({ 
    search: "", 
    branch: "", 
    officer: "", 
    minArrears: "", 
    maxArrears: "", 
    minDays: "", 
    maxDays: "" 
  }), []);

 

  const summaryTotals = useMemo(() => {
    if (!filtered.length) return { 
      totalArrears: 0, 
      totalPrincipalDue: 0, 
      totalInterestDue: 0, 
      totalOutstanding: 0, 
      totalLoans: 0, 
      totalOverdueInstallments: 0, 
      averageOverdueDays: 0 
    };
    
    const totals = filtered.reduce((acc, r) => {
      acc.totalArrears += parseFloat(r.arrears_amount);
      acc.totalPrincipalDue += parseFloat(r.principal_due);
      acc.totalInterestDue += parseFloat(r.interest_due);
      acc.totalOutstanding += parseFloat(r.total_outstanding);
      acc.totalOverdueDays += r.overdue_days;
      acc.totalOverdueInstallments += r.overdueInstallments.length;
      return acc;
    }, { 
      totalArrears: 0, 
      totalPrincipalDue: 0, 
      totalInterestDue: 0, 
      totalOutstanding: 0, 
      totalOverdueDays: 0, 
      totalOverdueInstallments: 0, 
      totalLoans: filtered.length 
    });
    
    totals.averageOverdueDays = Math.round(totals.totalOverdueDays / totals.totalLoans);
    return totals;
  }, [filtered]);

  const exportToCSV = useCallback(() => {
    if (!filtered.length) return alert("No data to export");
    
    const headers = [
      "No.", "Customer Name", "Phone Number", "Id Number", "Branch Name", 
      "Loan Officer", "Loan Product", "Disbursed Amount", "Principal Due", 
      "Interest Due", "Total Loan Amount", "Total Loan OLB", "Arrears Amount", 
      "Total Due", "Total Paid", "Over Due Days", "No of Installments", 
      "Elapsed Schedules", "Loan Start Date", "Loan End Date", "Next Payment Date"
    ];
    
    const rows = filtered.map((r, idx) => [
      idx + 1,
      `"${r.customer_name}"`,
      r.phone,
      r.id_number,
      r.branch_name,
      r.loan_officer,
      r.loan_product,
      formatNumberForCSV(r.disbursed_amount),
      formatNumberForCSV(r.principal_due),
      formatNumberForCSV(r.interest_due),
      formatNumberForCSV(r.total_payable),
      formatNumberForCSV(r.total_outstanding),
      formatNumberForCSV(r.arrears_amount),
      formatNumberForCSV(r.total_due || r.total_payable),
      formatNumberForCSV(r.total_paid),
      r.overdue_days,
      r.no_of_installments,
      r.number_elapsed_schedule,
      r.loan_start_date,
      r.loan_end_date,
      r.next_payment
    ].join(","));
    
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loan_arrears_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIdx = (currentPage - 1) * itemsPerPage;
  const currentData = useMemo(() => filtered.slice(startIdx, startIdx + itemsPerPage), [filtered, startIdx]);

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "#586ab1" }}>
            Loan Arrears Report
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {filtered.length} loan{filtered.length !== 1 ? 's' : ''} with overdue installments
            {arrears.length > 0 && (
              <span className="ml-2 text-xs text-gray-500">
                (Total arrears: {formatKES(summaryTotals.totalArrears)})
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" /> 
            {showFilters ? 'Hide Filters' : 'Show Filters'}
            {(filters.search || filters.branch || filters.officer || filters.minArrears || filters.maxArrears || filters.minDays || filters.maxDays) && (
              <span className="ml-1 bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                Active
              </span>
            )}
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
            style={{ backgroundColor: "#586ab1" }}
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search customer, phone, ID, product..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg w-full"
              />
            </div>

            <select
              value={filters.branch}
              onChange={(e) => setFilters((f) => ({ ...f, branch: e.target.value }))}
              className="border border-gray-300 px-3 py-2 rounded-lg w-full"
            >
              <option value="">All Branches ({branches.length})</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <select
              value={filters.officer}
              onChange={(e) => setFilters((f) => ({ ...f, officer: e.target.value }))}
              className="border border-gray-300 px-3 py-2 rounded-lg w-full"
            >
              <option value="">All Officers ({officers.length})</option>
              {officers.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min arrears"
                value={filters.minArrears}
                onChange={(e) => setFilters((f) => ({ ...f, minArrears: e.target.value }))}
                className="border border-gray-300 px-3 py-2 rounded-lg w-1/2"
                min="0"
                step="0.01"
              />
              <input
                type="number"
                placeholder="Max arrears"
                value={filters.maxArrears}
                onChange={(e) => setFilters((f) => ({ ...f, maxArrears: e.target.value }))}
                className="border border-gray-300 px-3 py-2 rounded-lg w-1/2"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min days overdue"
                value={filters.minDays}
                onChange={(e) => setFilters((f) => ({ ...f, minDays: e.target.value }))}
                className="border border-gray-300 px-3 py-2 rounded-lg w-1/2"
                min="0"
              />
              <input
                type="number"
                placeholder="Max days overdue"
                value={filters.maxDays}
                onChange={(e) => setFilters((f) => ({ ...f, maxDays: e.target.value }))}
                className="border border-gray-300 px-3 py-2 rounded-lg w-1/2"
                min="0"
              />
            </div>
            <div className="text-sm text-gray-500">
              Showing {filtered.length} of {arrears.length} loans with arrears
            </div>
            <div className="flex justify-end">
              {(filters.search || filters.branch || filters.officer || filters.minArrears || filters.maxArrears || filters.minDays || filters.maxDays) && (
                <button 
                  onClick={clearFilters}
                  className="text-red-600 flex items-center gap-1 text-sm font-medium hover:text-red-800"
                >
                  <X className="w-4 h-4" /> Clear All Filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
  {loading ? (
    <div className="p-8 text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-600">Loading loan arrears report...</p>
      <p className="text-sm text-gray-400 mt-2">Checking for overdue installments</p>
    </div>
  ) : error ? (
    <div className="p-8 text-center">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-red-600">Failed to load report</h3>
      <p className="text-gray-600 mt-2">{error}</p>
      <p className="text-sm text-gray-500 mt-4">
        Check browser console for detailed error logs (F12 → Console)
      </p>
    </div>
  ) : !filtered || filtered.length === 0 ? (
    <div className="p-8 text-center">
      {arrears.length === 0 ? (
        <>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-gray-600">No loans with overdue installments found.</p>
          <p className="text-sm text-gray-400 mt-2">
            All loans are up-to-date with their payments.
          </p>
        </>
      ) : (
        <>
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No loans match your current filters.</p>
          <button 
            onClick={clearFilters}
            className="mt-4 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
          >
            Clear filters to see all {arrears.length} loans with arrears
          </button>
        </>
      )}
    </div>
  ) : (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[1800px]">
          <thead className="bg-gray-100 border-b sticky top-0 z-10">
            <tr>
              <th className="px-2 py-3 text-left font-medium text-gray-700 whitespace-nowrap border-r">No.</th>
              <th className="px-2 py-3 text-left font-medium text-gray-700 whitespace-nowrap border-r min-w-[120px]">Customer Name</th>
              <th className="px-2 py-3 text-left font-medium text-gray-700 whitespace-nowrap border-r">Phone</th>
              <th className="px-2 py-3 text-left font-medium text-gray-700 whitespace-nowrap border-r">ID Number</th>
              <th className="px-2 py-3 text-left font-medium text-gray-700 whitespace-nowrap border-r">Branch</th>
              <th className="px-2 py-3 text-left font-medium text-gray-700 whitespace-nowrap border-r">Loan Officer</th>
              <th className="px-2 py-3 text-left font-medium text-gray-700 whitespace-nowrap border-r">Product</th>
              <th className="px-2 py-3 text-right font-medium text-gray-700 whitespace-nowrap border-r min-w-[90px]">Disbursed</th>
              <th className="px-2 py-3 text-right font-medium text-gray-700 whitespace-nowrap border-r">Principal Due</th>
              <th className="px-2 py-3 text-right font-medium text-gray-700 whitespace-nowrap border-r">Interest Due</th>
              <th className="px-2 py-3 text-right font-medium text-gray-700 whitespace-nowrap border-r min-w-[90px]">Total Loan</th>
              <th className="px-2 py-3 text-right font-medium text-gray-700 whitespace-nowrap border-r min-w-[90px]">Loan OLB</th>
              <th className="px-2 py-3 text-right font-medium text-gray-700 whitespace-nowrap border-r min-w-[90px]">Arrears</th>
              <th className="px-2 py-3 text-right font-medium text-gray-700 whitespace-nowrap border-r">Total Due</th>
              <th className="px-2 py-3 text-right font-medium text-gray-700 whitespace-nowrap border-r">Total Paid</th>
              <th className="px-2 py-3 text-right font-medium text-gray-700 whitespace-nowrap border-r">Overdue Days</th>
              <th className="px-2 py-3 text-right font-medium text-gray-700 whitespace-nowrap border-r">Installments</th>
              <th className="px-2 py-3 text-right font-medium text-gray-700 whitespace-nowrap border-r">Elapsed</th>
              <th className="px-2 py-3 text-left font-medium text-gray-700 whitespace-nowrap border-r">Start Date</th>
              <th className="px-2 py-3 text-left font-medium text-gray-700 whitespace-nowrap border-r">End Date</th>
              <th className="px-2 py-3 text-left font-medium text-gray-700 whitespace-nowrap">Next Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentData.map((r, i) => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-2 py-3 text-gray-700 font-medium border-r">
                  {(currentPage - 1) * itemsPerPage + i + 1}
                </td>
                <td className="px-2 py-3 border-r">
                  <div className="font-medium text-gray-900 truncate max-w-[120px]" title={r.customer_name}>
                    {r.customer_name}
                  </div>
                </td>
                <td className="px-2 py-3 text-gray-600 border-r whitespace-nowrap">
                  {r.phone}
                </td>
                <td className="px-2 py-3 text-gray-600 border-r whitespace-nowrap">
                  {r.id_number}
                </td>
                <td className="px-2 py-3 text-gray-600 border-r whitespace-nowrap truncate max-w-[100px]" title={r.branch_name}>
                  {r.branch_name}
                </td>
                <td className="px-2 py-3 text-gray-600 border-r whitespace-nowrap truncate max-w-[100px]" title={r.loan_officer}>
                  {r.loan_officer}
                </td>
                <td className="px-2 py-3 text-gray-600 border-r whitespace-nowrap truncate max-w-[100px]" title={r.loan_product}>
                  {r.loan_product}
                </td>
                <td className="px-2 py-3 text-right border-r whitespace-nowrap">
                  <div className="font-medium text-gray-900">
                    {formatKES(parseFloat(r.disbursed_amount))}
                  </div>
                </td>
                <td className="px-2 py-3 text-right border-r whitespace-nowrap">
                  <div className="text-orange-600">
                    {formatKES(parseFloat(r.principal_due))}
                  </div>
                </td>
                <td className="px-2 py-3 text-right border-r whitespace-nowrap">
                  <div className="text-blue-600">
                    {formatKES(parseFloat(r.interest_due))}
                  </div>
                </td>
                <td className="px-2 py-3 text-right border-r whitespace-nowrap">
                  <div className="font-medium text-gray-900">
                    {formatKES(parseFloat(r.total_payable))}
                  </div>
                </td>
                <td className="px-2 py-3 text-right border-r whitespace-nowrap">
                  <div className="font-medium text-gray-900">
                    {formatKES(parseFloat(r.total_outstanding))}
                  </div>
                </td>
                <td className="px-2 py-3 text-right border-r whitespace-nowrap">
                  <div className="font-semibold text-red-600">
                    {formatKES(parseFloat(r.arrears_amount))}
                  </div>
                </td>
                <td className="px-2 py-3 text-right border-r whitespace-nowrap">
                  <div className="font-medium text-gray-900">
                    {formatKES(parseFloat(r.total_due || r.total_payable))}
                  </div>
                </td>
                <td className="px-2 py-3 text-right border-r whitespace-nowrap">
                  <div className="font-medium text-green-600">
                    {formatKES(parseFloat(r.total_paid))}
                  </div>
                </td>
                <td className="px-2 py-3 text-right border-r whitespace-nowrap">
                  <div className={`font-semibold ${r.overdue_days > 30 ? 'text-red-600' : r.overdue_days > 7 ? 'text-orange-600' : 'text-yellow-600'}`}>
                    {r.overdue_days}
                  </div>
                </td>
                <td className="px-2 py-3 text-right border-r whitespace-nowrap">
                  <div className="font-medium text-gray-700">
                    {r.no_of_installments}
                  </div>
                </td>
                <td className="px-2 py-3 text-right border-r whitespace-nowrap">
                  <div className="font-medium text-gray-700">
                    {r.number_elapsed_schedule}
                  </div>
                </td>
                <td className="px-2 py-3 text-gray-600 border-r whitespace-nowrap">
                  {r.loan_start_date}
                </td>
                <td className="px-2 py-3 text-gray-600 border-r whitespace-nowrap">
                  {r.loan_end_date}
                </td>
                <td className="px-2 py-3 text-gray-600 whitespace-nowrap">
                  {r.next_payment}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-50 border-t">
        <span className="text-xs text-gray-600">
          Showing {(currentPage - 1) * itemsPerPage + 1}–
          {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} loans
          {summaryTotals.totalArrears > 0 && (
            <span className="ml-4 text-red-600 font-medium">
              Total Arrears: {formatKES(summaryTotals.totalArrears)}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className={`px-2 py-1 rounded border text-xs ${
              currentPage === 1 
                ? "text-gray-400 bg-gray-100 cursor-not-allowed" 
                : "text-gray-700 bg-white hover:bg-gray-100"
            }`}
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <span className="text-xs text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className={`px-2 py-1 rounded border text-xs ${
              currentPage === totalPages 
                ? "text-gray-400 bg-gray-100 cursor-not-allowed" 
                : "text-gray-700 bg-white hover:bg-gray-100"
            }`}
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </>
  )}
</div>
    </div>
  );
};

export default LoanArrearsReport;