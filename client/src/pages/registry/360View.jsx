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
} from "@heroicons/react/24/outline";
import { supabase } from "../../supabaseClient.js";

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
      // 1️⃣ Fetch interactions
      const { data: interactions } = await supabase
        .from("customer_interactions")
        .select("*")
        .eq("customer_id", customerId)
        .order("interaction_date", { ascending: false })
        .limit(10);

      // 2️⃣ Fetch officer names
      const createdByIds = interactions
        .map((i) => i.created_by)
        .filter(Boolean);
      const { data: users } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", createdByIds);

      // 3️⃣ Merge
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
    } catch (error) {
      console.error("Error fetching customer data:", error);
    } finally {
      setLoading(false);
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

  const renderRepaymentHistory = () => (
    <div className="space-y-4">
      {loanPayments.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
                      {txn.payment_type || "N/A"}
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

  const renderInteractions = () => (
    <div className="space-y-4">
      {interactions.length > 0 ? (
        <div className="space-y-3">
          {interactions.map((interaction, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        interaction.interaction_type === "call"
                          ? "bg-blue-100 text-blue-800"
                          : interaction.interaction_type === "sms"
                          ? "bg-green-100 text-green-800"
                          : interaction.interaction_type === "email"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {interaction.interaction_type || "Interaction"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(interaction.interaction_date).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600">
                    {interaction.notes || "No notes"}
                  </p>
               {interaction.officer_name && (
  <p className="text-xs text-gray-500 mt-2">
    By: {interaction.officer_name}
  </p>
)}

                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <ChatBubbleLeftRightIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No interactions recorded</p>
        </div>
      )}
    </div>
  );

  const renderSmsTab = () => {
    const handleSendSms = async () => {
      if (!smsMessage.trim() || !customer?.mobile) {
        alert("Please enter a message and ensure customer has a mobile number");
        return;
      }

      setSendingSms(true);
      setSmsStatus("Sending...");

      try {
        // Use the actual SMS service
        const result = await SMSService.sendSMS(
          customer.mobile,
          smsMessage,
          CELCOM_AFRICA_CONFIG.defaultShortcode,
          customerId
        );

        if (result.success) {
          // Refresh SMS logs
          const { data: updatedSms, error: fetchError } = await supabase
            .from("sms_logs")
            .select("*")
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false });

          if (!fetchError) {
            setSmsLogs(updatedSms || []);
          }

          setSmsMessage("");
          setSmsStatus(
            `Message sent successfully! Message ID: ${
              result.messageId || "N/A"
            }`
          );

          // Clear status after 5 seconds
          setTimeout(() => setSmsStatus(""), 5000);
        } else {
          throw new Error(result.error || "Failed to send SMS");
        }
      } catch (error) {
        console.error("Error sending SMS:", error);
        setSmsStatus(`Failed to send message: ${error.message}`);
      } finally {
        setSendingSms(false);
      }
    };

    return (
      <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        {/* SMS Compose Card */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100 rounded-xl p-5">
          <h3 className="text-base  text-slate-600 mb-4 flex items-center">
            <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2 text-blue-600" />
            Send SMS to Customer
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Recipient
              </label>
              <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-2">
                  <PhoneIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">
                    {customer?.mobile || "No mobile number"} -{" "}
                    {customer?.Firstname} {customer?.Surname}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Type your message here..."
                className="w-full h-32 p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                maxLength={160}
              />
              <div className="flex justify-between mt-1">
                <div className="flex items-center space-x-4">
                  <span className="text-xs text-gray-500">
                    {smsMessage.length}/160 characters
                  </span>
                  <span className="text-xs text-gray-500">
                    ~{Math.ceil(smsMessage.length / 160)} SMS
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  Sender ID: {CELCOM_AFRICA_CONFIG.defaultShortcode}
                </span>
              </div>
            </div>

            {smsStatus && (
              <div
                className={`p-3 text-sm rounded-lg flex items-center justify-between ${
                  smsStatus.includes("successfully")
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                <div className="flex items-center">
                  {smsStatus.includes("successfully") ? (
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                  ) : (
                    <ExclamationCircleIcon className="h-4 w-4 mr-2" />
                  )}
                  <span>{smsStatus}</span>
                </div>
                <span className="text-xs font-medium">
                  {smsStatus.includes("successfully")
                    ? "✓ Delivered"
                    : "✗ Failed"}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              <div className="flex space-x-3">
                <button
                  onClick={() => setSmsMessage("")}
                  className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition border border-gray-300"
                  disabled={sendingSms}
                >
                  Clear
                </button>
                <button
                  onClick={handleSendSms}
                  disabled={
                    sendingSms || !smsMessage.trim() || !customer?.mobile
                  }
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm"
                >
                  {sendingSms ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-3 w-3 text-white"
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
                      Sending...
                    </>
                  ) : (
                    <>
                      <ChatBubbleLeftRightIcon className="h-3 w-3 mr-2" />
                      Send SMS
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SMS History */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base  text-slate-600">
                  SMS History
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Recent messages sent to this customer
                </p>
              </div>
              <button
                onClick={() => fetchCustomerData()}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"
              >
                Refresh
              </button>
            </div>
          </div>

          {smsLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="max-h-[400px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Message
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {smsLogs.map((sms) => (
                      <tr
                        key={sms.id}
                        className="hover:bg-blue-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">
                              {new Date(sms.created_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}
                            </span>
                            <span className="text-xs text-gray-500 mt-0.5">
                              {new Date(sms.created_at).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                }
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-md">
                            <p className="text-sm text-gray-900 leading-relaxed">
                              {sms.message}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            <span
                              className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full w-fit ${
                                sms.status === "sent" ||
                                sms.status === "delivered"
                                  ? "bg-green-100 text-green-800 border border-green-200"
                                  : sms.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                                  : sms.status === "failed"
                                  ? "bg-red-100 text-red-800 border border-red-200"
                                  : "bg-gray-100 text-gray-800 border border-gray-200"
                              }`}
                            >
                              {sms.status === "sent" ||
                              sms.status === "delivered"
                                ? "✓ "
                                : sms.status === "failed"
                                ? "✗ "
                                : ""}
                              {sms.status.charAt(0).toUpperCase() +
                                sms.status.slice(1)}
                            </span>
                            {sms.error_message && (
                              <p
                                className="text-xs text-red-600 max-w-[180px]"
                                title={sms.error_message}
                              >
                                {sms.error_message}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">
                No SMS messages sent yet
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Send your first message to this customer
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
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
        </div>
      </div>
    </div>
  );
};

export default Customer360View;
