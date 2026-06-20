import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Download,
  Printer,
  Filter,
  X,
  Search,
  RefreshCw,
  TrendingUp,
  Banknote,
  Hash,
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
import { SkeletonTable } from "../../components/Skeleton";
import { Pagination } from "../../components/Pagination";
import CustomSelect from "../../components/CustomSelect";

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(amount || 0);

const getCurrentTimestamp = () => {
  const now = new Date();
  return now.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const LoanTableRow = React.memo(({ row, index }) => (
  <tr className="hover:bg-surface transition-colors duration-150">
    <td className="px-4 py-3 text-center text-muted text-xs">{row.branchNumber}</td>
    <td className="px-4 py-3 font-semibold text-text-primary text-sm">
      {row.isFirstInBranch ? row.branch : ""}
    </td>
    <td className="px-4 py-3 font-medium text-brand text-sm text-right tabular-nums">
      {row.isFirstInBranch ? formatCurrency(row.branchTotalAmount) : ""}
    </td>
    <td className="px-4 py-3 text-text-secondary text-sm">
      {row.isFirstInOfficer ? row.loanOfficer : ""}
    </td>
    <td className="px-4 py-3 text-text-secondary text-sm text-right tabular-nums">
      {row.isFirstInOfficer ? formatCurrency(row.roTotalAmount) : ""}
    </td>
    <td className="px-4 py-3 text-text-primary whitespace-nowrap text-sm font-medium">{row.customerName}</td>
    <td className="px-4 py-3 text-text-secondary whitespace-nowrap text-sm">{row.mobile}</td>
    <td className="px-4 py-3 text-text-secondary whitespace-nowrap text-sm">{row.idNumber}</td>
    <td className="px-4 py-3 text-muted font-mono text-xs">{row.mpesaReference || "N/A"}</td>
    <td className="px-4 py-3 text-muted font-mono text-xs">{row.loanReferenceNumber}</td>
    <td className="px-4 py-3 text-right text-text-primary text-sm tabular-nums">
      {formatCurrency(row.appliedLoanAmount)}
    </td>
    <td className="px-4 py-3 text-right font-bold text-slate-600 text-sm tabular-nums">
      {formatCurrency(row.disbursedAmount)}
    </td>
    <td className="px-4 py-3 text-right text-text-secondary text-sm tabular-nums">
      {formatCurrency(row.interestAmount)}
    </td>
    <td className="px-4 py-3 text-text-secondary whitespace-nowrap text-sm">{row.business_name}</td>
    <td className="px-4 py-3 text-text-secondary whitespace-nowrap text-sm">{row.business_type}</td>
    <td className="px-4 py-3 text-text-secondary whitespace-nowrap text-sm">{row.productName}</td>
    <td className="px-4 py-3 text-text-secondary text-sm whitespace-nowrap">{row.nextPaymentDate}</td>
    <td className="px-4 py-3 text-text-secondary text-sm whitespace-nowrap">{row.disbursementDate}</td>
  </tr>
));
LoanTableRow.displayName = "LoanTableRow";

// ─── Main Component ───────────────────────────────────────────────────────────

const DisbursementLoansReport = () => {
  const [tenant] = useState(() => {
    try {
      const saved = localStorage.getItem("tenant");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const { profile } = useAuth();

  const [rawLoans, setRawLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("disbursement-filters");
      return saved
        ? JSON.parse(saved)
        : {
            search: "",
            branch: "",
            region: "",
            officer: "",
            product: "",
            dateFilter: "today",
            customStartDate: "",
            customEndDate: "",
          };
    } catch {
      return {
        search: "",
        branch: "",
        region: "",
        officer: "",
        product: "",
        dateFilter: "today",
        customStartDate: "",
        customEndDate: "",
      };
    }
  });

  const tenantIdRef = useRef(tenant?.id);
  const itemsPerPage = 10;

  useEffect(() => {
    tenantIdRef.current = tenant?.id;
  }, [tenant]);

  // Persist filters
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem("disbursement-filters", JSON.stringify(filters));
      } catch {}
    }, 500);
    return () => clearTimeout(id);
  }, [filters]);

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenant?.id) { setLoading(false); return; }

    const controller = new AbortController();
    const tenantId = tenant.id;
    const cacheKey = `disbursement-raw-data-${tenantId}`;

    const fetchDisbursedLoans = async () => {
      try {
        setLoading(true);
        setError(null);

        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            setRawLoans(data || []);
            setLoading(false);
            return;
          }
        }

        let query = supabase
          .from("loans")
          .select(`
            id, scored_amount, total_interest, total_payable,
            product_name, product_type, disbursed_at, repayment_state, status,
            branch:branch_id(name, region_id),
            loan_officer:booked_by(full_name),
            customer:customer_id(id, Firstname, Middlename, Surname, mobile, id_number, business_name, business_type),
            installments:loan_installments(due_date, status, loan_id),
            mpesa:loan_disbursement_transactions(transaction_id, loan_id, status)
          `)
          .eq("status", "disbursed")
          .eq("tenant_id", tenantId)
          .order("disbursed_at", { ascending: false })
          .abortSignal(controller.signal);

        if (profile?.role === "relationship_officer") query = query.eq("booked_by", profile.id);
        else if (["branch_manager", "customer_service_officer"].includes(profile?.role)) query = query.eq("branch_id", profile.branch_id);
        else if (profile?.role === "regional_manager") query = query.eq("region_id", profile.region_id);

        const { data: loansData, error: loansError } = await query;
        if (loansError) throw loansError;

        const regionIds = [...new Set(loansData.map((l) => l.branch?.region_id).filter(Boolean))];
        let regionMap = {};
        if (regionIds.length > 0) {
          const { data: regionsData } = await supabase
            .from("regions").select("id, name").in("id", regionIds).eq("tenant_id", tenantId)
            .abortSignal(controller.signal);
          if (regionsData) regionMap = regionsData.reduce((a, r) => ({ ...a, [r.id]: r.name }), {});
        }

        const formatted = loansData.map((loan) => {
          const c = loan.customer || {};
          const fullName = [c.Firstname, c.Middlename, c.Surname].filter(Boolean).join(" ") || "N/A";
          const pending = Array.isArray(loan.installments) ? loan.installments.find((i) => i.status === "pending") : null;
          const mpesaTx = Array.isArray(loan.mpesa) ? loan.mpesa.find((tx) => tx.status === "success") : null;
          return {
            id: loan.id,
            branch: loan.branch?.name || "N/A",
            region: regionMap[loan.branch?.region_id] || "N/A",
            loanOfficer: loan.loan_officer?.full_name || "N/A",
            customerName: fullName,
            mobile: c.mobile || "N/A",
            idNumber: c.id_number || "N/A",
            mpesaReference: mpesaTx?.transaction_id || "N/A",
            loanReferenceNumber: `LN${String(loan.id).padStart(5, "0")}`,
            appliedLoanAmount: loan.scored_amount ?? 0,
            disbursedAmount: loan.total_payable ?? 0,
            interestAmount: loan.total_interest || 0,
            business_name: c.business_name || "N/A",
            business_type: c.business_type || "N/A",
            productName: loan.product_name || loan.product_type || "N/A",
            product_type: loan.product_type || "N/A",
            nextPaymentDate: pending?.due_date ? new Date(pending.due_date).toLocaleDateString() : "N/A",
            disbursementDate: loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : "N/A",
            rawDisbursementDate: loan.disbursed_at,
            repaymentStatus: loan.repayment_state || "N/A",
          };
        });

        setRawLoans(formatted);
        setLoading(false);
        localStorage.setItem(cacheKey, JSON.stringify({ data: formatted, timestamp: Date.now() }));
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load data");
        setLoading(false);
      }
    };

    fetchDisbursedLoans();
    return () => controller.abort();
  }, [tenant?.id, profile?.role, profile?.id, profile?.branch_id, profile?.region_id]);

  // ── Manual refresh ───────────────────────────────────────────────────────
  const handleManualRefresh = async () => {
    const tenantId = tenant?.id;
    if (!tenantId || loading) return;
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("loans")
        .select(`
          id, scored_amount, total_interest, total_payable,
          product_name, product_type, disbursed_at, repayment_state, status,
          branch:branch_id(name, region_id),
          loan_officer:booked_by(full_name),
          customer:customer_id(id, Firstname, Middlename, Surname, mobile, id_number, business_name, business_type),
          installments:loan_installments(due_date, status, loan_id),
          mpesa:loan_disbursement_transactions(transaction_id, loan_id, status)
        `)
        .eq("status", "disbursed")
        .eq("tenant_id", tenantId)
        .order("disbursed_at", { ascending: false });

      if (profile?.role === "relationship_officer") query = query.eq("booked_by", profile.id);
      else if (["branch_manager", "customer_service_officer"].includes(profile?.role)) query = query.eq("branch_id", profile.branch_id);
      else if (profile?.role === "regional_manager") query = query.eq("region_id", profile.region_id);

      const { data: loansData, error: loansError } = await query;
      if (loansError) throw loansError;

      const regionIds = [...new Set(loansData.map((l) => l.branch?.region_id).filter(Boolean))];
      let regionMap = {};
      if (regionIds.length > 0) {
        const { data: regionsData } = await supabase
          .from("regions").select("id, name").in("id", regionIds).eq("tenant_id", tenantId);
        if (regionsData) regionMap = regionsData.reduce((a, r) => ({ ...a, [r.id]: r.name }), {});
      }

      const formatted = loansData.map((loan) => {
        const c = loan.customer || {};
        const fullName = [c.Firstname, c.Middlename, c.Surname].filter(Boolean).join(" ") || "N/A";
        const pending = Array.isArray(loan.installments) ? loan.installments.find((i) => i.status === "pending") : null;
        const mpesaTx = Array.isArray(loan.mpesa) ? loan.mpesa.find((tx) => tx.status === "success") : null;
        return {
          id: loan.id,
          branch: loan.branch?.name || "N/A",
          region: regionMap[loan.branch?.region_id] || "N/A",
          loanOfficer: loan.loan_officer?.full_name || "N/A",
          customerName: fullName,
          mobile: c.mobile || "N/A",
          idNumber: c.id_number || "N/A",
          mpesaReference: mpesaTx?.transaction_id || "N/A",
          loanReferenceNumber: `LN${String(loan.id).padStart(5, "0")}`,
          appliedLoanAmount: loan.scored_amount ?? 0,
          disbursedAmount: loan.total_payable ?? 0,
          interestAmount: loan.total_interest || 0,
          business_name: c.business_name || "N/A",
          business_type: c.business_type || "N/A",
          productName: loan.product_name || loan.product_type || "N/A",
          product_type: loan.product_type || "N/A",
          nextPaymentDate: pending?.due_date ? new Date(pending.due_date).toLocaleDateString() : "N/A",
          disbursementDate: loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : "N/A",
          rawDisbursementDate: loan.disbursed_at,
          repaymentStatus: loan.repayment_state || "N/A",
        };
      });

      setRawLoans(formatted || []);
      localStorage.setItem(`disbursement-raw-data-${tenantId}`, JSON.stringify({ data: formatted || [], timestamp: Date.now() }));
    } catch (err) {
      setError(err.message || "Failed to refresh data");
    } finally {
      setLoading(false);
    }
  };

  // ── Date range ───────────────────────────────────────────────────────────
  const getDateRange = (filter) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start, end;
    switch (filter) {
      case "today": start = new Date(today); end = new Date(today); end.setHours(23, 59, 59, 999); break;
      case "week": start = new Date(today); start.setDate(start.getDate() - start.getDay()); end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999); break;
      case "month": start = new Date(today.getFullYear(), today.getMonth(), 1); end = new Date(today.getFullYear(), today.getMonth() + 1, 0); end.setHours(23, 59, 59, 999); break;
      case "quarter": { const q = Math.floor(today.getMonth() / 3); start = new Date(today.getFullYear(), q * 3, 1); end = new Date(today.getFullYear(), (q + 1) * 3, 0); end.setHours(23, 59, 59, 999); break; }
      case "year": start = new Date(today.getFullYear(), 0, 1); end = new Date(today.getFullYear(), 11, 31); end.setHours(23, 59, 59, 999); break;
      case "custom": start = filters.customStartDate ? new Date(filters.customStartDate) : new Date(0); start.setHours(0, 0, 0, 0); end = filters.customEndDate ? new Date(filters.customEndDate) : new Date(); end.setHours(23, 59, 59, 999); break;
      default: return null;
    }
    return { start, end };
  };

  // ── Group for display ────────────────────────────────────────────────────
  const groupLoansForDisplay = (loans) => {
    const branchTotals = {};
    const officerTotals = {};
    loans.forEach((loan) => {
      branchTotals[loan.branch] = (branchTotals[loan.branch] || 0) + (loan.disbursedAmount || 0);
      const ok = `${loan.branch}-${loan.loanOfficer}`;
      officerTotals[ok] = (officerTotals[ok] || 0) + (loan.disbursedAmount || 0);
    });
    const grouped = {};
    loans.forEach((loan) => {
      if (!grouped[loan.branch]) grouped[loan.branch] = { branch: loan.branch, totalAmount: branchTotals[loan.branch] || 0, officers: {} };
      const ok = `${loan.branch}-${loan.loanOfficer}`;
      if (!grouped[loan.branch].officers[loan.loanOfficer]) grouped[loan.branch].officers[loan.loanOfficer] = { officer: loan.loanOfficer, roTotalAmount: officerTotals[ok] || 0, customers: [] };
      grouped[loan.branch].officers[loan.loanOfficer].customers.push(loan);
    });
    return grouped;
  };

  // ── Filtered & sorted data ───────────────────────────────────────────────
  const filteredData = useMemo(() => {
    let result = [...rawLoans];
    const q = (filters.search || "").toLowerCase();

    if (q) {
      result = result.filter((i) =>
        (i.customerName || "").toLowerCase().includes(q) ||
        (i.loanReferenceNumber || "").toLowerCase().includes(q) ||
        String(i.mobile || "").includes(q) ||
        String(i.idNumber || "").includes(q)
      );
    }
    if (filters.branch) result = result.filter((i) => i.branch === filters.branch);
    if (filters.region) result = result.filter((i) => i.region === filters.region);
    if (filters.officer) result = result.filter((i) => i.loanOfficer === filters.officer);
    if (filters.product) result = result.filter((i) => i.productName === filters.product);

    if (filters.dateFilter !== "all") {
      const range = getDateRange(filters.dateFilter);
      if (range) result = result.filter((i) => {
        if (!i.rawDisbursementDate) return false;
        const d = new Date(i.rawDisbursementDate);
        return d >= range.start && d <= range.end;
      });
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        const av = a[sortConfig.key], bv = b[sortConfig.key];
        if (av < bv) return sortConfig.direction === "asc" ? -1 : 1;
        if (av > bv) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [rawLoans, filters, sortConfig]);

  const groupedData = useMemo(() => groupLoansForDisplay(filteredData), [filteredData]);

  // ── Dropdown options ─────────────────────────────────────────────────────
  const branches = useMemo(() => [...new Set(rawLoans.map((i) => i.branch).filter((b) => b && b !== "N/A"))], [rawLoans]);
  const officers = useMemo(() => [...new Set(rawLoans.map((i) => i.loanOfficer).filter((o) => o && o !== "N/A"))], [rawLoans]);
  const products = useMemo(() => [...new Set(rawLoans.map((i) => i.productName).filter((p) => p && p !== "N/A"))], [rawLoans]);
  const regions = useMemo(() => [...new Set(rawLoans.map((i) => i.region).filter((r) => r && r !== "N/A"))], [rawLoans]);

  const dateFilterOptions = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "quarter", label: "This Quarter" },
    { value: "year", label: "This Year" },
    { value: "custom", label: "Custom Range" },
  ];

  const exportFormatOptions = [
    { value: "csv", label: "CSV" },
    { value: "excel", label: "Excel" },
    { value: "word", label: "Word" },
    { value: "pdf", label: "PDF" },
  ];

  // ── Pagination over flattened grouped rows ───────────────────────────────
  const { totalRows, currentData } = useMemo(() => {
    let allRows = [];
    let globalIndex = 0;
    let branchNumber = 1;

    Object.values(groupedData).forEach((branch) => {
      let isFirstOfficerInBranch = true;
      Object.values(branch.officers).forEach((officer) => {
        officer.customers.forEach((customer, customerIndex) => {
          globalIndex++;
          if (globalIndex > (currentPage - 1) * itemsPerPage && globalIndex <= currentPage * itemsPerPage) {
            allRows.push({
              ...customer,
              branch: branch.branch,
              branchTotalAmount: branch.totalAmount,
              loanOfficer: officer.officer,
              roTotalAmount: officer.roTotalAmount,
              branchNumber: customerIndex === 0 && isFirstOfficerInBranch ? branchNumber : "",
              isFirstInBranch: customerIndex === 0 && isFirstOfficerInBranch,
              isFirstInOfficer: customerIndex === 0,
            });
          }
        });
        isFirstOfficerInBranch = false;
      });
      branchNumber++;
    });

    return { totalRows: globalIndex, currentData: allRows };
  }, [groupedData, currentPage]);

  // ── Summary stats ────────────────────────────────────────────────────────
  const summaryStats = useMemo(() => ({
    totalPayable: filteredData.reduce((s, i) => s + (i.disbursedAmount || 0), 0),
    totalPrincipal: filteredData.reduce((s, i) => s + (i.appliedLoanAmount || 0), 0),
    totalLoans: filteredData.length,
  }), [filteredData]);

  // ── Filter helpers ───────────────────────────────────────────────────────
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ search: "", branch: "", region: "", officer: "", product: "", dateFilter: "today", customStartDate: "", customEndDate: "" });
    setCurrentPage(1);
  };

  const hasActiveFilters = filters.search || filters.region || filters.branch || filters.officer || filters.product || filters.dateFilter !== "all";

  // ── Export functions (unchanged logic) ──────────────────────────────────
  const exportToPDF = () => {
    if (!filteredData.length) return alert("No data to export");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`${tenant?.company_name || "Company"} - Loan Disbursement Report`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${getCurrentTimestamp()}`, 14, 22);
    const headers = [["No.", "Branch", "Total", "Officer", "RO Total", "Customer", "Mobile", "ID", "Mpesa Ref", "Loan Ref", "Applied", "Disbursed", "Interest", "Business", "Type", "Product", "Next Payment", "Disb. Date"]];
    const gd = groupLoansForDisplay(filteredData);
    const rows = []; let bn = 1;
    Object.values(gd).forEach((branch) => {
      Object.values(branch.officers).forEach((officer) => {
        officer.customers.forEach((c, i) => {
          rows.push([i === 0 ? bn : "", i === 0 ? branch.branch : "", i === 0 ? formatCurrency(branch.totalAmount) : "", i === 0 ? officer.officer : "", i === 0 ? formatCurrency(officer.roTotalAmount) : "", c.customerName, c.mobile, c.idNumber, c.mpesaReference, c.loanReferenceNumber, formatCurrency(c.appliedLoanAmount), formatCurrency(c.disbursedAmount), formatCurrency(c.interestAmount), c.business_name, c.business_type, c.productName, c.nextPaymentDate, c.disbursementDate]);
        });
      }); bn++;
    });
    autoTable(doc, { head: headers, body: rows, startY: 28, styles: { fontSize: 7 } });
    doc.save(`loan-disbursement-report-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const exportToExcel = () => {
    if (!filteredData.length) return alert("No data to export");
    const ws = XLSX.utils.json_to_sheet(filteredData.map((d, i) => ({ No: i + 1, Branch: d.branch, "Loan Officer": d.loanOfficer, "Customer Name": d.customerName, Mobile: d.mobile, "ID Number": d.idNumber, "Mpesa Reference": d.mpesaReference, "Loan Ref": d.loanReferenceNumber, "Applied Amount": d.appliedLoanAmount, "Disbursed Amount": d.disbursedAmount, "Interest Amount": d.interestAmount, "Business Name": d.business_name, "Business Type": d.business_type, Product: d.productName, "Next Payment Date": d.nextPaymentDate, "Disbursement Date": d.disbursementDate })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Disbursement Report");
    const slug = (tenant?.company_name || "Company").toLowerCase().replace(/ /g, "-");
    XLSX.writeFile(wb, `${slug}-disbursement-report-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportToCSV = () => {
    if (!filteredData.length) return alert("No data to export");
    const headers = ["No.", "Branch Name", "Total Amount", "Loan Officer", "RO Total Amount", "Customer Name", "Mobile Number", "ID Number", "Mpesa Reference", "Loan Reference Number", "Applied Loan Amount", "Disbursed Amount", "Interest Amount", "Business Name", "Business Type", "Product", "Next Payment Date", "Disbursement Date"];
    const gd = groupLoansForDisplay(filteredData);
    let flat = []; let bn = 1;
    Object.values(gd).forEach((branch) => {
      Object.values(branch.officers).forEach((officer) => {
        officer.customers.forEach((c, i) => {
          flat.push([i === 0 ? bn : "", i === 0 ? branch.branch : "", i === 0 ? formatCurrency(branch.totalAmount) : "", i === 0 ? officer.officer : "", i === 0 ? formatCurrency(officer.roTotalAmount) : "", c.customerName, c.mobile, c.idNumber, c.mpesaReference, c.loanReferenceNumber, formatCurrency(c.appliedLoanAmount), formatCurrency(c.disbursedAmount), formatCurrency(c.interestAmount), c.business_name, c.business_type, c.productName, c.nextPaymentDate, c.disbursementDate]);
        });
      }); bn++;
    });
    const csv = [headers.join(","), ...flat.map((row) => row.map((f) => (typeof f === "string" && f.includes(",") ? `"${f}"` : f)).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = (tenant?.company_name || "Company").toLowerCase().replace(/ /g, "-");
    a.download = `${slug}-disbursement-report-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToWord = async () => {
    if (!filteredData.length) return alert("No data to export");
    const rows = filteredData.map((d, i) => new TableRow({ children: [new TableCell({ children: [new Paragraph(String(i + 1))] }), new TableCell({ children: [new Paragraph(d.branch)] }), new TableCell({ children: [new Paragraph(d.loanOfficer)] }), new TableCell({ children: [new Paragraph(d.customerName)] }), new TableCell({ children: [new Paragraph(String(d.mobile))] }), new TableCell({ children: [new Paragraph(d.loanReferenceNumber)] }), new TableCell({ children: [new Paragraph(formatCurrency(d.disbursedAmount))] })] }));
    const doc = new Document({ sections: [{ properties: {}, children: [new Paragraph({ children: [new TextRun({ text: `${tenant?.company_name || "Company"} - Loan Disbursement Report`, bold: true, size: 28 })] }), new Paragraph({ children: [new TextRun({ text: `Generated on: ${getCurrentTimestamp()}`, italics: true, size: 22 })] }), new Paragraph(" "), new Table({ rows: [new TableRow({ children: ["No.", "Branch", "Loan Officer", "Customer Name", "Mobile", "Loan Ref", "Disbursed Amount"].map((h) => new TableCell({ children: [new Paragraph({ text: h, bold: true })] })) }), ...rows] })] }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `loan-disbursement-report-${new Date().toISOString().split("T")[0]}.docx`);
  };

  const handleExport = () => {
    switch (exportFormat) {
      case "pdf": exportToPDF(); break;
      case "word": exportToWord(); break;
      case "excel": exportToExcel(); break;
      default: exportToCSV(); break;
    }
  };

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
            
            <h1 className="text-sm font-bold text-muted mt-0.5">
              Disbursed Loans Report
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
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

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border shadow-card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-brand" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">Total Payable</p>
              <p className="text-xl font-bold text-text-primary tabular-nums mt-0.5">
                {formatCurrency(summaryStats.totalPayable)}
              </p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">Total Principal</p>
              <p className="text-xl font-bold text-text-primary tabular-nums mt-0.5">
                {formatCurrency(summaryStats.totalPrincipal)}
              </p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
              <Hash className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">Number of Loans</p>
              <p className="text-xl font-bold text-text-primary tabular-nums mt-0.5">
                {summaryStats.totalLoans.toLocaleString()}
              </p>
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
                  onClick={clearFilters}
                  className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-medium"
                >
                  <X className="w-3.5 h-3.5" /> Clear all
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Date filter */}
              <CustomSelect
                options={dateFilterOptions}
                value={filters.dateFilter}
                onChange={(v) => handleFilterChange("dateFilter", v)}
                placeholder="Date Range"
              />

              {/* Region */}
              {!["regional_manager", "branch_manager", "customer_service_officer", "relationship_officer"].includes(profile?.role) && (
                <CustomSelect
                  options={[{ value: "", label: "All Regions" }, ...regions.map((r) => ({ value: r, label: r }))]}
                  value={filters.region}
                  onChange={(v) => handleFilterChange("region", v)}
                  placeholder="All Regions"
                />
              )}

              {/* Branch */}
              {!["branch_manager", "customer_service_officer", "relationship_officer"].includes(profile?.role) && (
                <CustomSelect
                  options={[{ value: "", label: "All Branches" }, ...branches.map((b) => ({ value: b, label: b }))]}
                  value={filters.branch}
                  onChange={(v) => handleFilterChange("branch", v)}
                  placeholder="All Branches"
                />
              )}

              {/* Officer */}
              {profile?.role !== "relationship_officer" && (
                <CustomSelect
                  options={[{ value: "", label: "All Officers" }, ...officers.map((o) => ({ value: o, label: o }))]}
                  value={filters.officer}
                  onChange={(v) => handleFilterChange("officer", v)}
                  placeholder="All Officers"
                />
              )}

              {/* Product */}
              <CustomSelect
                options={[{ value: "", label: "All Products" }, ...products.map((p) => ({ value: p, label: p }))]}
                value={filters.product}
                onChange={(v) => handleFilterChange("product", v)}
                placeholder="All Products"
              />
            </div>

            {/* Custom date pickers */}
            {filters.dateFilter === "custom" && (
              <div className="flex flex-wrap gap-3 pt-1">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted font-medium">From</label>
                  <input
                    type="date"
                    value={filters.customStartDate}
                    onChange={(e) => handleFilterChange("customStartDate", e.target.value)}
                    className="bg-surface border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted font-medium">To</label>
                  <input
                    type="date"
                    value={filters.customEndDate}
                    onChange={(e) => handleFilterChange("customEndDate", e.target.value)}
                    className="bg-surface border border-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Table ── */}
        {loading ? (
          <SkeletonTable rows={8} cols={8} />
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    {[
                      "No.", "Branch Name", "Total Amount", "Loan Officer", "RO Total",
                      "Customer Name", "Mobile", "ID Number", "Mpesa Ref", "Loan Ref",
                      "Applied", "Disbursed", "Interest",
                      "Business", "Type", "Product", "Next Payment", "Disbursement Date"
                    ].map((h, idx) => (
                      <th
                        key={idx}
                        className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {currentData.length === 0 ? (
                    <tr>
                      <td colSpan={18} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted">
                          <Filter className="w-8 h-8 opacity-30" />
                          <p className="text-sm">No disbursed loans found matching your filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentData.map((row, index) => (
                      <LoanTableRow key={`${row.id}-${index}`} row={row} index={index} />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination footer ── */}
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

export default DisbursementLoansReport;