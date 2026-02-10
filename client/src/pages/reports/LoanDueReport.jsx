import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import {
  Filter,
  Download,
  X,
  Calendar,
  Printer,
  ChevronLeft,
  ChevronRight,
  Search,
  FileText,
  RefreshCw
} from "lucide-react";
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

const LoanDueReport = () => {
  const { tenant } = useAuth();
  const [dueLoans, setDueLoans] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [officers, setOfficers] = useState([]);

   const [filters, setFilters] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("loan-due-filters");
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...parsed, search: "" };
      }
    }
    return {
      region: "",
      branch: "",
      officer: "",
      search: "",
      dateRange: "today",
      customStartDate: "",
      customEndDate: "",
      installmentsDue: "",
    };
  });

  // Save filters to localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem("loan-due-filters", JSON.stringify({
        ...filters,
        search: "" // Don't save search
      }));
    }, 500); // Debounce by 500ms
    
    return () => clearTimeout(timeoutId);
  }, [filters]);



  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchBranchesAndRegions = async () => {
      if (!tenant?.id) return;
      const [branchesRes, regionsRes] = await Promise.all([
        supabase.from("branches").select("id, name, region_id").eq("tenant_id", tenant.id),
        supabase.from("regions").select("id, name").eq("tenant_id", tenant.id)
      ]);

      if (!branchesRes.error) setBranches(branchesRes.data || []);
      if (!regionsRes.error) setRegions(regionsRes.data || []);
    };
    fetchBranchesAndRegions();
  }, []);

  const getDateRange = () => {
    const today = new Date();
    let startDate, endDate;

    switch (filters.dateRange) {
      case "today":
        startDate = endDate = today.toISOString().split("T")[0];
        break;
      case "week":
        startDate = today.toISOString().split("T")[0];
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() + 6);
        endDate = weekEnd.toISOString().split("T")[0];
        break;
      case "month":
        startDate = today.toISOString().split("T")[0];
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate = monthEnd.toISOString().split("T")[0];
        break;
      case "quarter":
        startDate = today.toISOString().split("T")[0];
        const quarterEnd = new Date(today);
        quarterEnd.setMonth(today.getMonth() + 3);
        endDate = quarterEnd.toISOString().split("T")[0];
        break;
      case "year":
        startDate = today.toISOString().split("T")[0];
        const yearEnd = new Date(today.getFullYear(), 11, 31);
        endDate = yearEnd.toISOString().split("T")[0];
        break;
      case "custom":
        startDate = filters.customStartDate;
        endDate = filters.customEndDate;
        break;
      default:
        startDate = endDate = today.toISOString().split("T")[0];
    }

    return { startDate, endDate };
  };

  useEffect(() => {
    const fetchDueLoans = async (forceRefresh = false) => {
      try {
        const { startDate, endDate } = getDateRange();

        if (filters.dateRange === "custom" && (!startDate || !endDate)) {
          setDueLoans([]);
          setLoading(false);
          return;
        }

        const cacheKey = `loan-due-data-${filters.dateRange}-${startDate}-${endDate}`;

        if (!forceRefresh) {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { data: cachedData, timestamp } = JSON.parse(cached);
            const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000; // 24 hours
            if (!isExpired) {
              setDueLoans(cachedData);
              const uniqueOfficers = [...new Set(cachedData.map((l) => l.officer))];
              setOfficers(uniqueOfficers);
              return;
            }
          }
        }

        setLoading(true);

        const { data, error } = await supabase
          .from("loans")
          .select(`
            id,
            scored_amount,
            total_payable,
            product_name,
            product_type,
            disbursed_at,
            branch_id,
            tenant_id,
            branch:branch_id(name, region_id),
            customer:customer_id(id, Firstname, Middlename, Surname, mobile, id_number),
            loan_officer:booked_by(full_name),
            installments:loan_installments(
              due_date,
              due_amount,
              paid_amount,
              status,
              principal_amount,
              interest_amount,
              principal_due,
              interest_due
            )
          `)
          .eq("tenant_id", tenant.id)
          .eq("status", "disbursed");

        if (error) throw error;

        // Create a region map for easy lookups
        const regionMap = regions.reduce((acc, r) => {
          acc[r.id] = r.name;
          return acc;
        }, {});

        const processed = data
          .map((loan) => {
            const branch = loan.branch?.name || "N/A";
            const regionId = loan.branch?.region_id;
            const region = regionId ? regionMap[regionId] || "N/A" : "N/A";
            const officer = loan.loan_officer?.full_name || "N/A";
            const cust = loan.customer || {};
            const fullName = [cust.Firstname, cust.Middlename, cust.Surname].filter(Boolean).join(" ");

            // Filter installments within date range
            const dueInRange = (loan.installments || []).filter((i) => {
              const dueDate = i.due_date?.split("T")[0];
              return (
                dueDate >= startDate &&
                dueDate <= endDate &&
                ["pending", "partial"].includes(i.status)
              );
            });

            if (dueInRange.length === 0) return null;

            const totalDueInRange = dueInRange.reduce((sum, i) => sum + Number(i.due_amount || 0), 0);
            const principalDue = dueInRange.reduce((sum, i) => sum + Number(i.principal_due || i.principal_amount || 0), 0);
            const interestDue = dueInRange.reduce((sum, i) => sum + Number(i.interest_due || i.interest_amount || 0), 0);
            const numDueInstallments = dueInRange.length;
            const totalPaid = (loan.installments || []).reduce((sum, i) => sum + Number(i.paid_amount || 0), 0);
            const unpaidAmount = (loan.total_payable || 0) - totalPaid;

            return {
              branch,
              region,
              officer,
              loanId: loan.id,
              customerName: fullName || "N/A",
              mobile: cust.mobile || "N/A",
              idNumber: cust.id_number || "N/A",
              productName: loan.product_name || "N/A",
              productType: loan.product_type || "N/A",
              numDueInstallments,
              disbursedAmount: loan.scored_amount || 0,
              principalDue,
              interestDue,
              totalDue: totalDueInRange,
              totalPaid,
              amountUnpaid: unpaidAmount,
              disbursementDate: loan.disbursed_at?.split("T")[0] || "N/A",
              expectedDueDate: dueInRange[0]?.due_date?.split("T")[0] || "N/A",
            };
          })
          .filter(Boolean);

        setDueLoans(processed);

        // Save to cache
        localStorage.setItem(cacheKey, JSON.stringify({
          data: processed,
          timestamp: Date.now()
        }));

        // Populate filter dropdowns
        const uniqueOfficers = [...new Set(processed.map((l) => l.officer))];
        setOfficers(uniqueOfficers);
      } catch (err) {
        console.error("Error fetching due loans:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDueLoans();
  }, [filters.dateRange, filters.customStartDate, filters.customEndDate, regions]);

   const formatCurrency = useCallback((num) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0), []);




  const filteredData = useMemo(() => {
    return dueLoans.filter((l) => {
      const { officer, branch, region, search, installmentsDue } = filters;
      const query = search.toLowerCase();
      return (
        (!officer || l.officer === officer) &&
        (!branch || l.branch === branch) &&
        (!region || l.region === region) &&
        (!search ||
          l.customerName.toLowerCase().includes(query) ||
          l.mobile.includes(query) ||
          l.idNumber.includes(query)) &&
        (!installmentsDue || l.numDueInstallments === Number(installmentsDue))
      );
    });
  }, [dueLoans, filters]);


  // // Group by branch, then by officer
  // const grouped = useMemo(() => {
  //   return filteredData.reduce((acc, loan) => {
  //     if (!acc[loan.branch]) {
  //       acc[loan.branch] = {
  //         branch: loan.branch,
  //         totalDue: 0,
  //         totalPaid: 0,
  //         totalUnpaid: 0,
  //         count: 0,
  //         officers: {},
  //       };
  //     }

  //     if (!acc[loan.branch].officers[loan.officer]) {
  //       acc[loan.branch].officers[loan.officer] = {
  //         officer: loan.officer,
  //         loans: [],
  //       };
  //     }

  //     acc[loan.branch].totalDue += loan.totalDue;
  //     acc[loan.branch].totalPaid += loan.totalPaid;
  //     acc[loan.branch].totalUnpaid += loan.amountUnpaid;
  //     acc[loan.branch].count += 1;
  //     acc[loan.branch].officers[loan.officer].loans.push(loan);

  //     return acc;
  //   }, {});
  // }, [filteredData]);

  const getDateRangeLabel = () => {
    switch (filters.dateRange) {
      case "today":
        return "Today";
      case "week":
        return "This Week";
      case "month":
        return "This Month";
      case "quarter":
        return "This Quarter";
      case "year":
        return "This Year";
      case "custom":
        return "Custom Range";
      default:
        return "Today";
    }
  };

  const handleExport = () => {
    switch (exportFormat) {
      case "pdf":
        exportToPDF();
        break;
      case "word":
        exportToWord();
        break;
      case "excel":
        exportToExcel();
        break;
      case "csv":
      default:
        exportToCSV();
        break;
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const companyName = tenant?.company_name || "Jasiri Capital";
    const reportTitle = "Loan Due Report";

    // Add Company Name and Title
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text(companyName, 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(reportTitle, 14, 30);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38);
    doc.text(`Range: ${getDateRangeLabel()}`, 14, 43);

    const tableHeaders = [
      ["No", "Branch", "Officer", "Customer", "Mobile", "Product", "Inst.", "Disbursed", "Due", "Unpaid", "Due Date"]
    ];

    const tableData = filteredData.map((loan, idx) => [
      idx + 1,
      loan.branch,
      loan.officer,
      loan.customerName,
      loan.mobile,
      loan.productName,
      loan.numDueInstallments,
      formatCurrency(loan.disbursedAmount),
      formatCurrency(loan.totalDue),
      formatCurrency(loan.amountUnpaid),
      loan.expectedDueDate
    ]);

    autoTable(doc, {
      startY: 50,
      head: tableHeaders,
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [46, 94, 153], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { top: 50 },
    });

    const companySlug = companyName.toLowerCase().replace(/ /g, '_');
    const timestamp = new Date().toISOString().split("T")[0];
    doc.save(`${companySlug}_due_loans_${timestamp}.pdf`);
  };

  const exportToExcel = () => {
    const companyName = tenant?.company_name || "Jasiri Capital";
    const data = filteredData.map((loan, idx) => ({
      No: idx + 1,
      Branch: loan.branch,
      Region: loan.region,
      Officer: loan.officer,
      Customer: loan.customerName,
      Mobile: loan.mobile,
      "ID Number": loan.idNumber,
      Product: loan.productName,
      "Installments Due": loan.numDueInstallments,
      "Disbursed Amount": loan.disbursedAmount,
      "Principal Due": loan.principalDue,
      "Interest Due": loan.interestDue,
      "Total Due": loan.totalDue,
      "Total Paid": loan.totalPaid,
      "Unpaid Amount": loan.amountUnpaid,
      "Due Date": loan.expectedDueDate,
      "Disbursement Date": loan.disbursementDate,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Loan Due Report");

    const companySlug = companyName.toLowerCase().replace(/ /g, '_');
    const timestamp = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `${companySlug}_due_loans_${timestamp}.xlsx`);
  };

  const exportToWord = () => {
    const companyName = tenant?.company_name || "Jasiri Capital";
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: `${companyName} - Loan Due Report`,
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({ text: `Generated: ${new Date().toLocaleString()}` }),
          new Paragraph({ text: `Date Range: ${getDateRangeLabel()}` }),
          new Paragraph({ text: "" }),
          new Table({
            rows: [
              new TableRow({
                children: ["No", "Branch", "Customer", "Due", "Due Date"].map(text =>
                  new TableCell({ children: [new Paragraph({ text, bold: true })] })
                ),
              }),
              ...filteredData.map((loan, idx) =>
                new TableRow({
                  children: [
                    String(idx + 1),
                    loan.branch,
                    loan.customerName,
                    formatCurrency(loan.totalDue),
                    loan.expectedDueDate
                  ].map(text => new TableCell({ children: [new Paragraph({ text })] }))
                })
              )
            ]
          })
        ]
      }]
    });

    Packer.toBlob(doc).then(blob => {
      const companySlug = companyName.toLowerCase().replace(/ /g, '_');
      const timestamp = new Date().toISOString().split("T")[0];
      saveAs(blob, `${companySlug}_due_loans_${timestamp}.docx`);
    });
  };

  const exportToCSV = () => {
    const companyName = tenant?.company_name || "Jasiri Capital";
    const headers = [
      "No", "Branch", "Region", "Officer", "Customer Name", "Mobile", "ID Number",
      "Product Name", "# Installments", "Disbursed Amount", "Principal Due",
      "Interest Due", "Total Due", "Total Paid", "Unpaid Amount", "Due Date", "Disbursement Date"
    ];

    const rows = filteredData.map((loan, idx) => [
      idx + 1, loan.branch, loan.region, loan.officer, loan.customerName, loan.mobile, loan.idNumber,
      loan.productName, loan.numDueInstallments, loan.disbursedAmount, loan.principalDue,
      loan.interestDue, loan.totalDue, loan.totalPaid, loan.amountUnpaid, loan.expectedDueDate, loan.disbursementDate
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const companySlug = companyName.toLowerCase().replace(/ /g, '_');
    const timestamp = new Date().toISOString().split("T")[0];
    saveAs(blob, `${companySlug}_due_loans_${timestamp}.csv`);
  };

  // Calculate grand totals
  const grandTotals = useMemo(() => {
    return filteredData.reduce(
      (acc, loan) => ({
        totalDue: acc.totalDue + loan.totalDue,
        totalPaid: acc.totalPaid + loan.totalPaid,
        totalUnpaid: acc.totalUnpaid + loan.amountUnpaid,
        principalDue: acc.principalDue + loan.principalDue,
        interestDue: acc.interestDue + loan.interestDue,
        disbursedAmount: acc.disbursedAmount + loan.disbursedAmount,
      }),
      {
        totalDue: 0,
        totalPaid: 0,
        totalUnpaid: 0,
        principalDue: 0,
        interestDue: 0,
        disbursedAmount: 0,
      }
    );
  }, [filteredData]);

  // Pagination calculations
  const { totalRows, totalPages } = useMemo(() => {
    const total = filteredData.length;
    return {
      totalRows: total,
      totalPages: Math.ceil(total / itemsPerPage),
    };
  }, [filteredData, itemsPerPage]);

  // Get current page data
  const currentData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);



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
                <h1 className="text-2xl font-bold text-white leading-tight">{tenant?.company_name || "Jasiri Capital"}</h1>
                <p className="text-sm text-white/80 font-medium">{tenant?.admin_email || "email@example.com"}</p>
                <h2 className="text-lg font-semibold text-white mt-1">
                  Loan Due Report
                </h2>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="text-sm text-white/70 text-right">
                <p>Generated on:</p>
                <p className="font-medium text-white">{new Date().toLocaleString()}</p>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap justify-end">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
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
              <button
                onClick={() => setFilters({
                  region: "",
                  branch: "",
                  officer: "",
                  search: "",
                  dateRange: "today",
                  customStartDate: "",
                  customEndDate: "",
                  installmentsDue: "",
                })}
                className="text-sm font-semibold text-red-500 hover:text-red-600 flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Reset All Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Region</label>
                <select
                  value={filters.region}
                  onChange={(e) => setFilters(prev => ({ ...prev, region: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                >
                  <option value="">All Regions</option>
                  {regions.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Branch</label>
                <select
                  value={filters.branch}
                  onChange={(e) => setFilters(prev => ({ ...prev, branch: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                >
                  <option value="">All Branches</option>
                  {branches
                    .filter(b => !filters.region || b.region_id === regions.find(r => r.name === filters.region)?.id)
                    .map(b => <option key={b.id} value={b.name}>{b.name}</option>)
                  }
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Relationship Officer</label>
                <select
                  value={filters.officer}
                  onChange={(e) => setFilters(prev => ({ ...prev, officer: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                >
                  <option value="">All Officers</option>
                  {officers.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Due Range</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary outline-none font-medium"
                >
                  <option value="today">Due Today</option>
                  <option value="week">Due This Week</option>
                  <option value="month">Due This Month</option>
                  <option value="quarter">Due This Quarter</option>
                  <option value="year">Due This Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Installments Due</label>
                <select
                  value={filters.installmentsDue}
                  onChange={(e) => setFilters(prev => ({ ...prev, installmentsDue: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                >
                  <option value="">All</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            {filters.dateRange === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100 lg:w-1/2">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    value={filters.customStartDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, customStartDate: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">End Date</label>
                  <input
                    type="date"
                    value={filters.customEndDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, customEndDate: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary shrink-0 font-bold">
              KES
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total Amount Due</p>
              <h3 className="text-2xl font-bold text-brand-primary">{formatCurrency(grandTotals.totalDue)}</h3>
            </div>
          </div>

          <div className="bg-green-50 p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent shrink-0 font-bold">
              KES
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total Unpaid Balance</p>
              <h3 className="text-2xl font-bold text-accent">{formatCurrency(grandTotals.totalUnpaid)}</h3>
            </div>
          </div>

          <div className="bg-amber-50 p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-5">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 shrink-0 font-bold">
              #
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Number of Loans</p>
              <h3 className="text-2xl font-bold text-gray-900">{filteredData.length}</h3>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-center w-12">No.</th>
                  <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px]">Branch Name</th>
                  <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px]">Relationship Officer</th>
                  <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px]">Customer Details</th>
                  <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-center whitespace-nowrap">Inst. Due</th>
                  <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] text-right whitespace-nowrap">Disbursed</th>
                  <th className="px-4 py-4 font-black text-red-600 uppercase tracking-wider text-[11px] text-right whitespace-nowrap font-bold">Total Due</th>
                  <th className="px-4 py-4 font-black text-accent uppercase tracking-wider text-[11px] text-right whitespace-nowrap">Total Paid</th>
                  <th className="px-4 py-4 font-black text-orange-600 uppercase tracking-wider text-[11px] text-right whitespace-nowrap">Unpaid Balance</th>
                  <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="11" className="px-4 py-8 text-center text-gray-500 font-medium">
                      Fetching report data...
                    </td>
                  </tr>
                ) : currentData.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="px-4 py-12 text-center text-gray-400 font-medium">
                      No matching records found
                    </td>
                  </tr>
                ) : (
                  currentData.map((loan, idx) => (
                    <tr key={loan.loanId} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-4 text-center text-slate-400 font-medium">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                      <td className="px-4 py-4 font-bold text-slate-900">{loan.branch}</td>
                      <td className="px-4 py-4 font-semibold text-slate-600">{loan.officer}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{loan.customerName}</span>
                          <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                            {loan.idNumber} • {loan.mobile}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-bold border border-slate-200">
                          {loan.numDueInstallments}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-slate-900">{formatCurrency(loan.disbursedAmount)}</td>
                      <td className="px-4 py-4 text-right font-black text-red-600 bg-red-50/30">{formatCurrency(loan.totalDue)}</td>
                      <td className="px-4 py-4 text-right font-bold text-accent">{formatCurrency(loan.totalPaid)}</td>
                      <td className="px-4 py-4 text-right font-black text-orange-600 bg-orange-50/30">{formatCurrency(loan.amountUnpaid)}</td>
                      <td className="px-4 py-4 text-slate-600 font-medium">{loan.expectedDueDate}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-50/50">
                <tr className="border-t-2 border-gray-200">
                  <td colSpan="6" className="px-4 py-4 text-sm font-bold text-gray-900 text-right uppercase tracking-wider">Grand Totals</td>
                  <td className="px-4 py-4 text-right font-bold text-gray-900 whitespace-nowrap">{formatCurrency(grandTotals.disbursedAmount)}</td>
                  <td className="px-4 py-4 text-right font-bold text-red-600 whitespace-nowrap">{formatCurrency(grandTotals.totalDue)}</td>
                  <td className="px-4 py-4 text-right font-bold text-accent whitespace-nowrap">{formatCurrency(grandTotals.totalPaid)}</td>
                  <td className="px-4 py-4 text-right font-bold text-orange-600 whitespace-nowrap">{formatCurrency(grandTotals.totalUnpaid)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          {!loading && currentData.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing <span className="font-bold text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                <span className="font-bold text-gray-900">{Math.min(currentPage * itemsPerPage, totalRows)}</span> of{" "}
                <span className="font-bold text-gray-900">{totalRows}</span> loans
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-9 h-9 rounded-lg border text-sm font-bold transition-all ${currentPage === pageNum ? "bg-brand-primary text-white border-brand-primary" : "bg-white text-gray-600 hover:border-brand-primary hover:text-brand-primary"}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 5 && <span className="px-2 text-gray-400">...</span>}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoanDueReport; 