import React, { useState, useEffect } from "react";
import { Download, Filter, X, ChevronLeft, ChevronRight, Search, FileText, FileSpreadsheet, ChevronDown, AlertCircle, Clock, CheckCircle } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { supabase } from "../../supabaseClient";

const LoanInstallmentReport = () => {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [filters, setFilters] = useState({
    search: "",
    branch: "",
    customer: "",
    installmentRange: "all",
    paymentStatus: "all",
    overdueStatus: "all"
  });
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      const { data, error } = await supabase.from("branches").select("id, name");
      if (!error) setBranches(data);
    };
    fetchBranches();
  }, []);

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, Firstname, Middlename, Surname, id_number, mobile, branch_id");
      if (!error) setCustomers(data || []);
    };
    fetchCustomers();
  }, []);

  // Fetch data and compute installment counts
  useEffect(() => {
    const fetchInstallmentData = async () => {
      try {
        setLoading(true);

        // Fetch all necessary data
        const [loansRes, installmentsRes, usersRes, branchesRes] = await Promise.all([
          supabase
            .from("loans")
            .select("id, customer_id, booked_by, branch_id, product_name, scored_amount, disbursed_at, status, duration_weeks")
            .in("status", ["active", "disbursed"]),
          supabase
            .from("loan_installments")
            .select("loan_id, installment_number, due_amount, paid_amount, status, due_date, paid_date, days_overdue"),
          supabase.from("users").select("id, full_name"),
          supabase.from("branches").select("id, name"),
        ]);

        if (loansRes.error || installmentsRes.error || usersRes.error || branchesRes.error) {
          throw new Error("Error fetching data");
        }

        const loans = loansRes.data || [];
        const installments = installmentsRes.data || [];
        const users = usersRes.data || [];
        const branchData = branchesRes.data || [];

        // Process each loan
        const installmentReports = loans.map((loan) => {
          const customer = customers.find((c) => c.id === loan.customer_id);
          const loanOfficer = users.find((u) => u.id === loan.booked_by);
          const branch = branchData.find((b) => b.id === loan.branch_id);

          // Get customer name
          const fullName = customer 
            ? `${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim() 
            : "N/A";

          // Get all installments for this loan
          const loanInstallments = installments.filter((i) => i.loan_id === loan.id);
          
          // Sort installments by installment number
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

    if (customers.length > 0) {
      fetchInstallmentData();
    }
  }, [customers]);

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
    
    // Customer filter
    if (filters.customer) {
      result = result.filter((r) => r.customer_name === filters.customer);
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
      customer: "", 
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

    const csv = [
      [
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
      ],
      ...filteredReports.map((r) => [
        `"${r.customer_name}"`,
        r.customer_id_number,
        r.mobile,
        r.branch,
        r.loan_officer,
        r.product_name,
        (r.loan_amount || 0).toFixed(2),
        r.total_installments || 0,
        r.paid_installments || 0,
        r.pending_installments || 0,
        r.overdue_installments || 0,
        r.partial_installments || 0,
        r.partial_overdue_installments || 0,
        r.defaulted_installments || 0,
        r.repayment_status,
        (r.total_paid_amount || 0).toFixed(2),
        (r.total_due_amount || 0).toFixed(2),
        (r.partial_amount || 0).toFixed(2),
        (r.overdue_amount || 0).toFixed(2),
        (r.payment_percentage || 0).toFixed(2),
        r.next_due_date !== "N/A" ? new Date(r.next_due_date).toLocaleDateString('en-GB') : "N/A",
        r.last_payment_date !== "No payments yet" ? new Date(r.last_payment_date).toLocaleDateString('en-GB') : "No payments",
        r.days_since_last_payment || "N/A",
        r.max_days_overdue || 0,
        r.partial_installment_numbers || "",
        r.overdue_installment_numbers || "",
        r.disbursement_date,
        r.loan_end_date,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `loan_installment_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    setExportMenuOpen(false);
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
        "Total Paid Amount": r.total_paid_amount,
        "Total Due Amount": r.total_due_amount,
        "Partial Amount": r.partial_amount,
        "Overdue Amount": r.overdue_amount,
        "Payment %": r.payment_percentage.toFixed(2),
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

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Loan Installments");
    XLSX.writeFile(workbook, `loan_installment_report_${new Date().toISOString().split("T")[0]}.xlsx`);
    setExportMenuOpen(false);
  };

  // Export to PDF
  const exportToPDF = () => {
    if (filteredReports.length === 0) {
      alert("No data to export");
      return;
    }

    const doc = new jsPDF("landscape");
    
    // Title
    doc.setFontSize(18);
    doc.text("Loan Installment Report with Partial & Overdue Tracking", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Total Records: ${filteredReports.length}`, 14, 38);
    
    // Summary statistics
    const partialOverdueCount = filteredReports.filter(r => r.has_partial_overdue).length;
    const overdueCount = filteredReports.filter(r => r.overdue_installments > 0).length;
    const partialCount = filteredReports.filter(r => r.partial_installments > 0).length;
    
    doc.setFontSize(10);
    doc.text(`Partial & Overdue: ${partialOverdueCount}`, 14, 46);
    doc.text(`Overdue: ${overdueCount}`, 70, 46);
    doc.text(`Partial: ${partialCount}`, 120, 46);
    
    // Table data
    const tableColumn = [
      "Customer",
      "ID",
      "Phone",
      "Branch",
      "Paid",
      "Overdue",
      "Partial",
      "Partial&Ov",
      "Repayment Status",
      "Total Paid",
      "Days Since Last",
      "Days Overdue",
      "Next Due",
    ];
    
    const tableRows = filteredReports.map(r => [
      r.customer_name.length > 12 ? r.customer_name.substring(0, 12) + "..." : r.customer_name,
      r.customer_id_number,
      r.mobile,
      r.branch.substring(0, 8),
      r.paid_installments,
      r.overdue_installments,
      r.partial_installments,
      r.partial_overdue_installments,
      r.repayment_status,
      formatCurrency(r.total_paid_amount),
      r.days_since_last_payment || "-",
      r.max_days_overdue || 0,
      r.next_due_date !== "N/A" ? new Date(r.next_due_date).toLocaleDateString('en-GB') : "N/A",
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 55,
      theme: "grid",
      styles: { fontSize: 7 },
      headStyles: { fillColor: [88, 106, 177] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        4: { cellWidth: 'auto' },
        5: { cellWidth: 'auto' },
        6: { cellWidth: 'auto' },
        7: { cellWidth: 'auto' },
      }
    });

    doc.save(`loan_installment_report_${new Date().toISOString().split("T")[0]}.pdf`);
    setExportMenuOpen(false);
  };

  // Pagination
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const currentReports = filteredReports.slice(startIdx, endIdx);

  // Get unique customer names for filter
  const customerNames = [...new Set(reports.map(r => r.customer_name).filter(name => name !== "N/A"))];



  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuOpen && !event.target.closest('.export-dropdown')) {
        setExportMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportMenuOpen]);



  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Loan Installment Report</h1>
            <p className="text-sm text-gray-600 mt-1">Track partial payments, overdue installments, and payment patterns</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all ${
                showFilters
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative export-dropdown">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium shadow-md transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {exportMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10 overflow-hidden">
                  <button
                    onClick={exportToCSV}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
                  >
                    <div className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">CSV Format</p>
                      <p className="text-xs text-gray-500">Download as .csv file</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={exportToExcel}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
                  >
                    <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Excel Format</p>
                      <p className="text-xs text-gray-500">Download as .xlsx file</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={exportToPDF}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-md bg-red-100 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">PDF Format</p>
                      <p className="text-xs text-gray-500">Download as .pdf file</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

  

      {/* FILTERS */}
      {showFilters && (
        <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">Filter Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by customer, ID, or mobile..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={filters.branch}
              onChange={(e) => handleFilterChange("branch", e.target.value)}
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={filters.customer}
              onChange={(e) => handleFilterChange("customer", e.target.value)}
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Customers</option>
              {customerNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <select
              value={filters.paymentStatus}
              onChange={(e) => handleFilterChange("paymentStatus", e.target.value)}
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Overdue Status</option>
              <option value="overdue_7">Overdue ≤ 7 days</option>
              <option value="overdue_14">Overdue 8-14 days</option>
              <option value="overdue_30">Overdue 15-30 days</option>
              <option value="overdue_30_plus">Overdue 30+ days</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <select
              value={filters.installmentRange}
              onChange={(e) => handleFilterChange("installmentRange", e.target.value)}
              className="border border-gray-300 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          </div>
          {(filters.search || filters.branch || filters.customer || filters.installmentRange !== "all" || filters.paymentStatus !== "all" || filters.overdueStatus !== "all") && (
            <button
              onClick={clearFilters}
              className="text-red-600 text-sm font-medium flex items-center gap-1 mt-2 hover:text-red-700"
            >
              <X className="w-4 h-4" /> Clear All Filters
            </button>
          )}
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Loading installment data...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No installment records found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2 border-gray-300 sticky top-0">
                  <tr>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Customer</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">ID</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Phone</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Branch</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Loan Amount</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">Total</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">Paid</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">Pending</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">Overdue</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">Partial</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Total Paid</th>
                                        <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Last Payment</th>

                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Next Due</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">Days Overdue</th>
                    <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Disbursed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentReports.map((report) => (
                    <tr key={`${report.id}-${report.customer_id}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 text-gray-900 font-medium whitespace-nowrap">
                        <div className="max-w-[150px] truncate" title={report.customer_name}>
                          {report.customer_name}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{report.customer_id_number}</td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{report.mobile}</td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{report.branch}</td>
                      <td className="px-3 py-3 text-right text-gray-900 whitespace-nowrap">{formatCurrency(report.loan_amount)}</td>
                      <td className="px-3 py-3 text-center text-gray-700 whitespace-nowrap">{report.total_installments}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          report.paid_installments === 0 ? 'bg-red-100 text-red-800' :
                          report.paid_installments <= 2 ? 'bg-yellow-100 text-yellow-800' :
                          report.paid_installments <= 5 ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {report.paid_installments}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold">
                          {report.pending_installments}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {report.overdue_installments > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-semibold mb-1">
                              {report.overdue_installments}
                            </span>
                            {report.overdue_installment_numbers && (
                              <span className="text-xs text-gray-500" title="Overdue installments">
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {report.partial_installments > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold mb-1">
                              {report.partial_installments}
                            </span>
                            {report.partial_installment_numbers && (
                              <span className="text-xs text-gray-500" title="Partial installments">
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">0</span>
                        )}
                      </td>
                     
                    
                      <td className="px-3 py-3 text-right text-green-700 font-semibold whitespace-nowrap">
                        {formatCurrency(report.total_paid_amount)}
                      </td>
                         <td className="px-3 py-3 text-gray-700 whitespace-nowrap">
                        {report.last_payment_date !== "No payments yet" 
                          ? new Date(report.last_payment_date).toLocaleDateString('en-GB')
                          : "No payments"}
                      </td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap">
                        {report.next_due_date !== "N/A" ? new Date(report.next_due_date).toLocaleDateString('en-GB') : "N/A"}
                      </td>
                   
                   
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {report.max_days_overdue > 0 ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            report.max_days_overdue <= 7 ? 'bg-yellow-100 text-yellow-800' :
                            report.max_days_overdue <= 14 ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {report.max_days_overdue}d
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{report.disbursement_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{startIdx + 1}</span> to{' '}
                <span className="font-semibold">{Math.min(endIdx, filteredReports.length)}</span> of{' '}
                <span className="font-semibold">{filteredReports.length}</span> records
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-colors ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 rounded-lg transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-colors ${
                    currentPage === totalPages
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoanInstallmentReport;