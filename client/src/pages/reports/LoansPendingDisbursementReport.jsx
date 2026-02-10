import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Download, Filter, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Search, Printer } from "lucide-react";
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

const PendingDisbursementReport = () => {
  const { tenant } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [sortConfig, setSortConfig] = useState({ key: "booked_at", direction: "desc" });
  const [exportFormat, setExportFormat] = useState("csv");

  const [regions, setRegions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [allOfficers, setAllOfficers] = useState([]);
  const [allProducts, setAllProducts] = useState([]);

  const [filters, setFilters] = useState({
    search: localStorage.getItem("pending_disb_search") || "",
    region: localStorage.getItem("pending_disb_region") || "",
    branch: localStorage.getItem("pending_disb_branch") || "",
    loanOfficer: localStorage.getItem("pending_disb_officer") || "",
    product: localStorage.getItem("pending_disb_product") || "",
    status: localStorage.getItem("pending_disb_status") || "all",
  });

  const [dateFilter, setDateFilter] = useState(localStorage.getItem("pending_disb_date_filter") || "all");
  const [customStartDate, setCustomStartDate] = useState(localStorage.getItem("pending_disb_start_date") || "");
  const [customEndDate, setCustomEndDate] = useState(localStorage.getItem("pending_disb_end_date") || "");

  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem("pending_disb_search", filters.search);
    localStorage.setItem("pending_disb_region", filters.region);
    localStorage.setItem("pending_disb_branch", filters.branch);
    localStorage.setItem("pending_disb_officer", filters.loanOfficer);
    localStorage.setItem("pending_disb_product", filters.product);
    localStorage.setItem("pending_disb_status", filters.status);
    localStorage.setItem("pending_disb_date_filter", dateFilter);
    localStorage.setItem("pending_disb_start_date", customStartDate);
    localStorage.setItem("pending_disb_end_date", customEndDate);
  }, [filters, dateFilter, customStartDate, customEndDate]);

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      setLoading(true);

      const [loansRes, customersRes, usersRes, branchesRes, regionsRes] = await Promise.all([
        supabase
          .from("loans")
          .select(`
            id, 
            customer_id, 
            booked_by, 
            branch_id, 
            region_id,
            product_name, 
            product_type,
            scored_amount, 
            processing_fee,
            registration_fee,
            total_payable,
            weekly_payment,
            duration_weeks,
            interest_rate,
            booked_at,
            approved_by_bm,
            approved_by_bm_at,
            approved_by_rm,
            approved_by_rm_at,
            bm_decision,
            rm_decision,
            status
          `)
          .eq("status", "ca_review")
          .eq("tenant_id", tenant?.id),
        supabase.from("customers").select("id, Firstname, Middlename, Surname, id_number, mobile").eq("tenant_id", tenant?.id),
        supabase.from("users").select("id, full_name, role, branch_id").eq("tenant_id", tenant?.id),
        supabase.from("branches").select("id, name, region_id").eq("tenant_id", tenant?.id),
        supabase.from("regions").select("id, name").eq("tenant_id", tenant?.id),
      ]);

      if (loansRes.error) throw loansRes.error;

      const loans = loansRes.data || [];
      const customers = customersRes.data || [];
      const users = usersRes.data || [];
      const branchData = branchesRes.data || [];
      const regionData = regionsRes.data || [];

      setRegions(regionData);
      setBranches(branchData);
      setAllOfficers(users.filter(u => u.role === 'relationship_officer'));

      const mappedLoans = loans.map((loan) => {
        const customer = customers.find((c) => c.id === loan.customer_id);
        const officer = users.find((u) => u.id === loan.booked_by);
        const branch = branchData.find((b) => b.id === loan.branch_id);
        const region = regionData.find((r) => r.id === loan.region_id);

        const scoredAmount = Number(loan.scored_amount) || 0;
        const processingFee = Number(loan.processing_fee) || 0;
        const registrationFee = Number(loan.registration_fee) || 0;
        const netDisbursement = scoredAmount - processingFee - registrationFee;

        const bookedDate = loan.booked_at ? new Date(loan.booked_at) : null;

        const fullName = customer
          ? `${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim()
          : "N/A";

        return {
          ...loan,
          customer_name: fullName,
          customer_id_num: customer?.id_number || "N/A",
          mobile: customer?.mobile || "N/A",
          branch_name: branch?.name || "N/A",
          region_name: region?.name || "N/A",
          officer_name: officer?.full_name || "N/A",
          net_disbursement: netDisbursement,
          booked_at_date: bookedDate,
        };
      });

      setReports(mappedLoans);
      setAllProducts([...new Set(mappedLoans.map(l => l.product_name).filter(Boolean))]);
    } catch (err) {
      console.error("Error fetching report data:", err);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper functions
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);

  const getCurrentTimestamp = () => {
    const now = new Date();
    return now.toLocaleString("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getDateRange = useCallback((filter) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start, end;

    switch (filter) {
      case "today":
        start = new Date(today);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case "week":
        start = new Date(today);
        start.setDate(start.getDate() - start.getDay());
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case "month":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "quarter":
        const currentQuarter = Math.floor(today.getMonth() / 3);
        start = new Date(today.getFullYear(), currentQuarter * 3, 1);
        end = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "year":
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
        break;
      case "custom":
        start = customStartDate ? new Date(customStartDate) : new Date(0);
        start.setHours(0, 0, 0, 0);
        end = customEndDate ? new Date(customEndDate) : new Date();
        end.setHours(23, 59, 59, 999);
        break;
      default:
        return null;
    }
    return { start, end };
  }, [customStartDate, customEndDate]);

  // Filtering Logic
  const filteredData = useMemo(() => {
    let result = [...reports];
    const q = filters.search.toLowerCase();

    if (filters.search) {
      result = result.filter((i) =>
        i.customer_name.toLowerCase().includes(q) ||
        i.mobile.includes(q) ||
        i.customer_id_num.includes(q)
      );
    }

    if (filters.region) result = result.filter((i) => i.region_id === filters.region);
    if (filters.branch) result = result.filter((i) => i.branch_id === filters.branch);
    if (filters.loanOfficer) result = result.filter((i) => i.booked_by === filters.loanOfficer);
    if (filters.product) result = result.filter((i) => i.product_name === filters.product);
    if (filters.status !== "all") result = result.filter((i) => i.status === filters.status);

    if (dateFilter !== "all") {
      const range = getDateRange(dateFilter);
      if (range) {
        result = result.filter((i) => {
          if (!i.booked_at_date) return false;
          return i.booked_at_date >= range.start && i.booked_at_date <= range.end;
        });
      }
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'customer_name') {
          aVal = aVal?.toLowerCase() || '';
          bVal = bVal?.toLowerCase() || '';
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [reports, filters, dateFilter, sortConfig, getDateRange]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ search: "", region: "", branch: "", loanOfficer: "", product: "", status: "all" });
    setDateFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setCurrentPage(1);
  };

  const getFilteredBranches = () => {
    if (!filters.region) return branches;
    return branches.filter(b => b.region_id === filters.region);
  };

  const getFilteredOfficers = () => {
    if (filters.branch) return allOfficers.filter(o => o.branch_id === filters.branch);
    if (filters.region) {
      const regionBranches = branches.filter(b => b.region_id === filters.region).map(b => b.id);
      return allOfficers.filter(o => regionBranches.includes(o.branch_id));
    }
    return allOfficers;
  };

  const groupDataByHierarchy = (data) => {
    const grouped = {};
    data.forEach(item => {
      const branchName = item.branch_name;
      const officerName = item.officer_name;

      if (!grouped[branchName]) {
        grouped[branchName] = { officers: {}, totalDisbursement: 0 };
      }
      if (!grouped[branchName].officers[officerName]) {
        grouped[branchName].officers[officerName] = { loans: [], totalDisbursement: 0 };
      }

      grouped[branchName].officers[officerName].loans.push(item);
      grouped[branchName].officers[officerName].totalDisbursement += item.net_disbursement;
      grouped[branchName].totalDisbursement += item.net_disbursement;
    });
    return grouped;
  };

  // Export functions
  const handleExport = async () => {
    if (filteredData.length === 0) return alert("No data to export");
    const timestamp = new Date().toISOString().split("T")[0];
    const companySlug = (tenant?.company_name || "Jasiri").toLowerCase().replace(/ /g, '-');
    const filename = `${companySlug}-pending-disbursement-${timestamp}`;

    switch (exportFormat) {
      case "pdf":
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(14);
        doc.text(`${tenant?.company_name || "Jasiri Capital"} - Pending Disbursement Report`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated on: ${getCurrentTimestamp()}`, 14, 22);

        const tableHeaders = [
          ["No", "Customer Name", "ID Number", "Mobile", "Branch", "Officer", "Product", "Scored Amount", "Net Disbursement", "Booked Date"]
        ];

        const tableRows = filteredData.map((r, i) => [
          i + 1,
          r.customer_name,
          r.customer_id_num,
          r.mobile,
          r.branch_name,
          r.officer_name,
          r.product_name,
          formatCurrency(r.scored_amount),
          formatCurrency(r.net_disbursement),
          r.booked_at_date ? r.booked_at_date.toLocaleDateString() : "N/A"
        ]);

        autoTable(doc, {
          head: tableHeaders,
          body: tableRows,
          startY: 28,
          styles: { fontSize: 8 },
        });

        doc.save(`${filename}.pdf`);
        break;

      case "excel":
        const ws = XLSX.utils.json_to_sheet(filteredData.map((r, i) => ({
          No: i + 1,
          "Customer Name": r.customer_name,
          "ID Number": r.customer_id_num,
          "Mobile": r.mobile,
          "Branch": r.branch_name,
          "Region": r.region_name,
          "Loan Officer": r.officer_name,
          "Product": r.product_name,
          "Scored Amount": r.scored_amount,
          "Processing Fee": r.processing_fee,
          "Registration Fee": r.registration_fee,
          "Net Disbursement": r.net_disbursement,
          "Status": r.status,
          "Booked Date": r.booked_at_date ? r.booked_at_date.toLocaleDateString() : "N/A"
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pending Disbursement");
        XLSX.writeFile(wb, `${filename}.xlsx`);
        break;

      case "word":
        const wordRows = filteredData.map((r, i) => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(String(i + 1))] }),
            new TableCell({ children: [new Paragraph(r.customer_name)] }),
            new TableCell({ children: [new Paragraph(r.branch_name)] }),
            new TableCell({ children: [new Paragraph(formatCurrency(r.net_disbursement))] }),
            new TableCell({ children: [new Paragraph(r.status)] }),
          ]
        }));

        const wordDoc = new Document({
          sections: [{
            children: [
              new Paragraph({ text: `${tenant?.company_name || "Jasiri Capital"} - Pending Disbursement`, bold: true, size: 28 }),
              new Paragraph(`Generated on: ${getCurrentTimestamp()}`),
              new Paragraph(" "),
              new Table({
                rows: [
                  new TableRow({
                    children: ["No", "Customer", "Branch", "Net Disbursement", "Status"].map(h => new TableCell({ children: [new Paragraph({ text: h, bold: true })] }))
                  }),
                  ...wordRows
                ]
              })
            ]
          }]
        });

        const blob = await Packer.toBlob(wordDoc);
        saveAs(blob, `${filename}.docx`);
        break;

      case "csv":
      default:
        const csvHeaders = ["No", "Customer Name", "ID Number", "Mobile", "Branch", "Region", "Officer", "Product", "Scored Amount", "Net Disbursement", "Status", "Booked Date"];
        const csvRows = filteredData.map((r, i) => [
          i + 1,
          `"${r.customer_name}"`,
          r.customer_id_num,
          r.mobile,
          r.branch_name,
          r.region_name,
          r.officer_name,
          `"${r.product_name}"`,
          r.scored_amount,
          r.net_disbursement,
          r.status,
          r.booked_at_date ? r.booked_at_date.toLocaleDateString() : "N/A"
        ]);

        const csvContent = [csvHeaders.join(","), ...csvRows.map(row => row.join(","))].join("\n");
        const csvBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        saveAs(csvBlob, `${filename}.csv`);
        break;
    }
  };

  // Display logic for table grouping
  const displayData = useMemo(() => {
    const sorted = [...filteredData];
    const result = [];
    let branchCounter = 0;

    const branchesGrp = {};
    sorted.forEach(item => {
      if (!branchesGrp[item.branch_name]) {
        branchesGrp[item.branch_name] = { officers: {}, total: 0, count: 0 };
      }
      if (!branchesGrp[item.branch_name].officers[item.officer_name]) {
        branchesGrp[item.branch_name].officers[item.officer_name] = { loans: [], total: 0 };
      }
      branchesGrp[item.branch_name].officers[item.officer_name].loans.push(item);
      branchesGrp[item.branch_name].officers[item.officer_name].total += item.net_disbursement;
      branchesGrp[item.branch_name].total += item.net_disbursement;
    });

    Object.keys(branchesGrp).sort().forEach(bName => {
      branchCounter++;
      const bObj = branchesGrp[bName];
      let isFirstInBranch = true;

      Object.keys(bObj.officers).sort().forEach(oName => {
        const oObj = bObj.officers[oName];
        let isFirstInOfficer = true;

        oObj.loans.forEach(loan => {
          result.push({
            ...loan,
            branchNumber: branchCounter,
            isFirstInBranch,
            isFirstInOfficer,
            branchTotalAmount: bObj.total,
            roTotalAmount: oObj.total,
            branchName: bName,
            officerName: oName
          });
          isFirstInBranch = false;
          isFirstInOfficer = false;
        });
      });
    });

    return result;
  }, [filteredData]);

  const totalPages = Math.ceil(displayData.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = displayData.slice(startIdx, startIdx + itemsPerPage);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalAmount = filteredData.reduce((sum, r) => sum + r.scored_amount, 0);
    const totalNet = filteredData.reduce((sum, r) => sum + r.net_disbursement, 0);
    const totalFees = filteredData.reduce((sum, r) => sum + r.processing_fee + r.registration_fee, 0);
    return { totalAmount, totalNet, totalFees, count: filteredData.length };
  }, [filteredData]);

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

  return (
    <div className="min-h-screen bg-brand-surface p-4 sm:p-6 lg:p-8">
      <div className="max-w-full mx-auto space-y-8">

        {/* COMPACT HEADER */}
        <div className="bg-brand-secondary rounded-xl shadow-md border border-gray-200 p-4 overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {tenant?.logo_url ? (
                <img src={tenant.logo_url} alt="Company Logo" className="h-12 w-auto object-contain" />
              ) : (
                <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 font-bold text-lg">
                  {tenant?.company_name?.charAt(0) || "C"}
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">{tenant?.company_name || "Jasiri Capital"}</h1>
                <h2 className="text-sm font-semibold text-white/90">Pending Disbursement Report</h2>
              </div>
            </div>

            {/* CONSOLIDATED CONTROLS */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name, ID..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-lg bg-gray-50 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm w-48 lg:w-64 transition-all"
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border ${showFilters
                  ? "bg-accent text-white border-transparent"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>

              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="bg-transparent text-sm font-medium text-gray-700 px-2 py-1 focus:outline-none cursor-pointer"
                >
                  {exportFormatOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <button
                  onClick={handleExport}
                  className="ml-1 px-3 py-1.5 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-amber-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Total Scored Amount</p>
            <p className="text-2xl font-bold mt-1 text-primary">
              {formatCurrency(summaryStats.totalAmount)}
            </p>
          </div>

          <div className="bg-emerald-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Net Disbursement</p>
            <p className="text-2xl font-bold mt-1 text-accent">
              {formatCurrency(summaryStats.totalNet)}
            </p>
          </div>

          <div className="bg-red-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Total Fees</p>
            <p className="text-2xl font-bold mt-1 text-red-600">
              {formatCurrency(summaryStats.totalFees)}
            </p>
          </div>

          <div className="bg-purple-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted font-medium">Number of Loans</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">PENDING</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-gray-900">
              {summaryStats.count}
            </p>
          </div>
        </div>

        {/* FILTER PANEL */}
        {showFilters && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Filter className="w-4 h-4 text-brand-primary" />
                Advanced Filtering
              </h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Date Range</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                >
                  {dateFilterOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>

              {dateFilter === "custom" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Start Date</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">End Date</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Region</label>
                <select
                  value={filters.region}
                  onChange={(e) => {
                    handleFilterChange("region", e.target.value);
                    handleFilterChange("branch", "");
                    handleFilterChange("loanOfficer", "");
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                >
                  <option value="">All Regions</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Branch</label>
                <select
                  value={filters.branch}
                  onChange={(e) => {
                    handleFilterChange("branch", e.target.value);
                    handleFilterChange("loanOfficer", "");
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                >
                  <option value="">All Branches</option>
                  {getFilteredBranches().map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Officer</label>
                <select
                  value={filters.loanOfficer}
                  onChange={(e) => handleFilterChange("loanOfficer", e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                >
                  <option value="">All Officers</option>
                  {getFilteredOfficers().map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Product</label>
                <select
                  value={filters.product}
                  onChange={(e) => handleFilterChange("product", e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                >
                  <option value="">All Products</option>
                  {allProducts.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={clearFilters}
                className="text-sm font-semibold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1.5 ml-1"
              >
                <X className="w-4 h-4" />
                Clear All Filters
              </button>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Showing {filteredData.length} matches
              </p>
            </div>
          </div>
        )}

        {/* Standardized Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-slate-500 mt-4 font-medium italic">Preparing disbursement data...</p>
            </div>
          ) : displayData.length === 0 ? (
            <div className="p-12 text-center">
              <div className="bg-slate-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">No pending disbursements found.</p>
              <button
                onClick={clearFilters}
                className="mt-4 text-brand-primary font-bold text-sm hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-center w-12">No.</th>
                    <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px]">Branch</th>
                    <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-right">Branch Total</th>
                    <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px]">Relationship Officer</th>
                    <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-right">RO Total</th>
                    <th className="px-4 py-4 font-black text-brand-primary uppercase tracking-wider text-[11px]">Customer Details</th>
                    <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-right">Net Amount</th>
                    <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px]">Product</th>
                    <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-center">Status</th>
                    <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-right">Booked At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.map((row, idx) => (
                    <tr key={`${row.id}-${idx}`} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 text-center text-slate-400 font-medium">{row.branchNumber}</td>
                      <td className="px-4 py-4 font-bold text-slate-900">
                        {row.isFirstInBranch ? row.branchName : ""}
                      </td>
                      <td className="px-4 py-4 text-right font-black text-slate-900 bg-slate-50/30">
                        {row.isFirstInBranch ? formatCurrency(row.branchTotalAmount) : ""}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-600">
                        {row.isFirstInOfficer ? row.officerName : ""}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-slate-600">
                        {row.isFirstInOfficer ? formatCurrency(row.roTotalAmount) : ""}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{row.customer_name}</span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {row.customer_id_num} • {row.mobile}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-black text-accent">
                        {formatCurrency(row.net_disbursement)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700">{row.product_name}</span>
                          <span className="text-[10px] text-slate-400 font-medium uppercase">{row.product_type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-tighter">
                          {row.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-slate-500 font-medium tabular-nums">
                        {row.booked_at_date ? row.booked_at_date.toLocaleDateString() : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {displayData.length > itemsPerPage && (
            <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1
                        ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-110"
                        : "bg-white text-slate-400 hover:text-slate-600 border border-slate-100"
                        }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 bg-white border border-slate-200 rounded-xl disabled:opacity-30 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PendingDisbursementReport;