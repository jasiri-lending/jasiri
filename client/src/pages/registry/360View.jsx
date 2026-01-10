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
import Spinner from "../../components/Spinner.jsx";

// SMS Service Configuration
const CELCOM_AFRICA_CONFIG = {
  baseUrl: "https://isms.celcomafrica.com/api/services/sendsms",
  apiKey: "17323514aa8ce2613e358ee029e65d99",
  partnerID: "928",
  defaultShortcode: "MularCredit",
};

// SMS Service Functions
const SMSService = {
  formatPhoneNumberForSMS(phone) {
    if (!phone) {
      console.warn("Empty phone number provided");
      return "";
    }

    let cleaned = String(phone).replace(/\D/g, "");

    console.log("Formatting phone:", phone, "-> cleaned:", cleaned);

    if (cleaned.startsWith("254")) {
      if (cleaned.length === 12) {
        return cleaned;
      } else if (cleaned.length === 13 && cleaned.startsWith("2540")) {
        return "254" + cleaned.substring(4);
      }
    } else if (cleaned.startsWith("0")) {
      if (cleaned.length === 10) {
        return "254" + cleaned.substring(1);
      } else if (cleaned.length === 11 && cleaned.startsWith("07")) {
        return "254" + cleaned.substring(2);
      }
    } else if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
      if (cleaned.length === 9) {
        return "254" + cleaned;
      } else if (
        cleaned.length === 10 &&
        (cleaned.startsWith("70") ||
          cleaned.startsWith("71") ||
          cleaned.startsWith("72") ||
          cleaned.startsWith("11"))
      ) {
        return "254" + cleaned.substring(1);
      }
    }

    console.error("Invalid phone number format:", phone, "cleaned:", cleaned);
    return "";
  },

  async sendSMS(
    phoneNumber,
    message,
    shortcode = CELCOM_AFRICA_CONFIG.defaultShortcode,
    customerId = null
  ) {
    try {
      const formattedPhone = this.formatPhoneNumberForSMS(phoneNumber);

      if (!formattedPhone) {
        const errorMsg = `Invalid phone number format: ${phoneNumber}`;
        console.error(" SMS Error:", errorMsg);
        throw new Error(errorMsg);
      }

      if (!message || message.trim().length === 0) {
        throw new Error("Message cannot be empty");
      }

      const encodedMessage = encodeURIComponent(message.trim());
      const endpoint = `${CELCOM_AFRICA_CONFIG.baseUrl}/?apikey=${CELCOM_AFRICA_CONFIG.apiKey}&partnerID=${CELCOM_AFRICA_CONFIG.partnerID}&message=${encodedMessage}&shortcode=${shortcode}&mobile=${formattedPhone}`;

      console.log(" Sending SMS via Celcom Africa to:", formattedPhone);

      const response = await fetch(endpoint, {
        method: "GET",
        mode: "no-cors",
      });

      console.log("✅ SMS request sent successfully to:", formattedPhone);

      const messageId = `msg-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      await this.logSMS(
        formattedPhone,
        message,
        "sent",
        shortcode,
        undefined,
        messageId,
        0,
        customerId
      );

      return {
        success: true,
        message: "SMS sent successfully",
        messageId: messageId,
        cost: 0,
        recipient: formattedPhone,
      };
    } catch (error) {
      console.error(" SMS sending error:", error);

      const formattedPhone = this.formatPhoneNumberForSMS(phoneNumber);
      if (formattedPhone) {
        await this.logSMS(
          formattedPhone,
          message,
          "failed",
          shortcode,
          error.message,
          undefined,
          undefined,
          customerId
        );
      }

      return {
        success: false,
        error: error.message,
        originalNumber: phoneNumber,
      };
    }
  },

  async logSMS(
    recipientPhone,
    message,
    status,
    senderId,
    errorMessage,
    messageId,
    cost,
    customerId
  ) {
    try {
      const { error } = await supabase.from("sms_logs").insert({
        recipient_phone: recipientPhone,
        message: message,
        status: status,
        error_message: errorMessage,
        message_id: messageId,
        sender_id: senderId,
        customer_id: customerId,
        cost: cost,
      });

      if (error) {
        console.error("Failed to log SMS:", error);
      }
    } catch (error) {
      console.error("Error logging SMS:", error);
    }
  },
};

const Customer360View = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
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

      // Fetch loan details with all relationships
      const { data: loan } = await supabase
        .from("loans")
        .select(
          `
          *,
          branches (name),
          regions (name)
        `
        )
        .eq("customer_id", customerId)
        .eq("status", "disbursed")
        .maybeSingle();

      setLoanDetails(loan);

      if (loan) {
        // Fetch loan installments
        const { data: installments } = await supabase
          .from("loan_installments")
          .select("*")
          .eq("loan_id", loan.id)
          .order("installment_number", { ascending: true });

        setLoanInstallments(installments || []);

        // Fetch loan payments
        const { data: payments } = await supabase
          .from("loan_payments")
          .select("*")
          .eq("loan_id", loan.id)
          .order("paid_at", { ascending: false });

        setLoanPayments(payments || []);
      }

      // Fetch wallet transactions and calculate balance
      const { data: walletTxns } = await supabase
        .from("customer_wallets")
        .select("*")
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

      // Calculate wallet balance
      const balance = (walletTxns || []).reduce((acc, txn) => {
        const amount = parseFloat(txn.amount || 0);
        return acc + amount;
      }, 0);

      setWalletBalance(balance);

      // Fetch M-Pesa C2B transactions
      const { data: mpesaTxns } = await supabase
        .from("mpesa_c2b_transactions")
        .select("*")
        .eq("phone_number", customerData.mobile)
        .order("created_at", { ascending: false })
        .limit(20);

      setMpesaTransactions(mpesaTxns || []);

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

      // Fetch SMS logs
      const { data: smsData } = await supabase
        .from("sms_logs")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      setSmsLogs(smsData || []);

      // Fetch Promised to Pay data if loan exists
      if (loan) {
        await fetchPTPs(loan.id);
        await calculatePaymentStats(loan);
      }
    } catch (error) {
      console.error("Error fetching customer data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Promised to Pay records
  const fetchPTPs = async (loanId) => {
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
        .eq('loan_id', loanId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPtps(data || []);
    } catch (err) {
      console.error("Error fetching PTPs:", err);
    }
  };

  // Calculate payment statistics
  const calculatePaymentStats = async (loan) => {
    try {
      const totalPaid = loanInstallments.reduce(
        (sum, inst) => sum + (parseFloat(inst.paid_amount) || 0),
        0
      );

      const totalPrincipalPaid = loanInstallments.reduce(
        (sum, inst) => sum + (parseFloat(inst.principal_paid) || 0),
        0
      );

      const totalInterestPaid = loanInstallments.reduce(
        (sum, inst) => sum + (parseFloat(inst.interest_paid) || 0),
        0
      );

      const outstandingBalance = (parseFloat(loan.total_payable) || 0) - totalPaid;

      setPaymentStats({
        totalPaid,
        totalPrincipalPaid,
        totalInterestPaid,
        outstandingBalance,
        totalDue: parseFloat(loan.total_payable) || 0
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
      fetchPTPs(loanDetails.id);
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
      if (loanDetails?.id) {
        fetchPTPs(loanDetails.id);
      }
    } catch (err) {
      console.error("Error updating PTP status:", err);
      alert("Failed to update status");
    }
  };

  const tabs = [
    { id: "overview", name: "Overview", icon: UserCircleIcon },
    { id: "loan", name: "Loan Details", icon: BanknotesIcon },
    { id: "repayments", name: "Repayment History", icon: ClockIcon },
    { id: "wallet", name: "Wallet", icon: WalletIcon },
    { id: "statements", name: "M-Pesa Transactions", icon: DocumentTextIcon },
    { id: "interactions", name: "Interactions", icon: ChatBubbleLeftRightIcon },
    { id: "sms", name: "SMS", icon: ChatBubbleLeftRightIcon },
    { id: "promised", name: "Promised to Pay", icon: CalendarDaysIcon },
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
    const base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (status) {
      case "pending":
        return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>;
      case "kept":
        return <span className={`${base} bg-green-100 text-green-800`}>Kept</span>;
      case "broken":
        return <span className={`${base} bg-red-100 text-red-800`}>Broken</span>;
      default:
        return <span className={`${base} bg-gray-100 text-gray-800`}>Unknown</span>;
    }
  };

  // Optimized renderOverview with reduced scrolling
  const renderOverview = () => {
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
      <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        {/* Compact Customer Profile Card */}
        <div className="bg-gradient-to-br from-slate-100 via-blue-100 to-cyan-100 border-2 border-gray-200 rounded-xl shadow-sm">
          <div className="from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100">
            <div className="flex items-start gap-6">
              {/* Left: Passport Photo and Basic Info */}
              <div className="flex-shrink-0">
                <div className="flex flex-col items-center">
                  {customer.passport_url ? (
                    <img
                      src={customer.passport_url}
                      alt={`${customer.Firstname} ${customer.Surname}`}
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-bold text-white border-4 border-white shadow-md">
                      {getInitials()}
                    </div>
                  )}
                  <h2 className="text-sm font-medium text-slate-700 mt-2 text-center">
                    {customer.prefix} {customer.Firstname} {customer.Surname}
                  </h2>

                  <div className="mt-2 space-y-1 text-slate-600 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <PhoneIcon className="h-3.5 w-3.5" />
                      <span className="text-xs">{customer.mobile}</span>
                    </div>
                    <div className="flex items-center justify-center gap-1.5">
                      <IdentificationIcon className="h-3.5 w-3.5" />
                      <span className="text-xs">ID: {customer.id_number}</span>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="mt-2 flex flex-wrap gap-1 justify-center">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        customer.status === "approved"
                          ? "bg-green-600 text-white"
                          : customer.status === "bm_review"
                          ? "bg-yellow-500 text-white"
                          : customer.status === "rejected"
                          ? "bg-red-500 text-white"
                          : "bg-gray-500 text-white"
                      }`}
                    >
                      {customer.status || "Pending"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Financial Details - More Compact */}
              <div className="flex-1">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    {
                      label: "Wallet Balance",
                      value: walletBalance,
                      icon: WalletIcon,
                    },
                    {
                      label: "Principal",
                      value: loanDetails?.scored_amount,
                      icon: CreditCardIcon,
                    },
                    {
                      label: "Interest",
                      value: loanDetails?.total_interest,
                      icon: ChartBarIcon,
                    },
                    {
                      label: "Total Payable",
                      value: loanDetails?.total_payable,
                      icon: DocumentTextIcon,
                    },
                    {
                      label: "Total Paid",
                      value: totalPaidAmount,
                      icon: CheckCircleIcon,
                    },
                    {
                      label: "Outstanding",
                      value: outstandingBalance,
                      icon: ExclamationCircleIcon,
                    },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg p-3 text-center"
                    >
                      <item.icon className="h-6 w-6 text-slate-800 mx-auto mb-1" />
                      <p className="text-xs text-slate-700 font-medium mb-1">
                        {item.label}
                      </p>
                      <p className="text-base font-semibold text-slate-800">
                        {formatCurrency(item.value || 0)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Branch info below financial cards */}
                <div className="mt-4 bg-white/30 backdrop-blur-sm rounded-lg p-3 border border-white/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BuildingLibraryIcon className="h-5 w-5 text-slate-700" />
                      <span className="text-sm font-medium text-slate-800">
                        {customer.branches?.name || "No branch assigned"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
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
            <h3 className="text-base font-semibold text-slate-700 mb-3 flex items-center">
              <IdentificationIcon className="h-4 w-4 mr-2 text-blue-600" />
              Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Mobile</p>
                <p className="text-sm font-medium text-slate-700">
                  {customer.mobile || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Alt Mobile</p>
                <p className="text-sm font-medium text-slate-700">
                  {customer.alternative_mobile || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Gender</p>
                <p className="text-sm font-medium text-slate-700">
                  {customer.gender || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Marital Status</p>
                <p className="text-sm font-medium text-slate-700">
                  {customer.marital_status || "N/A"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-1">Occupation</p>
                <p className="text-sm font-medium text-slate-700">
                  {customer.occupation || "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Address Information - More Compact */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-base font-semibold text-slate-700 mb-3 flex items-center">
              <MapPinIcon className="h-4 w-4 mr-2 text-blue-600" />
              Address & Location
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">County</p>
                <p className="text-sm font-medium text-slate-700">
                  {customer.county || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Town</p>
                <p className="text-sm font-medium text-slate-700">
                  {customer.town || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Residence Status</p>
                <p className="text-sm font-medium text-slate-700">
                  {customer.residence_status || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Road</p>
                <p className="text-sm font-medium text-slate-700">
                  {customer.road || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Business Information - Conditional and Compact */}
        {customer.business_name && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-base font-semibold text-slate-700 mb-3 flex items-center">
              <BriefcaseIcon className="h-4 w-4 mr-2 text-blue-600" />
              Business Information
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Business Name</p>
                <p className="text-sm font-medium text-slate-700">
                  {customer.business_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Business Type</p>
                <p className="text-sm font-medium text-slate-700">
                  {customer.business_type || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Location</p>
                <p className="text-sm font-medium text-slate-700">
                  {customer.business_location || "N/A"}
                </p>
              </div>
              {customer.daily_Sales && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Daily Sales</p>
                  <p className="text-sm font-medium text-slate-700">
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
      {loanDetails ? (
        <>
          <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg p-6 text-slate-600">
            <h3 className="text-sm  mb-2">
              Current Loan - {loanDetails.product_name || loanDetails.product}
            </h3>
            <p className="text-xl font-bold text-slate-600 ">
              {formatCurrency(loanDetails.scored_amount)}
            </p>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-slate-500 text-sm">Status</p>
                <p className="font-semibold capitalize">{loanDetails.status}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">Repayment State</p>
                <p className="font-semibold capitalize">
                  {loanDetails.repayment_state || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">Duration</p>
                <p className="font-semibold">
                  {loanDetails.duration_weeks} weeks
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">Product Type</p>
                <p className="font-semibold capitalize">
                  {loanDetails.product_type || "N/A"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h4 className=" text-slate-600 mb-4">Loan Details</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Scored Amount</span>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(loanDetails.scored_amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Interest Rate</span>
                  <span className="font-medium text-slate-800">
                    {loanDetails.interest_rate || "0"}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Interest</span>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(loanDetails.total_interest)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Processing Fee</span>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(loanDetails.processing_fee)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Registration Fee</span>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(loanDetails.registration_fee)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-slate-600 ">Weekly Payment</span>
                  <span className="font-bold text-indigo-600">
                    {formatCurrency(loanDetails.weekly_payment)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h4 className=" text-slate-600 mb-4">Loan Timeline</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Booked At</span>
                  <span className="font-medium text-slate-800">
                    {loanDetails.booked_at
                      ? new Date(loanDetails.booked_at).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Approved By BM</span>
                  <span className="font-medium text-slate-800">
                    {loanDetails.bm_reviewed_at
                      ? new Date(
                          loanDetails.bm_reviewed_at
                        ).toLocaleDateString()
                      : "Pending"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Approved By RM</span>
                  <span className="font-medium text-slate-800">
                    {loanDetails.rm_reviewed_at
                      ? new Date(
                          loanDetails.rm_reviewed_at
                        ).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Disbursed At</span>
                  <span className="font-medium text-slate-800">
                    {loanDetails.disbursed_at
                      ? new Date(loanDetails.disbursed_at).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Processing Fee Paid</span>
                  <span
                    className={`font-medium  ${
                      loanDetails.processing_fee_paid
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {loanDetails.processing_fee_paid ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Registration Fee Paid</span>
                  <span
                    className={`font-medium ${
                      loanDetails.registration_fee_paid
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {loanDetails.registration_fee_paid ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Loan Installments */}
          {loanInstallments.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h4 className=" text-slate-600 mb-4">Installment Schedule</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Due Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Due Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Paid Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Days Overdue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loanInstallments.map((installment) => (
                      <tr key={installment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {installment.installment_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(installment.due_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {formatCurrency(installment.due_amount)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600">
                          {formatCurrency(installment.paid_amount)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              installment.status === "paid"
                                ? "bg-green-100 text-green-800"
                                : installment.status === "partial"
                                ? "bg-yellow-100 text-yellow-800"
                                : installment.status === "overdue"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {installment.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {installment.days_overdue > 0 ? (
                            <span className="text-red-600 font-medium">
                              {installment.days_overdue} days
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <BanknotesIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No active loan</p>
        </div>
      )}
    </div>
  );

  const renderRepaymentHistory = () => {
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
      <div className="space-y-6">
        {/* Loan Summary Cards */}
        {loanDetails && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-blue-900">
                  Loan Amount
                </h4>
                <BanknotesIcon className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrency(loanDetails.total_payable)}
              </p>
              <p className="text-xs text-blue-700 mt-1">Total Payable</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-green-900">
                  Total Paid
                </h4>
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(totalPaidAmount)}
              </p>
              <p className="text-xs text-green-700 mt-1">
                {(
                  (totalPaidAmount /
                    parseFloat(loanDetails.total_payable || 1)) *
                  100
                ).toFixed(1)}
                % Complete
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-orange-900">
                  Outstanding Balance
                </h4>
                <ExclamationCircleIcon className="h-5 w-5 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-orange-900">
                {formatCurrency(outstandingBalance)}
              </p>
              <p className="text-xs text-orange-700 mt-1">Remaining to Pay</p>
            </div>
          </div>
        )}

        {/* Payment History Table */}
        {loanPayments.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <h3 className="text-base font-semibold text-slate-700">
                Payment History
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                All payments received for this loan
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Amount Paid
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Payment Method
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Payment Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      M-Pesa Receipt
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Balance After
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loanPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(payment.paid_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        {formatCurrency(payment.paid_amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                        {payment.payment_method?.replace("_", " ") || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {payment.payment_type || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {payment.mpesa_receipt || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {formatCurrency(payment.balance_after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
            <ClockIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No payment history</p>
          </div>
        )}
      </div>
    );
  };

  const renderWallet = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg p-6 text-white">
        <h3 className="text-lg font-semibold mb-2">Wallet Balance</h3>
        <p className="text-xl font-bold">{formatCurrency(walletBalance)}</p>
        <p className="text-green-100 mt-2">Available for transactions</p>
      </div>

      {/* Wallet Transactions */}
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              MPESA Ref
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Amount
            </th>
          </tr>
        </thead>

        <tbody className="bg-white divide-y divide-gray-200">
          {walletTransactions.map((txn, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-slate-600">
                {new Date(txn.created_at).toLocaleString()}
              </td>

              <td className="px-4 py-3 text-sm">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    txn.type === "credit"
                      ? "bg-green-100 text-green-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {txn.transaction_type}
                </span>
              </td>

              <td className="px-4 py-3 text-sm text-gray-600">
                {txn.mpesa_reference || "—"}
              </td>

              <td
                className={`px-4 py-3 text-sm font-medium text-right ${
                  txn.type === "credit" ? "text-green-600" : "text-green-600"
                }`}
              >
                {formatCurrency(txn.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderStatements = () => (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">
          M-Pesa C2B Transactions
        </h4>
        <p className="text-sm text-blue-700">
          All M-Pesa payments received from this customer's phone number
        </p>
      </div>

      {mpesaTransactions.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Transaction ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Payment Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mpesaTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {txn.transaction_time
                        ? new Date(txn.transaction_time).toLocaleString()
                        : new Date(txn.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">
                      {txn.transaction_id || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatCurrency(txn.amount)}
                    </td>
                   <td className="px-4 py-3 text-sm text-gray-600 capitalize">
  {txn.description
    ? txn.description.includes("Credited to wallet - no active loan")
      ? "Credited to wallet"
      : txn.description.includes("Loan repayment processed")
        ? "Loan repayment"
        : txn.description
    : "N/A"}
</td>

                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          txn.status === "applied"
                            ? "bg-green-100 text-green-800"
                            : txn.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
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

        // ✅ Use existing profile from useAuth
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
           
            <p className="text-sm text-gray-600 mt-1">
              Track all customer communication and touchpoints
            </p>
          </div>
          <button
            onClick={() => setShowInteractionForm(!showInteractionForm)}
            className="flex items-center gap-2 px-4 py-2 bg-[#586ab1] text-white rounded-lg hover:bg-[#4a5c9d] transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm"
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
          <div className="bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200 rounded-xl p-5 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-600 mb-4 flex items-center">
              <svg 
                className="h-5 w-5 mr-2 text-[#586ab1]" 
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-1 focus:ring-[#586ab1] focus:border-[#586ab1] transition text-sm"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-1 focus:ring-[#586ab1] focus:border-[#586ab1] transition text-sm"
                    placeholder="Brief subject or title..."
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-1 focus:ring-[#586ab1] focus:border-[#586ab1] resize-none transition text-sm"
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
                  className="flex items-center gap-2 px-4 py-2 bg-[#586ab1] text-white rounded-lg hover:bg-[#4a5c9d] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md font-medium text-sm"
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
          <div className="space-y-3">
            {interactions.map((interaction, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Header Section */}
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-3">
                      <span
                        className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                          interaction.interaction_type === "call"
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
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">
                        Subject
                      </label>
                      <h4 className="text-sm font-semibold text-gray-900">
                        {interaction.subject}
                      </h4>
                    </div>
                  )}

                  {/* Message/Notes */}
                  <div className="mb-4">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">
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
                        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                          interaction.outcome === "positive"
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
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Click "Add Interaction" to record your first customer interaction
            </p>
          </div>
        )}
      </div>
    );
  };

const renderSmsTab = () => {

  // Load SMS logs on component mount
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
        users!sms_logs_sent_by_fkey (
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

    // CRITICAL: Verify user is logged in
    if (!profile?.id) {
      console.error("❌ BLOCKED: No logged-in user profile");
      setSmsStatus("Failed: You must be logged in to send SMS");
      return;
    }

    console.log("=== SENDING SMS ===");
    console.log("Sender (Profile ID):", profile.id);
    console.log("Sender Name:", profile.full_name);
    console.log("Sender Email:", profile.email);

    const today = new Date().toISOString().split("T")[0];

    // Check daily SMS limit (2 per customer per day)
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
      const result = await SMSService.sendSMS(
        customer.mobile,
        smsMessage,
        CELCOM_AFRICA_CONFIG.defaultShortcode,
        customerId
      );

      // CRITICAL: Always set sent_by to the current user's ID
      const insertData = {
        customer_id: customerId,
        recipient_phone: customer.mobile,
        message: smsMessage,
        status: result.success ? "sent" : "failed",
        message_id: result.messageId ?? null,
        error_message: result.success ? null : (result.error || "Unknown error"),
        sent_by: profile.id, // ✅ MUST be the logged-in user's UUID
        tenant_id: profile.tenant_id
      };
      
      console.log("=== INSERTING SMS LOG ===");
      console.log("Data to insert:", insertData);

      // Insert SMS log
      const { data: insertedData, error: insertError } = await supabase
        .from("sms_logs")
        .insert(insertData)
        .select(`
          id,
          message,
          status,
          created_at,
          error_message,
          sent_by,
          users!sms_logs_sent_by_fkey (
            id,
            full_name,
            email
          )
        `)
        .single();

      if (insertError) {
        console.error("❌ Insert Error:", insertError);
        throw insertError;
      }

      console.log("✅ Inserted SMS Log:", insertedData);
      console.log("Inserted user data:", insertedData?.users);

      // Reload all SMS logs to refresh the list
      await loadSmsLogs();

      setSmsMessage("");
      setSmsStatus("Message sent successfully!");
      setTimeout(() => setSmsStatus(""), 5000);

    } catch (error) {
      console.error("❌ SMS send error:", error);
      setSmsStatus("Failed to send message");
    } finally {
      setSendingSms(false);
    }
  };

  // Debug function to check for data issues
  const checkOrphanedLogs = async () => {
    console.log("\n=== CHECKING FOR DATA ISSUES ===");
    
    // Get all SMS logs for this customer
    const { data: allLogs, error } = await supabase
      .from("sms_logs")
      .select("id, sent_by, created_at")
      .eq("customer_id", customerId);

    if (error) {
      console.error("Error fetching logs:", error);
      return;
    }

    console.log("Total SMS logs:", allLogs?.length);
    
    // Check for NULL sent_by (should not exist)
    const logsWithNullSentBy = allLogs?.filter(log => !log.sent_by) || [];
    console.log("⚠️ Logs with NULL sent_by:", logsWithNullSentBy.length);
    
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
        console.error("❌ Error fetching users:", userError);
        console.error("This could be an RLS (Row Level Security) policy issue!");
        return;
      }

      console.log("✅ Users found in database:", existingUsers);
      
      const existingUserIds = existingUsers?.map(u => u.id) || [];
      const missingUserIds = uniqueIds.filter(id => !existingUserIds.includes(id));
      
      if (missingUserIds.length > 0) {
        console.error("⚠️ These user IDs in SMS logs don't exist in users table:", missingUserIds);
      } else {
        console.log("✅ All user IDs exist in users table");
      }
    }
  };

  return (
    <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
      
      {/* Debug render */}
      {console.log("=== RENDER: smsLogs state ===", smsLogs)}

      {/* SMS COMPOSE - Only for non-RO users */}
      {profile?.role !== "relationship_officer" && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100 rounded-xl p-5">
          <h3 className="text-base text-slate-600 mb-4 flex items-center">
            <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2 text-blue-600" />
            Send SMS to Customer
          </h3>

          <div className="space-y-4">

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Recipient
              </label>
              <div className="flex items-center bg-white p-3 rounded-lg border border-gray-200">
                <PhoneIcon className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-900">
                  {customer?.Firstname && customer?.mobile
                    ? `${customer.Firstname} - ${customer.mobile}`
                    : customer?.mobile || "No mobile number"}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Message (2 SMS per customer per day)
              </label>
              <textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                className="w-full h-32 p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                maxLength={160}
                placeholder="Type your message here..."
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">
                  {smsMessage.length}/160 characters
                </span>
                <span className="text-xs text-gray-500">
                  Sender ID: {CELCOM_AFRICA_CONFIG.defaultShortcode}
                </span>
              </div>
            </div>

            {/* Current logged-in user display */}
            {profile && (
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                Sending as: <span className="font-medium">{profile.full_name}</span>
              </div>
            )}

            {smsStatus && (
              <div
                className={`p-3 text-sm rounded-lg flex items-center ${
                  smsStatus.includes("successfully")
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {smsStatus.includes("successfully") ? (
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                ) : (
                  <ExclamationCircleIcon className="h-4 w-4 mr-2" />
                )}
                {smsStatus}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-gray-200">
              <button
                onClick={handleSendSms}
                disabled={sendingSms || !smsMessage.trim() || !profile?.id}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center"
              >
                {sendingSms ? "Sending..." : "Send SMS"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS HISTORY */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 flex justify-between items-center">
          <h3 className="text-base text-slate-600">SMS History</h3>
          <button
            onClick={() => {
              loadSmsLogs();
              checkOrphanedLogs();
            }}
            className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded text-gray-700"
          >
            Debug Logs
          </button>
        </div>

        {smsLogs.length > 0 ? (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-700 text-left">Date & Time</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-700 text-left">Message</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-700 text-left">Sent By</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-700 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {smsLogs.map((sms) => {
                  // Debug log for each row
                  const senderDisplay = sms.users?.full_name || "Unknown User";
                  
                  console.log("Rendering SMS row:", {
                    id: sms.id,
                    sent_by: sms.sent_by,
                    users_object: sms.users,
                    full_name: sms.users?.full_name,
                    display: senderDisplay
                  });
                  
                  return (
                    <tr key={sms.id} className="hover:bg-blue-50">
                      <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap align-top">
                        {new Date(sms.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="whitespace-pre-wrap break-words">
                          {sms.message}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 align-top">
                        {senderDisplay}
                        {!sms.users && sms.sent_by && (
                          <div className="text-xs text-red-500 mt-1">
                            (User not found: {sms.sent_by.substring(0, 8)}...)
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <span className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${
                          sms.status === "sent"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {sms.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No SMS messages sent yet
          </div>
        )}
      </div>
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
      <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        {/* Customer & Loan Info Card */}
        {loanDetails && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
            <h3 className="text-base font-semibold text-slate-600 mb-4">
              Loan Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Loan Info */}
              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-white/60">
                <p className="text-xs text-gray-500 mb-1">Loan Amount</p>
                <p className="text-sm font-bold text-slate-600">
                  {formatCurrency(loanDetails.scored_amount)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  ID: #{loanDetails.id}
                </p>
              </div>

              {/* Total Paid */}
              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-white/60">
                <p className="text-xs text-gray-500 mb-1">Total Paid</p>
                <p className="text-sm font-bold text-green-600">
                  {formatCurrency(totalPaidAmount)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {loanDetails.total_payable > 0 
                    ? `${((totalPaidAmount / parseFloat(loanDetails.total_payable)) * 100).toFixed(1)}% Complete`
                    : "0% Complete"}
                </p>
              </div>

              {/* Outstanding Balance */}
              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-white/60">
                <p className="text-xs text-gray-500 mb-1">Outstanding</p>
                <p className="text-sm font-bold text-red-600">
                  {formatCurrency(outstandingBalance)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Total Due: {formatCurrency(loanDetails.total_payable)}
                </p>
              </div>

              {/* Customer Info */}
              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-white/60">
                <p className="text-xs text-gray-500 mb-1">Customer</p>
                <p className="text-sm font-medium text-slate-600 truncate">
                  {customer?.Firstname} {customer?.Surname}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
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
                <h3 className="text-base font-semibold text-slate-600">Promise History</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Track all promises to pay made by the customer
                </p>
              </div>
              <button
                onClick={() => setShowPTPForm(!showPTPForm)}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition shadow-md hover:shadow-lg"
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
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100">
              <h4 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-indigo-600" />
                Record New Promise to Pay
              </h4>
              <form onSubmit={handleCreatePTP} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Interaction Type */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
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
                    <label className="block text-xs font-medium text-gray-700 mb-2">
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
                    <label className="block text-xs font-medium text-gray-700 mb-2">
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
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg"
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
             <table className="min-w-full divide-y divide-gray-200 table-fixed">
  <thead className="bg-gray-50">
    <tr>
      <th className="px-3 py-3 w-24 text-left text-xs  text-gray-700 uppercase">
        Promised Date
      </th>
      <th className="px-3 py-3 w-20 text-left text-xs  text-gray-700 uppercase">
        Amount
      </th>
      <th className="px-3 py-3 w-28 text-left text-xs  text-gray-700 uppercase">
        Created
      </th>
      <th className="px-3 py-3 w-24 text-left text-xs  text-gray-700 uppercase">
        Type
      </th>

      {/* Remarks takes more space */}
      <th className="px-3 py-3 w-[35%] text-left text-xs  text-gray-700 uppercase">
        Remarks
      </th>

      <th className="px-3 py-3 w-20 text-center text-xs  text-gray-700 uppercase">
        Status
      </th>
      <th className="px-3 py-3 w-24 text-center text-xs  text-gray-700 uppercase">
        Actions
      </th>
    </tr>
  </thead>

  <tbody className="bg-white divide-y divide-gray-200">
    {ptps.map((ptp) => (
      <tr key={ptp.id} className="hover:bg-gray-50 transition">
        <td className="px-3 py-3 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-indigo-500" />
            {new Date(ptp.promised_date).toLocaleDateString("en-GB")}
          </div>
        </td>

        <td className="px-3 py-3 text-sm  text-slate-600">
          {formatCurrency(ptp.promised_amount)}
        </td>

        <td className="px-3 py-3 text-sm text-slate-600">
          <div className="leading-tight">
            <div className="font-medium">{ptp.users?.full_name || "Unknown"}</div>
            <div className="text-xs text-gray-500">
              {new Date(ptp.created_at).toLocaleDateString("en-GB")}
            </div>
          </div>
        </td>

        <td className="px-3 py-3 text-sm text-gray-700">
          {ptp.interaction_type || "N/A"}
        </td>

        {/* ✅ Improved Remarks Cell */}
        <td className="px-3 py-3 align-top">
          <div className="text-sm text-gray-700 whitespace-normal break-words leading-relaxed">
            {ptp.remarks || "-"}
          </div>
        </td>

        <td className="px-3 py-3 text-center">
          {getStatusBadge(ptp.status)}
        </td>

        <td className="px-3 py-3 text-center">
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

            )}
          </div>

          {/* Summary Stats */}
          {ptps.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-3 shadow-sm">
                  <p className="text-xs text-yellow-800 font-semibold mb-0.5">Pending Promises</p>
                  <p className="text-base font-bold text-yellow-900">
                    {ptps.filter(p => p.status === "pending").length}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3 shadow-sm">
                  <p className="text-xs text-green-800 font-semibold mb-0.5">Kept Promises</p>
                  <p className="text-base font-bold text-green-900">
                    {ptps.filter(p => p.status === "kept").length}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-lg p-3 shadow-sm">
                  <p className="text-xs text-red-800 font-semibold mb-0.5">Broken Promises</p>
                  <p className="text-base font-bold text-red-900">
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
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#d9e2e8' }}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Spinner text="Loading 360 view..." />
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Customer not found</p>
      </div>
    );
  }

  return (
    <div className="p-4 h-screen flex flex-col">
      {/* Header with Back Button */}
      <div className="mb-2 flex-shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Customers
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4 flex-shrink-0">
        <nav className="flex space-x-1 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="h-4 w-4 mr-1.5" />
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
    </div>
  );
};

export default Customer360View;