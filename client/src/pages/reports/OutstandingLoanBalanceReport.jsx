import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Download, Filter, X, ChevronLeft, ChevronRight, Search, Printer, ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
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

const OutstandingLoanBalanceReport = () => {
  const { tenant } = useAuth();
  const [reports, setReports] = useState(() => {
    const cached = localStorage.getItem("outstanding-balance-report-data");
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
        if (!isExpired) return data.reports || [];
      } catch (e) { return []; }
    }
    return [];
  });

  const [branches, setBranches] = useState(() => {
    const cached = localStorage.getItem("outstanding-balance-report-data");
    if (cached) {
      try {
        const { data } = JSON.parse(cached);
        return data.branches || [];
      } catch (e) { return []; }
    }
    return [];
  });

  const [regions, setRegions] = useState(() => {
    const cached = localStorage.getItem("outstanding-balance-report-data");
    if (cached) {
      try {
        const { data } = JSON.parse(cached);
        return data.regions || [];
      } catch (e) { return []; }
    }
    return [];
  });

  const [officers, setOfficers] = useState(() => {
    const cached = localStorage.getItem("outstanding-balance-report-data");
    if (cached) {
      try {
        const { data } = JSON.parse(cached);
        return data.officers || [];
      } catch (e) { return []; }
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [exportFormat, setExportFormat] = useState("csv");
  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem("outstanding-balance-filters");
    return saved ? JSON.parse(saved) : {
      search: "",
      region: "",
      branch: "",
      loanOfficer: "",
      status: "all",
      product: "",
    };
  });

  const [dateFilter, setDateFilter] = useState(() => {
    return localStorage.getItem("outstanding-balance-date-filter") || "all";
  });

  const [customStartDate, setCustomStartDate] = useState(() => {
    return localStorage.getItem("outstanding-balance-start-date") || "";
  });

  const [customEndDate, setCustomEndDate] = useState(() => {
    return localStorage.getItem("outstanding-balance-end-date") || "";
  });

  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem("outstanding-balance-filters", JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem("outstanding-balance-date-filter", dateFilter);
  }, [dateFilter]);

  useEffect(() => {
    localStorage.setItem("outstanding-balance-start-date", customStartDate);
  }, [customStartDate]);

  useEffect(() => {
    localStorage.setItem("outstanding-balance-end-date", customEndDate);
  }, [customEndDate]);

  // Memoized function to calculate arrears and overdue days
  const calculateArrearsAndOverdue = useCallback((installments) => {
    let arrearsAmount = 0;
    let maxOverdueDays = 0;
    const today = new Date();

    installments.forEach((inst) => {
      if (inst.status === 'overdue' || inst.status === 'defaulted') {
        // Add unpaid portion to arrears
        const unpaidAmount = Math.max(0, (inst.due_amount || 0) - (inst.paid_amount || 0));
        arrearsAmount += unpaidAmount;

        // Calculate overdue days
        if (inst.due_date) {
          const dueDate = new Date(inst.due_date);
          const daysOverdue = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));
          maxOverdueDays = Math.max(maxOverdueDays, daysOverdue);
        }

        // Also use days_overdue column if available
        if (inst.days_overdue > maxOverdueDays) {
          maxOverdueDays = inst.days_overdue;
        }
      }
    });

    return { arrearsAmount, overdueDays: maxOverdueDays };
  }, []);

  // Fetch data with caching
  const fetchOutstandingLoans = useCallback(async (forceRefresh = false) => {
    try {
      const cacheKey = "outstanding-balance-report-data";

      if (!forceRefresh) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const { data, timestamp } = JSON.parse(cached);
            const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000;

            if (!isExpired && reports.length > 0) {
              // Data already in state from initializer, no need to do anything
              return;
            }

            if (!isExpired) {
              setReports(data.reports);
              setBranches(data.branches);
              setRegions(data.regions);
              setOfficers(data.officers);
              return;
            }
          } catch (e) { }
        }
      }

      setLoading(true);

      const [
        loansRes,
        installmentsRes,
        customersRes,
        usersRes,
        branchesRes,
        regionsRes
      ] = await Promise.all([
        supabase
          .from("loans")
          .select("id, customer_id, booked_by, branch_id, product_name, scored_amount, disbursed_at, status, repayment_state, duration_weeks, total_interest, total_payable, weekly_payment")
          .in("status", ["active", "disbursed"])
          .neq("repayment_state", "completed"),
        supabase
          .from("loan_installments")
          .select("loan_id, installment_number, due_date, due_amount, principal_amount, interest_amount, paid_amount, status, days_overdue, interest_paid, principal_paid"),
        supabase.from("customers").select("id, Firstname, Middlename, Surname, id_number, mobile"),
        supabase.from("users").select("id, full_name"),
        supabase.from("branches").select("id, name, region_id"),
        supabase.from("regions").select("id, name"),
      ]);

      // Check for errors
      if (loansRes.error) throw new Error(loansRes.error.message);
      if (installmentsRes.error) throw new Error(installmentsRes.error.message);
      if (customersRes.error) throw new Error(customersRes.error.message);
      if (usersRes.error) throw new Error(usersRes.error.message);
      if (branchesRes.error) throw new Error(branchesRes.error.message);
      if (regionsRes.error) throw new Error(regionsRes.error.message);

      const loans = loansRes.data || [];
      const installments = installmentsRes.data || [];
      const customers = customersRes.data || [];
      const users = usersRes.data || [];
      const branchData = branchesRes.data || [];
      const regionData = regionsRes.data || [];

      // Process loans
      const processedReports = loans.map((loan) => {
        const customer = customers.find((c) => c.id === loan.customer_id);
        const loanOfficer = users.find((u) => u.id === loan.booked_by);
        const branch = branchData.find((b) => b.id === loan.branch_id);

        const fullName = customer
          ? `${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim()
          : "N/A";

        const loanInstallments = installments.filter((i) => i.loan_id === loan.id);

        // Calculate arrears and overdue days
        const { arrearsAmount, overdueDays } = calculateArrearsAndOverdue(loanInstallments);

        // Calculate totals using actual columns from database
        let totalPrincipalOutstanding = 0;
        let totalInterestOutstanding = 0;
        let totalInterestPaid = 0;
        let totalPrincipalPaid = 0;
        let outstandingInstallments = 0;

        loanInstallments.forEach((inst) => {
          const principalAmount = Number(inst.principal_amount) || 0;
          const interestAmount = Number(inst.interest_amount) || 0;
          const interestPaid = Number(inst.interest_paid) || 0;
          const principalPaid = Number(inst.principal_paid) || 0;

          const principalBalance = principalAmount - principalPaid;
          const interestBalance = interestAmount - interestPaid;

          if (inst.status !== "paid" && (principalBalance > 0 || interestBalance > 0)) {
            outstandingInstallments += 1;
          }

          totalPrincipalOutstanding += principalBalance;
          totalInterestOutstanding += interestBalance;
          totalInterestPaid += interestPaid;
          totalPrincipalPaid += principalPaid;
        });

        const totalOutstanding = totalPrincipalOutstanding + totalInterestOutstanding;

        const principal = Number(loan.scored_amount) || 0;
        const interest = Number(loan.total_interest) || 0;
        const total_amount = Number(loan.total_payable) || 0;
        const principal_paid = totalPrincipalPaid;
        const total_amount_paid = principal_paid + totalInterestPaid;
        const percent_paid = total_amount > 0 ? (total_amount_paid / total_amount) * 100 : 0;
        const percent_unpaid = total_amount > 0 ? (totalOutstanding / total_amount) * 100 : 0;

        return {
          id: loan.id,
          customer_name: fullName,
          customer_id: customer?.id_number || "N/A",
          mobile: customer?.mobile || "N/A",
          branch: branch?.name || "N/A",
          branch_id: branch?.id || "N/A",
          region: regionData.find(r => r.id === branch?.region_id)?.name || "N/A",
          region_id: branch?.region_id || "N/A",
          loan_officer: loanOfficer?.full_name || "N/A",
          loan_officer_id: loanOfficer?.id || "N/A",
          principal_outstanding: totalPrincipalOutstanding,
          interest_outstanding: totalInterestOutstanding,
          outstanding_installments: outstandingInstallments,
          balance: totalOutstanding,
          disbursement_date: loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : "N/A",
          loan_end_date: loan.duration_weeks && loan.disbursed_at
            ? new Date(new Date(loan.disbursed_at).getTime() + loan.duration_weeks * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
            : "N/A",
          repayment_state: loan.repayment_state,
          status: loan.status,
          principal,
          interest,
          total_amount,
          num_installments: loan.duration_weeks || 0,
          principal_due: totalPrincipalOutstanding,
          interest_due: totalInterestOutstanding,
          recurring_charge: Number(loan.weekly_payment) || 0,
          principal_paid,
          total_amount_due: total_amount,
          total_amount_paid,
          percent_paid,
          interest_paid: totalInterestPaid,
          percent_unpaid,
          arrears_amount: arrearsAmount,
          overdue_days: overdueDays,
          loan_product: loan.product_name,
        };
      });

      const cacheData = {
        reports: processedReports,
        branches: branchData,
        regions: regionData,
        officers: users,
      };

      localStorage.setItem(cacheKey, JSON.stringify({
        data: cacheData,
        timestamp: Date.now()
      }));

      setReports(processedReports);
      setBranches(branchData);
      setRegions(regionData);
      setOfficers(users);

    } catch (err) {
      console.error("Error fetching outstanding loans:", err.message);
    } finally {
      setLoading(false);
    }
  }, [calculateArrearsAndOverdue]);

  // Helper functions
  const formatCurrency = (num) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);

  const getCurrentTimestamp = () => {
    const now = new Date();
    return now.toLocaleString("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getDateRange = (filter) => {
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
  };

  // Initial data fetch
  useEffect(() => {
    fetchOutstandingLoans();
  }, [fetchOutstandingLoans]);



  // Filter data
  const filteredData = React.useMemo(() => {
    let result = [...reports];

    // Text search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((r) =>
        r.customer_name.toLowerCase().includes(q) ||
        r.mobile.includes(q) ||
        r.customer_id.includes(q)
      );
    }

    // Hierarchical Filters
    if (filters.region) result = result.filter((r) => r.region_id === filters.region);
    if (filters.branch) result = result.filter((r) => r.branch_id === filters.branch);
    if (filters.loanOfficer) result = result.filter((r) => r.loan_officer_id === filters.loanOfficer);

    // Status & Product
    if (filters.status !== "all") result = result.filter((r) => r.repayment_state === filters.status);
    if (filters.product) result = result.filter((r) => r.loan_product === filters.product);

    // Date filter
    if (dateFilter !== "all" && dateFilter !== "custom") {
      const range = getDateRange(dateFilter);
      if (range) {
        result = result.filter((r) => {
          const loanDate = new Date(r.disbursement_date);
          return loanDate >= range.start && loanDate <= range.end;
        });
      }
    } else if (dateFilter === "custom") {
      const range = getDateRange("custom");
      if (range) {
        result = result.filter((r) => {
          const loanDate = new Date(r.disbursement_date);
          return loanDate >= range.start && loanDate <= range.end;
        });
      }
    }

    // Apply sorting (Table uses its own grouping logic, so we group first)
    const grouped = {};
    result.forEach((loan) => {
      const branchName = loan.branch;
      const officerName = loan.loan_officer;

      if (!grouped[branchName]) {
        grouped[branchName] = {
          branchName,
          totalOutstanding: 0,
          officers: {},
        };
      }

      if (!grouped[branchName].officers[officerName]) {
        grouped[branchName].officers[officerName] = {
          officerName,
          totalOutstanding: 0,
          loans: [],
        };
      }

      grouped[branchName].officers[officerName].loans.push(loan);
      grouped[branchName].officers[officerName].totalOutstanding += loan.balance;
      grouped[branchName].totalOutstanding += loan.balance;
    });

    return Object.values(grouped).map((branch) => ({
      ...branch,
      officers: Object.values(branch.officers),
    }));
  }, [reports, filters, dateFilter, customStartDate, customEndDate]);

  const getFilteredBranches = () => {
    if (!filters.region) return branches;
    return branches.filter(b => b.region_id === filters.region);
  };

  const getFilteredOfficers = () => {
    if (filters.branch) {
      return officers.filter(o =>
        reports.some(r => r.branch_id === filters.branch && r.loan_officer_id === o.id)
      );
    }
    if (filters.region) {
      const branchIds = branches.filter(b => b.region_id === filters.region).map(b => b.id);
      return officers.filter(o =>
        reports.some(r => branchIds.includes(r.branch_id) && r.loan_officer_id === o.id)
      );
    }
    return officers;
  };

  const allProducts = useMemo(() => [
    ...new Set(reports.map(r => r.loan_product).filter(Boolean))
  ], [reports]);

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
    { value: "pdf", label: "PDF" },
    { value: "word", label: "Word" },
  ];

  const totals = useMemo(() => {
    const loans = filteredData.flatMap(b => b.officers.flatMap(o => o.loans));
    return {
      outstanding: loans.reduce((sum, r) => sum + r.balance, 0),
      principal: loans.reduce((sum, r) => sum + r.principal_outstanding, 0),
      count: loans.length
    };
  }, [filteredData]);



  // Get all loans for pagination
  const allLoans = React.useMemo(() => {
    return filteredData.flatMap(branch =>
      branch.officers.flatMap(officer => officer.loans)
    );
  }, [filteredData]);

  // Pagination
  const totalPages = Math.ceil(allLoans.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ search: "", region: "", branch: "", loanOfficer: "", status: "all", product: "" });
    setDateFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
  };


  const handleExport = async () => {
    if (allLoans.length === 0) return alert("No data to export");
    const companyName = tenant?.company_name || "Company";
    const companySlug = companyName.toLowerCase().replace(/ /g, "-");
    const dateStr = new Date().toISOString().split("T")[0];

    if (exportFormat === "csv") exportToCSV(companySlug, dateStr);
    else if (exportFormat === "excel") exportToExcel(companySlug, dateStr);
    else if (exportFormat === "pdf") exportToPDF(companyName, dateStr);
    else if (exportFormat === "word") exportToWord(companyName, dateStr);
  };

  const exportToPDF = (companyName, dateStr) => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`${companyName} - Outstanding Loan Balance Report`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${getCurrentTimestamp()}`, 14, 22);

    const headers = [[
      "No.", "Branch", "Officer", "Customer", "ID Number", "Mobile",
      "Principal", "Interest", "Total", "Paid", "Balance", "Arrears", "Status"
    ]];
    const rows = allLoans.map((r, i) => [
      i + 1, r.branch, r.loan_officer, r.customer_name, r.customer_id, r.mobile,
      formatCurrency(r.principal).replace("KES", ""), formatCurrency(r.interest).replace("KES", ""),
      formatCurrency(r.total_amount).replace("KES", ""), formatCurrency(r.total_amount_paid).replace("KES", ""),
      formatCurrency(r.balance).replace("KES", ""), formatCurrency(r.arrears_amount).replace("KES", ""),
      r.repayment_state
    ]);

    autoTable(doc, { head: headers, body: rows, startY: 28, styles: { fontSize: 7 } });
    doc.save(`${companyName.replace(/ /g, "_")}_Outstanding_Balance_${dateStr}.pdf`);
  };

  const exportToExcel = (companySlug, dateStr) => {
    const ws = XLSX.utils.json_to_sheet(allLoans.map((r, i) => ({
      No: i + 1,
      Branch: r.branch,
      Officer: r.loan_officer,
      Customer: r.customer_name,
      ID: r.customer_id,
      Mobile: r.mobile,
      Principal: r.principal,
      Interest: r.interest,
      Total: r.total_amount,
      Paid: r.total_amount_paid,
      Balance: r.balance,
      Arrears: r.arrears_amount,
      Status: r.repayment_state
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Outstanding Balance");
    XLSX.writeFile(wb, `${companySlug}-outstanding-balance-${dateStr}.xlsx`);
  };

  const exportToWord = async (companyName, dateStr) => {
    const tableRows = allLoans.slice(0, 50).map((r, i) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph(String(i + 1))] }),
        new TableCell({ children: [new Paragraph(r.customer_name)] }),
        new TableCell({ children: [new Paragraph(r.loan_officer)] }),
        new TableCell({ children: [new Paragraph(formatCurrency(r.total_amount))] }),
        new TableCell({ children: [new Paragraph(formatCurrency(r.balance))] }),
      ]
    }));

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: `${companyName} - Outstanding Balance`, bold: true, size: 28 })] }),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("No")] }),
                  new TableCell({ children: [new Paragraph("Customer")] }),
                  new TableCell({ children: [new Paragraph("Officer")] }),
                  new TableCell({ children: [new Paragraph("Total Amount")] }),
                  new TableCell({ children: [new Paragraph("Balance")] }),
                ]
              }),
              ...tableRows
            ]
          }),
        ]
      }]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${companyName.replace(/ /g, "_")}_Outstanding_Balance_${dateStr}.docx`);
  };

  const exportToCSV = (companySlug, dateStr) => {
    const headers = [
      "Branch", "Officer", "Customer", "Mobile", "ID", "Principal", "Interest", "Total",
      "Paid", "Balance", "Arrears", "Overdue Days", "Disbursement", "End Date"
    ];
    const csvContent = [
      headers.join(","),
      ...allLoans.map(r => [
        r.branch, r.loan_officer, `"${r.customer_name}"`, r.mobile, r.customer_id,
        r.principal, r.interest, r.total_amount, r.total_amount_paid, r.balance,
        r.arrears_amount, r.overdue_days, r.disbursement_date, r.loan_end_date
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${companySlug}-outstanding-balance-${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };



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
                <h2 className="text-sm font-semibold text-white/90">OLB Report</h2>
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

        {/* SUMMARY CARDS (Standardized Style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-amber-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Total Balance</p>
            <p className="text-2xl font-bold mt-1 text-primary">
              {formatCurrency(totals.outstanding)}
            </p>
          </div>

          <div className="bg-emerald-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-muted font-medium">Principal Outstanding</p>
            <p className="text-2xl font-bold mt-1 text-accent">
              {formatCurrency(totals.principal)}
            </p>
          </div>

          <div className="bg-purple-50 p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted font-medium">Number of Loans</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">ACTIVE</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-gray-900">
              {totals.count}
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

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
                >
                  <option value="all">All States</option>
                  <option value="current">Current</option>
                  <option value="overdue">Overdue</option>
                  <option value="defaulted">Defaulted</option>
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
                Showing {allLoans.length} matches
              </p>
            </div>
          </div>
        )}

        {/* GRANULAR DATA TABLE */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          {loading ? (
            <div className="p-8 text-center bg-slate-50/50">
              <div className="w-10 h-10 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 font-medium">Loading outstanding loans data...</p>
            </div>
          ) : allLoans.length === 0 ? (
            <div className="p-8 text-center py-20">
              <Search className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-bold">No outstanding loans found.</p>
              <button onClick={clearFilters} className="mt-4 text-brand-primary text-sm font-bold hover:underline">Clear Filters</button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-20">
                    <tr>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs border-r border-gray-200">Branch</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs border-r border-gray-200">Branch Total</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs border-r border-gray-200">Loan Officer</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs border-r border-gray-200">Officer Portfolio</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Customer Name</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Phone</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">ID Number</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Principal</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Interest</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Total Amount</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">Instal.</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Prin Paid</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Int Paid</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs">Total Paid</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">% Paid</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">% Unpaid</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs font-bold text-blue-800">Balance</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-right whitespace-nowrap text-xs font-bold text-red-800">Arrears</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-center whitespace-nowrap text-xs">Overdue</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">Disbursed</th>
                      <th className="px-3 py-3 font-semibold text-gray-700 text-left whitespace-nowrap text-xs">End Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredData.map((branch) => {
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
                                    className="px-3 py-3 text-gray-900 font-bold bg-blue-50 border-r-2 border-blue-200 align-top whitespace-nowrap text-xs shadow-[inset_-2px_0_0_0_rgba(191,219,254,1)]">
                                    {branch.branchName}
                                  </td>
                                  <td rowSpan={branch.officers.reduce((sum, o) => sum + o.loans.length, 0)}
                                    className="px-3 py-3 text-right text-blue-700 font-bold bg-blue-50 border-r-2 border-blue-200 align-top whitespace-nowrap text-xs">
                                    {formatCurrency(branch.totalOutstanding).replace("KES", "")}
                                  </td>
                                </>
                              ) : null}

                              {isFirstInOfficer ? (
                                <>
                                  <td rowSpan={officerLoanCount}
                                    className="px-3 py-3 text-gray-800 font-semibold bg-green-50 border-r border-green-200 align-top whitespace-nowrap text-xs">
                                    {officer.officerName}
                                  </td>
                                  <td rowSpan={officerLoanCount}
                                    className="px-3 py-3 text-right text-green-700 font-bold bg-green-50 border-r border-green-200 align-top whitespace-nowrap text-xs">
                                    {formatCurrency(officer.totalOutstanding).replace("KES", "")}
                                  </td>
                                </>
                              ) : null}

                              <td className="px-3 py-3 text-gray-900 font-medium whitespace-nowrap text-xs">{loan.customer_name}</td>
                              <td className="px-3 py-3 text-gray-700 whitespace-nowrap text-xs">{loan.mobile}</td>
                              <td className="px-3 py-3 text-gray-700 whitespace-nowrap text-xs">{loan.customer_id}</td>
                              <td className="px-3 py-3 text-right text-gray-900 whitespace-nowrap text-xs">{formatCurrency(loan.principal).replace("KES", "")}</td>
                              <td className="px-3 py-3 text-right text-gray-900 whitespace-nowrap text-xs">{formatCurrency(loan.interest).replace("KES", "")}</td>
                              <td className="px-3 py-3 text-right text-gray-900 font-bold whitespace-nowrap text-xs">{formatCurrency(loan.total_amount).replace("KES", "")}</td>
                              <td className="px-3 py-3 text-center text-gray-700 whitespace-nowrap text-xs">{loan.outstanding_installments}</td>
                              <td className="px-3 py-3 text-right text-green-700 font-medium whitespace-nowrap text-xs">{formatCurrency(loan.principal_paid).replace("KES", "")}</td>
                              <td className="px-3 py-3 text-right text-green-700 font-medium whitespace-nowrap text-xs">{formatCurrency(loan.interest_paid).replace("KES", "")}</td>
                              <td className="px-3 py-3 text-right text-green-800 font-bold whitespace-nowrap text-xs">{formatCurrency(loan.total_amount_paid).replace("KES", "")}</td>
                              <td className="px-3 py-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${loan.percent_paid >= 75 ? 'bg-green-100 text-green-800' :
                                  loan.percent_paid >= 50 ? 'bg-blue-100 text-blue-800' :
                                    loan.percent_paid >= 25 ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-red-100 text-red-800'
                                  }`}>
                                  {(loan.percent_paid || 0).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${loan.percent_unpaid <= 25 ? 'bg-green-100 text-green-800' :
                                  loan.percent_unpaid <= 50 ? 'bg-blue-100 text-blue-800' :
                                    loan.percent_unpaid <= 75 ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-red-100 text-red-800'
                                  }`}>
                                  {(loan.percent_unpaid || 0).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right text-blue-700 font-black whitespace-nowrap text-xs bg-blue-50/20">{formatCurrency(loan.balance).replace("KES", "")}</td>
                              <td className="px-3 py-3 text-right text-red-700 font-black whitespace-nowrap text-xs bg-red-50/20">
                                {loan.arrears_amount > 0 ? formatCurrency(loan.arrears_amount).replace("KES", "") : "-"}
                              </td>
                              <td className="px-3 py-3 text-center whitespace-nowrap">
                                {loan.overdue_days > 0 ? (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${loan.overdue_days <= 7 ? 'bg-yellow-100 text-yellow-800' :
                                    loan.overdue_days <= 30 ? 'bg-orange-100 text-orange-800' :
                                      'bg-red-100 text-red-800'
                                    }`}>
                                    {loan.overdue_days} DAYS
                                  </span>
                                ) : (
                                  <span className="text-gray-400 font-bold text-[10px]">CURRENT</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-[10px] font-medium tracking-tight">{loan.disbursement_date}</td>
                              <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-[10px] font-medium tracking-tight">{loan.loan_end_date}</td>
                            </tr>
                          );
                        });
                      });
                    })}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION (Standardized Style) */}
              <div className="bg-slate-50/50 px-6 py-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm font-medium text-slate-500">
                  Showing <span className="font-bold text-slate-700">{startIdx + 1}</span> to{' '}
                  <span className="font-bold text-slate-700">{Math.min(endIdx, allLoans.length)}</span> of{' '}
                  <span className="font-bold text-slate-900">{allLoans.length}</span> entries
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                      let pageNum;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`min-w-[40px] h-10 rounded-xl font-bold transition-all shadow-sm ${currentPage === pageNum ? 'bg-brand-primary text-white scale-105 shadow-brand-primary/20' : 'bg-white border border-slate-200 text-slate-600 hover:border-brand-primary/30 hover:bg-slate-50'}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutstandingLoanBalanceReport;