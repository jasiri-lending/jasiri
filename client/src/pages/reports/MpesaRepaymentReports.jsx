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
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import Spinner from "../../components/Spinner"; // ✅ Import your custom Spinner

// ========== Memoized Helper Components (unchanged) ==========
const StatusBadge = React.memo(({ status }) => {
  const statusConfig = {
    applied: { label: "Success", color: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: CheckCircle },
    completed: { label: "Completed", color: "bg-blue-50 text-blue-700 border border-blue-200", icon: CheckCircle },
    success: { label: "Success", color: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: CheckCircle },
    pending: { label: "Pending", color: "bg-amber-50 text-amber-700 border border-amber-200", icon: Clock },
    failed: { label: "Failed", color: "bg-red-50 text-red-700 border border-red-200", icon: AlertCircle },
    default: { label: "Processing", color: "bg-gray-50 text-gray-700 border border-gray-200", icon: Clock },
  };
  const config = statusConfig[status] || statusConfig.default;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
    </div>
  );
});
StatusBadge.displayName = 'StatusBadge';

const SortableHeader = React.memo(({ label, sortKey, sortConfig, onSort }) => (
  <th
    onClick={() => onSort(sortKey)}
    className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-50 whitespace-nowrap text-left text-sm tracking-wider border-b"
  >
    <div className="flex items-center justify-between">
      <span className="font-medium text-sm" style={{ color: "#586ab1" }}>{label}</span>
      {sortConfig.key === sortKey &&
        (sortConfig.direction === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
    </div>
  </th>
));
SortableHeader.displayName = 'SortableHeader';

const SearchBox = React.memo(({ value, onChange }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search name, ID, or phone"
      className="border bg-gray-50 border-gray-300 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm w-64 text-gray-900"
    />
  </div>
));
SearchBox.displayName = 'SearchBox';

// Local Spinner component removed

const RepaymentTableRow = React.memo(({ repayment, index, startIdx }) => {
  const formatDate = (date) => date ? new Date(date).toLocaleDateString("en-KE", { year: 'numeric', month: 'short', day: 'numeric' }) : "N/A";
  const formatTime = (date) => date ? new Date(date).toLocaleTimeString("en-KE", { hour: '2-digit', minute: '2-digit', hour12: false }) : "N/A";
  const formatCurrency = (amount) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0 }).format(amount || 0);

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 font-medium text-gray-400 whitespace-nowrap">{startIdx + index + 1}</td>
      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{repayment.customerName}</td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{repayment.mobile}</td>
      <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">{repayment.idNumber}</td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{repayment.branch}</td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{repayment.region}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="font-mono text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-200">
          {repayment.transactionId}
        </div>
      </td>
      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap text-right">
        {formatCurrency(repayment.amountPaid)}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="font-mono text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-200">
          {repayment.billRef}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <StatusBadge status={repayment.displayStatus} />
      </td>
      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
        {formatDate(repayment.paymentDate)} {formatTime(repayment.paymentDate)}
      </td>
    </tr>
  );
});
RepaymentTableRow.displayName = 'RepaymentTableRow';

const PaginationControls = React.memo(({ currentPage, totalPages, onPageChange, startIdx, endIdx, totalRows }) => {
  const getPageNumbers = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, 4, 5];
    if (currentPage >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 rounded-b-lg">
      <div className="text-xs text-gray-600">
        Showing <span className="font-semibold">{startIdx + 1}</span> to{" "}
        <span className="font-semibold">{Math.min(endIdx, totalRows)}</span> of{" "}
        <span className="font-semibold">{totalRows}</span> entries
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
          className="p-1.5 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        <div className="flex items-center gap-1">
          {getPageNumbers().map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`w-8 h-8 rounded text-xs transition-colors ${currentPage === pageNum
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-100 text-gray-700"
                }`}
            >
              {pageNum}
            </button>
          ))}
        </div>
        <button
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
});
PaginationControls.displayName = 'PaginationControls';

// ========== Main Component ==========
const MpesaRepaymentReports = () => {
  const [tenant] = useState(() => {
    try {
      const savedTenant = localStorage.getItem("tenant");
      return savedTenant ? JSON.parse(savedTenant) : null;
    } catch (e) {
      console.error("Error loading tenant:", e);
      return null;
    }
  });

  // State
  const [rawRepayments, setRawRepayments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
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
  const isTimeout = useRef(false); // flag to distinguish timeout abort from unmount abort
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
    if (!tenantId) return;

    try {
      setLoading(true);
      setFetchError(null);
      isTimeout.current = false;

      // Try cache first
      const cacheKey = `mpesa-repayments-raw-data-${tenantId}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const cacheAge = Date.now() - timestamp;
          if (cacheAge < 24 * 60 * 60 * 1000) {
            if (isMounted.current) setRawRepayments(data || []);
            if (isMounted.current) setLoading(false);
            if (isMounted.current) setIsInitialLoad(false);
            return;
          }
        }
      } catch (e) {
        console.error("Cache read error:", e);
      }

      // Fetch loan_payments
      const { data: payments, error: paymentsError } = await supabase
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
            customers!inner (
              id,
              Firstname,
              Middlename,
              Surname,
              id_number,
              branches!inner (
                name,
                region_id,
                regions ( name )
              )
            )
          )
        `)
        .eq("payment_method", "mpesa_c2b")
        .eq("loans.customers.tenant_id", tenantId)
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

      // Format data
      const formatted = payments.map(item => {
        const customer = item.loans?.customers;
        const branch = customer?.branches;
        const region = branch?.regions;

        const fullName = customer
          ? [customer.Firstname, customer.Middlename, customer.Surname]
            .filter(n => n && n.trim() !== "")
            .join(" ")
          : "N/A";

        const paymentDate = item.paid_at ? new Date(item.paid_at) : null;
        const rawPayload = mpesaMap[item.mpesa_receipt];
        const billRef = rawPayload?.BillRefNumber || "N/A";

        return {
          id: item.id,
          customerName: fullName,
          idNumber: customer?.id_number || "N/A",
          mobile: item.phone_number || "N/A",
          branch: branch?.name || "N/A",
          region: region?.name || "N/A",
          transactionId: item.mpesa_receipt || "N/A",
          amountPaid: parseFloat(item.paid_amount) || 0,
          dbStatus: "success",
          displayStatus: "success",
          billRef,
          paymentDate,
          rawDate: item.paid_at,
          customerId: customer?.id || null,
          loanId: item.loan_id || null,
        };
      });

      if (isMounted.current) setRawRepayments(formatted);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ data: formatted, timestamp: Date.now() }));
      } catch (e) {
        console.error("Cache write error:", e);
      }
    } catch (err) {
      // If aborted due to timeout, show error message
      if (signal.aborted && isTimeout.current && isMounted.current) {
        setFetchError("Request timed out after 30 seconds. Please try again.");
      } else if (!signal.aborted && isMounted.current) {
        // Real error (not abort)
        console.error("Error fetching repayments:", err);
        setFetchError(err.message || "Failed to load data");
      }
      // If aborted due to unmount, do nothing
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setIsInitialLoad(false);
      }
    }
  }, [tenantId]);

  // Initial fetch with abort and timeout
  useEffect(() => {
    if (!tenantId) {
      setIsInitialLoad(false);
      return;
    }

    isMounted.current = true;

    // Create new AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Set timeout to abort after 30 seconds
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

    // Abort any ongoing request
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

  // Date range helper (unchanged)
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

  // Filtered and sorted data (unchanged)
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

  // Summary stats (unchanged)
  const summaryStats = useMemo(() => {
    const totalCount = filteredData.length;
    const successfulCount = filteredData.filter(r => r.displayStatus === "success").length;
    const totalAmount = filteredData.reduce((sum, r) => sum + r.amountPaid, 0);
    return { totalCount, successfulCount, totalAmount };
  }, [filteredData]);

  // Pagination (unchanged)
  const pagination = useMemo(() => {
    const totalRows = filteredData.length;
    const totalPages = Math.ceil(totalRows / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, totalRows);
    const currentData = filteredData.slice(startIdx, endIdx);
    return { totalRows, totalPages, startIdx, endIdx, currentData };
  }, [filteredData, currentPage]);

  // Handlers (unchanged)
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

  const exportToCSV = useCallback(() => {
    if (filteredData.length === 0) {
      alert("No data to export");
      return;
    }
    const formatDate = (date) => date ? new Date(date).toLocaleDateString("en-KE", { year: 'numeric', month: 'short', day: 'numeric' }) : "N/A";
    const formatTime = (date) => date ? new Date(date).toLocaleTimeString("en-KE", { hour: '2-digit', minute: '2-digit', hour12: false }) : "N/A";
    const formatCurrency = (amount) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0 }).format(amount || 0);

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
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mpesa_repayments_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredData]);

  // Early returns
  if (!tenantId) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800">Tenant information missing</h2>
          <p className="text-gray-600 mt-2">Please log in again to continue.</p>
        </div>
      </div>
    );
  }

  if (loading && isInitialLoad) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <Spinner text="Loading M-Pesa Repayments..." />
      </div>
    );
  }

  // Main render (JSX unchanged from original, except the table body now includes error state)
  return (
    <div className="min-h-screen bg-brand-surface p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header Section (same as before) */}
        <div className="bg-brand-secondary rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden relative">
       <div className="bg-brand-secondary rounded-xl shadow-md border border-gray-200 p-4 overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">

              <div>
                <h1 className="text-sm font-bold text-stone-600 uppercase">{tenant?.company_name || "Company Name"}</h1>
                <h2 className="text-lg font-semibold text-white mt-1">M-Pesa Repayment Reports</h2>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">

              <div className="flex gap-2 mt-2 flex-wrap justify-end">
                <SearchBox value={filters.search} onChange={(val) => handleFilterChange("search", val)} />

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border ${showFilters
                      ? "bg-accent text-white shadow-md border-transparent hover:bg-brand-secondary"
                      : "text-gray-600 border-gray-200 hover:bg-brand-secondary hover:text-white"
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
                    <option value="csv">CSV</option>
                    <option value="excel">Excel</option>
                    <option value="word">Word</option>
                    <option value="pdf">PDF</option>
                  </select>
                  <button
                    onClick={exportToCSV}
                    className="ml-2 px-3 py-1.5 rounded-md bg-accent text-white text-sm font-medium hover:bg-brand-secondary transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Panel (same) */}
        {showFilters && (
          <div className="mb-4 bg-white/80 backdrop-blur-sm rounded-lg border border-white/20 p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Filter Transactions</h3>
              <button onClick={clearFilters} className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1">
                <X className="w-3 h-3" />
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Region</label>
                <select value={filters.region} onChange={(e) => handleFilterChange("region", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white">
                  <option value="">All Regions</option>
                  {regions.map(region => <option key={region.id} value={region.name}>{region.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Branch</label>
                <select value={filters.branch} onChange={(e) => handleFilterChange("branch", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white">
                  <option value="">All Branches</option>
                  {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date Range</label>
                <select value={filters.dateRangeType} onChange={(e) => handleFilterChange("dateRangeType", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white">
                  <option value="">Select Range</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              {filters.dateRangeType === "custom" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                    <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange("startDate", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                    <input type="date" value={filters.endDate} onChange={(e) => handleFilterChange("endDate", e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none" />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Summary Metrics (same) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary shrink-0 font-bold">KES</div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Collections</p>
              <h3 className="text-2xl font-semibold text-accent">
                {new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0 }).format(summaryStats.totalAmount)}
              </h3>
            </div>
          </div>
          <div className="bg-green-50 p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent shrink-0 font-bold">#</div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Successful</p>
              <h3 className="text-xl font-semibold text-gray-600">{summaryStats.successfulCount}</h3>
            </div>
          </div>
          <div className="bg-amber-50 p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 shrink-0 font-bold">#</div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Transactions</p>
              <h3 className="text-xl font-semibold text-gray-600">{summaryStats.totalCount}</h3>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-left whitespace-nowrap">#</th>
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

              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                      <p className="text-sm text-gray-500 mt-2">Loading transactions...</p>
                    </td>
                  </tr>
                ) : fetchError ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center">
                      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                      <p className="text-sm text-red-600">Failed to load data: {fetchError}</p>
                      <button
                        onClick={handleManualRefresh}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                      >
                        Try Again
                      </button>
                    </td>
                  </tr>
                ) : pagination.currentData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Search className="w-12 h-12 text-gray-400 mb-3" />
                        <p className="text-sm text-gray-500">No transactions found</p>
                        {Object.values(filters).some(val => val) && (
                          <button onClick={clearFilters} className="mt-2 text-xs text-blue-600 hover:text-blue-800">
                            Clear filters to see all transactions
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagination.currentData.map((r, i) => (
                    <RepaymentTableRow key={r.id} repayment={r} index={i} startIdx={pagination.startIdx} />
                  ))
                )}
              </tbody>

              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan="7" className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
                    Total ({pagination.totalRows} transactions):
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-700 whitespace-nowrap">
                    {new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0 }).format(summaryStats.totalAmount)}
                  </td>
                  <td colSpan="3"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {!loading && pagination.totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={pagination.totalPages}
              onPageChange={setCurrentPage}
              startIdx={pagination.startIdx}
              endIdx={pagination.endIdx}
              totalRows={pagination.totalRows}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MpesaRepaymentReports;