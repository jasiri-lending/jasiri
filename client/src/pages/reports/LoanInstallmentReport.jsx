import React, { useState, useEffect } from "react";
import { Download, Filter, X, ChevronLeft, ChevronRight, Search, FileText, FileSpreadsheet, ChevronDown, AlertCircle, Clock, CheckCircle } from "lucide-react";
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

const LoanInstallmentReport = () => {
  const { tenant } = useAuth();
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    branch: "",
    installmentRange: "all",
    paymentStatus: "all",
    overdueStatus: "all"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [exportFormat, setExportFormat] = useState("csv");

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      if (!tenant?.id) return;
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .eq("tenant_id", tenant.id);
      if (!error) setBranches(data || []);
    };
    fetchBranches();
  }, [tenant?.id]);

  // Fetch data and compute installment counts
  useEffect(() => {
    const fetchInstallmentData = async () => {
      try {
        if (!tenant?.id) return;
        setLoading(true);

        // Fetch all necessary data with joins
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
            duration_weeks,
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
              name
            ),
            booked_by_user:users!loans_created_by_fkey (
              id, 
              full_name
            ),
            loan_installments (
              loan_id, 
              installment_number, 
              due_amount, 
              paid_amount, 
              status, 
              due_date, 
              paid_date, 
              days_overdue
            )
          `)
          .eq("tenant_id", tenant.id)
          .in("status", ["active", "disbursed"]);

        if (error) throw error;

        // Process each loan
        const installmentReports = loans.map((loan) => {
          // Sort installments by installment number
          const customer = loan.customers;
          const loanOfficer = loan.booked_by_user;
          const branch = loan.branches;
          const loanInstallments = loan.loan_installments || [];
          const fullName = [
            customer?.Firstname,
            customer?.Middlename,
            customer?.Surname
          ].filter(Boolean).join(" ") || "N/A";

          const sortedInstallments = [...loanInstallments].sort((a, b) =>
            a.installment_number - b.installment_number
          );

          // Calculate installment statistics
          const totalInstallments = Math.min(loan.duration_weeks || 0, 8);

          // Count installments by status
          const paidInstallments = loanInstallments.filter(i => i.status === 'paid').length;
          const pendingInstallments = loanInstallments.filter(i => i.status === 'pending').length;
          const overdueInstallments = loanInstallments.filter(i => i.status === 'overdue').length;
          const partialInstallments = loanInstallments.filter(i => i.status === 'partial').length;
          const defaultedInstallments = loanInstallments.filter(i => i.status === 'defaulted').length;

          // KEY FEATURE: Check for partially paid AND overdue installments
          const partialOverdueInstallments = loanInstallments.filter(i =>
            i.status === 'partial' && i.days_overdue > 0
          );

          // Calculate amounts
          const totalPaidAmount = loanInstallments.reduce((sum, inst) =>
            sum + (Number(inst.paid_amount) || 0), 0
          );

          const totalDueAmount = loanInstallments.reduce((sum, inst) =>
            sum + (Number(inst.due_amount) || 0), 0
          );

          // Calculate partial amounts
          const partialAmount = loanInstallments
            .filter(i => i.status === 'partial')
            .reduce((sum, inst) => sum + (Number(inst.paid_amount) || 0), 0);

          // Calculate overdue amounts
          const overdueAmount = loanInstallments
            .filter(i => i.status === 'overdue')
            .reduce((sum, inst) => sum + (Number(inst.due_amount) || 0), 0);

          // Calculate overdue paid amounts
          const overduePaidAmount = loanInstallments
            .filter(i => i.status === 'overdue')
            .reduce((sum, inst) => sum + (Number(inst.paid_amount) || 0), 0);

          // Find next due date - first pending, overdue, or partial installment
          const nextInstallment = sortedInstallments.find(inst =>
            ['pending', 'overdue', 'partial'].includes(inst.status)
          );

          // Calculate days since last payment - include both paid and partial installments
          const paidAndPartialInstallments = sortedInstallments.filter(inst =>
            (inst.status === 'paid' || inst.status === 'partial') && inst.paid_date
          );

          const lastPayment = paidAndPartialInstallments.length > 0
            ? paidAndPartialInstallments[paidAndPartialInstallments.length - 1].paid_date
            : null;

          const daysSinceLastPayment = lastPayment
            ? Math.floor((new Date() - new Date(lastPayment)) / (1000 * 60 * 60 * 24))
            : null;

          // Calculate maximum days overdue
          const maxDaysOverdue = loanInstallments.reduce((max, inst) => {
            const days = inst.days_overdue || 0;
            return days > max ? days : max;
          }, 0);

          // Determine repayment status
          let repaymentStatus = "No Payments";
          let repaymentStatusColor = "gray";

          if (totalPaidAmount > 0) {
            if (totalPaidAmount >= totalDueAmount) {
              repaymentStatus = "Fully Paid";
              repaymentStatusColor = "green";
            } else if (partialOverdueInstallments.length > 0) {
              repaymentStatus = "Partial & Overdue";
              repaymentStatusColor = "orange";
            } else if (partialInstallments > 0 && overdueInstallments === 0) {
              repaymentStatus = "Partially Paid";
              repaymentStatusColor = "blue";
            } else if (overdueInstallments > 0 && partialInstallments === 0) {
              repaymentStatus = "Overdue";
              repaymentStatusColor = "red";
            } else if (defaultedInstallments > 0) {
              repaymentStatus = "Defaulted";
              repaymentStatusColor = "red";
            } else {
              repaymentStatus = "In Progress";
              repaymentStatusColor = "yellow";
            }
          }

          // Calculate completion status
          let completionStatus = "Not Started";
          if (paidInstallments === totalInstallments && totalInstallments > 0) {
            completionStatus = "Completed";
          } else if (paidInstallments > 0 || partialInstallments > 0) {
            completionStatus = "In Progress";
          }

          // Get partial installment numbers
          const partialInstallmentNumbers = loanInstallments
            .filter(i => i.status === 'partial')
            .map(i => i.installment_number)
            .sort((a, b) => a - b)
            .join(", ");

          // Get overdue installment numbers
          const overdueInstallmentNumbers = loanInstallments
            .filter(i => i.status === 'overdue')
            .map(i => i.installment_number)
            .sort((a, b) => a - b)
            .join(", ");

          return {
            id: loan.id,
            customer_id: loan.customer_id,
            customer_name: fullName,
            customer_id_number: customer?.id_number || "N/A",
            mobile: customer?.mobile || "N/A",
            branch: branch?.name || "N/A",
            branch_id: branch?.id || "N/A",
            loan_officer: loanOfficer?.full_name || "N/A",
            product_name: loan.product_name || "N/A",
            loan_amount: Number(loan.scored_amount) || 0,

            // Installment counts
            total_installments: totalInstallments,
            paid_installments: paidInstallments,
            pending_installments: pendingInstallments,
            overdue_installments: overdueInstallments,
            partial_installments: partialInstallments,
            defaulted_installments: defaultedInstallments,
            partial_overdue_installments: partialOverdueInstallments.length,

            // Amounts
            total_paid_amount: totalPaidAmount,
            total_due_amount: totalDueAmount,
            partial_amount: partialAmount,
            overdue_amount: overdueAmount,
            overdue_paid_amount: overduePaidAmount,

            // Dates and timing
            completion_percentage: totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0,
            payment_percentage: totalDueAmount > 0 ? (totalPaidAmount / totalDueAmount) * 100 : 0,
            completion_status: completionStatus,
            repayment_status: repaymentStatus,
            repayment_status_color: repaymentStatusColor,
            next_due_date: nextInstallment?.due_date || "N/A",
            last_payment_date: lastPayment || "No payments yet",
            days_since_last_payment: daysSinceLastPayment,
            max_days_overdue: maxDaysOverdue,

            // Additional details
            partial_installment_numbers: partialInstallmentNumbers,
            overdue_installment_numbers: overdueInstallmentNumbers,
            has_partial_overdue: partialOverdueInstallments.length > 0,

            disbursement_date: loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : "N/A",
            loan_end_date: loan.duration_weeks && loan.disbursed_at
              ? new Date(new Date(loan.disbursed_at).getTime() + Math.min(loan.duration_weeks, 8) * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
              : "N/A",

            // For filtering
            paid_installments_count: paidInstallments,
          };
        });

        setReports(installmentReports);
        setFilteredReports(installmentReports);
      } catch (err) {
        console.error("Error fetching installment data:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInstallmentData();
  }, [tenant?.id]);

  // Apply filters
  useEffect(() => {
    let result = [...reports];

    // Search filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((r) =>
        r.customer_name.toLowerCase().includes(q) ||
        r.mobile.includes(q) ||
        r.customer_id_number.toString().includes(q)
      );
    }

    // Branch filter
    if (filters.branch) {
      result = result.filter((r) => r.branch === filters.branch);
    }

    // Installment range filter
    if (filters.installmentRange !== "all") {
      if (filters.installmentRange === "0") {
        result = result.filter((r) => r.paid_installments === 0);
      } else if (filters.installmentRange === "2-8") {
        result = result.filter((r) => r.paid_installments >= 2 && r.paid_installments <= 8);
      } else {
        const installmentNumber = parseInt(filters.installmentRange);
        if (!isNaN(installmentNumber)) {
          result = result.filter((r) => r.paid_installments === installmentNumber);
        }
      }
    }

    // Payment status filter
    if (filters.paymentStatus !== "all") {
      if (filters.paymentStatus === "partial") {
        result = result.filter((r) => r.partial_installments > 0);
      } else if (filters.paymentStatus === "partial_overdue") {
        result = result.filter((r) => r.has_partial_overdue);
      } else if (filters.paymentStatus === "overdue") {
        result = result.filter((r) => r.overdue_installments > 0);
      } else if (filters.paymentStatus === "defaulted") {
        result = result.filter((r) => r.defaulted_installments > 0);
      } else if (filters.paymentStatus === "no_payment") {
        result = result.filter((r) => r.total_paid_amount === 0);
      } else if (filters.paymentStatus === "fully_paid") {
        result = result.filter((r) => r.repayment_status === "Fully Paid");
      }
    }

    // Overdue status filter
    if (filters.overdueStatus !== "all") {
      if (filters.overdueStatus === "overdue_7") {
        result = result.filter((r) => r.max_days_overdue <= 7 && r.max_days_overdue > 0);
      } else if (filters.overdueStatus === "overdue_14") {
        result = result.filter((r) => r.max_days_overdue > 7 && r.max_days_overdue <= 14);
      } else if (filters.overdueStatus === "overdue_30") {
        result = result.filter((r) => r.max_days_overdue > 14 && r.max_days_overdue <= 30);
      } else if (filters.overdueStatus === "overdue_30_plus") {
        result = result.filter((r) => r.max_days_overdue > 30);
      }
    }

    setFilteredReports(result);
    setCurrentPage(1);
  }, [filters, reports]);

  const handleFilterChange = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () =>
    setFilters({
      search: "",
      branch: "",
      installmentRange: "all",
      paymentStatus: "all",
      overdueStatus: "all"
    });

  const formatCurrency = (num) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);

  // Export to CSV
  const exportToCSV = () => {
    if (filteredReports.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = [
      "Customer Name",
      "ID Number",
      "Phone Number",
      "Branch",
      "Loan Officer",
      "Product",
      "Loan Amount",
      "Total Installments",
      "Paid Installments",
      "Pending Installments",
      "Overdue Installments",
      "Partial Installments",
      "Partial & Overdue Installments",
      "Defaulted Installments",
      "Repayment Status",
      "Total Paid Amount",
      "Total Due Amount",
      "Partial Amount",
      "Overdue Amount",
      "Payment %",
      "Next Due Date",
      "Last Payment Date",
      "Days Since Last Payment",
      "Max Days Overdue",
      "Partial Installment Numbers",
      "Overdue Installment Numbers",
      "Disbursement Date",
      "Loan End Date",
    ];

    const csv = [
      headers,
      ...filteredReports.map((r) => [
        `"${r.customer_name}"`,
        r.customer_id_number,
        r.mobile,
        `"${r.branch}"`,
        `"${r.loan_officer}"`,
        `"${r.product_name}"`,
        (r.loan_amount || 0).toFixed(2),
        r.total_installments || 0,
        r.paid_installments || 0,
        r.pending_installments || 0,
        r.overdue_installments || 0,
        r.partial_installments || 0,
        r.partial_overdue_installments || 0,
        r.defaulted_installments || 0,
        `"${r.repayment_status}"`,
        (r.total_paid_amount || 0).toFixed(2),
        (r.total_due_amount || 0).toFixed(2),
        (r.partial_amount || 0).toFixed(2),
        (r.overdue_amount || 0).toFixed(2),
        (r.payment_percentage || 0).toFixed(2),
        r.next_due_date !== "N/A" ? new Date(r.next_due_date).toLocaleDateString('en-GB') : "N/A",
        r.last_payment_date !== "No payments yet" ? new Date(r.last_payment_date).toLocaleDateString('en-GB') : "No payments",
        r.days_since_last_payment || "N/A",
        r.max_days_overdue || 0,
        `"${r.partial_installment_numbers || ""}"`,
        `"${r.overdue_installment_numbers || ""}"`,
        r.disbursement_date,
        r.loan_end_date,
      ])
    ]
      .map((row) => row.join(","))
      .join("\n");

    const companyName = tenant?.company_name || "Jasiri";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName = `${companyName.toLowerCase().replace(/ /g, "_")}_installments_${new Date().toISOString().split("T")[0]}.csv`;
    a.download = fileName;
    a.click();
  };

  // Export to Excel
  const exportToExcel = () => {
    if (filteredReports.length === 0) {
      alert("No data to export");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(
      filteredReports.map(r => ({
        "Customer Name": r.customer_name,
        "ID Number": r.customer_id_number,
        "Phone Number": r.mobile,
        "Branch": r.branch,
        "Loan Officer": r.loan_officer,
        "Product": r.product_name,
        "Loan Amount": r.loan_amount,
        "Total Installments": r.total_installments,
        "Paid Installments": r.paid_installments,
        "Pending Installments": r.pending_installments,
        "Overdue Installments": r.overdue_installments,
        "Partial Installments": r.partial_installments,
        "Partial & Overdue Installments": r.partial_overdue_installments,
        "Defaulted Installments": r.defaulted_installments,
        "Repayment Status": r.repayment_status,
        "Total Paid Amount": (r.total_paid_amount || 0).toFixed(2),
        "Total Due Amount": (r.total_due_amount || 0).toFixed(2),
        "Partial Amount": (r.partial_amount || 0).toFixed(2),
        "Overdue Amount": (r.overdue_amount || 0).toFixed(2),
        "Payment %": (r.payment_percentage || 0).toFixed(2),
        "Next Due Date": r.next_due_date !== "N/A" ? new Date(r.next_due_date).toLocaleDateString('en-GB') : "N/A",
        "Last Payment Date": r.last_payment_date !== "No payments yet" ? new Date(r.last_payment_date).toLocaleDateString('en-GB') : "No payments",
        "Days Since Last Payment": r.days_since_last_payment,
        "Max Days Overdue": r.max_days_overdue,
        "Partial Installment Numbers": r.partial_installment_numbers,
        "Overdue Installment Numbers": r.overdue_installment_numbers,
        "Disbursement Date": r.disbursement_date,
        "Loan End Date": r.loan_end_date,
      }))
    );

    const companyName = tenant?.company_name || "Jasiri";
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Loan Installments");
    const fileName = `${companyName.toLowerCase().replace(/ /g, "_")}_installments_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };
  // Export to PDF
  const exportToPDF = () => {
    if (filteredReports.length === 0) {
      alert("No data to export");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", format: "a4", unit: "pt" });
    const companyName = tenant?.company_name || "Jasiri";
    const reportTitle = "Loan Installment Report";

    const tableColumn = [
      "No",
      "Customer",
      "ID",
      "Phone",
      "Branch",
      "Loan Amt",
      "Total",
      "Paid",
      "Pending",
      "Overdue",
      "Partial",
      "Total Paid",
      "Last Payment",
      "Next Due",
      "Days Ov",
      "Disbursed",
    ];

    const tableRows = filteredReports.map((r, i) => [
      i + 1,
      r.customer_name.length > 20 ? r.customer_name.substring(0, 18) + ".." : r.customer_name,
      r.customer_id_number,
      r.mobile,
      r.branch,
      formatCurrency(r.loan_amount).replace("KES", "").trim(),
      r.total_installments,
      r.paid_installments,
      r.pending_installments,
      r.overdue_installments,
      r.partial_installments,
      formatCurrency(r.total_paid_amount).replace("KES", "").trim(),
      r.last_payment_date !== "No payments yet" ? new Date(r.last_payment_date).toLocaleDateString('en-GB') : "N/A",
      r.next_due_date !== "N/A" ? new Date(r.next_due_date).toLocaleDateString('en-GB') : "N/A",
      r.max_days_overdue || 0,
      r.disbursement_date,
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

        const partialOverdueCount = filteredReports.filter(r => r.has_partial_overdue).length;
        const overdueCount = filteredReports.filter(r => r.overdue_installments > 0).length;
        const partialCount = filteredReports.filter(r => r.partial_installments > 0).length;

        doc.text(
          `Generated: ${new Date().toLocaleDateString()} | Total: ${filteredReports.length} | P&O: ${partialOverdueCount} | Overdue: ${overdueCount} | Partial: ${partialCount}`,
          data.settings.margin.left,
          80
        );
      },
      startY: 100,
      margin: { top: 100, left: 15, right: 15 },
      styles: { fontSize: 6.5, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [46, 94, 153], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 80 },
        2: { cellWidth: 50 },
        3: { cellWidth: 55 },
        4: { cellWidth: 50 },
        5: { cellWidth: 50, halign: 'right' },
        6: { cellWidth: 30, halign: 'center' },
        7: { cellWidth: 25, halign: 'center' },
        8: { cellWidth: 35, halign: 'center' },
        9: { cellWidth: 35, halign: 'center' },
        10: { cellWidth: 30, halign: 'center' },
        11: { cellWidth: 55, halign: 'right' },
        12: { cellWidth: 50, halign: 'center' },
        13: { cellWidth: 50, halign: 'center' },
        14: { cellWidth: 30, halign: 'center' },
        15: { cellWidth: 50, halign: 'center' },
      }
    });

    const fileName = `${companyName.toLowerCase().replace(/ /g, "_")}_installments_${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(fileName);
  };

  // Export to Word
  const exportToWord = async () => {
    if (filteredReports.length === 0) {
      alert("No data to export");
      return;
    }

    const companyName = tenant?.company_name || "Jasiri";

    const table = new DocxTable({
      rows: [
        new DocxTableRow({
          children: [
            "No", "Customer", "ID", "Phone", "Branch", "Loan Amt", "Total", "Paid", "Pending", "Overdue", "Partial", "Total Paid", "Status"
          ].map(h => new DocxTableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16 })] })]
          }))
        }),
        ...filteredReports.map((r, i) => new DocxTableRow({
          children: [
            (i + 1).toString(),
            r.customer_name,
            r.customer_id_number,
            r.mobile,
            r.branch,
            formatCurrency(r.loan_amount),
            r.total_installments.toString(),
            r.paid_installments.toString(),
            r.pending_installments.toString(),
            r.overdue_installments.toString(),
            r.partial_installments.toString(),
            formatCurrency(r.total_paid_amount),
            r.repayment_status
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
            children: [new TextRun({ text: "Loan Installment Report", size: 24 })]
          }),
          new Paragraph({ text: `Generated on: ${new Date().toLocaleString()}` }),
          new Paragraph({ text: "" }),
          table
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${companyName.toLowerCase().replace(/ /g, "_")}_installments_${new Date().toISOString().split("T")[0]}.docx`);
  };

  // Pagination
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const currentReports = filteredReports.slice(startIdx, endIdx);


  const handleExport = async () => {
    if (filteredReports.length === 0) {
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

  return (
    <div className="min-h-screen bg-brand-surface p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
      <div className="bg-brand-secondary rounded-xl shadow-md border border-gray-200 p-4 overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              
             
              
              <div>
                <h1 className="text-sm font-bold text-stone-600">{tenant?.company_name || "Jasiri "}</h1>
                <h2 className="text-lg font-semibold text-white mt-1">
                  Loan Installment Report
                </h2>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 text-white">
             
              <div className="flex gap-2 mt-2 flex-wrap justify-end">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                    placeholder="Search name, ID, or phone"
                    className="border bg-white border-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/30 text-sm w-64 text-slate-600 placeholder:text-slate-600"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border
                    ${showFilters
                      ? "bg-accent text-white shadow-md border-transparent hover:bg-brand-secondary"
                      : "text-white border-white/20 hover:bg-white/10"
                    }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                </button>

                <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1">
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

        {/* FILTERS */}
        {showFilters && (
          <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900">Filter Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <select
                value={filters.branch}
                onChange={(e) => handleFilterChange("branch", e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>

              <select
                value={filters.installmentRange}
                onChange={(e) => handleFilterChange("installmentRange", e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Installment Counts</option>
                <option value="0">0 Installments Paid</option>
                <option value="1">1 Installment Paid</option>
                <option value="2">2 Installments Paid</option>
                <option value="3">3 Installments Paid</option>
                <option value="4">4 Installments Paid</option>
                <option value="5">5 Installments Paid</option>
                <option value="6">6 Installments Paid</option>
                <option value="7">7 Installments Paid</option>
                <option value="8">8 Installments Paid (Completed)</option>
                <option value="2-8">2-8 Installments Paid</option>
              </select>

              <select
                value={filters.paymentStatus}
                onChange={(e) => handleFilterChange("paymentStatus", e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Payment Status</option>
                <option value="partial">Partially Paid</option>
                <option value="partial_overdue">Partial & Overdue</option>
                <option value="overdue">Overdue</option>
                <option value="defaulted">Defaulted</option>
                <option value="no_payment">No Payments</option>
                <option value="fully_paid">Fully Paid</option>
              </select>

              <select
                value={filters.overdueStatus}
                onChange={(e) => handleFilterChange("overdueStatus", e.target.value)}
                className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Overdue Status</option>
                <option value="overdue_7">Overdue ≤ 7 days</option>
                <option value="overdue_14">Overdue 8-14 days</option>
                <option value="overdue_30">Overdue 15-30 days</option>
                <option value="overdue_30_plus">Overdue 30+ days</option>
              </select>
            </div>

            {(filters.search || filters.branch || filters.installmentRange !== "all" || filters.paymentStatus !== "all" || filters.overdueStatus !== "all") && (
              <button
                onClick={clearFilters}
                className="text-red-600 text-sm font-medium flex items-center gap-1 mt-2 hover:text-red-700"
              >
                <X className="w-4 h-4" /> Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* LOADING STATE */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600 font-medium">Analyzing installments, partial payments and overdue patterns...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">No installments found</h3>
              <p className="text-gray-500 max-w-sm">No loans match your current filter criteria or there are no active loans with installments to track.</p>
            </div>
            <button
              onClick={clearFilters}
              className="text-blue-600 font-medium hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-4 whitespace-nowrap">Customer</th>
                    <th className="px-3 py-4 whitespace-nowrap">ID</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Phone</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Branch</th>
                    <th className="px-3 py-4 text-right whitespace-nowrap">Loan Amount</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Total</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Paid</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Pending</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Overdue</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Partial</th>
                    <th className="px-3 py-4 text-right whitespace-nowrap">Total Paid</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Last Payment</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Next Due</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Days Overdue</th>
                    <th className="px-3 py-4 text-center whitespace-nowrap">Disbursed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentReports.map((report) => (
                    <tr key={`${report.id}-${report.customer_id}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 font-medium text-gray-900">
                        <div className="truncate max-w-[150px]" title={report.customer_name}>
                          {report.customer_name}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{report.customer_id_number}</td>
                      <td className="px-3 py-3 text-gray-600 text-center whitespace-nowrap">{report.mobile}</td>
                      <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap">{report.branch}</td>
                      <td className="px-3 py-3 text-right font-medium">{formatCurrency(report.loan_amount)}</td>
                      <td className="px-3 py-3 text-center">{report.total_installments}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100">
                          {report.paid_installments}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600">{report.pending_installments}</td>
                      <td className="px-3 py-3 text-center">
                        {report.overdue_installments > 0 ? (
                          <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs font-bold border border-red-100">
                            {report.overdue_installments}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {report.partial_installments > 0 ? (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-100">
                            {report.partial_installments}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-emerald-600">{formatCurrency(report.total_paid_amount)}</td>
                      <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap text-xs">
                        {report.last_payment_date !== "No payments yet"
                          ? new Date(report.last_payment_date).toLocaleDateString('en-GB')
                          : "No payments"}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap text-xs">
                        {report.next_due_date !== "N/A" ? new Date(report.next_due_date).toLocaleDateString('en-GB') : "N/A"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {report.max_days_overdue > 0 ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${report.max_days_overdue <= 7 ? 'bg-yellow-100 text-yellow-700' :
                            report.max_days_overdue <= 14 ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                            {report.max_days_overdue}d
                          </span>
                        ) : (
                          <span className="text-emerald-600 text-[10px] font-medium">None</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap text-xs">{report.disbursement_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between space-x-4">
              <div className="text-sm text-gray-500">
                Showing <span className="font-semibold">{startIdx + 1}</span> to{" "}
                <span className="font-semibold">{Math.min(endIdx, filteredReports.length)}</span> of{" "}
                <span className="font-semibold">{filteredReports.length}</span> results
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((p, i, arr) => (
                      <React.Fragment key={p}>
                        {i > 0 && arr[i - 1] !== p - 1 && <span className="text-gray-400">...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`w-10 h-10 rounded-lg font-medium transition-all ${currentPage === p
                            ? "bg-accent text-white shadow-md"
                            : "text-gray-600 hover:bg-white border border-transparent hover:border-gray-300"
                            }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-white"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanInstallmentReport;