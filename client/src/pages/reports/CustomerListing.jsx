import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Search,
  RefreshCw,
  Users,
  UserCheck,
  UserPlus,
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
import Spinner from "../../components/Spinner";

// ========== Memoized Helper Components ==========

const CustomerTableRow = React.memo(({ customer, index, currentPage, itemsPerPage }) => {
  const statusClass =
    customer.approvalStatus.toLowerCase() === "approved"
      ? "bg-green-100 text-green-700"
      : customer.approvalStatus.toLowerCase() === "pending"
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";

  return (
    <tr key={customer.id} className="hover:bg-gray-50/50 transition-colors">
      <td className="px-6 py-4 font-medium text-gray-400 whitespace-nowrap">
        {(currentPage - 1) * itemsPerPage + index + 1}
      </td>
      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
        {customer.branch}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">{customer.relationshipOfficer}</td>
      <td className="px-4 py-3 font-bold text-brand-primary whitespace-nowrap">
        {customer.customerName}
      </td>
      <td className="px-4 py-3 font-medium whitespace-nowrap">{customer.mobile}</td>
      <td className="px-4 py-3 whitespace-nowrap">{customer.idNumber}</td>
      <td className="px-4 py-3 whitespace-nowrap">{customer.gender}</td>
      <td className="px-4 py-3 whitespace-nowrap">{customer.dateOfBirth}</td>
      <td className="px-4 py-3 text-center whitespace-nowrap">{customer.age}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span
          className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusClass}`}
        >
          {customer.approvalStatus}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">{customer.residenceType}</td>
      <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">
        {customer.businessName}
      </td>
      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
        {customer.businessDescription}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">{customer.createdAt}</td>
    </tr>
  );
});
CustomerTableRow.displayName = "CustomerTableRow";

const SearchBox = React.memo(({ value, onChange }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search name, ID, or phone"
      className="border bg-gray-50 border-gray-300 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm w-64"
    />
  </div>
));
SearchBox.displayName = "SearchBox";

const SortableHeader = React.memo(({ label, sortKey, sortConfig, onSort }) => (
  <th
    onClick={() => onSort(sortKey)}
    className="px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors whitespace-nowrap text-left"
  >
    <div className="flex items-center gap-2">
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

const CustomerListing = () => {
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
  const [rawCustomers, setRawCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true); // Single loading state
  const [showFilters, setShowFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("customer-listing-filters");
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...parsed, search: "" }; // Don't persist search
      }
    } catch (e) { }
    return {
      region: "",
      branch: "",
      status: "",
      officer: "",
      startDate: "",
      endDate: "",
      search: "",
    };
  });

  // ========== Refs ==========
  const hasFetchedRef = useRef(false);
  const tenantIdRef = useRef(tenant?.id);
  const itemsPerPage = 10;

  // Update tenantIdRef when tenant changes (if tenant loads asynchronously)
  useEffect(() => {
    tenantIdRef.current = tenant?.id;
  }, [tenant]);

  // Save filters to localStorage (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        const { search, ...filtersToSave } = filters;
        localStorage.setItem("customer-listing-filters", JSON.stringify(filtersToSave));
      } catch (e) {
        console.error("Failed to save filters:", e);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  // Fetch branches and regions
  useEffect(() => {
    const tenantId = tenant?.id;
    if (!tenantId) return;

    let mounted = true;

    const fetchBranchesAndRegions = async () => {
      try {
        const [branchesRes, regionsRes] = await Promise.all([
          supabase.from("branches").select("id, name, region_id").eq("tenant_id", tenantId),
          supabase.from("regions").select("id, name").eq("tenant_id", tenantId),
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

    return () => {
      mounted = false;
    };
  }, [tenant?.id]);

  // ========== Fetch customers (with safety timeout) ==========
  useEffect(() => {
    let mounted = true;
    const tenantId = tenant?.id;

    // Safety timeout: if fetch hangs, force loading false after 15 seconds
    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn("⚠️ Safety timeout – forcing loading false");
        setLoading(false);
      }
    }, 15000);

    // No tenant – cannot fetch
    if (!tenantId) {
      if (mounted) setLoading(false);
      clearTimeout(safetyTimeout);
      return;
    }

    // Already fetched – skip if data already exists to avoid extra calls on re-mount if state is persisted elsewhere (though here it's local state)
    // However, since we depend on tenant?.id, it will only rerun if tenant changes.
    if (hasFetchedRef.current && rawCustomers.length > 0) {
      if (mounted) setLoading(false);
      clearTimeout(safetyTimeout);
      return;
    }

    hasFetchedRef.current = true;

    const fetchCustomers = async () => {
      try {
        const cacheKey = `customer-listing-raw-data-${tenantId}`;

        // Try cache first
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            const cacheAge = Date.now() - timestamp;
            if (cacheAge < 4 * 60 * 60 * 1000) {
              if (mounted) {
                setRawCustomers(data || []);
                setLoading(false);
              }
              clearTimeout(safetyTimeout);
              return;
            }
          }
        } catch (e) {
          console.error("Cache read error:", e);
        }

        // No cache or expired – fetch from DB
        if (mounted) setLoading(true);

        const { data, error } = await supabase
          .from("customers")
          .select(
            `
            id,
            "Firstname",
            "Middlename",
            "Surname",
            gender,
            date_of_birth,
            mobile,
            id_number,
            residence_status,
            business_name,
            business_type,
            status,
            created_at,
            branch_id,
            branch:branch_id(name, region_id),
            ro:created_by(full_name)
          `
          )
          .eq("form_status", "submitted")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!mounted) return;

        setRawCustomers(data || []);

        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              data: data || [],
              timestamp: Date.now(),
            })
          );
        } catch (e) {
          console.error("Cache write error:", e);
        }
      } catch (err) {
        if (mounted) {
          console.error("Error fetching customers:", err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
        clearTimeout(safetyTimeout);
      }
    };

    fetchCustomers();

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [tenant?.id]); // depend on tenant?.id

  // ========== Filtering and Sorting ==========
  const filteredData = useMemo(() => {
    const regionMap = regions.reduce((acc, r) => {
      acc[r.id] = r.name;
      return acc;
    }, {});

    const query = (filters.search || "").toLowerCase().trim();

    return rawCustomers
      .map((customer) => {
        const branchName = customer.branch?.name || "N/A";
        const regionId = customer.branch?.region_id;
        const regionName = regionId ? regionMap[regionId] || "N/A" : "N/A";
        const fullName = [customer.Firstname, customer.Middlename, customer.Surname]
          .filter(Boolean)
          .join(" ");
        const age = customer.date_of_birth
          ? new Date().getFullYear() - new Date(customer.date_of_birth).getFullYear()
          : "N/A";

        const row = {
          id: customer.id,
          branch: branchName,
          region: regionName,
          relationshipOfficer: customer.ro?.full_name || "N/A",
          customerName: fullName || "N/A",
          mobile: customer.mobile || "N/A",
          idNumber: customer.id_number || "N/A",
          gender: customer.gender || "N/A",
          dateOfBirth: customer.date_of_birth || "N/A",
          age,
          approvalStatus: customer.status || "N/A",
          residenceType: customer.residence_status || "N/A",
          businessName: customer.business_name || "N/A",
          businessDescription: customer.business_type || "N/A",
          createdAt: customer.created_at
            ? new Date(customer.created_at).toLocaleDateString()
            : "N/A",
          rawCreatedAt: customer.created_at,
        };

        // Apply filters
        const { officer, branch, region, status, startDate, endDate } = filters;

        if (officer && row.relationshipOfficer !== officer) return null;
        if (branch && row.branch !== branch) return null;
        if (region && row.region !== region) return null;
        if (status && row.approvalStatus.toLowerCase() !== status.toLowerCase()) return null;

        if (startDate && new Date(row.rawCreatedAt || row.createdAt) < new Date(startDate)) return null;
        if (endDate && new Date(row.rawCreatedAt || row.createdAt) > new Date(endDate)) return null;

        if (query) {
          const customerNameMatch = String(row.customerName || "").toLowerCase().includes(query);
          const mobileMatch = String(row.mobile || "").includes(query);
          const idNumberMatch = String(row.idNumber || "").includes(query);
          if (!customerNameMatch && !mobileMatch && !idNumberMatch) return null;
        }

        return row;
      })
      .filter(Boolean);
  }, [rawCustomers, regions, filters]);

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

  const officers = useMemo(
    () => [...new Set(sortedData.map((c) => c.relationshipOfficer))],
    [sortedData]
  );

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
      region: "",
      branch: "",
      status: "",
      officer: "",
      startDate: "",
      endDate: "",
      search: "",
    });
    setCurrentPage(1);
  };

  // ========== Export Functions ==========
  const exportToPDF = () => {
    const doc = new jsPDF("l", "pt", "a4");
    const companyName = tenant?.company_name || "Jasiri";
    const reportTitle = "Customer Listing Report";

    autoTable(doc, {
      head: [
        [
          "Branch",
          "Region",
          "RO",
          "Customer Name",
          "Mobile",
          "ID Number",
          "Gender",
          "DOB",
          "Status",
          "Created At",
        ],
      ],
      body: sortedData.map((c) => [
        c.branch,
        c.region,
        c.relationshipOfficer,
        c.customerName,
        c.mobile,
        c.idNumber,
        c.gender,
        c.dateOfBirth,
        c.approvalStatus,
        c.createdAt,
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
      headStyles: { fillColor: [46, 94, 153], textColor: [255, 255, 255] },
    });

    doc.save(
      `${companyName.toLowerCase()}_customers_${new Date().toISOString().split("T")[0]}.pdf`
    );
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      sortedData.map((c) => ({
        Branch: c.branch,
        Region: c.region,
        "Relationship Officer": c.relationshipOfficer,
        "Customer Name": c.customerName,
        Mobile: c.mobile,
        "ID Number": c.idNumber,
        Gender: c.gender,
        DOB: c.dateOfBirth,
        Age: c.age,
        Status: c.approvalStatus,
        Residence: c.residenceType,
        "Business Name": c.businessName,
        "Business Type": c.businessDescription,
        "Created At": c.createdAt,
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    XLSX.writeFile(
      workbook,
      `${tenant?.company_name || "Jasiri"}_customers_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const exportToWord = async () => {
    const table = new Table({
      rows: [
        new TableRow({
          children: ["Branch", "Region", "Customer", "Mobile", "Status", "Date"].map(
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
            children: [c.branch, c.region, c.customerName, c.mobile, c.approvalStatus, c.createdAt].map(
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
              children: [new TextRun({ text: "Customer Listing Report", size: 24 })],
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
      `${tenant?.company_name || "Jasiri"}_customers_${new Date().toISOString().split("T")[0]}.docx`
    );
  };

  const exportToCSV = () => {
    const headers = [
      "Branch",
      "Region",
      "RO",
      "Name",
      "Mobile",
      "ID",
      "Gender",
      "DOB",
      "Status",
      "Created",
    ].join(",");

    const rows = sortedData.map((c) =>
      [
        c.branch,
        c.region,
        c.relationshipOfficer,
        `"${c.customerName}"`,
        c.mobile,
        c.idNumber,
        c.gender,
        c.dateOfBirth,
        c.approvalStatus,
        c.createdAt,
      ].join(",")
    );

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(
      blob,
      `${tenant?.company_name || "Jasiri"}_customers_${new Date().toISOString().split("T")[0]}.csv`
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

  // ========== Summary Metrics ==========
  const summary = useMemo(() => {
    const total = sortedData.length;
    const active = sortedData.filter((c) => c.approvalStatus.toLowerCase() === "approved").length;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = sortedData.filter((c) => new Date(c.rawCreatedAt) >= startOfMonth).length;
    return { total, active, newThisMonth };
  }, [sortedData]);

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
        <Spinner text="Loading Customer Listing..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-brand-secondary rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">

              <div>
                <h1 className="text-sm font-bold text-stone-600 uppercase">{tenant?.company_name || "Company Name"}</h1>
                <h2 className="text-lg font-semibold text-white mt-1">Customer Listing Report</h2>
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

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                  Region
                </label>
                <select
                  value={filters.region}
                  onChange={(e) => handleFilterChange("region", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
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
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                >
                  <option value="">All Branches</option>
                  {branches
                    .filter(
                      (b) =>
                        !filters.region ||
                        regions.find((r) => r.name === filters.region)?.id === b.region_id
                    )
                    .map((b) => (
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
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                  RO
                </label>
                <select
                  value={filters.officer}
                  onChange={(e) => handleFilterChange("officer", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                >
                  <option value="">All Officers</option>
                  {officers.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
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

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-brand-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                  Total Customers
                </p>
                <h3 className="text-2xl font-bold text-gray-900">{summary.total}</h3>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                  Active Customers
                </p>
                <h3 className="text-2xl font-bold text-gray-900">{summary.active}</h3>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                  New this Month
                </p>
                <h3 className="text-2xl font-bold text-gray-900">{summary.newThisMonth}</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-left whitespace-nowrap">
                    #
                  </th>
                  <SortableHeader label="Branch" sortKey="branch" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader
                    label="RO"
                    sortKey="relationshipOfficer"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Customer Name"
                    sortKey="customerName"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                  <SortableHeader label="Mobile" sortKey="mobile" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader
                    label="ID Number"
                    sortKey="idNumber"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                  <SortableHeader label="Gender" sortKey="gender" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader
                    label="DOB"
                    sortKey="dateOfBirth"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                  <SortableHeader label="Age" sortKey="age" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader
                    label="Status"
                    sortKey="approvalStatus"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Residence"
                    sortKey="residenceType"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Business Name"
                    sortKey="businessName"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Business Type"
                    sortKey="businessDescription"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Created At"
                    sortKey="createdAt"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-600">
                {loading ? (
                  <tr>
                    <td colSpan="14" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-400 font-medium italic">Loading customer records...</p>
                      </div>
                    </td>
                  </tr>
                ) : currentData.length === 0 ? (
                  <tr>
                    <td colSpan="14" className="px-6 py-12 text-center text-gray-400 italic font-medium">
                      No customer records found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  currentData.map((customer, idx) => (
                    <CustomerTableRow
                      key={customer.id}
                      customer={customer}
                      index={idx}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && currentData.length > 0 && (
            <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Showing {Math.min(currentPage * itemsPerPage, totalRows)} of {totalRows}
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
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pageNum = i + 1;
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
                  })}
                  {totalPages > 5 && <span className="px-2 text-gray-400">...</span>}
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

export default CustomerListing;