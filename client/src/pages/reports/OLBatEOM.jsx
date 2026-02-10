import React, { useState, useEffect } from "react";
import {
  Download,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  AlertCircle,
  Clock,
  CheckCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
} from "docx";
import { saveAs } from "file-saver";

const OutstandingLoanBalanceReportEOM = () => {
  const { tenant } = useAuth();
  const [reports, setReports] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [selectedMonth, setSelectedMonth] = useState("current");
  const [exportFormat, setExportFormat] = useState("csv");
  const [filters, setFilters] = useState({
    search: "",
    region: "",
    branch: "",
    loanOfficer: "",
    status: "all",
  });

  const formatCurrency = (num) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);

  const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

  const getCutoffDate = () => {
    const now = new Date();
    if (selectedMonth === "current") return endOfMonth(now);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return endOfMonth(prev);
  };

  useEffect(() => {
    const fetchBranchesAndRegions = async () => {
      try {
        if (!tenant?.id) return;
        const [branchesRes, regionsRes] = await Promise.all([
          supabase.from("branches").select("id, name, region_id").eq("tenant_id", tenant.id),
          supabase.from("regions").select("id, name").eq("tenant_id", tenant.id)
        ]);

        if (branchesRes.error) throw branchesRes.error;
        if (regionsRes.error) throw regionsRes.error;

        if (branchesRes.data) setBranches(branchesRes.data);
        if (regionsRes.data) setRegions(regionsRes.data);
      } catch (err) {
        console.error("Error fetching branches/regions:", err);
      }
    };
    fetchBranchesAndRegions();
  }, [tenant?.id]);

  const fetchOutstandingLoans = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const cutoffDate = getCutoffDate();
      cutoffDate.setHours(23, 59, 59, 999);

      const { data: loans, error } = await supabase
        .from("loans")
        .select(`
          id, 
          customer_id, 
          booked_by, 
          branch_id, 
          product_name, 
          scored_amount, 
          disbursed_at, 
          status, 
          repayment_state, 
          duration_weeks, 
          total_interest, 
          total_payable, 
          weekly_payment,
          customers (
            id, 
            Firstname, 
            Middlename, 
            Surname, 
            id_number, 
            mobile
          ),
          branches (
            id, 
            name,
            region_id
          ),
          booked_by_user:users!loans_created_by_fkey (
            id, 
            full_name
          ),
          loan_installments (
            loan_id, 
            installment_number, 
            due_date, 
            due_amount, 
            principal_amount, 
            interest_amount, 
            paid_amount, 
            principal_paid, 
            interest_paid, 
            status, 
            days_overdue
          )
        `)
        .eq("tenant_id", tenant.id)
        .in("status", ["disbursed", "approved", "ready_for_disbursement"])
        .neq("repayment_state", "completed");

      if (error) throw error;

      // Ensure regions are loaded for mapping
      let currentRegions = regions;
      if (currentRegions.length === 0) {
        const { data: rData } = await supabase
          .from("regions")
          .select("id, name")
          .eq("tenant_id", tenant.id);
        if (rData) {
          setRegions(rData);
          currentRegions = rData;
        }
      }

      const regionMap = currentRegions.reduce((acc, r) => {
        acc[r.id] = r.name;
        return acc;
      }, {});

      const reports = (loans || []).map((loan) => {
        const customer = loan.customers;
        const loanOfficer = loan.booked_by_user;
        const branch = loan.branches;
        const region_name = branch?.region_id ? regionMap[branch.region_id] || "N/A" : "N/A";

        const customer_name = customer
          ? `${customer.Firstname || ""} ${customer.Middlename || ""} ${customer.Surname || ""}`.trim()
          : "N/A";

        const loanInstallments = (loan.loan_installments || [])
          .sort((a, b) => a.installment_number - b.installment_number);

        // Calculate overdue days based on installment status and due_date
        const todayDate = new Date();

        // Find the first overdue installment to calculate max overdue days
        let maxOverdueDays = 0;
        let hasOverdueInstallment = false;

        loanInstallments.forEach((inst) => {
          const dueDate = new Date(inst.due_date);
          const isOverdue = inst.status === 'overdue' || inst.status === 'defaulted';

          if (isOverdue) {
            hasOverdueInstallment = true;
            // Calculate days between due date and today (or cutoff date if before cutoff)
            const comparisonDate = cutoffDate < todayDate ? cutoffDate : todayDate;
            const daysDiff = Math.max(0, Math.floor((comparisonDate - dueDate) / (1000 * 60 * 60 * 24)));

            // If installment has days_overdue field, use it, otherwise calculate
            const overdueDays = inst.days_overdue || daysDiff;
            maxOverdueDays = Math.max(maxOverdueDays, overdueDays);
          }
        });

        // Outstanding installments: all installments with status not 'paid'
        const outstandingInstallments = loanInstallments.filter(
          (inst) => inst.status !== 'paid'
        );

        // Installments due by cutoff date that are not fully paid
        const installmentsDueByCutoff = loanInstallments.filter(
          (inst) => new Date(inst.due_date) <= cutoffDate
        );

        // Arrears amount: sum of unpaid amounts for overdue/defaulted installments
        let arrearsAmount = 0;
        loanInstallments.forEach((inst) => {
          if (inst.status === 'overdue' || inst.status === 'defaulted') {
            const unpaidAmount = Math.max(0,
              (Number(inst.due_amount) || 0) - (Number(inst.paid_amount) || 0)
            );
            arrearsAmount += unpaidAmount;
          }
        });

        // Total paid amounts (from loan_installments table)
        const totalPrincipalPaid = loanInstallments.reduce(
          (sum, inst) => sum + (Number(inst.principal_paid) || 0),
          0
        );

        const totalInterestPaid = loanInstallments.reduce(
          (sum, inst) => sum + (Number(inst.interest_paid) || 0),
          0
        );

        const totalAmountPaid = loanInstallments.reduce(
          (sum, inst) => sum + (Number(inst.paid_amount) || 0),
          0
        );

        const principal = Number(loan.scored_amount) || 0;
        const interest = Number(loan.total_interest) || 0;
        const total_payable = Number(loan.total_payable) || 0;

        const outstanding_balance = Math.max(0, total_payable - totalAmountPaid);
        const percent_paid = total_payable > 0 ? (totalAmountPaid / total_payable) * 100 : 0;
        const percent_unpaid = Math.max(0, 100 - percent_paid);

        // Determine repayment status
        let repaymentStatus = "ongoing";
        if (hasOverdueInstallment) {
          if (maxOverdueDays > 30) {
            repaymentStatus = "defaulted";
          } else {
            repaymentStatus = "overdue";
          }
        }

        return {
          id: loan.id,
          customer_name,
          region_name,
          customer_id: customer?.id_number || "N/A",
          mobile: customer?.mobile || "N/A",
          product_name: loan.product_name || "N/A",
          branch: branch?.name || "N/A",
          branch_id: branch?.id || "N/A",
          loan_officer: loanOfficer?.full_name || "N/A",
          loan_officer_id: loanOfficer?.id || "N/A",
          disbursement_date: loan.disbursed_at
            ? new Date(loan.disbursed_at).toLocaleDateString()
            : "N/A",
          loan_end_date:
            loan.duration_weeks && loan.disbursed_at
              ? new Date(
                new Date(loan.disbursed_at).getTime() +
                loan.duration_weeks * 7 * 24 * 60 * 60 * 1000
              ).toLocaleDateString()
              : "N/A",
          repayment_state: repaymentStatus,
          status: loan.status,

          principal,
          interest,
          total_payable,

          // Total outstanding installments (all unpaid ones)
          outstanding_installments: outstandingInstallments.length,

          principal_paid: totalPrincipalPaid,
          interest_paid: totalInterestPaid,
          total_amount_paid: totalAmountPaid,

          outstanding_balance,

          percent_paid,
          percent_unpaid,

          arrears_amount: arrearsAmount,
          overdue_days: maxOverdueDays,
        };
      });

      setReports(reports);
      const grouped = groupByBranchAndOfficer(reports);
      setFiltered(grouped);

      const uniqueOfficers = [
        ...new Set(reports.map((r) => r.loan_officer).filter((o) => o !== "N/A")),
      ];
      setOfficers(uniqueOfficers);
    } catch (err) {
      console.error("fetchOutstandingLoans error:", err);
      alert(`Error loading data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenant?.id && regions.length > 0) {
      fetchOutstandingLoans();
    }
  }, [tenant?.id, selectedMonth, regions]);

  const groupByBranchAndOfficer = (data) => {
    const grouped = {};

    data.forEach((loan) => {
      const branchName = loan.branch || "N/A";
      const officerName = loan.loan_officer || "N/A";

      if (!grouped[branchName]) {
        grouped[branchName] = {
          branchName,
          regionName: loan.region_name || "N/A",
          totalLoanAmount: 0,
          totalOutstanding: 0,
          officers: {},
        };
      }

      if (!grouped[branchName].officers[officerName]) {
        grouped[branchName].officers[officerName] = {
          officerName,
          portfolioOutstanding: 0,
          loans: [],
        };
      }

      grouped[branchName].totalLoanAmount += loan.total_payable;
      grouped[branchName].totalOutstanding += loan.outstanding_balance;
      grouped[branchName].officers[officerName].portfolioOutstanding += loan.outstanding_balance;
      grouped[branchName].officers[officerName].loans.push(loan);
    });

    return Object.values(grouped).map((branch) => ({
      ...branch,
      officers: Object.values(branch.officers),
    }));
  };

  useEffect(() => {
    let result = [...reports];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) =>
          (r.customer_name || "").toLowerCase().includes(q) ||
          String(r.mobile || "").toLowerCase().includes(q) ||
          String(r.customer_id || "").toLowerCase().includes(q)
      );
    }

    if (filters.region) result = result.filter((r) => r.region_name === filters.region);
    if (filters.branch) result = result.filter((r) => r.branch === filters.branch);
    if (filters.loanOfficer) result = result.filter((r) => r.loan_officer === filters.loanOfficer);
    if (filters.status !== "all") result = result.filter((r) => r.repayment_state === filters.status);

    const grouped = groupByBranchAndOfficer(result);
    setFiltered(grouped);
    setCurrentPage(1);
  }, [filters, reports]);

  const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const clearFilters = () => setFilters({ search: "", region: "", branch: "", loanOfficer: "", status: "all" });

  const exportToCSV = () => {
    const allLoansData = filtered.flatMap((branch) => branch.officers.flatMap((o) => o.loans));
    if (allLoansData.length === 0) {
      alert("No data to export");
      return;
    }

    const companyName = tenant?.company_name || "Jasiri";
    const header = [
      "Branch",
      "Region",
      "Loan Officer",
      "Customer Name",
      "Phone Number",
      "ID Number",
      "Principal",
      "Interest",
      "Total Payable",
      "Outstanding Installments",
      "Principal Paid",
      "Interest Paid",
      "Total Amount Paid",
      "% Paid",
      "% Unpaid",
      "Outstanding Balance",
      "Arrears",
      "Overdue Days",
      "Disbursement Date",
      "Loan End Date",
    ];

    const rows = allLoansData.map((r) => [
      r.branch,
      r.region_name,
      r.loan_officer,
      `"${r.customer_name}"`,
      r.mobile,
      r.customer_id,
      (r.principal || 0).toFixed(2),
      (r.interest || 0).toFixed(2),
      (r.total_payable || 0).toFixed(2),
      r.outstanding_installments || 0,
      (r.principal_paid || 0).toFixed(2),
      (r.interest_paid || 0).toFixed(2),
      (r.total_amount_paid || 0).toFixed(2),
      (r.percent_paid || 0).toFixed(2),
      (r.percent_unpaid || 0).toFixed(2),
      (r.outstanding_balance || 0).toFixed(2),
      (r.arrears_amount || 0).toFixed(2),
      r.overdue_days || 0,
      r.disbursement_date,
      r.loan_end_date,
    ]);

    const csvContent = "\ufeff" + [header, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const fileName = `${companyName.toLowerCase().replace(/ /g, "_")}_eom_outstanding_${new Date().toISOString().split("T")[0]}.csv`;
    link.download = fileName;
    link.click();
  };

  const exportToExcel = () => {
    const allLoansData = filtered.flatMap((branch) => branch.officers.flatMap((o) => o.loans));
    if (allLoansData.length === 0) {
      alert("No data available to export.");
      return;
    }

    const companyName = tenant?.company_name || "Jasiri";
    const worksheetData = allLoansData.map((r) => ({
      "Branch": r.branch,
      "Region": r.region_name,
      "Loan Officer": r.loan_officer,
      "Customer Name": r.customer_name,
      "Phone Number": r.mobile,
      "ID Number": r.customer_id,
      "Principal": r.principal,
      "Interest": r.interest,
      "Total Payable": r.total_payable,
      "Outstanding Installments": r.outstanding_installments,
      "Principal Paid": r.principal_paid,
      "Interest Paid": r.interest_paid,
      "Total Amount Paid": r.total_amount_paid,
      "% Paid": r.percent_paid.toFixed(2),
      "% Unpaid": r.percent_unpaid.toFixed(2),
      "Outstanding Balance": r.outstanding_balance,
      "Arrears": r.arrears_amount,
      "Overdue Days": r.overdue_days,
      "Disbursement Date": r.disbursement_date,
      "Loan End Date": r.loan_end_date,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "EOM Outstanding Balance");
    const fileName = `${companyName.toLowerCase().replace(/ /g, "_")}_eom_outstanding_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const exportToPDF = () => {
    const allLoansData = filtered.flatMap((branch) => branch.officers.flatMap((o) => o.loans));
    if (allLoansData.length === 0) {
      alert("No data available to export.");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", format: "a4", unit: "pt" });
    const companyName = tenant?.company_name || "Jasiri";
    const reportTitle = "EOM Outstanding Loan Balance Report";

    const tableColumn = [
      "No", "Branch", "Region", "Officer", "Customer", "Phone", "Principal", "Total Payable", "Pd %", "Bal", "Days Ov", "Arrears"
    ];

    const tableRows = allLoansData.map((r, i) => [
      i + 1,
      r.branch,
      r.region_name,
      r.loan_officer.length > 12 ? r.loan_officer.substring(0, 10) + ".." : r.loan_officer,
      r.customer_name.length > 15 ? r.customer_name.substring(0, 13) + ".." : r.customer_name,
      r.mobile,
      formatCurrency(r.principal).replace("KES", "").trim(),
      formatCurrency(r.total_payable).replace("KES", "").trim(),
      r.percent_paid.toFixed(1) + "%",
      formatCurrency(r.outstanding_balance).replace("KES", "").trim(),
      r.overdue_days || 0,
      formatCurrency(r.arrears_amount).replace("KES", "").trim(),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      didDrawPage: (data) => {
        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text(companyName, data.settings.margin.left, 40);
        doc.setFontSize(12);
        doc.text(reportTitle, data.settings.margin.left, 60);
        doc.setFontSize(10);
        doc.text(
          `Generated: ${new Date().toLocaleDateString('en-GB')} | Snapshot: ${cutoffDate.toLocaleDateString('en-GB')} | Total Loans: ${allLoansData.length}`,
          data.settings.margin.left,
          80
        );
      },
      startY: 100,
      margin: { top: 100, left: 15, right: 15 },
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [46, 94, 153], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 50 },
        2: { cellWidth: 50 },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'center' },
        9: { halign: 'right', fontStyle: 'bold' },
        10: { halign: 'center' },
        11: { halign: 'right' },
      }
    });

    const fileName = `${companyName.toLowerCase().replace(/ /g, "_")}_eom_outstanding_${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(fileName);
  };

  const exportToWord = async () => {
    const allLoansData = filtered.flatMap((branch) => branch.officers.flatMap((o) => o.loans));
    if (allLoansData.length === 0) {
      alert("No data available to export.");
      return;
    }

    const companyName = tenant?.company_name || "Jasiri";
    const reportTitle = "EOM Outstanding Loan Balance Report";

    const table = new DocxTable({
      rows: [
        new DocxTableRow({
          children: [
            "No", "Branch", "Region", "Officer", "Customer", "Phone", "Principal", "Total Payable", "Balance", "Arrears", "Days Ov"
          ].map(h => new DocxTableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16 })] })]
          }))
        }),
        ...allLoansData.map((r, i) => new DocxTableRow({
          children: [
            (i + 1).toString(),
            r.branch,
            r.region_name,
            r.loan_officer,
            r.customer_name,
            r.mobile,
            formatCurrency(r.principal),
            formatCurrency(r.total_payable),
            formatCurrency(r.outstanding_balance),
            formatCurrency(r.arrears_amount),
            (r.overdue_days || 0).toString()
          ].map(v => new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: v, size: 16 })] })] }))
        }))
      ]
    });

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            children: [new TextRun({ text: companyName, bold: true, size: 32 })]
          }),
          new Paragraph({
            children: [new TextRun({ text: reportTitle, bold: true, size: 24 })]
          }),
          new Paragraph({
            children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString()} | Snapshot: ${cutoffDate.toLocaleDateString()}`, size: 18 })]
          }),
          new Paragraph({ text: "" }),
          table
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    const fileName = `${companyName.toLowerCase().replace(/ /g, "_")}_eom_outstanding_${new Date().toISOString().split("T")[0]}.docx`;
    saveAs(blob, fileName);
  };

  const handleExport = async () => {
    const allLoansData = filtered.flatMap((branch) => branch.officers.flatMap((o) => o.loans));
    if (allLoansData.length === 0) {
      alert("No data available to export.");
      return;
    }

    switch (exportFormat) {
      case "pdf":
        exportToPDF();
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

  const allLoans = filtered.flatMap((branch) => branch.officers.flatMap((officer) => officer.loans));
  const totalPages = Math.ceil(allLoans.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;

  // const totalOutstanding = allLoans.reduce((s, r) => s + (r.outstanding_balance || 0), 0);
  // const totalPaid = allLoans.reduce((s, r) => s + (r.total_amount_paid || 0), 0);
  // const totalArrears = allLoans.reduce((s, r) => s + (r.arrears_amount || 0), 0);

  const cutoffDate = getCutoffDate();

  return (
    <div className="min-h-screen bg-brand-surface pb-12">
      {/* HEADER SECTION */}
      <div className="bg-brand-secondary border-b border-gray-200 shadow-sm relative z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {tenant?.logo_url ? (
                <div className="w-14 h-14 bg-white p-2 rounded-xl shadow-md border border-gray-100 flex items-center justify-center overflow-hidden transition-transform hover:rotate-3">
                  <img src={tenant.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <div className="w-14 h-14 bg-brand-secondary rounded-xl flex items-center justify-center shadow-lg transition-transform hover:-rotate-3">
                  <FileText className="w-7 h-7 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  {tenant?.company_name || "Jasiri"}

                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <p className="text-sm font-bold text-white">OLB at EOM</p>
                  <div className="flex items-center gap-1.5 text-xs text-blue-100 font-medium bg-white/10 px-2 py-0.5 rounded-md border border-white/20">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Snapshot: <span className="text-white font-bold">{cutoffDate.toLocaleDateString('en-GB')}</span></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="text-[10px] text-blue-100 uppercase tracking-wider font-bold text-right opacity-80">
                <p>Generated on:</p>
                <p className="text-sm font-bold text-white tracking-tight">{new Date().toLocaleString()}</p>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap justify-end">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                    placeholder="Search name, ID, or phone"
                    className="border bg-gray-50 border-gray-300 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm w-64"
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
      </div>

      <div className="max-w-[1600px] mx-auto px-6 mt-6 space-y-6">

        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-brand-primary" />
                Report Filters
              </h3>
              {(filters.region || filters.branch || filters.loanOfficer || filters.status !== "all") && (
                <button
                  onClick={clearFilters}
                  className="text-sm font-semibold text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Region</label>
                <select
                  value={filters.region}
                  onChange={(e) => handleFilterChange("region", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
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
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
                >
                  <option value="">All Branches</option>
                  {branches
                    .filter(b => !filters.region || regions.find(r => r.name === filters.region)?.id === b.region_id)
                    .map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Officer</label>
                <select
                  value={filters.loanOfficer}
                  onChange={(e) => handleFilterChange("loanOfficer", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
                >
                  <option value="">All Officers</option>
                  {officers.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Payment Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
                >
                  <option value="all">All Statuses</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="overdue">Overdue</option>
                  <option value="defaulted">Defaulted</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Snapshot Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-all"
                >
                  <option value="current">Current Month</option>
                  <option value="previous">Previous Month</option>
                </select>
              </div>
            </div>
          </div>
        )}



        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600 font-medium">Calculating portfolio snapshot for EOM...</p>
          </div>
        ) : allLoans.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">No outstanding loans found</h3>
              <p className="text-gray-500 max-w-sm">There are no active loans matching your current criteria for the selected EOM snapshot.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2 border-gray-300 sticky top-0">
                  <tr>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Branch</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Region</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Loan Amount</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Total Outstanding</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Loan Officer</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Officer Portfolio</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Customer Name</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Phone</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">ID Number</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Principal</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Interest</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Total Payable</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">Outstanding Installments</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Principal Paid</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Interest Paid</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Total Paid</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">% Paid</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">% Unpaid</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Outstanding Balance</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Arrears</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">Overdue Days</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Disbursement</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">End Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((branch, branchIdx) => {
                    let loanCounter = 0;
                    return branch.officers.map((officer, officerIdx) => {
                      const officerLoans = officer.loans.slice(
                        Math.max(0, startIdx - loanCounter),
                        Math.max(0, endIdx - loanCounter)
                      );
                      loanCounter += officer.loans.length;

                      if (officerLoans.length === 0) return null;

                      return officerLoans.map((loan, loanIdx) => {
                        const isFirstInBranch = officerIdx === 0 && loanIdx === 0;
                        const isFirstInOfficer = loanIdx === 0;
                        const officerLoanCount = officer.loans.length;

                        return (
                          <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                            {isFirstInBranch ? (
                              <>
                                <td rowSpan={branch.officers.reduce((sum, o) => sum + o.loans.length, 0)}
                                  className="px-3 py-3 text-gray-900 font-bold bg-blue-50 border-r-2 border-blue-200 align-top whitespace-nowrap">
                                  {branch.branchName}
                                </td>
                                <td rowSpan={branch.officers.reduce((sum, o) => sum + o.loans.length, 0)}
                                  className="px-3 py-3 text-gray-900 font-bold bg-blue-50 border-r-2 border-blue-200 align-top whitespace-nowrap">
                                  {branch.regionName}
                                </td>
                                <td rowSpan={branch.officers.reduce((sum, o) => sum + o.loans.length, 0)}
                                  className="px-3 py-3 text-right text-blue-700 font-bold bg-blue-50 border-r-2 border-blue-200 align-top whitespace-nowrap">
                                  {formatCurrency(branch.totalLoanAmount)}
                                </td>
                                <td rowSpan={branch.officers.reduce((sum, o) => sum + o.loans.length, 0)}
                                  className="px-3 py-3 text-right text-blue-700 font-bold bg-blue-50 border-r-2 border-blue-200 align-top whitespace-nowrap">
                                  {formatCurrency(branch.totalOutstanding)}
                                </td>
                              </>
                            ) : null}

                            {isFirstInOfficer ? (
                              <>
                                <td rowSpan={officerLoanCount}
                                  className="px-3 py-3 text-gray-800 font-semibold bg-green-50 border-r border-green-200 align-top whitespace-nowrap">
                                  {officer.officerName}
                                </td>
                                <td rowSpan={officerLoanCount}
                                  className="px-3 py-3 text-right text-green-700 font-bold bg-green-50 border-r border-green-200 align-top whitespace-nowrap">
                                  {formatCurrency(officer.portfolioOutstanding)}
                                </td>
                              </>
                            ) : null}

                            <td className="px-3 py-3 text-gray-900 font-medium whitespace-nowrap">{loan.customer_name}</td>
                            <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{loan.mobile}</td>
                            <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{loan.customer_id}</td>
                            <td className="px-3 py-3 text-right text-gray-900 whitespace-nowrap">{formatCurrency(loan.principal)}</td>
                            <td className="px-3 py-3 text-right text-gray-900 whitespace-nowrap">{formatCurrency(loan.interest)}</td>
                            <td className="px-3 py-3 text-right text-gray-900 font-semibold whitespace-nowrap">{formatCurrency(loan.total_payable)}</td>
                            <td className="px-3 py-3 text-center text-gray-700 whitespace-nowrap">{loan.outstanding_installments}</td>

                            <td className="px-3 py-3 text-right text-green-700 font-semibold whitespace-nowrap">{formatCurrency(loan.principal_paid)}</td>
                            <td className="px-3 py-3 text-right text-green-700 font-semibold whitespace-nowrap">{formatCurrency(loan.interest_paid)}</td>

                            <td className="px-3 py-3 text-right text-green-700 font-semibold whitespace-nowrap">{formatCurrency(loan.total_amount_paid)}</td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${loan.percent_paid >= 75 ? 'bg-green-100 text-green-800' :
                                loan.percent_paid >= 50 ? 'bg-blue-100 text-blue-800' :
                                  loan.percent_paid >= 25 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                }`}>
                                {(loan.percent_paid || 0).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${loan.percent_unpaid <= 25 ? 'bg-green-100 text-green-800' :
                                loan.percent_unpaid <= 50 ? 'bg-blue-100 text-blue-800' :
                                  loan.percent_unpaid <= 75 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                }`}>
                                {(loan.percent_unpaid || 0).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right text-blue-700 font-bold whitespace-nowrap">{formatCurrency(loan.outstanding_balance)}</td>
                            <td className="px-3 py-3 text-right text-red-700 font-semibold whitespace-nowrap">{formatCurrency(loan.arrears_amount)}</td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              {(loan.overdue_days || 0) > 0 ? (
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${(loan.overdue_days || 0) <= 7 ? 'bg-yellow-100 text-yellow-800' :
                                  (loan.overdue_days || 0) <= 30 ? 'bg-orange-100 text-orange-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                  {loan.overdue_days}
                                </span>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{loan.disbursement_date}</td>
                            <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{loan.loan_end_date}</td>
                          </tr>
                        );
                      });
                    });
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{startIdx + 1}</span> to{' '}
                <span className="font-semibold">{Math.min(endIdx, allLoans.length)}</span> of{' '}
                <span className="font-semibold">{allLoans.length}</span> loans
              </div>

              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg border border-gray-300 transition-all ${currentPage === 1
                  ? "opacity-40 cursor-not-allowed bg-gray-50"
                  : "bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 active:scale-95"
                  }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, i, arr) => (
                    <React.Fragment key={p}>
                      {i > 0 && arr[i - 1] !== p - 1 && <span className="text-gray-400 px-1">...</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`w-10 h-10 rounded-lg font-bold transition-all ${currentPage === p
                          ? "bg-accent text-white shadow-lg scale-105"
                          : "text-gray-600 hover:bg-white border border-transparent hover:border-gray-300"
                          }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={`p-2 rounded-lg border border-gray-300 transition-all ${currentPage === totalPages
                  ? "opacity-40 cursor-not-allowed bg-gray-50"
                  : "bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 active:scale-95"
                  }`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OutstandingLoanBalanceReportEOM;