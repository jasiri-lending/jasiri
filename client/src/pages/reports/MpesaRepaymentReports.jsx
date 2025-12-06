import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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

const MpesaRepaymentReports = () => {
  const [repayments, setRepayments] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50); // Changed from 15 to 50
  const [sortConfig, setSortConfig] = useState({ key: "paymentDate", direction: "desc" });
  const [filters, setFilters] = useState({
    search: "",
    branch: "",
    status: "",
    startDate: "",
    endDate: "",
    dateRangeType: "",
  });

  const hasFetched = useRef(false);

  // Status mapping with proper display names and colors
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

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .order("name");
      if (!error && data) setBranches(data);
    };
    fetchBranches();
  }, []);

  // Fetch repayments from loan_payments table with LEFT joins
  const fetchRepayments = useCallback(async (isRefresh = false) => {
    if (!isRefresh && hasFetched.current) return;

    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      
      // Query using loan_payments table with proper joins
      const { data, error } = await supabase
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
                name
              )
            )
          )
        `)
        .eq("payment_method", "mpesa_c2b")
        .order("paid_at", { ascending: false });

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      console.log("Fetched data:", data); // Debug log

      const formatted = data.map((item) => {
        const customer = item.loans?.customers;
        const branch = customer?.branches;
        
        // Debug log for each item
        console.log("Processing item:", {
          id: item.id,
          customer,
          branch,
          mpesa_receipt: item.mpesa_receipt
        });

        // Build full name safely
        let fullName = "N/A";
        if (customer) {
          const nameParts = [
            customer.Firstname || "",
            customer.Middlename || "",
            customer.Surname || ""
          ].filter(name => name && String(name).trim() !== "");
          fullName = nameParts.length > 0 ? nameParts.join(" ") : "N/A";
        }

        const paymentDate = item.paid_at
          ? new Date(item.paid_at)
          : null;

        // Since loan_payments doesn't have status, we'll default to success
        const dbStatus = "success";
        const displayStatus = "success";

        return {
          id: item.id,
          customerName: fullName,
          idNumber: customer?.id_number || "N/A",
          mobile: item.phone_number || "N/A",
          branch: branch?.name || "N/A",
          transactionId: item.mpesa_receipt || "N/A",
          amountPaid: parseFloat(item.paid_amount) || 0,
          dbStatus: dbStatus,
          displayStatus: displayStatus,
          billRef: item.description || "N/A",
          paymentDate,
          rawDate: item.paid_at,
          customerId: customer?.id || null,
          loanId: item.loan_id || null,
        };
      });

      console.log("Formatted data:", formatted); // Debug log
      setRepayments(formatted);
      setFiltered(formatted);
      hasFetched.current = true;
    } catch (err) {
      console.error("Error fetching repayments:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

useEffect(() => {
  if (!hasFetched.current) {
    fetchRepayments();
  }
}, []);


  // Filtering logic
  useEffect(() => {
    if (loading) return;

    let result = [...repayments];
    const { search, branch, status, dateRangeType } = filters;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.customerName.toLowerCase().includes(q) ||
          r.mobile.includes(q) ||
          r.idNumber.includes(q) ||
          r.transactionId.toLowerCase().includes(q) ||
          r.billRef.toLowerCase().includes(q)
      );
    }

    if (branch) result = result.filter((r) => r.branch === branch);
    
    if (status) {
      if (status === "success") {
        result = result.filter((r) => 
          r.dbStatus === "applied" || r.displayStatus === "success"
        );
      } else {
        result = result.filter((r) => r.dbStatus === status);
      }
    }

    // Apply date range filtering
    const { start, end } = getDateRange(dateRangeType);
    if (start) {
      result = result.filter((r) => r.paymentDate && r.paymentDate >= start);
    }
    if (end) {
      result = result.filter((r) => r.paymentDate && r.paymentDate <= end);
    }

    // Apply custom date range if provided
    if (filters.startDate && !dateRangeType) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter((r) => r.paymentDate && r.paymentDate >= start);
    }
    if (filters.endDate && !dateRangeType) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter((r) => r.paymentDate && r.paymentDate <= end);
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
    let start, end;

    switch (type) {
      case "today":
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case "week": {
        const day = now.getDay();
        start = new Date(now);
        start.setDate(now.getDate() - day);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      }
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case "quarter": {
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
        break;
      }
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
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
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      branch: "",
      status: "",
      startDate: "",
      endDate: "",
      dateRangeType: "",
    });
  }, []);

  // CSV Export
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

  // Get unique statuses for filter
  const uniqueStatuses = useMemo(() => {
    const statuses = [...new Set(repayments.map(r => r.dbStatus))];
    return statuses.filter(Boolean).sort();
  }, [repayments]);

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, filtered.length);
  const currentData = filtered.slice(startIdx, endIdx);
  const totalAmount = useMemo(() => 
    filtered.reduce((sum, r) => sum + r.amountPaid, 0), 
    [filtered]
  );

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
                className={`w-8 h-8 rounded text-xs transition-colors ${
                  currentPage === pageNum
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-3 md:p-4">
      {/* HEADER */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#586ab1" }}>M-Pesa Repayment Reports</h1>
            <p className="text-xs text-gray-600">Monitor loan repayment transactions</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fetchRepayments(true)}
              disabled={refreshing}
              className="px-3 py-1.5 bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-sm font-medium transition-colors ${
                showFilters
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>Filters</span>
              {Object.values(filters).some(val => val) && (
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </button>

            <button
              onClick={exportToCSV}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>Export CSV</span>
            </button>
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

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="">All Status</option>
                <option value="success">Success</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
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

            {/* Custom Date Pickers */}
            {filters.dateRangeType === "custom" && (
              <>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange("startDate", e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
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

      {/* TABLE WITH PAGINATION */}
      <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-white/20 shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse">
          <thead>
  <tr className="bg-gray-50 border-b border-gray-200">
    <th className="px-4 py-3 text-lg font-medium tracking-wider whitespace-nowrap text-[#586ab1]">
      #
    </th>

    <SortableHeader label="Customer Name" sortKey="customerName" className="text-lg" />
    <SortableHeader label="Mobile" sortKey="mobile" className="text-lg" />
    <SortableHeader label="ID Number" sortKey="idNumber" className="text-lg" />
    <SortableHeader label="Branch" sortKey="branch" className="text-lg" />
    <SortableHeader label="Transaction ID" sortKey="transactionId" className="text-lg" />
    <SortableHeader label="Amount" sortKey="amountPaid" className="text-lg" />
    <SortableHeader label="Status" sortKey="displayStatus" className="text-lg" />
    <SortableHeader label="Payment Date & Time" sortKey="paymentDate" className="text-lg" />
  </tr>
</thead>


            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Loading transactions...</p>
                  </td>
                </tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
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
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{startIdx + i + 1}</td>

                    {/* Customer Name */}
                    <td className="px-4 py-3 text-xs text-gray-700 font-medium min-w-[150px] max-w-xs break-words">
                      {r.customerName}
                    </td>

                    {/* Mobile */}
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap w-36">
                      {r.mobile}
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{r.idNumber}</td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">{r.branch}</td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                        {r.transactionId}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs font-semibold text-gray-900 whitespace-nowrap">
                      {formatCurrency(r.amountPaid)}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={r.displayStatus} />
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {formatDate(r.paymentDate)} {formatTime(r.paymentDate)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan="6" className="px-4 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
                  Total ({filtered.length} transactions):
                </td>

                <td className="px-4 py-3 text-sm font-bold text-emerald-700 whitespace-nowrap">
                  {formatCurrency(totalAmount)}
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
  );
};

export default MpesaRepaymentReports;