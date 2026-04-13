import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { 
  BarChart3, 
  Download, 
  Filter, 
  RefreshCw, 
  X,
} from 'lucide-react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import { usePermissions } from "../../hooks/usePermissions";

// ========== FORMATTING ==========
const formatCurrency = (amount) => {
  return "KES " + new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const IncomeStatement = () => {
  const { tenant, profile } = useAuth();
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState([]);
  
  // ========== FILTER STATE ==========
  const [dateRange, setDateRange] = useState('mtd');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [endDate, setEndDate] = useState(new Date());
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [regions, setRegions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    region: "",
    branch: "",
  });
  const [exportFormat, setExportFormat] = useState('excel');
  const [showFilters, setShowFilters] = useState(false);
  const [baseStartDate, setBaseStartDate] = useState(new Date(2025, 0, 1));

  // Period label for table header
  const periodLabel = useMemo(() => {
    if (dateRange === 'mtd') return endDate.toLocaleString('default', { month: 'long' });
    if (startDate && endDate) {
        if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
            return startDate.toLocaleString('default', { month: 'long' });
        }
        return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    return 'Period';
  }, [dateRange, startDate, endDate]);

  const periodDescription = useMemo(() => {
    if (dateRange === 'all') {
        return `All Time through ${endDate.toLocaleString('default', { month: 'long' })}, ${endDate.getFullYear()}`;
    }
    if (startDate && endDate) {
        // approx months
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const months = Math.max(1, Math.round(diffDays / 30));
        const monthText = months === 1 ? 'Month' : 'Months';
        
        if (dateRange === 'today') return `For Today, ${formatDate(endDate)}`;
        if (dateRange === 'week') return `For this Week through ${formatDate(endDate)}`;
        
        return `For the ${months} ${monthText} through ${endDate.toLocaleString('default', { month: 'long' })}, ${endDate.getFullYear()}`;
    }
    return '';
  }, [startDate, endDate, dateRange]);

  // ========== DATA FETCHING ==========
  // Geographic Data
  useEffect(() => {
    const tenantId = tenant?.id;
    if (!tenantId) return;

    const fetchBranchesAndRegions = async () => {
      try {
        const { data, error } = await supabase
          .from("branches")
          .select(`
            id,
            name,
            region_id,
            regions ( name )
          `)
          .eq("tenant_id", tenantId)
          .order("name");

        if (error) throw error;

        const flattened = data.map(b => ({
          ...b,
          region: b.regions?.name || "N/A"
        }));

        setBranches(flattened);
        const uniqueRegions = [...new Set(flattened.map(b => b.region).filter(r => r && r !== "N/A"))];
        setRegions(uniqueRegions);
      } catch (err) {
        console.error("Error fetching geography:", err);
      }
    };

    fetchBranchesAndRegions();
  }, [tenant?.id]);

  useEffect(() => {
    const tenantId = tenant?.id;
    if (!tenantId) return;

    const fetchEarliestRecord = async () => {
      try {
        const { data, error } = await supabase
          .from('loan_fees_log')
          .select('created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (data?.created_at) {
          const earliestDate = new Date(data.created_at);
          setBaseStartDate(earliestDate);
          if (dateRange === 'all') {
            setStartDate(earliestDate);
          }
        }
      } catch (err) {
        console.error("Error fetching earliest record:", err);
      }
    };

    fetchEarliestRecord();
  }, [tenant?.id, dateRange]);

  const fetchData = useCallback(async () => {
    if (!tenant?.id) return;
    
    setRefreshing(true);
    try {
      let start = startDate;
      let end = endDate;

      if (dateRange !== 'custom') {
        const now = new Date();
        end = new Date();
        if (dateRange === 'today') {
          start = new Date(now.setHours(0, 0, 0, 0));
        } else if (dateRange === 'week') {
          start = new Date(now.setDate(now.getDate() - now.getDay()));
          start.setHours(0, 0, 0, 0);
        } else if (dateRange === 'mtd') {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (dateRange === 'ytd') {
          start = new Date(now.getFullYear(), 0, 1);
        } else if (dateRange === 'all') {
          start = baseStartDate;
        }
      }

      // Ensure start and end bounds
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // YTD Start is always Jan 1st of the end date year
      const ytdStart = new Date(end.getFullYear(), 0, 1);
      
      const queryStart = new Date(Math.min(start.getTime(), ytdStart.getTime()));
      
      const queryStartStr = queryStart.toISOString();
      const endStr = end.toISOString();

      // 1. Fetch Interest and Penalties
      let paymentsQuery = supabase
        .from('loan_payments')
        .select(`
          paid_amount, 
          interest_paid, 
          penalty_paid, 
          paid_at, 
          loans!inner (
            id,
            product_name,
            product_type,
            branch_id,
            branches!inner (
              name,
              region_id,
              regions!inner ( name )
            )
          )
        `)
        .eq('tenant_id', tenant.id)
        .gte('paid_at', queryStartStr)
        .lte('paid_at', endStr);

      if (filters.region) {
        paymentsQuery = paymentsQuery.eq('loans.branches.regions.name', filters.region);
      }
      if (filters.branch) {
        paymentsQuery = paymentsQuery.eq('loans.branches.name', filters.branch);
      }

      const { data: payments, error: pError } = await paymentsQuery;
      if (pError) throw pError;

      // 2. Fetch Fees
      let feesQuery = supabase
        .from('loan_fees_log')
        .select(`
          paid_amount, 
          fee_type, 
          created_at,
          loans!inner (
            id,
            product_name,
            product_type,
            branches!inner (
              name,
              regions!inner ( name )
            )
          )
        `)
        .eq('tenant_id', tenant.id)
        .gte('created_at', queryStartStr)
        .lte('created_at', endStr);

      if (filters.region) {
        feesQuery = feesQuery.eq('loans.branches.regions.name', filters.region);
      }
      if (filters.branch) {
        feesQuery = feesQuery.eq('loans.branches.name', filters.branch);
      }

      const { data: fees, error: fError } = await feesQuery;
      if (fError) throw fError;

      // 3. Fetch Loans disbursed
      let disbursedQuery = supabase
        .from('loans')
        .select(`
          id, product_name, product_type, processing_fee, registration_fee, 
          processing_fee_paid, registration_fee_paid, disbursed_at,
          branches!inner (
            name,
            regions!inner ( name )
          )
        `)
        .eq('tenant_id', tenant.id)
        .gte('disbursed_at', queryStartStr)
        .lte('disbursed_at', endStr);

      if (filters.region) {
        disbursedQuery = disbursedQuery.eq('branches.regions.name', filters.region);
      }
      if (filters.branch) {
        disbursedQuery = disbursedQuery.eq('branches.name', filters.branch);
      }

      const { data: disbursedLoans, error: dError } = await disbursedQuery;
      if (dError) throw dError;

      // 4. Process Data
      const productInterests = {};
      const totals = {
        processing: { period: 0, ytd: 0 },
        registration: { period: 0, ytd: 0 },
        penalties: { period: 0, ytd: 0 }
      };

      const getProductKey = (loan) => loan?.product_type || 'Unknown Product';

      payments?.forEach(p => {
        const date = new Date(p.paid_at).getTime();
        const isPeriod = date >= start.getTime() && date <= end.getTime();
        const isYtd = date >= ytdStart.getTime() && date <= end.getTime();

        const key = getProductKey(p.loans);
        if (!productInterests[key]) productInterests[key] = { period: 0, ytd: 0 };
        
        const interest = Number(p.interest_paid) || 0;
        const penalties = Number(p.penalty_paid) || 0;

        if (isPeriod) {
            productInterests[key].period += interest;
            totals.penalties.period += penalties;
        }
        if (isYtd) {
            productInterests[key].ytd += interest;
            totals.penalties.ytd += penalties;
        }
      });

      const loanIdsWithLoggedFees = new Set();

      fees?.forEach(f => {
        const date = new Date(f.created_at).getTime();
        const isPeriod = date >= start.getTime() && date <= end.getTime();
        const isYtd = date >= ytdStart.getTime() && date <= end.getTime();

        const amount = Number(f.paid_amount) || 0;
        if (f.fee_type === 'processing') {
            if (isPeriod) totals.processing.period += amount;
            if (isYtd) totals.processing.ytd += amount;
            if (f.loans?.id) loanIdsWithLoggedFees.add(`${f.loans.id}_processing`);
        } else if (f.fee_type === 'registration') {
            if (isPeriod) totals.registration.period += amount;
            if (isYtd) totals.registration.ytd += amount;
            if (f.loans?.id) loanIdsWithLoggedFees.add(`${f.loans.id}_registration`);
        }
      });

      disbursedLoans?.forEach(l => {
        const date = new Date(l.disbursed_at).getTime();
        const isPeriod = date >= start.getTime() && date <= end.getTime();
        const isYtd = date >= ytdStart.getTime() && date <= end.getTime();

        if (l.processing_fee_paid && !loanIdsWithLoggedFees.has(`${l.id}_processing`)) {
            const amt = Number(l.processing_fee) || 0;
            if (isPeriod) totals.processing.period += amt;
            if (isYtd) totals.processing.ytd += amt;
        }
        if (l.registration_fee_paid && !loanIdsWithLoggedFees.has(`${l.id}_registration`)) {
            const amt = Number(l.registration_fee) || 0;
            if (isPeriod) totals.registration.period += amt;
            if (isYtd) totals.registration.ytd += amt;
        }
      });

      const processedSections = [];
      Object.keys(productInterests).sort().forEach(product => {
          processedSections.push({
              name: `INTEREST ON ${product.toUpperCase()}`,
              periodVal: productInterests[product].period,
              ytdVal: productInterests[product].ytd
          });
      });
      processedSections.push({
          name: 'LOAN PROCESSING FEE',
          periodVal: totals.processing.period,
          ytdVal: totals.processing.ytd
      });
      processedSections.push({
          name: 'JOINING FEE',
          periodVal: totals.registration.period,
          ytdVal: totals.registration.ytd
      });
      processedSections.push({
          name: 'PENALTIES',
          periodVal: totals.penalties.period,
          ytdVal: totals.penalties.ytd
      });

      setData(processedSections);

    } catch (err) {
      console.error("Error fetching income statement:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tenant?.id, dateRange, startDate, endDate, filters, baseStartDate]);

  useEffect(() => {
    // Check if start/end dates are valid before fetching
    if (startDate && endDate) {
      fetchData();
    }
  }, [fetchData]);

  // ========== EXPORTS ==========
  const exportToExcel = () => {
    if (data.length === 0) {
      alert("No data to export");
      return;
    }

    const wsData = [
      [tenant?.company_name || "Company Name"],
      ["INCOME STATEMENT"],
      [`For the ${periodDescription.replace('For the ', '')}`],
      [""],
      ["Item", periodLabel, "YTD"],
      ["REVENUE"]
    ];

    let totalPeriodRevenue = 0;
    let totalYtdRevenue = 0;

    data.forEach(item => {
      totalPeriodRevenue += item.periodVal;
      totalYtdRevenue += item.ytdVal;
      wsData.push(["  " + item.name, item.periodVal, item.ytdVal]);
      wsData.push(["Total " + item.name, item.periodVal, item.ytdVal]);
      wsData.push([""]); // Empty spacing row
    });

    wsData.push(["TOTAL REVENUE", totalPeriodRevenue, totalYtdRevenue]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Merge header rows to center them
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // Company Name
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, // title
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }  // period
    ];

    // Center alignment for merged headers
    ['A1', 'A2', 'A3'].forEach(cell => {
      if(!ws[cell]) return;
      ws[cell].s = { alignment: { horizontal: "center" } };
    });
    
    // Auto-size columns roughly
    ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Income Statement");
    XLSX.writeFile(wb, `${tenant?.company_name?.toLowerCase().replace(/ /g, "_") || "income"}_statement_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToCSV = () => {
    if (data.length === 0) {
      alert("No data to export");
      return;
    }

    const rows = [
      [tenant?.company_name || "Company Name"],
      ["INCOME STATEMENT"],
      [periodDescription],
      [""],
      ["Item", periodLabel, "YTD"],
      ["REVENUE"]
    ];

    let totalPeriodRevenue = 0;
    let totalYtdRevenue = 0;

    data.forEach(item => {
      totalPeriodRevenue += item.periodVal;
      totalYtdRevenue += item.ytdVal;
      rows.push(["  " + item.name, item.periodVal.toFixed(2), item.ytdVal.toFixed(2)]);
      rows.push(["Total " + item.name, item.periodVal.toFixed(2), item.ytdVal.toFixed(2)]);
      rows.push(["", "", ""]);
    });

    rows.push(["TOTAL REVENUE", totalPeriodRevenue.toFixed(2), totalYtdRevenue.toFixed(2)]);

    const csvContent = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `${tenant?.company_name?.toLowerCase().replace(/ /g, "_") || "income"}_statement_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const companyName = tenant?.company_name || "Company Name";
    
    // Header setup
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(companyName, 105, 15, { align: "center" });
    
    doc.setFontSize(16);
    doc.text("INCOME STATEMENT", 105, 25, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(periodDescription, 105, 35, { align: "center" });
    
    if (filters.region || filters.branch) {
        doc.setFontSize(9);
        doc.text(`Filters: ${filters.region || 'All Regions'} / ${filters.branch || 'All Branches'}`, 105, 42, { align: "center" });
    }
    
    // Calculate total lines needed to prepare the body array
    const bodyRows = [
      // Section Header (simulated styling below)
      [{ content: "REVENUE", colSpan: 3, styles: { fillColor: [173, 216, 230], fontStyle: "bold" } }]
    ];

    let totalPeriodRevenue = 0;
    let totalYtdRevenue = 0;

    data.forEach(item => {
        totalPeriodRevenue += item.periodVal;
        totalYtdRevenue += item.ytdVal;
        bodyRows.push([
            { content: "  " + item.name, styles: { fontStyle: "normal" } },
            formatCurrency(item.periodVal),
            formatCurrency(item.ytdVal)
        ]);
        bodyRows.push([
            { content: "Total " + item.name, styles: { fontStyle: "bold" } },
            { content: formatCurrency(item.periodVal), styles: { fontStyle: "bold" } },
            { content: formatCurrency(item.ytdVal), styles: { fontStyle: "bold" } }
        ]);
        // Blank row
        bodyRows.push(["", "", ""]);
    });

    bodyRows.push([
        { content: "TOTAL REVENUE", styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
        { content: formatCurrency(totalPeriodRevenue), styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
        { content: formatCurrency(totalYtdRevenue), styles: { fontStyle: "bold", fillColor: [240, 240, 240] } }
    ]);

    autoTable(doc, {
      startY: 50,
      head: [["", periodLabel, "YTD"]],
      body: bodyRows,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: { top: 2, right: 3, bottom: 2, left: 3 } },
      headStyles: { fontStyle: "italic", halign: "right", textColor: [0,0,0] },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'right' }
      },
      didParseCell: function(data) {
          // Keep first column blank header empty visually, but format others
          if (data.section === 'head' && data.column.index === 0) {
              data.cell.text = "";
          }
      }
    });

    doc.save(`${companyName.toLowerCase().replace(/ /g, "_")}_income_statement.pdf`);
  };

  const exportToWord = async () => {
    const tableRows = [
      new TableRow({
        children: [
            new TableCell({ children: [], width: { size: 60, type: WidthType.PERCENTAGE }, borders: { bottom: { style: BorderStyle.SINGLE, size: 1 } } }),
            new TableCell({ children: [new Paragraph({ text: periodLabel, italics: true, alignment: "right" })], borders: { bottom: { style: BorderStyle.SINGLE, size: 1 } } }),
            new TableCell({ children: [new Paragraph({ text: "YTD", italics: true, alignment: "right" })], borders: { bottom: { style: BorderStyle.SINGLE, size: 1 } } }),
        ]
      }),
      new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: "REVENUE", bold: true })], columnSpan: 3, shading: { fill: "ADD8E6" } })
          ]
      })
    ];

    let totalPeriodRevenue = 0;
    let totalYtdRevenue = 0;

    data.forEach(item => {
        totalPeriodRevenue += item.periodVal;
        totalYtdRevenue += item.ytdVal;
        tableRows.push(new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: "    " + item.name })], borders: { bottom: { style: BorderStyle.NONE }, top: { style: BorderStyle.NONE } } }),
              new TableCell({ children: [new Paragraph({ text: formatCurrency(item.periodVal), alignment: "right" })], borders: { bottom: { style: BorderStyle.NONE }, top: { style: BorderStyle.NONE } } }),
              new TableCell({ children: [new Paragraph({ text: formatCurrency(item.ytdVal), alignment: "right" })], borders: { bottom: { style: BorderStyle.NONE }, top: { style: BorderStyle.NONE } } })
            ]
        }));
        tableRows.push(new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: "Total " + item.name, bold: true })], borders: { bottom: { style: BorderStyle.NONE }, top: { style: BorderStyle.NONE } } }),
              new TableCell({ children: [new Paragraph({ text: formatCurrency(item.periodVal), bold: true, alignment: "right" })], borders: { bottom: { style: BorderStyle.NONE }, top: { style: BorderStyle.SINGLE, size: 1 } } }),
              new TableCell({ children: [new Paragraph({ text: formatCurrency(item.ytdVal), bold: true, alignment: "right" })], borders: { bottom: { style: BorderStyle.NONE }, top: { style: BorderStyle.SINGLE, size: 1 } } })
            ]
        }));
        tableRows.push(new TableRow({
            children: [
                new TableCell({ children: [], columnSpan: 3, borders: { bottom: { style: BorderStyle.NONE }, top: { style: BorderStyle.NONE } } })
            ]
        }));
    });

    tableRows.push(new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ text: "TOTAL REVENUE", bold: true })], borders: { bottom: { style: BorderStyle.DOUBLE, size: 4 }, top: { style: BorderStyle.SINGLE, size: 8 } } }),
            new TableCell({ children: [new Paragraph({ text: formatCurrency(totalPeriodRevenue), bold: true, alignment: "right" })], borders: { bottom: { style: BorderStyle.DOUBLE, size: 4 }, top: { style: BorderStyle.SINGLE, size: 8 } } }),
            new TableCell({ children: [new Paragraph({ text: formatCurrency(totalYtdRevenue), bold: true, alignment: "right" })], borders: { bottom: { style: BorderStyle.DOUBLE, size: 4 }, top: { style: BorderStyle.SINGLE, size: 8 } } })
        ]
    }));

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: tenant?.company_name || "Company Name", size: 20, alignment: "center" }),
          new Paragraph({ text: "INCOME STATEMENT", bold: true, size: 28, alignment: "center" }),
          new Paragraph({ text: " " }),
          new Paragraph({ text: periodDescription, bold: true, alignment: "center" }),
          new Paragraph({ text: " " }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows
          })
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${tenant?.company_name?.toLowerCase().replace(/ /g, "_") || "income"}_statement.docx`);
  };

  const handleExport = () => {
    switch(exportFormat) {
      case 'excel': exportToExcel(); break;
      case 'pdf': exportToPDF(); break;
      case 'csv': exportToCSV(); break;
      case 'word': exportToWord(); break;
      default: exportToExcel();
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ region: "", branch: "" });
    setDateRange('mtd');
    setStartDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    setEndDate(new Date());
  };

  return (
    <div className="min-h-screen bg-muted p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-[1200px] mx-auto space-y-6">
        
        {/* Header Section for App UI Controls */}
        <div className="bg-brand-secondary rounded-xl shadow-md border border-gray-200 p-4 overflow-hidden mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-sm font-bold text-stone-600 uppercase tracking-wider">{tenant?.company_name || "Company Name"}</h1>
                <h2 className="text-lg font-semibold text-white mt-1">
                  Income Statement Report
                </h2>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2 flex-wrap justify-end">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border
                    ${showFilters
                      ? "bg-accent text-white shadow-md border-transparent hover:bg-brand-secondary"
                      : "text-white border-white/30 hover:bg-white/10"
                    }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                  {(filters.region || filters.branch || dateRange !== 'mtd') && (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${showFilters ? 'bg-white text-brand-primary' : 'bg-brand-primary text-white'}`}>
                      Active
                    </span>
                  )}
                </button>

                <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 p-1">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="bg-transparent text-sm font-medium text-gray-700 px-2 py-1 focus:outline-none cursor-pointer"
                  >
                    <option value="excel">Excel</option>
                    <option value="pdf">PDF</option>
                    <option value="csv">CSV</option>
                    <option value="word">Word</option>
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
                
                <button 
                  onClick={fetchData}
                  disabled={refreshing}
                  className="p-2 py-1.5 rounded-lg border border-gray-200 bg-white/90 text-gray-600 hover:bg-white transition-colors disabled:opacity-50"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <div className="bg-slate-50 p-6 border border-gray-200 rounded-xl shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
            <h3 className="text-slate-600 text-sm font-semibold">Filter Results</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <select
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value);
                  setShowCustomDates(e.target.value === 'custom');
                }}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="mtd">This Month (MTD)</option>
                <option value="ytd">This Year (YTD)</option>
                <option value="all">All Time</option>
                <option value="custom">Custom Range</option>
              </select>

              {showCustomDates && (
                <>
                  <DatePicker 
                    selected={startDate} 
                    onChange={setStartDate} 
                    className="w-full border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm"
                    placeholderText="Start Date"
                  />
                  <DatePicker 
                    selected={endDate} 
                    onChange={setEndDate} 
                    className="w-full border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm"
                    placeholderText="End Date"
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {!['relationship_officer', 'branch_manager', 'customer_service_officer', 'regional_manager'].includes(profile?.role) && (
                <select
                  value={filters.region}
                  onChange={(e) => handleFilterChange("region", e.target.value)}
                  className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm"
                >
                  <option value="">All Regions</option>
                  {regions.map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              )}

              {!['relationship_officer', 'branch_manager', 'customer_service_officer'].includes(profile?.role) && (
                <select
                  value={filters.branch}
                  onChange={(e) => handleFilterChange("branch", e.target.value)}
                  className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm"
                >
                  <option value="">All Branches</option>
                  {branches
                    .filter(b => !filters.region || b.region === filters.region)
                    .map((b) => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                </select>
              )}

              <button
                onClick={clearFilters}
                className="text-red-600 text-sm font-medium flex items-center gap-1 hover:text-red-700"
              >
                <X className="w-4 h-4" /> Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Document Render Area */}
        <div className="bg-gray-50 border text-sm text-slate-800 font-medium pb-20 shadow-sm" style={{ minHeight: '800px', padding: '40px 60px' }}>
            
            {/* Core Report Content Only */}

            {/* Table Header */}
            <div className="grid grid-cols-12 pb-1 border-b border-black mb-4 px-2 italic text-slate-600 text-right">
                <div className="col-span-6 text-left"></div>
                <div className="col-span-3">{periodLabel}</div>
                <div className="col-span-3">YTD</div>
            </div>

            {/* Main Content */}
            <div className="space-y-4">
                <div className="bg-brand-primary/20 px-2 py-1 font-bold text-base tracking-wide">
                    REVENUE
                </div>

                <div className="px-2 space-y-4">
                    {data.length > 0 ? data.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                            {/* Summary label is removed to avoid repetition, name will show in the row below */}
                            
                            {/* Detail Row */}
                            <div className="grid grid-cols-12 text-sm py-2 group hover:bg-slate-50 transition-colors">
                                <div className="col-span-6 pl-4 font-medium text-slate-700">{item.name}</div>
                                <div className="col-span-3 text-right">
                                    <span className="">{formatCurrency(item.periodVal)}</span>
                                </div>
                                <div className="col-span-3 text-right">
                                    <span className="">{formatCurrency(item.ytdVal)}</span>
                                </div>
                                {/* Tiny horizontal lines after each interest item */}
                                <div className="col-span-12 mt-2 border-b border-slate-100 h-[1px] mx-4"></div>
                            </div>
                            
                            {/* Subtotal Row */}
                            <div className="grid grid-cols-12 text-sm pt-1 mb-4 items-baseline">
                                <div className="col-span-6 italic font-semibold text-slate-500 pl-8">Total {item.name.toLowerCase().replace('interest on ', '')}</div>
                                <div className="col-span-3 text-right">
                                    <span className="border-t border-slate-600 py-[1px] px-1 font-bold text-slate-600">{formatCurrency(item.periodVal)}</span>
                                </div>
                                <div className="col-span-3 text-right">
                                    <span className="border-t border-slate-600 py-[1px] px-1 font-bold text-slate-600">{formatCurrency(item.ytdVal)}</span>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="py-8 text-center text-slate-500 italic">
                            No revenue data found for this period.
                        </div>
                    )}
                </div>

                {/* Total Section */}
                {data.length > 0 && (
                    <div className="px-2 mt-8 py-6 bg-emerald-50/50 rounded-lg border-t-2 border-emerald-200">
                        <div className="grid grid-cols-12 items-baseline">
                            <div className="col-span-6 uppercase pl-4 text-lg  tracking-tight text-emerald-700">TOTAL REVENUE</div>
                            <div className="col-span-3 text-right">
                                <span className="text-xl pt-1 block uppercase pr-2 text-brand-primary font-semibold ">{formatCurrency(data.reduce((acc, curr) => acc + curr.periodVal, 0))}</span>
                            </div>
                            <div className="col-span-3 text-right">
                                <span className="text-xl pt-1 block uppercase pr-2 text-brand-primary font-semibold ">{formatCurrency(data.reduce((acc, curr) => acc + curr.ytdVal, 0))}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

        </div>
      </div>
    </div>
  );
};

export default IncomeStatement;
