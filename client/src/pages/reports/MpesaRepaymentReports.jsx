import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { useAuth } from "../../hooks/userAuth";


const MpesaRepaymentReports = () => {
  const { tenant } = useAuth();
  const [repayments, setRepayments] = useState(() => {
    const cached = localStorage.getItem("mpesa-repayments-data");
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000; // 24 hours
        if (!isExpired) return data;
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [filtered, setFiltered] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [sortConfig, setSortConfig] = useState({ key: "paymentDate", direction: "desc" });
  const [exportFormat, setExportFormat] = useState("csv");
  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem("mpesa-repayments-filters");
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...parsed, search: "" }; // Don't persist search
    }
    return {
      search: "",
      branch: "",
      region: "",
      startDate: "",
      endDate: "",
      dateRangeType: "",
    };
  });

  const hasFetched = useRef(false);

  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem("mpesa-repayments-filters", JSON.stringify(filters));
  }, [filters]);

  // Status mapping
  const statusConfig = {
    applied: {
      label: "Success",
      color: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      icon: CheckCircle,
    },
    completed: {
      label: "Completed",
      color: "bg-blue-50 text-blue-700 border border-blue-200",
      icon: CheckCircle,
    },
    success: {
      label: "Success",
      color: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      icon: CheckCircle,
    },
    pending: {
      label: "Pending",
      color: "bg-amber-50 text-amber-700 border border-amber-200",
      icon: Clock,
    },
    failed: {
      label: "Failed",
      color: "bg-red-50 text-red-700 border border-red-200",
      icon: AlertCircle,
    },
    default: {
      label: "Processing",
      color: "bg-gray-50 text-gray-700 border border-gray-200",
      icon: Clock,
    },
  };

  // Fetch branches with region names
  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase
        .from("branches")
        .select(`
          id, 
          name,
          regions (
            id,
            name
          )
        `)
        .order("name");

      if (!error && data) {
        setBranches(data);
      }
    };

    const fetchRegions = async () => {
      const { data, error } = await supabase
        .from("regions")
        .select("id, name")
        .order("name");

      if (!error && data) {
        setRegions(data);
      }
    };

    fetchBranches();
    fetchRegions();
  }, []);

  // Fetch repayments with region names
  const fetchRepayments = useCallback(async (isRefresh = false) => {
    try {
      const cacheKey = "mpesa-repayments-data";

      // If we already have data in state and not force refreshing, check if cache is valid
      if (!isRefresh && repayments.length > 0) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
          if (!isExpired) return;
        }
      }

      isRefresh ? setRefreshing(true) : setLoading(true);

      // 1️⃣ Fetch loan_payments with region names
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
          loans (
            id,
            customers (
              id,
              Firstname,
              Middlename,
              Surname,
              id_number,
              branches (
                name,
                regions (
                  name
                )
              )
            )
          )
        `)
        .eq("payment_method", "mpesa_c2b")
        .order("paid_at", { ascending: false });

      if (paymentsError) throw paymentsError;

      // 2️⃣ Fetch corresponding mpesa_c2b_transactions
      const mpesaIds = payments.map(p => p.mpesa_receipt).filter(Boolean);
      const { data: mpesaData, error: mpesaError } = await supabase
        .from("mpesa_c2b_transactions")
        .select("transaction_id, raw_payload")
        .in("transaction_id", mpesaIds);

      if (mpesaError) throw mpesaError;

      // 3️⃣ Create a lookup map
      const mpesaMap = {};
      mpesaData.forEach(m => {
        mpesaMap[m.transaction_id] = m.raw_payload;
      });

      // 4️⃣ Merge and format data with region
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
          region: region?.name || "N/A", // Get region name from the joined table
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

      setRepayments(formatted);
      setFiltered(formatted);

      // Save to cache
      localStorage.setItem(cacheKey, JSON.stringify({
        data: formatted,
        timestamp: Date.now()
      }));

      hasFetched.current = true;

    } catch (err) {
      console.error("Error fetching repayments:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [repayments.length]);

  useEffect(() => {
    if (!hasFetched.current) {
      fetchRepayments();
    }
  }, []);

  // Filtering logic with FIXED date filtering
  useEffect(() => {
    if (loading) return;

    let result = [...repayments];
    const { search, branch, region, startDate, endDate, dateRangeType } = filters;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => {
        const customerName = (r.customerName || "").toLowerCase();
        const mobile = String(r.mobile || "").toLowerCase();
        const idNumber = String(r.idNumber || "").toLowerCase();
        const transactionId = (r.transactionId || "").toLowerCase();
        const billRef = (r.billRef || "").toLowerCase();

        return (
          customerName.includes(q) ||
          mobile.includes(q) ||
          idNumber.includes(q) ||
          transactionId.includes(q) ||
          billRef.includes(q)
        );
      });
    }

    // Branch filter
    if (branch) {
      result = result.filter((r) => r.branch === branch);
    }

    // Region filter
    if (region) {
      result = result.filter((r) => r.region === region);
    }

    // Date filtering
    if (dateRangeType) {
      const { start, end } = getDateRange(dateRangeType);
      if (start) {
        result = result.filter((r) => r.paymentDate && r.paymentDate >= start);
      }
      if (end) {
        result = result.filter((r) => r.paymentDate && r.paymentDate <= end);
      }
    } else {
      // Custom date range (when dateRangeType is empty or not selected)
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        result = result.filter((r) => r.paymentDate && r.paymentDate >= start);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        result = result.filter((r) => r.paymentDate && r.paymentDate <= end);
      }
    }

    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortConfig.direction === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    setFiltered(result);
    setCurrentPage(1);
  }, [filters, repayments, sortConfig, loading]);

  // Function to get start and end date based on range type
  const getDateRange = (type) => {
    const now = new Date();
    let start = null;
    let end = null;

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
        start = null;
        end = null;
    }

    return { start, end };
  };

  // Sorting handler
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Currency formatter
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Date formatter
  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-KE", {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Time formatter
  const formatTime = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleTimeString("en-KE", {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const config = statusConfig[status] || statusConfig.default;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        <span>{config.label}</span>
      </div>
    );
  };

  // Filter & Reset handlers
  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };

      // Reset startDate and endDate when dateRangeType changes
      if (key === "dateRangeType" && value !== "custom") {
        newFilters.startDate = "";
        newFilters.endDate = "";
      }

      return newFilters;
    });
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
  }, []);

  // CSV Export with region
  const exportToCSV = useCallback(() => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }

    const csv = [
      [
        "No",
        "Customer Name",
        "Customer ID",
        "Mobile",
        "ID Number",
        "Branch",
        "Region",
        "Transaction ID",
        "Bill Reference",
        "Amount Paid (KES)",
        "Status",
        "Payment Date",
        "Payment Time",
      ],
      ...filtered.map((r, i) => [
        i + 1,
        `"${r.customerName}"`,
        r.customerId || "N/A",
        r.mobile,
        r.idNumber,
        r.branch,
        r.region,
        r.transactionId,
        r.billRef,
        r.amountPaid,
        r.displayStatus,
        formatDate(r.paymentDate),
        formatTime(r.paymentDate),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mpesa_repayments_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filtered]);

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, filtered.length);
  const currentData = filtered.slice(startIdx, endIdx);
  const summaryStats = useMemo(() => {
    const totalCount = filtered.length;
    const successfulCount = repayments.filter(r => r.displayStatus === "success").length;
    const totalAmount = filtered.reduce((sum, r) => sum + r.amountPaid, 0);
    return { totalCount, successfulCount, totalAmount };
  }, [filtered, repayments]);

  // Sortable Header Component
  const SortableHeader = useCallback(
    ({ label, sortKey }) => (
      <th
        onClick={() => handleSort(sortKey)}
        className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-50 whitespace-nowrap text-left text-sm tracking-wider border-b"
      >
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm" style={{ color: "#586ab1" }}>
            {label}
          </span>
          {sortConfig.key === sortKey &&
            (sortConfig.direction === "asc" ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            ))}
        </div>
      </th>
    ),
    [sortConfig, handleSort]
  );

  // Pagination controls
  const PaginationControls = useCallback(() => (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 rounded-b-lg">
      <div className="text-xs text-gray-600">
        Showing <span className="font-semibold">{startIdx + 1}</span> to{" "}
        <span className="font-semibold">{endIdx}</span> of{" "}
        <span className="font-semibold">{filtered.length}</span> entries
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="p-1.5 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
                className={`w-8 h-8 rounded text-xs transition-colors ${currentPage === pageNum
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-100 text-gray-700"
                  }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  ), [startIdx, endIdx, filtered.length, totalPages, currentPage]);

  return (
    <div className="min-h-screen bg-brand-surface p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
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
                <h1 className="text-lg font-bold text-white uppercase">{tenant?.company_name || "Company Name"}</h1>
                <p className="text-sm text-black">{tenant?.admin_email || "email@example.com"}</p>
                <h2 className="text-lg font-semibold text-white mt-1">
                  M-Pesa Repayment Reports
                </h2>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="text-sm text-gray-500 text-right">
                <p>Generated on:</p>
                <p className="font-medium text-gray-900">{new Date().toLocaleString()}</p>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap justify-end">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                    placeholder="Search name, ID, or phone"
                    className="border bg-gray-50 border-gray-300 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm w-64"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border
                    ${showFilters
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

        {/* FILTER PANEL */}
        {showFilters && (
          <div className="mb-4 bg-white/80 backdrop-blur-sm rounded-lg border border-white/20 p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Filter Transactions</h3>
              <button
                onClick={clearFilters}
                className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                    className="pl-7 w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>


              {/* Region */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Region</label>
                <select
                  value={filters.region}
                  onChange={(e) => handleFilterChange("region", e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="">All Regions</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.name}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Branch</label>
                <select
                  value={filters.branch}
                  onChange={(e) => handleFilterChange("branch", e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>


              {/* Date Range Type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date Range</label>
                <select
                  value={filters.dateRangeType}
                  onChange={(e) => handleFilterChange("dateRangeType", e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="">Select Range</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Custom Date Pickers - Show when custom is selected */}
              {filters.dateRangeType === "custom" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange("startDate", e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange("endDate", e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Collections */}
          <div className="bg-blue-50 p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary shrink-0 font-bold">
              KES
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Collections</p>
              <h3 className="text-2xl font-bold text-gray-900">{formatCurrency(summaryStats.totalAmount)}</h3>
            </div>
          </div>

          {/* Successful Transactions */}
          <div className="bg-green-50 p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent shrink-0 font-bold">
              #
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Successful</p>
              <h3 className="text-2xl font-bold text-gray-900">{summaryStats.successfulCount}</h3>
            </div>
          </div>

          {/* Total Count */}
          <div className="bg-amber-50 p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 shrink-0 font-bold">
              #
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Transactions</p>
              <h3 className="text-2xl font-bold text-gray-900">{summaryStats.totalCount}</h3>
            </div>
          </div>
        </div>

        {/* TABLE WITH PAGINATION */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-left whitespace-nowrap">#</th>
                  <SortableHeader label="Customer Name" sortKey="customerName" />
                  <SortableHeader label="Mobile" sortKey="mobile" />
                  <SortableHeader label="ID Number" sortKey="idNumber" />
                  <SortableHeader label="Branch" sortKey="branch" />
                  <SortableHeader label="Region" sortKey="region" />
                  <SortableHeader label="Transaction ID" sortKey="transactionId" />
                  <SortableHeader label="Amount" sortKey="amountPaid" />
                  <SortableHeader label="Account Paid" sortKey="billRef" />
                  <SortableHeader label="Status" sortKey="displayStatus" />
                  <SortableHeader label="Payment Date" sortKey="paymentDate" />
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <div className="flex justify-center">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                      </div>
                      <p className="text-sm text-gray-500 mt-2">Loading transactions...</p>
                    </td>
                  </tr>
                ) : currentData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Search className="w-12 h-12 text-gray-400 mb-3" />
                        <p className="text-sm text-gray-500">No transactions found</p>
                        {Object.values(filters).some(val => val) && (
                          <button
                            onClick={clearFilters}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                          >
                            Clear filters to see all transactions
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentData.map((r, i) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-400 whitespace-nowrap">{startIdx + i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.customerName}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.mobile}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">{r.idNumber}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.branch}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.region}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                          {r.transactionId}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap text-right">
                        {formatCurrency(r.amountPaid)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                          {r.billRef}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={r.displayStatus} />
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(r.paymentDate)} {formatTime(r.paymentDate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan="7" className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
                    Total ({filtered.length} transactions):
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-700 whitespace-nowrap">
                    {formatCurrency(summaryStats.totalAmount)}
                  </td>
                  <td colSpan="2" className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* PAGINATION */}
          {filtered.length > itemsPerPage && (
            <PaginationControls />
          )}
        </div>
      </div>
    </div>
  );
};

export default MpesaRepaymentReports;