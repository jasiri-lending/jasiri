import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronUp,
  ChevronDown,
  Download,
  Search,
  Printer,
  X,
  Globe
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth.js";
import { useParams } from "react-router-dom";
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
import { Pagination } from "../../components/Pagination.jsx";
import CustomSelect from "../../components/CustomSelect";
import Modal from "../../components/Modal";
import { SkeletonTable } from "../../components/Skeleton";

const CustomerStatementModal = () => {
  const { profile, tenant } = useAuth();
  const { customerId } = useParams();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(40);
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [exportFormat, setExportFormat] = useState("csv");
  const [reportTimestamp, setReportTimestamp] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerInfo, setCustomerInfo] = useState({});
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Statement period state
  const [statementPeriod, setStatementPeriod] = useState({
    startDate: "",
    endDate: "",
    period: ""
  });

  // Summary state
  const [statementSummary, setStatementSummary] = useState({
    totalLoanAmount: 0,
    principal: 0,
    interest: 0,
    totalPaid: 0,
    outstandingBalance: 0
  });

  // Set report timestamp on component mount
  useEffect(() => {
    setReportTimestamp(new Date().toLocaleString("en-KE"));

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    setStatementPeriod({
      startDate: firstDayOfMonth.toLocaleDateString("en-KE"),
      endDate: lastDayOfMonth.toLocaleDateString("en-KE"),
      period: "Monthly"
    });
  }, []);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!customerId || !profile) return;
      setLoading(true);

      try {
        const events = [];
        let runningBalance = 0;

        // 1 Customer Info
        let customerQuery = supabase
          .from("customers")
          .select("id, Firstname, Surname, mobile, id_number, created_at, branch_id, created_by, branch:branch_id(region_id)")
          .eq("id", customerId);

        // RBAC Implementation
        if (profile.role === 'relationship_officer') {
          customerQuery = customerQuery.eq('created_by', profile.id);
        } else if (['branch_manager', 'customer_service_officer'].includes(profile.role)) {
          if (profile.branch_id) {
            customerQuery = customerQuery.eq('branch_id', profile.branch_id);
          }
        } else if (profile.role === 'regional_manager') {
          if (profile.region_id) {
            customerQuery = customerQuery.filter('branch.region_id', 'eq', profile.region_id);
          }
        }

        const { data: customer, error: customerError } = await customerQuery.single();

        if (customerError || !customer) {
          console.error(" Customer not found:", customerError?.message);
          setLoading(false);
          return;
        }

        setCustomerInfo(customer);

        // 2 Loans
        const { data: loans = [] } = await supabase
          .from("loans")
          .select("id, scored_amount, processing_fee, registration_fee, disbursed_at, disbursed_date, created_at, total_payable, total_interest")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: true });

        // 3 Loan Payments
        const { data: loanPayments = [], error: loanPaymentsError } = await supabase
          .from("loan_payments")
          .select(`
          id,
          loan_id,
          installment_id,
          paid_amount,
          balanceBefore,
          balance_after,
          mpesa_receipt,
          phone_number,
          paid_at,
          payment_type
        `)
          .in("loan_id", loans.map(l => l.id))
          .order("paid_at", { ascending: true });

        if (loanPaymentsError) {
          console.error(" Loan payments fetch failed:", loanPaymentsError.message);
        }

        // 4 Loan Installments
        const { data: loanInstallments = [], error: installmentsError } = await supabase
          .from("loan_installments")
          .select(`
          id,
          loan_id,
          principal_paid,
          interest_paid,
          paid_amount,
          status
        `)
          .in("loan_id", loans.map(l => l.id));

        if (installmentsError) {
          console.error(" Loan installments fetch failed:", installmentsError.message);
        }

        // 5 C2B Payments
        const normalizedMobile = customer.mobile?.replace(/^\+?254|^0/, "254");
        const receiptIds = [...new Set((loanPayments || []).map(p => p.mpesa_receipt).filter(Boolean))];
        const idNo = customer.id_number;

        let c2bQuery = supabase
          .from("mpesa_c2b_transactions")
          .select("id, amount, transaction_time, transaction_id, loan_id, phone_number, status, payment_type, reference, billref")
          .order("transaction_time", { ascending: true });

        const orFilters = [];
        if (customer.mobile) orFilters.push(`phone_number.eq.${customer.mobile}`);
        if (normalizedMobile) orFilters.push(`phone_number.eq.${normalizedMobile}`);
        if (idNo) orFilters.push(`billref.eq.${idNo}`);
        if (receiptIds.length > 0) orFilters.push(`transaction_id.in.(${receiptIds.join(',')})`);

        if (orFilters.length > 0) {
          c2bQuery = c2bQuery.or(orFilters.join(','));
        }

        const { data: c2b = [], error: c2bError } = await c2bQuery;
        if (c2bError) console.error(" C2B fetch error:", c2bError.message);

        // 6 Loan Disbursement Transactions
        const { data: disbursements = [] } = await supabase
          .from("loan_disbursement_transactions")
          .select("id, amount, transaction_id, loan_id, processed_at, status")
          .eq("status", "success")
          .in("loan_id", loans.map(l => l.id))
          .order("processed_at", { ascending: true });

        // 7 Wallet Transactions
        const { data: walletTransactions, error: walletError } = await supabase
          .from("customer_wallets")
          .select("id, amount, created_at, mpesa_reference, type, narration, transaction_type, debit, credit")
          .eq("customer_id", customerId)
          .eq("tenant_id", tenant?.id)
          .order("created_at", { ascending: true });

        if (walletError) console.error(" Wallet fetch failed:", walletError.message);

        const processedMpesaRefs = new Set();

        // STEP 1: MONEY IN (CREDITS)
        (c2b || []).forEach(c => {
          if (c.status !== "applied") return;
          const ref = c.transaction_id;
          processedMpesaRefs.add(ref);

          const txDate = new Date(c.transaction_time);
          events.push({
            id: `c2b-credit-${ref}`,
            date: txDate,
            description: "Account Deposit",
            reference: ref,
            debit: 0,
            credit: Number(c.amount),
            amount: Number(c.amount),
            sequence: 4,
            timestamp: txDate.getTime(),
          });
        });

        (walletTransactions || []).forEach(w => {
          if (w.type !== "credit") return;
          const ref = w.mpesa_reference;

          if (ref && processedMpesaRefs.has(ref)) return;
          if (ref) processedMpesaRefs.add(ref);

          const txDate = new Date(w.created_at);
          
          let desc = w.narration || "Account Deposit";
          const lowerDesc = desc.toLowerCase();
          
          if (lowerDesc.includes("transfer from")) {
            desc = "Funds Transfer Received";
          } else if (lowerDesc.includes("disbursement refund")) {
            desc = "Disbursement Refund Received";
          }

          events.push({
            id: `wallet-credit-${w.id}`,
            date: txDate,
            description: desc,
            reference: ref || `WAL-CR-${w.id.substring(0, 6)}`,
            debit: 0,
            credit: Number(w.amount),
            amount: Number(w.amount),
            sequence: w.transaction_type === "mpesa_c2b" ? 4 : 5,
            timestamp: txDate.getTime(),
          });
        });

        // STEP 2: MONEY OUT (DEBITS)
        (disbursements || []).forEach(d => {
          const txDate = new Date(d.processed_at);
          events.push({
            id: `disb-debit-${d.transaction_id}`,
            date: txDate,
            description: "Loan Disbursed",
            reference: d.transaction_id,
            debit: Number(d.amount),
            credit: 0,
            amount: Number(d.amount),
            sequence: 2,
            timestamp: txDate.getTime(),
          });
        });

        (walletTransactions || []).forEach(w => {
          if (w.type !== "debit") return;
          const txDate = new Date(w.created_at);
          
          let desc = w.narration || "Account Withdrawal";
          const lowerDesc = desc.toLowerCase();

          if (lowerDesc.includes("transfer to")) {
            desc = "Funds Transfer Sent";
          } else if (lowerDesc.includes("loan repayment")) {
            desc = "Loan Repayment Repaid";
          } else if (lowerDesc.includes("joining fee")) {
            desc = "Joining Fee Deduction";
          } else if (lowerDesc.includes("processing fee")) {
            desc = "Processing Fee Deduction";
          }

          events.push({
            id: `wallet-debit-${w.id}`,
            date: txDate,
            description: desc,
            reference: w.mpesa_reference || `WAL-DR-${w.id.substring(0, 6)}`,
            debit: Number(w.amount),
            credit: 0,
            amount: Number(w.amount),
            sequence: 3,
            timestamp: txDate.getTime(),
          });
        });

        events.sort((a, b) => {
          const dateDiff = a.timestamp - b.timestamp;
          if (dateDiff !== 0) return dateDiff;
          return a.sequence - b.sequence;
        });

        const chronologicalLedger = [];
        events.forEach(e => {
          if (e.credit > 0) {
            runningBalance += e.credit;
          }
          if (e.debit > 0) {
            runningBalance -= e.debit;
          }
          chronologicalLedger.push({
            ...e,
            balance: runningBalance
          });
        });

        setTransactions(chronologicalLedger);
        setFilteredTransactions(chronologicalLedger);

        // Summaries calculations
        let totalLoanVal = 0;
        let totalPayableVal = 0;
        let totalPaidVal = 0;
        let totalInterestVal = 0;

        loans.forEach(l => {
          totalLoanVal += Number(l.scored_amount) || 0;
          totalPayableVal += Number(l.total_payable) || 0;
          totalInterestVal += Number(l.total_interest) || 0;
        });

        loanPayments.forEach(p => {
          totalPaidVal += Number(p.paid_amount) || 0;
        });

        const outstanding = totalPayableVal - totalPaidVal;

        setStatementSummary({
          totalLoanAmount: totalLoanVal,
          principal: totalLoanVal,
          interest: totalInterestVal,
          totalPaid: totalPaidVal,
          outstandingBalance: outstanding > 0 ? outstanding : 0
        });

      } catch (err) {
        console.error(" Statement fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [customerId, profile, tenant?.id]);

  // ========== Filter Application ==========
  const applyFilters = useCallback((filterType, start, end, search) => {
    let result = [...transactions];

    if (filterType !== "all") {
      const now = new Date();
      let filterStartDate = new Date();

      if (filterType === "today") {
        filterStartDate.setHours(0, 0, 0, 0);
      } else if (filterType === "week") {
        const day = now.getDay();
        filterStartDate.setDate(now.getDate() - day);
        filterStartDate.setHours(0, 0, 0, 0);
      } else if (filterType === "month") {
        filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (filterType === "quarter") {
        const quarter = Math.floor(now.getMonth() / 3);
        filterStartDate = new Date(now.getFullYear(), quarter * 3, 1);
      } else if (filterType === "year") {
        filterStartDate = new Date(now.getFullYear(), 0, 1);
      } else if (filterType === "custom" && start && end) {
        filterStartDate = new Date(start);
        filterStartDate.setHours(0, 0, 0, 0);
        const filterEndDate = new Date(end);
        filterEndDate.setHours(23, 59, 59, 999);

        result = result.filter(t => {
          const tDate = new Date(t.date);
          return tDate >= filterStartDate && tDate <= filterEndDate;
        });
        setFilteredTransactions(result);
        setCurrentPage(1);
        return;
      }

      result = result.filter(t => new Date(t.date) >= filterStartDate);
    }

    if (search.trim()) {
      const s = search.toLowerCase().trim();
      result = result.filter(t =>
        t.reference?.toLowerCase().includes(s) ||
        t.description?.toLowerCase().includes(s)
      );
    }

    setFilteredTransactions(result);
    setCurrentPage(1);
  }, [transactions]);

  const handleDateFilterChange = (val) => {
    setDateFilter(val);
    if (val !== "custom") {
      applyFilters(val, "", "", searchTerm);
    }
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      applyFilters("custom", customStartDate, customEndDate, searchTerm);
    }
  };

  const handleFindTransaction = () => {
    applyFilters(dateFilter, customStartDate, customEndDate, searchTerm);
  };

  const handleResetSearch = () => {
    setSearchTerm("");
    applyFilters(dateFilter, customStartDate, customEndDate, "");
  };

  // ========== Pagination and Sorting ==========
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  
  const currentData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  const generatePageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 2) end = 4;
      if (currentPage >= totalPages - 1) start = totalPages - 3;
      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const formatAmount = (num) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(num || 0);

  // ========== Exports ==========
  const exportToPDF = () => {
    const doc = new jsPDF("p", "pt", "a4");
    const company = tenant?.company_name || "Jasiri";
    
    doc.setFontSize(16);
    doc.text(company, 40, 40);
    doc.setFontSize(12);
    doc.text("Customer Account Statement", 40, 60);

    autoTable(doc, {
      startY: 80,
      head: [["Date", "Description", "Reference", "Debit", "Credit", "Balance"]],
      body: filteredTransactions.map(t => [
        new Date(t.date).toLocaleString("en-KE"),
        t.description,
        t.reference,
        t.debit > 0 ? formatAmount(t.debit) : "-",
        t.credit > 0 ? formatAmount(t.credit) : "-",
        formatAmount(t.balance)
      ]),
      headStyles: { fillColor: [26, 122, 74] },
    });

    doc.save(`statement_${customerId}.pdf`);
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredTransactions.map(t => ({
      Date: new Date(t.date).toLocaleString("en-KE"),
      Description: t.description,
      Reference: t.reference,
      Debit: t.debit,
      Credit: t.credit,
      Balance: t.balance
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    XLSX.writeFile(wb, `statement_${customerId}.xlsx`);
  };

  const exportToWord = async () => {
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: "Customer Account Statement", heading: "Heading1" }),
          new Table({
            rows: [
              new TableRow({
                children: ["Date", "Description", "Ref", "Debit", "Credit", "Balance"].map(h => 
                  new TableCell({ children: [new Paragraph(h)] })
                )
              }),
              ...filteredTransactions.map(t => new TableRow({
                children: [
                  new Date(t.date).toLocaleDateString(),
                  t.description,
                  t.reference,
                  t.debit.toString(),
                  t.credit.toString(),
                  t.balance.toString()
                ].map(v => new TableCell({ children: [new Paragraph(v)] }))
              }))
            ]
          })
        ]
      }]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `statement_${customerId}.docx`);
  };

  const handleExport = () => {
    if (exportFormat === "pdf") exportToPDF();
    else if (exportFormat === "excel") exportToExcel();
    else if (exportFormat === "word") exportToWord();
    else {
      const csv = filteredTransactions.map(t => 
        [new Date(t.date).toLocaleString(), t.description, t.reference, t.debit, t.credit, t.balance].join(",")
      ).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `statement_${customerId}.csv`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
        <SkeletonTable rows={5} cols={6} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
      <h1 className="text-xs text-slate-500 mb-4 font-medium font-outfit">
        Reports / Customer Statement
      </h1>

      <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        {/* Header Section */}
        <div className="p-4 border-b border-border-light flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface">
          <div>
            <h2 className="text-xs font-semibold text-heading font-outfit uppercase tracking-wider">
              {tenant?.company_name || "Company Name"}
            </h2>
            <h3 className="text-sm font-semibold text-heading font-outfit mt-1">
              Customer Statement: {[customerInfo.Firstname, customerInfo.Surname].filter(Boolean).join(" ")}
            </h3>
            <p className="text-[10px] text-muted mt-0.5">
              Phone: {customerInfo.mobile || "N/A"} · ID: {customerInfo.id_number || "N/A"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Period select */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted uppercase">Period</span>
              <div className="w-40 z-20">
                <CustomSelect
                  value={dateFilter}
                  onChange={handleDateFilterChange}
                  options={[
                    { value: "all", label: "Full History" },
                    { value: "today", label: "Today Only" },
                    { value: "week", label: "This Week" },
                    { value: "month", label: "This Month" },
                    { value: "quarter", label: "This Quarter" },
                    { value: "year", label: "This Year" },
                    { value: "custom", label: "Custom Range" }
                  ]}
                  compact
                  fullWidth
                />
              </div>
            </div>

            {/* Custom Range apply */}
            {dateFilter === "custom" && (
              <div className="flex items-center gap-2 border border-border bg-card p-1 rounded-md">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent text-xs text-body border-none focus:outline-none w-[110px]"
                />
                <span className="text-border">|</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent text-xs text-body border-none focus:outline-none w-[110px]"
                />
                <button
                  onClick={handleCustomDateApply}
                  className="px-2 py-1 bg-brand-primary text-white rounded text-[10px] font-semibold hover:bg-brand-primary/90 transition-colors"
                >
                  Apply
                </button>
              </div>
            )}

            {/* Search filter input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search transaction ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-56 pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-card text-body focus:border-brand-primary focus:outline-none transition-colors duration-200"
              />
            </div>

            {/* Export options */}
            <div className="flex items-center gap-2">
              <div className="w-28 z-20">
                <CustomSelect
                  value={exportFormat}
                  onChange={setExportFormat}
                  options={[
                    { value: "csv", label: "CSV" },
                    { value: "excel", label: "Excel" },
                    { value: "word", label: "Word" },
                    { value: "pdf", label: "PDF" }
                  ]}
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
          </div>
        </div>

        {/* Summary Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 p-4 border-b border-border-light bg-card/30">
          <div className="bg-card p-3 rounded-lg border border-border shadow-sm font-outfit">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Total Loan Amount</p>
            <p className="text-sm font-bold text-brand mt-1">{formatAmount(statementSummary.totalLoanAmount)}</p>
          </div>
          <div className="bg-card p-3 rounded-lg border border-border shadow-sm font-outfit">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Principal</p>
            <p className="text-sm font-bold text-emerald-700 mt-1">{formatAmount(statementSummary.principal)}</p>
          </div>
          <div className="bg-card p-3 rounded-lg border border-border shadow-sm font-outfit">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Interest</p>
            <p className="text-sm font-bold text-amber-600 mt-1">{formatAmount(statementSummary.interest)}</p>
          </div>
          <div className="bg-card p-3 rounded-lg border border-border shadow-sm font-outfit">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Total Paid</p>
            <p className="text-sm font-bold text-purple-700 mt-1">{formatAmount(statementSummary.totalPaid)}</p>
          </div>
          <div className="bg-card p-3 rounded-lg border border-border shadow-sm font-outfit">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Outstanding Balance</p>
            <p className="text-sm font-bold text-red-700 mt-1">{formatAmount(statementSummary.outstandingBalance)}</p>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto font-outfit">
          <table className="min-w-full divide-y divide-border-light">
            <thead className="bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap text-muted">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap text-muted">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap text-muted">Reference</th>
                <th className="px-4 py-3 text-right text-xs font-medium whitespace-nowrap text-muted">Debit</th>
                <th className="px-4 py-3 text-right text-xs font-medium whitespace-nowrap text-muted">Credit</th>
                <th className="px-4 py-3 text-right text-xs font-medium whitespace-nowrap text-muted">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {currentData.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => {
                    if (!t.isBalanceBF) {
                      setSelectedTransaction(t);
                      setIsModalOpen(true);
                    }
                  }}
                  className={`transition-colors ${t.isBalanceBF
                    ? "bg-surface font-bold pointer-events-none"
                    : "hover:bg-surface cursor-pointer text-xs"
                    }`}
                >
                  <td className="px-4 py-3 text-xs text-body font-medium">
                    {new Date(t.date).toLocaleString("en-KE")}
                  </td>
                  <td className="px-4 py-3 text-xs text-heading font-semibold">{t.description}</td>
                  <td className="px-4 py-3 text-xs text-body">{t.reference}</td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-red-600">
                    {t.debit !== 0 ? formatAmount(t.debit) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-green-600">
                    {t.credit > 0 ? formatAmount(t.credit) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-heading">
                    {formatAmount(t.balance)}
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td className="p-8 text-center text-xs text-muted" colSpan={6}>
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <Pagination
            totalItems={filteredTransactions.length}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs font-medium text-muted">
          Generated by Jasiri Lending Software System • {reportTimestamp}
        </p>
      </div>

      {/* Transaction Details Modal */}
      {isModalOpen && selectedTransaction && (
        <Modal
          open={isModalOpen}
          title="Transaction Details"
          onClose={() => setIsModalOpen(false)}
        >
          <div className="space-y-4 font-outfit">
            <div className="text-center py-4 border-b border-border-light">
              <div className={`text-2xl font-bold ${selectedTransaction.credit > 0 ? 'text-brand' : 'text-heading'}`}>
                {formatAmount(selectedTransaction.credit > 0 ? selectedTransaction.credit : selectedTransaction.debit)}
              </div>
              <div className="text-[10px] uppercase text-muted tracking-wider mt-1">
                {selectedTransaction.credit > 0 ? 'Total Credit Received' : 'Total Applied / Deducted'}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center py-1 text-xs">
                <span className="text-muted">Type / Description</span>
                <span className="font-semibold text-heading">{selectedTransaction.description}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-xs">
                <span className="text-muted">Reference</span>
                <span className="font-semibold text-heading">{selectedTransaction.reference}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-xs">
                <span className="text-muted">Date & Time</span>
                <span className="font-semibold text-heading">
                  {new Date(selectedTransaction.date).toLocaleString("en-KE")}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 text-xs">
                <span className="text-muted">Running Balance</span>
                <span className="font-bold text-heading">{formatAmount(selectedTransaction.balance)}</span>
              </div>
            </div>

            <div className="p-3 bg-surface rounded-lg border border-border-light mt-2 flex gap-3 text-muted">
              <div className={`p-2 rounded h-fit ${selectedTransaction.credit > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-brand/10 text-brand'}`}>
                <Globe size={16} />
              </div>
              <div className="text-[10px] leading-relaxed">
                This is a reconciled financial record from the Jasiri Lending ledger.
                The ID <strong className="text-heading">{selectedTransaction.reference}</strong> uniquely identifies this event.
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CustomerStatementModal;