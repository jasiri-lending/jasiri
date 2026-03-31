import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Download,
  Filter,
  Search,
  RefreshCw,
  Activity,
  DollarSign,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  Link as LinkIcon
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import Spinner from "../../components/Spinner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
} from "docx";
import { saveAs } from "file-saver";

// ========== Memoized Helper Components ==========

const MetricCard = ({ title, value, subtitle, icon: Icon, color = "blue" }) => {
  const colorMap = {
    blue: { bg: "bg-blue-50", border: "border-blue-100", iconBg: "bg-blue-100", iconColor: "text-blue-600", titleColor: "text-blue-700", valueColor: "text-blue-800" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-100", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", titleColor: "text-emerald-700", valueColor: "text-emerald-800" },
    orange: { bg: "bg-orange-50", border: "border-orange-100", iconBg: "bg-orange-100", iconColor: "text-orange-600", titleColor: "text-orange-700", valueColor: "text-orange-800" },
    purple: { bg: "bg-purple-50", border: "border-purple-100", iconBg: "bg-purple-100", iconColor: "text-purple-600", titleColor: "text-purple-700", valueColor: "text-purple-800" },
  };

  const style = colorMap[color] || colorMap.blue;

  return (
    <div className={`${style.bg} ${style.border} border rounded-2xl shadow-sm p-6 flex flex-col justify-between h-full transition-all hover:shadow-md`}>
      <div className="flex justify-between items-start gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <p className={`text-xs sm:text-sm font-bold ${style.titleColor} uppercase tracking-wider truncate mb-1 opacity-80`}>
            {title}
          </p>
          <h3 className={`text-lg sm:text-xl font-bold ${style.valueColor} break-words leading-tight`}>
            {value}
          </h3>
        </div>
        <div className={`p-3 sm:p-4 rounded-2xl flex-shrink-0 ${style.iconBg} ${style.iconColor} shadow-inner`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>
      {subtitle && (
        <div className="border-t border-current/10 pt-3 mt-auto">
          <p className={`text-xs font-bold ${style.titleColor} opacity-70 flex items-center gap-1.5`}>
            <span className="w-2 h-2 rounded-full bg-current opacity-40 animate-pulse"></span>
            {subtitle}
          </p>
        </div>
      )}
    </div>
  );
};

const SortableHeader = React.memo(({ label, sortKey, sortConfig, onSort }) => {
  const isActive = sortConfig.key === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className="px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 whitespace-nowrap text-left text-xs tracking-wider border-b"
    >
      <div className="flex items-center justify-between group">
        <span className="font-medium">{label}</span>
        <div className="flex flex-col ml-2">
          <ChevronUp className={`w-3 h-3 -mb-1 ${isActive && sortConfig.direction === "asc" ? "text-brand-primary" : "text-gray-300 group-hover:text-gray-400"}`} />
          <ChevronDown className={`w-3 h-3 ${isActive && sortConfig.direction === "desc" ? "text-brand-primary" : "text-gray-300 group-hover:text-gray-400"}`} />
        </div>
      </div>
    </th>
  );
});
SortableHeader.displayName = "SortableHeader";

const SuspensePaymentsReport = () => {
  const { tenant, profile } = useAuth();
  const [rawTransactions, setRawTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    dateRange: "all",
  });

  const [sortConfig, setSortConfig] = useState({
    key: "transaction_time",
    direction: "desc",
  });

  const formatCurrency = (num) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);

  const loadData = useCallback(async () => {
    if (!tenant?.id) return;
    setRefreshing(true);

    try {
      let query = supabase
        .from("suspense_transactions")
        .select(`
          id, payer_name, phone_number, amount, transaction_id, 
          transaction_time, status, linked_customer_id, 
          reason, billref, tenant_id
        `)
        .eq("tenant_id", tenant.id);

      const { data, error } = await query.order("transaction_time", { ascending: false });

      if (error) throw error;
      setRawTransactions(data || []);
    } catch (err) {
      console.error("Error loading suspense transactions:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const clearFilters = () => {
    setFilters({ search: "", status: "all", dateRange: "all" });
    setCurrentPage(1);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const filteredData = useMemo(() => {
    let result = [...rawTransactions];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(r => 
        (r.payer_name || "").toLowerCase().includes(q) ||
        (r.phone_number || "").includes(q) ||
        (r.transaction_id || "").toLowerCase().includes(q) ||
        (r.billref || "").toLowerCase().includes(q)
      );
    }

    if (filters.status !== "all") {
      result = result.filter(r => r.status === filters.status);
    }

    if (filters.dateRange !== "all") {
      const now = new Date();
      const start = new Date();
      if (filters.dateRange === "today") start.setHours(0, 0, 0, 0);
      if (filters.dateRange === "this_month") start.setDate(1);
      
      result = result.filter(r => new Date(r.transaction_time) >= start);
    }

    return result;
  }, [rawTransactions, filters]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const stats = useMemo(() => {
    const total = sortedData.length;
    const totalAmount = sortedData.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const unallocated = sortedData.filter(r => r.status === "suspense" || !r.linked_customer_id).length;
    return { total, totalAmount, unallocated };
  }, [sortedData]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const currentData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // ========== Export Functions ==========
  const exportToCSV = () => {
    const headers = ["Payer Name", "Phone", "Amount", "Trans ID", "Time", "Status", "BillRef", "Reason"];
    const csvContent = "\ufeff" + [headers, ...sortedData.map(r => [
      `"${r.payer_name || "N/A"}"`, r.phone_number, r.amount, r.transaction_id, 
      new Date(r.transaction_time).toLocaleString(), r.status, `"${r.billref || ""}"`, `"${r.reason || ""}"`
    ])].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `suspense_report_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(sortedData.map(r => ({
      "Payer Name": r.payer_name || "N/A",
      "Phone": r.phone_number,
      "Amount": r.amount,
      "Transaction ID": r.transaction_id,
      "Time": new Date(r.transaction_time).toLocaleString(),
      "Status": r.status,
      "BillRef": r.billref || "",
      "Reason": r.reason || ""
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Suspense");
    XLSX.writeFile(workbook, `suspense_report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF("l", "pt", "a4");
    autoTable(doc, {
      head: [["Payer Name", "Phone", "Amount", "Trans ID", "Time", "Status", "BillRef"]],
      body: sortedData.map(r => [
        r.payer_name || "N/A", r.phone_number, formatCurrency(r.amount), r.transaction_id, 
        new Date(r.transaction_time).toLocaleString(), r.status, r.billref || ""
      ]),
      margin: { top: 60 },
      didDrawPage: (data) => {
        doc.setFontSize(18);
        doc.text(tenant?.company_name || "Jasiri", data.settings.margin.left, 40);
      }
    });
    doc.save(`suspense_report_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handleExport = () => {
    if (exportFormat === "csv") exportToCSV();
    else if (exportFormat === "excel") exportToExcel();
    else if (exportFormat === "pdf") exportToPDF();
  };

  if (loading && !refreshing) {
    return <div className="min-h-screen bg-muted flex items-center justify-center"><Spinner text="Loading suspense transactions..." /></div>;
  }

  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-brand-secondary rounded-xl shadow-md border border-gray-200 p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-sm font-bold text-stone-600 uppercase tracking-wider">{tenant?.company_name || ""}</h1>
              <h2 className="text-xl font-bold text-white mt-1">Suspense Payments Report</h2>
              <p className="text-xs text-stone-300 mt-1">Manage and reconcile unallocated M-Pesa transactions.</p>
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={filters.search}
                  onChange={e => handleFilterChange("search", e.target.value)}
                  className="bg-white border-0 pl-10 pr-4 py-2 rounded-lg text-sm w-64 focus:ring-2 focus:ring-accent outline-none shadow-sm"
                />
              </div>


              <button 
                onClick={() => setShowFilters(!showFilters)} 
                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border shadow-sm ${
                  showFilters ? "bg-accent text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <Filter className="w-4 h-4" />
                Filter
              </button>

              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="bg-transparent text-sm font-medium text-gray-700 px-2 py-1 focus:outline-none cursor-pointer"
                >
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                  <option value="pdf">PDF</option>
                </select>
                <button
                  onClick={handleExport}
                  className="ml-2 px-3 py-1.5 rounded-md bg-accent text-white text-sm font-medium hover:brightness-110 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Filter className="w-4 h-4 text-brand-primary" />
                Detailed Filters
              </h3>
              <button onClick={clearFilters} className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1.5 transition-colors">
                <RefreshCw className="w-3 h-3" />
                Reset Filters
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Payment Status</label>
                <select
                  value={filters.status}
                  onChange={e => handleFilterChange("status", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                >
                  <option value="all">All Transactions</option>
                  <option value="suspense">Suspense</option>
                  <option value="allocated">Allocated</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Time Period</label>
                <select
                  value={filters.dateRange}
                  onChange={e => handleFilterChange("dateRange", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="this_month">This Month</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Stats Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <MetricCard title="Total Suspense" value={stats.total} color="blue" icon={Activity} subtitle="Total transactions found" />
          <MetricCard title="Total Amount" value={formatCurrency(stats.totalAmount)} color="emerald" icon={DollarSign} subtitle="Gross volume in suspense" />
          <MetricCard title="Unallocated" value={stats.unallocated} color="orange" icon={AlertCircle} subtitle="Needs immediate reconciliation" />
        </div>

        {/* Data Table Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-xs tracking-wider border-b">#</th>
                  <SortableHeader label="Payer Name" sortKey="payer_name" sortConfig={sortConfig} onSort={k => setSortConfig({ key: k, direction: sortConfig.direction === "asc" ? "desc" : "asc" })} />
                  <SortableHeader label="Phone Number" sortKey="phone_number" sortConfig={sortConfig} onSort={k => setSortConfig({ key: k, direction: sortConfig.direction === "asc" ? "desc" : "asc" })} />
                  <SortableHeader label="Amount" sortKey="amount" sortConfig={sortConfig} onSort={k => setSortConfig({ key: k, direction: sortConfig.direction === "asc" ? "desc" : "asc" })} />
                  <SortableHeader label="Trans ID" sortKey="transaction_id" sortConfig={sortConfig} onSort={k => setSortConfig({ key: k, direction: sortConfig.direction === "asc" ? "desc" : "asc" })} />
                  <SortableHeader label="Time" sortKey="transaction_time" sortConfig={sortConfig} onSort={k => setSortConfig({ key: k, direction: sortConfig.direction === "asc" ? "desc" : "asc" })} />
                  <SortableHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={k => setSortConfig({ key: k, direction: sortConfig.direction === "asc" ? "desc" : "asc" })} />
                  <SortableHeader label="BillRef" sortKey="billref" sortConfig={sortConfig} onSort={k => setSortConfig({ key: k, direction: sortConfig.direction === "asc" ? "desc" : "asc" })} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentData.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-12 text-center text-gray-400 italic">No suspense transactions found matching your criteria.</td>
                  </tr>
                ) : (
                  currentData.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-600 font-medium">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                      <td className="px-4 py-3 text-xs font-bold text-brand-primary whitespace-nowrap">{row.payer_name || "Unidentified"}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{row.phone_number}</td>
                      <td className="px-4 py-3 text-xs font-bold text-emerald-600 whitespace-nowrap text-right">{formatCurrency(row.amount)}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-gray-500 uppercase tracking-wider whitespace-nowrap">{row.transaction_id}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>{new Date(row.transaction_time).toLocaleDateString()}</span>
                          <span className="text-[10px] opacity-60">{new Date(row.transaction_time).toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          row.status === "suspense" ? "bg-orange-100 text-orange-700 border border-orange-200" : "bg-green-100 text-green-700 border border-green-200"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 italic whitespace-nowrap">{row.billref || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && sortedData.length > 0 && (
            <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Showing {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 disabled:opacity-50 hover:border-brand-primary transition-all shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex gap-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    if (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - currentPage) <= 1) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all shadow-sm ${currentPage === pageNum
                            ? "bg-brand-primary text-white"
                            : "bg-white text-gray-600 border border-gray-200 hover:border-brand-primary hover:text-brand-primary"
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                      return <span key={pageNum} className="px-1 text-gray-400 mt-2">...</span>;
                    }
                    return null;
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 disabled:opacity-50 hover:border-brand-primary transition-all shadow-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuspensePaymentsReport;

