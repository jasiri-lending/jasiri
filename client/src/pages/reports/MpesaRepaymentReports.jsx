import React, { useState, useEffect } from "react";
import {
  Download,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Search,
} from "lucide-react";
import { supabase } from "../../supabaseClient";

const MpesaRepaymentReports = () => {
  const [repayments, setRepayments] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [filters, setFilters] = useState({
    search: "",
    branch: "",
    status: "",
    startDate: "",
    endDate: "",
    dateRangeType: "",
  });

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase.from("branches").select("id, name");
      if (!error && data) setBranches(data);
    };
    fetchBranches();
  }, []);

useEffect(() => {
  const fetchRepayments = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("mpesa_c2b_transactions")
        .select(`
          id,
          transaction_id,
          phone_number,
          amount,
          status,
          description,
          billref,
          transaction_time,
          loan_id,
          loans:loan_id(
            id,
            customer:customer_id(
              id,
              "Firstname",
              "Middlename",
              "Surname",
              id_number,
              branch:branch_id(name)
            )
          )
        `)
        // ✅ Filter by description
        .eq("description", "Loan repayment processed")
        .order("transaction_time", { ascending: false });

      if (error) throw error;

      // Map and format
      const formatted = data.map((item, index) => {
        const customer = item.loans?.customer || {};
        const fullName = [customer.Firstname, customer.Middlename, customer.Surname]
          .filter(Boolean)
          .join(" ") || "N/A";

        const paymentDate = item.transaction_time
          ? new Date(item.transaction_time)
          : null;

        return {
          id: item.id,
          customerName: fullName,
          idNumber: customer.id_number || "N/A",
          mobile: item.phone_number || "N/A",
          branch: customer.branch?.name || "N/A",
          transactionId: item.transaction_id || "N/A",
          amountPaid: item.amount || 0,
          status: item.status || "pending",
          billRef: item.billref || "N/A",
          paymentDate,
        };
      });

      setRepayments(formatted);
      setFiltered(formatted);
    } catch (err) {
      console.error("Error fetching repayments:", err.message);
    } finally {
      setLoading(false);
    }
  };

  fetchRepayments();
}, []);


  // Function to get start and end date based on range type
  const getDateRange = (type) => {
    const now = new Date();
    let start, end;

    switch (type) {
      case "today":
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date();
        break;
      case "week": {
        const day = now.getDay();
        start = new Date(now);
        start.setDate(now.getDate() - day);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        break;
      }
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "quarter": {
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      }
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        start = filters.startDate ? new Date(filters.startDate) : null;
        end = filters.endDate ? new Date(filters.endDate) : null;
    }
    return { start, end };
  };

  // Filtering logic with date range support
  useEffect(() => {
    let result = [...repayments];
    const { search, branch, status, dateRangeType, startDate, endDate } = filters;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.customerName.toLowerCase().includes(q) ||
          r.mobile.includes(q) ||
          r.idNumber.includes(q) ||
          r.transactionId.toLowerCase().includes(q)
      );
    }

    if (branch) result = result.filter((r) => r.branch === branch);
    if (status) {
      result = result.filter(
        (r) => r.status.toLowerCase() === status.toLowerCase()
      );
    }

    // Apply date range filtering
    const { start, end } = getDateRange(dateRangeType);
    if (start) {
      result = result.filter((r) => r.paymentDate && r.paymentDate >= start);
    }
    if (end) {
      result = result.filter((r) => r.paymentDate && r.paymentDate <= end);
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

    setFiltered(result);
    setCurrentPage(1);
  }, [filters, repayments, sortConfig]);

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
    return new Date(date).toLocaleDateString("en-KE");
  };

  // Filter & Reset handlers
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      branch: "",
      status: "",
      startDate: "",
      endDate: "",
      dateRangeType: "",
    });
  };

  // CSV Export
  const exportToCSV = () => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }

    const csv = [
      [
        "No",
        "Customer Name",
        "Mobile",
        "ID Number",
        "Branch",
        "Transaction ID",
        "Amount Paid",
        "Status",
        "Payment Date",
      ],
      ...filtered.map((r, i) => [
        i + 1,
        `"${r.customerName}"`,
        r.mobile,
        r.idNumber,
        r.branch,
        r.transactionId,
        r.amountPaid,
        r.status,
        formatDate(r.paymentDate),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mpesa_repayment_report_${new Date()
      .toISOString()
      .split("T")[0]}.csv`;
    a.click();
  };

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const currentData = filtered.slice(startIdx, startIdx + itemsPerPage);
  const totalAmount = filtered.reduce((sum, r) => sum + r.amountPaid, 0);

  // Sortable Header Component
  const SortableHeader = ({ label, sortKey }) => (
    <th
      onClick={() => handleSort(sortKey)}
      className="px-6 py-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-200 whitespace-nowrap text-left"
    >
      <div className="flex items-center gap-2">
        {label}
        {sortConfig.key === sortKey &&
          (sortConfig.direction === "asc" ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          ))}
      </div>
    </th>
  );

  // Pagination controls
  const PaginationControls = () => (
    <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200">
      <div className="text-sm text-gray-700">
        Showing {startIdx + 1} to {Math.min(startIdx + itemsPerPage, filtered.length)} of{" "}
        {filtered.length} entries
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg">
          {currentPage}
        </span>
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        {/* TOP HEADER BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "#586ab1" }}>M-Pesa Repayment Reports</h1>
            <p className="text-sm text-gray-600 mt-1">
              Viewing all M-Pesa loan repayment transactions
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all ${
                showFilters
                  ? "bg-blue-300 text-white shadow-md"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>

            <button
              onClick={exportToCSV}
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* FILTER PANEL */}
        {showFilters && (
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <input
                type="text"
                placeholder="Search by name, phone, ID, or Txn ID"
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />

              {/* Branch */}
              <select
                value={filters.branch}
                onChange={(e) => handleFilterChange("branch", e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>

              {/* Status */}
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>

              {/* Date Filter Type */}
              <select
                value={filters.dateRangeType}
                onChange={(e) => handleFilterChange("dateRangeType", e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Select Date Range</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
                <option value="custom">Custom</option>
              </select>

              {/* Custom Date Pickers (only show if 'custom' selected) */}
              {filters.dateRangeType === "custom" && (
                <div className="col-span-1 sm:col-span-2 lg:col-span-2 flex items-center gap-2">
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange("startDate", e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-gray-500 text-sm">to</span>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange("endDate", e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Clear Button */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg font-medium text-gray-700 transition"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading repayments...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No records found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200 text-sm">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-left">#</th>
                    <SortableHeader label="Customer Name" sortKey="customerName" />
                    <SortableHeader label="Mobile" sortKey="mobile" />
                    <SortableHeader label="ID Number" sortKey="idNumber" />
                    <SortableHeader label="Branch" sortKey="branch" />
                    <SortableHeader label="Transaction ID" sortKey="transactionId" />
                    <SortableHeader label="Amount Paid" sortKey="amountPaid" />
                    <SortableHeader label="Status" sortKey="status" />
                    <SortableHeader label="Payment Date" sortKey="paymentDate" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {currentData.map((r, i) => (
                    <tr key={r.id} className="hover:bg-gray-50 text-sm">
                      <td className="px-6 py-4 text-gray-900">{startIdx + i + 1}</td>
                      <td className="px-6 py-4">{r.customerName}</td>
                      <td className="px-6 py-4">{r.mobile}</td>
                      <td className="px-6 py-4">{r.idNumber}</td>
                      <td className="px-6 py-4">{r.branch}</td>
                      <td className="px-6 py-4 font-mono text-sm">{r.transactionId}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        {formatCurrency(r.amountPaid)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm ${
                          r.status === 'completed' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">{formatDate(r.paymentDate)}</td>
                    </tr>
                  ))}

                  {/* TOTAL ROW */}
                  <tr className="bg-gray-50 font-bold text-gray-900">
                    <td colSpan="6" className="px-6 py-4 text-right">
                      Total Repayment:
                    </td>
                    <td className="px-6 py-4 text-right text-green-600">
                      {formatCurrency(totalAmount)}
                    </td>
                    <td colSpan="2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <PaginationControls />
          </>
        )}
      </div>
    </div>
  );
};

export default MpesaRepaymentReports;