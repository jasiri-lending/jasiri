
import { useState, useEffect } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Share2,
  Printer,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft,
  Globe,
  X
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth.js";
import { useParams } from "react-router-dom";

const CustomerStatementModal = () => {
  // Brand Colors
  const colors = {
    primary: "#2E5E99",
    secondary: "#7BA4D0",
    muted: "#F8FAFC"
  };

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

    // Set initial statement period
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

        // 1️ Customer Info
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

        // 2️ Loans
        const { data: loans = [] } = await supabase
          .from("loans")
          .select("id, scored_amount, processing_fee, registration_fee, disbursed_at, disbursed_date, created_at, total_payable, total_interest")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: true });

        // 3️ Loan Payments - FIXED: Get all loan payments for summary
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

        // 4️ Loan Installments - FIXED: Get installments to calculate principal_paid + interest_paid
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

        // 5️ C2B Payments (matching mobile, id_number, or specific receipts from loan_payments)
        const normalizedMobile = customer.mobile?.replace(/^\+?254|^0/, "254");
        const receiptIds = [...new Set((loanPayments || []).map(p => p.mpesa_receipt).filter(Boolean))];
        const idNo = customer.id_number;

        let c2bQuery = supabase
          .from("mpesa_c2b_transactions")
          .select("id, amount, transaction_time, transaction_id, loan_id, phone_number, status, payment_type, reference, billref")
          .order("transaction_time", { ascending: true });

        // Build composite filter
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

        // 6️ Loan Disbursement Transactions
        const { data: disbursements = [] } = await supabase
          .from("loan_disbursement_transactions")
          .select("id, amount, transaction_id, loan_id, processed_at, status")
          .eq("status", "success")
          .in("loan_id", loans.map(l => l.id))
          .order("processed_at", { ascending: true });

        // 7️ Wallet Transactions (Credits and Debits)
        const { data: walletTransactions, error: walletError } = await supabase
          .from("customer_wallets")
          .select("id, amount, created_at, mpesa_reference, type, narration, transaction_type, debit, credit")
          .eq("customer_id", customerId)
          .eq("tenant_id", tenant?.id)
          .order("created_at", { ascending: true });

        if (walletError) console.error(" Wallet fetch failed:", walletError.message);

        // Track processed transaction IDs to prevent duplicates
        const processedTransactionIds = new Set();

        // STEP 1: MONEY IN (CREDITS)
        const processedMpesaRefs = new Set();

        // 1a. M-Pesa C2B Transactions (Primary Source for Deposits)
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

        // 1b. Wallet Credits (Transfers, Adjustments, and C2B if not already processed)
        (walletTransactions || []).forEach(w => {
          if (w.type !== "credit") return;
          const ref = w.mpesa_reference;

          // If this is a C2B already handled, skip to avoid double counting the Credit
          if (ref && processedMpesaRefs.has(ref)) return;
          if (ref) processedMpesaRefs.add(ref);

          const txDate = new Date(w.created_at);
          
          // Sanitize Description - Harmonize legacy DB strings with UI/Brand strings
          let desc = w.narration || "Account Deposit";
          const lowerDesc = desc.toLowerCase();
          
          if (lowerDesc.includes("transfer from")) {
            desc = "Funds Transfer Received";
          } else if (
            lowerDesc.includes("payment received") || 
            lowerDesc.includes("no active loan") ||
            lowerDesc.includes("c2b payment") ||
            lowerDesc.includes("mpesa payment")
          ) {
            desc = "Account Deposit";
          }

          events.push({
            id: `wallet-credit-${w.id}`,
            date: txDate,
            description: desc,
            reference: ref || "-",
            debit: 0,
            credit: Number(w.amount || w.credit || 0),
            amount: Number(w.amount || w.credit || 0),
            sequence: 4,
            timestamp: txDate.getTime(),
          });
        });

        // STEP 2: FUNDS APPLIED / USED (DEBITS)

        // 2a. Wallet Debits (Fees, Transfers Out, Withdrawals)
        (walletTransactions || []).forEach(w => {
          if (w.type !== "debit") return;
          const txDate = new Date(w.created_at);

          let desc = w.narration || "Account Withdrawal";
          // Hide technical wallet-to-loan transfers from the UI statement 
          // to prevent perceived double-debiting (the actual loan payment row handles this).
          if (desc === "Applied from wallet to loan repayment" || w.transaction_type === "loan") return;

          const lowerDesc = desc.toLowerCase();
          
          let seq = 10;
          if (w.transaction_type === "registration") {
            desc = "Registration Fee Payment";
            seq = 0;
          } else if (w.transaction_type === "processing") {
            desc = "Processing Fee Payment";
            seq = 2;
          } else if (lowerDesc.includes("transfer to")) {
            desc = "Funds Transfer Sent";
          } else if (
            lowerDesc.includes("withdrawal to") || 
            lowerDesc.includes("b2c transaction") ||
            lowerDesc.includes("mpesa b2c")
          ) {
            desc = "Account Withdrawal";
          }

          events.push({
            id: `wallet-debit-${w.id}`,
            date: txDate,
            description: desc,
            reference: "-",
            debit: Number(w.amount || w.debit || 0),
            credit: 0,
            amount: -Number(w.amount || w.debit || 0),
            sequence: seq,
            timestamp: txDate.getTime(),
          });
        });

        // 2b. Loan Repayment Allocations (Debits)
        (loanPayments || []).forEach((p, idx) => {
          const paymentDate = new Date(p.paid_at || p.created_at);
          const amt = Number(p.paid_amount || 0);
          if (!amt) return;

          let desc = "Loan Repayment Allocation";
          if (p.payment_type === "interest") desc = "Interest Repayment";
          else if (p.payment_type === "principal") desc = "Principal Repayment";
          else if (p.payment_type === "penalty") desc = "Penalty Payment";

          events.push({
            id: `payment-allocation-debit-${p.id}`,
            date: paymentDate,
            description: desc,
            reference: "-",
            debit: amt,
            credit: 0,
            amount: -amt,
            sequence: 5 + idx,
            timestamp: paymentDate.getTime(),
          });
        });

        // STEP 3: DISBURSEMENTS (Double Entry)
        (loans || []).forEach(loan => {
          const disb = (disbursements || []).find(d => d.loan_id === loan.id);
          if (!disb || disb.status !== "success") return;

          const loanDate = new Date(disb.processed_at);
          const baseTimestamp = loanDate.getTime();
          const disbAmount = Number(disb.amount);

          // 3a. Credit: Cash Hand-over
          events.push({
            id: `disb-credit-${disb.id}`,
            date: loanDate,
            description: "Mobile Money Disbursement",
            reference: disb.transaction_id || "-",
            debit: 0,
            credit: disbAmount,
            amount: disbAmount,
            sequence: 1,
            timestamp: baseTimestamp,
          });

          // 3b. Debit: Liability Obligation
          events.push({
            id: `disb-debit-obligation-${disb.id}`,
            date: loanDate,
            description: "Loan Disbursement",
            reference: "-",
            debit: disbAmount,
            credit: 0,
            amount: -disbAmount,
            sequence: 3,
            timestamp: baseTimestamp,
          });
        });

        // STEP 4b: PENALTIES (from installments)
        (loanInstallments || []).forEach(inst => {
          const penalty = Number(inst.net_penalty || inst.penalty_amount || 0);
          if (penalty > 0) {
            const penaltyDate = new Date(inst.due_date);
            // Penalties are usually charged the day after due date
            penaltyDate.setDate(penaltyDate.getDate() + 1);

            const transactionKey = `penalty-${inst.id}`;
            if (processedTransactionIds.has(transactionKey)) return;
            processedTransactionIds.add(transactionKey);

            events.push({
              id: transactionKey,
              date: penaltyDate,
              description: "Late Payment Penalty",
              reference: "-",
              debit: penalty,
              credit: 0,
              amount: -penalty,
              sequence: 8, // Penalties usually late in the sequence
              timestamp: penaltyDate.getTime(),
            });
          }
        });

        // STEP 5: SORT & CALCULATE RUNNING BALANCE
        // Sort chronologically (oldest first) by timestamp and then sequence
        events.sort((a, b) => {
          if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
          return a.sequence - b.sequence;
        });

        // Calculate running balance in correctly sorted order
        events.forEach(e => {
          runningBalance += e.amount;
          e.balance = runningBalance;
        });

        // Add Balance B/F at the top (current date, showing final balance)
        const balanceBF = {
          id: "balance-bf",
          date: new Date(),
          description: "Balance B/F",
          reference: "-",
          debit: 0,
          credit: 0,
          balance: runningBalance,
          sequence: 0,
          timestamp: new Date().getTime(),
          isBalanceBF: true
        };

        // Reverse to show newest first (Balance B/F on top)
        const sortedEvents = [balanceBF, ...events.reverse()];

        // Update statement period (Dynamic from first transaction to today)
        if (events.length > 0) {
          const transactionDates = events.map(t => new Date(t.date));
          const minDate = new Date(Math.min(...transactionDates));
          const today = new Date();

          // Calculate period string (e.g. "3 Month" or "15 Day")
          const diffTime = Math.abs(today - minDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const diffMonths = Math.floor(diffDays / 30);

          let periodStr = `${diffDays} Day`;
          if (diffMonths > 0) {
            periodStr = `${diffMonths} Month${diffMonths > 1 ? 's' : ''}`;
          }

          setStatementPeriod({
            startDate: minDate.toLocaleDateString("en-KE"),
            endDate: today.toLocaleDateString("en-KE"),
            period: periodStr
          });
        }

        const customerLoans = loans || [];

        // 1️ Principal = total scored_amount for all this customer's loans
        const principal = customerLoans.reduce((sum, loan) => sum + (loan.scored_amount || 0), 0);

        // 2️ Interest = total_interest for all this customer's loans
        const interest = customerLoans.reduce((sum, loan) => sum + (loan.total_interest || 0), 0);

        // 3️ Total Payable (Loan Amount) = sum of total_payable (principal + interest) + penalties
        const basePayable = (customerLoans || []).reduce((sum, loan) => sum + (loan.total_payable || 0), 0);
        const totalPenalties = (loanInstallments || []).reduce((sum, i) => sum + Number(i.net_penalty || i.penalty_amount || 0), 0);
        const totalLoanAmount = basePayable + totalPenalties;

        // 4️ Total Paid - Source primarily from loan_payments
        let totalPaid = 0;
        let interestPaidTotal = 0;
        let principalPaidTotal = 0;
        let penaltyPaidTotal = 0;

        if ((loanPayments || []).length > 0) {
          loanPayments.forEach(p => {
            const amt = Number(p.paid_amount || 0);
            if (p.payment_type === "interest") {
              interestPaidTotal += amt;
            } else if (p.payment_type === "principal") {
              principalPaidTotal += amt;
            } else if (p.payment_type === "penalty") {
              penaltyPaidTotal += amt;
            }
            // Sum all for total paid against the loan
            totalPaid += amt;
          });
        } else if ((loanInstallments || []).length > 0) {
          totalPaid = (loanInstallments || []).reduce((sum, i) => sum + (i.paid_amount || 0), 0);
        }

        console.log('Summary Calculation (AccountList):', {
          totalLoanAmount,
          principal,
          interest: (interest || 0),
          totalPenalties,
          totalPaid,
          interestPaidTotal,
          principalPaidTotal,
          penaltyPaidTotal
        });

        // 5️ Outstanding Balance = Total Payable - Total Paid
        const outstandingBalance = totalLoanAmount - totalPaid;

        // Update summary (REVERTED TO ORIGINAL 5)
        setStatementSummary({
          totalLoanAmount,   // total payable from loans table
          principal,         // scored_amount
          interest,          // total_interest
          totalPaid,         // from loan_payments OR installments
          outstandingBalance // total payable - total paid
        });

        setTransactions(sortedEvents);
        setFilteredTransactions(sortedEvents);

      } catch (err) {
        console.error(" Statement generation failed:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [customerId]);

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
        end = customEndDate ? new Date(customEndDate) : new Date();
        end.setHours(23, 59, 59, 999);
        break;
      default:
        return null;
    }
    return { start, end };
  };

  const applyFilters = (data, filter) => {
    const balanceBF = data.find((t) => t.isBalanceBF);
    const other = data.filter((t) => !t.isBalanceBF);

    let filtered = other;
    if (filter !== "all") {
      const range = getDateRange(filter);
      if (range) {
        filtered = other.filter((t) => {
          const txDate = new Date(t.date);
          return txDate >= range.start && txDate <= range.end;
        });
      }
    }

    setFilteredTransactions(balanceBF ? [balanceBF, ...filtered] : filtered);
    setCurrentPage(1);
  };

  const handleDateFilterChange = (filter) => {
    setDateFilter(filter);
    applyFilters(transactions, filter);
  };

  const handleCustomDateApply = () => {
    applyFilters(transactions, "custom");
  };

  // const handleSort = (key) => {
  //   if (key === "balance") return;
  //   const newDir =
  //     sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
  //   setSortConfig({ key, direction: newDir });

  //   const balanceBF = filteredTransactions.find((t) => t.isBalanceBF);
  //   const other = filteredTransactions.filter((t) => !t.isBalanceBF);

  //   const sorted = [...other].sort((a, b) => {
  //     let aVal = a[key],
  //       bVal = b[key];
  //     if (key === "date") {
  //       aVal = new Date(aVal);
  //       bVal = new Date(bVal);
  //     }
  //     const comp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  //     return newDir === "asc" ? comp : -comp;
  //   });

  //   setFilteredTransactions(balanceBF ? [balanceBF, ...sorted] : sorted);
  // };

  // Export Functions
  const getExportData = () => {
    return dateFilter === "all" ? transactions : filteredTransactions;
  };

  const getExportFileName = (ext) => {
    const firstName = customerInfo?.Firstname || "";
    const surname = customerInfo?.Surname || "";
    const name = `${firstName} ${surname}`.trim() || "Customer";
    return `${name} Account Statement.${ext}`;
  };

  const exportToCSV = () => {
    const data = getExportData();
    const headers = [
      "Date/Time",
      "Description",
      "Reference",
      "Debit",
      "Credit",
      "Balance",
    ];

    const csvContent = [
      headers.join(","),
      ...data.map((t) =>
        [
          `"${new Date(t.date).toLocaleString("en-KE")}"`,
          `"${t.description}"`,
          `"${t.reference}"`,
          `"${formatAmount(t.debit)}"`,
          `"${formatAmount(t.credit)}"`,
          `"${formatAmount(t.balance)}"`,
        ].join(",")
      ),
    ].join("\n");

    downloadFile(csvContent, getExportFileName("csv"), "text/csv");
  };

  const exportToWord = () => {
    const data = getExportData();
    const firstName = customerInfo?.Firstname || "";
    const surname = customerInfo?.Surname || "";
    const exportCustomerName = `${firstName} ${surname}`.trim() || "Customer";
    const companyName = tenant?.company_name || "Jasiri Lending Software";

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="UTF-8">
          <title>${exportCustomerName} Account Statement</title>
          <style>
            @page {
              size: A4;
              margin: 1in;
            }
            body { font-family: Arial, sans-serif; font-size: 10pt; margin: 0; padding: 0; }
            .header { text-align: center; margin-bottom: 10px; }
            .header h1 { font-size: 16pt; margin-bottom: 4px; }
            .header h2 { font-size: 13pt; margin-bottom: 6px; }
            .header p { margin: 2px 0; font-size: 10pt; }
            .summary { margin: 10px 0; padding: 8px; background: #f9f9f9; border: 1px solid #ddd; }
            .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .summary-table td { border: 1px solid #ddd; padding: 6px; text-align: center; }
            table { border-collapse: collapse; width: 98%; margin: 0 auto; }
            th, td { border: 1px solid #999; padding: 6px 8px; font-size: 9pt; }
            th { background-color: #f2f2f2; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${companyName}</h1>
            <h2>${exportCustomerName} Account Statement</h2>
            <p><strong>Mobile:</strong> ${customerInfo?.mobile || "N/A"}</p>
            <p><strong>Report Generated:</strong> ${reportTimestamp}</p>
          </div>

          <div class="summary">
            <table class="summary-table">
              <tr>
                <td><strong>Total Loan Amount</strong></td>
                <td><strong>Principal</strong></td>
                <td><strong>Interest</strong></td>
                <td><strong>Total Paid</strong></td>
                <td><strong>Outstanding Balance</strong></td>
              </tr>
              <tr>
                <td>${formatAmount(statementSummary.totalLoanAmount)}</td>
                <td>${formatAmount(statementSummary.principal)}</td>
                <td>${formatAmount(statementSummary.interest)}</td>
                <td>${formatAmount(statementSummary.totalPaid)}</td>
                <td>${formatAmount(statementSummary.outstandingBalance)}</td>
              </tr>
            </table>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Description</th>
                <th>Reference</th>
                <th>Debit (Ksh)</th>
                <th>Credit (Ksh)</th>
                <th>Balance (Ksh)</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((t) => `
                <tr>
                  <td>${new Date(t.date).toLocaleString("en-KE")}</td>
                  <td>${t.description}</td>
                  <td>${t.reference}</td>
                  <td>${formatAmount(t.debit)}</td>
                  <td>${formatAmount(t.credit)}</td>
                  <td>${formatAmount(t.balance)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div style="margin-top: 20px; font-style: italic; text-align: center; font-size: 9pt;">
            <p>Generated automatically by Jasiri Lending Software System.</p>
          </div>
        </body>
      </html>
    `;

    downloadFile(htmlContent, getExportFileName("doc"), "application/msword");
  };

  const exportToExcel = async () => {
    const XLSX = await import("xlsx");
    const data = getExportData();
    const firstName = customerInfo?.Firstname || "";
    const surname = customerInfo?.Surname || "";
    const exportCustomerName = `${firstName} ${surname}`.trim() || "Customer";
    const companyName = tenant?.company_name || "Jasiri Lending Software";

    const worksheetData = [
      [companyName],
      [`${exportCustomerName} Account Statement`],
      [`Report Generated: ${reportTimestamp}`],
      [],
      ["Total Loan Amount", "Principal", "Interest", "Total Paid", "Outstanding Balance"],
      [
        formatAmount(statementSummary.totalLoanAmount),
        formatAmount(statementSummary.principal),
        formatAmount(statementSummary.interest),
        formatAmount(statementSummary.totalPaid),
        formatAmount(statementSummary.outstandingBalance)
      ],
      [],
      ["Date/Time", "Description", "Reference", "Debit (Ksh)", "Credit (Ksh)", "Balance (Ksh)"],
      ...data.map((t) => [
        new Date(t.date).toLocaleString("en-KE"),
        t.description,
        t.reference,
        formatAmount(t.debit),
        formatAmount(t.credit),
        formatAmount(t.balance),
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Account Statement");

    const colWidths = [
      { wch: 22 }, { wch: 30 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];
    worksheet["!cols"] = colWidths;

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getExportFileName("xlsx");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF("p", "mm", "a4");

    const data = getExportData().map((t) => [
      new Date(t.date).toLocaleString("en-KE"),
      t.description,
      t.reference,
      formatAmount(t.debit),
      formatAmount(t.credit),
      formatAmount(t.balance),
    ]);

    const firstName = customerInfo?.Firstname || "";
    const surname = customerInfo?.Surname || "";
    const exportCustomerName = `${firstName} ${surname}`.trim() || "Customer";
    const companyName = tenant?.company_name || "Jasiri Lending Software";

    // Header
    doc.setFontSize(14);
    doc.text(companyName, 105, 15, { align: "center" });
    doc.setFontSize(11);
    doc.text(
      `${exportCustomerName} Account Statement`,
      105,
      22,
      { align: "center" }
    );
    doc.text(`Report Generated: ${reportTimestamp}`, 105, 29, {
      align: "center",
    });

    // Summary Table
    autoTable(doc, {
      head: [["Total Loan Amount", "Principal", "Interest", "Total Paid", "Outstanding Balance"]],
      body: [[
        formatAmount(statementSummary.totalLoanAmount),
        formatAmount(statementSummary.principal),
        formatAmount(statementSummary.interest),
        formatAmount(statementSummary.totalPaid),
        formatAmount(statementSummary.outstandingBalance)
      ]],
      startY: 40,
      styles: { fontSize: 9, cellPadding: 3 },
      theme: "grid",
    });

    // Main Table
    autoTable(doc, {
      head: [["Date/Time", "Description", "Reference", "Debit", "Credit", "Balance"]],
      body: data,
      startY: 60,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 45 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 25 },
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        textColor: [0, 0, 0],
      },
      theme: "grid",
    });

    doc.save(getExportFileName("pdf"));
  };

  const downloadFile = (content, fileName, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    switch (exportFormat) {
      case "csv":
        exportToCSV();
        break;
      case "excel":
        exportToExcel();
        break;
      case "word":
        exportToWord();
        break;
      case "pdf":
        exportToPDF();
        break;
      default:
        exportToCSV();
    }
  };

  const formatAmount = (amt) => {
    if (amt === 0) return "0.00";
    return new Intl.NumberFormat("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amt);
  };

  // const SortableHeader = ({ label, sortKey }) => {
  //   const isActive = sortConfig.key === sortKey;
  //   const isAsc = sortConfig.direction === "asc";
  //   return (
  //     <th
  //       onClick={() => handleSort(sortKey)}
  //       className="px-4 py-2 text-left text-xs font-semibold cursor-pointer text-white hover:bg-blue-700"
  //     >
  //       <div className="flex items-center gap-1">
  //         {label}
  //         {isActive &&
  //           (isAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
  //       </div>
  //     </th>
  //   );
  // };

  // Enhanced Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const currentData = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const generatePageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      pages.push(1);
      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  };

  const handleFindTransaction = () => {
    if (!searchTerm.trim()) {
      alert("Please enter a transaction ID to search.");
      return;
    }

    const found = transactions.find(
      (tx) =>
        tx.reference?.includes(searchTerm) ||
        tx.description?.includes(searchTerm)
    );

    if (found) {
      setSelectedTransaction(found);
      setIsModalOpen(true);
      setFilteredTransactions([found]); // Optional: still filter the background table
    } else {
      alert("Transaction not found.");
      // Reset to show all transactions if not found
      applyFilters(transactions, dateFilter);
    }
  };

  // Reset search and show all transactions
  const handleResetSearch = () => {
    setSearchTerm("");
    applyFilters(transactions, dateFilter);
  };

  // Share Report via Email (as PDF)
  const handleShareReport = async () => {
    try {
      const response = await fetch("/api/send-statement-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          customerName: customerInfo?.name,
          statementPeriod,
          reportTimestamp,
          statementSummary
        }),
      });

      if (!response.ok) throw new Error("Failed to send email");
      alert("Report shared successfully via email!");
    } catch (err) {
      console.error(err);
      alert("Error sharing report. Please try again.");
    }
  };

  // const handleGoBack = () => {
  //   navigate(-1);
  // };

  const customerName = `${customerInfo?.Firstname || ""} ${customerInfo?.Surname || ""}`.trim() || "Customer";

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-muted" >
      <div className="max-w-7xl mx-auto">

        {/* Customer Statement Header */}
        <div className="mb-6 p-6 text-center flex flex-col items-center">
          {/* Customer Name */}
          <h2 className="text-2xl font-bold text-slate-600">
            {customerName}
          </h2>

          {/* Statement Title */}
          <p className="text-sm text-stone-600 mt-1 uppercase">
            Customer Account Statement
          </p>

          {/* Statement Period */}
          <p className="text-base text-gray-700 leading-relaxed mt-4">
            This report is for the{" "}
            <span className="font-bold text-blue-800">
              {statementPeriod.period}
            </span>{" "}
            period, starting on{" "}
            <span className="font-bold text-blue-800">
              {statementPeriod.startDate}
            </span>{" "}
            and ending on{" "}
            <span className="font-bold text-blue-800">
              {statementPeriod.endDate}
            </span>.
          </p>
        </div>
 
        {/* Compact Premium Filter & Action Bar */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 mb-6 overflow-hidden transform transition-all hover:shadow-xl">
          <div className="p-2 sm:p-3 bg-gray-50/50">
            <div className="flex flex-wrap items-center justify-between gap-4">
              
              {/* Left Side: Filter & Custom Range */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Period Select */}
                <div className="flex items-center gap-2 px-3 bg-white border-2 rounded-lg shadow-sm focus-within:ring-2 focus-within:ring-blue-100 transition-all h-10" style={{ borderColor: colors.secondary }}>
                  <Globe size={16} className="text-gray-400" />
                  <span className="text-xs font-bold text-gray-700 whitespace-nowrap">Filter Period:</span>
                  <select
                    value={dateFilter}
                    onChange={(e) => handleDateFilterChange(e.target.value)}
                    className="text-xs font-bold focus:outline-none bg-transparent min-w-[120px] cursor-pointer"
                  >
                    <option value="all">Full History</option>
                    <option value="today">Today Only</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                    <option value="year">This Year</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
 
                {/* Custom Date Range Inputs */}
                {dateFilter === "custom" && (
                  <div className="flex items-center gap-2 p-0.5 bg-white border-2 rounded-lg shadow-sm animate-in slide-in-from-left duration-300 h-10" style={{ borderColor: colors.secondary }}>
                    <div className="flex items-center gap-2 px-2">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="text-xs font-bold focus:outline-none bg-transparent border-none p-0 w-[110px]"
                      />
                      <span className="text-gray-300 font-bold">|</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="text-xs font-bold focus:outline-none bg-transparent border-none p-0 w-[110px]"
                      />
                    </div>
                    <button
                      onClick={handleCustomDateApply}
                      className="h-full px-3 bg-blue-600 text-white rounded-md text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-inner"
                      style={{ backgroundColor: colors.primary }}
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
 
              {/* Right Side: Tools & Actions */}
              <div className="flex flex-wrap items-center gap-4 flex-grow lg:flex-grow-0 lg:justify-end">
                {/* Search Tool */}
                <div 
                  className="flex items-center gap-2 px-3 bg-white border-2 rounded-lg shadow-sm h-10 min-w-[260px] focus-within:ring-2 focus-within:ring-blue-100 transition-all group lg:min-w-[300px]"
                  style={{ borderColor: colors.secondary }}
                >
                  <Search size={16} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search Transaction ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="text-xs font-bold focus:outline-none flex-grow placeholder:text-gray-400 placeholder:font-normal bg-transparent"
                  />
                  <button
                    onClick={handleFindTransaction}
                    className="text-xs font-extrabold uppercase tracking-tighter hover:opacity-75 transition-opacity"
                    style={{ color: colors.primary }}
                  >
                    Find
                  </button>
                  {searchTerm && (
                    <button
                      onClick={handleResetSearch}
                      className="p-1 hover:bg-red-50 text-red-500 rounded-md transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
 
                {/* Export Options */}
                <div className="flex items-center gap-2 bg-white p-0.5 border-2 rounded-lg shadow-sm h-10" style={{ borderColor: colors.secondary }}>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="px-2 text-xs font-bold focus:outline-none bg-transparent cursor-pointer border-r border-gray-100 h-full"
                  >
                    <option value="csv">CSV</option>
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                    <option value="word">Word</option>
                  </select>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 text-white px-4 rounded-md text-xs font-bold h-full hover:brightness-110 active:scale-95 transition-all shadow-md group"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 mb-2">
          <div className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-100 to-gray-50">
                    <th className="px-4 py-3 text-left font-bold text-sm text-gray-800 border-2 border-gray-300">Total Loan Amount</th>
                    <th className="px-4 py-3 text-left font-bold text-sm text-gray-800 border-2 border-gray-300">Principal</th>
                    <th className="px-4 py-3 text-left font-bold text-sm text-gray-800 border-2 border-gray-300">Interest</th>
                    <th className="px-4 py-3 text-left font-bold text-sm text-gray-800 border-2 border-gray-300">Total Paid</th>
                    <th className="px-4 py-3 text-left font-bold text-sm text-gray-800 border-2 border-gray-300">Outstanding Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 border-2 border-gray-300 text-right font-bold text-base text-blue-700">
                      {formatAmount(statementSummary.totalLoanAmount)}
                    </td>
                    <td className="px-4 py-3 border-2 border-gray-300 text-right font-bold text-base text-green-700">
                      {formatAmount(statementSummary.principal)}
                    </td>
                    <td className="px-4 py-3 border-2 border-gray-300 text-right font-bold text-base text-amber-600">
                      {formatAmount(statementSummary.interest)}
                    </td>
                    <td className="px-4 py-3 border-2 border-gray-300 text-right font-bold text-base text-purple-700">
                      {formatAmount(statementSummary.totalPaid)}
                    </td>
                    <td className="px-4 py-3 border-2 border-gray-300 text-right font-bold text-base text-red-700">
                      {formatAmount(statementSummary.outstandingBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200">
          <div className="p-5">
            {loading ? (
              <p className="text-center text-gray-500 py-12 text-base font-medium">
                Loading transactions...
              </p>
            ) : filteredTransactions.length === 0 ? (
              <p className="text-center text-gray-500 py-12 text-base font-medium">
                No transactions found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-indigo-100 to-blue-50">
                      <th className="px-4 py-4 text-left font-bold text-base text-indigo-900 border-b-2 border-indigo-300">Date</th>
                      <th className="px-4 py-4 text-left font-bold text-base text-indigo-900 border-b-2 border-indigo-300">Description</th>
                      <th className="px-4 py-4 text-left font-bold text-base text-indigo-900 border-b-2 border-indigo-300">Reference</th>
                      <th className="px-4 py-4 text-left font-bold text-base text-indigo-900 border-b-2 border-indigo-300">Debit</th>
                      <th className="px-4 py-4 text-left font-bold text-base text-indigo-900 border-b-2 border-indigo-300">Credit</th>
                      <th className="px-4 py-4 text-left font-bold text-base text-indigo-900 border-b-2 border-indigo-300">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentData.map((t) => (
                      <tr
                        key={t.id}
                        className={`border-b border-gray-200 transition-colors ${t.isBalanceBF
                          ? "bg-gray-100 font-bold"
                          : "hover:bg-blue-50"
                          }`}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                          {new Date(t.date).toLocaleString("en-KE")}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{t.description}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{t.reference}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-red-600">
                          {t.debit !== 0 ? formatAmount(t.debit) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">
                          {t.credit > 0 ? formatAmount(t.credit) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                          {formatAmount(t.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Enhanced Pagination */}
            {filteredTransactions.length > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-3 pt-4 border-t border-gray-200">
                <div className="text-sm font-medium text-gray-700">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(
                    currentPage * itemsPerPage,
                    filteredTransactions.length
                  )}{" "}
                  of {filteredTransactions.length} entries
                </div>

                <div className="flex items-center gap-2">
                  {/* First Page */}
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-200 transition-all disabled:cursor-not-allowed shadow-sm"
                  >
                    <ChevronsLeft size={16} />
                  </button>

                  {/* Previous Page */}
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-200 transition-all disabled:cursor-not-allowed shadow-sm"
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>

                  {/* Page Numbers */}
                  <div className="flex gap-1 mx-2">
                    {generatePageNumbers().map((page, index) => (
                      <button
                        key={index}
                        onClick={() =>
                          typeof page === "number" && setCurrentPage(page)
                        }
                        disabled={page === "..."}
                        className={`px-3 py-2 rounded-lg min-w-[40px] text-sm font-semibold transition-all shadow-sm ${currentPage === page
                          ? "text-white shadow-md"
                          : page === "..."
                            ? "bg-transparent cursor-default shadow-none"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        style={currentPage === page ? { backgroundColor: colors.secondary } : {}}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  {/* Next Page */}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-200 transition-all disabled:cursor-not-allowed shadow-sm"
                  >
                    Next <ChevronRight size={16} />
                  </button>

                  {/* Last Page */}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-200 transition-all disabled:cursor-not-allowed shadow-sm"
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm font-medium text-gray-600">
            Generated by Jasiri Lending Software System • {reportTimestamp}
          </p>
        </div>
      </div>
 
      {/* Transaction Details Modal */}
      {isModalOpen && selectedTransaction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200">
            {/* Modal Header */}
            <div className={`p-6 text-white ${selectedTransaction.credit > 0 ? 'bg-gradient-to-r from-green-600 to-emerald-500' : 'bg-gradient-to-r from-blue-600 to-indigo-500'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold">Transaction Details</h3>
                  <p className="text-white/80 text-sm mt-1">Ref: {selectedTransaction.reference}</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <ArrowLeft className="rotate-90 sm:rotate-0" size={24} />
                </button>
              </div>
              <div className="mt-6 text-center">
                <div className="text-4xl font-extrabold tracking-tight">
                  {formatAmount(selectedTransaction.credit > 0 ? selectedTransaction.credit : selectedTransaction.debit)}
                </div>
                <div className="text-sm font-medium mt-1 text-white/90">
                  {selectedTransaction.credit > 0 ? 'Total Credit Received' : 'Total Applied / Deducted'}
                </div>
              </div>
            </div>
 
            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-500 text-sm font-medium">Type / Description</span>
                <span className="text-gray-900 font-bold text-sm">{selectedTransaction.description}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-500 text-sm font-medium">Date & Time</span>
                <span className="text-gray-900 font-semibold text-sm">
                  {new Date(selectedTransaction.date).toLocaleString("en-KE")}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-500 text-sm font-medium">Running Balance</span>
                <span className="text-gray-900 font-bold text-sm">{formatAmount(selectedTransaction.balance)}</span>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 mt-2">
                <div className="flex items-center gap-3 text-gray-600">
                  <div className={`p-2 rounded-lg ${selectedTransaction.credit > 0 ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                    <Globe size={18} />
                  </div>
                  <div className="text-xs font-medium leading-relaxed">
                    This is a reconciled financial record from the Jasiri Lending ledger.
                    The ID <strong>{selectedTransaction.reference}</strong> uniquely identifies this event.
                  </div>
                </div>
              </div>
            </div>
 
            {/* Modal Action */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold text-sm hover:bg-gray-900 transition-all shadow-md active:scale-95"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerStatementModal;