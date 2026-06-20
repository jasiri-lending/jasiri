import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Download,
  Filter,
  RefreshCw,
  Search,
  Users,
  UserCheck,
  UserPlus,
  AlertTriangle,
  X,
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

const CustomerTableRow = React.memo(({ customer, index, currentPage, itemsPerPage }) => {
  const statusClass =
  customer.approvalStatus.toLowerCase() === "approved"
  ? "text-success"
  : customer.approvalStatus.toLowerCase() === "pending"
    ? "text-warning"
    : "text-danger";

  return (
    <tr className="hover:bg-surface transition-colors duration-150 border-b border-border-light">
      <td className="px-6 py-4 text-xs font-medium text-text-muted whitespace-nowrap text-center">
        {(currentPage - 1) * itemsPerPage + index + 1}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {customer.branch}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {customer.relationshipOfficer}
      </td>
      <td className="px-4 py-3 text-sm  text-text-primary whitespace-nowrap">
        {customer.customerName}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {customer.mobile}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {customer.idNumber}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {customer.gender}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {customer.dateOfBirth}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary text-center whitespace-nowrap">
        {customer.age}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <span
          className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs  ${statusClass}`}
        >
          {customer.approvalStatus}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {customer.residenceType}
      </td>
      <td className="px-4 py-3 text-sm font-medium text-text-primary whitespace-nowrap">
        {customer.businessName}
      </td>
      <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">
        {customer.businessDescription}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
        {customer.createdAt}
      </td>
    </tr>
  );
});
CustomerTableRow.displayName = "CustomerTableRow";

const SortableHeader = React.memo(({ label, sortKey, sortConfig, onSort }) => (
  <th
    onClick={() => onSort(sortKey)}
    className="px-4 py-3 text-xs font-bold text-text-muted uppercase tracking-wider cursor-pointer hover:bg-surface/70 transition-colors whitespace-nowrap text-left"
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
SortableHeader.displayName = "SortableHeader";

// ========== Main Component ==========

const CustomerListing = () => {
  const { profile, tenant } = useAuth();

  // ========== State ==========
  const [rawCustomers, setRawCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("customer-listing-filters");
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...parsed, search: "" }; // Don't persist search query in filters object
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

  const hasFetchedRef = useRef(false);
  const itemsPerPage = 10;

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

    if (!tenantId) {
      if (mounted) setLoading(false);
      clearTimeout(safetyTimeout);
      return;
    }

    if (hasFetchedRef.current && rawCustomers.length > 0) {
      if (mounted) setLoading(false);
      clearTimeout(safetyTimeout);
      return;
    }

    if (!profile) return;

    hasFetchedRef.current = true;

    const fetchCustomers = async () => {
      try {
        setError(null);
        const cacheKey = `customer-listing-raw-data-${tenantId}-${profile?.id}`;

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

        if (mounted) setLoading(true);

        let query = supabase
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
          .eq("tenant_id", tenantId);

        // RBAC Implementation
        if (profile.role === 'relationship_officer') {
          query = query.eq('created_by', profile.id);
        } else if (['branch_manager', 'customer_service_officer'].includes(profile.role)) {
          if (profile.branch_id) {
            query = query.eq('branch_id', profile.branch_id);
          }
        } else if (profile.role === 'regional_manager') {
          if (profile.region_id) {
            query = query.filter('branch.region_id', 'eq', profile.region_id);
          }
        }

        const { data, error: fetchErr } = await query.order("created_at", { ascending: false });

        if (fetchErr) throw fetchErr;
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
          setError(err.message || "Failed to load customer records");
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
  }, [tenant?.id, profile]);

  const handleManualRefresh = async () => {
    const tenantId = tenant?.id;
    if (!tenantId || loading) return;
    try {
      setLoading(true);
      setError(null);

      let query = supabase
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
        .eq("tenant_id", tenantId);

      // RBAC Implementation
      if (profile.role === 'relationship_officer') {
        query = query.eq('created_by', profile.id);
      } else if (['branch_manager', 'customer_service_officer'].includes(profile.role)) {
        if (profile.branch_id) {
          query = query.eq('branch_id', profile.branch_id);
        }
      } else if (profile.role === 'regional_manager') {
        if (profile.region_id) {
          query = query.filter('branch.region_id', 'eq', profile.region_id);
        }
      }

      const { data, error: fetchErr } = await query.order("created_at", { ascending: false });

      if (fetchErr) throw fetchErr;

      setRawCustomers(data || []);

      const cacheKey = `customer-listing-raw-data-${tenantId}-${profile?.id}`;
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          data: data || [],
          timestamp: Date.now(),
        })
      );
    } catch (err) {
      console.error("Error refreshing customers:", err);
      setError(err.message || "Failed to refresh data");
    } finally {
      setLoading(false);
    }
  };

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

  const officers = useMemo(() => {
    const allROs = [...new Set(rawCustomers.map((c) => c.ro?.full_name || "N/A"))].filter(Boolean);
    return allROs;
  }, [rawCustomers]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.region !== "" ||
      filters.branch !== "" ||
      filters.status !== "" ||
      filters.officer !== "" ||
      filters.startDate !== "" ||
      filters.endDate !== ""
    );
  }, [filters]);

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
      headStyles: { fillColor: [26, 122, 74], textColor: [255, 255, 255] },
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
  const { totalRows, currentData } = useMemo(() => {
    const total = sortedData.length;
    const start = (currentPage - 1) * itemsPerPage;
    const data = sortedData.slice(start, start + itemsPerPage);
    return { totalRows: total, currentData: data };
  }, [sortedData, currentPage]);

  const regionOptions = useMemo(() => {
    return [
      { value: "", label: "All Regions" },
      ...regions.map((r) => ({ value: r.name, label: r.name })),
    ];
  }, [regions]);

  const branchOptions = useMemo(() => {
    const filteredBranches = branches.filter(
      (b) =>
        !filters.region ||
        regions.find((r) => r.name === filters.region)?.id === b.region_id
    );
    return [
      { value: "", label: "All Branches" },
      ...filteredBranches.map((b) => ({ value: b.name, label: b.name })),
    ];
  }, [branches, filters.region, regions]);

  const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: "approved", label: "Approved" },
    { value: "pending", label: "Pending" },
    { value: "rejected", label: "Rejected" },
  ];

  const roOptions = useMemo(() => {
    return [
      { value: "", label: "All Officers" },
      ...officers.map((officer) => ({ value: officer, label: officer })),
    ];
  }, [officers]);

  const exportFormatOptions = [
    { value: "csv", label: "CSV" },
    { value: "excel", label: "Excel" },
    { value: "word", label: "Word" },
    { value: "pdf", label: "PDF" },
  ];

  if (error) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-5 font-outfit">
        <div className="bg-card border border-border shadow-card rounded-xl p-8 max-w-md w-full text-center space-y-4 animate-fade-in">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-text-heading">Failed to Load Report</h3>
          <p className="text-sm text-muted">{error}</p>
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

  // ========== Render ==========
  return (
    <div className="min-h-screen bg-page p-5 md:p-8 space-y-6 font-outfit animate-fade-in">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
           
            <h1 className="text-sm font-bold text-muted mt-0.5">Customer Listing Report</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
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

        {/* Filters Panel */}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
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

              {/* Status */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Status
                </label>
                <CustomSelect
                  options={statusOptions}
                  value={filters.status}
                  onChange={(val) => handleFilterChange("status", val)}
                  placeholder="All Statuses"
                  compact
                  fullWidth
                />
              </div>

              {/* RO */}
              {!['relationship_officer'].includes(profile?.role) && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    Officer (RO)
                  </label>
                  <CustomSelect
                    options={roOptions}
                    value={filters.officer}
                    onChange={(val) => handleFilterChange("officer", val)}
                    placeholder="All Officers"
                    compact
                    fullWidth
                  />
                </div>
              )}

              {/* Start Date */}
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

              {/* End Date */}
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
            </div>
          </div>
        )}

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center gap-4 hover:shadow-md transition-all duration-200">
            <div className="w-12 h-12 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-brand" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">
                Total Customers
              </p>
              <h3 className="text-2xl font-bold text-text-primary mt-1 tabular-nums">
                {summary.total}
              </h3>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center gap-4 hover:shadow-md transition-all duration-200">
            <div className="w-12 h-12 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">
                Active Customers
              </p>
              <h3 className="text-2xl font-bold text-text-primary mt-1 tabular-nums">
                {summary.active}
              </h3>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-card p-6 flex items-center gap-4 hover:shadow-md transition-all duration-200">
            <div className="w-12 h-12 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">
                New this Month
              </p>
              <h3 className="text-2xl font-bold text-text-primary mt-1 tabular-nums">
                {summary.newThisMonth}
              </h3>
            </div>
          </div>
        </div>

        {/* Table Section */}
        {loading ? (
          <SkeletonTable rows={10} cols={14} />
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase tracking-wider text-center whitespace-nowrap">
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
                <tbody className="divide-y divide-border-light">
                  {currentData.length === 0 ? (
                    <tr>
                      <td colSpan="14" className="px-6 py-12 text-center text-text-muted italic font-medium">
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

            {/* Pagination Component */}
            <Pagination
              totalItems={totalRows}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerListing;