import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  Filter,
  ChevronUp,
  ChevronDown,
  Search,
  RefreshCw,
  Eye
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
import { useAuth } from "../../hooks/userAuth";
import { Pagination } from '../../components/Pagination.jsx';
import CustomSelect from '../../components/CustomSelect';
import { SkeletonTable } from '../../components/Skeleton';

// ========== Memoized Helper Components ==========

const SortableHeader = React.memo(({ label, sortKey, sortConfig, onSort, align = "left" }) => (
  <th
    onClick={() => onSort(sortKey)}
    className={`px-4 py-3 text-${align} text-xs font-medium whitespace-nowrap text-muted cursor-pointer hover:bg-surface transition-colors`}
  >
    <div className={`flex items-center gap-1.5 ${align === "right" ? "justify-end" : "justify-start"}`}>
      <span>{label}</span>
      {sortConfig.key === sortKey &&
        (sortConfig.direction === "asc" ? (
          <ChevronUp className="w-3.5 h-3.5 text-brand" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-brand" />
        ))}
    </div>
  </th>
));
SortableHeader.displayName = "SortableHeader";

// ========== Main Component ==========

const CustomerAccountModal = () => {
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();

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
      let query = supabase
        .from("branches")
        .select("id, name, region_id")
        .eq("tenant_id", tenantId);

      // Branch RBAC
      if (profile?.role === 'relationship_officer') {
        if (profile.branch_id) query = query.eq('id', profile.branch_id);
      } else if (['branch_manager', 'customer_service_officer'].includes(profile?.role)) {
        if (profile.branch_id) query = query.eq('id', profile.branch_id);
      } else if (profile?.role === 'regional_manager') {
        if (profile.region_id) query = query.eq('region_id', profile.region_id);
      }

      const { data, error } = await query;
      if (!error) setBranches(data || []);
    };
    fetchBranches();
  }, [tenant?.id, profile]);

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

    if (!tenantId || !profile) {
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

        let query = supabase
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
              Firstname,
              Middlename,
              Surname,
              mobile,
              branch_id,
              created_by,
              branch:branch_id(name, region_id)
            ),
            installments:loan_installments(
              paid_amount
            )
          `)
          .eq("tenant_id", tenantId);

        // RBAC Implementation
        if (profile.role === 'relationship_officer') {
          query = query.eq('customer.created_by', profile.id);
        } else if (['branch_manager', 'customer_service_officer'].includes(profile.role)) {
          if (profile.branch_id) {
            query = query.eq('customer.branch_id', profile.branch_id);
          }
        } else if (profile.role === 'regional_manager') {
          if (profile.region_id) {
            query = query.filter('customer.branch.region_id', 'eq', profile.region_id);
          }
        }

        const { data: loans, error } = await query;

        if (error) throw error;

        if (mounted) {
          const customerSummary = {};

          loans.forEach((loan) => {
            const cust = loan.customer || {};
            const custId = cust.id;
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
                loanAmount: 0,
                interest: 0,
                totalPayable: 0,
                totalPaid: 0,
                outstanding: 0,
                latestDisbursed: loan.disbursed_date || loan.created_at,
                status: "Active",
              };
            }

            const custRec = customerSummary[custId];
            custRec.totalLoanApplied += loan.scored_amount || 0;
            custRec.loanAmount += loan.scored_amount || 0;
            custRec.interest += loan.total_interest || 0;
            custRec.totalPayable += loan.total_payable || 0;
            custRec.totalPaid += totalPaid;
            custRec.outstanding += outstanding;

            const loanDate = new Date(loan.disbursed_date || loan.created_at);
            const currentDate = new Date(custRec.latestDisbursed);
            if (loanDate > currentDate) {
              custRec.latestDisbursed = loan.disbursed_date || loan.created_at;
            }
          });

          const formatted = Object.values(customerSummary).map((c) => ({
            ...c,
            status: c.outstanding <= 1 ? "Closed" : "Active",
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
  }, [tenant?.id, profile]);

  // ========== Filtering and Sorting ==========
  const filteredData = useMemo(() => {
    let result = [...rawAccounts];
    const query = (filters.search || "").toLowerCase().trim();

    if (query) {
      result = result.filter(
        (item) =>
          item.customerName.toLowerCase().includes(query) ||
          item.phone.includes(query)
      );
    }

    if (filters.branch) {
      result = result.filter((item) => item.branch === filters.branch);
    }

    if (filters.status) {
      result = result.filter((item) => item.status.toLowerCase() === filters.status.toLowerCase());
    }

    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);

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

  const { totalPages, currentData } = useMemo(() => {
    const total = sortedData.length;
    const pages = Math.ceil(total / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const data = sortedData.slice(start, start + itemsPerPage);
    return { totalRows: total, totalPages: pages, currentData: data };
  }, [sortedData, currentPage]);

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
      headStyles: { fillColor: [26, 122, 74], textColor: [255, 255, 255] },
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
              text: tenant?.company_name || "Jasiri",
              heading: "Heading1",
            }),
            new Paragraph({
              text: "Customer Account Statements",
              heading: "Heading2",
            }),
            new Paragraph(`Generated on: ${new Date().toLocaleString()}`),
            table,
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${tenant?.company_name || "Jasiri"}_account_statements.docx`);
  };

  const handleExport = () => {
    if (exportFormat === "pdf") exportToPDF();
    else if (exportFormat === "excel") exportToExcel();
    else if (exportFormat === "word") exportToWord();
    else exportToCSV();
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
    ];
    const rows = sortedData.map((c) => [
      c.customerName,
      c.phone,
      c.branch,
      c.loanAmount,
      c.interest,
      c.totalPayable,
      c.totalPaid,
      c.outstanding,
      c.status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${tenant?.company_name || "Jasiri"}_account_statements_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const branchOptions = useMemo(() => {
    return [
      { value: "", label: "All Branches" },
      ...branches.map((b) => ({ value: b.name, label: b.name }))
    ];
  }, [branches]);

  const statusOptions = [
    { value: "", label: "All Status" },
    { value: "active", label: "Active" },
    { value: "closed", label: "Closed" }
  ];

  const exportFormatOptions = [
    { value: "csv", label: "CSV" },
    { value: "excel", label: "Excel" },
    { value: "word", label: "Word" },
    { value: "pdf", label: "PDF" }
  ];

  // ========== Render ==========
  if (loading) {
    return (
      <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
        <SkeletonTable rows={5} cols={10} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
      <h1 className="text-xs text-slate-500 mb-4 font-medium font-outfit">
        Reports / Customer Account Statements
      </h1>

      <div className="bg-card rounded-xl shadow-card border border-border">
        {/* Table Header Card */}
        <div className="p-4 border-b border-border-light flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-surface">
          <div>
            <h2 className="text-xs font-semibold text-heading font-outfit">
              Customer Account Statements
            </h2>
            <p className="text-[10px] text-muted mt-0.5">
              Detailed statement of customer transactions, balances, and account activity
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search customer, phone..."
                value={filters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-56 pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-card text-body focus:border-brand-primary focus:outline-none transition-colors duration-200"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium transition-all border ${
                showFilters
                  ? "bg-brand-primary text-white shadow-sm border-transparent hover:bg-brand-primary/90"
                  : "bg-card text-body border-border hover:bg-surface"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>

            {/* Export format & button */}
            <div className="flex items-center gap-2">
              <div className="w-28 z-20">
                <CustomSelect
                  value={exportFormat}
                  onChange={setExportFormat}
                  options={exportFormatOptions}
                  compact
                  fullWidth
                />
              </div>
              <button
                onClick={handleExport}
                className="px-3 py-1.5 rounded-md bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary/95 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-4 border-b border-border-light bg-card/50 space-y-4 font-outfit">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-heading">Filter Results</h4>
              <button
                onClick={clearFilters}
                className="text-red-600 text-xs font-semibold flex items-center gap-1 hover:text-red-700 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {['super_admin', 'regional_manager'].includes(profile?.role) && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted uppercase">Branch</label>
                  <CustomSelect
                    value={filters.branch}
                    onChange={(val) => handleFilterChange("branch", val)}
                    options={branchOptions}
                    compact
                    fullWidth
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted uppercase">Status</label>
                <CustomSelect
                  value={filters.status}
                  onChange={(val) => handleFilterChange("status", val)}
                  options={statusOptions}
                  compact
                  fullWidth
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted uppercase">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                  className="w-full bg-card border border-border px-3 py-1.5 rounded-lg text-xs focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted uppercase">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                  className="w-full bg-card border border-border px-3 py-1.5 rounded-lg text-xs focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto font-outfit">
          <table className="min-w-full divide-y divide-border-light">
            <thead className="bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap text-muted">#</th>
                <SortableHeader label="Customer Details" sortKey="customerName" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Phone" sortKey="phone" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Branch" sortKey="branch" sortConfig={sortConfig} onSort={handleSort} />
                <SortableHeader label="Principal" sortKey="loanAmount" sortConfig={sortConfig} onSort={handleSort} align="right" />
                <SortableHeader label="Interest" sortKey="interest" sortConfig={sortConfig} onSort={handleSort} align="right" />
                <SortableHeader label="Payable" sortKey="totalPayable" sortConfig={sortConfig} onSort={handleSort} align="right" />
                <SortableHeader label="Paid" sortKey="totalPaid" sortConfig={sortConfig} onSort={handleSort} align="right" />
                <SortableHeader label="Outstanding" sortKey="outstanding" sortConfig={sortConfig} onSort={handleSort} align="right" />
                <SortableHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} align="center" />
                <th className="px-4 py-3 text-right text-xs font-medium whitespace-nowrap text-muted">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {currentData.map((c, i) => {
                const rowIndex = (currentPage - 1) * itemsPerPage + i + 1;
                return (
                  <tr key={c.customerId || i} className="hover:bg-surface transition-colors">
                    <td className="px-4 py-3 text-xs text-muted font-medium whitespace-nowrap">{rowIndex}</td>
                    <td className="px-4 py-3 text-xs text-brand font-bold whitespace-nowrap">{c.customerName}</td>
                    <td className="px-4 py-3 text-xs text-body whitespace-nowrap">{c.phone}</td>
                    <td className="px-4 py-3 text-xs text-body whitespace-nowrap">{c.branch}</td>

                    <td className="px-4 py-3 text-xs text-right text-body font-medium whitespace-nowrap">
                      {formatCurrency(c.loanAmount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-right text-body font-medium whitespace-nowrap">
                      {formatCurrency(c.interest)}
                    </td>
                    <td className="px-4 py-3 text-xs text-right text-body font-medium whitespace-nowrap">
                      {formatCurrency(c.totalPayable)}
                    </td>
                    <td className="px-4 py-3 text-xs text-right text-emerald-700 font-semibold whitespace-nowrap">
                      {formatCurrency(c.totalPaid)}
                    </td>
                    <td className="px-4 py-3 text-xs text-right text-red-700 font-semibold whitespace-nowrap">
                      {formatCurrency(c.outstanding)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => handleViewStatement(c)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-brand-primary hover:bg-brand-surface transition-colors"
                          aria-label="View Statement"
                        >
                          <Eye size={12} />
                          Statement
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td className="p-8 text-center text-xs text-muted" colSpan={11}>
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <Pagination
            totalItems={filteredData.length}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </div>
  );
};

export default CustomerAccountModal;