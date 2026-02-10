import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "../../supabaseClient";
import {
  Loader2, Search, AlertTriangle, Filter, Download,
  FileText, Clock, RefreshCw, X, ChevronLeft, ChevronRight,
  UserX, Mail, Phone, Calendar, MapPin
} from "lucide-react";
import { useAuth } from "../../hooks/userAuth";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Document, Packer, Paragraph, TextRun,
  Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell,
  AlignmentType, Header, Footer
} from "docx";
import { saveAs } from "file-saver";
const itemsPerPage = 10;

const InactiveCustomers = () => {
  const { tenant } = useAuth();
  const [inactiveCustomers, setInactiveCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [days, setDays] = useState(30);

  // UI State
  const [showFilters, setShowFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter Options State
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [officers, setOfficers] = useState([]);

  // Filters State
  const [filters, setFilters] = useState({
    search: "",
    region: "",
    branch: "",
    officer: "",
    minInactivityDays: 30, // Sync with 'days' logic or use this
  });

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    if (key === 'minInactivityDays') setDays(value);
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      region: "",
      branch: "",
      officer: "",
      minInactivityDays: 30,
    });
    setDays(30);
  };

  // Stabilize fetch functions
  const fetchOptions = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const [branchesRes, regionsRes] = await Promise.all([
        supabase.from("branches").select("id, name, region_id").eq("tenant_id", tenant.id),
        supabase.from("regions").select("id, name").eq("tenant_id", tenant.id)
      ]);
      if (branchesRes.data) setBranches(branchesRes.data);
      if (regionsRes.data) setRegions(regionsRes.data);
    } catch (err) {
      console.error("Error fetching filter options:", err);
    }
  }, [tenant?.id]);

  const fetchInactiveCustomers = useCallback(async () => {
    if (!tenant?.id || loading) return;
    try {
      setLoading(true);
      setErrorMsg("");

      const { data, error } = await supabase.rpc("get_inactive_customers", {
        days,
      });

      if (error) throw error;

      let scopedData = data || [];
      if (scopedData.length > 0 && scopedData[0].tenant_id) {
        scopedData = scopedData.filter(c => c.tenant_id === tenant.id);
      }

      setInactiveCustomers(scopedData);

      const uniqueOfficers = [...new Set(scopedData.map(c => c.loan_officer).filter(Boolean))];
      setOfficers(uniqueOfficers);
    } catch (err) {
      console.error("Error fetching inactive customers:", err.message);
      setErrorMsg("Failed to load inactive customers. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, days]);

  // Use a ref to track the last successful fetch to prevent loops
  const lastFetchRef = useRef({ fetchKey: null });

  useEffect(() => {
    if (!tenant?.id) return;

    // Use a unique key for the current state to prevent redundant fetches
    const fetchKey = `${tenant.id}-${days}`;
    if (lastFetchRef.current.fetchKey === fetchKey) return;

    fetchOptions();
    fetchInactiveCustomers();
    lastFetchRef.current = { fetchKey };
  }, [tenant?.id, days, fetchOptions, fetchInactiveCustomers]);

  // Derived filtered data
  const filteredData = useMemo(() => {
    let result = [...inactiveCustomers];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(c =>
        (c.customer_name || "").toLowerCase().includes(q) ||
        (c.mobile || "").includes(q) ||
        (c.id_number || "").includes(q)
      );
    }

    if (filters.region) {
      const regionId = regions.find(r => r.name === filters.region)?.id;
      // We need to check if branch associated with customer matches this region
      // Assuming RPC returns branch_id or region info
      result = result.filter(c => {
        const branch = branches.find(b => b.name === c.branch_name);
        return branch?.region_id === regionId;
      });
    }

    if (filters.branch) {
      result = result.filter(c => c.branch_name === filters.branch);
    }

    if (filters.officer) {
      result = result.filter(c => c.loan_officer === filters.officer);
    }

    return result;
  }, [inactiveCustomers, filters, regions, branches]);

  // Pagination
  const { totalPages, startIdx, endIdx, currentData } = useMemo(() => {
    const total = filteredData.length;
    const pages = Math.ceil(total / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const data = filteredData.slice(start, end);
    return { totalPages: pages, startIdx: start, endIdx: end, currentData: data };
  }, [filteredData, currentPage]);

  const exportToCSV = () => {
    const headers = [
      "Customer Name", "Mobile", "ID Number", "Branch", "Loan Officer", "Disbursement Date", "Account Created", "Inactive Days"
    ].join(",");

    const rows = filteredData.map(c => [
      `"${c.customer_name}"`,
      c.mobile,
      c.id_number,
      c.branch_name || "N/A",
      c.loan_officer || "N/A",
      c.disbursement_date ? new Date(c.disbursement_date).toLocaleDateString() : "N/A",
      new Date(c.account_created).toLocaleDateString(),
      c.inactive_days
    ].join(","));

    const csvContent = "\ufeff" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `${tenant?.company_name || "Jasiri"}_inactive_customers_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const exportToExcel = () => {
    const worksheetData = filteredData.map((c) => ({
      "Customer Name": c.customer_name,
      "Mobile": c.mobile,
      "ID Number": c.id_number,
      "Branch": c.branch_name || "N/A",
      "Loan Officer": c.loan_officer || "N/A",
      "Disbursement Date": c.disbursement_date ? new Date(c.disbursement_date).toLocaleDateString() : "N/A",
      "Account Created": new Date(c.account_created).toLocaleDateString(),
      "Inactive Days": c.inactive_days
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inactive Customers");
    XLSX.writeFile(workbook, `${tenant?.company_name || "Jasiri"}_inactive_customers_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", format: "a4", unit: "pt" });
    const companyName = tenant?.company_name || "Jasiri";

    const tableColumn = [
      "No", "Customer Name", "Mobile", "ID Number", "Branch", "Loan Officer", "Inactive Days"
    ];

    const tableRows = filteredData.map((c, i) => [
      i + 1,
      c.customer_name,
      c.mobile,
      c.id_number,
      c.branch_name || "N/A",
      c.loan_officer || "N/A",
      `${c.inactive_days} days`
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      didDrawPage: (data) => {
        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text(companyName, data.settings.margin.left, 40);
        doc.setFontSize(12);
        doc.text("Inactive Customers Report", data.settings.margin.left, 60);
        doc.setFontSize(10);
        doc.text(
          `Generated: ${new Date().toLocaleString()} | Total: ${filteredData.length}`,
          data.settings.margin.left,
          80
        );
      },
      startY: 100,
      margin: { top: 100, left: 20, right: 20 },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [88, 106, 177], textColor: [255, 255, 255] }
    });

    doc.save(`${companyName.toLowerCase().replace(/ /g, "_")}_inactive_customers_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const exportToWord = async () => {
    const table = new DocxTable({
      rows: [
        new DocxTableRow({
          children: [
            "Customer Name", "Mobile", "Branch", "Loan Officer", "Inactive Days"
          ].map(h => new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] }))
        }),
        ...filteredData.map(c => new DocxTableRow({
          children: [
            c.customer_name, c.mobile, c.branch_name || "N/A", c.loan_officer || "N/A", `${c.inactive_days} days`
          ].map(v => new DocxTableCell({ children: [new Paragraph(v)] }))
        }))
      ]
    });

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: tenant?.company_name || "Jasiri", bold: true, size: 32 })] }),
          new Paragraph({ children: [new TextRun({ text: "Inactive Customers Report", size: 24 })] }),
          new Paragraph({ text: `Generated on: ${new Date().toLocaleString()}` }),
          new Paragraph({ text: "" }),
          table
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${tenant?.company_name || "Jasiri"}_inactive_customers_${new Date().toISOString().split("T")[0]}.docx`);
  };

  const handleExport = () => {
    switch (exportFormat) {
      case "csv": exportToCSV(); break;
      case "excel": exportToExcel(); break;
      case "pdf": exportToPDF(); break;
      case "word": exportToWord(); break;
      default: exportToCSV();
    }
  };

  return (
    <div className="min-h-screen bg-brand-surface pb-12">
      {/* HEADER SECTION */}
      <div className="bg-brand-secondary border-b border-gray-200 shadow-sm relative z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {tenant?.logo_url ? (
                <div className="w-14 h-14 bg-white p-2 rounded-xl shadow-md border border-gray-100 flex items-center justify-center overflow-hidden transition-transform hover:rotate-3">
                  <img src={tenant.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <div className="w-14 h-14 bg-brand-secondary rounded-xl flex items-center justify-center shadow-lg transition-transform hover:-rotate-3">
                  <UserX className="w-7 h-7 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  {tenant?.company_name || "Jasiri"}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <p className="text-sm font-bold text-white">Inactive Customers Report</p>
                  <div className="flex items-center gap-1.5 text-xs text-blue-100 font-medium bg-white/10 px-2 py-0.5 rounded-md border border-white/20">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Period: <span className="text-white font-bold">{days} Days</span></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="text-[10px] text-blue-100 uppercase tracking-wider font-bold text-right opacity-80">
                <p>Generated on:</p>
                <p className="text-sm font-bold text-white tracking-tight">{new Date().toLocaleString()}</p>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap justify-end">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                    placeholder="Search name, ID, or phone"
                    className="border bg-gray-50 border-gray-300 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm w-64"
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
      </div>

      <div className="max-w-[1600px] mx-auto px-6 mt-6 space-y-6">
        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-brand-primary" />
                Report Filters
              </h3>
              {(filters.region || filters.branch || filters.officer || filters.search || days !== 30) && (
                <button
                  onClick={clearFilters}
                  className="text-sm font-semibold text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Inactivity Period</label>
                <select
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
                >
                  <option value={30}>30 Days</option>
                  <option value={60}>60 Days</option>
                  <option value={90}>90 Days</option>
                  <option value={180}>180 Days</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Region</label>
                <select
                  value={filters.region}
                  onChange={(e) => handleFilterChange("region", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
                >
                  <option value="">All Regions</option>
                  {regions.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Branch</label>
                <select
                  value={filters.branch}
                  onChange={(e) => handleFilterChange("branch", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
                >
                  <option value="">All Branches</option>
                  {branches
                    .filter(b => !filters.region || regions.find(r => r.name === filters.region)?.id === b.region_id)
                    .map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Loan Officer</label>
                <select
                  value={filters.officer}
                  onChange={(e) => handleFilterChange("officer", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
                >
                  <option value="">All Officers</option>
                  {officers.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-12 h-12 text-accent animate-spin" />
            <p className="text-gray-600 font-medium text-lg italic">Searching for inactive profiles...</p>
          </div>
        ) : errorMsg ? (
          <div className="bg-red-50 border border-red-200 text-red-600 p-6 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-6 h-6" />
            <span className="font-semibold">{errorMsg}</span>
            <button onClick={fetchInactiveCustomers} className="ml-auto underline font-bold">Try Again</button>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-2">
              <UserX className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No Inactive Customers Found</h3>
            <p className="text-gray-500 max-w-md">No customers match your current filter settings for the selected {days}-day inactivity period.</p>
            <button onClick={clearFilters} className="text-accent font-bold hover:underline">Clear all filters</button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#f8faff] border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">No</th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">Customer Name</th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">Joined At</th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">Contact Info</th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">Branch</th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">Relationship Officer</th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">Identity</th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">Last Activity</th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] text-center whitespace-nowrap">Inactivity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentData.map((cust, index) => (
                      <tr key={cust.customer_id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4 font-medium text-gray-400 w-12 whitespace-nowrap">{startIdx + index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-accent/10 rounded-full flex items-center justify-center text-accent font-bold">
                              {cust.customer_name?.[0]}
                            </div>
                            <div className="font-bold text-gray-900 group-hover:text-accent transition-colors">
                              {cust.customer_name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">
                          {new Date(cust.account_created).toLocaleDateString("en-GB")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                            <Phone className="w-3.5 h-3.5 text-blue-400" />
                            <span>{cust.mobile}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-gray-900 font-semibold">
                            <MapPin className="w-3.5 h-3.5 text-red-400" />
                            <span>{cust.branch_name || "Unassigned"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-medium">
                          {cust.loan_officer || "Global"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap leading-none">
                          <div className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded inline-block">
                            ID: {cust.id_number}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-gray-600 font-medium">
                            <Calendar className="w-4 h-4 text-orange-400" />
                            <span>
                              {cust.disbursement_date
                                ? `Last Loan: ${new Date(cust.disbursement_date).toLocaleDateString("en-GB")}`
                                : "No disbursed loans"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${cust.inactive_days > 90 ? 'bg-red-100 text-red-700' :
                              cust.inactive_days > 60 ? 'bg-orange-100 text-orange-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                              {cust.inactive_days} Days
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500 font-medium">
                  Showing <span className="text-gray-900 font-bold">{startIdx + 1}</span> to <span className="text-gray-900 font-bold">{Math.min(endIdx, filteredData.length)}</span> of <span className="text-gray-900 font-bold">{filteredData.length}</span> inactive customers
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className={`p-2 rounded-lg border transition-all ${currentPage === 1
                      ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-accent active:scale-95'
                      }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${currentPage === pageNum
                            ? 'bg-accent text-white shadow-md shadow-accent/20 border-transparent scale-105'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    {totalPages > 5 && <span className="px-2 text-gray-400">...</span>}
                  </div>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className={`p-2 rounded-lg border transition-all ${currentPage === totalPages
                      ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-accent active:scale-95'
                      }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InactiveCustomers;
