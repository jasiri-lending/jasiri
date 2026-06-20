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
  AlertCircle,
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
import { useAuth } from "../../hooks/userAuth";
import { SkeletonTable } from "../../components/Skeleton";
import { Pagination } from "../../components/Pagination";
import CustomSelect from "../../components/CustomSelect";

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

// Local Spinner component removed

const SortableHeader = React.memo(({ label, sortKey, sortConfig, onSort }) => (
  <th
    onClick={() => onSort(sortKey)}
    className="px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider cursor-pointer hover:bg-surface/70 transition-colors whitespace-nowrap text-left border-b border-border"
  >
    <div className="flex items-center gap-1.5">
      {label}
      {sortConfig.key === sortKey ? (
        sortConfig.direction === "asc" ? (
          <ChevronUp className="w-3.5 h-3.5 text-brand" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-brand" />
        )
      ) : (
        <ChevronDown className="w-3.5 h-3.5 text-muted opacity-30 hover:opacity-100" />
      )}
    </div>
  </th>
));
SortableHeader.displayName = "SortableHeader";

const NPLTableRow = React.memo(({ row, index, startIdx, formatCurrency }) => {
  const overdueClass =
    row.overdue_days > 30
      ? "bg-danger/10 text-danger border border-danger/20"
      : "bg-warning/10 text-warning border border-warning/20";

  return (
    <tr className="hover:bg-surface transition-colors duration-150 border-b border-border-light">
      <td className="px-6 py-4 text-xs font-medium text-text-muted whitespace-nowrap text-center">
        {startIdx + index + 1}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {row.customer_name}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {row.customer_id}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {row.mobile}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {row.branch}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {row.loan_officer}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {row.loan_product}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary text-right whitespace-nowrap tabular-nums">
        {formatCurrency(row.disbursement_amount)}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary text-right whitespace-nowrap tabular-nums">
        {formatCurrency(row.total_principal_due)}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary text-right whitespace-nowrap tabular-nums">
        {formatCurrency(row.total_interest_due)}
      </td>
      <td className="px-4 py-3 text-sm text-success text-right whitespace-nowrap tabular-nums">
        {formatCurrency(row.principal_paid)}
      </td>
      <td className="px-4 py-3 text-sm text-success text-right whitespace-nowrap tabular-nums">
        {formatCurrency(row.interest_paid)}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-danger text-right whitespace-nowrap tabular-nums">
        {formatCurrency(row.arrears_amount)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium tracking-wide ${overdueClass}`}
        >
          {row.overdue_days} DAYS
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {row.next_payment_date}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium bg-surface/50 ${row.repayment_state === "defaulted"
            ? "border-danger-light text-danger"
            : "border-warning-light text-warning"
            }`}
        >
          {row.repayment_state === "defaulted" ? "Defaulted" : "Overdue"}
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

  const { profile } = useAuth();

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
    } catch (e) { }
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

        let fetchPromise = supabase
          .from("loans")
          .select(
            "id, customer_id, booked_by, branch_id, product_name, scored_amount, disbursed_at, status, repayment_state, duration_weeks, total_interest, total_payable, weekly_payment"
          )
          .in("repayment_state", ["overdue", "defaulted"])
          .eq("tenant_id", tenantId)
          .abortSignal(signal);

        if (profile?.role === "relationship_officer") {
          fetchPromise = fetchPromise.eq("booked_by", profile.id);
        } else if (profile?.role === "branch_manager" || profile?.role === "customer_service_officer") {
          fetchPromise = fetchPromise.eq("branch_id", profile.branch_id);
        } else if (profile?.role === "regional_manager") {
          fetchPromise = fetchPromise.eq("region_id", profile.region_id);
        }

        const [
          loansRes,
          installmentsRes,
          customersRes,
          usersRes,
          branchesRes,
        ] = await Promise.all([
          fetchPromise,
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
  }, [tenant?.id, profile?.role, profile?.id, profile?.branch_id, profile?.region_id]);




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

  const hasActiveFilters = Boolean(
    filters.region ||
      filters.branch ||
      filters.loanOfficer ||
      filters.product ||
      filters.status !== "all" ||
      filters.dateFilter !== "all" ||
      filters.customStartDate ||
      filters.customEndDate
  );

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 space-y-6 font-outfit animate-fade-in">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-bold text-muted mt-0.5">Non-Performing Loans Report</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                placeholder="Search name, ID, or phone"
                className="bg-card border border-border text-text-primary placeholder:text-muted rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 w-64 transition"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                showFilters
                  ? "bg-brand text-white border-brand shadow-sm"
                  : "bg-card text-text-secondary border-border hover:border-brand/50"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              )}
            </button>

            {/* Export Dropdown */}
            <div className="flex items-center bg-card rounded-lg border border-border p-1">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="bg-transparent text-sm font-medium text-text-secondary px-2 py-1 focus:outline-none cursor-pointer"
              >
                {exportFormatOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleExport}
                className="ml-2 px-3 py-1.5 rounded-md bg-brand text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>
          </div>
        </div>

          {/* HIERARCHICAL FILTERS */}
          {showFilters && (
            <div className="bg-card border border-border rounded-xl p-5 animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5 z-50">
                  <label className="text-xs font-bold text-text-muted tracking-wider ml-1 uppercase">
                    Date Range
                  </label>
                  <CustomSelect
                    value={filters.dateFilter}
                    onChange={(val) => handleFilterChange("dateFilter", val)}
                    options={dateFilterOptions}
                    placeholder="Select Date Range"
                  />
                </div>

                {filters.dateFilter === "custom" && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-muted tracking-wider ml-1 uppercase">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={filters.customStartDate}
                        onChange={(e) =>
                          handleFilterChange("customStartDate", e.target.value)
                        }
                        className="w-full px-4 py-2 bg-page border border-border rounded-lg text-sm focus:ring-2 focus:ring-brand/20 outline-none text-text-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-muted tracking-wider ml-1 uppercase">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={filters.customEndDate}
                        onChange={(e) =>
                          handleFilterChange("customEndDate", e.target.value)
                        }
                        className="w-full px-4 py-2 bg-page border border-border rounded-lg text-sm focus:ring-2 focus:ring-brand/20 outline-none text-text-primary"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                {profile?.role !== "regional_manager" && profile?.role !== "branch_manager" && profile?.role !== "customer_service_officer" && profile?.role !== "relationship_officer" && (
                  <div className="space-y-1.5 z-40">
                    <label className="text-xs font-bold text-text-muted tracking-wider ml-1 uppercase">
                      Region
                    </label>
                    <CustomSelect
                      value={filters.region}
                      onChange={(val) => {
                        handleFilterChange("region", val);
                        handleFilterChange("branch", "");
                        handleFilterChange("loanOfficer", "");
                      }}
                      options={[
                        { value: "", label: "All Regions" },
                        ...regions.map((r) => ({ value: r.id, label: r.name })),
                      ]}
                      placeholder="All Regions"
                    />
                  </div>
                )}

                {profile?.role !== "branch_manager" && profile?.role !== "customer_service_officer" && profile?.role !== "relationship_officer" && (
                  <div className="space-y-1.5 z-30">
                    <label className="text-xs font-bold text-text-muted tracking-wider ml-1 uppercase">
                      Branch
                    </label>
                    <CustomSelect
                      value={filters.branch}
                      onChange={(val) => {
                        handleFilterChange("branch", val);
                        handleFilterChange("loanOfficer", "");
                      }}
                      options={[
                        { value: "", label: "All Branches" },
                        ...getFilteredBranches().map((b) => ({ value: b.id, label: b.name })),
                      ]}
                      placeholder="All Branches"
                    />
                  </div>
                )}

                {profile?.role !== "relationship_officer" && (
                  <div className="space-y-1.5 z-20">
                    <label className="text-xs font-bold text-text-muted tracking-wider ml-1 uppercase">
                      Officer
                    </label>
                    <CustomSelect
                      value={filters.loanOfficer}
                      onChange={(val) => handleFilterChange("loanOfficer", val)}
                      options={[
                        { value: "", label: "All Officers" },
                        ...getFilteredOfficers().map((o) => ({ value: o.id, label: o.full_name })),
                      ]}
                      placeholder="All Officers"
                    />
                  </div>
                )}

                <div className="space-y-1.5 z-10">
                  <label className="text-xs font-bold text-text-muted tracking-wider ml-1 uppercase">
                    Product
                  </label>
                  <CustomSelect
                    value={filters.product}
                    onChange={(val) => handleFilterChange("product", val)}
                    options={[
                      { value: "", label: "All Products" },
                      ...products.map((p) => ({ value: p, label: p })),
                    ]}
                    placeholder="All Products"
                  />
                </div>

                <div className="space-y-1.5 z-0">
                  <label className="text-xs font-bold text-text-muted tracking-wider ml-1 uppercase">
                    Status
                  </label>
                  <CustomSelect
                    value={filters.status}
                    onChange={(val) => handleFilterChange("status", val)}
                    options={[
                      { value: "all", label: "All States" },
                      { value: "overdue", label: "Overdue" },
                      { value: "defaulted", label: "Defaulted" },
                    ]}
                    placeholder="All States"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                <button
                  onClick={clearFilters}
                  className="text-sm font-medium text-danger hover:text-danger/80 transition-colors flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
                <p className="text-xs text-text-muted font-medium">
                  Showing {filteredData.length} matches
                </p>
              </div>
            </div>
          )}

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
            <p className="text-xs text-text-muted font-medium uppercase tracking-wide">Total Arrears</p>
            <h3 className="text-xl font-bold text-secondary mt-1 tabular-nums">
              {formatCurrency(totals.arrearsAmount)}
            </h3>
          </div>

          <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
            <p className="text-xs text-text-muted font-medium uppercase tracking-wide">Total Disbursed</p>
            <h3 className="text-xl font-bold text-brand mt-1 tabular-nums">
              {formatCurrency(totals.disbursementAmount)}
            </h3>
          </div>

          <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted font-medium uppercase tracking-wide">Number of NPLs</p>
            </div>
            <h3 className="text-xl font-bold text-text-primary mt-1 tabular-nums">
              {filteredData.length}
            </h3>
          </div>

          <div className="bg-card border border-danger/30 p-5 rounded-xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <AlertCircle className="w-12 h-12 text-danger" />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-danger font-medium uppercase tracking-wide">Defaulted Count</p>
            </div>
            <h3 className="text-xl font-bold text-danger mt-1 tabular-nums">
              {totals.defaultedCount}
            </h3>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <SkeletonTable rows={5} columns={16} />
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-muted" />
              </div>
              <h3 className="text-lg font-bold text-text-heading mb-1">
                No NPLs Found
              </h3>
              <p className="text-muted max-w-sm mb-6">
                We couldn't find any non-performing loans matching your current
                filter criteria.
              </p>
              <button
                onClick={clearFilters}
                className="text-brand font-semibold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface border-b border-border">
                      <th className="px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap w-16 text-center">
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

              {/* Pagination Component */}
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                onPageChange={setCurrentPage}
                totalItems={pagination.totalRows}
                itemsPerPage={itemsPerPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NonPerformingLoansReport;