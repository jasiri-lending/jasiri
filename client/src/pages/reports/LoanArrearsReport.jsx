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
import { useAuth } from "../../hooks/userAuth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
} from "docx";
import { saveAs } from "file-saver";

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
    branch_name: branch?.name || loan.branch_name || "N/A",
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
  const { tenant } = useAuth();
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
        if (!tenant?.id) return;
        setData((d) => ({ ...d, loading: true }));

        // Fetch loans with related data using joins for efficiency
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
            loan_officer:booked_by(full_name),
            installments:loan_installments(*)
          `)
          .eq('tenant_id', tenant.id)
          .eq('status', 'disbursed')
          .neq('repayment_state', 'completed')
          .not('disbursed_at', 'is', null);

        if (loansError) throw loansError;

        const arrearsData = [];
        (loansWithInstallments || []).forEach((loan, idx) => {
          const calced = calculateLoanArrears(loan, loan.installments || []);
          if (calced) {
            arrearsData.push({ ...calced, no: idx + 1 });
          }
        });

        // Unique branches and officers for filters
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
  }, [tenant?.id]);

  return data;
};

const LoanArrearsReport = () => {
  const { tenant } = useAuth();
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
  const [exportFormat, setExportFormat] = useState("csv");

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

    if (filters.minArrears) {
      const min = parseFloat(filters.minArrears);
      if (!isNaN(min)) result = result.filter(r => parseFloat(r.arrears_amount) >= min);
    }
    if (filters.maxArrears) {
      const max = parseFloat(filters.maxArrears);
      if (!isNaN(max)) result = result.filter(r => parseFloat(r.arrears_amount) <= max);
    }

    if (filters.minDays) {
      const min = parseInt(filters.minDays);
      if (!isNaN(min)) result = result.filter(r => r.overdue_days >= min);
    }
    if (filters.maxDays) {
      const max = parseInt(filters.maxDays);
      if (!isNaN(max)) result = result.filter(r => r.overdue_days <= max);
    }

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

  const exportToPDF = useCallback(() => {
    if (!filtered.length) return alert("No data to export");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const companyName = tenant?.company_name || "Jasiri Capital";
    const reportTitle = "Loan Arrears Report";

    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text(companyName, 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(reportTitle, 14, 30);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38);

    const tableHeaders = [
      ["No", "Customer", "ID/Phone", "Branch", "Officer", "Product", "Disbursed", "Principal Due", "Interest Due", "Arrears", "Days"]
    ];

    const tableData = filtered.map((r, idx) => [
      idx + 1,
      r.customer_name,
      `${r.id_number}\n${r.phone}`,
      r.branch_name,
      r.loan_officer,
      r.loan_product,
      formatKES(parseFloat(r.disbursed_amount)),
      formatKES(parseFloat(r.principal_due)),
      formatKES(parseFloat(r.interest_due)),
      formatKES(parseFloat(r.arrears_amount)),
      r.overdue_days
    ]);

    autoTable(doc, {
      startY: 45,
      head: tableHeaders,
      body: tableData,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [46, 94, 153], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { top: 45 },
    });

    const companySlug = companyName.toLowerCase().replace(/ /g, '_');
    const timestamp = new Date().toISOString().split("T")[0];
    doc.save(`${companySlug}_arrears_${timestamp}.pdf`);
  }, [filtered, tenant]);

  const exportToCSV = useCallback(() => {
    if (!filtered.length) return alert("No data to export");
    const companyName = tenant?.company_name || "Jasiri Capital";

    const headers = [
      "No.", "Customer Name", "Phone Number", "Id Number", "Branch Name",
      "Loan Officer", "Loan Product", "Disbursed Amount", "Principal Due",
      "Interest Due", "Arrears Amount", "Over Due Days", "Next Payment Date"
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
      formatNumberForCSV(r.arrears_amount),
      r.overdue_days,
      r.next_payment
    ].join(","));

    const csvString = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const companySlug = companyName.toLowerCase().replace(/ /g, '_');
    const timestamp = new Date().toISOString().split("T")[0];
    saveAs(blob, `${companySlug}_arrears_${timestamp}.csv`);
  }, [filtered, tenant]);

  const handleExport = () => {
    if (exportFormat === "csv") exportToCSV();
    else if (exportFormat === "pdf") exportToPDF();
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const startIdx = (currentPage - 1) * itemsPerPage;
  const currentData = useMemo(() => filtered.slice(startIdx, startIdx + itemsPerPage), [filtered, startIdx]);

  return (
    <div className="min-h-screen bg-brand-surface p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header Section - Aligned with LoanInstallmentReport */}
        <div className="bg-brand-secondary rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              {tenant?.logo_url ? (
                <img src={tenant.logo_url} alt="Company Logo" className="h-16 w-auto object-contain" />
              ) : (
                <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 font-bold text-xl">
                  {tenant?.company_name?.charAt(0) || "C"}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-white leading-tight">{tenant?.company_name || "Jasiri Capital"}</h1>
                <p className="text-sm text-white/80 font-medium">{tenant?.admin_email || "email@example.com"}</p>
                <h2 className="text-lg font-semibold text-white mt-1">
                  Loan Arrears Report
                </h2>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-end gap-3 text-white">
              <div className="text-sm text-right text-white/70">
                <p>Generated on:</p>
                <p className="font-medium text-white">{new Date().toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                    placeholder="Search name, ID, or phone"
                    className="border bg-white border-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 text-sm w-64 text-slate-800 placeholder:text-slate-400"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border
                    ${showFilters
                      ? "bg-accent text-white shadow-md border-transparent hover:bg-brand-secondary"
                      : "text-white border-white/20 hover:bg-white/10"
                    }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                </button>

                <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="bg-transparent text-sm font-medium text-gray-700 px-2 py-1 focus:outline-none cursor-pointer"
                  >
                    <option value="csv">CSV</option>
                    <option value="pdf">PDF</option>
                  </select>
                  <button
                    onClick={handleExport}
                    className="ml-2 px-3 py-1.5 rounded-md bg-accent text-white text-sm font-medium 
                             hover:bg-brand-secondary transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters block - Aligned with LoanInstallmentReport */}
        {showFilters && (
          <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Filter className="w-4 h-4 text-accent" />
              Filter Results
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">Branch</label>
                <select
                  value={filters.branch}
                  onChange={(e) => setFilters(f => ({ ...f, branch: e.target.value }))}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">All Branches</option>
                  {branches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">Officer</label>
                <select
                  value={filters.officer}
                  onChange={(e) => setFilters(f => ({ ...f, officer: e.target.value }))}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">All Officers</option>
                  {officers.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">Arrears Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minArrears}
                    onChange={(e) => setFilters(f => ({ ...f, minArrears: e.target.value }))}
                    className="w-1/2 border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxArrears}
                    onChange={(e) => setFilters(f => ({ ...f, maxArrears: e.target.value }))}
                    className="w-1/2 border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">Overdue Days</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minDays}
                    onChange={(e) => setFilters(f => ({ ...f, minDays: e.target.value }))}
                    className="w-1/2 border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxDays}
                    onChange={(e) => setFilters(f => ({ ...f, maxDays: e.target.value }))}
                    className="w-1/2 border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500 font-medium">
                Matches: <span className="text-accent font-bold">{filtered.length}</span> / {arrears.length}
              </span>
              <button
                onClick={clearFilters}
                className="text-red-500 hover:text-red-600 text-sm font-bold flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                Clear All
              </button>
            </div>
          </div>
        )}

        {/* Table Content */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mb-4"></div>
              <p className="text-slate-600 font-medium">Fetching loan arrears...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4" />
              <p className="font-bold text-lg">Error loading data</p>
              <p className="text-sm opacity-80">{error}</p>
            </div>
          ) : !filtered.length ? (
            <div className="p-12 text-center">
              <Check className="w-16 h-16 text-green-200 mx-auto mb-4" />
              <p className="text-slate-900 text-lg font-bold">No arrears found</p>
              <p className="text-slate-500">All loans are currently up-to-date or match your filters.</p>
              {arrears.length > 0 && (
                <button
                  onClick={clearFilters}
                  className="mt-6 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 shadow-sm">
                    <tr>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-center w-12">No.</th>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-left">Customer Details</th>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-left">Branch / Officer</th>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-left">Loan Info</th>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-right">Disbursed</th>
                      <th className="px-4 py-4 font-black text-orange-600 uppercase tracking-wider text-[11px] text-right">Principal Due</th>
                      <th className="px-4 py-4 font-black text-blue-600 uppercase tracking-wider text-[11px] text-right">Interest Due</th>
                      <th className="px-4 py-4 font-black text-red-600 uppercase tracking-wider text-[11px] text-right">Arrears</th>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-center">Days</th>
                      <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-left">Schedule</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 italic-last-payment">
                    {currentData.map((r, i) => (
                      <tr key={r.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-4 text-center text-slate-400 font-medium whitespace-nowrap">
                          {(currentPage - 1) * itemsPerPage + i + 1}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 whitespace-nowrap">{r.customer_name}</span>
                            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap underline decoration-slate-200">
                              {r.id_number} • {r.phone}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700">{r.branch_name}</span>
                            <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">{r.loan_officer}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{r.loan_product}</span>
                            <span className="text-[11px] text-slate-400">ID: {r.id}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right font-medium text-slate-500 whitespace-nowrap">
                          {formatKES(parseFloat(r.disbursed_amount))}
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-orange-600/80 whitespace-nowrap">
                          {formatKES(parseFloat(r.principal_due))}
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-blue-600/80 whitespace-nowrap">
                          {formatKES(parseFloat(r.interest_due))}
                        </td>
                        <td className="px-4 py-4 text-right font-black text-red-600 bg-red-50/20 whitespace-nowrap">
                          {formatKES(parseFloat(r.arrears_amount))}
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${r.overdue_days > 30
                              ? "bg-red-100 text-red-700 border-red-200"
                              : r.overdue_days > 7
                                ? "bg-orange-100 text-orange-700 border-orange-200"
                                : "bg-yellow-100 text-yellow-700 border-yellow-200"
                            }`}>
                            {r.overdue_days} DAYS
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Ends: {r.loan_end_date}</span>
                            <span className="text-[10px] font-bold text-accent">Next: {r.next_payment}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Section */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                  <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> of{" "}
                  <span className="font-bold text-slate-900">{filtered.length}</span> loans
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-1 mx-1">
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-9 h-9 rounded-lg border text-sm font-bold transition-all 
                            ${currentPage === pageNum
                              ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:border-brand-primary hover:text-brand-primary"}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    {totalPages > 5 && <span className="px-2 text-slate-400 font-medium">...</span>}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoanArrearsReport;
