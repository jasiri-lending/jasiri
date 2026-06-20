import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../../supabaseClient";
import {
  Filter,
  Download,
  RefreshCw,
  Search,
  X,
  AlertTriangle,
  Banknote,
  Hash,
} from "lucide-react";
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
import { SkeletonTable } from "../../components/Skeleton";
import { Pagination } from "../../components/Pagination";
import CustomSelect from "../../components/CustomSelect";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (num) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(num || 0);

// ─── Table Row ────────────────────────────────────────────────────────────────

const LoanTableRow = React.memo(({ loan, index, currentPage, itemsPerPage }) => (
  <tr className="hover:bg-surface transition-colors duration-150">
    <td className="px-4 py-3 text-center text-muted text-xs">
      {(currentPage - 1) * itemsPerPage + index + 1}
    </td>
    <td className="px-4 py-3 font-semibold text-text-primary text-sm whitespace-nowrap">{loan.branch}</td>
    <td className="px-4 py-3 text-text-secondary text-sm whitespace-nowrap">{loan.officer}</td>
    <td className="px-4 py-3 font-medium text-text-primary text-sm whitespace-nowrap">{loan.customerName}</td>
    <td className="px-4 py-3 text-text-secondary text-sm whitespace-nowrap">{loan.idNumber}</td>
    <td className="px-4 py-3 text-text-secondary text-sm whitespace-nowrap">{loan.mobile}</td>
    <td className="px-4 py-3 text-center">
      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold tabular-nums">
        {loan.numDueInstallments}
      </span>
    </td>
    <td className="px-4 py-3 text-right text-text-primary text-sm tabular-nums whitespace-nowrap">
      {formatCurrency(loan.disbursedAmount)}
    </td>
    <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400 text-sm tabular-nums whitespace-nowrap">
      {formatCurrency(loan.totalDue)}
    </td>
    <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums whitespace-nowrap">
      {formatCurrency(loan.totalPaid)}
    </td>
    <td className="px-4 py-3 text-right font-bold text-orange-600 dark:text-orange-400 text-sm tabular-nums whitespace-nowrap">
      {formatCurrency(loan.amountUnpaid)}
    </td>
    <td className="px-4 py-3 text-text-secondary text-sm whitespace-nowrap">{loan.expectedDueDate}</td>
  </tr>
));
LoanTableRow.displayName = "LoanTableRow";

// ─── Main Component ───────────────────────────────────────────────────────────

const LoanDueReport = () => {
  const [tenant] = useState(() => {
    try {
      const saved = localStorage.getItem("tenant");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const { profile } = useAuth();

  const [rawLoans, setRawLoans] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("loan-due-filters");
      return saved ? JSON.parse(saved) : {
        region: "", branch: "", officer: "",
        dateRange: "today", customStartDate: "", customEndDate: "", installmentsDue: "",
      };
    } catch {
      return { region: "", branch: "", officer: "", dateRange: "today", customStartDate: "", customEndDate: "", installmentsDue: "" };
    }
  });

  const itemsPerPage = 10;

  // Persist filters
  useEffect(() => {
    const id = setTimeout(() => {
      try { localStorage.setItem("loan-due-filters", JSON.stringify(filters)); } catch {}
    }, 500);
    return () => clearTimeout(id);
  }, [filters]);

  // Fetch metadata (branches + regions)
  useEffect(() => {
    if (!tenant?.id) return;
    const controller = new AbortController();
    const tenantId = tenant.id;

    const fetchMetadata = async () => {
      try {
        const [{ data: branchesData }, { data: regionsData }] = await Promise.all([
          supabase.from("branches").select("id, name, region_id").eq("tenant_id", tenantId).abortSignal(controller.signal),
          supabase.from("regions").select("id, name").eq("tenant_id", tenantId).abortSignal(controller.signal),
        ]);
        setBranches(branchesData || []);
        setRegions(regionsData || []);
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    };

    fetchMetadata();
    return () => controller.abort();
  }, [tenant?.id]);

  // Fetch loans
  useEffect(() => {
    if (!tenant?.id) return;
    const controller = new AbortController();
    const tenantId = tenant.id;
    const cacheKey = `loan-due-raw-data-${tenantId}`;

    const fetchLoans = async () => {
      try {
        setLoading(true);
        setError(null);

        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 4 * 60 * 60 * 1000) {
            setRawLoans(data || []);
            setLoading(false);
            return;
          }
        }

        let query = supabase
          .from("loans")
          .select(`
            id, scored_amount, total_payable, product_name, product_type,
            disbursed_at, branch_id, tenant_id, status,
            branch:branch_id(name, region_id),
            customer:customer_id(id, Firstname, Middlename, Surname, mobile, id_number),
            loan_officer:booked_by(full_name),
            installments:loan_installments(due_date, due_amount, paid_amount, status, principal_amount, interest_amount, principal_due, interest_due)
          `)
          .eq("tenant_id", tenantId)
          .eq("status", "disbursed")
          .abortSignal(controller.signal);

        if (profile?.role === "relationship_officer") query = query.eq("booked_by", profile.id);
        else if (["branch_manager", "customer_service_officer"].includes(profile?.role)) query = query.eq("branch_id", profile.branch_id);
        else if (profile?.role === "regional_manager") query = query.eq("region_id", profile.region_id);

        const { data, error: fetchErr } = await query;
        if (fetchErr) throw fetchErr;

        setRawLoans(data || []);
        setLoading(false);
        localStorage.setItem(cacheKey, JSON.stringify({ data: data || [], timestamp: Date.now() }));
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load loans");
        setLoading(false);
      }
    };

    fetchLoans();
    return () => controller.abort();
  }, [tenant?.id, profile?.role, profile?.id, profile?.branch_id, profile?.region_id]);

  // Manual refresh
  const handleManualRefresh = async () => {
    const tenantId = tenant?.id;
    if (!tenantId || loading) return;
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("loans")
        .select(`
          id, scored_amount, total_payable, product_name, product_type,
          disbursed_at, branch_id, tenant_id, status,
          branch:branch_id(name, region_id),
          customer:customer_id(id, Firstname, Middlename, Surname, mobile, id_number),
          loan_officer:booked_by(full_name),
          installments:loan_installments(due_date, due_amount, paid_amount, status, principal_amount, interest_amount, principal_due, interest_due)
        `)
        .eq("tenant_id", tenantId)
        .eq("status", "disbursed");

      if (profile?.role === "relationship_officer") query = query.eq("booked_by", profile.id);
      else if (["branch_manager", "customer_service_officer"].includes(profile?.role)) query = query.eq("branch_id", profile.branch_id);
      else if (profile?.role === "regional_manager") query = query.eq("region_id", profile.region_id);

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      setRawLoans(data || []);
      localStorage.setItem(`loan-due-raw-data-${tenantId}`, JSON.stringify({ data: data || [], timestamp: Date.now() }));
    } catch (err) {
      setError(err.message || "Failed to refresh data");
    } finally {
      setLoading(false);
    }
  };

  // Date range helper
  const getDateRange = () => {
    const today = new Date();
    let startDate, endDate;
    switch (filters.dateRange) {
      case "today": startDate = endDate = today.toISOString().split("T")[0]; break;
      case "week": {
        startDate = today.toISOString().split("T")[0];
        const we = new Date(today); we.setDate(today.getDate() + 6);
        endDate = we.toISOString().split("T")[0]; break;
      }
      case "month": {
        startDate = today.toISOString().split("T")[0];
        const me = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate = me.toISOString().split("T")[0]; break;
      }
      case "quarter": {
        startDate = today.toISOString().split("T")[0];
        const qe = new Date(today); qe.setMonth(today.getMonth() + 3);
        endDate = qe.toISOString().split("T")[0]; break;
      }
      case "year": {
        startDate = today.toISOString().split("T")[0];
        const ye = new Date(today.getFullYear(), 11, 31);
        endDate = ye.toISOString().split("T")[0]; break;
      }
      case "custom": startDate = filters.customStartDate; endDate = filters.customEndDate; break;
      default: startDate = endDate = today.toISOString().split("T")[0];
    }
    return { startDate, endDate };
  };

  const getDateRangeLabel = () => {
    const map = { today: "Today", week: "This Week", month: "This Month", quarter: "This Quarter", year: "This Year", custom: "Custom Range" };
    return map[filters.dateRange] || "Today";
  };

  // Filtered data
  const filteredData = useMemo(() => {
    const { startDate, endDate } = getDateRange();
    const regionMap = regions.reduce((a, r) => ({ ...a, [r.id]: r.name }), {});
    const query = (searchQuery || "").toLowerCase().trim();

    return rawLoans.map((loan) => {
      const branchName = loan.branch?.name || "N/A";
      const regionName = loan.branch?.region_id ? (regionMap[loan.branch.region_id] || "N/A") : "N/A";
      const officerName = loan.loan_officer?.full_name || "N/A";
      const cust = loan.customer || {};
      const fullName = [cust.Firstname, cust.Middlename, cust.Surname].filter(Boolean).join(" ");

      const dueInRange = (loan.installments || []).filter((i) => {
        const dueDate = i.due_date?.split("T")[0];
        return dueDate >= startDate && dueDate <= endDate && ["pending", "partial"].includes(i.status);
      });

      if (!dueInRange.length) return null;

      const totalDue = dueInRange.reduce((sum, i) => {
        const dueAmt = Number(i.due_amount || 0);
        const paidAmt = Number(i.paid_amount || 0);
        return sum + (i.status === "partial" || paidAmt > 0 ? Math.max(0, dueAmt - paidAmt) : dueAmt);
      }, 0);
      const principalDue = dueInRange.reduce((s, i) => s + Number(i.principal_due || i.principal_amount || 0), 0);
      const interestDue = dueInRange.reduce((s, i) => s + Number(i.interest_due || i.interest_amount || 0), 0);
      const totalPaid = (loan.installments || []).reduce((s, i) => s + Number(i.paid_amount || 0), 0);

      const row = {
        branch: branchName, region: regionName, officer: officerName,
        loanId: loan.id, customerName: fullName || "N/A",
        mobile: cust.mobile || "N/A", idNumber: cust.id_number || "N/A",
        productName: loan.product_name || "N/A", productType: loan.product_type || "N/A",
        numDueInstallments: dueInRange.length,
        disbursedAmount: loan.scored_amount || 0,
        principalDue, interestDue, totalDue, totalPaid,
        amountUnpaid: (loan.total_payable || 0) - totalPaid,
        disbursementDate: loan.disbursed_at?.split("T")[0] || "N/A",
        expectedDueDate: dueInRange[0]?.due_date?.split("T")[0] || "N/A",
      };

      if (filters.officer && row.officer !== filters.officer) return null;
      if (filters.branch && row.branch !== filters.branch) return null;
      if (filters.region && row.region !== filters.region) return null;
      if (filters.installmentsDue && row.numDueInstallments !== Number(filters.installmentsDue)) return null;

      if (query) {
        const match = String(row.customerName || "").toLowerCase().includes(query) ||
          String(row.mobile || "").includes(query) ||
          String(row.idNumber || "").includes(query);
        if (!match) return null;
      }

      return row;
    }).filter(Boolean);
  }, [rawLoans, filters, regions, searchQuery]);

  // Update officer list
  useEffect(() => {
    setOfficers([...new Set(filteredData.map((l) => l.officer))]);
  }, [filteredData]);

  // Grand totals
  const grandTotals = useMemo(() =>
    filteredData.reduce((acc, l) => ({
      totalDue: acc.totalDue + l.totalDue,
      totalPaid: acc.totalPaid + l.totalPaid,
      totalUnpaid: acc.totalUnpaid + l.amountUnpaid,
      principalDue: acc.principalDue + l.principalDue,
      interestDue: acc.interestDue + l.interestDue,
      disbursedAmount: acc.disbursedAmount + l.disbursedAmount,
    }), { totalDue: 0, totalPaid: 0, totalUnpaid: 0, principalDue: 0, interestDue: 0, disbursedAmount: 0 })
  , [filteredData]);

  // Pagination
  const totalRows = filteredData.length;
  const currentData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const hasActiveFilters = searchQuery || filters.region || filters.branch || filters.officer || filters.installmentsDue || filters.dateRange !== "today";

  const handleResetFilters = () => {
    setFilters({ region: "", branch: "", officer: "", dateRange: "today", customStartDate: "", customEndDate: "", installmentsDue: "" });
    setSearchQuery("");
    setCurrentPage(1);
  };

  // ── Export functions ─────────────────────────────────────────────────────
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const companyName = tenant?.company_name || "Company";
    doc.setFontSize(22); doc.setTextColor(40, 40, 40); doc.text(companyName, 14, 20);
    doc.setFontSize(14); doc.setTextColor(100, 100, 100); doc.text("Loan Due Report", 14, 30);
    doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38);
    doc.text(`Range: ${getDateRangeLabel()}`, 14, 43);
    autoTable(doc, {
      startY: 50,
      head: [["No", "Branch", "Officer", "Customer", "Mobile", "Inst.", "Disbursed", "Due", "Paid", "Unpaid", "Due Date"]],
      body: filteredData.map((l, i) => [i + 1, l.branch, l.officer, l.customerName, l.mobile, l.numDueInstallments, formatCurrency(l.disbursedAmount), formatCurrency(l.totalDue), formatCurrency(l.totalPaid), formatCurrency(l.amountUnpaid), l.expectedDueDate]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [46, 94, 153], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    const slug = companyName.toLowerCase().replace(/ /g, "_");
    doc.save(`${slug}_due_loans_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const exportToExcel = () => {
    const companyName = tenant?.company_name || "Company";
    const ws = XLSX.utils.json_to_sheet(filteredData.map((l, i) => ({ No: i + 1, Branch: l.branch, Region: l.region, Officer: l.officer, Customer: l.customerName, Mobile: l.mobile, "ID Number": l.idNumber, Product: l.productName, "Installments Due": l.numDueInstallments, "Disbursed Amount": l.disbursedAmount, "Principal Due": l.principalDue, "Interest Due": l.interestDue, "Total Due": l.totalDue, "Total Paid": l.totalPaid, "Unpaid Amount": l.amountUnpaid, "Due Date": l.expectedDueDate, "Disbursement Date": l.disbursementDate })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Loan Due Report");
    const slug = companyName.toLowerCase().replace(/ /g, "_");
    XLSX.writeFile(wb, `${slug}_due_loans_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportToCSV = () => {
    const companyName = tenant?.company_name || "Company";
    const headers = ["No", "Branch", "Region", "Officer", "Customer Name", "Mobile", "ID Number", "Product", "# Installments", "Disbursed", "Principal Due", "Interest Due", "Total Due", "Total Paid", "Unpaid", "Due Date", "Disbursement Date"];
    const rows = filteredData.map((l, i) => [i + 1, l.branch, l.region, l.officer, l.customerName, l.mobile, l.idNumber, l.productName, l.numDueInstallments, l.disbursedAmount, l.principalDue, l.interestDue, l.totalDue, l.totalPaid, l.amountUnpaid, l.expectedDueDate, l.disbursementDate]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const slug = companyName.toLowerCase().replace(/ /g, "_");
    saveAs(blob, `${slug}_due_loans_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const exportToWord = () => {
    const companyName = tenant?.company_name || "Company";
    const doc = new Document({ sections: [{ children: [new Paragraph({ children: [new TextRun({ text: `${companyName} - Loan Due Report`, bold: true, size: 32 })] }), new Paragraph({ text: `Generated: ${new Date().toLocaleString()}` }), new Paragraph({ text: `Date Range: ${getDateRangeLabel()}` }), new Paragraph({ text: "" }), new Table({ rows: [new TableRow({ children: ["No", "Branch", "Customer", "Due", "Due Date"].map((t) => new TableCell({ children: [new Paragraph({ text: t, bold: true })] })) }), ...filteredData.map((l, i) => new TableRow({ children: [String(i + 1), l.branch, l.customerName, formatCurrency(l.totalDue), l.expectedDueDate].map((t) => new TableCell({ children: [new Paragraph({ text: t })] })) }))] })] }] });
    Packer.toBlob(doc).then((blob) => {
      const slug = companyName.toLowerCase().replace(/ /g, "_");
      saveAs(blob, `${slug}_due_loans_${new Date().toISOString().split("T")[0]}.docx`);
    });
  };

  const handleExport = () => {
    switch (exportFormat) {
      case "pdf": exportToPDF(); break;
      case "word": exportToWord(); break;
      case "excel": exportToExcel(); break;
      default: exportToCSV(); break;
    }
  };

  const exportFormatOptions = [
    { value: "csv", label: "CSV" },
    { value: "excel", label: "Excel" },
    { value: "word", label: "Word" },
    { value: "pdf", label: "PDF" },
  ];

  const dateRangeOptions = [
    { value: "today", label: "Due Today" },
    { value: "week", label: "Due This Week" },
    { value: "month", label: "Due This Month" },
    { value: "quarter", label: "Due This Quarter" },
    { value: "year", label: "Due This Year" },
    { value: "custom", label: "Custom Range" },
  ];

  const installmentOptions = [
    { value: "", label: "All" },
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: String(n) })),
  ];

  // ── Error state ──────────────────────────────────────────────────────────
  if (error && rawLoans.length === 0) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="bg-card rounded-xl border border-border shadow-card p-10 text-center space-y-4">
          <X className="w-12 h-12 mx-auto text-red-500" />
          <p className="text-text-primary font-semibold text-lg">Failed to load report</p>
          <p className="text-muted text-sm">{error}</p>
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-page p-5 md:p-8 space-y-6 font-outfit animate-fade-in">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
          
            <h1 className="text-sm font-bold text-muted mt-0.5">Loan Due Report</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search customer, ID, phone…"
                className="bg-card border border-border text-text-primary placeholder:text-muted rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 w-56 transition"
              />
            </div>

            {/* Filters toggle */}
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

            {/* Refresh */}
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              title="Refresh data"
              className="p-2 rounded-lg border border-border bg-card text-text-secondary hover:text-brand hover:border-brand/50 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {/* Export */}
            <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
              <CustomSelect
                options={exportFormatOptions}
                value={exportFormat}
                onChange={setExportFormat}
                placeholder="Format"
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

        {/* ── Filter Panel ── */}
        {showFilters && (
          <div className="bg-card border border-border rounded-xl shadow-card p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Filter Results</h3>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-medium"
                >
                  <X className="w-3.5 h-3.5" /> Clear all
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Date range */}
              <CustomSelect
                options={dateRangeOptions}
                value={filters.dateRange}
                onChange={(v) => setFilters((p) => ({ ...p, dateRange: v }))}
                placeholder="Due Range"
              />

              {/* Region */}
              {!["regional_manager", "branch_manager", "customer_service_officer", "relationship_officer"].includes(profile?.role) && (
                <CustomSelect
                  options={[{ value: "", label: "All Regions" }, ...regions.map((r) => ({ value: r.name, label: r.name }))]}
                  value={filters.region}
                  onChange={(v) => setFilters((p) => ({ ...p, region: v }))}
                  placeholder="All Regions"
                />
              )}

              {/* Branch */}
              {!["branch_manager", "customer_service_officer", "relationship_officer"].includes(profile?.role) && (
                <CustomSelect
                  options={[
                    { value: "", label: "All Branches" },
                    ...branches
                      .filter((b) => !filters.region || b.region_id === regions.find((r) => r.name === filters.region)?.id)
                      .map((b) => ({ value: b.name, label: b.name })),
                  ]}
                  value={filters.branch}
                  onChange={(v) => setFilters((p) => ({ ...p, branch: v }))}
                  placeholder="All Branches"
                />
              )}

              {/* Officer */}
              {profile?.role !== "relationship_officer" && (
                <CustomSelect
                  options={[{ value: "", label: "All Officers" }, ...officers.map((o) => ({ value: o, label: o }))]}
                  value={filters.officer}
                  onChange={(v) => setFilters((p) => ({ ...p, officer: v }))}
                  placeholder="All Officers"
                />
              )}

              {/* Installments due */}
              <CustomSelect
                options={installmentOptions}
                value={filters.installmentsDue}
                onChange={(v) => setFilters((p) => ({ ...p, installmentsDue: v }))}
                placeholder="Installments Due"
              />
            </div>

            {/* Custom date pickers */}
            {filters.dateRange === "custom" && (
              <div className="flex flex-wrap gap-3 pt-1">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted font-medium">From</label>
                  <input
                    type="date"
                    value={filters.customStartDate}
                    onChange={(e) => setFilters((p) => ({ ...p, customStartDate: e.target.value }))}
                    className="bg-surface border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted font-medium">To</label>
                  <input
                    type="date"
                    value={filters.customEndDate}
                    onChange={(e) => setFilters((p) => ({ ...p, customEndDate: e.target.value }))}
                    className="bg-surface border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border shadow-card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">Total Amount Due</p>
              <p className="text-xl font-bold text-text-primary tabular-nums mt-0.5">
                {formatCurrency(grandTotals.totalDue)}
              </p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <Banknote className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">Total Unpaid Balance</p>
              <p className="text-xl font-bold text-text-primary tabular-nums mt-0.5">
                {formatCurrency(grandTotals.totalUnpaid)}
              </p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
              <Hash className="w-5 h-5 text-brand" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">Number of Loans</p>
              <p className="text-xl font-bold text-text-primary tabular-nums mt-0.5">
                {filteredData.length.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <SkeletonTable rows={8} cols={8} />
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    {["No.", "Branch Name", "RO", "Customer Name", "ID Number", "Phone", "Inst. Due", "Disbursed", "Total Due", "Total Paid", "Unpaid Balance", "Due Date"].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {currentData.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted">
                          <Filter className="w-8 h-8 opacity-30" />
                          <p className="text-sm">No loans due matching your filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentData.map((loan, idx) => (
                      <LoanTableRow
                        key={loan.loanId}
                        loan={loan}
                        index={idx}
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                      />
                    ))
                  )}
                </tbody>

                {/* Grand totals footer */}
                {currentData.length > 0 && (
                  <tfoot className="bg-surface border-t-2 border-border">
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-wide text-right">
                        Grand Totals
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-text-secondary tabular-nums text-sm whitespace-nowrap">
                        {formatCurrency(grandTotals.disbursedAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400 tabular-nums text-sm whitespace-nowrap">
                        {formatCurrency(grandTotals.totalDue)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums text-sm whitespace-nowrap">
                        {formatCurrency(grandTotals.totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-orange-600 dark:text-orange-400 tabular-nums text-sm whitespace-nowrap">
                        {formatCurrency(grandTotals.totalUnpaid)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pagination */}
            {totalRows > itemsPerPage && (
              <div className="px-5 py-4 border-t border-border bg-surface">
                <Pagination
                  totalItems={totalRows}
                  itemsPerPage={itemsPerPage}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanDueReport;