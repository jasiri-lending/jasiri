import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Download,
  Filter,
  X,
  Search,
  ChevronUp,
  ChevronDown,
  RefreshCw,
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
import { SkeletonTable } from "../../components/Skeleton";
import { Pagination } from "../../components/Pagination";
import CustomSelect from "../../components/CustomSelect";

// ========== Helper Components & Functions ==========

const formatCurrency = (num) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(num || 0);

const formatPercentage = (num) => `${Math.round((num || 0) * 100) / 100}%`;

const SortableHeader = React.memo(({ label, sortKey, sortConfig, onSort }) => (
  <th
    onClick={() => onSort(sortKey)}
    className="px-4 py-4 text-xs font-bold text-text-muted uppercase tracking-wider cursor-pointer hover:bg-surface/70 transition-colors whitespace-nowrap text-left border-b border-border"
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
SortableHeader.displayName = 'SortableHeader';

const OfficerTableRow = React.memo(({ officer, index, startIdx }) => {
  return (
    <tr className="hover:bg-surface transition-colors duration-150 border-b border-border-light text-sm text-text-secondary">
      <td className="px-4 py-3 text-center text-xs font-medium text-text-muted whitespace-nowrap">
        {startIdx + index + 1}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">{officer.branch}</td>
      <td className="px-4 py-3 font-semibold text-text-primary whitespace-nowrap">
        {officer.officer}
      </td>
      <td className="px-4 py-3 text-center whitespace-nowrap tabular-nums">
        {officer.loan_due_yesterday_count}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums font-medium text-text-primary">
        {formatCurrency(officer.loan_due_yesterday_amount)}
      </td>
      <td className="px-4 py-3 text-center whitespace-nowrap tabular-nums">
        {officer.loan_due_today_count}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums font-medium text-text-primary">
        {formatCurrency(officer.loan_due_today_amount)}
      </td>
      <td className="px-4 py-3 text-center text-red-600 dark:text-red-400 whitespace-nowrap tabular-nums font-medium">
        {officer.arrears_count}
      </td>
      <td className="px-4 py-3 text-right text-red-600 dark:text-red-400 whitespace-nowrap tabular-nums font-semibold">
        {formatCurrency(officer.arrears_amount)}
      </td>
      <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400 whitespace-nowrap tabular-nums font-semibold">
        {formatCurrency(officer.outstanding_loan)}
      </td>
      <td className="px-4 py-3 text-right text-purple-700 dark:text-purple-400 whitespace-nowrap tabular-nums font-bold">
        {formatPercentage(officer.par)}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums font-medium text-text-primary">
        {formatCurrency(officer.balance_yesterday)}
      </td>
      <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums font-semibold">
        {officer.active_customers}
      </td>
      <td className="px-4 py-3 text-center whitespace-nowrap tabular-nums">
        {officer.inactive_customers}
      </td>
      <td className="px-4 py-3 text-center text-brand whitespace-nowrap tabular-nums font-semibold">
        {officer.disbursed_loans_count}
      </td>
      <td className="px-4 py-3 text-right text-brand whitespace-nowrap tabular-nums font-semibold">
        {formatCurrency(officer.disbursed_loans_amount)}
      </td>
      <td className="px-4 py-3 text-center text-emerald-600 dark:text-emerald-400 whitespace-nowrap tabular-nums font-medium">
        {officer.cleared_loans_count}
      </td>
      <td className="px-4 py-3 text-center text-purple-600 dark:text-purple-400 whitespace-nowrap tabular-nums font-medium">
        {officer.new_loans_count}
      </td>
      <td className="px-4 py-3 text-center whitespace-nowrap tabular-nums font-bold text-text-primary">
        {officer.total_loans}
      </td>
    </tr>
  );
});
OfficerTableRow.displayName = 'OfficerTableRow';

// ========== Main Component ==========

const LoanOfficerPerformanceReport = () => {
  // Get tenant from localStorage once
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

  // State
  const [rawReports, setRawReports] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loanOfficers, setLoanOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [exportFormat, setExportFormat] = useState("csv");

  const itemsPerPage = 10;

  // Filters state (saved to localStorage)
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("officer-performance-filters");
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...parsed, search: "" }; // Don't persist search
      }
    } catch (e) { }
    return {
      search: "",
      branch: "",
      region: "",
      loanOfficer: "",
      dateRange: "all",
    };
  });

  // Refs
  const abortControllerRef = useRef(null);
  const tenantIdRef = useRef(tenant?.id);

  // Save filters to localStorage (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem("officer-performance-filters", JSON.stringify(filters));
      } catch (e) {
        console.error("Failed to save filters:", e);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  // Fetch branches, regions, loan officers - only once
  useEffect(() => {
    const tenantId = tenantIdRef.current;
    if (!tenantId || branches.length > 0) return;

    let mounted = true;

    const fetchInitialData = async () => {
      try {
        let branchesQuery = supabase.from("branches").select("id, name, region_id").eq("tenant_id", tenantId);
        let regionsQuery = supabase.from("regions").select("id, name").eq("tenant_id", tenantId);
        let usersQuery = supabase.from("users").select("id, full_name").eq("role", "relationship_officer").eq("tenant_id", tenantId);

        if (profile?.role === "relationship_officer") {
          usersQuery = usersQuery.eq("id", profile.id);
        } else if (profile?.role === "branch_manager" || profile?.role === "customer_service_officer") {
          branchesQuery = branchesQuery.eq("id", profile.branch_id);
        } else if (profile?.role === "regional_manager") {
          regionsQuery = regionsQuery.eq("id", profile.region_id);
          branchesQuery = branchesQuery.eq("region_id", profile.region_id);
        }

        const [branchesRes, regionsRes, usersRes] = await Promise.all([
          branchesQuery,
          regionsQuery,
          usersQuery,
        ]);

        if (mounted) {
          if (!branchesRes.error) setBranches(branchesRes.data || []);
          if (!regionsRes.error) setRegions(regionsRes.data || []);
          if (!usersRes.error) setLoanOfficers(usersRes.data || []);
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };

    fetchInitialData();

    return () => { mounted = false; };
  }, [profile?.role, branches.length]);

  // Helper: Portfolio at Risk calculation
  const calculatePAR = useCallback((arrearsAmount, outstandingLoan) => {
    if (!outstandingLoan || outstandingLoan === 0) return 0;
    return (arrearsAmount / outstandingLoan) * 100;
  }, []);

  // Helper: Get date range based on filter (returns ISO strings)
  const getDateRange = useCallback(() => {
    const now = new Date();
    const start = new Date();

    switch (filters.dateRange) {
      case "today":
        start.setHours(0, 0, 0, 0);
        return { start: start.toISOString(), end: now.toISOString() };
      case "this_week":
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        return { start: start.toISOString(), end: now.toISOString() };
      case "this_month":
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        return { start: start.toISOString(), end: now.toISOString() };
      case "quarterly":
        const quarter = Math.floor(now.getMonth() / 3);
        start.setMonth(quarter * 3, 1);
        start.setHours(0, 0, 0, 0);
        return { start: start.toISOString(), end: now.toISOString() };
      case "yearly":
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        return { start: start.toISOString(), end: now.toISOString() };
      default:
        return { start: null, end: null };
    }
  }, [filters.dateRange]);

  // Fetch performance data
  const fetchPerformance = useCallback(async () => {
    const tenantId = tenantIdRef.current;
    if (!tenantId) return;

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setLoading(true);

      const cacheKey = `officer-performance-data-v2-${tenantId}`;

      // Try cache first
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const cacheAge = Date.now() - timestamp;
          if (cacheAge < 24 * 60 * 60 * 1000) {
            setRawReports(data || []);
            setLoading(false);
            setIsInitialLoad(false);
            return;
          }
        }
      } catch (e) {
        console.error("Cache read error:", e);
      }

      // 1️⃣ Fetch loans with branch and regions
      let loansQuery = supabase
        .from("loans")
        .select(`
          id,
          booked_by,
          branch_id,
          customer_id,
          status,
          repayment_state,
          scored_amount,
          created_at,
          disbursed_at,
          disbursed_date,
          branches!inner (
            name,
            regions (
              name
            )
          )
        `)
        .eq("tenant_id", tenantId)
        .abortSignal(abortControllerRef.current.signal);

      let installmentsQuery = supabase
        .from("loan_installments")
        .select("loan_id, due_date, due_amount, paid_amount, status, days_overdue")
        .eq("tenant_id", tenantId)
        .abortSignal(abortControllerRef.current.signal);

      let paymentsQuery = supabase
        .from("loan_payments")
        .select("loan_id, paid_amount, paid_at")
        .eq("tenant_id", tenantId)
        .abortSignal(abortControllerRef.current.signal);

      let usersQuery = supabase
        .from("users")
        .select("id, full_name")
        .eq("role", "relationship_officer")
        .eq("tenant_id", tenantId)
        .abortSignal(abortControllerRef.current.signal);

      // Role-based restrictions
      if (profile?.role === "relationship_officer") {
        loansQuery = loansQuery.eq("booked_by", profile.id);
        usersQuery = usersQuery.eq("id", profile.id);
      } else if (profile?.role === "branch_manager" || profile?.role === "customer_service_officer") {
        loansQuery = loansQuery.eq("branch_id", profile.branch_id);
      } else if (profile?.role === "regional_manager") {
        loansQuery = loansQuery.eq("region_id", profile.region_id);
      }

      const [loansRes, installmentsRes, paymentsRes, usersRes] = await Promise.all([
        loansQuery,
        installmentsQuery,
        paymentsQuery,
        usersQuery,
      ]);

      if (loansRes.error) throw loansRes.error;
      if (installmentsRes.error) throw installmentsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (usersRes.error) throw usersRes.error;

      let loansData = loansRes.data || [];
      const installments = installmentsRes.data || [];
      const users = usersRes.data || [];

      // Apply date filtering
      const dateRange = getDateRange();
      if (dateRange.start && filters.dateRange !== "all") {
        loansData = loansData.filter(loan => {
          const loanDate = new Date(loan.created_at);
          const startDate = new Date(dateRange.start);
          const endDate = new Date(dateRange.end);
          return loanDate >= startDate && loanDate <= endDate;
        });
      }

      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const todayStr = today.toISOString().split("T")[0];
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      // Group loans by officer
      const officerStats = {};

      loansData.forEach((loan) => {
        const officer = users.find((u) => u.id === loan.booked_by);
        if (!officer) return;

        const key = `${officer.id}`;
        if (!officerStats[key]) {
          officerStats[key] = {
            branch: loan.branches?.name || "N/A",
            region: loan.branches?.regions?.name || "N/A",
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

        // Disbursed loans
        const isDisbursed = loan.status === "disbursed" || loan.disbursed_date || loan.disbursed_at;
        if (isDisbursed) {
          stat.disbursed_loans_count++;
          stat.disbursed_loans_amount += Number(loan.scored_amount) || 0;
        }

        // Cleared loans
        if (loan.repayment_state === "completed") stat.cleared_loans_count++;

        // New loans in date range
        if (dateRange.start && loan.created_at) {
          const loanDate = new Date(loan.created_at);
          const startDate = new Date(dateRange.start);
          const endDate = new Date(dateRange.end);
          if (loanDate >= startDate && loanDate <= endDate) {
            stat.new_loans_count++;
          }
        } else if (!dateRange.start) {
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

        const isCompletedLoan = loan.repayment_state === "completed";

        loanInstallments.forEach((i) => {
          const dueDateStr = i.due_date ? i.due_date.split("T")[0] : null;
          const dueAmount = Number(i.due_amount) || 0;
          const paidAmount = Number(i.paid_amount) || 0;
          const outstanding = Math.max(0, dueAmount - paidAmount);

          if (!isCompletedLoan && dueDateStr && ["pending", "partial"].includes(i.status)) {
            const netDue = (i.status === "partial" || paidAmount > 0)
              ? Math.max(0, dueAmount - paidAmount)
              : dueAmount;

            if (dueDateStr === yesterdayStr) {
              stat.loan_due_yesterday_count++;
              stat.loan_due_yesterday_amount += netDue;
            }

            if (dueDateStr === todayStr) {
              stat.loan_due_today_count++;
              stat.loan_due_today_amount += netDue;
            }
          }

          if (!isCompletedLoan && (i.status === "overdue" || (i.days_overdue && i.days_overdue > 0))) {
            stat.arrears_count++;
            stat.arrears_amount += outstanding;
            loanArrears += outstanding;
          }

          if (["pending", "partial", "overdue"].includes(i.status)) {
            stat.outstanding_loan += outstanding;
            loanOutstanding += outstanding;
          }

          if (dueDateStr && dueDateStr < yesterdayStr && ["pending", "partial", "overdue"].includes(i.status)) {
            stat.balance_yesterday += outstanding;
          }
        });

        if (loanOutstanding > 0) {
          const loanPAR = calculatePAR(loanArrears, loanOutstanding);
          stat.par = ((stat.par * (stat.total_loans - 1)) + loanPAR) / stat.total_loans;
        }
      });

      const formatted = Object.values(officerStats).map((stat) => ({
        id: stat.officerId,
        ...stat,
        active_customers: stat.active_customers.size,
        inactive_customers: stat.inactive_customers.size,
        par: calculatePAR(stat.arrears_amount, stat.outstanding_loan),
      }));

      setRawReports(formatted);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          data: formatted,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.error("Cache write error:", e);
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.error("Error fetching performance data:", err);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [filters.dateRange, getDateRange, calculatePAR, profile]);

  // Fetch performance data on filters dateRange or profile update
  useEffect(() => {
    fetchPerformance();
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [fetchPerformance]);

  const handleManualRefresh = async () => {
    if (loading) return;
    localStorage.removeItem(`officer-performance-data-v2-${tenantIdRef.current}`);
    await fetchPerformance();
  };

  // Filtered and sorted data
  const filteredData = useMemo(() => {
    let result = [...rawReports];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) =>
          r.officer.toLowerCase().includes(q) ||
          r.branch.toLowerCase().includes(q)
      );
    }

    if (filters.region) {
      result = result.filter((r) => r.region === filters.region);
    }

    if (filters.branch) {
      result = result.filter((r) => r.branch === filters.branch);
    }

    if (filters.loanOfficer) {
      result = result.filter((r) => r.officerId === filters.loanOfficer);
    }

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
  }, [rawReports, filters, sortConfig]);

  // Totals
  const totals = useMemo(() => {
    const disbursedLoans = filteredData.reduce((sum, r) => sum + r.disbursed_loans_count, 0);
    const disbursedAmount = filteredData.reduce((sum, r) => sum + (r.disbursed_loans_amount || 0), 0);
    const activeCustomers = filteredData.reduce((sum, r) => sum + r.active_customers, 0);
    const arrearsAmount = filteredData.reduce((sum, r) => sum + (r.arrears_amount || 0), 0);
    const outstandingLoan = filteredData.reduce((sum, r) => sum + (r.outstanding_loan || 0), 0);
    const overallPAR = calculatePAR(arrearsAmount, outstandingLoan);

    return {
      disbursedLoans,
      disbursedAmount,
      activeCustomers,
      arrearsAmount,
      outstandingLoan,
      overallPAR,
    };
  }, [filteredData, calculatePAR]);

  // Pagination
  const pagination = useMemo(() => {
    const totalRows = filteredData.length;
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, totalRows);
    const currentData = filteredData.slice(startIdx, endIdx);
    return { totalRows, startIdx, endIdx, currentData };
  }, [filteredData, currentPage]);

  const getFilteredLoanOfficers = useCallback(() => {
    if (filters.branch) {
      const officersInBranch = rawReports
        .filter((report) => report.branch === filters.branch)
        .map((report) => ({ id: report.officerId, full_name: report.officer }));
      return officersInBranch.filter(
        (officer, index, self) => index === self.findIndex((o) => o.id === officer.id)
      );
    } else if (filters.region) {
      const officersInRegion = rawReports
        .filter((report) => report.region === filters.region)
        .map((report) => ({ id: report.officerId, full_name: report.officer }));
      return officersInRegion.filter(
        (officer, index, self) => index === self.findIndex((o) => o.id === officer.id)
      );
    }
    return loanOfficers;
  }, [filters.branch, filters.region, rawReports, loanOfficers]);

  // ========== HANDLERS ==========

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
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      branch: "",
      region: "",
      loanOfficer: "",
      dateRange: "all",
    });
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.region !== "" ||
      filters.branch !== "" ||
      filters.loanOfficer !== "" ||
      filters.dateRange !== "all"
    );
  }, [filters]);

  // ========== Export Functions ==========
  const exportToPDF = () => {
    const doc = new jsPDF("l", "pt", "a4");
    const companyName = tenant?.company_name || "Jasiri";
    const reportTitle = "Officer Performance Report";

    autoTable(doc, {
      head: [
        [
          "Branch",
          "Officer",
          "Due Yesterday",
          "Due Today",
          "Arrears",
          "Outstanding",
          "PAR %",
          "Disbursed Count",
          "Disbursed Amount",
          "Total Loans",
        ],
      ],
      body: filteredData.map((r) => [
        r.branch,
        r.officer,
        formatCurrency(r.loan_due_yesterday_amount),
        formatCurrency(r.loan_due_today_amount),
        formatCurrency(r.arrears_amount),
        formatCurrency(r.outstanding_loan),
        formatPercentage(r.par),
        r.disbursed_loans_count,
        formatCurrency(r.disbursed_loans_amount),
        r.total_loans,
      ]),
      didDrawPage: (data) => {
        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text(companyName, data.settings.margin.left, 40);
        doc.setFontSize(12);
        doc.text(reportTitle, data.settings.margin.left, 60);
        doc.setFontSize(10);
        doc.text(
          `Generated on: ${new Date().toLocaleString()}`,
          data.settings.margin.left,
          80
        );
      },
      margin: { top: 100 },
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [26, 122, 74], textColor: [255, 255, 255] },
    });

    doc.save(
      `${companyName.toLowerCase()}_officer_performance_${new Date().toISOString().split("T")[0]}.pdf`
    );
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map((r, i) => ({
        No: i + 1,
        Branch: r.branch,
        Officer: r.officer,
        "Due Yesterday Count": r.loan_due_yesterday_count,
        "Due Yesterday Amount": r.loan_due_yesterday_amount,
        "Due Today Count": r.loan_due_today_count,
        "Due Today Amount": r.loan_due_today_amount,
        "Arrears Count": r.arrears_count,
        "Arrears Amount": r.arrears_amount,
        "Outstanding Loan": r.outstanding_loan,
        PAR: r.par,
        "Balance Yesterday": r.balance_yesterday,
        "Active Customers": r.active_customers,
        "Inactive Customers": r.inactive_customers,
        "Disbursed Loans Count": r.disbursed_loans_count,
        "Disbursed Loans Amount": r.disbursed_loans_amount,
        "Cleared Loans": r.cleared_loans_count,
        "New Loans": r.new_loans_count,
        "Total Loans": r.total_loans,
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Performance");
    XLSX.writeFile(
      workbook,
      `${tenant?.company_name || "Jasiri"}_officer_performance_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const exportToWord = async () => {
    const table = new Table({
      rows: [
        new TableRow({
          children: ["Branch", "Officer", "Arrears", "Outstanding", "PAR", "Disbursed", "Total Loans"].map(
            (h) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: h, bold: true })],
                  }),
                ],
              })
          ),
        }),
        ...filteredData.map((r) =>
          new TableRow({
            children: [
              r.branch,
              r.officer,
              formatCurrency(r.arrears_amount),
              formatCurrency(r.outstanding_loan),
              formatPercentage(r.par),
              formatCurrency(r.disbursed_loans_amount),
              String(r.total_loans),
            ].map((v) => new TableCell({ children: [new Paragraph(v)] })),
          })
        ),
      ],
    });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: tenant?.company_name || "Jasiri",
                  bold: true,
                  size: 32,
                }),
              ],
            }),
            new Paragraph({
              children: [new TextRun({ text: "Officer Performance Report", size: 24 })],
            }),
            new Paragraph({ text: `Generated on: ${new Date().toLocaleString()}` }),
            new Paragraph({ text: "" }),
            table,
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(
      blob,
      `${tenant?.company_name || "Jasiri"}_officer_performance_${new Date().toISOString().split("T")[0]}.docx`
    );
  };

  const exportToCSV = useCallback(() => {
    if (filteredData.length === 0) {
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
        "Total Loans",
      ],
      ...filteredData.map((r, i) => [
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
        r.total_loans,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `loan_officer_performance${dateRangeLabel}${branchLabel}_${new Date().toISOString().split("T")[0]}.csv`);
  }, [filteredData, filters.dateRange, filters.branch]);

  const handleExport = () => {
    switch (exportFormat) {
      case "pdf":
        exportToPDF();
        break;
      case "excel":
        exportToExcel();
        break;
      case "word":
        exportToWord();
        break;
      case "csv":
      default:
        exportToCSV();
        break;
    }
  };

  // Dropdowns Mappings
  const regionOptions = useMemo(() => {
    return [
      { value: "", label: "All Regions" },
      ...regions.map(r => ({ value: r.name, label: r.name }))
    ];
  }, [regions]);

  const branchOptions = useMemo(() => {
    const filteredBranches = branches.filter(
      (b) =>
        !filters.region ||
        regions.find((r) => r.name === filters.region)?.id === b.region_id
    );
    return [
      { value: "", label: "All Branches" },
      ...filteredBranches.map(b => ({ value: b.name, label: b.name }))
    ];
  }, [branches, filters.region, regions]);

  const officerOptions = useMemo(() => {
    return [
      { value: "", label: "All Loan Officers" },
      ...getFilteredLoanOfficers().map(o => ({ value: o.id, label: o.full_name }))
    ];
  }, [getFilteredLoanOfficers]);

  const dateRangeOptions = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "this_week", label: "This Week" },
    { value: "this_month", label: "This Month" },
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" },
  ];

  const exportFormatOptions = [
    { value: "csv", label: "CSV" },
    { value: "excel", label: "Excel" },
    { value: "word", label: "Word" },
    { value: "pdf", label: "PDF" },
  ];

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 space-y-6 font-outfit animate-fade-in">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            
            <h1 className="text-sm font-bold text-muted mt-0.5">Officer Performance Report</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                placeholder="Search officer or branch"
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

            {/* Manual Refresh */}
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              title="Refresh data"
              className="p-2 rounded-lg border border-border bg-card text-text-secondary hover:text-brand hover:border-brand/50 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {/* Export options */}
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
              <CustomSelect
                options={exportFormatOptions}
                value={exportFormat}
                onChange={setExportFormat}
                placeholder="Format"
                compact
              />
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-card border border-border rounded-xl shadow-card p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Filter Results</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-medium transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Clear all
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Region */}
              {profile?.role !== "regional_manager" && profile?.role !== "branch_manager" && profile?.role !== "customer_service_officer" && profile?.role !== "relationship_officer" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    Region
                  </label>
                  <CustomSelect
                    options={regionOptions}
                    value={filters.region}
                    onChange={(val) => handleFilterChange("region", val)}
                    placeholder="All Regions"
                    compact
                    fullWidth
                  />
                </div>
              )}

              {/* Branch */}
              {profile?.role !== "branch_manager" && profile?.role !== "customer_service_officer" && profile?.role !== "relationship_officer" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    Branch
                  </label>
                  <CustomSelect
                    options={branchOptions}
                    value={filters.branch}
                    onChange={(val) => handleFilterChange("branch", val)}
                    placeholder="All Branches"
                    compact
                    fullWidth
                  />
                </div>
              )}

              {/* Loan Officer */}
              {profile?.role !== "relationship_officer" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    Loan Officer
                  </label>
                  <CustomSelect
                    options={officerOptions}
                    value={filters.loanOfficer}
                    onChange={(val) => handleFilterChange("loanOfficer", val)}
                    placeholder="All Loan Officers"
                    compact
                    fullWidth
                  />
                </div>
              )}

              {/* Date Range */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Date Range
                </label>
                <CustomSelect
                  options={dateRangeOptions}
                  value={filters.dateRange}
                  onChange={(val) => handleFilterChange("dateRange", val)}
                  placeholder="All Time"
                  compact
                  fullWidth
                />
              </div>
            </div>
          </div>
        )}

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
          <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center gap-4 hover:shadow-md transition-all duration-200">
            <div className="w-12 h-12 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-brand">
              KES
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">
                Total Disbursed
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1 tabular-nums">
                {formatCurrency(totals.disbursedAmount)}
              </h3>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center gap-4 hover:shadow-md transition-all duration-200">
            <div className="w-12 h-12 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-text-secondary">
              #
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">
                Active Customers
              </p>
              <h3 className="text-2xl font-bold text-text-primary mt-1 tabular-nums">
                {totals.activeCustomers}
              </h3>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center gap-4 hover:shadow-md transition-all duration-200">
            <div className="w-12 h-12 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-red-500">
              KES
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">
                Total Arrears
              </p>
              <h3 className="text-2xl font-bold text-red-600 mt-1 tabular-nums">
                {formatCurrency(totals.arrearsAmount)}
              </h3>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center gap-4 hover:shadow-md transition-all duration-200">
            <div className="w-12 h-12 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-purple-600">
              %
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">
                Overall PAR
              </p>
              <h3 className="text-2xl font-bold text-purple-700 mt-1 tabular-nums">
                {formatPercentage(totals.overallPAR)}
              </h3>
            </div>
          </div>
        </div>

        {/* Table Section */}
        {loading && isInitialLoad ? (
          <SkeletonTable rows={10} cols={19} />
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider text-center whitespace-nowrap">
                      #
                    </th>
                    <SortableHeader label="Branch" sortKey="branch" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Loan Officer" sortKey="officer" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Due Yesterday (Cnt)" sortKey="loan_due_yesterday_count" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Due Yesterday (Amt)" sortKey="loan_due_yesterday_amount" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Due Today (Cnt)" sortKey="loan_due_today_count" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Due Today (Amt)" sortKey="loan_due_today_amount" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Arrears (Cnt)" sortKey="arrears_count" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Arrears (Amt)" sortKey="arrears_amount" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Outstanding" sortKey="outstanding_loan" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="PAR %" sortKey="par" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Balance Yesterday" sortKey="balance_yesterday" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Active Cust." sortKey="active_customers" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Inactive Cust." sortKey="inactive_customers" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Disbursed (Cnt)" sortKey="disbursed_loans_count" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Disbursed (Amt)" sortKey="disbursed_loans_amount" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Cleared" sortKey="cleared_loans_count" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="New Loans" sortKey="new_loans_count" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Total Loans" sortKey="total_loans" sortConfig={sortConfig} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {loading && !isInitialLoad ? (
                    <tr>
                      <td colSpan="19" className="px-6 py-12 text-center text-text-muted italic font-medium">
                        <RefreshCw className="w-6 h-6 animate-spin text-brand mx-auto mb-2" />
                        Refreshing performance data...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan="19" className="px-6 py-12 text-center text-text-muted italic font-medium">
                        No officer performance data matches your criteria.
                      </td>
                    </tr>
                  ) : (
                    pagination.currentData.map((officer, idx) => (
                      <OfficerTableRow
                        key={officer.id}
                        officer={officer}
                        index={idx}
                        startIdx={pagination.startIdx}
                      />
                    ))
                  )}
                </tbody>

                <tfoot className="bg-surface border-t-2 border-border font-bold text-xs uppercase tracking-wider text-text-muted">
                  <tr>
                    <td colSpan="3" className="px-6 py-4 text-right">
                      Overall Total ({filteredData.length} officers):
                    </td>
                    <td colSpan="4"></td>
                    <td className="px-4 py-4 text-center text-red-600 dark:text-red-400">
                      {filteredData.reduce((sum, r) => sum + r.arrears_count, 0)}
                    </td>
                    <td className="px-4 py-4 text-right text-red-600 dark:text-red-400 whitespace-nowrap tabular-nums">
                      {formatCurrency(totals.arrearsAmount)}
                    </td>
                    <td className="px-4 py-4 text-right text-orange-600 dark:text-orange-400 whitespace-nowrap tabular-nums">
                      {formatCurrency(totals.outstandingLoan)}
                    </td>
                    <td className="px-4 py-4 text-right text-purple-700 dark:text-purple-400 whitespace-nowrap tabular-nums">
                      {formatPercentage(totals.overallPAR)}
                    </td>
                    <td></td>
                    <td className="px-4 py-4 text-center text-emerald-600 dark:text-emerald-400">
                      {totals.activeCustomers}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {filteredData.reduce((sum, r) => sum + r.inactive_customers, 0)}
                    </td>
                    <td className="px-4 py-4 text-center text-brand">
                      {totals.disbursedLoans}
                    </td>
                    <td className="px-4 py-4 text-right text-brand whitespace-nowrap tabular-nums">
                      {formatCurrency(totals.disbursedAmount)}
                    </td>
                    <td className="px-4 py-4 text-center text-emerald-600 dark:text-emerald-400">
                      {filteredData.reduce((sum, r) => sum + r.cleared_loans_count, 0)}
                    </td>
                    <td className="px-4 py-4 text-center text-purple-600 dark:text-purple-400">
                      {filteredData.reduce((sum, r) => sum + r.new_loans_count, 0)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {filteredData.reduce((sum, r) => sum + r.total_loans, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination Component */}
            {!loading && filteredData.length > itemsPerPage && (
              <Pagination
                totalItems={filteredData.length}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanOfficerPerformanceReport;