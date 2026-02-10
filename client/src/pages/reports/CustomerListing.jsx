import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Download,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Search,
  RefreshCw,
  FileText,
  Printer,
  Users, UserCheck, UserPlus
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
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

const CustomerListing = () => {
  const { tenant } = useAuth();
  const [customers, setCustomers] = useState(() => {
    const cached = localStorage.getItem("customer-listing-data");
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
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [exportFormat, setExportFormat] = useState("csv");

  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem("customer-listing-filters");
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...parsed, search: "" }; // Don't persist search
    }
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

  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem("customer-listing-filters", JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    const fetchBranchesAndRegions = async () => {
      const [branchesRes, regionsRes] = await Promise.all([
        supabase.from("branches").select("id, name, region_id"),
        supabase.from("regions").select("id, name")
      ]);

      if (!branchesRes.error) setBranches(branchesRes.data || []);
      if (!regionsRes.error) setRegions(regionsRes.data || []);
    };
    fetchBranchesAndRegions();
  }, []);

  // Fetch all customers with caching
  useEffect(() => {
    const fetchCustomers = async (forceRefresh = false) => {
      try {
        const cacheKey = "customer-listing-data";

        // If we already have data in state and not force refreshing, don't show loading or fetch
        if (!forceRefresh && customers.length > 0) {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { timestamp } = JSON.parse(cached);
            const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
            if (!isExpired) return;
          }
        }

        setLoading(true);
        const { data, error } = await supabase
          .from("customers")
          .select(`
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
          `)
          .eq("form_status", "submitted")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const regionMap = regions.reduce((acc, r) => {
          acc[r.id] = r.name;
          return acc;
        }, {});

        const formatted = data.map((c) => {
          const fullName = [c.Firstname, c.Middlename, c.Surname]
            .filter(Boolean)
            .join(" ");
          const age = c.date_of_birth
            ? new Date().getFullYear() - new Date(c.date_of_birth).getFullYear()
            : "N/A";

          const branchName = c.branch?.name || "N/A";
          const regionId = c.branch?.region_id;
          const regionName = regionId ? regionMap[regionId] || "N/A" : "N/A";

          return {
            id: c.id,
            branch: branchName,
            region: regionName,
            relationshipOfficer: c.ro?.full_name || "N/A",
            customerName: fullName || "N/A",
            mobile: c.mobile || "N/A",
            idNumber: c.id_number || "N/A",
            gender: c.gender || "N/A",
            dateOfBirth: c.date_of_birth || "N/A",
            age,
            approvalStatus: c.status || "N/A",
            residenceType: c.residence_status || "N/A",
            businessName: c.business_name || "N/A",
            businessDescription: c.business_type || "N/A",
            createdAt: c.created_at
              ? new Date(c.created_at).toLocaleDateString()
              : "N/A",
            rawCreatedAt: c.created_at,
          };
        });

        setCustomers(formatted);

        // Save to cache
        localStorage.setItem(cacheKey, JSON.stringify({
          data: formatted,
          timestamp: Date.now()
        }));

      } catch (err) {
        console.error("Error fetching customers:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [regions]);



  const filteredData = useMemo(() => {
    let result = [...customers];

    // Search filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((item) => {
        const name = item.customerName?.toLowerCase() || "";
        const mobile = item.mobile ? String(item.mobile) : "";
        const idNumber = item.idNumber ? String(item.idNumber) : "";
        return (
          name.includes(q) ||
          mobile.includes(q) ||
          idNumber.includes(q)
        );
      });
    }

    // Region filter
    if (filters.region) {
      result = result.filter((item) => item.region === filters.region);
    }

    // Branch filter
    if (filters.branch) {
      result = result.filter((item) => item.branch === filters.branch);
    }

    // Status filter
    if (filters.status) {
      result = result.filter(
        (item) => item.approvalStatus.toLowerCase() === filters.status.toLowerCase()
      );
    }

    // Officer filter
    if (filters.officer) {
      result = result.filter((item) => item.relationshipOfficer === filters.officer);
    }

    // Date range filter
    if (filters.startDate) {
      result = result.filter(
        (item) => new Date(item.rawCreatedAt || item.createdAt) >= new Date(filters.startDate)
      );
    }
    if (filters.endDate) {
      result = result.filter(
        (item) => new Date(item.rawCreatedAt || item.createdAt) <= new Date(filters.endDate)
      );
    }

    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [filters, customers, sortConfig]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleSort = (key) =>
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));



  const handleExport = async () => {
    if (filteredData.length === 0) {
      alert("No data available to export.");
      return;
    }

    switch (exportFormat) {
      case "pdf":
        await exportToPDF();
        break;
      case "excel":
        exportToExcel();
        break;
      case "word":
        await exportToWord();
        break;
      case "csv":
        exportToCSV();
        break;
      default:
        exportToCSV();
    }
  };

  const exportToPDF = async () => {
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
      body: filteredData.map((c) => [
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
      headStyles: { fillStyle: "#2E5E99", textColor: "#FFFFFF" },
    });

    doc.save(`${companyName.toLowerCase()}_customers_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map((c) => ({
        "Branch": c.branch,
        "Region": c.region,
        "Relationship Officer": c.relationshipOfficer,
        "Customer Name": c.customerName,
        "Mobile": c.mobile,
        "ID Number": c.idNumber,
        "Gender": c.gender,
        "DOB": c.dateOfBirth,
        "Age": c.age,
        "Status": c.approvalStatus,
        "Residence": c.residenceType,
        "Business Name": c.businessName,
        "Business Type": c.businessDescription,
        "Created At": c.createdAt,
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    XLSX.writeFile(workbook, `${tenant?.company_name || "Jasiri"}_customers_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportToWord = async () => {
    const table = new Table({
      rows: [
        new TableRow({
          children: [
            "Branch", "Region", "Customer", "Mobile", "Status", "Date"
          ].map(h => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] }))
        }),
        ...filteredData.map(c => new TableRow({
          children: [
            c.branch, c.region, c.customerName, c.mobile, c.approvalStatus, c.createdAt
          ].map(v => new TableCell({ children: [new Paragraph(v)] }))
        }))
      ]
    });

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            children: [new TextRun({ text: tenant?.company_name || "Jasiri", bold: true, size: 32 })]
          }),
          new Paragraph({
            children: [new TextRun({ text: "Customer Listing Report", size: 24 })]
          }),
          new Paragraph({ text: `Generated on: ${new Date().toLocaleString()}` }),
          new Paragraph({ text: "" }),
          table
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${tenant?.company_name || "Jasiri"}_customers_${new Date().toISOString().split("T")[0]}.docx`);
  };

  const exportToCSV = () => {
    const headers = [
      "Branch", "Region", "RO", "Name", "Mobile", "ID", "Gender", "DOB", "Status", "Created"
    ].join(",");

    const rows = filteredData.map(c => [
      c.branch, c.region, c.relationshipOfficer, `"${c.customerName}"`, c.mobile, c.idNumber, c.gender, c.dateOfBirth, c.approvalStatus, c.createdAt
    ].join(","));

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `${tenant?.company_name || "Jasiri"}_customers_${new Date().toISOString().split("T")[0]}.csv`);
  };

  // Summary metrics
  const summary = useMemo(() => {
    const total = filteredData.length;
    const active = filteredData.filter(c => c.approvalStatus.toLowerCase() === "approved").length;

    // New this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = filteredData.filter(c => new Date(c.rawCreatedAt) >= startOfMonth).length;

    return { total, active, newThisMonth };
  }, [filteredData]);

  // Pagination data
  const { totalPages, startIdx, endIdx, currentData } = useMemo(() => {
    const total = filteredData.length;
    const pages = Math.ceil(total / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const data = filteredData.slice(start, end);
    return { totalPages: pages, startIdx: start, endIdx: end, currentData: data };
  }, [filteredData, currentPage, itemsPerPage]);

  const clearFilters = () => {
    setFilters({
      region: "",
      branch: "",
      status: "",
      officer: "",
      startDate: "",
      endDate: "",
      search: ""
    });
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const SortableHeader = ({ label, sortKey }) => (
    <th
      onClick={() => handleSort(sortKey)}
      className="px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors whitespace-nowrap text-left"
    >
      <div className="flex items-center gap-2">
        {label}
        {sortConfig.key === sortKey && (
          sortConfig.direction === "asc" ?
            <ChevronUp className="w-4 h-4 text-brand-primary" /> :
            <ChevronDown className="w-4 h-4 text-brand-primary" />
        )}
      </div>
    </th>
  );

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
                  Customer Listing Report
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-brand-primary" />
                Report Filters
              </h3>
              {(filters.region || filters.branch || filters.status || filters.officer || filters.startDate || filters.endDate) && (
                <button
                  onClick={clearFilters}
                  className="text-sm font-semibold text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Region</label>
                <select
                  value={filters.region}
                  onChange={(e) => handleFilterChange("region", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
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
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                >
                  <option value="">All Branches</option>
                  {branches
                    .filter(b => !filters.region || regions.find(r => r.name === filters.region)?.id === b.region_id)
                    .map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Status</label>
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
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">RO</label>
                <select
                  value={filters.officer}
                  onChange={(e) => handleFilterChange("officer", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                >
                  <option value="">All Officers</option>
                  {[...new Set(customers.map(c => c.relationshipOfficer))].map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">End Date</label>
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
  {/* Total Customers */}
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

  {/* Active Customers */}
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

  {/* New This Month */}
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
                  <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-left whitespace-nowrap">#</th>
                  <SortableHeader label="Branch" sortKey="branch" />
                  <SortableHeader label="RO" sortKey="relationshipOfficer" />
                  <SortableHeader label="Customer Name" sortKey="customerName" />
                  <SortableHeader label="Mobile" sortKey="mobile" />
                  <SortableHeader label="ID Number" sortKey="idNumber" />
                  <SortableHeader label="Gender" sortKey="gender" />
                  <SortableHeader label="DOB" sortKey="dateOfBirth" />
                  <SortableHeader label="Age" sortKey="age" />
                  <SortableHeader label="Status" sortKey="approvalStatus" />
                  <SortableHeader label="Residence" sortKey="residenceType" />
                  <SortableHeader label="Business Name" sortKey="businessName" />
                  <SortableHeader label="Business Type" sortKey="businessDescription" />
                  <SortableHeader label="Created At" sortKey="createdAt" />
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
                  currentData.map((cust, i) => (
                    <tr key={cust.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-400 whitespace-nowrap">{startIdx + i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{cust.branch}</td>
                      <td className="px-4 py-3">{cust.relationshipOfficer}</td>
                      <td className="px-4 py-3 font-bold text-brand-primary whitespace-nowrap">{cust.customerName}</td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{cust.mobile}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{cust.idNumber}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{cust.gender}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{cust.dateOfBirth}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">{cust.age}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${cust.approvalStatus.toLowerCase() === "approved"
                          ? "bg-green-100 text-green-700"
                          : cust.approvalStatus.toLowerCase() === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                          }`}>
                          {cust.approvalStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{cust.residenceType}</td>
                      <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">{cust.businessName}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{cust.businessDescription}</td>
                      <td className="px-4 py-3 whitespace-nowrap ">{cust.createdAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="bg-gray-50/50 px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Showing {startIdx + 1}-{Math.min(endIdx, filteredData.length)} of {filteredData.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 disabled:opacity-50 hover:border-brand-primary transition-all shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex gap-1">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all shadow-sm ${currentPage === i + 1
                        ? "bg-brand-primary text-white"
                        : "bg-white text-gray-600 border border-gray-200 hover:border-brand-primary hover:text-brand-primary"
                        }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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