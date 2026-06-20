import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Download,
  Filter,
  X,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth.js";
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

// ========== Helper Components ==========
const statusConfig = {
  applied: {
    label: "Success",
    color: "text-success",
    icon: CheckCircle,
  },
  completed: {
    label: "Completed",
    color: "text-success",
    icon: CheckCircle,
  },
  success: {
    label: "Success",
    color: "text-success",
    icon: CheckCircle,
  },
  pending: {
    label: "Pending",
    color: "text-warning",
    icon: Clock,
  },
  failed: {
    label: "Failed",
    color: "text-danger",
    icon: AlertCircle,
  },
  default: {
    label: "Processing",
    color: "text-muted",
    icon: Clock,
  },
};

const StatusBadge = React.memo(({ status }) => {
  const config = statusConfig[status?.toLowerCase()] || statusConfig.default;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border-light text-xs font-medium bg-surface/50 ${config.color}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span>{config.label}</span>
    </div>
  );
});
StatusBadge.displayName = 'StatusBadge';

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
SortableHeader.displayName = 'SortableHeader';

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(amount || 0);

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-KE", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "N/A";

const formatTime = (date) =>
  date
    ? new Date(date).toLocaleTimeString("en-KE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "N/A";

const RepaymentTableRow = React.memo(({ repayment, index, startIdx }) => {
  return (
    <tr className="hover:bg-surface transition-colors duration-150 border-b border-border-light">
      <td className="px-6 py-4 text-xs font-medium text-text-muted whitespace-nowrap text-center">
        {startIdx + index + 1}
      </td>
      <td className="px-4 py-3 text-sm  text-text-secondary whitespace-nowrap">
        {repayment.customerName}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {repayment.mobile}
      </td>
      <td className="px-4 py-3 text-sm font-medium text-text-secondary whitespace-nowrap">
        {repayment.idNumber}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {repayment.branch}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {repayment.region}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="font-mono text-xs text-text-primary bg-surface/50 px-2 py-0.5 rounded border border-border-light inline-block">
          {repayment.transactionId}
        </div>
      </td>
      <td className="px-4 py-3 text-sm  text-text-secondary text-right whitespace-nowrap tabular-nums">
        {formatCurrency(repayment.amountPaid)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="font-mono text-xs text-text-primary bg-surface/50 px-2 py-0.5 rounded border border-border-light inline-block">
          {repayment.billRef}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <StatusBadge status={repayment.displayStatus} />
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {formatDate(repayment.paymentDate)} {formatTime(repayment.paymentDate)}
      </td>
    </tr>
  );
});
RepaymentTableRow.displayName = 'RepaymentTableRow';

// ========== Main Component ==========
const MpesaRepaymentReports = () => {
  const { profile, tenant } = useAuth();

  // State
  const [rawRepayments, setRawRepayments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: "paymentDate", direction: "desc" });
  const [exportFormat, setExportFormat] = useState("csv");

  const itemsPerPage = 50;

  // Filters state (saved to localStorage)
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("mpesa-repayments-filters");
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...parsed, search: "" };
      }
    } catch (e) { }
    return {
      search: "",
      branch: "",
      region: "",
      startDate: "",
      endDate: "",
      dateRangeType: "",
    };
  });

  // Refs
  const abortControllerRef = useRef(null);
  const isMounted = useRef(true);
  const isTimeout = useRef(false);
  const tenantId = tenant?.id;

  // Save filters to localStorage (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem("mpesa-repayments-filters", JSON.stringify(filters));
      } catch (e) {
        console.error("Failed to save filters:", e);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  // Fetch branches and regions (only once)
  useEffect(() => {
    if (!tenantId || branches.length > 0) return;

    let mounted = true;
    const fetchBranchesAndRegions = async () => {
      try {
        const [branchesRes, regionsRes] = await Promise.all([
          supabase
            .from("branches")
            .select(`id, name, region_id, regions ( id, name )`)
            .eq("tenant_id", tenantId)
            .order("name"),
          supabase
            .from("regions")
            .select("id, name")
            .eq("tenant_id", tenantId)
            .order("name"),
        ]);

        if (mounted) {
          if (!branchesRes.error) setBranches(branchesRes.data || []);
          if (!regionsRes.error) setRegions(regionsRes.data || []);
        }
      } catch (error) {
        console.error("Error fetching branches/regions:", error);
      }
    };

    fetchBranchesAndRegions();
    return () => { mounted = false; };
  }, [tenantId, branches.length]);

  // Core fetch function (reusable, uses isMounted and abort signal)
  const fetchRepayments = useCallback(async (signal) => {
    if (!tenantId || !profile) return;

    try {
      setLoading(true);
      setFetchError(null);
      isTimeout.current = false;

      // Try cache first
      const cacheKey = `mpesa-repayments-raw-data-v2-${tenantId}-${profile?.id}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const cacheAge = Date.now() - timestamp;
          if (cacheAge < 24 * 60 * 60 * 1000) {
            if (isMounted.current) {
              setRawRepayments(data || []);
              setLoading(false);
              setIsInitialLoad(false);
            }
            return;
          }
        }
      } catch (e) {
        console.error("Cache read error:", e);
      }

      // Fetch loan_payments
      let query = supabase
        .from("loan_payments")
        .select(`
          id,
          paid_amount,
          mpesa_receipt,
          phone_number,
          paid_at,
          description,
          loan_id,
          loans!inner (
            id,
            booked_by,
            branch_id,
            customers!inner (
              id,
              Firstname,
              Middlename,
              Surname,
              id_number,
              branch:branch_id (
                name,
                region_id,
                regions ( name )
              )
            )
          )
        `)
        .eq("payment_method", "mpesa_c2b")
        .eq("loans.customers.tenant_id", tenantId);

      // RBAC Implementation
      if (profile.role === 'relationship_officer') {
        query = query.eq('loans.booked_by', profile.id);
      } else if (['branch_manager', 'customer_service_officer'].includes(profile.role)) {
        if (profile.branch_id) {
          query = query.eq('loans.branch_id', profile.branch_id);
        }
      } else if (profile.role === 'regional_manager') {
        if (profile.region_id) {
          query = query.filter('loans.customers.branch.region_id', 'eq', profile.region_id);
        }
      }

      const { data: payments, error: paymentsError } = await query
        .order("paid_at", { ascending: false })
        .abortSignal(signal);

      if (paymentsError) throw paymentsError;
      if (!isMounted.current) return;

      // Fetch corresponding mpesa_c2b_transactions
      const mpesaIds = payments.map(p => p.mpesa_receipt).filter(Boolean);
      let mpesaMap = {};
      if (mpesaIds.length > 0) {
        const { data: mpesaData, error: mpesaError } = await supabase
          .from("mpesa_c2b_transactions")
          .select("transaction_id, raw_payload")
          .in("transaction_id", mpesaIds)
          .eq("tenant_id", tenantId)
          .abortSignal(signal);

        if (mpesaError) throw mpesaError;
        if (!isMounted.current) return;

        mpesaMap = (mpesaData || []).reduce((acc, m) => {
          acc[m.transaction_id] = m.raw_payload;
          return acc;
        }, {});
      }

      // Format data and group by Transaction ID to sum up split payments
      const groupedData = payments.reduce((acc, item) => {
        const rawReceipt = (item.mpesa_receipt || "").trim();
        const mpesaReceipt = rawReceipt || `N/A-${item.id}`;
        const amount = parseFloat(item.paid_amount) || 0;

        if (!acc[mpesaReceipt]) {
          const customer = item.loans?.customers;
          const branch = customer?.branch;
          const region = branch?.regions;

          const fullName = customer
            ? [customer.Firstname, customer.Middlename, customer.Surname]
              .filter(n => n && n.trim() !== "")
              .join(" ")
            : "N/A";

          const paymentDate = item.paid_at ? new Date(item.paid_at) : null;
          const rawPayload = mpesaMap[item.mpesa_receipt];
          const billRef = rawPayload?.BillRefNumber || "N/A";

          acc[mpesaReceipt] = {
            id: mpesaReceipt,
            customerName: fullName,
            idNumber: customer?.id_number || "N/A",
            mobile: item.phone_number || "N/A",
            branch: branch?.name || "N/A",
            region: region?.name || "N/A",
            transactionId: rawReceipt || "N/A",
            amountPaid: amount,
            dbStatus: "success",
            displayStatus: "success",
            billRef,
            paymentDate,
            rawDate: item.paid_at,
            customerId: customer?.id || null,
            loanId: item.loan_id || null,
          };
        } else {
          acc[mpesaReceipt].amountPaid += amount;
        }
        return acc;
      }, {});

      const formatted = Object.values(groupedData);

      if (isMounted.current) setRawRepayments(formatted);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ data: formatted, timestamp: Date.now() }));
      } catch (e) {
        console.error("Cache write error:", e);
      }
    } catch (err) {
      if (signal.aborted && isTimeout.current && isMounted.current) {
        setFetchError("Request timed out after 30 seconds. Please try again.");
      } else if (!signal.aborted && isMounted.current) {
        console.error("Error fetching repayments:", err);
        setFetchError(err.message || "Failed to load data");
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setIsInitialLoad(false);
      }
    }
  }, [tenantId, profile]);

  // Initial fetch with abort and timeout
  useEffect(() => {
    if (!tenantId) {
      setIsInitialLoad(false);
      setLoading(false);
      return;
    }

    isMounted.current = true;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const timeoutId = setTimeout(() => {
      isTimeout.current = true;
      abortControllerRef.current?.abort();
    }, 30000);

    fetchRepayments(signal).finally(() => {
      clearTimeout(timeoutId);
    });

    return () => {
      isMounted.current = false;
      abortControllerRef.current?.abort();
      clearTimeout(timeoutId);
    };
  }, [tenantId, fetchRepayments]);

  // Manual refresh
  const handleManualRefresh = useCallback(async () => {
    if (!tenantId || loading) return;

    abortControllerRef.current?.abort();

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    isTimeout.current = false;

    const timeoutId = setTimeout(() => {
      isTimeout.current = true;
      abortControllerRef.current?.abort();
    }, 30000);

    await fetchRepayments(signal);
    clearTimeout(timeoutId);
  }, [tenantId, loading, fetchRepayments]);

  // Date range helper
  const getDateRange = useCallback((type) => {
    const now = new Date();
    let start = null, end = null;
    switch (type) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case "week": {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(now.setDate(diff));
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      }
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      default:
        start = null; end = null;
    }
    return { start, end };
  }, []);

  // Filtered and sorted data
  const filteredData = useMemo(() => {
    let result = [...rawRepayments];
    const { search, branch, region, startDate, endDate, dateRangeType } = filters;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        (r.customerName || "").toLowerCase().includes(q) ||
        String(r.mobile || "").toLowerCase().includes(q) ||
        String(r.idNumber || "").toLowerCase().includes(q) ||
        (r.transactionId || "").toLowerCase().includes(q) ||
        (r.billRef || "").toLowerCase().includes(q)
      );
    }

    if (branch) result = result.filter(r => r.branch === branch);
    if (region) result = result.filter(r => r.region === region);

    if (dateRangeType) {
      const { start, end } = getDateRange(dateRangeType);
      if (start) result = result.filter(r => r.paymentDate && r.paymentDate >= start);
      if (end) result = result.filter(r => r.paymentDate && r.paymentDate <= end);
    } else {
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        result = result.filter(r => r.paymentDate && r.paymentDate >= start);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        result = result.filter(r => r.paymentDate && r.paymentDate <= end);
      }
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rawRepayments, filters, sortConfig, getDateRange]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalCount = filteredData.length;
    const successfulCount = filteredData.filter(r => r.displayStatus === "success").length;
    const totalAmount = filteredData.reduce((sum, r) => sum + r.amountPaid, 0);
    return { totalCount, successfulCount, totalAmount };
  }, [filteredData]);

  // Pagination
  const pagination = useMemo(() => {
    const totalRows = filteredData.length;
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, totalRows);
    const currentData = filteredData.slice(startIdx, endIdx);
    return { totalRows, startIdx, endIdx, currentData };
  }, [filteredData, currentPage]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.region !== "" ||
      filters.branch !== "" ||
      filters.startDate !== "" ||
      filters.endDate !== "" ||
      filters.dateRangeType !== ""
    );
  }, [filters]);

  // Handlers
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      if (key === "dateRangeType" && value !== "custom") {
        newFilters.startDate = "";
        newFilters.endDate = "";
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
      startDate: "",
      endDate: "",
      dateRangeType: "",
    });
    setCurrentPage(1);
  }, []);

  // ========== Export Functions ==========
  const exportToPDF = () => {
    const doc = new jsPDF("l", "pt", "a4");
    const companyName = tenant?.company_name || "Jasiri";
    const reportTitle = "M-Pesa Repayments Report";

    autoTable(doc, {
      head: [
        [
          "No",
          "Customer Name",
          "Mobile",
          "ID Number",
          "Branch",
          "Region",
          "Transaction ID",
          "Amount Paid",
          "Account Paid",
          "Status",
          "Payment Date",
        ],
      ],
      body: filteredData.map((r, i) => [
        i + 1,
        r.customerName,
        r.mobile,
        r.idNumber,
        r.branch,
        r.region,
        r.transactionId,
        formatCurrency(r.amountPaid),
        r.billRef,
        r.displayStatus,
        r.paymentDate ? new Date(r.paymentDate).toLocaleString() : "N/A",
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
      `${companyName.toLowerCase()}_mpesa_repayments_${new Date().toISOString().split("T")[0]}.pdf`
    );
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map((r, i) => ({
        No: i + 1,
        "Customer Name": r.customerName,
        Mobile: r.mobile,
        "ID Number": r.idNumber,
        Branch: r.branch,
        Region: r.region,
        "Transaction ID": r.transactionId,
        "Amount Paid (KES)": r.amountPaid,
        "Account Paid": r.billRef,
        Status: r.displayStatus,
        "Payment Date": r.paymentDate ? new Date(r.paymentDate).toLocaleString() : "N/A",
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Repayments");
    XLSX.writeFile(
      workbook,
      `${tenant?.company_name || "Jasiri"}_mpesa_repayments_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const exportToWord = async () => {
    const table = new Table({
      rows: [
        new TableRow({
          children: ["No", "Customer", "Mobile", "Transaction ID", "Amount Paid", "Status", "Date"].map(
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
        ...filteredData.map((r, i) =>
          new TableRow({
            children: [
              String(i + 1),
              r.customerName,
              r.mobile,
              r.transactionId,
              formatCurrency(r.amountPaid),
              r.displayStatus,
              r.paymentDate ? new Date(r.paymentDate).toLocaleDateString() : "N/A",
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
              children: [new TextRun({ text: "M-Pesa Repayments Report", size: 24 })],
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
      `${tenant?.company_name || "Jasiri"}_mpesa_repayments_${new Date().toISOString().split("T")[0]}.docx`
    );
  };

  const exportToCSV = useCallback(() => {
    if (filteredData.length === 0) {
      alert("No data to export");
      return;
    }

    const csv = [
      ["No", "Customer Name", "Customer ID", "Mobile", "ID Number", "Branch", "Region", "Transaction ID", "Bill Reference", "Amount Paid (KES)", "Status", "Payment Date", "Payment Time"],
      ...filteredData.map((r, i) => [
        i + 1,
        `"${r.customerName}"`,
        r.customerId || "N/A",
        r.mobile,
        r.idNumber,
        r.branch,
        r.region,
        r.transactionId,
        r.billRef,
        formatCurrency(r.amountPaid),
        r.displayStatus,
        formatDate(r.paymentDate),
        formatTime(r.paymentDate),
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `mpesa_repayments_${new Date().toISOString().split("T")[0]}.csv`);
  }, [filteredData]);

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

  // Dropdown Options mappings
  const regionOptions = useMemo(() => {
    return [
      { value: "", label: "All Regions" },
      ...regions.map(r => ({ value: r.name, label: r.name }))
    ];
  }, [regions]);

  const branchOptions = useMemo(() => {
    return [
      { value: "", label: "All Branches" },
      ...branches.map(b => ({ value: b.name, label: b.name }))
    ];
  }, [branches]);

  const dateRangeOptions = [
    { value: "", label: "Select Range" },
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "year", label: "This Year" },
    { value: "custom", label: "Custom Range" },
  ];

  const exportFormatOptions = [
    { value: "csv", label: "CSV" },
    { value: "excel", label: "Excel" },
    { value: "word", label: "Word" },
    { value: "pdf", label: "PDF" },
  ];

  if (fetchError) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-5 font-outfit animate-fade-in">
        <div className="bg-card border border-border shadow-card rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-text-heading">Failed to Load Report</h3>
          <p className="text-sm text-muted">{fetchError}</p>
          <button
            onClick={handleManualRefresh}
            className="inline-flex items-center gap-2 px-5 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 space-y-6 font-outfit animate-fade-in">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
           
            <h1 className="text-sm font-bold text-muted mt-0.5">M-Pesa Repayment Reports</h1>
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

        {/* Filter Panel */}
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
              {!['relationship_officer', 'branch_manager', 'customer_service_officer', 'regional_manager'].includes(profile?.role) && (
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
              {!['relationship_officer', 'branch_manager', 'customer_service_officer'].includes(profile?.role) && (
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

              {/* Date Range */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Date Range
                </label>
                <CustomSelect
                  options={dateRangeOptions}
                  value={filters.dateRangeType}
                  onChange={(val) => handleFilterChange("dateRangeType", val)}
                  placeholder="Select Range"
                  compact
                  fullWidth
                />
              </div>

              {/* Custom Date Filters */}
              {filters.dateRangeType === "custom" && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange("startDate", e.target.value)}
                      className="w-full bg-card border border-border text-text-primary rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-brand focus:border-brand outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange("endDate", e.target.value)}
                      className="w-full bg-card border border-border text-text-primary rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-brand focus:border-brand outline-none transition-all"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center gap-4 hover:shadow-md transition-all duration-200">
            <div className="w-12 h-12 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-brand">
              KES
            </div>
            <div>
              <p className="text-xs text-muted font-medium  ">
                Total Collections
              </p>
              <h3 className="text-xl font-bold text-text-primary mt-1 tabular-nums">
                {formatCurrency(summaryStats.totalAmount)}
              </h3>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center gap-4 hover:shadow-md transition-all duration-200">
            <div className="w-12 h-12 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-emerald-600">
              #
            </div>
            <div>
              <p className="text-xs text-muted font-medium u">
                Successful
              </p>
              <h3 className="text-2xl font-bold text-text-primary mt-1 tabular-nums">
                {summaryStats.successfulCount}
              </h3>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center gap-4 hover:shadow-md transition-all duration-200">
            <div className="w-12 h-12 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-text-secondary">
              #
            </div>
            <div>
              <p className="text-xs text-muted font-medium ">
                Total Transactions
              </p>
              <h3 className="text-2xl font-bold text-text-primary mt-1 tabular-nums">
                {summaryStats.totalCount}
              </h3>
            </div>
          </div>
        </div>

        {/* Table Section */}
        {loading && isInitialLoad ? (
          <SkeletonTable rows={10} cols={11} />
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider text-center whitespace-nowrap">
                      #
                    </th>
                    <SortableHeader label="Customer Name" sortKey="customerName" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Mobile" sortKey="mobile" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="ID Number" sortKey="idNumber" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Branch" sortKey="branch" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Region" sortKey="region" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Transaction ID" sortKey="transactionId" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Amount Paid" sortKey="amountPaid" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Account Paid" sortKey="billRef" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Status" sortKey="displayStatus" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="Payment Date" sortKey="paymentDate" sortConfig={sortConfig} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {loading && !isInitialLoad ? (
                    <tr>
                      <td colSpan="11" className="px-6 py-12 text-center text-text-muted italic font-medium">
                        <RefreshCw className="w-6 h-6 animate-spin text-brand mx-auto mb-2" />
                        Refreshing transactions...
                      </td>
                    </tr>
                  ) : pagination.currentData.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="px-6 py-12 text-center text-text-muted italic font-medium">
                        No transactions found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    pagination.currentData.map((r, i) => (
                      <RepaymentTableRow
                        key={r.id}
                        repayment={r}
                        index={i}
                        startIdx={pagination.startIdx}
                      />
                    ))
                  )}
                </tbody>

                <tfoot className="bg-surface border-t-2 border-border font-bold">
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-right text-xs font-bold text-text-muted uppercase tracking-wider">
                      Total ({pagination.totalRows} transactions):
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-text-primary text-right whitespace-nowrap tabular-nums">
                      {formatCurrency(summaryStats.totalAmount)}
                    </td>
                    <td colSpan="3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination Component */}
            {!loading && pagination.totalRows > itemsPerPage && (
              <Pagination
                totalItems={pagination.totalRows}
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

export default MpesaRepaymentReports;