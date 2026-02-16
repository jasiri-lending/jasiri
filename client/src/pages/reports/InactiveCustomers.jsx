import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import {
  Loader2,
  Search,
  AlertTriangle,
  Filter,
  Download,
  FileText,
  Clock,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  UserX,
  Phone,
  Calendar,
  MapPin,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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

const SearchBox = React.memo(({ value, onChange }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search name, ID, or phone"
      className="border bg-gray-50 border-gray-300 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm w-64 text-gray-900"
    />
  </div>
));
SearchBox.displayName = "SearchBox";

const Spinner = ({ text }) => (
  <div className="flex flex-col items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    {text && <p className="mt-4 text-gray-600">{text}</p>}
  </div>
);

const InactiveCustomerRow = React.memo(
  ({ customer, index, startIdx, formatDate, inactivityColor }) => {
    const inactiveColorClass =
      customer.inactive_days > 90
        ? "bg-red-100 text-red-700"
        : customer.inactive_days > 60
        ? "bg-orange-100 text-orange-700"
        : "bg-blue-100 text-blue-700";

    return (
      <tr className="hover:bg-gray-50/50 transition-colors group">
        <td className="px-6 py-4 font-medium text-gray-400 w-12 whitespace-nowrap">
          {startIdx + index + 1}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-accent/10 rounded-full flex items-center justify-center text-accent font-bold">
              {customer.customer_name?.[0]}
            </div>
            <div className="font-bold text-gray-900 group-hover:text-accent transition-colors">
              {customer.customer_name}
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">
          {formatDate(customer.account_created)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-gray-700 font-medium">
            <Phone className="w-3.5 h-3.5 text-blue-400" />
            <span>{customer.mobile}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-gray-900 font-semibold">
            <MapPin className="w-3.5 h-3.5 text-red-400" />
            <span>{customer.branch_name || "Unassigned"}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-medium">
          {customer.loan_officer || "Global"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap leading-none">
          <div className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded inline-block">
            ID: {customer.id_number}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2 text-gray-600 font-medium">
            <Calendar className="w-4 h-4 text-orange-400" />
            <span>
              {customer.disbursement_date
                ? `Last Loan: ${formatDate(customer.disbursement_date)}`
                : "No disbursed loans"}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 text-center whitespace-nowrap">
          <div className="flex flex-col items-center">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${inactiveColorClass}`}
            >
              {customer.inactive_days} Days
            </span>
          </div>
        </td>
      </tr>
    );
  }
);
InactiveCustomerRow.displayName = "InactiveCustomerRow";

// ========== Main Component ==========

const InactiveCustomers = () => {
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

  // ========== State ==========
  const [inactiveCustomers, setInactiveCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  // ========== Combined Filters State (persisted) ==========
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("inactive-customers-filters");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          search: parsed.search || "",
          region: parsed.region || "",
          branch: parsed.branch || "",
          officer: parsed.officer || "",
          minInactivityDays: parsed.minInactivityDays || 30,
        };
      }
    } catch (e) {}
    return {
      search: "",
      region: "",
      branch: "",
      officer: "",
      minInactivityDays: 30,
    };
  });

  // ========== Refs ==========
  const abortControllerRef = useRef(null);
  const hasFetchedRef = useRef(false);
  const tenantIdRef = useRef(tenant?.id);
  const lastFetchParamsRef = useRef({ tenantId: null, days: null });

  // ========== Debounced Save Filters ==========
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem("inactive-customers-filters", JSON.stringify(filters));
      } catch (e) {
        console.error("Failed to save filters:", e);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  // ========== Fetch Branches & Regions (ONCE) ==========
  useEffect(() => {
    const tenantId = tenantIdRef.current;
    if (!tenantId || branches.length > 0) return;

    let mounted = true;

    const fetchOptions = async () => {
      try {
        const [branchesRes, regionsRes] = await Promise.all([
          supabase
            .from("branches")
            .select("id, name, region_id")
            .eq("tenant_id", tenantId),
          supabase
            .from("regions")
            .select("id, name")
            .eq("tenant_id", tenantId),
        ]);

        if (mounted) {
          if (!branchesRes.error) setBranches(branchesRes.data || []);
          if (!regionsRes.error) setRegions(regionsRes.data || []);
        }
      } catch (err) {
        console.error("Error fetching filter options:", err);
      }
    };

    fetchOptions();

    return () => {
      mounted = false;
    };
  }, []);

  // ========== Fetch Inactive Customers (Cached, depends on days) ==========
  useEffect(() => {
    const tenantId = tenantIdRef.current;
    if (!tenantId) return;

    const days = filters.minInactivityDays;
    const paramsKey = `${tenantId}-${days}`;

    // Prevent duplicate fetches for same params
    if (
      lastFetchParamsRef.current.tenantId === tenantId &&
      lastFetchParamsRef.current.days === days &&
      !isInitialLoad
    ) {
      return;
    }

    let mounted = true;

    const fetchInactiveCustomers = async () => {
      try {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const cacheKey = `inactive-customers-${tenantId}-${days}`;

        // Try cache first
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            const cacheAge = Date.now() - timestamp;
            if (cacheAge < 5 * 60 * 1000) {
              // 5 minutes cache
              if (mounted) {
                setInactiveCustomers(data.customers || []);
                setOfficers(data.officers || []);
                setIsInitialLoad(false);
                lastFetchParamsRef.current = { tenantId, days };
              }
              return;
            }
          }
        } catch (e) {
          console.error("Cache read error:", e);
        }

        if (mounted) setLoading(true);

        // Call RPC – note: we pass tenant_id if RPC supports it, else filter client-side
        const { data, error } = await supabase.rpc("get_inactive_customers", {
          days,
        });

        if (error) throw error;

        // Client-side tenant filtering (if RPC doesn't filter)
        let scopedData = data || [];
        scopedData = scopedData.filter((c) => c.tenant_id === tenantId);

        if (mounted) {
          setInactiveCustomers(scopedData);

          const uniqueOfficers = [
            ...new Set(scopedData.map((c) => c.loan_officer).filter(Boolean)),
          ];
          setOfficers(uniqueOfficers);

          try {
            localStorage.setItem(
              cacheKey,
              JSON.stringify({
                data: { customers: scopedData, officers: uniqueOfficers },
                timestamp: Date.now(),
              })
            );
          } catch (e) {
            console.error("Cache write error:", e);
          }

          lastFetchParamsRef.current = { tenantId, days };
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error fetching inactive customers:", err);
          if (mounted) {
            setErrorMsg("Failed to load inactive customers. Please try again.");
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setIsInitialLoad(false);
        }
      }
    };

    fetchInactiveCustomers();

    return () => {
      mounted = false;
    };
  }, [filters.minInactivityDays]); // ✅ Only re-fetch when days change

  // ========== Manual Refresh ==========
  const handleManualRefresh = useCallback(() => {
    const tenantId = tenantIdRef.current;
    const days = filters.minInactivityDays;
    if (!tenantId || loading) return;

    // Clear cache for this params
    const cacheKey = `inactive-customers-${tenantId}-${days}`;
    try {
      localStorage.removeItem(cacheKey);
    } catch (e) {
      console.error("Failed to clear cache:", e);
    }

    // Force re-fetch by resetting ref
    lastFetchParamsRef.current = { tenantId: null, days: null };

    // Re-trigger effect by forcing a state change
    setFilters((prev) => ({ ...prev })); // trigger useEffect
  }, [filters.minInactivityDays, loading]);

  // ========== Memoized Filtered Data ==========
  const filteredData = useMemo(() => {
    let result = [...inactiveCustomers];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (c) =>
          (c.customer_name || "").toLowerCase().includes(q) ||
          (c.mobile || "").includes(q) ||
          (c.id_number || "").includes(q)
      );
    }

    if (filters.region) {
      const regionId = regions.find((r) => r.name === filters.region)?.id;
      result = result.filter((c) => {
        const branch = branches.find((b) => b.name === c.branch_name);
        return branch?.region_id === regionId;
      });
    }

    if (filters.branch) {
      result = result.filter((c) => c.branch_name === filters.branch);
    }

    if (filters.officer) {
      result = result.filter((c) => c.loan_officer === filters.officer);
    }

    return result;
  }, [inactiveCustomers, filters, regions, branches]);

  // ========== Pagination ==========
  const pagination = useMemo(() => {
    const totalRows = filteredData.length;
    const totalPages = Math.ceil(totalRows / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, totalRows);
    const currentData = filteredData.slice(startIdx, endIdx);
    return { totalRows, totalPages, startIdx, endIdx, currentData };
  }, [filteredData, currentPage]);

  // ========== Dropdown Options ==========
  const branchOptions = useMemo(() => {
    if (!filters.region) return branches;
    const regionId = regions.find((r) => r.name === filters.region)?.id;
    return branches.filter((b) => b.region_id === regionId);
  }, [branches, regions, filters.region]);

  const officerOptions = useMemo(() => {
    let result = officers;
    if (filters.branch) {
      result = officers.filter((o) =>
        filteredData.some(
          (c) => c.branch_name === filters.branch && c.loan_officer === o
        )
      );
    } else if (filters.region) {
      const branchNames = branchOptions.map((b) => b.name);
      result = officers.filter((o) =>
        filteredData.some(
          (c) => branchNames.includes(c.branch_name) && c.loan_officer === o
        )
      );
    }
    return result;
  }, [officers, filters.branch, filters.region, branchOptions, filteredData]);

  // ========== Handlers ==========
  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      if (key === "region") {
        newFilters.branch = "";
        newFilters.officer = "";
      }
      if (key === "branch") {
        newFilters.officer = "";
      }
      return newFilters;
    });
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      region: "",
      branch: "",
      officer: "",
      minInactivityDays: 30,
    });
    setCurrentPage(1);
  }, []);

  // ========== Formatting Helpers ==========
  const formatDate = useCallback((dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-GB");
  }, []);

  const getCurrentTimestamp = useCallback(() => {
    const now = new Date();
    return now.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
  }, []);

  // ========== Export Functions ==========
  const exportToCSV = useCallback(() => {
    const headers = [
      "Customer Name",
      "Mobile",
      "ID Number",
      "Branch",
      "Loan Officer",
      "Disbursement Date",
      "Account Created",
      "Inactive Days",
    ].join(",");

    const rows = filteredData.map(
      (c) =>
        [
          `"${c.customer_name}"`,
          c.mobile,
          c.id_number,
          c.branch_name || "N/A",
          c.loan_officer || "N/A",
          c.disbursement_date ? formatDate(c.disbursement_date) : "N/A",
          formatDate(c.account_created),
          c.inactive_days,
        ].join(",")
    );

    const csvContent = "\ufeff" + [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(
      blob,
      `${tenant?.company_name || "Jasiri"}_inactive_customers_${
        new Date().toISOString().split("T")[0]
      }.csv`
    );
  }, [filteredData, tenant, formatDate]);

  const exportToExcel = useCallback(() => {
    const worksheetData = filteredData.map((c) => ({
      "Customer Name": c.customer_name,
      Mobile: c.mobile,
      "ID Number": c.id_number,
      Branch: c.branch_name || "N/A",
      "Loan Officer": c.loan_officer || "N/A",
      "Disbursement Date": c.disbursement_date ? formatDate(c.disbursement_date) : "N/A",
      "Account Created": formatDate(c.account_created),
      "Inactive Days": c.inactive_days,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inactive Customers");
    XLSX.writeFile(
      workbook,
      `${tenant?.company_name || "Jasiri"}_inactive_customers_${
        new Date().toISOString().split("T")[0]
      }.xlsx`
    );
  }, [filteredData, tenant, formatDate]);

  const exportToPDF = useCallback(() => {
    const doc = new jsPDF({ orientation: "landscape", format: "a4", unit: "pt" });
    const companyName = tenant?.company_name || "Jasiri";

    const tableColumn = [
      "No",
      "Customer Name",
      "Mobile",
      "ID Number",
      "Branch",
      "Loan Officer",
      "Inactive Days",
    ];

    const tableRows = filteredData.map((c, i) => [
      i + 1,
      c.customer_name,
      c.mobile,
      c.id_number,
      c.branch_name || "N/A",
      c.loan_officer || "N/A",
      `${c.inactive_days} days`,
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
          `Generated: ${getCurrentTimestamp()} | Total: ${filteredData.length}`,
          data.settings.margin.left,
          80
        );
      },
      startY: 100,
      margin: { top: 100, left: 20, right: 20 },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [88, 106, 177], textColor: [255, 255, 255] },
    });

    doc.save(
      `${companyName.toLowerCase().replace(/ /g, "_")}_inactive_customers_${
        new Date().toISOString().split("T")[0]
      }.pdf`
    );
  }, [filteredData, tenant, getCurrentTimestamp]);

  const exportToWord = useCallback(async () => {
    const table = new DocxTable({
      rows: [
        new DocxTableRow({
          children: [
            "Customer Name",
            "Mobile",
            "Branch",
            "Loan Officer",
            "Inactive Days",
          ].map(
            (h) =>
              new DocxTableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: h, bold: true })],
                  }),
                ],
              })
          ),
        }),
        ...filteredData.map(
          (c) =>
            new DocxTableRow({
              children: [
                c.customer_name,
                c.mobile,
                c.branch_name || "N/A",
                c.loan_officer || "N/A",
                `${c.inactive_days} days`,
              ].map((v) => new DocxTableCell({ children: [new Paragraph(v)] })),
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
              children: [
                new TextRun({ text: "Inactive Customers Report", size: 24 }),
              ],
            }),
            new Paragraph({ text: `Generated on: ${getCurrentTimestamp()}` }),
            new Paragraph({ text: "" }),
            table,
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(
      blob,
      `${tenant?.company_name || "Jasiri"}_inactive_customers_${
        new Date().toISOString().split("T")[0]
      }.docx`
    );
  }, [filteredData, tenant, getCurrentTimestamp]);

  const handleExport = useCallback(() => {
    if (filteredData.length === 0) {
      alert("No data to export");
      return;
    }

    switch (exportFormat) {
      case "csv":
        exportToCSV();
        break;
      case "excel":
        exportToExcel();
        break;
      case "pdf":
        exportToPDF();
        break;
      case "word":
        exportToWord();
        break;
      default:
        exportToCSV();
    }
  }, [exportFormat, filteredData, exportToCSV, exportToExcel, exportToPDF, exportToWord]);

  // ========== Options ==========
  const inactivityPeriodOptions = [
    { value: 30, label: "30 Days" },
    { value: 60, label: "60 Days" },
    { value: 90, label: "90 Days" },
    { value: 180, label: "180 Days" },
  ];

  const exportFormatOptions = [
    { value: "csv", label: "CSV" },
    { value: "excel", label: "Excel" },
    { value: "word", label: "Word" },
    { value: "pdf", label: "PDF" },
  ];

  if (loading && isInitialLoad) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <Spinner text="Loading Inactive Customers Report..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface pb-12">
      {/* HEADER SECTION */}
      <div className="bg-brand-secondary border-b border-gray-200 shadow-sm relative z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {tenant?.logo_url ? (
                <div className="w-14 h-14 bg-white p-2 rounded-xl shadow-md border border-gray-100 flex items-center justify-center overflow-hidden transition-transform hover:rotate-3">
                  <img
                    src={tenant.logo_url}
                    alt="Logo"
                    className="max-w-full max-h-full object-contain"
                  />
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
                  <p className="text-sm font-bold text-white">
                    Inactive Customers Report
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-blue-100 font-medium bg-white/10 px-2 py-0.5 rounded-md border border-white/20">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      Period:{" "}
                      <span className="text-white font-bold">
                        {filters.minInactivityDays} Days
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="text-[10px] text-blue-100 uppercase tracking-wider font-bold text-right opacity-80">
                <p>Generated on:</p>
                <p className="text-sm font-bold text-white tracking-tight">
                  {getCurrentTimestamp()}
                </p>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap justify-end">
                <SearchBox
                  value={filters.search}
                  onChange={(val) => handleFilterChange("search", val)}
                />
                <button
                  onClick={handleManualRefresh}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border text-gray-600 border-gray-200 hover:bg-brand-secondary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border
                    ${
                      showFilters
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
                    {exportFormatOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
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
              {(filters.region ||
                filters.branch ||
                filters.officer ||
                filters.search ||
                filters.minInactivityDays !== 30) && (
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
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                  Inactivity Period
                </label>
                <select
                  value={filters.minInactivityDays}
                  onChange={(e) =>
                    handleFilterChange("minInactivityDays", parseInt(e.target.value))
                  }
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
                >
                  {inactivityPeriodOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                  Region
                </label>
                <select
                  value={filters.region}
                  onChange={(e) => handleFilterChange("region", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
                >
                  <option value="">All Regions</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                  Branch
                </label>
                <select
                  value={filters.branch}
                  onChange={(e) => handleFilterChange("branch", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
                >
                  <option value="">All Branches</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                  Loan Officer
                </label>
                <select
                  value={filters.officer}
                  onChange={(e) => handleFilterChange("officer", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
                >
                  <option value="">All Officers</option>
                  {officerOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-12 h-12 text-accent animate-spin" />
            <p className="text-gray-600 font-medium text-lg italic">
              Searching for inactive profiles...
            </p>
          </div>
        ) : errorMsg ? (
          <div className="bg-red-50 border border-red-200 text-red-600 p-6 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-6 h-6" />
            <span className="font-semibold">{errorMsg}</span>
            <button
              onClick={handleManualRefresh}
              className="ml-auto underline font-bold"
            >
              Try Again
            </button>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-2">
              <UserX className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              No Inactive Customers Found
            </h3>
            <p className="text-gray-500 max-w-md">
              No customers match your current filter settings for the selected{" "}
              {filters.minInactivityDays}-day inactivity period.
            </p>
            <button
              onClick={clearFilters}
              className="text-accent font-bold hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#f8faff] border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">
                        No
                      </th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">
                        Customer Name
                      </th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">
                        Joined At
                      </th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">
                        Contact Info
                      </th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">
                        Branch
                      </th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">
                        Relationship Officer
                      </th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">
                        Identity
                      </th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] whitespace-nowrap">
                        Last Activity
                      </th>
                      <th className="px-6 py-4 font-bold text-[#586ab1] uppercase tracking-wider text-[11px] text-center whitespace-nowrap">
                        Inactivity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagination.currentData.map((cust, index) => (
                      <InactiveCustomerRow
                        key={cust.customer_id}
                        customer={cust}
                        index={index}
                        startIdx={pagination.startIdx}
                        formatDate={formatDate}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-sm text-gray-500 font-medium">
                    Showing{" "}
                    <span className="text-gray-900 font-bold">
                      {pagination.startIdx + 1}
                    </span>{" "}
                    to{" "}
                    <span className="text-gray-900 font-bold">
                      {Math.min(pagination.endIdx, pagination.totalRows)}
                    </span>{" "}
                    of{" "}
                    <span className="text-gray-900 font-bold">
                      {pagination.totalRows}
                    </span>{" "}
                    inactive customers
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                      className={`p-2 rounded-lg border transition-all ${
                        currentPage === 1
                          ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-accent active:scale-95"
                      }`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }).map(
                        (_, i) => {
                          let pageNum;
                          if (pagination.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= pagination.totalPages - 2) {
                            pageNum = pagination.totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${
                                currentPage === pageNum
                                  ? "bg-accent text-white shadow-md shadow-accent/20 border-transparent scale-105"
                                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        }
                      )}
                    </div>
                    <button
                      disabled={currentPage === pagination.totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      className={`p-2 rounded-lg border transition-all ${
                        currentPage === pagination.totalPages
                          ? "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-accent active:scale-95"
                      }`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InactiveCustomers;