import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeftIcon,
  UserCircleIcon,
  BanknotesIcon,
  WalletIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  IdentificationIcon,
  BuildingLibraryIcon,
  CreditCardIcon,
  ChartBarIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  HomeIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../hooks/userAuth.js";
import { useTenantFeatures } from "../../hooks/useTenantFeatures";
import { usePermissions } from "../../hooks/usePermissions";
import RefundInitiatorModal from "../../components/RefundInitiatorModal";

// ========== SKELETON COMPONENTS =======
const SkeletonPulse = () => (
  <div className="animate-pulse bg-slate-200 rounded-md" />
);

const Skeleton360 = () => (
  <div className="p-6 h-screen flex flex-col bg-muted space-y-6">
    {/* Header Skeleton */}
    <div className="flex-shrink-0">
      <div className="w-48 h-10 bg-white/50 rounded-xl animate-pulse" />
    </div>

    {/* Tabs Skeleton */}
    <div className="bg-white rounded-t-xl p-1 flex gap-1 flex-shrink-0">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex-1 h-10 bg-slate-50 rounded-lg animate-pulse" />
      ))}
    </div>

    {/* Content Skeleton */}
    <div className="flex-1 bg-white/30 rounded-xl p-6 space-y-6 overflow-hidden">
      <div className="flex gap-6">
        <div className="w-24 h-24 rounded-full bg-white/50 animate-pulse" />
        <div className="flex-1 space-y-4 pt-2">
          <div className="w-1/3 h-6 bg-white/50 rounded animate-pulse" />
          <div className="w-1/4 h-4 bg-white/50 rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-24 bg-white/50 rounded-2xl animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="h-64 bg-white/50 rounded-xl animate-pulse" />
        <div className="h-64 bg-white/50 rounded-xl animate-pulse" />
      </div>
    </div>
  </div>
);

// ─── Pagination ──────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;

const PaginationBar = ({ currentPage, totalPages, onPageChange, totalItems }) => {
  if (totalPages <= 1) return null;
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, totalItems);
  return (
    <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
      <span className="text-xs text-gray-500">Showing {start}–{end} of {totalItems}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 text-xs font-semibold bg-brand-primary text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >← Prev</button>
        <span className="text-xs text-gray-500 font-medium">{currentPage} / {totalPages}</span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-xs font-semibold bg-brand-primary text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >Next →</button>
      </div>
    </div>
  );
};

// ─── Tenant SMS Config Cache ───────────────────────────────────────────────
const _smsConfigCache = new Map();

const SMSService = {
  async getConfig(tenantId) {
    if (!tenantId) throw new Error('tenantId is required to load SMS configuration');

    if (_smsConfigCache.has(tenantId)) {
      return _smsConfigCache.get(tenantId);
    }

    const { data, error } = await supabase
      .from('tenant_sms_settings')
      .select('base_url, api_key, partner_id, shortcode')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new Error(`SMS configuration not found for tenant: ${tenantId}`);
    }

    const config = {
      baseUrl: data.base_url.trim().replace(/\/+$/, ""),
      apiKey: data.api_key.trim(),
      partnerID: data.partner_id.trim(),
      defaultShortcode: data.shortcode.trim(),
    };

    _smsConfigCache.set(tenantId, config);
    return config;
  },

  clearConfigCache(tenantId = null) {
    if (tenantId) {
      _smsConfigCache.delete(tenantId);
    } else {
      _smsConfigCache.clear();
    }
  },

  formatPhoneNumberForSMS(phone) {
    if (!phone) return "";
    const cleaned = String(phone).replace(/\D/g, "");
    if (cleaned.startsWith("254") && cleaned.length === 12) return cleaned;
    if (cleaned.startsWith("0") && cleaned.length === 10) return "254" + cleaned.substring(1);
    if (cleaned.length === 9 && (cleaned.startsWith("7") || cleaned.startsWith("1"))) return "254" + cleaned;
    return cleaned;
  },

  async sendSMS(phoneNumber, message, tenantId, shortcode = null) {
    let formattedPhone = '';
    try {
      if (!tenantId) throw new Error('tenantId is required to send SMS');

      const config = await this.getConfig(tenantId);
      const effectiveShortcode = shortcode || config.defaultShortcode;

      formattedPhone = this.formatPhoneNumberForSMS(phoneNumber);
      if (!formattedPhone) throw new Error(`Invalid phone number format: ${phoneNumber}`);
      if (!message?.trim()) throw new Error('Message cannot be empty');

      const encodedMessage = encodeURIComponent(message.trim());
      // IMPORTANT: Celcom Africa requires the trailing slash before query parameters
      const endpoint = `${config.baseUrl}/?apikey=${config.apiKey}&partnerID=${config.partnerID}&message=${encodedMessage}&shortcode=${effectiveShortcode}&mobile=${formattedPhone}`;

      await fetch(endpoint, { method: 'GET', mode: 'no-cors' });

      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return { success: true, messageId, recipient: formattedPhone };

    } catch (error) {
      console.error(`[SMSService] ❌ Failed to send SMS:`, error.message);
      return { success: false, error: error.message, originalNumber: phoneNumber };
    }
  },

  async logSMS({ recipientPhone, message, status, senderId, errorMessage, messageId, cost, customerId, tenantId }) {
    try {
      const { error } = await supabase.from('sms_logs').insert({
        recipient_phone: recipientPhone,
        message,
        status,
        sender_id: senderId || null,
        error_message: errorMessage || null,
        message_id: messageId || null,
        customer_id: customerId || null,
        cost: cost ?? null,
        tenant_id: tenantId || null,
      });
      if (error) console.error('[SMSService] Failed to log SMS:', error);
    } catch (err) {
      console.error('[SMSService] Error logging SMS:', err);
    }
  },
};

const Customer360View = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [allLoans, setAllLoans] = useState([]);
  const [loanDetails, setLoanDetails] = useState(null);
  const [loanInstallments, setLoanInstallments] = useState([]);
  const [loanPayments, setLoanPayments] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [mpesaTransactions, setMpesaTransactions] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [smsLogs, setSmsLogs] = useState([]);
  const [sendingSms, setSendingSms] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [smsStatus, setSmsStatus] = useState("");
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [newInteraction, setNewInteraction] = useState({
    interaction_type: "",
    subject: "",
    notes: "",
  });
  const [savingInteraction, setSavingInteraction] = useState(false);
  const { profile } = useAuth();
  const { hasPermission } = usePermissions();
  const { imageUploadEnabled } = useTenantFeatures();
  
  // Refund states
  const [showRefundModal, setShowRefundModal] = useState(false);

  // SMS compose form toggle
  const [showSmsForm, setShowSmsForm] = useState(false);

  // Pagination states (50 items per page)
  const [repayPage, setRepayPage] = useState(1);
  const [walletPage, setWalletPage] = useState(1);
  const [mpesaPage, setMpesaPage] = useState(1);
  const [interactionPage, setInteractionPage] = useState(1);
  const [ptpPage, setPtpPage] = useState(1);

  // Promised to Pay states
  const [ptps, setPtps] = useState([]);
  const [paymentStats, setPaymentStats] = useState(null);
  const [showPTPForm, setShowPTPForm] = useState(false);
  const [savingPTP, setSavingPTP] = useState(false);
  const [ptpFormData, setPtpFormData] = useState({
    promised_amount: "",
    promised_date: "",
    remarks: "",
    interaction_type: "",
  });

  useEffect(() => {
    if (customerId) {
      fetchCustomerData();
    }
  }, [customerId]);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      // Fetch customer details
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select(
          `
          *,
          branches (name)
        `
        )
        .eq("id", customerId)
        .single();

      if (customerError) {
        console.error("Error fetching customer:", customerError);
        return;
      }

      setCustomer(customerData);

      // Fetch ALL loan details with all relationships, ordered chronologically
      const { data: allLoansFetched } = await supabase
        .from("loans")
        .select(`
          *,
          branches (name),
          regions (name)
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: true });

      const loansArray = allLoansFetched || [];
      setAllLoans(loansArray);

      // Legacy fallback for currently active or most recent loan
      const currentLoan = loansArray.find(l => l.status === "disbursed" && l.repayment_state !== "completed") || loansArray[loansArray.length - 1];
      setLoanDetails(currentLoan || null);

      const loanIds = loansArray.map(l => l.id);
      let allInstallments = [];
      let allLoanPayments = [];

      if (loanIds.length > 0) {
        // Fetch ALL loan installments
        const { data: installments } = await supabase
          .from("loan_installments")
          .select("*")
          .in("loan_id", loanIds)
          .order("installment_number", { ascending: true });

        allInstallments = installments || [];
        setLoanInstallments(allInstallments);

        // Fetch ALL loan payments
        const { data: payments } = await supabase
          .from("loan_payments")
          .select("*")
          .in("loan_id", loanIds)
          .order("paid_at", { ascending: false });

        allLoanPayments = payments || [];
        setLoanPayments(allLoanPayments);
      } else {
        setLoanInstallments([]);
        setLoanPayments([]);
      }

      // Fetch wallet transactions and calculate balance
      const { data: walletTxns } = await supabase
        .from("customer_wallets")
        .select("created_at, credit, debit, transaction_type, mpesa_reference, narration, description, amount, type")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      let cleanedTxns = (walletTxns || []).map((txn) => ({ ...txn }));
      let lastMpesa = null;

      for (let i = cleanedTxns.length - 1; i >= 0; i--) {
        if (
          cleanedTxns[i].transaction_type === "credit" &&
          cleanedTxns[i].mpesa_reference
        ) {
          lastMpesa = cleanedTxns[i].mpesa_reference;
        }

        if (
          cleanedTxns[i].transaction_type !== "credit" &&
          !cleanedTxns[i].mpesa_reference &&
          lastMpesa
        ) {
          cleanedTxns[i].mpesa_reference = lastMpesa;
        }
      }

      setWalletTransactions(cleanedTxns);

      // Calculate wallet balance: balance = sum(credit) - sum(debit)
      const balance = (walletTxns || []).reduce((acc, txn) => {
        return acc + (parseFloat(txn.credit || 0) - parseFloat(txn.debit || 0));
      }, 0);

      setWalletBalance(balance);

      // Fetch M-Pesa C2B transactions mapped to this customer or matching phone number
      const mobileNumbers = [customerData.mobile, customerData.alternative_mobile].filter(Boolean);
      const { data: mpesaC2B } = await supabase
        .from("mpesa_c2b_transactions")
        .select("*")
        .or(`customer_id.eq.${customerId}${mobileNumbers.length > 0 ? `,phone_number.in.(${mobileNumbers.join(",")})` : ''}`)
        .order("transaction_time", { ascending: false });

      // Consolidate M-Pesa transactions from all sources
      const unifiedMpesa = [];
      const seenRefs = new Set();

      // 1. Start with C2B as the primary source
      (mpesaC2B || []).forEach(tx => {
        if (!tx.transaction_id) return;
        seenRefs.add(tx.transaction_id);
        unifiedMpesa.push({
          id: `c2b-${tx.id}`,
          transaction_id: tx.transaction_id,
          amount: tx.amount,
          transaction_time: tx.transaction_time || tx.created_at,
          description: tx.description || "M-Pesa Payment",
          status: tx.status,
          source: 'c2b'
        });
      });

      // 2. Add from Loan Payments (in case not in C2B or for clarity)
      allLoanPayments.forEach(lp => {
        if (!lp.mpesa_receipt || seenRefs.has(lp.mpesa_receipt)) return;
        seenRefs.add(lp.mpesa_receipt);
        unifiedMpesa.push({
          id: `lp-${lp.id}`,
          transaction_id: lp.mpesa_receipt,
          amount: lp.paid_amount,
          transaction_time: lp.paid_at || lp.created_at,
          description: lp.description || "Loan Repayment",
          status: 'applied',
          source: 'loan_payment'
        });
      });

      // 3. Add from Wallet history
      (walletTxns || []).forEach(w => {
        if (!w.mpesa_reference || seenRefs.has(w.mpesa_reference)) return;
        seenRefs.add(w.mpesa_reference);
        unifiedMpesa.push({
          id: `w-${w.id}`,
          transaction_id: w.mpesa_reference,
          amount: w.amount,
          transaction_time: w.created_at,
          description: w.narration || w.description || "Wallet Deposit",
          status: 'applied',
          source: 'wallet'
        });
      });

      // Sort unified list newest first
      unifiedMpesa.sort((a, b) => new Date(b.transaction_time) - new Date(a.transaction_time));
      setMpesaTransactions(unifiedMpesa);

      // Fetch interactions
      const { data: interactions } = await supabase
        .from("customer_interactions")
        .select("*")
        .eq("customer_id", customerId)
        .order("interaction_date", { ascending: false })
        .limit(10);

      // Fetch officer names
      const createdByIds = interactions
        .map((i) => i.created_by)
        .filter(Boolean);
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", createdByIds);

      // Merge
      const interactionsWithOfficer = interactions.map((i) => ({
        ...i,
        officer_name:
          users.find((u) => u.id === i.created_by)?.full_name || null,
      }));

      setInteractions(interactionsWithOfficer);

      // Fetch SMS logs with sender info
      const { data: smsData } = await supabase
        .from("sms_logs")
        .select(`
          *,
          users!sent_by (
            full_name
          )
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      setSmsLogs(smsData || []);

      // Fetch Promised to Pay data if loans exist
      if (loanIds.length > 0) {
        await fetchPTPs(loanIds);
      }
      // Calculate global PaymentStats
      await calculatePaymentStats(loansArray, allInstallments);
    } catch (error) {
      console.error("Error fetching customer data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Promised to Pay records
  const fetchPTPs = async (loanIdsArray) => {
    try {
      const { data, error } = await supabase
        .from("promise_to_pay")
        .select(`
          id,
          interaction_type,
          promised_amount,
          promised_date,
          remarks,
          status,
          created_at,
          loan_id,
          created_by,
          users:promise_to_pay_created_by_fkey (
            id,
            full_name,
            email
          )
        `)
        .eq('customer_id', customerId)
        .in('loan_id', loanIdsArray)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPtps(data || []);
    } catch (err) {
      console.error("Error fetching PTPs:", err);
    }
  };

  // Calculate payment statistics
  const calculatePaymentStats = async (loansArray, allInstallments) => {
    try {
      const totalPaid = allInstallments.reduce(
        (sum, inst) => sum + (parseFloat(inst.paid_amount) || 0),
        0
      );

      const totalPrincipalPaid = allInstallments.reduce(
        (sum, inst) => sum + (parseFloat(inst.principal_paid) || 0),
        0
      );

      const totalInterestPaid = allInstallments.reduce(
        (sum, inst) => sum + (parseFloat(inst.interest_paid) || 0),
        0
      );
      
      const totalDue = loansArray.reduce((sum, loan) => sum + (parseFloat(loan.total_payable) || 0), 0);
      const outstandingBalance = totalDue - totalPaid;

      setPaymentStats({
        totalPaid,
        totalPrincipalPaid,
        totalInterestPaid,
        outstandingBalance,
        totalDue
      });
    } catch (err) {
      console.error("Error calculating payment stats:", err);
    }
  };

  // Create new Promise to Pay
  const handleCreatePTP = async (e) => {
    e.preventDefault();

    if (!ptpFormData.promised_amount || !ptpFormData.promised_date || !ptpFormData.interaction_type) {
      alert("Please fill in all required fields");
      return;
    }

    if (!loanDetails?.id) {
      alert("No active loan found");
      return;
    }

    if (!profile?.id) {
      alert("User not authenticated");
      return;
    }

    try {
      setSavingPTP(true);

      const { error } = await supabase
        .from("promise_to_pay")
        .insert([
          {
            customer_id: parseInt(customerId),
            loan_id: parseInt(loanDetails.id),
            installment_id: null,
            promised_amount: parseFloat(ptpFormData.promised_amount),
            promised_date: ptpFormData.promised_date,
            remarks: ptpFormData.remarks,
            created_by: profile.id,
            status: "pending",
            interaction_type: ptpFormData.interaction_type,
            tenant_id: profile?.tenant_id,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      alert("Promise to Pay recorded successfully!");
      setShowPTPForm(false);

      // Reset form
      setPtpFormData({
        promised_amount: "",
        promised_date: "",
        remarks: "",
        interaction_type: "",
      });

      // Refresh data
      if (allLoans.length > 0) {
        const loanIds = allLoans.map(l => l.id);
        fetchPTPs(loanIds);
      }
    } catch (err) {
      console.error("Error creating PTP:", err);
      alert("Failed to create Promise to Pay");
    } finally {
      setSavingPTP(false);
    }
  };

  // Update PTP status
  const updatePTPStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from("promise_to_pay")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;

      alert(`Promise marked as ${newStatus}`);
      if (allLoans.length > 0) {
        const loanIds = allLoans.map(l => l.id);
        fetchPTPs(loanIds);
      }
    } catch (err) {
      console.error("Error updating PTP status:", err);
      alert("Failed to update status");
    }
  };

  const tabs = [
    { id: "overview", name: "Overview" },
    { id: "loan", name: "Loan" },
    { id: "repayments", name: "Repayment" },
    { id: "wallet", name: "Wallet" },
    { id: "statements", name: "Mpesa-Trans" },
    { id: "interactions", name: "Interaction" },
    { id: "sms", name: "SMS" },
    { id: "promised", name: "PTP" },
  ];

  const getInitials = () => {
    const first = customer?.Firstname?.[0] || "";
    const last = customer?.Surname?.[0] || "";
    return `${first}${last}`.toUpperCase();
  };

  const formatCurrency = (amount) => {
    return `KES ${parseFloat(amount || 0).toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handleBack = () => {
    navigate(-1);
  };

  const getStatusBadge = (status) => {
    const base = "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border";
    switch (status) {
      case "pending":
        return <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>Pending</span>;
      case "kept":
        return <span className={`${base} bg-accent/10 text-accent border-accent/20`}>Kept</span>;
      case "broken":
        return <span className={`${base} bg-red-50 text-red-700 border-red-200`}>Broken</span>;
      default:
        return <span className={`${base} bg-gray-50 text-gray-700 border-gray-200`}>Unknown</span>;
    }
  };

  // Optimized renderOverview with reduced scrolling
  const renderOverview = () => {

    return (
      <div className="space-y-6 pr-2">
        {/* Compact Customer Profile Card */}
        <div className="relative bg-white backdrop-blur-sm border border-white/20 rounded-sm shadow-sm overflow-hidden">
          {/* Decorative SVG pattern background */}
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.045] pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <pattern id="money-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                {/* Wavy line */}
                <path d="M0 40 Q10 30 20 40 Q30 50 40 40 Q50 30 60 40 Q70 50 80 40" stroke="#1e3a5f" strokeWidth="1.2" fill="none" />
                <path d="M0 60 Q10 50 20 60 Q30 70 40 60 Q50 50 60 60 Q70 70 80 60" stroke="#1e3a5f" strokeWidth="1.2" fill="none" />
                <path d="M0 20 Q10 10 20 20 Q30 30 40 20 Q50 10 60 20 Q70 30 80 20" stroke="#1e3a5f" strokeWidth="1.2" fill="none" />
                {/* Dollar sign */}
                <text x="6" y="18" fontFamily="serif" fontSize="11" fill="#1e3a5f">$</text>
                {/* Percent */}
                <text x="46" y="38" fontFamily="serif" fontSize="10" fill="#1e3a5f">%</text>
                {/* KES symbol */}
                <text x="26" y="58" fontFamily="serif" fontSize="9" fill="#1e3a5f">₭</text>
                {/* Coin circle */}
                <circle cx="68" cy="14" r="5" stroke="#1e3a5f" strokeWidth="1" fill="none" />
                <text x="65" y="18" fontFamily="serif" fontSize="7" fill="#1e3a5f">¢</text>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#money-pattern)" />
          </svg>

          <div className="relative p-6">
            <div className="flex items-start gap-6">
              {/* Left: Passport Photo and Basic Info */}
              <div className="flex-shrink-0 w-full md:w-56">
                <div className="flex flex-col items-center">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-brand-primary/20 rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    {customer.passport_url && imageUploadEnabled ? (
                      <img
                        src={customer.passport_url}
                        alt={`${customer.Firstname} ${customer.Surname}`}
                        className="relative w-28 h-28 rounded-full object-cover border-4 border-white shadow-xl transform group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-brand-primary/80 to-brand-secondary/80 backdrop-blur-sm flex items-center justify-center text-4xl font-black text-white border-4 border-white shadow-xl transform group-hover:scale-105 transition-transform duration-300">
                        {getInitials()}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 w-full bg-muted/50 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-white">
                    <h2 className="  text-slate-600 text-sm text-center ">
                      {customer.prefix} {customer.Firstname} {customer.Surname}
                    </h2>

                    <div className="mt-3 space-y-2 text-center">
                      <div className="flex items-center justify-center gap-2 bg-slate-100/80 hover:bg-slate-100 py-1.5 px-3 rounded-xl transition-colors">
                        <PhoneIcon className="h-4 w-4 text-brand-primary" />
                        <span className="text-xs font-semibold text-slate-600">{customer.mobile}</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 bg-slate-100/80 hover:bg-slate-100 py-1.5 px-3 rounded-xl transition-colors">
                        <IdentificationIcon className="h-4 w-4 text-brand-primary" />
                        <span className="text-xs font-semibold text-slate-600">ID: {customer.id_number}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1 justify-center border-t border-slate-100 pt-3">
                      <span
                        className={`inline-flex px-3 py-1.5 text-[8px] font-black  rounded-xl border shadow-sm ${customer.status === "approved"
                          ? "bg-accent/10 text-green-600 border-accent/20"
                          : customer.status === "bm_review"
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                            : customer.status === "rejected"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-gray-50 text-gray-700 border-gray-200"
                          }`}
                      >
                        {customer.status || "Pending"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Financial Details - More Compact */}
              <div className="flex-1">
                {/* Global Wallet Info */}
                <div className="mb-4 bg-transparent border-slate-200 border rounded-2xl p-4 text-center shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-transparent p-2 rounded-full">
                      <WalletIcon className="h-3 w-3 text-slate-600" />
                    </div>
                    <span className="text-sm  text-slate-600 ">Wallet Balance</span>
                  </div>
                  <span className="text-lg font-semibold text-green-600">{formatCurrency(walletBalance || 0)}</span>
                </div>

                {allLoans?.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 border rounded-2xl text-gray-500">
                    No loan history found.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {allLoans.map((loan, index) => {
                      const insts = loanInstallments.filter(i => i.loan_id === loan.id);
                      const paid = insts.reduce((sum, i) => sum + parseFloat(i.paid_amount || 0), 0);
                      const outstanding = parseFloat(loan.total_payable || 0) - paid;
                      
                      return (
                        <div key={loan.id} className="bg-white/60 border rounded-2xl p-4">
                          <div className="flex justify-between items-center mb-3 border-b pb-2">
                            <div className="text-xs  text-600">
                              Loan {index + 1}
                              <span className={`ml-2 inline-flex px-2 py-0.5 text-xs rounded-full border ${
                                loan.repayment_state === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 
                                loan.status === 'disbursed' ? 'bg-accent/10 text-accent border-accent/20' :
                                'bg-gray-50 text-gray-600 border-gray-200'
                              }`}>
                                {loan.repayment_state === 'completed' ? 'Completed' : loan.status}
                              </span>
                            </div>
                            <span className="text-xs   text-gray-600">
                              {new Date(loan.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                            {[
                              { label: "Principal", value: loan.scored_amount, icon: CreditCardIcon, color: "bg-transparent border-indigo-100 text-indigo-600" },
                              { label: "Interest", value: loan.total_interest, icon: ChartBarIcon, color: "bg-transparent border-amber-100 text-amber-600" },
                              { label: "Payable", value: loan.total_payable, icon: DocumentTextIcon, color: "bg-transparent border-emerald-100 text-emerald-600" },
                              { label: "Paid", value: paid, icon: CheckCircleIcon, color: "bg-transparent border-green-100 text-green-600" },
                              { label: "Bal", value: outstanding, icon: ExclamationCircleIcon, color: "bg-transparent border-rose-100 text-rose-600" },
                            ].map((item, idx) => (
                              <div key={idx} className={`${item.color} border rounded-xl p-2 text-center shadow-sm`}>
                                <p className="text-[10px]  mb-1 opacity-70 truncate">{item.label}</p>
                                <p className="text-sm font-semibold truncate">{formatCurrency(item.value || 0).replace('KES ', '')}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Branch info below financial cards */}
                <div className="mt-4 bg-brand-surface/50 rounded-lg p-3 border border-brand-surface">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BuildingLibraryIcon className="h-4 w-4 text-brand-secondary" />
                      <span className="text-xs  text-brand-primary">
                        branch.{customer.branches?.name || "No branch assigned"}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">
                      Customer since:{" "}
                      {customer.created_at
                        ? new Date(customer.created_at).toLocaleDateString()
                        : "N/A"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Information Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Information - More Compact */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-semibold text-slate-600 mb-3 flex items-center">
              <IdentificationIcon className="h-4 w-4 mr-2 text-brand-primary" />
              Personal Information
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Mobile</p>
                <p className="text-xs font-medium text-slate-600">
                  {customer.mobile || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Alt Mobile</p>
                <p className="text-xs font-medium text-slate-600">
                  {customer.alternative_mobile || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Gender</p>
                <p className="text-xs font-medium text-slate-600">
                  {customer.gender || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Marital Status</p>
                <p className="text-xs font-medium text-slate-600">
                  {customer.marital_status || "N/A"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-1">Occupation</p>
                <p className="text-xs font-medium text-slate-600">
                  {customer.occupation || "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Address Information - More Compact */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className=" font-semibold text-slate-600 text-sm mb-3 flex items-center">
              <MapPinIcon className="h-4 w-4 mr-2 text-brand-primary" />
              Address & Location
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">County</p>
                <p className="text-xs font-medium text-slate-700">
                  {customer.county || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Town</p>
                <p className="text-xs font-medium text-slate-700">
                  {customer.town || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Residence Status</p>
                <p className="text-xs font-medium text-slate-700">
                  {customer.residence_status || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Road</p>
                <p className="text-xs font-medium text-slate-700">
                  {customer.road || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Business Information - Conditional and Compact */}
        {customer.business_name && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-slate-600 mb-3 flex items-center">
              <BriefcaseIcon className="h-4 w-4 mr-2 text-brand-primary" />
              Business Information
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Business Name</p>
                <p className="text-xs font-medium text-slate-700">
                  {customer.business_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Business Type</p>
                <p className="text-xs font-medium text-slate-700">
                  {customer.business_type || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Location</p>
                <p className="text-xs font-medium text-slate-700">
                  {customer.business_location || "N/A"}
                </p>
              </div>
              {customer.daily_Sales && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Daily Sales</p>
                  <p className="text-xs font-medium text-slate-700">
                    {formatCurrency(customer.daily_Sales)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLoanDetails = () => (
    <div className="space-y-6">
      {allLoans && allLoans.length > 0 ? (
        allLoans.map((loan, index) => {
          const installments = loanInstallments.filter(i => i.loan_id === loan.id);
          return (
            <div key={loan.id} className="bg-white/40 border border-gray-200 rounded-2xl p-6 shadow-sm mb-6">
              <h3 className="text-xs text-slate-600  mb-4">Loan {index + 1} - {loan.product_name || loan.product}</h3>
              <div className="bg-brand-primary rounded-lg p-6 text-slate-600 mb-6">
                <div className="text-xs text-white mb-2">Facility Details</div>
                <p className="text-xl font-semibold text-white ">
                  {formatCurrency(loan.scored_amount)}
                </p>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-white text-xs">Status</p>
                    <p className="font-semibold  text-sm text-white capitalize">{loan.status}</p>
                  </div>
                  <div>
                    <p className="text-white text-xs">Repayment State</p>
                    <p className="font-semibold text-sm text-white capitalize">
                      {loan.repayment_state || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-white text-xs">Duration</p>
                    <p className="font-semibold  text-sm text-white">
                      {loan.duration_weeks} weeks
                    </p>
                  </div>
                  <div>
                    <p className="text-white text-xs">Product Type</p>
                    <p className="font-semibold text-sm text-white capitalize">
                      {loan.product_type || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className=" text-slate-600 font-semibold text-xs mb-4">Financial Structure</div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Scored Amount</span>
                      <span className="font-medium text-sm text-slate-700">
                        {formatCurrency(loan.scored_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Interest Rate</span>
                      <span className="font-medium text-sm text-slate-700">
                        {loan.interest_rate || "0"}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Total Interest</span>
                      <span className="font-medium text-sm text-slate-700">
                        {formatCurrency(loan.total_interest)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Processing Fee</span>
                      <span className="font-medium text-sm text-slate-700">
                        {formatCurrency(loan.processing_fee)}
                      </span>
                    </div>
                    {index === 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">Registration Fee</span>
                        <span className="font-medium text-sm text-slate-700">
                          {formatCurrency(loan.registration_fee)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-slate-500 text-xs">Weekly Payment</span>
                      <span className="font-bold text-brand-primary text-sm">
                        {formatCurrency(loan.weekly_payment)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <div className=" text-slate-600 font-semibold text-sm  mb-4">Timeline</div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Booked At</span>
                      <span className="font-medium text-slate-700 text-sm">
                        {loan.booked_at ? new Date(loan.booked_at).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Approved By BM</span>
                      <span className="font-medium text-slate-700 text-sm">
                        {loan.bm_reviewed_at ? new Date(loan.bm_reviewed_at).toLocaleDateString() : "Pending"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Approved By RM</span>
                      <span className="font-medium text-slate-700 text-sm">
                        {loan.rm_reviewed_at ? new Date(loan.rm_reviewed_at).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Disbursed At</span>
                      <span className="font-medium text-slate-700 text-sm">
                        {loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Processing Fee Paid</span>
                      <span className={`font-medium text-sm  ${loan.processing_fee_paid ? "text-green-600" : "text-red-600"}`}>
                        {loan.processing_fee_paid ? "Yes" : "No"}
                      </span>
                    </div>
                    {index === 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">Registration Fee Paid</span>
                        <span className={`font-medium text-sm ${loan.registration_fee_paid ? "text-green-600" : "text-red-600"}`}>
                          {loan.registration_fee_paid ? "Yes" : "No"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

          {/* Loan Installments for this loan */}
          {installments.length > 0 && (
            <div className="space-y-6 pt-6 mt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Payment Roadmap for Loan {index + 1}</p>
                </div>
                <div className="flex gap-2">
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-tight border border-rose-100">
                    Overdue: {installments.filter(i => i.status === 'overdue').length}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600  whitespace-nowrap">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600  whitespace-nowrap">Due Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600  whitespace-nowrap">Amount Due</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600  whitespace-nowrap">Paid</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600  whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600  whitespace-nowrap">Alerts</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {installments.map((installment) => (
                      <tr
                        key={installment.id}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {installment.installment_number}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {new Date(installment.due_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {formatCurrency(installment.due_amount)}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                          <span className={parseFloat(installment.paid_amount) > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                            {formatCurrency(installment.paid_amount || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${installment.status === "paid"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                              : installment.status === "partial"
                                ? "bg-amber-50 text-amber-600 border-amber-100"
                                : installment.status === "overdue"
                                  ? "bg-rose-50 text-rose-600 border-rose-100"
                                  : "bg-slate-50 text-slate-500 border-slate-100"
                              }`}
                          >
                            {installment.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-600">
                          {installment.days_overdue > 0 ? (
                            <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-100">
                              {installment.days_overdue} Days Late
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>
          );
        })
      ) : (
        <div className="text-center py-12">
          <BanknotesIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No loan history for this customer</p>
        </div>
      )}
    </div>
  );

  const getLoanIndex = (loanId) => {
    if (!allLoans || allLoans.length === 0) return '?';
    const index = allLoans.findIndex(l => l.id === loanId);
    return index !== -1 ? index + 1 : '?';
  };

  const renderRepaymentHistory = () => {
    // Only show repayments for disbursed loans — you cannot repay what hasn't been disbursed
    const disbursedLoans = allLoans.filter(l => l.status === 'disbursed');
    const disbursedLoanIds = new Set(disbursedLoans.map(l => l.id));
    const disbursedPayments = loanPayments.filter(p => disbursedLoanIds.has(p.loan_id));

    // Compute stats only from disbursed loans and their installments
    const disbursedInstallments = loanInstallments.filter(i => disbursedLoanIds.has(i.loan_id));
    const disbursedTotalDue = disbursedLoans.reduce((sum, l) => sum + (parseFloat(l.total_payable) || 0), 0);
    const disbursedTotalPaid = disbursedInstallments.reduce((sum, i) => sum + (parseFloat(i.paid_amount) || 0), 0);
    const disbursedOLB = disbursedTotalDue - disbursedTotalPaid;

    return (
      <div className="space-y-6">
        {/* Summary Cards — disbursed loans only */}
        {disbursedLoans.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/40 backdrop-blur-sm border border-white/20 rounded-3xl p-6 shadow-sm group hover:bg-white/60 transition-all">
              <div className="flex items-center justify-between mb-4">
                <p className=" text-slate-600 text-sm ">Total Payable</p>
                <div className="w-8 h-8 rounded-lg  flex items-center justify-center">
                  <BanknotesIcon className="h-4 w-4 text-brand-primary" />
                </div>
              </div>
              <p className="text-lg font-semibold text-slate-600">
                {formatCurrency(disbursedTotalDue)}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-primary rounded-full" style={{ width: '100%' }} />
                </div>
                <span className="text-[8px] font-black text-brand-primary">100%</span>
              </div>
            </div>

            <div className="bg-emerald-50 backdrop-blur-sm border border-white/20 rounded-3xl p-6 shadow-sm group hover:bg-white/60 transition-all">
              <div className="flex items-center justify-between mb-4">
                <p className=" text-slate-600  text-sm"> Amount Cleared</p>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
              <p className="text-lg font-semibold text-emerald-600">
                {formatCurrency(disbursedTotalPaid)}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-1.5 bg-emerald-500 rounded-full "
                    style={{ width: `${Math.min(100, (disbursedTotalPaid / (disbursedTotalDue || 1)) * 100)}%` }}
                  />
                </div>
                <span className=" text-emerald-600 text-[8px]">
                  {((disbursedTotalPaid / (disbursedTotalDue || 1)) * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="bg-amber-50 backdrop-blur-sm border border-white/20 rounded-3xl p-6 shadow-sm group hover:bg-white/60 transition-all">
              <div className="flex items-center justify-between mb-4">
                <p className=" text-slate-600  text-sm"> O.L.B</p>
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                  <ExclamationCircleIcon className="h-4 w-4 text-rose-600" />
                </div>
              </div>
              <p className="text-lg font-semibold text-rose-600">
                {formatCurrency(disbursedOLB)}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-1.5 bg-rose-500 rounded-full"
                    style={{ width: `${Math.min(100, (disbursedOLB / (disbursedTotalDue || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-[8px] font-black text-rose-600">Pending</span>
              </div>
            </div>
          </div>
        )}

        {/* Payment History Table — only disbursed loans */}
        {disbursedPayments.length > 0 ? (
          <div className="bg-white/40 backdrop-blur-sm border border-white/20 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-white/20 flex items-center justify-between">
              <div>
                <h3 className="text-slate-600 text-sm">Payment Ledger</h3>
              </div>
             
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      Loan #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      Amount Paid
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      Payment Method
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      Payment Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      M-Pesa Receipt
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      Balance After
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {disbursedPayments.slice((repayPage - 1) * PAGE_SIZE, repayPage * PAGE_SIZE).map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs  text-brand-primary whitespace-nowrap">
                        Loan {getLoanIndex(payment.loan_id)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(payment.paid_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-green-600 whitespace-nowrap">
                        {formatCurrency(payment.paid_amount)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 capitalize whitespace-nowrap">
                        {payment.payment_method?.replace("_", " ") || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {payment.payment_type || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {payment.mpesa_receipt || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-600 whitespace-nowrap">
                        {formatCurrency(payment.balance_after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-6 py-3">
                <PaginationBar currentPage={repayPage} totalPages={Math.ceil(disbursedPayments.length / PAGE_SIZE)} onPageChange={setRepayPage} totalItems={disbursedPayments.length} />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
            <ClockIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No repayment history</p>
            <p className="text-sm text-gray-400 mt-1">Repayments only appear for disbursed loans</p>
          </div>
        )}
      </div>
    );
  };

  const renderWallet = () => (
    <div className="space-y-6">
      <div className="relative overflow-hidden bg-brand-primary rounded-sm p-8 text-white ">
        <div className="relative z-10">
          <p className="text-[8px]  text-emerald-50 mb-2">Verified Liquid Assets</p>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-lg font-semibold ">{formatCurrency(walletBalance)}</h1>
              <p className="text-xs text-emerald-50 mt-2 ">Available Wallet Balance</p>
            </div>
            <div className="p-4 bg-white/20 backdrop-blur-md rounded-xs border border-white flex flex-col items-center gap-2">
              <WalletIcon className="h-4 w-4 text-white" />
              {hasPermission("refund.initiate") && (
                <button
                  onClick={() => setShowRefundModal(true)}
                  className="px-4 py-2 bg-white text-emerald-600 rounded-sm text-[8px]  shadow-lg hover:bg-emerald-50 transition-colors"
                >
                  Refund
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Subtle decorative circle */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
      </div>

      {/* Wallet Transactions */}
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
              Narration
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
              MPESA Ref
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 whitespace-nowrap">
              Credit
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 whitespace-nowrap">
              Debit
            </th>
          </tr>
        </thead>

        <tbody className="bg-white divide-y divide-gray-200">
          {walletTransactions.slice((walletPage - 1) * PAGE_SIZE, walletPage * PAGE_SIZE).map((txn, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                {new Date(txn.created_at).toLocaleString()}
              </td>

              <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-600">
                <div className="max-w-xs overflow-hidden text-ellipsis text-xs whitespace-nowrap" title={txn.narration || txn.description}>
                  {txn.narration || txn.description || "—"}
                </div>
              </td>

              <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-600">
                <span
                  className={`inline-flex px-2 py-1 text-xs  rounded-full ${parseFloat(txn.credit || 0) > 0 || txn.type === "credit" || txn.transaction_type === "credit"
                    ? "text-green-600"
                    : " text-red-600"
                    }`}
                >
                  {txn.transaction_type || txn.type || "—"}
                </span>
              </td>

              <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                {txn.mpesa_reference || "—"}
              </td>

              <td className="px-4 py-3 text-xs font-medium text-right text-green-600  whitespace-nowrap">
                {parseFloat(txn.credit || 0) > 0 ? formatCurrency(txn.credit) : "—"}
              </td>

              <td className="px-4 py-3 text-xs  text-right text-red-600 whitespace-nowrap">
                {parseFloat(txn.debit || 0) > 0 ? formatCurrency(txn.debit) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <PaginationBar currentPage={walletPage} totalPages={Math.ceil(walletTransactions.length / PAGE_SIZE)} onPageChange={setWalletPage} totalItems={walletTransactions.length} />
    </div>
  );

  const renderStatements = () => (
    <div className="space-y-4">
      <div className="bg-brand-primary border border-slate-400 rounded-sm p-4">
        <h4 className="font-semibold text-sm text-white mb-2">
          M-Pesa C2B Transactions
        </h4>
        
      </div>

      {mpesaTransactions.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                    Transaction ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                    Narration
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mpesaTransactions.slice((mpesaPage - 1) * PAGE_SIZE, mpesaPage * PAGE_SIZE).map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-gray-600">
                      {txn.transaction_time
                        ? new Date(txn.transaction_time).toLocaleString()
                        : new Date(txn.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">
                      {txn.transaction_id || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-600 whitespace-nowrap">
                      {(txn.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 capitalize whitespace-nowrap">
                      {txn.description
                        ? txn.description.includes("Credited to wallet - no active loan")
                          ? "Credited to wallet"
                          : txn.description.includes("Loan repayment processed")
                            ? "Loan repayment"
                            : txn.description
                        : "N/A"}
                    </td>



                    <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-600">
                      <span
                        className={`inline-flex px-2 py-1 text-xs  rounded-sm ${txn.status === "applied"
                          ? "bg-green-100 text-green-800"
                          : txn.status === "pending"
                            ? " text-yellow-800"
                            : " text-red-800"
                          }`}
                      >
                        {txn.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2">
            <PaginationBar currentPage={mpesaPage} totalPages={Math.ceil(mpesaTransactions.length / PAGE_SIZE)} onPageChange={setMpesaPage} totalItems={mpesaTransactions.length} />
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <DocumentTextIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No M-Pesa transactions</p>
        </div>
      )}
    </div>
  );

  const renderInteractions = () => {
    const handleAddInteraction = async (e) => {
      e.preventDefault();

      if (!newInteraction.interaction_type || !newInteraction.notes.trim()) {
        alert("Please fill in all required fields");
        return;
      }

      try {
        setSavingInteraction(true);

        //  Use existing profile from useAuth
        if (!profile) {
          console.error("No profile found in auth hook");
          alert("Could not find logged in user profile.");
          return;
        }

        const { id: officerId, full_name: officerName } = profile;

        // Insert interaction
        const { data, error } = await supabase
          .from("customer_interactions")
          .insert([
            {
              customer_id: customerId,
              interaction_type: newInteraction.interaction_type,
              subject: newInteraction.subject || null,
              notes: newInteraction.notes,
              created_by: officerId,   // <-- FIXED: using profile.id
              interaction_date: new Date().toISOString(),
              tenant_id: profile?.tenant_id,
            },
          ])
          .select("*")
          .single();

        if (error) throw error;

        // Add interaction to state with officer name
        setInteractions((prev) => [
          { ...data, officer_name: officerName },
          ...prev,
        ]);

        // Reset form
        setNewInteraction({
          interaction_type: "",
          subject: "",
          notes: "",
        });

        setShowInteractionForm(false);
        alert("Interaction added successfully!");

      } catch (error) {
        console.error("Error saving interaction:", error);
        alert(`Failed to save interaction: ${error.message}`);
      } finally {
        setSavingInteraction(false);
      }
    };

    return (
      <div className="space-y-6">
        {/* Header with Add Button */}
        <div className="flex justify-between items-center">
          <div>

            <p className="text-xs font-semibold text-gray-600 mt-1">
              Track all customer communication and touchpoints
            </p>
          </div>
          <button
            onClick={() => setShowInteractionForm(!showInteractionForm)}
            className="flex items-center gap-1.5 px-2 py-1 bg-brand-primary text-white rounded-sm hover:bg-[#4a5c9d] transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm"
          >
            {showInteractionForm ? (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Interaction
              </>
            )}
          </button>
        </div>

        {/* Interaction Form */}
        {showInteractionForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h4 className="text-xs  text-slate-600 mb-4 flex items-center">
              <svg
                className="h-5 w-5 mr-2 text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              Record New Interaction
            </h4>
            <form onSubmit={handleAddInteraction} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Interaction Type */}
                <div>
                  <label className="text-xs  text-gray-600 mb-1">
                    Interaction Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newInteraction.interaction_type}
                    onChange={(e) =>
                      setNewInteraction({
                        ...newInteraction,
                        interaction_type: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-600 focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition text-sm"
                    required
                  >
                    <option value="">Select Type</option>
                    <option value="call">Phone Call</option>
                    <option value="email"> Email</option>
                    <option value="visit">Physical Visit</option>
                    <option value="meeting"> Meeting</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="other"> Other</option>
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className=" text-xs  text-gray-600 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={newInteraction.subject}
                    onChange={(e) =>
                      setNewInteraction({
                        ...newInteraction,
                        subject: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-600 focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition text-sm"
                    placeholder="Brief subject or title..."
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className=" text-xs  text-gray-600 mb-1">
                  Notes / Details <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newInteraction.notes}
                  onChange={(e) =>
                    setNewInteraction({
                      ...newInteraction,
                      notes: e.target.value,
                    })
                  }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-600 focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition text-sm"
                  rows="4"
                  placeholder="Enter detailed notes about this interaction..."
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  disabled={savingInteraction}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-[#4a5c9d] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md font-medium text-xs"
                >
                  {savingInteraction ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Save Interaction
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInteractionForm(false);
                    setNewInteraction({
                      interaction_type: "",
                      subject: "",
                      notes: "",
                    });
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Interactions List */}
        {interactions.length > 0 ? (
          <>
            <div className="space-y-3">
              {interactions.slice((interactionPage - 1) * PAGE_SIZE, interactionPage * PAGE_SIZE).map((interaction, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Header Section */}
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-3">
                      <span
                        className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${interaction.interaction_type === "call"
                          ? "bg-blue-100 text-blue-800"
                          : interaction.interaction_type === "sms"
                            ? "bg-green-100 text-green-800"
                            : interaction.interaction_type === "email"
                              ? "bg-purple-100 text-purple-800"
                              : interaction.interaction_type === "visit"
                                ? "bg-orange-100 text-orange-800"
                                : interaction.interaction_type === "meeting"
                                  ? "bg-[#586ab1] bg-opacity-10 text-[#586ab1]"
                                  : interaction.interaction_type === "follow_up"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : interaction.interaction_type === "complaint"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                          }`}
                      >
                        {interaction.interaction_type === "call" && "📞"}
                        {interaction.interaction_type === "email" && "📧"}
                        {interaction.interaction_type === "visit" && "🏢"}
                        {interaction.interaction_type === "meeting" && "👥"}
                        {interaction.interaction_type === "follow_up" && "🔄"}
                        {interaction.interaction_type === "complaint" && "⚠️"}
                        <span className="ml-1.5">
                          {interaction.interaction_type?.charAt(0).toUpperCase() +
                            interaction.interaction_type
                              ?.slice(1)
                              .replace("_", " ") || "Interaction"}
                        </span>
                      </span>
                      <div className="flex items-center text-xs text-gray-500">
                        <svg
                          className="h-3.5 w-3.5 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {new Date(
                          interaction.interaction_date
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        at{" "}
                        {new Date(
                          interaction.interaction_date
                        ).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content Section */}
                <div className="px-5 py-4">
                  {/* Subject */}
                  {interaction.subject && (
                    <div className="mb-3">
                      <label className="text-xs  text-gray-500  mb-1 block">
                        Subject
                      </label>
                      <h4 className="text-sm text-gray-600">
                        {interaction.subject}
                      </h4>
                    </div>
                  )}

                  {/* Message/Notes */}
                  <div className="mb-4">
                    <label className="text-xs  text-gray-500  mb-1 block">
                      {interaction.subject ? "Details" : "Notes"}
                    </label>
                    <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-md p-3 border border-gray-100">
                      {interaction.notes || "No notes provided"}
                    </div>
                  </div>

                  {/* Footer with Officer Info */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    {interaction.officer_name ? (
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-[#586ab1] bg-opacity-10">
                          <svg
                            className="h-4 w-4 text-[#586ab1]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Handled by</p>
                          <p className="text-sm font-medium text-gray-900">
                            {interaction.officer_name}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center">
                          <svg
                            className="h-4 w-4 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-400">
                          Officer not specified
                        </p>
                      </div>
                    )}

                    {/* Optional: Add outcome badge if available */}
                    {interaction.outcome && (
                      <span
                        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${interaction.outcome === "positive"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : interaction.outcome === "negative"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-gray-50 text-gray-700 border border-gray-200"
                          }`}
                      >
                        {interaction.outcome}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <PaginationBar currentPage={interactionPage} totalPages={Math.ceil(interactions.length / PAGE_SIZE)} onPageChange={setInteractionPage} totalItems={interactions.length} />
          </>
        ) : (
          <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-xl">
            <svg
              className="h-16 w-16 text-gray-300 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <p className="text-gray-600 font-medium">
              No interactions recorded
            </p>
            <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
              Click "Add Interaction" to record your first customer interaction
            </p>
          </div>
        )}
      </div>
    );
  };



  const renderSmsTab = () => {

    const loadSmsLogs = async () => {
      console.log("=== LOADING SMS LOGS ===");

      const { data, error } = await supabase
        .from("sms_logs")
        .select(`
        id,
        message,
        status,
        created_at,
        error_message,
        sent_by,
        users!sent_by (
        id,
        full_name,
        email
        )
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading SMS logs:", error);
        setSmsLogs([]);
        return;
      }

      console.log("Loaded SMS logs:", data?.length || 0);

      // Debug each log
      data?.forEach((sms, index) => {
        console.log(`Log ${index + 1}:`, {
          id: sms.id,
          sent_by: sms.sent_by,
          user_data: sms.users
        });
      });

      setSmsLogs(data || []);
    };

    // Call on mount
    // React.useEffect(() => {
    //   loadSmsLogs();
    // }, [customerId]);

    const handleSendSms = async () => {
      if (!smsMessage.trim() || !customer?.mobile) {
        alert("Please enter a message and ensure customer has a mobile number");
        return;
      }

      if (!profile?.id) {
        setSmsStatus("Failed: You must be logged in to send SMS");
        return;
      }

      if (!profile?.tenant_id) {
        setSmsStatus("Failed: No tenant associated with your account");
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase
        .from("sms_logs")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", customerId)
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      if ((count ?? 0) >= 2) {
        alert("Daily SMS limit reached: You can only send 2 SMS messages per customer per day.");
        return;
      }

      setSendingSms(true);
      setSmsStatus("Sending...");

      try {
        //  Pass tenantId — no hardcoded config
        const result = await SMSService.sendSMS(
          customer.mobile,
          smsMessage,
          profile.tenant_id  // tenant aware
        );

        const insertData = {
          customer_id: customerId,
          recipient_phone: customer.mobile,
          message: smsMessage,
          status: result.success ? "sent" : "failed",
          message_id: result.messageId ?? null,
          error_message: result.success ? null : (result.error || "Unknown error"),
          sent_by: profile.id,
          tenant_id: profile.tenant_id,  //  tenant-aware
        };

        const { data: insertedData, error: insertError } = await supabase
          .from("sms_logs")
          .insert(insertData)
          .select(`
        id, message, status, created_at, error_message, sent_by,
        users!sent_by ( id, full_name, email )
        `)
          .single();

        if (insertError) throw insertError;

        setSmsLogs((prev) => [insertedData, ...prev]);
        setSmsMessage("");
        setSmsStatus(result.success ? "Message sent successfully!" : `Failed: ${result.error}`);
        setTimeout(() => setSmsStatus(""), 5000);

      } catch (error) {
        console.error(" SMS send error:", error);
        setSmsStatus("Failed to send message");
      } finally {
        setSendingSms(false);
      }
    };

    // Debug function to check for data issues
    const checkOrphanedLogs = async () => {

      // Get all SMS logs for this customer
      const { data: allLogs, error } = await supabase
        .from("sms_logs")
        .select("id, sent_by, created_at")
        .eq("customer_id", customerId);

      if (error) {
        console.error("Error fetching logs:", error);
        return;
      }


      // Check for NULL sent_by (should not exist)
      const logsWithNullSentBy = allLogs?.filter(log => !log.sent_by) || [];
      console.log(" Logs with NULL sent_by:", logsWithNullSentBy.length);

      if (logsWithNullSentBy.length > 0) {
        console.log("These logs have NULL sent_by (BAD - should not happen):");
        logsWithNullSentBy.forEach(log => {
          console.log(`  - SMS ID ${log.id} created at ${log.created_at}`);
        });
      }

      // Verify all sent_by UUIDs exist in users table
      const sentByIds = allLogs
        ?.filter(log => log.sent_by)
        .map(log => log.sent_by) || [];

      if (sentByIds.length > 0) {
        const uniqueIds = [...new Set(sentByIds)];
        console.log("\nUnique user IDs in SMS logs:", uniqueIds);

        const { data: existingUsers, error: userError } = await supabase
          .from("users")
          .select("id, full_name, email")
          .in("id", uniqueIds);

        if (userError) {
          console.error(" Error fetching users:", userError);
          console.error("This could be an RLS (Row Level Security) policy issue!");
          return;
        }

        console.log(" Users found in database:", existingUsers);

        const existingUserIds = existingUsers?.map(u => u.id) || [];
        const missingUserIds = uniqueIds.filter(id => !existingUserIds.includes(id));

        if (missingUserIds.length > 0) {
          console.error(" These user IDs in SMS logs don't exist in users table:", missingUserIds);
        } else {
          console.log(" All user IDs exist in users table");
        }
      }
    };

    return (
      <div className="space-y-6">

        {/* Header with Send Button — matches interactions pattern */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold text-gray-600 mt-1">
              Track all SMS messages sent to this customer
            </p>
          </div>
          {profile?.role !== "relationship_officer" && (
            <button
              onClick={() => setShowSmsForm(!showSmsForm)}
              className="flex items-center gap-1.5 px-2 py-1 bg-brand-primary text-white rounded-sm hover:bg-[#4a5c9d] transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm"
            >
              {showSmsForm ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Send SMS
                </>
              )}
            </button>
          )}
        </div>

        {/* Compose form — shown only when showSmsForm is true */}
        {showSmsForm && profile?.role !== "relationship_officer" && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                  <ChatBubbleLeftRightIcon className="h-3.5 w-3.5 mr-1.5" />
                  New Message
                </span>
                <div className="flex items-center text-xs text-gray-500">
                  <PhoneIcon className="h-3.5 w-3.5 mr-1" />
                  {customer?.Firstname && customer?.mobile
                    ? `${customer.Firstname} — ${customer.mobile}`
                    : customer?.mobile || "No mobile number"}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Message textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs font-normal text-gray-400">(max 160 chars · 2 per customer/day)</span>
                </label>
                <textarea
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-1 focus:ring-[#586ab1] focus:border-[#586ab1] resize-none transition text-sm"
                  rows="4"
                  maxLength={160}
                  placeholder="Type your message here..."
                  required
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-400">{smsMessage.length}/160 characters</span>
                  {profile && (
                    <span className="text-xs text-gray-400">
                      Sending as: <span className="font-medium text-slate-600">{profile.full_name}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Status feedback */}
              {smsStatus && (
                <div className={`p-3 text-sm rounded-lg flex items-center ${
                  smsStatus.includes("successfully")
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}>
                  {smsStatus.includes("successfully")
                    ? <CheckCircleIcon className="h-4 w-4 mr-2" />
                    : <ExclamationCircleIcon className="h-4 w-4 mr-2" />}
                  {smsStatus}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-3">
                <button
                  onClick={handleSendSms}
                  disabled={sendingSms || !smsMessage.trim() || !profile?.id}
                  className="flex items-center gap-2 px-4 py-2 bg-[#586ab1] text-white rounded-lg hover:bg-[#4a5c9d] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md font-medium text-sm"
                >
                  {sendingSms ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <ChatBubbleLeftRightIcon className="h-4 w-4" />
                      Send Message
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSmsForm(false);
                    setSmsMessage("");
                    setSmsStatus("");
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SMS History List */}
        {smsLogs.length > 0 ? (
          <div className="space-y-3">
            {smsLogs.map((sms) => {
              const isSystem = !sms.sent_by;
              const senderDisplay = sms.users?.full_name || (isSystem ? "SYSTEM" : "Unknown User");
              return (
                <div key={sms.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-3">
                        <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          <ChatBubbleLeftRightIcon className="h-3.5 w-3.5 mr-1.5" />
                          SMS
                        </span>
                        <div className="flex items-center text-xs text-gray-500">
                          <ClockIcon className="h-3.5 w-3.5 mr-1" />
                          {new Date(sms.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {" "}at{" "}
                          {new Date(sms.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                        </div>
                      </div>
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        sms.status === "sent"
                          ? "bg-accent/10 text-accent border-accent/20"
                          : "bg-red-50 text-red-600 border-red-100"
                      }`}>
                        {sms.status}
                      </span>
                    </div>
                  </div>

                  <div className="px-5 py-4">
                    <div className="mb-4">
                      <label className="text-xs text-gray-500 mb-1 block">Message</label>
                      <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-md p-3 border border-gray-100 whitespace-pre-wrap break-words">
                        {sms.message}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center space-x-2">
                        <div className={`flex items-center justify-center h-7 w-7 rounded-full ${
                          isSystem ? "bg-gray-100" : "bg-[#586ab1] bg-opacity-10"
                        }`}>
                          <svg className={`h-4 w-4 ${isSystem ? "text-gray-400" : "text-[#586ab1]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Sent by</p>
                          <p className={`text-sm font-medium ${isSystem ? "text-brand-secondary" : "text-gray-900"}`}>
                            {senderDisplay}
                          </p>
                        </div>
                      </div>
                      {sms.error_message && (
                        <span className="text-xs text-red-500 italic">{sms.error_message}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-xl">
            <ChatBubbleLeftRightIcon className="h-16 w-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No SMS messages sent yet</p>
            <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
              Click "Send SMS" to compose your first message
            </p>
          </div>
        )}
      </div>
    );
  };







  const renderPromisedToPay = () => {
    const outstandingBalance = loanDetails
      ? parseFloat(loanDetails.total_payable || 0) -
      loanInstallments.reduce(
        (sum, inst) => sum + parseFloat(inst.paid_amount || 0),
        0
      )
      : 0;

    const totalPaidAmount = loanInstallments.reduce(
      (sum, inst) => sum + parseFloat(inst.paid_amount || 0),
      0
    );

    return (
      <div className="space-y-6 pr-2">
        {/* Customer & Loan Info Card */}
        {loanDetails && (
          <div className="bg-white border border-blue-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-600 mb-4">
              Loan Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Loan Info */}
              <div className="bg-muted backdrop-blur-sm rounded-lg p-3 border border-gray-500">
                <p className="text-xs text-gray-500 mb-1">Loan Amount</p>
                <p className="text-sm font-bold text-slate-600">
                  {formatCurrency(loanDetails.scored_amount)}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  ID: #{loanDetails.id}
                </p>
              </div>

              {/* Total Paid */}
              <div className="bg-green-100 backdrop-blur-sm rounded-lg p-3 border border-green-500">
                <p className="text-xs text-gray-500 mb-1">Total Paid</p>
                <p className="text-sm font-bold text-green-600">
                  {formatCurrency(totalPaidAmount)}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {loanDetails.total_payable > 0
                    ? `${((totalPaidAmount / parseFloat(loanDetails.total_payable)) * 100).toFixed(1)}% Complete`
                    : "0% Complete"}
                </p>
              </div>

              {/* Outstanding Balance */}
              <div className="bg-rose-100 backdrop-blur-sm rounded-lg p-3 border border-rose-500">
                <p className="text-xs text-gray-500 mb-1">Outstanding</p>
                <p className="text-sm font-bold text-red-600">
                  {formatCurrency(outstandingBalance)}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Total Due: {formatCurrency(loanDetails.total_payable)}
                </p>
              </div>

              {/* Customer Info */}
              <div className="bg-muted backdrop-blur-sm rounded-lg p-3 border border-gray-500">
                <p className="text-xs text-gray-500 mb-1">Customer</p>
                <p className="text-sm font-medium text-slate-600 truncate">
                  {customer?.Firstname} {customer?.Surname}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {customer?.mobile || "N/A"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          {/* Header with New Promise Button */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xs text-slate-600">Promise History</h3>
               
              </div>
              <button
                onClick={() => setShowPTPForm(!showPTPForm)}
                className="flex items-center gap-2 px-2 py-1.5 bg-brand-primary text-white text-sm rounded-lg hover:bg-brand-secondary transition shadow-md hover:shadow-lg"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Promise
              </button>
            </div>
          </div>

          {/* Create PTP Form */}
          {showPTPForm && (
            <div className="px-6 py-5 border-b border-gray-200 bg-white">
              <h4 className="text-sm  text-slate-600 mb-4 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-brand-primary" />
                Record New Promise to Pay
              </h4>
              <form onSubmit={handleCreatePTP} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Interaction Type */}
                  <div>
                    <label className="block text-xs  text-gray-600 mb-2">
                      Interaction Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={ptpFormData.interaction_type}
                      onChange={(e) =>
                        setPtpFormData({
                          ...ptpFormData,
                          interaction_type: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:ring-1 focus:ring-gary-500 focus:border-gray-500 transition"
                      required
                    >
                      <option value="">Select Type</option>
                      <option value="Call">Call</option>
                      <option value="SMS">SMS</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Email">Email</option>
                      <option value="Follow-up">Follow-up</option>
                    </select>
                  </div>

                  {/* Promised Amount */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Promised Amount (KES) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={ptpFormData.promised_amount}
                      onChange={(e) => setPtpFormData({ ...ptpFormData, promised_amount: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
                      placeholder="Enter amount"
                      required
                    />
                  </div>

                  {/* Promised Date */}
                  <div>
                    <label className="block text-xs  text-slate-600 mb-2">
                      Promised Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={ptpFormData.promised_date}
                      onChange={(e) => setPtpFormData({ ...ptpFormData, promised_date: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>

                  {/* Remarks */}
                  <div className="md:col-span-2">
                    <label className="block text-xs  text-slate-600 mb-2">
                      Remarks/Notes
                    </label>
                    <textarea
                      value={ptpFormData.remarks}
                      onChange={(e) => setPtpFormData({ ...ptpFormData, remarks: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
                      rows="2"
                      placeholder="Add any additional notes..."
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={savingPTP}
                    className="px-3 py-1.5 bg-brand-primary text-white text-sm rounded-lg hover:bg-brand-secondary transition disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg"
                  >
                    {savingPTP ? "Saving..." : "Save Promise"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPTPForm(false)}
                    className="px-3 py-1.5 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400 transition font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* PTPs List */}
          <div className="overflow-x-auto">
            {ptps.length === 0 ? (
              <div className="text-center py-12">
                <CalendarDaysIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">No promises recorded yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Click "New Promise" to record a promise to pay
                </p>
              </div>
            ) : (
              <>
              <table className="min-w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 w-24 text-left text-xs  text-slate-600 whitespace-nowrap">
                      Promised Date
                    </th>
                    <th className="px-3 py-3 w-20 text-left text-xs  text-slate-600 whitespace-nowrap">
                      Amount
                    </th>
                    <th className="px-3 py-3 w-28 text-left text-xs  text-slate-600 whitespace-nowrap">
                      Created
                    </th>
                    <th className="px-3 py-3 w-24 text-left text-xs  text-slate-600 whitespace-nowrap">
                      Type
                    </th>

                    {/* Remarks takes more space */}
                    <th className="px-3 py-3 w-[35%] text-left text-xs  text-slate-600 whitespace-nowrap">
                      Remarks
                    </th>

                    <th className="px-3 py-3 w-20 text-center text-xs  text-gray-600 whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-3 py-3 w-24 text-center text-xs  text-gray-600 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {ptps.slice((ptpPage - 1) * PAGE_SIZE, ptpPage * PAGE_SIZE).map((ptp) => (
                    <tr key={ptp.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-600">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-brand-primary" />
                          {new Date(ptp.promised_date).toLocaleDateString("en-GB")}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-xs  text-slate-600 whitespace-nowrap">
                        {formatCurrency(ptp.promised_amount)}
                      </td>

                      <td className="px-3 py-3 text-xs whitespace-nowrap text-slate-600">
                        <div className="leading-tight">
                          <div className="font-medium">{ptp.users?.full_name || "Unknown"}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(ptp.created_at).toLocaleDateString("en-GB")}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-xs whitespace-nowrap text-gray-600">
                        {ptp.interaction_type || "N/A"}
                      </td>

                      {/* ✅ Improved Remarks Cell */}
                      <td className="px-3 py-3 align-top whitespace-nowrap">
                        <div className="text-sm text-gray-600 whitespace-normal break-words leading-relaxed">
                          {ptp.remarks || "-"}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {getStatusBadge(ptp.status)}
                      </td>

                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        {ptp.status === "pending" ? (
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => updatePTPStatus(ptp.id, "kept")}
                              className="px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs font-semibold"
                            >
                              Kept
                            </button>
                            <button
                              onClick={() => updatePTPStatus(ptp.id, "broken")}
                              className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-semibold"
                            >
                              Broken
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500 italic">No actions</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationBar currentPage={ptpPage} totalPages={Math.ceil(ptps.length / PAGE_SIZE)} onPageChange={setPtpPage} totalItems={ptps.length} />
              </>
            )}
          </div>

          {/* Summary Stats */}
          {ptps.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-brand-surface/30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-yellow-100 rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] text-yellow-600 font-bold uppercase tracking-wider mb-1">Pending Promises</p>
                  <p className="text-xl font-black text-yellow-700">
                    {ptps.filter(p => p.status === "pending").length}
                  </p>
                </div>

                <div className="bg-white border border-accent/10 rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] text-accent font-bold uppercase tracking-wider mb-1">Kept Promises</p>
                  <p className="text-xl font-black text-accent">
                    {ptps.filter(p => p.status === "kept").length}
                  </p>
                </div>

                <div className="bg-white border border-red-100 rounded-xl p-4 shadow-sm">
                  <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider mb-1">Broken Promises</p>
                  <p className="text-xl font-black text-red-700">
                    {ptps.filter(p => p.status === "broken").length}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };


  // ========== LOADING STATE ==========
  if (loading) {
    return <Skeleton360 />;
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Customer not found</p>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 lg:p-6 h-screen flex flex-col bg-muted">
      {/* Header with Back Button */}
      {/* <div className="mb-2 flex-shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 text-xs  text-slate-600 hover:text-gray-100 transition-all duration-200 "
        >
          <ArrowLeftIcon className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
          Back to Customers
        </button>
      </div> */}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 flex-shrink-0 bg-white rounded-t-sm overflow-x-auto no-scrollbar">
        <nav className="flex flex-nowrap w-full p-1" aria-label="Tabs">
          {tabs.map((tab) => {
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
               className={`flex-1 flex items-center justify-center px-4 py-2 text-[10px] whitespace-nowrap transition-all duration-300 rounded-sm ${activeTab === tab.id
  ? "text-white bg-brand-primary shadow-sm"
  : "text-black hover:bg-slate-100 hover:text-slate-600"
  }`}
              >
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content Area with controlled scrolling */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto pr-2">
          {activeTab === "overview" && renderOverview()}
          {activeTab === "loan" && renderLoanDetails()}
          {activeTab === "repayments" && renderRepaymentHistory()}
          {activeTab === "wallet" && renderWallet()}
          {activeTab === "statements" && renderStatements()}
          {activeTab === "interactions" && renderInteractions()}
          {activeTab === "sms" && renderSmsTab()}
          {activeTab === "promised" && renderPromisedToPay()}
        </div>
      </div>

      {/* Refund Modal */}
      <RefundInitiatorModal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        customer={customer}
        walletBalance={walletBalance}
        onSubmitSuccess={() => {
          setShowRefundModal(false);
          fetchCustomerData(); // Refresh data to show any pending requests if we had a list, or just to be safe
        }}
      />
    </div>
  );
};

export default Customer360View;