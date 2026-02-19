import React, { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "../../supabaseClient";
import {
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Printer,
  Search,
  X
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
import Spinner from "../../components/Spinner"; // ✅ Import your custom Spinner

// Memoized helper functions
const formatCurrency = (num) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(num || 0);

// Separate component for table rows to prevent re-renders
const LoanTableRow = React.memo(({ loan, index, currentPage, itemsPerPage }) => {
  return (
    <tr className="group hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-4 text-center text-slate-400 font-medium whitespace-nowrap">
        {(currentPage - 1) * itemsPerPage + index + 1}
      </td>
      <td className="px-4 py-4 font-bold text-slate-900 whitespace-nowrap">{loan.branch}</td>
      <td className="px-4 py-4 font-semibold text-slate-600 whitespace-nowrap">{loan.officer}</td>
   <td className="px-4 py-4 font-bold text-slate-900 whitespace-nowrap">
  {loan.customerName}
</td>

<td className="px-4 py-4 text-slate-600 whitespace-nowrap">
  {loan.idNumber}
</td>

<td className="px-4 py-4 text-slate-600 whitespace-nowrap">
  {loan.mobile}
</td>

      <td className="px-4 py-4 text-center">
        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-bold border border-slate-200 whitespace-nowrap">
          {loan.numDueInstallments}
        </span>
      </td>
      <td className="px-4 py-4 text-right font-medium text-slate-900 whitespace-nowrap">
        {formatCurrency(loan.disbursedAmount)}
      </td>
      <td className="px-4 py-4 text-right font-black text-red-600 bg-red-50/30 whitespace-nowrap">
        {formatCurrency(loan.totalDue)}
      </td>
      <td className="px-4 py-4 text-right font-bold text-accent whitespace-nowrap">
        {formatCurrency(loan.totalPaid)}
      </td>
      <td className="px-4 py-4 text-right font-black text-orange-600 bg-orange-50/30 whitespace-nowrap">
        {formatCurrency(loan.amountUnpaid)}
      </td>
      <td className="px-4 py-4 text-slate-600 font-medium whitespace-nowrap">{loan.expectedDueDate}</td>
    </tr>
  );
});

LoanTableRow.displayName = 'LoanTableRow';

// Inline SearchBox component
const SearchBox = React.memo(({ value, onChange }) => {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search name, ID, or phone"
        className="border bg-gray-50 border-gray-300 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm w-64 text-gray-900"
      />
    </div>
  );
});

SearchBox.displayName = 'SearchBox';

const LoanDueReport = () => {
  // ✅ Get tenant from localStorage ONCE - no hook dependencies
  const [tenant] = useState(() => {
    try {
      const savedTenant = localStorage.getItem("tenant");
      return savedTenant ? JSON.parse(savedTenant) : null;
    } catch (e) {
      console.error("Error loading tenant:", e);
      return null;
    }
  });

  // State
  const [rawLoans, setRawLoans] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // ✅ Add error state
  const [showFilters, setShowFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState("csv");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem("loan-due-filters");
      return saved ? JSON.parse(saved) : {
        region: "",
        branch: "",
        officer: "",
        dateRange: "today",
        customStartDate: "",
        customEndDate: "",
        installmentsDue: "",
      };
    } catch (e) {
      return {
        region: "",
        branch: "",
        officer: "",
        dateRange: "today",
        customStartDate: "",
        customEndDate: "",
        installmentsDue: "",
      };
    }
  });

 // ✅ Track mount state
  const itemsPerPage = 10;

  // Save filters to localStorage (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem("loan-due-filters", JSON.stringify(filters));
      } catch (e) {
        console.error("Failed to save filters:", e);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [filters]);

  // ✅ FIXED: Fetch branches and regions - ONLY ONCE with proper cleanup
 useEffect(() => {
  if (!tenant?.id) return;

  const controller = new AbortController();
  const tenantId = tenant.id;

  const fetchMetadata = async () => {
    try {
      const { data: branchesData, error: branchesError } = await supabase
        .from("branches")
        .select("id, name, region_id")
        .eq("tenant_id", tenantId)
        .abortSignal(controller.signal);

      if (branchesError) throw branchesError;

      const { data: regionsData, error: regionsError } = await supabase
        .from("regions")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .abortSignal(controller.signal);

      if (regionsError) throw regionsError;

      setBranches(branchesData || []);
      setRegions(regionsData || []);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Metadata fetch error:", err);
    }
  };

  fetchMetadata();

  return () => {
    controller.abort();
  };
}, [tenant?.id]);


  // ✅ FIXED: Fetch loans data - ONLY ONCE with proper cleanup and error handling
useEffect(() => {
  if (!tenant?.id) return;

  const controller = new AbortController();
  const tenantId = tenant.id;

  const fetchLoans = async () => {
    try {
      setLoading(true);
      setError(null);

      const cacheKey = `loan-due-raw-data-${tenantId}`;

      // ✅ Check cache first (4 hours)
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isFresh = Date.now() - timestamp < 4 * 60 * 60 * 1000;

        if (isFresh) {
          setRawLoans(data || []);
          setLoading(false);
          return;
        }
      }

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
          status,
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
        .eq("tenant_id", tenantId)
        .eq("status", "disbursed")
        .abortSignal(controller.signal);

      if (error) throw error;

      setRawLoans(data || []);
      setLoading(false);

      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          data: data || [],
          timestamp: Date.now(),
        })
      );
    } catch (err) {
      if (err.name === "AbortError") return;

      console.error("Loans fetch error:", err);
      setError(err.message || "Failed to load loans");
      setLoading(false);
    }
  };

  fetchLoans();

  return () => {
    controller.abort();
  };
}, [tenant?.id]);

  //  Manual refresh function
  const handleManualRefresh = async () => {
    const tenantId = tenant?.id;
    if (!tenantId || loading) return;

    console.log("🔄 Manual refresh triggered");

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
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
          status,
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
        .eq("tenant_id", tenantId)
        .eq("status", "disbursed");

      if (fetchError) throw fetchError;

      setRawLoans(data || []);
      
      const cacheKey = `loan-due-raw-data-${tenantId}`;
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ 
          data: data || [], 
          timestamp: Date.now() 
        }));
      } catch (e) {
        console.error("Cache write error:", e);
      }

      console.log("✅ Manual refresh complete");
      
    } catch (err) {
      console.error("❌ Error refreshing loans:", err);
      setError(err.message || "Failed to refresh data");
    } finally {
      setLoading(false);
    }
  };

  // Get date range
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

  // Process and filter data
  const filteredData = useMemo(() => {
    const { startDate, endDate } = getDateRange();
    const localRegionMap = regions.reduce((acc, r) => {
      acc[r.id] = r.name;
      return acc;
    }, {});

    const query = (searchQuery || "").toLowerCase().trim();

    return rawLoans
      .map((loan) => {
        const branchName = loan.branch?.name || "N/A";
        const regionId = loan.branch?.region_id;
        const regionName = regionId ? localRegionMap[regionId] || "N/A" : "N/A";
        const officerName = loan.loan_officer?.full_name || "N/A";
        const cust = loan.customer || {};
        const fullName = [cust.Firstname, cust.Middlename, cust.Surname].filter(Boolean).join(" ");

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
        const principalDueVal = dueInRange.reduce((sum, i) => sum + Number(i.principal_due || i.principal_amount || 0), 0);
        const interestDueVal = dueInRange.reduce((sum, i) => sum + Number(i.interest_due || i.interest_amount || 0), 0);
        const numDueInstallments = dueInRange.length;
        const totalPaid = (loan.installments || []).reduce((sum, i) => sum + Number(i.paid_amount || 0), 0);

        const row = {
          branch: branchName,
          region: regionName,
          officer: officerName,
          loanId: loan.id,
          customerName: fullName || "N/A",
          mobile: cust.mobile || "N/A",
          idNumber: cust.id_number || "N/A",
          productName: loan.product_name || "N/A",
          productType: loan.product_type || "N/A",
          numDueInstallments,
          disbursedAmount: loan.scored_amount || 0,
          principalDue: principalDueVal,
          interestDue: interestDueVal,
          totalDue: totalDueInRange,
          totalPaid,
          amountUnpaid: (loan.total_payable || 0) - totalPaid,
          disbursementDate: loan.disbursed_at?.split("T")[0] || "N/A",
          expectedDueDate: dueInRange[0]?.due_date?.split("T")[0] || "N/A",
        };

        // Apply filters
        const { officer, branch, region, installmentsDue } = filters;

        if (officer && row.officer !== officer) return null;
        if (branch && row.branch !== branch) return null;
        if (region && row.region !== region) return null;
        if (installmentsDue && row.numDueInstallments !== Number(installmentsDue)) return null;
        
        // Safe string checking
        if (query) {
          const customerNameMatch = String(row.customerName || "").toLowerCase().includes(query);
          const mobileMatch = String(row.mobile || "").includes(query);
          const idNumberMatch = String(row.idNumber || "").includes(query);
          
          if (!customerNameMatch && !mobileMatch && !idNumberMatch) {
            return null;
          }
        }

        return row;
      })
      .filter(Boolean);
  }, [rawLoans, filters, regions, searchQuery]);

  // Update officers list
  useEffect(() => {
    const uniqueOfficers = [...new Set(filteredData.map((l) => l.officer))];
    setOfficers(uniqueOfficers);
  }, [filteredData]);

  const getDateRangeLabel = () => {
    switch (filters.dateRange) {
      case "today": return "Today";
      case "week": return "This Week";
      case "month": return "This Month";
      case "quarter": return "This Quarter";
      case "year": return "This Year";
      case "custom": return "Custom Range";
      default: return "Today";
    }
  };

  // Export functions (keeping same as before)
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const companyName = tenant?.company_name || "Jasiri Capital";

    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text(companyName, 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text("Loan Due Report", 14, 30);

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

  const handleExport = () => {
    switch (exportFormat) {
      case "pdf": exportToPDF(); break;
      case "word": exportToWord(); break;
      case "excel": exportToExcel(); break;
      case "csv":
      default: exportToCSV(); break;
    }
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

  // Pagination
  const { totalRows, totalPages, currentData } = useMemo(() => {
    const total = filteredData.length;
    const totalPages = Math.ceil(total / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentData = filteredData.slice(startIndex, startIndex + itemsPerPage);
    
    return { totalRows: total, totalPages, currentData };
  }, [filteredData, currentPage]);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters({
      region: "",
      branch: "",
      officer: "",
      dateRange: "today",
      customStartDate: "",
      customEndDate: "",
      installmentsDue: "",
    });
    setSearchQuery("");
    setCurrentPage(1);
  };

  // ✅ Show loading state with custom Spinner
  if (loading && rawLoans.length === 0) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <Spinner text="Loading Loan Due Report..." />
      </div>
    );
  }

  // ✅ Show error state with retry option
  if (error && rawLoans.length === 0) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <X className="w-16 h-16 mx-auto mb-2" />
            <p className="text-lg font-semibold">Failed to load report</p>
            <p className="text-sm text-gray-600 mt-2">{error}</p>
          </div>
          <button
            onClick={handleManualRefresh}
            className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-brand-secondary transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
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
                <h1 className="text-sm font-bold text-stone-600 leading-tight">{tenant?.company_name || "Jasiri Capital"}</h1>
                <h2 className="text-lg font-semibold text-white mt-1">
                  Loan Due Report
                </h2>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
            
              <div className="flex gap-2 mt-2 flex-wrap justify-end">
                <SearchBox
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
              
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-brand-primary" />
                Report Filters
              </h3>
              <button
                onClick={handleResetFilters}
                className="text-sm font-semibold text-red-500 hover:text-red-600 flex items-center gap-1.5 transition-colors"
              >
                <X className="w-4 h-4" />
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
                  <th className="px-4 py-4 font-black text-slate-700 uppercase whitespace-nowrap text-[11px] text-center w-12">No.</th>
                  <th className="px-4 py-4 font-black text-slate-700 uppercase whitespace-nowrap text-[11px]">Branch Name</th>
                  <th className="px-4 py-4 font-black text-slate-700 uppercase whitespace-nowrap text-[11px]">RO</th>
  <th className="px-4 py-4 font-black text-slate-700 uppercase text-[11px] whitespace-nowrap">Customer Name</th>
    <th className="px-4 py-4 font-black text-slate-700 uppercase text-[11px] whitespace-nowrap">ID Number</th>
    <th className="px-4 py-4 font-black text-slate-700 uppercase text-[11px] whitespace-nowrap">Phone</th>
                  <th className="px-4 py-4 font-black text-slate-700 uppercase text-[11px] text-center whitespace-nowrap">Inst. Due</th>
                  <th className="px-4 py-4 font-black text-slate-700 uppercase  text-[11px] text-right whitespace-nowrap">Disbursed</th>
                  <th className="px-4 py-4 font-black text-red-600 uppercase tracking-wider text-[11px] text-right whitespace-nowrap font-bold">Total Due</th>
                  <th className="px-4 py-4 font-black text-accent uppercase tracking-wider text-[11px] text-right whitespace-nowrap">Total Paid</th>
                  <th className="px-4 py-4 font-black text-orange-600 uppercase tracking-wider text-[11px] text-right whitespace-nowrap">Unpaid Balance</th>
                  <th className="px-4 py-4 font-black text-slate-700 uppercase tracking-wider text-[11px] whitespace-nowrap">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-gray-500">
                      <div className="flex justify-center">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      </div>
                    </td>
                  </tr>
                ) : currentData.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-12 text-center text-gray-400 font-medium">
                      No matching records found
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
              <tfoot className="bg-gray-50/50">
                <tr className="border-t-2 border-gray-200">
                  <td colSpan="7" className="px-4 py-4 text-sm font-bold text-gray-900 text-right uppercase tracking-wider">Grand Totals</td>
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