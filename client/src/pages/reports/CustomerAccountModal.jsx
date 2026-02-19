import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Search,
  RefreshCw,
  Eye,
  Lock
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
import { usePermissions } from "../../hooks/usePermissions";
import Spinner from "../../components/Spinner";

// ========== Memoized Helper Components ==========

const SearchBox = React.memo(({ value, onChange }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search customer or phone..."
      className="border bg-gray-50 border-gray-300 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm w-64"
    />
  </div>
));
SearchBox.displayName = "SearchBox";

const SortableHeader = React.memo(({ label, sortKey, sortConfig, onSort, align = "left" }) => (
  <th
    onClick={() => onSort(sortKey)}
    className={`px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors whitespace-nowrap text-${align}`}
  >
    <div className={`flex items-center gap-2 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {label}
      {sortConfig.key === sortKey &&
        (sortConfig.direction === "asc" ? (
          <ChevronUp className="w-4 h-4 text-brand-primary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-brand-primary" />
        ))}
    </div>
  </th>
));
SortableHeader.displayName = "SortableHeader";

// ========== Main Component ==========

const CustomerAccountModal = () => {
  const navigate = useNavigate();

  // Get tenant from localStorage ONCE
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
  const [rawAccounts, setRawAccounts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("customer-account-filters");
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...parsed, search: "" };
      }
    } catch (e) { }
    return {
      branch: "",
      status: "",
      startDate: "",
      endDate: "",
      search: "",
    };
  });

  const { hasPermission } = usePermissions();
  const itemsPerPage = 10;
  const hasFetchedRef = useRef(false);

  // Save filters to localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        const { search, ...filtersToSave } = filters;
        localStorage.setItem("customer-account-filters", JSON.stringify(filtersToSave));
      } catch (e) {
        console.error("Failed to save filters:", e);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  // Fetch branches
  useEffect(() => {
    const tenantId = tenant?.id;
    if (!tenantId) return;

    const fetchBranches = async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .eq("tenant_id", tenantId);

      if (!error) setBranches(data || []);
    };
    fetchBranches();
  }, [tenant?.id]);

  // Fetch Customer Account Data
  useEffect(() => {
    let mounted = true;
    const tenantId = tenant?.id;

    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn("⚠️ Safety timeout – forcing loading false");
        setLoading(false);
      }
    }, 15000);

    if (!tenantId) {
      if (mounted) setLoading(false);
      clearTimeout(safetyTimeout);
      return;
    }

    if (hasFetchedRef.current && rawAccounts.length > 0) {
      if (mounted) setLoading(false);
      clearTimeout(safetyTimeout);
      return;
    }

    hasFetchedRef.current = true;

    const fetchCustomerAccounts = async () => {
      try {
        if (mounted) setLoading(true);

        const { data: loans, error } = await supabase
          .from("loans")
          .select(`
            id,
            scored_amount,
            total_interest,
            total_payable,
            status,
            disbursed_date,
            created_at,
            customer:customer_id(
              id,
              "Firstname",
              "Middlename",
              "Surname",
              mobile,
              branch:branch_id(name)
            ),
            installments:loan_installments(
              paid_amount
            )
          `)
          .eq("tenant_id", tenantId);

        if (error) throw error;

        if (mounted) {
          const customerSummary = {};

          loans.forEach((loan) => {
            const cust = loan.customer || {};
            const custId = cust.id;
            // Skip updates if customer data is missing (e.g. deleted customer)
            if (!custId) return;

            const fullName = [cust.Firstname, cust.Middlename, cust.Surname]
              .filter(Boolean)
              .join(" ");

            const totalPaid = loan.installments?.reduce(
              (sum, i) => sum + (i.paid_amount || 0),
              0
            );

            const outstanding =
              (loan.total_payable || 0) - totalPaid > 0
                ? (loan.total_payable || 0) - totalPaid
                : 0;

            if (!customerSummary[custId]) {
              customerSummary[custId] = {
                customerId: custId,
                customerName: fullName || "N/A",
                phone: cust.mobile || "N/A",
                branch: cust.branch?.name || "N/A",
                totalLoanApplied: 0,
                loanAmount: 0, // Principal
                interest: 0,
                totalPayable: 0,
                totalPaid: 0,
                outstanding: 0,
                latestDisbursed: loan.disbursed_date || loan.created_at,
                status: "Active", // Default, effectively calculated below
              };
            }

            const custRec = customerSummary[custId];
            custRec.totalLoanApplied += loan.scored_amount || 0;
            custRec.loanAmount += loan.scored_amount || 0;
            custRec.interest += loan.total_interest || 0;
            custRec.totalPayable += loan.total_payable || 0;
            custRec.totalPaid += totalPaid;
            custRec.outstanding += outstanding;

            // Update latest disbursed date if newer
            const loanDate = new Date(loan.disbursed_date || loan.created_at);
            const currentDate = new Date(custRec.latestDisbursed);
            if (loanDate > currentDate) {
              custRec.latestDisbursed = loan.disbursed_date || loan.created_at;
            }
          });

          const formatted = Object.values(customerSummary).map((c) => ({
            ...c,
            status: c.outstanding <= 1 ? "Closed" : "Active", // Tolerance for float errors
          }));

          setRawAccounts(formatted);
        }
      } catch (err) {
        if (mounted) console.error("Error fetching customer accounts:", err.message);
      } finally {
        if (mounted) setLoading(false);
        clearTimeout(safetyTimeout);
      }
    };

    fetchCustomerAccounts();

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [tenant?.id]);

  // ========== Filtering and Sorting ==========
  const filteredData = useMemo(() => {
    let result = [...rawAccounts];
    const query = (filters.search || "").toLowerCase().trim();

    // 1. Search
    if (query) {
      result = result.filter(
        (item) =>
          item.customerName.toLowerCase().includes(query) ||
          item.phone.includes(query)
      );
    }

    // 2. Branch
    if (filters.branch) {
      result = result.filter((item) => item.branch === filters.branch);
    }

    // 3. Status
    if (filters.status) {
      result = result.filter((item) => item.status.toLowerCase() === filters.status.toLowerCase());
    }

    // 4. Date Range (based on latest disbursed)
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999); // End of day

      result = result.filter((item) => {
        if (!item.latestDisbursed) return false;
        const d = new Date(item.latestDisbursed);
        return d >= start && d <= end;
      });
    }

    return result;
  }, [rawAccounts, filters]);

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

  // ========== Formatting Helpers ==========
  const formatCurrency = (num) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);

  // ========== Handlers ==========
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleSearchChange = (val) => {
    setFilters((prev) => ({ ...prev, search: val }));
    setCurrentPage(1);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      branch: "",
      status: "",
      startDate: "",
      endDate: "",
      search: "",
    });
    setCurrentPage(1);
  };

  const handleViewStatement = useCallback((customer) => {
    navigate(`/reports/customer-statement/${customer.customerId}`);
  }, [navigate]);

  // ========== Export Functions ==========
  const exportToPDF = () => {
    const doc = new jsPDF("l", "pt", "a4");
    const companyName = tenant?.company_name || "Jasiri";
    const reportTitle = "Customer Account Statement Summary";

    autoTable(doc, {
      head: [
        [
          "Customer Name",
          "Phone",
          "Branch",
          "Principal",
          "Interest",
          "Total Payable",
          "Paid",
          "Outstanding",
          "Status"
        ],
      ],
      body: sortedData.map((c) => [
        c.customerName,
        c.phone,
        c.branch,
        formatCurrency(c.loanAmount),
        formatCurrency(c.interest),
        formatCurrency(c.totalPayable),
        formatCurrency(c.totalPaid),
        formatCurrency(c.outstanding),
        c.status,
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
      headStyles: { fillColor: [88, 106, 177], textColor: [255, 255, 255] }, // Matches standard #586ab1
    });

    doc.save(
      `${companyName.toLowerCase()}_account_statements_${new Date().toISOString().split("T")[0]}.pdf`
    );
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      sortedData.map((c) => ({
        "Customer Name": c.customerName,
        Phone: c.phone,
        Branch: c.branch,
        Principal: c.loanAmount,
        Interest: c.interest,
        "Total Payable": c.totalPayable,
        "Total Paid": c.totalPaid,
        Outstanding: c.outstanding,
        Status: c.status,
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Account Statements");
    XLSX.writeFile(
      workbook,
      `${tenant?.company_name || "Jasiri"}_account_statements_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const exportToWord = async () => {
    const table = new Table({
      rows: [
        new TableRow({
          children: ["Customer", "Phone", "Branch", "Payable", "Paid", "Balance", "Status"].map(
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
        ...sortedData.map((c) =>
          new TableRow({
            children: [
              c.customerName,
              c.phone,
              c.branch,
              formatCurrency(c.totalPayable),
              formatCurrency(c.totalPaid),
              formatCurrency(c.outstanding),
              c.status
            ].map(
              (v) => new TableCell({ children: [new Paragraph(v)] })
            ),
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
              children: [new TextRun({ text: "Customer Account Statements", size: 24 })],
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
      `${tenant?.company_name || "Jasiri"}_account_statements_${new Date().toISOString().split("T")[0]}.docx`
    );
  };

  const exportToCSV = () => {
    const headers = [
      "Customer Name",
      "Phone",
      "Branch",
      "Principal",
      "Interest",
      "Total Payable",
      "Total Paid",
      "Outstanding",
      "Status",
    ].join(",");

    const rows = sortedData.map((c) =>
      [
        `"${c.customerName}"`,
        c.phone,
        c.branch,
        c.loanAmount,
        c.interest,
        c.totalPayable,
        c.totalPaid,
        c.outstanding,
        c.status,
      ].join(",")
    );

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(
      blob,
      `${tenant?.company_name || "Jasiri"}_account_statements_${new Date().toISOString().split("T")[0]}.csv`
    );
  };

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


  // ========== Pagination ==========
  const { totalRows, totalPages, currentData } = useMemo(() => {
    const total = sortedData.length;
    const pages = Math.ceil(total / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const data = sortedData.slice(start, start + itemsPerPage);
    return { totalRows: total, totalPages: pages, currentData: data };
  }, [sortedData, currentPage]);


  // ========== Render ==========
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <Spinner text="Loading account statements..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header Section */}
      <div className="bg-brand-secondary rounded-xl shadow-md border border-gray-200 p-4 overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-sm font-bold text-stone-600 uppercase">{tenant?.company_name || "Company Name"}</h1>
                <h2 className="text-lg font-semibold text-white mt-1">Customer Account Statements</h2>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2 mt-2 flex-wrap justify-end">
                <SearchBox value={filters.search} onChange={handleSearchChange} />

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

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-brand-primary" />
                Report Filters
              </h3>
              <button
                onClick={clearFilters}
                className="text-sm font-semibold text-red-500 hover:text-red-600 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reset All Filters
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                  Branch
                </label>
                <select
                  value={filters.branch}
                  onChange={(e) => handleFilterChange("branch", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          {filteredData.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No records found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 text-sm">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap text-left">#</th>
                      <SortableHeader label="Customer Details" sortKey="customerName" sortConfig={sortConfig} onSort={handleSort} />
                      <SortableHeader label="Phone" sortKey="phone" sortConfig={sortConfig} onSort={handleSort} />
                      <SortableHeader label="Branch" sortKey="branch" sortConfig={sortConfig} onSort={handleSort} />
                      <SortableHeader label="Principal" sortKey="loanAmount" sortConfig={sortConfig} onSort={handleSort} align="right" />
                      <SortableHeader label="Interest" sortKey="interest" sortConfig={sortConfig} onSort={handleSort} align="right" />
                      <SortableHeader label="Payable" sortKey="totalPayable" sortConfig={sortConfig} onSort={handleSort} align="right" />
                      <SortableHeader label="Paid" sortKey="totalPaid" sortConfig={sortConfig} onSort={handleSort} align="right" />
                      <SortableHeader label="Outstanding" sortKey="outstanding" sortConfig={sortConfig} onSort={handleSort} align="right" />
                      <SortableHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} align="center" />
                      <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentData.map((c, i) => {
                      const rowIndex = (currentPage - 1) * itemsPerPage + i + 1;
                      return (
                        <tr key={c.customerId || i} className="hover:bg-gray-50 transition-colors text-sm">
                          <td className="px-4 py-3 text-gray-400 font-medium whitespace-nowrap">{rowIndex}</td>
                          <td className="px-4 py-3 text-brand-primary font-bold whitespace-nowrap">{c.customerName}</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{c.phone}</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{c.branch}</td>

                          <td className="px-4 py-3 text-right text-gray-900 font-medium whitespace-nowrap">
                            {formatCurrency(c.loanAmount)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900 font-medium whitespace-nowrap">
                            {formatCurrency(c.interest)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900 font-medium whitespace-nowrap">
                            {formatCurrency(c.totalPayable)}
                          </td>
                          <td className="px-4 py-3 text-right text-green-700 font-semibold whitespace-nowrap">
                            {formatCurrency(c.totalPaid)}
                          </td>
                          <td className="px-4 py-3 text-right text-red-700 font-semibold whitespace-nowrap">
                            {formatCurrency(c.outstanding)}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${c.status === "Active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                              }`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleViewStatement(c)}
                              className="flex items-center gap-1 px-3 py-1 text-white text-xs font-medium rounded-lg transition-all duration-300 hover:shadow-md bg-brand-primary/90 hover:bg-brand-primary"
                              style={{ backgroundColor: "#586ab1" }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Statement
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="font-semibold">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of{' '}
                  <span className="font-semibold">{filteredData.length}</span> records
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-colors ${currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                      }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>

                  <div className="flex items-center gap-2">
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
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
                          className={`px-3 py-2 rounded-lg transition-colors ${currentPage === pageNum
                            ? 'bg-brand-primary text-white font-semibold'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                            }`}
                          style={currentPage === pageNum ? { backgroundColor: "#586ab1" } : {}}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-colors ${currentPage === totalPages
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                      }`}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerAccountModal;