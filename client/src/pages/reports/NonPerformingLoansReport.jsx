import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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

// ========== Memoized Helper Components ==========

const SearchBox = React.memo(({ value, onChange }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search name, ID, or phone"
      className="border bg-gray-50 border-gray-300 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm w-64"
    />
  </div>
));
SearchBox.displayName = "SearchBox";

const Spinner = ({ text }) => (
  <div className="flex flex-col items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    {text && <p className="mt-4 text-gray-600">{text}</p>}
  </div>
);

const SortableHeader = React.memo(({ label, sortKey, sortConfig, onSort }) => {
  return (
    <th
      onClick={() => onSort(sortKey)}
      className="px-6 py-4 text-[11px] font-black text-slate-500 tracking-widest cursor-pointer hover:bg-slate-100/80 transition-all font-inter whitespace-nowrap"
    >
      <div className="flex items-center gap-2">
        {label}
        <div className="flex flex-col">
          <ChevronUp
            className={`w-3 h-3 -mb-1 transition-colors ${
              sortConfig.key === sortKey && sortConfig.direction === "asc"
                ? "text-brand-primary"
                : "text-slate-300"
            }`}
          />
          <ChevronDown
            className={`w-3 h-3 transition-colors ${
              sortConfig.key === sortKey && sortConfig.direction === "desc"
                ? "text-brand-primary"
                : "text-slate-300"
            }`}
          />
        </div>
      </div>
    </th>
  );
});
SortableHeader.displayName = "SortableHeader";

const NPLTableRow = React.memo(({ row, index, startIdx, formatCurrency }) => {
  const overdueClass =
    row.overdue_days > 30
      ? "bg-red-50 text-red-700"
      : "bg-orange-50 text-orange-700";

  return (
    <tr className="hover:bg-slate-50/50 transition-colors group">
      <td className="px-6 py-4 text-slate-400 font-medium">{startIdx + index + 1}</td>
      <td className="px-6 py-4 font-bold text-slate-900 group-hover:text-brand-primary transition-colors whitespace-nowrap">
        {row.customer_name}
      </td>
      <td className="px-6 py-4 font-semibold text-slate-600 whitespace-nowrap">
        {row.customer_id}
      </td>
      <td className="px-6 py-4 font-semibold text-slate-600 whitespace-nowrap">
        {row.mobile}
      </td>
      <td className="px-6 py-4 font-semibold text-slate-600 whitespace-nowrap">
        {row.branch}
      </td>
      <td className="px-6 py-4 font-semibold text-brand-primary whitespace-nowrap">
        {row.loan_officer}
      </td>
      <td className="px-6 py-4 font-semibold text-slate-600 whitespace-nowrap">
        {row.loan_product}
      </td>
      <td className="px-6 py-4 font-black text-slate-900 whitespace-nowrap bg-green-50/30">
        {formatCurrency(row.disbursement_amount)}
      </td>
      <td className="px-6 py-4 font-semibold text-slate-600 whitespace-nowrap">
        {formatCurrency(row.total_principal_due)}
      </td>
      <td className="px-6 py-4 font-semibold text-slate-600 whitespace-nowrap">
        {formatCurrency(row.total_interest_due)}
      </td>
      <td className="px-6 py-4 font-bold text-green-600 whitespace-nowrap">
        {formatCurrency(row.principal_paid)}
      </td>
      <td className="px-6 py-4 font-bold text-green-600 whitespace-nowrap">
        {formatCurrency(row.interest_paid)}
      </td>
      <td className="px-6 py-4 font-black text-red-600 whitespace-nowrap">
        {formatCurrency(row.arrears_amount)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-tighter ${overdueClass}`}
        >
          {row.overdue_days} DAYS
        </span>
      </td>
      <td className="px-6 py-4 font-bold text-slate-600 whitespace-nowrap">
        {row.next_payment_date}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm border ${
            row.repayment_state === "defaulted"
              ? "bg-red-500 border-red-400 text-white"
              : "bg-orange-100 border-orange-200 text-orange-700"
          }`}
        >
          {row.repayment_state}
        </span>
      </td>
    </tr>
  );
});
NPLTableRow.displayName = "NPLTableRow";

// ========== Helper Functions ==========
const formatCurrency = (num) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(num || 0);

const getCurrentTimestamp = () => {
  const now = new Date();
  return now.toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getDateRange = (filter, customStartDate, customEndDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let start, end;

  switch (filter) {
    case "today":
      start = new Date(today);
      end = new Date(today);
      end.setHours(23, 59, 59, 999);
      break;
    case "week":
      start = new Date(today);
      start.setDate(start.getDate() - start.getDay());
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case "month":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "quarter":
      const currentQuarter = Math.floor(today.getMonth() / 3);
      start = new Date(today.getFullYear(), currentQuarter * 3, 1);
      end = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "year":
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
      break;
    case "custom":
      start = customStartDate ? new Date(customStartDate) : new Date(0);
      start.setHours(0, 0, 0, 0);
      end = customEndDate ? new Date(customEndDate) : new Date();
      end.setHours(23, 59, 59, 999);
      break;
    default:
      return null;
  }
  return { start, end };
};

const groupLoansForDisplay = (loans) => {
  const branchTotals = {};
  const officerTotals = {};

  loans.forEach((loan) => {
    const branchName = loan.branch || "Unknown Branch";
    const officerName = loan.loan_officer || "Unknown Officer";

    if (!branchTotals[branchName]) branchTotals[branchName] = 0;
    branchTotals[branchName] += loan.arrears_amount || 0;

    const officerKey = `${branchName}-${officerName}`;
    if (!officerTotals[officerKey]) officerTotals[officerKey] = 0;
    officerTotals[officerKey] += loan.arrears_amount || 0;
  });

  const groupedByBranch = {};
  loans.forEach((loan) => {
    const branchName = loan.branch || "Unknown Branch";
    const officerName = loan.loan_officer || "Unknown Officer";

    if (!groupedByBranch[branchName]) {
      groupedByBranch[branchName] = {
        branch: branchName,
        totalAmount: branchTotals[branchName],
        officers: {},
      };
    }

    if (!groupedByBranch[branchName].officers[officerName]) {
      const officerKey = `${branchName}-${officerName}`;
      groupedByBranch[branchName].officers[officerName] = {
        officer: officerName,
        roTotalAmount: officerTotals[officerKey],
        customers: [],
      };
    }
    groupedByBranch[branchName].officers[officerName].customers.push(loan);
  });
  return groupedByBranch;
};

// ========== Main Component ==========

const NonPerformingLoansReport = () => {
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
  const [rawNPLs, setRawNPLs] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [exportFormat, setExportFormat] = useState("csv");

  const itemsPerPage = 10;

  // ========== Combined Filters State (persisted) ==========
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("npl-report-filters");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          search: parsed.search || "",
          region: parsed.region || "",
          branch: parsed.branch || "",
          loanOfficer: parsed.loanOfficer || "",
          status: parsed.status || "all",
          product: parsed.product || "",
          dateFilter: parsed.dateFilter || "all",
          customStartDate: parsed.customStartDate || "",
          customEndDate: parsed.customEndDate || "",
        };
      }
    } catch (e) {}
    return {
      search: "",
      region: "",
      branch: "",
      loanOfficer: "",
      status: "all",
      product: "",
      dateFilter: "all",
      customStartDate: "",
      customEndDate: "",
    };
  });

  // ========== Refs ==========
  const abortControllerRef = useRef(null);
  const tenantIdRef = useRef(tenant?.id);

  // ========== Debounced Save Filters ==========
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem("npl-report-filters", JSON.stringify(filters));
      } catch (e) {
        console.error("Failed to save filters:", e);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  // ========== Fetch Branches, Regions, Officers (ONCE) ==========
  useEffect(() => {
    const tenantId = tenantIdRef.current;
    if (!tenantId || branches.length > 0) return;

    let mounted = true;

    const fetchInitialData = async () => {
      try {
        const [branchesRes, regionsRes, usersRes] = await Promise.all([
          supabase
            .from("branches")
            .select("id, name, region_id")
            .eq("tenant_id", tenantId),
          supabase
            .from("regions")
            .select("id, name")
            .eq("tenant_id", tenantId),
          supabase
            .from("users")
            .select("id, full_name")
            .eq("role", "relationship_officer")
            .eq("tenant_id", tenantId),
        ]);

        if (mounted) {
          if (!branchesRes.error) setBranches(branchesRes.data || []);
          if (!regionsRes.error) setRegions(regionsRes.data || []);
          if (!usersRes.error) setOfficers(usersRes.data || []);
        }
      } catch (err) {
        console.error("Error fetching initial data:", err);
      }
    };

    fetchInitialData();

    return () => {
      mounted = false;
    };
  }, []);

 // ========== Fetch NPL Data (Safe + No Infinite Spinner) ==========
useEffect(() => {
  const tenantId = tenant?.id;

  // If no tenant, stop initial loading immediately
  if (!tenantId) {
    setIsInitialLoad(false);
    return;
  }

  let mounted = true;

  const fetchNonPerformingLoans = async () => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      const cacheKey = `npl-raw-data-${tenantId}`;

      // ✅ Try cache first
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const cacheAge = Date.now() - timestamp;

          // 24-hour cache
          if (cacheAge < 24 * 60 * 60 * 1000) {
            if (mounted) {
              setRawNPLs(data || []);
              setIsInitialLoad(false);
            }
            return;
          }
        }
      } catch (err) {
        console.error("Cache read error:", err);
      }

      if (mounted) setLoading(true);

      const [
        loansRes,
        installmentsRes,
        customersRes,
        usersRes,
        branchesRes,
      ] = await Promise.all([
        supabase
          .from("loans")
          .select(
            "id, customer_id, booked_by, branch_id, product_name, scored_amount, disbursed_at, status, repayment_state, duration_weeks, total_interest, total_payable, weekly_payment"
          )
          .in("repayment_state", ["overdue", "defaulted"])
          .eq("tenant_id", tenantId)
          .abortSignal(signal),

        supabase
          .from("loan_installments")
          .select(
            "loan_id, installment_number, due_date, due_amount, principal_amount, interest_amount, paid_amount, status, days_overdue"
          )
          .eq("tenant_id", tenantId)
          .abortSignal(signal),

        supabase
          .from("customers")
          .select("id, Firstname, Middlename, Surname, id_number, mobile")
          .eq("tenant_id", tenantId)
          .abortSignal(signal),

        supabase
          .from("users")
          .select("id, full_name")
          .eq("role", "relationship_officer")
          .eq("tenant_id", tenantId)
          .abortSignal(signal),

        supabase
          .from("branches")
          .select("id, name, region_id")
          .eq("tenant_id", tenantId)
          .abortSignal(signal),
      ]);

      if (
        loansRes.error ||
        installmentsRes.error ||
        customersRes.error ||
        usersRes.error ||
        branchesRes.error
      ) {
        throw (
          loansRes.error ||
          installmentsRes.error ||
          customersRes.error ||
          usersRes.error ||
          branchesRes.error
        );
      }

      const loans = loansRes.data || [];
      const installmentsArr = installmentsRes.data || [];
      const customers = customersRes.data || [];
      const relationshipOfficers = usersRes.data || [];
      const branchList = branchesRes.data || [];

      const nplReports = loans.map((loan) => {
        const customer = customers.find((c) => c.id === loan.customer_id);
        const loanOfficer = relationshipOfficers.find(
          (u) => u.id === loan.booked_by
        );
        const branch = branchList.find((b) => b.id === loan.branch_id);

        const fullName = customer
          ? [customer.Firstname, customer.Middlename, customer.Surname]
              .filter(Boolean)
              .join(" ")
          : "N/A";

        const loanInstallments = installmentsArr.filter(
          (i) => i.loan_id === loan.id
        );

        let totalPrincipalDue = 0;
        let totalInterestDue = 0;
        let principalPaid = 0;
        let interestPaid = 0;
        let arrearsAmount = 0;
        let overdueDays = 0;
        let nextPaymentDate = null;

        loanInstallments.forEach((installment) => {
          const principal = Number(installment.principal_amount) || 0;
          const interest = Number(installment.interest_amount) || 0;
          const paidAmount = Number(installment.paid_amount) || 0;
          const dueAmount = Number(installment.due_amount) || 0;

          totalPrincipalDue += principal;
          totalInterestDue += interest;

          if (dueAmount > 0) {
            const principalRatio = principal / dueAmount;
            const interestRatio = interest / dueAmount;
            principalPaid += paidAmount * principalRatio;
            interestPaid += paidAmount * interestRatio;
          }

          if (["overdue", "partial", "defaulted"].includes(installment.status)) {
            arrearsAmount += dueAmount - paidAmount;
            overdueDays = Math.max(
              overdueDays,
              installment.days_overdue || 0
            );
          }

          if (["pending", "partial", "overdue"].includes(installment.status)) {
            const dueDate = new Date(installment.due_date);
            if (!nextPaymentDate || dueDate < nextPaymentDate) {
              nextPaymentDate = dueDate;
            }
          }
        });

        return {
          id: loan.id,
          customer_name: fullName,
          customer_id: customer?.id_number || "N/A",
          mobile: customer?.mobile || "N/A",
          branch: branch?.name || "N/A",
          branch_id: branch?.id || null,
          region_id: branch?.region_id || null,
          loan_officer: loanOfficer?.full_name || "N/A",
          officer_id: loanOfficer?.id || null,
          loan_product: loan.product_name || "N/A",
          disbursement_amount: Number(loan.scored_amount) || 0,
          installment_amount: Number(loan.weekly_payment) || 0,
          total_principal_due: totalPrincipalDue,
          total_interest_due: totalInterestDue,
          principal_paid: principalPaid,
          interest_paid: interestPaid,
          arrears_amount: arrearsAmount,
          overdue_days: overdueDays,
          loan_start_date_raw: loan.disbursed_at,
          loan_start_date: loan.disbursed_at
            ? new Date(loan.disbursed_at).toLocaleDateString()
            : "N/A",
          next_payment_date: nextPaymentDate
            ? nextPaymentDate.toLocaleDateString()
            : "N/A",
          repayment_state: loan.repayment_state,
        };
      });

      if (mounted) {
        setRawNPLs(nplReports);

        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              data: nplReports,
              timestamp: Date.now(),
            })
          );
        } catch (err) {
          console.error("Cache write error:", err);
        }
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.error("Error fetching NPL data:", err);
    } finally {
      if (mounted) {
        setLoading(false);
        setIsInitialLoad(false);
      }
    }
  };

  fetchNonPerformingLoans();

  return () => {
    mounted = false;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
}, [tenant?.id]);




  // ========== Filtered Data ==========
  const filteredData = useMemo(() => {
    let result = [...rawNPLs];

    // Search filter - FIXED: Convert customer_id to string before calling toLowerCase()
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) =>
          r.customer_name.toLowerCase().includes(q) ||
          String(r.customer_id).toLowerCase().includes(q) ||
          r.mobile.includes(q)
      );
    }

    // Region filter
    if (filters.region) {
      result = result.filter((r) => r.region_id === filters.region);
    }

    // Branch filter
    if (filters.branch) {
      result = result.filter((r) => r.branch_id === filters.branch);
    }

    // Loan officer filter
    if (filters.loanOfficer) {
      result = result.filter((r) => r.officer_id === filters.loanOfficer);
    }

    // Status filter
    if (filters.status !== "all") {
      result = result.filter((r) => r.repayment_state === filters.status);
    }

    // Product filter
    if (filters.product) {
      result = result.filter((r) => r.loan_product === filters.product);
    }

    // Date filter
    if (filters.dateFilter !== "all") {
      const range = getDateRange(
        filters.dateFilter,
        filters.customStartDate,
        filters.customEndDate
      );
      if (range) {
        result = result.filter((r) => {
          const loanDate = new Date(r.loan_start_date_raw);
          return loanDate >= range.start && loanDate <= range.end;
        });
      }
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

    return result;
  }, [rawNPLs, filters, sortConfig]);

  // ========== Totals ==========
  const totals = useMemo(() => {
    const arrearsAmount = filteredData.reduce(
      (sum, r) => sum + r.arrears_amount,
      0
    );
    const disbursementAmount = filteredData.reduce(
      (sum, r) => sum + r.disbursement_amount,
      0
    );
    const overdueCount = filteredData.filter(
      (r) => r.repayment_state === "overdue"
    ).length;
    const defaultedCount = filteredData.filter(
      (r) => r.repayment_state === "defaulted"
    ).length;
    return { arrearsAmount, disbursementAmount, overdueCount, defaultedCount };
  }, [filteredData]);

  // ========== Dropdown Options ==========
  const getFilteredBranches = useCallback(() => {
    if (!filters.region) return branches;
    return branches.filter((b) => b.region_id === filters.region);
  }, [branches, filters.region]);

  const getFilteredOfficers = useCallback(() => {
    if (filters.branch) {
      const officersInBranch = rawNPLs
        .filter((r) => r.branch_id === filters.branch)
        .map((r) => ({ id: r.officer_id, full_name: r.loan_officer }));
      return officersInBranch.filter(
        (o, i, self) => i === self.findIndex((x) => x.id === o.id)
      );
    }
    if (filters.region) {
      const officersInRegion = rawNPLs
        .filter((r) => r.region_id === filters.region)
        .map((r) => ({ id: r.officer_id, full_name: r.loan_officer }));
      return officersInRegion.filter(
        (o, i, self) => i === self.findIndex((x) => x.id === o.id)
      );
    }
    return officers;
  }, [rawNPLs, branches, filters.branch, filters.region, officers]);

  const products = useMemo(() => {
    return [...new Set(rawNPLs.map((r) => r.loan_product).filter(Boolean))];
  }, [rawNPLs]);

  // ========== Pagination ==========
  const pagination = useMemo(() => {
    const totalRows = filteredData.length;
    const totalPages = Math.ceil(totalRows / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, totalRows);
    const currentData = filteredData.slice(startIdx, endIdx);
    return { totalRows, totalPages, startIdx, endIdx, currentData };
  }, [filteredData, currentPage]);

  // ========== Reset Page on Filter Change ==========
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortConfig]);

  // ========== Handlers ==========
  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      if (key === "region") {
        newFilters.branch = "";
        newFilters.loanOfficer = "";
      }
      if (key === "branch") {
        newFilters.loanOfficer = "";
      }
      return newFilters;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      region: "",
      branch: "",
      loanOfficer: "",
      status: "all",
      product: "",
      dateFilter: "all",
      customStartDate: "",
      customEndDate: "",
    });
  }, []);

  // ========== Export Functions ==========
  const exportToPDF = useCallback(
    (companyName, dateStr) => {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text(`${companyName} - Non-Performing Loans Report`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${getCurrentTimestamp()}`, 14, 22);

      const headers = [
        [
          "No.",
          "Branch",
          "RO",
          "Customer",
          "ID Number",
          "Mobile",
          "Product",
          "Disbursed",
          "Princ. Due",
          "Int. Due",
          "Arrears",
          "Days Overdue",
          "Status",
        ],
      ];

      const groupedData = groupLoansForDisplay(filteredData);
      const rows = [];
      let branchNum = 1;

      Object.values(groupedData).forEach((branch) => {
        Object.values(branch.officers).forEach((officer) => {
          officer.customers.forEach((cust, i) => {
            rows.push([
              i === 0 ? branchNum : "",
              i === 0 ? branch.branch : "",
              i === 0 ? officer.officer : "",
              cust.customer_name,
              cust.customer_id,
              cust.mobile,
              cust.loan_product,
              formatCurrency(cust.disbursement_amount),
              formatCurrency(cust.total_principal_due),
              formatCurrency(cust.total_interest_due),
              formatCurrency(cust.arrears_amount),
              cust.overdue_days,
              cust.repayment_state,
            ]);
          });
        });
        branchNum++;
      });

      autoTable(doc, {
        head: headers,
        body: rows,
        startY: 28,
        styles: { fontSize: 7 },
      });
      doc.save(`${companyName.replace(/ /g, "_")}_NPL_Report_${dateStr}.pdf`);
    },
    [filteredData]
  );

  const exportToExcel = useCallback(
    (companySlug, dateStr) => {
      const ws = XLSX.utils.json_to_sheet(
        filteredData.map((r, i) => ({
          No: i + 1,
          Customer: r.customer_name,
          ID: r.customer_id,
          Mobile: r.mobile,
          Branch: r.branch,
          Officer: r.loan_officer,
          Product: r.loan_product,
          Disbursed: r.disbursement_amount,
          "Principal Due": r.total_principal_due,
          "Interest Due": r.total_interest_due,
          Arrears: r.arrears_amount,
          Overdue: r.overdue_days,
          Status: r.repayment_state,
        }))
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "NPL Report");
      XLSX.writeFile(wb, `${companySlug}-npl-report-${dateStr}.xlsx`);
    },
    [filteredData]
  );

  const exportToWord = useCallback(
    async (companyName, dateStr) => {
      const tableRows = filteredData.map(
        (r, i) =>
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(String(i + 1))] }),
              new TableCell({ children: [new Paragraph(r.customer_name)] }),
              new TableCell({ children: [new Paragraph(r.branch)] }),
              new TableCell({ children: [new Paragraph(r.loan_officer)] }),
              new TableCell({
                children: [new Paragraph(formatCurrency(r.disbursement_amount))],
              }),
              new TableCell({
                children: [new Paragraph(formatCurrency(r.arrears_amount))],
              }),
            ],
          })
      );

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${companyName} - NPL Report`,
                    bold: true,
                    size: 28,
                  }),
                ],
              }),
              new Table({
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph("No")] }),
                      new TableCell({ children: [new Paragraph("Customer")] }),
                      new TableCell({ children: [new Paragraph("Branch")] }),
                      new TableCell({ children: [new Paragraph("Officer")] }),
                      new TableCell({ children: [new Paragraph("Disbursed")] }),
                      new TableCell({ children: [new Paragraph("Arrears")] }),
                    ],
                  }),
                  ...tableRows,
                ],
              }),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${companyName.replace(/ /g, "_")}_NPL_Report_${dateStr}.docx`);
    },
    [filteredData]
  );

  const exportToCSV = useCallback(
    (companySlug, dateStr) => {
      const headers = [
        "No.",
        "Branch",
        "Total Arrears",
        "Officer",
        "RO Total Arrears",
        "Customer",
        "ID",
        "Mobile",
        "Product",
        "Disbursed",
        "Principal Due",
        "Interest Due",
        "Arrears",
        "Overdue Days",
        "Status",
      ];

      const groupedData = groupLoansForDisplay(filteredData);
      let flattenedData = [];
      let branchNumber = 1;

      Object.values(groupedData).forEach((branch) => {
        Object.values(branch.officers).forEach((officer) => {
          officer.customers.forEach((customer, customerIndex) => {
            flattenedData.push([
              customerIndex === 0 ? branchNumber : "",
              customerIndex === 0 ? branch.branch : "",
              customerIndex === 0 ? formatCurrency(branch.totalAmount) : "",
              customerIndex === 0 ? officer.officer : "",
              customerIndex === 0 ? formatCurrency(officer.roTotalAmount) : "",
              customer.customer_name,
              customer.customer_id,
              customer.mobile,
              customer.loan_product,
              formatCurrency(customer.disbursement_amount),
              formatCurrency(customer.total_principal_due),
              formatCurrency(customer.total_interest_due),
              formatCurrency(customer.arrears_amount),
              customer.overdue_days,
              customer.repayment_state,
            ]);
          });
        });
        branchNumber++;
      });

      const csvContent = [
        headers.join(","),
        ...flattenedData.map((row) =>
          row
            .map((f) =>
              typeof f === "string" && f.includes(",") ? `"${f}"` : f
            )
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${companySlug}-npl-report-${dateStr}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    },
    [filteredData]
  );

  const handleExport = useCallback(() => {
    if (filteredData.length === 0) return alert("No data to export");

    const companyName = tenant?.company_name || "Company";
    const companySlug = companyName.toLowerCase().replace(/ /g, "-");
    const dateStr = new Date().toISOString().split("T")[0];

    switch (exportFormat) {
      case "csv":
        exportToCSV(companySlug, dateStr);
        break;
      case "excel":
        exportToExcel(companySlug, dateStr);
        break;
      case "pdf":
        exportToPDF(companyName, dateStr);
        break;
      case "word":
        exportToWord(companyName, dateStr);
        break;
      default:
        exportToCSV(companySlug, dateStr);
    }
  }, [
    filteredData,
    exportFormat,
    tenant,
    exportToCSV,
    exportToExcel,
    exportToPDF,
    exportToWord,
  ]);

  // ========== Options ==========
  const dateFilterOptions = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "quarter", label: "This Quarter" },
    { value: "year", label: "This Year" },
    { value: "custom", label: "Custom Range" },
  ];

  const exportFormatOptions = [
    { value: "csv", label: "CSV" },
    { value: "excel", label: "Excel" },
    { value: "pdf", label: "PDF" },
    { value: "word", label: "Word" },
  ];

  if (loading && isInitialLoad) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <Spinner text="Loading Non-Performing Loans Report..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface p-4 sm:p-6 lg:p-8">
      <div className="max-w-full mx-auto space-y-8">
        {/* PREMIUM HEADER */}
        <div className="bg-brand-secondary rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
             
              <div>
                <h1 className="text-sm font-bold text-stone-600">
                  {tenant?.company_name || "Company Name"}
                </h1>
               
                <h2 className="text-lg font-semibold text-white mt-1">
                  Non-Performing Loans Report
                </h2>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 text-right">
          
              <div className="flex gap-2 mt-2 flex-wrap justify-end">
                <SearchBox
                  value={filters.search}
                  onChange={(val) => handleFilterChange("search", val)}
                />
            
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border ${
                    showFilters
                      ? "bg-accent text-white shadow-md border-transparent hover:bg-brand-secondary"
                      : "text-white border-white/20 hover:bg-white/10"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                </button>

                <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 p-1">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="bg-transparent text-sm font-medium text-gray-700 px-2 py-1 focus:outline-none cursor-pointer"
                  >
                    {exportFormatOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleExport}
                    className="ml-2 px-3 py-1.5 rounded-md bg-accent text-white text-sm font-medium hover:bg-brand-secondary transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* HIERARCHICAL FILTERS */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 tracking-wider ml-1">
                    Date Range
                  </label>
                  <select
                    value={filters.dateFilter}
                    onChange={(e) => handleFilterChange("dateFilter", e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                  >
                    {dateFilterOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {filters.dateFilter === "custom" && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 tracking-wider ml-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={filters.customStartDate}
                        onChange={(e) =>
                          handleFilterChange("customStartDate", e.target.value)
                        }
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 tracking-wider ml-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={filters.customEndDate}
                        onChange={(e) =>
                          handleFilterChange("customEndDate", e.target.value)
                        }
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 tracking-wider ml-1">
                    Region
                  </label>
                  <select
                    value={filters.region}
                    onChange={(e) => {
                      handleFilterChange("region", e.target.value);
                      handleFilterChange("branch", "");
                      handleFilterChange("loanOfficer", "");
                    }}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                  >
                    <option value="">All Regions</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 tracking-wider ml-1">
                    Branch
                  </label>
                  <select
                    value={filters.branch}
                    onChange={(e) => {
                      handleFilterChange("branch", e.target.value);
                      handleFilterChange("loanOfficer", "");
                    }}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                  >
                    <option value="">All Branches</option>
                    {getFilteredBranches().map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 tracking-wider ml-1">
                    Officer
                  </label>
                  <select
                    value={filters.loanOfficer}
                    onChange={(e) =>
                      handleFilterChange("loanOfficer", e.target.value)
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                  >
                    <option value="">All Officers</option>
                    {getFilteredOfficers().map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 tracking-wider ml-1">
                    Product
                  </label>
                  <select
                    value={filters.product}
                    onChange={(e) => handleFilterChange("product", e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                  >
                    <option value="">All Products</option>
                    {products.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 tracking-wider ml-1">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange("status", e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                  >
                    <option value="all">All States</option>
                    <option value="overdue">Overdue</option>
                    <option value="defaulted">Defaulted</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={clearFilters}
                  className="text-sm font-semibold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1.5 ml-1"
                >
                  <X className="w-4 h-4" />
                  Clear All Filters
                </button>
                <p className="text-xs text-slate-400 font-medium">
                  Showing {filteredData.length} matches
                </p>
              </div>
            </div>
          )}
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-amber-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Total Arrears</p>
            <p className="text-2xl font-bold mt-1 text-primary">
              {formatCurrency(totals.arrearsAmount)}
            </p>
          </div>

          <div className="bg-emerald-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Total Disbursed</p>
            <p className="text-2xl font-bold mt-1 text-accent">
              {formatCurrency(totals.disbursementAmount)}
            </p>
          </div>

          <div className="bg-purple-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted font-medium">Number of NPLs</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                LOANS
              </span>
            </div>
            <p className="text-2xl font-bold mt-1 text-gray-900">
              {filteredData.length}
            </p>
          </div>

          <div className="bg-red-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted font-medium">Defaulted Count</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded animate-pulse">
                CRITICAL
              </span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">
              {totals.defaultedCount}
            </p>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-24 space-y-4">
              <div className="w-12 h-12 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
              <p className="text-slate-500 font-bold animate-pulse">
                Analyzing loan performance...
              </p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-24 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Search className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                No NPLs Found
              </h3>
              <p className="text-slate-500 max-w-xs">
                We couldn't find any non-performing loans matching your current
                filter criteria.
              </p>
              <button
                onClick={clearFilters}
                className="mt-6 text-brand-primary font-bold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-[11px] font-black text-slate-500 tracking-widest whitespace-nowrap w-16">
                        #
                      </th>
                      <SortableHeader
                        label="Customer"
                        sortKey="customer_name"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="ID Number"
                        sortKey="customer_id"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Mobile"
                        sortKey="mobile"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Branch"
                        sortKey="branch"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Officer"
                        sortKey="loan_officer"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Product"
                        sortKey="loan_product"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Disbursed"
                        sortKey="disbursement_amount"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Principal Due"
                        sortKey="total_principal_due"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Interest Due"
                        sortKey="total_interest_due"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Principal Paid"
                        sortKey="principal_paid"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Interest Paid"
                        sortKey="interest_paid"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Arrears"
                        sortKey="arrears_amount"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Overdue"
                        sortKey="overdue_days"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Next Due"
                        sortKey="next_payment_date"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Status"
                        sortKey="repayment_state"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {pagination.currentData.map((row, idx) => (
                      <NPLTableRow
                        key={row.id}
                        row={row}
                        index={idx}
                        startIdx={pagination.startIdx}
                        formatCurrency={formatCurrency}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              {pagination.totalPages > 1 && (
                <div className="bg-slate-50/50 px-6 py-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm font-medium text-slate-500">
                    Showing{" "}
                    <span className="font-bold text-slate-700">
                      {pagination.startIdx + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-bold text-slate-700">
                      {pagination.endIdx}
                    </span>{" "}
                    of{" "}
                    <span className="font-bold text-slate-900">
                      {pagination.totalRows}
                    </span>{" "}
                    entries
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-1.5">
                      {Array.from({
                        length: Math.min(5, pagination.totalPages),
                      }).map((_, i) => {
                        let pageNum;
                        if (pagination.totalPages <= 5) pageNum = i + 1;
                        else if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= pagination.totalPages - 2)
                          pageNum = pagination.totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`min-w-[40px] h-10 rounded-xl font-bold transition-all shadow-sm ${
                              currentPage === pageNum
                                ? "bg-brand-primary text-white scale-105 shadow-brand-primary/20"
                                : "bg-white border border-slate-200 text-slate-600 hover:border-brand-primary/30 hover:bg-slate-50"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() =>
                        setCurrentPage((prev) =>
                          Math.min(pagination.totalPages, prev + 1)
                        )
                      }
                      disabled={currentPage === pagination.totalPages}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
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

export default NonPerformingLoansReport;