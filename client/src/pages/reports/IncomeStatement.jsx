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
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import { usePermissions } from "../../hooks/usePermissions";
import CustomSelect from '../../components/CustomSelect';
import { SkeletonTable } from '../../components/Skeleton';

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

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

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
      wsData.push([""]);
    });

    wsData.push(["TOTAL REVENUE", totalPeriodRevenue, totalYtdRevenue]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }
    ];

    ['A1', 'A2', 'A3'].forEach(cell => {
      if(!ws[cell]) return;
      ws[cell].s = { alignment: { horizontal: "center" } };
    });
    
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
    
    const bodyRows = [
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

  const regionOptions = useMemo(() => {
    return [
      { value: "", label: "All Regions" },
      ...regions.map(r => ({ value: r, label: r }))
    ];
  }, [regions]);

  const branchOptions = useMemo(() => {
    return [
      { value: "", label: "All Branches" },
      ...branches
        .filter(b => !filters.region || b.region === filters.region)
        .map(b => ({ value: b.name, label: b.name }))
    ];
  }, [branches, filters.region]);

  const dateRangeOptions = [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "mtd", label: "This Month (MTD)" },
    { value: "ytd", label: "This Year (YTD)" },
    { value: "all", label: "All Time" },
    { value: "custom", label: "Custom Range" }
  ];

  const exportFormatOptions = [
    { value: "excel", label: "Excel" },
    { value: "pdf", label: "PDF" },
    { value: "csv", label: "CSV" },
    { value: "word", label: "Word" }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
        <SkeletonTable rows={5} cols={3} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
      <h1 className="text-xs text-slate-500 mb-4 font-medium font-outfit">
        Reports / Income Statement
      </h1>

      <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        {/* Header Section */}
        <div className="p-4 border-b border-border-light flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface">
          <div>
            <h2 className="text-xs font-semibold text-heading font-outfit uppercase tracking-wider">
              {tenant?.company_name || "Company Name"}
            </h2>
            <h3 className="text-sm font-semibold text-heading font-outfit mt-1">
              Income Statement Report
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
              {(filters.region || filters.branch || dateRange !== 'mtd') && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${showFilters ? 'bg-white text-brand-primary' : 'bg-brand-primary text-white'}`}>
                  Active
                </span>
              )}
            </button>

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
            
            <button 
              onClick={fetchData}
              disabled={refreshing}
              className="p-2 rounded-lg border border-border bg-card text-muted hover:bg-surface transition-colors disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <div className="p-4 border-b border-border-light bg-card/50 space-y-4 font-outfit">
            <h4 className="text-xs font-semibold text-heading">Filter Results</h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted uppercase">Date Range</label>
                <CustomSelect
                  value={dateRange}
                  onChange={(val) => {
                    setDateRange(val);
                    setShowCustomDates(val === 'custom');
                  }}
                  options={dateRangeOptions}
                  compact
                  fullWidth
                />
              </div>

              {showCustomDates && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted uppercase">Start Date</label>
                    <DatePicker 
                      selected={startDate} 
                      onChange={setStartDate} 
                      className="w-full bg-card border border-border px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary text-xs"
                      placeholderText="Start Date"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted uppercase">End Date</label>
                    <DatePicker 
                      selected={endDate} 
                      onChange={setEndDate} 
                      className="w-full bg-card border border-border px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary text-xs"
                      placeholderText="End Date"
                    />
                  </div>
                </>
              )}

              {!['relationship_officer', 'branch_manager', 'customer_service_officer', 'regional_manager'].includes(profile?.role) && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted uppercase">Region</label>
                  <CustomSelect
                    value={filters.region}
                    onChange={(val) => handleFilterChange("region", val)}
                    options={regionOptions}
                    compact
                    fullWidth
                  />
                </div>
              )}

              {!['relationship_officer', 'branch_manager', 'customer_service_officer'].includes(profile?.role) && (
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
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={clearFilters}
                className="text-red-600 text-xs font-semibold flex items-center gap-1 hover:text-red-700 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Document Render Area */}
        <div className="p-6 md:p-10 bg-page text-sm text-body font-medium flex flex-col items-center">
          <div className="bg-card w-full max-w-[800px] border border-border rounded-xl shadow-sm p-6 md:p-12 space-y-6">
            
            {/* Header Block */}
            <div className="text-center space-y-2 pb-6 border-b border-border-light">
              <h3 className="text-sm font-bold text-heading uppercase tracking-wider">{tenant?.company_name || "Company Name"}</h3>
              <h2 className="text-lg font-bold text-heading uppercase tracking-widest">INCOME STATEMENT</h2>
              <p className="text-xs text-muted font-medium">{periodDescription}</p>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 pb-2 border-b border-heading mb-4 px-2 font-semibold text-heading text-right bg-surface rounded-t-lg">
              <div className="col-span-6 text-left text-xs">Item</div>
              <div className="col-span-3 text-xs">{periodLabel}</div>
              <div className="col-span-3 text-xs">YTD</div>
            </div>

            {/* Main Content */}
            <div className="space-y-4">
              <div className="bg-brand/10 text-brand px-3 py-1.5 font-bold text-xs rounded tracking-wider uppercase">
                REVENUE
              </div>

              <div className="px-2 space-y-4">
                {data.length > 0 ? data.map((item, idx) => (
                  <div key={idx} className="space-y-2">
                    {/* Detail Row */}
                    <div className="grid grid-cols-12 text-xs py-2 items-center hover:bg-surface/30 transition-colors rounded px-2">
                      <div className="col-span-6 pl-2 font-semibold text-heading uppercase tracking-tight">{item.name}</div>
                      <div className="col-span-3 text-right text-body font-medium">{formatCurrency(item.periodVal)}</div>
                      <div className="col-span-3 text-right text-body font-medium">{formatCurrency(item.ytdVal)}</div>
                    </div>
                    
                    {/* Subtotal Row */}
                    <div className="grid grid-cols-12 text-xs pt-1 mb-2 items-baseline px-2">
                      <div className="col-span-6 italic font-medium text-muted pl-6">Total {item.name.toLowerCase().replace('interest on ', '')}</div>
                      <div className="col-span-3 text-right">
                        <span className="border-t border-border-light pt-1 font-bold text-heading">{formatCurrency(item.periodVal)}</span>
                      </div>
                      <div className="col-span-3 text-right">
                        <span className="border-t border-border-light pt-1 font-bold text-heading">{formatCurrency(item.ytdVal)}</span>
                      </div>
                    </div>

                    {/* Separator line */}
                    {idx < data.length - 1 && <div className="border-b border-border-light mx-2"></div>}
                  </div>
                )) : (
                  <div className="py-8 text-center text-muted italic text-xs">
                    No revenue data found for this period.
                  </div>
                )}
              </div>

              {/* Total Section */}
              {data.length > 0 && (
                <div className="px-4 py-4 mt-8 bg-surface rounded-xl border border-brand/20 shadow-sm">
                  <div className="grid grid-cols-12 items-center">
                    <div className="col-span-6 uppercase font-bold text-sm tracking-tight text-heading">TOTAL REVENUE</div>
                    <div className="col-span-3 text-right">
                      <span className="text-sm text-brand font-bold">{formatCurrency(data.reduce((acc, curr) => acc + curr.periodVal, 0))}</span>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="text-sm text-brand font-bold">{formatCurrency(data.reduce((acc, curr) => acc + curr.ytdVal, 0))}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomeStatement;
