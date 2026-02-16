import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Download,
  Filter,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Check,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Spinner from "../../components/Spinner"; // ✅ Import your custom Spinner

// ========== Memoized Helper Components ==========

const SearchBox = React.memo(({ value, onChange }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search name, ID, or phone"
      className="border bg-white border-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 text-sm w-64 text-slate-800 placeholder:text-slate-400"
    />
  </div>
));
SearchBox.displayName = "SearchBox";

const ArrearsTableRow = React.memo(({ row, index, currentPage, itemsPerPage }) => {
  const formatKES = (amount) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return 'KSh 0.00';
    return `KSh ${numAmount.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const overdueDays = row.overdue_days;
  const badgeColor = overdueDays > 30
    ? "bg-red-100 text-red-700 border-red-200"
    : overdueDays > 7
    ? "bg-orange-100 text-orange-700 border-orange-200"
    : "bg-yellow-100 text-yellow-700 border-yellow-200";

  return (
    <tr className="group hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-4 text-center text-slate-400 font-medium whitespace-nowrap">
        {(currentPage - 1) * itemsPerPage + index + 1}
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-col">
          <span className="font-bold text-slate-900 whitespace-nowrap">{row.customer_name}</span>
          <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap underline decoration-slate-200">
            {row.id_number} • {row.phone}
          </span>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex flex-col">
          <span className="font-bold text-slate-700">{row.branch_name}</span>
          <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">{row.loan_officer}</span>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex flex-col">
          <span className="font-bold text-slate-800">{row.loan_product}</span>
          <span className="text-[11px] text-slate-400">ID: {row.id}</span>
        </div>
      </td>
      <td className="px-4 py-4 text-right font-medium text-slate-500 whitespace-nowrap">
        {formatKES(parseFloat(row.disbursed_amount))}
      </td>
      <td className="px-4 py-4 text-right font-bold text-orange-600/80 whitespace-nowrap">
        {formatKES(parseFloat(row.principal_due))}
      </td>
      <td className="px-4 py-4 text-right font-bold text-blue-600/80 whitespace-nowrap">
        {formatKES(parseFloat(row.interest_due))}
      </td>
      <td className="px-4 py-4 text-right font-black text-red-600 bg-red-50/20 whitespace-nowrap">
        {formatKES(parseFloat(row.arrears_amount))}
      </td>
      <td className="px-4 py-4 text-center whitespace-nowrap">
        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${badgeColor}`}>
          {row.overdue_days} DAYS
        </span>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Ends: {row.loan_end_date}</span>
          <span className="text-[10px] font-bold text-accent">Next: {row.next_payment}</span>
        </div>
      </td>
    </tr>
  );
});
ArrearsTableRow.displayName = "ArrearsTableRow";

// ========== Helper Functions ==========
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

const formatKES = (amount) => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return 'KSh 0.00';
  return `KSh ${numAmount.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const formatNumberForCSV = (amount) => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '0.00';
  return numAmount.toFixed(2);
};

const calculateDaysOverdue = (dueDateStr, todayStr) => {
  if (!dueDateStr) return 0;
  const dueDate = new Date(dueDateStr);
  const today = new Date(todayStr);
  if (isNaN(dueDate.getTime()) || isNaN(today.getTime())) return 0;
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

  const totalPaid = sorted.reduce((sum, i) => {
    const interestPaid = num(i.interest_paid) || 0;
    const principalPaid = num(i.principal_paid) || 0;
    return sum + interestPaid + principalPaid;
  }, 0);

  const totalPayable = num(loan.total_payable);
  const totalOutstanding = Math.max(0, totalPayable - totalPaid);
  const disbursedAmount = num(loan.scored_amount) || 0;

  const overdueInstallments = sorted.filter((inst) => {
    if (!inst.due_date) return false;
    const dueDate = inst.due_date;
    const isOverdue = dueDate <= today;
    if (!isOverdue) return false;
    const paidAmount = (num(inst.interest_paid) || 0) + (num(inst.principal_paid) || 0);
    const dueAmount = num(inst.due_amount) || 0;
    if (paidAmount < dueAmount) return true;
    if (inst.status === 'overdue' || inst.status === 'partial') return true;
    return false;
  });

  if (overdueInstallments.length === 0) return null;

  let principalDue = 0;
  let interestDue = 0;
  let totalArrears = 0;
  let totalDue = 0;

  overdueInstallments.forEach((inst) => {
    const dueDate = inst.due_date;
    const dueAmount = num(inst.due_amount) || 0;
    const paidAmount = (num(inst.interest_paid) || 0) + (num(inst.principal_paid) || 0);
    const instArrears = Math.max(0, dueAmount - paidAmount);
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
  });

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

  let loanEndDate = null;
  const disbursedDate = loan.disbursed_at || loan.disbursed_date;
  if (disbursedDate && loan.duration_weeks) {
    const startDate = new Date(disbursedDate);
    if (!isNaN(startDate.getTime())) {
      loanEndDate = new Date(startDate);
      loanEndDate.setDate(loanEndDate.getDate() + (loan.duration_weeks * 7));
    }
  }

  const nextPaymentInstallment = sorted.find((i) => {
    const dueDate = i.due_date;
    if (!dueDate) return false;
    const isFuture = dueDate > today;
    if (!isFuture) return false;
    const paidAmount = (num(i.interest_paid) || 0) + (num(i.principal_paid) || 0);
    const dueAmount = num(i.due_amount) || 0;
    return paidAmount < dueAmount;
  });
  const nextPayment = nextPaymentInstallment ? nextPaymentInstallment.due_date : null;

  const customer = loan.customer || {};
  const branch = loan.branch || {};
  const loanOfficer = loan.loan_officer || {};

  return {
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
    overdueInstallments: overdueInstallments,
  };
};

// ========== Main Component ==========

const LoanArrearsReport = () => {
  // ✅ Get tenant from localStorage ONCE
  const [tenant] = useState(() => {
    try {
      const savedTenant = localStorage.getItem("tenant");
      return savedTenant ? JSON.parse(savedTenant) : null;
    } catch (e) {
      console.error("Error loading tenant:", e);
      return null;
    }
  });

  // ========== State ==========
  const [rawLoans, setRawLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [exportFormat, setExportFormat] = useState("csv");

  const itemsPerPage = 10;

  // ========== Filter State (persisted) ==========
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("loan-arrears-filters");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          search: parsed.search || "",
          branch: parsed.branch || "",
          officer: parsed.officer || "",
          minArrears: parsed.minArrears || "",
          maxArrears: parsed.maxArrears || "",
          minDays: parsed.minDays || "",
          maxDays: parsed.maxDays || "",
        };
      }
    } catch (e) {}
    return {
      search: "",
      branch: "",
      officer: "",
      minArrears: "",
      maxArrears: "",
      minDays: "",
      maxDays: "",
    };
  });

  // ========== Derived Data State ==========
  const [arrearsData, setArrearsData] = useState([]);
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);

  // ========== Refs ==========
  const hasFetchedRef = useRef(false);
  const isMountedRef = useRef(true); // ✅ Track mount state

  // ========== Debounced Save Filters ==========
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem("loan-arrears-filters", JSON.stringify(filters));
      } catch (e) {
        console.error("Failed to save filters:", e);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  // ========== FIXED: Fetch Data (ONCE with caching) ==========
  useEffect(() => {
     isMountedRef.current = true;
    const tenantId = tenant?.id;
    
  // Skip if no tenant or already fetched
  if (!tenantId || hasFetchedRef.current) {
    console.log("⏭️ Skipping arrears fetch - tenantId:", tenantId, "hasFetched:", hasFetchedRef.current);
    return;
  }

    // Mark as fetched IMMEDIATELY to prevent duplicate calls
    hasFetchedRef.current = true;

    const fetchData = async () => {
      console.log("🔄 Starting arrears data fetch for tenant:", tenantId);
      
      try {
        const cacheKey = `loan-arrears-raw-data-${tenantId}`;

        // Try cache first
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            const cacheAge = Date.now() - timestamp;
            
            if (cacheAge < 5 * 60 * 1000) { // 5 minutes cache
              console.log("✅ Using cached arrears data");
              if (isMountedRef.current) {
                setRawLoans(data.loans || []);
                setArrearsData(data.arrears || []);
                setBranches(data.branches || []);
                setOfficers(data.officers || []);
                setLoading(false);
              }
              return;
            } else {
              console.log("⏰ Cache expired, fetching fresh data");
            }
          }
        } catch (e) {
          console.error("Cache read error:", e);
        }

        // Set loading state
        if (isMountedRef.current) {
          setLoading(true);
          setError(null);
        }

        console.log("🌐 Fetching loans with installments from database...");

        // Fetch with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        );

        // Fetch loans with related data
        const fetchPromise = supabase
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
          .eq('tenant_id', tenantId)
          .eq('status', 'disbursed')
          .neq('repayment_state', 'completed')
          .not('disbursed_at', 'is', null);

        const { data: loansWithInstallments, error: loansError } = await Promise.race([
          fetchPromise,
          timeoutPromise
        ]);

        if (loansError) throw loansError;

        console.log("✅ Loans fetched:", loansWithInstallments?.length || 0);

        if (!isMountedRef.current) {
          console.log("🧹 Component unmounted during fetch");
          return;
        }

        console.log("🔄 Calculating arrears for each loan...");

        // Calculate arrears
        const arrears = [];
        (loansWithInstallments || []).forEach((loan) => {
          const calced = calculateLoanArrears(loan, loan.installments || []);
          if (calced) arrears.push(calced);
        });

        console.log("✅ Arrears calculated:", arrears.length, "loans with arrears");

        // Unique branches and officers
        const uniqueBranches = [...new Set(arrears.map(r => r.branch_name))].filter(Boolean).sort();
        const uniqueOfficers = [...new Set(arrears.map(r => r.loan_officer))].filter(Boolean).sort();

        if (isMountedRef.current) {
          setRawLoans(loansWithInstallments || []);
          setArrearsData(arrears);
          setBranches(uniqueBranches);
          setOfficers(uniqueOfficers);
          setLoading(false);
          setError(null);

          try {
            localStorage.setItem(
              cacheKey,
              JSON.stringify({
                data: {
                  loans: loansWithInstallments || [],
                  arrears,
                  branches: uniqueBranches,
                  officers: uniqueOfficers,
                },
                timestamp: Date.now(),
              })
            );
            console.log("✅ Data cached successfully");
          } catch (e) {
            console.error("Cache write error:", e);
          }
        }
      } catch (err) {
        console.error("❌ Error fetching loan arrears:", err);
        if (isMountedRef.current) {
          setError(err.message || "Failed to load data");
          setLoading(false);
          setArrearsData([]); // ✅ Set empty array on error
        }
      }
    };

    fetchData();

    // Cleanup function
    return () => {
      console.log("🧹 Cleanup: Component unmounting");
      isMountedRef.current = false;
    };
  }, [tenant?.id]);

  // ========== Manual Refresh ==========
  const handleManualRefresh = useCallback(async () => {
    const tenantId = tenant?.id;
    if (!tenantId || loading) return;

    console.log("🔄 Manual refresh triggered");

    const cacheKey = `loan-arrears-raw-data-${tenantId}`;
    try {
      localStorage.removeItem(cacheKey);
    } catch (e) {
      console.error("Failed to clear cache:", e);
    }

    try {
      setLoading(true);
      setError(null);

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
          loan_officer:booked_by(full_name),
          installments:loan_installments(*)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'disbursed')
        .neq('repayment_state', 'completed')
        .not('disbursed_at', 'is', null);

      if (loansError) throw loansError;

      // Calculate arrears
      const arrears = [];
      (loansWithInstallments || []).forEach((loan) => {
        const calced = calculateLoanArrears(loan, loan.installments || []);
        if (calced) arrears.push(calced);
      });

      // Unique branches and officers
      const uniqueBranches = [...new Set(arrears.map(r => r.branch_name))].filter(Boolean).sort();
      const uniqueOfficers = [...new Set(arrears.map(r => r.loan_officer))].filter(Boolean).sort();

      setRawLoans(loansWithInstallments || []);
      setArrearsData(arrears);
      setBranches(uniqueBranches);
      setOfficers(uniqueOfficers);

      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            data: {
              loans: loansWithInstallments || [],
              arrears,
              branches: uniqueBranches,
              officers: uniqueOfficers,
            },
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        console.error("Cache write error:", e);
      }

      console.log("✅ Manual refresh complete");
    } catch (err) {
      console.error("❌ Error refreshing loan arrears:", err);
      setError(err.message || "Failed to refresh data");
    } finally {
      setLoading(false);
    }
  }, [loading, tenant?.id]);

  // ========== Filtered Data ==========
  const filteredData = useMemo(() => {
    let result = [...arrearsData];
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

    return result;
  }, [arrearsData, filters]);

  // ========== Pagination ==========
  const pagination = useMemo(() => {
    const totalRows = filteredData.length;
    const totalPages = Math.ceil(totalRows / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, totalRows);
    const currentData = filteredData.slice(startIdx, endIdx);
    return { totalRows, totalPages, startIdx, endIdx, currentData };
  }, [filteredData, currentPage]);

  // ========== Handlers ==========
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      branch: "",
      officer: "",
      minArrears: "",
      maxArrears: "",
      minDays: "",
      maxDays: "",
    });
    setCurrentPage(1);
  }, []);

  // ========== Export Functions ==========
  const getCurrentTimestamp = useCallback(() => {
    const now = new Date();
    return now.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
  }, []);

  const exportToPDF = useCallback(() => {
    if (!filteredData.length) return alert("No data to export");
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
    doc.text(`Generated: ${getCurrentTimestamp()}`, 14, 38);

    const tableHeaders = [
      ["No", "Customer", "ID/Phone", "Branch", "Officer", "Product", "Disbursed", "Principal Due", "Interest Due", "Arrears", "Days"]
    ];

    const tableData = filteredData.map((r, idx) => [
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
  }, [filteredData, tenant, getCurrentTimestamp]);

  const exportToCSV = useCallback(() => {
    if (!filteredData.length) return alert("No data to export");
    const companyName = tenant?.company_name || "Jasiri Capital";

    const headers = [
      "No.", "Customer Name", "Phone Number", "Id Number", "Branch Name",
      "Loan Officer", "Loan Product", "Disbursed Amount", "Principal Due",
      "Interest Due", "Arrears Amount", "Over Due Days", "Next Payment Date"
    ];

    const rows = filteredData.map((r, idx) => [
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
    const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" });
    const companySlug = companyName.toLowerCase().replace(/ /g, '_');
    const timestamp = new Date().toISOString().split("T")[0];
    saveAs(blob, `${companySlug}_arrears_${timestamp}.csv`);
  }, [filteredData, tenant]);

  const handleExport = useCallback(() => {
    if (exportFormat === "csv") exportToCSV();
    else if (exportFormat === "pdf") exportToPDF();
  }, [exportFormat, exportToCSV, exportToPDF]);

  // ========== Options ==========
  const exportFormatOptions = [
    { value: "csv", label: "CSV" },
    { value: "pdf", label: "PDF" },
  ];

  // ✅ Show loading state with custom Spinner
  if (loading && arrearsData.length === 0) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <Spinner text="Loading Loan Arrears Report..." />
      </div>
    );
  }

  // ✅ Show error state with retry option
  if (error && arrearsData.length === 0) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <X className="w-16 h-16 mx-auto mb-2" />
            <p className="text-lg font-semibold">Failed to load report</p>
            <p className="text-sm text-gray-600 mt-2">{error}</p>
          </div>
          <button
            onClick={handleManualRefresh}
            className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-brand-secondary transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header Section - Aligned with other reports */}
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

            <div className="flex flex-col items-end gap-2">
              <div className="text-sm text-white/70 text-right">
                <p>Generated on:</p>
                <p className="font-medium text-white">{getCurrentTimestamp()}</p>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap justify-end">
                <SearchBox
                  value={filters.search}
                  onChange={(val) => handleFilterChange("search", val)}
                />
                <button
                  onClick={handleManualRefresh}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border text-white border-white/20 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
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
                    {exportFormatOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
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

        {/* Filters Panel */}
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
                  onChange={(e) => handleFilterChange("branch", e.target.value)}
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
                  onChange={(e) => handleFilterChange("officer", e.target.value)}
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
                    onChange={(e) => handleFilterChange("minArrears", e.target.value)}
                    className="w-1/2 border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxArrears}
                    onChange={(e) => handleFilterChange("maxArrears", e.target.value)}
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
                    onChange={(e) => handleFilterChange("minDays", e.target.value)}
                    className="w-1/2 border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxDays}
                    onChange={(e) => handleFilterChange("maxDays", e.target.value)}
                    className="w-1/2 border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500 font-medium">
                Matches: <span className="text-accent font-bold">{filteredData.length}</span> / {arrearsData.length}
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
          ) : !filteredData.length ? (
            <div className="p-12 text-center">
              <Check className="w-16 h-16 text-green-200 mx-auto mb-4" />
              <p className="text-slate-900 text-lg font-bold">No arrears found</p>
              <p className="text-slate-500">All loans are currently up-to-date or match your filters.</p>
              {arrearsData.length > 0 && (
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
                  <tbody className="divide-y divide-slate-100">
                    {pagination.currentData.map((row, idx) => (
                      <ArrearsTableRow
                        key={row.id}
                        row={row}
                        index={idx}
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Showing <span className="font-bold text-slate-900">{pagination.startIdx + 1}</span> to{" "}
                    <span className="font-bold text-slate-900">{pagination.endIdx}</span> of{" "}
                    <span className="font-bold text-slate-900">{pagination.totalRows}</span> loans
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
                      {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, i) => {
                        let pageNum;
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-9 h-9 rounded-lg border text-sm font-bold transition-all 
                              ${currentPage === pageNum
                                ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:border-brand-primary hover:text-brand-primary"
                              }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                      disabled={currentPage === pagination.totalPages}
                      className="p-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoanArrearsReport;