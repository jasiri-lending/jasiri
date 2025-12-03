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
        .select(`
          *,
          branches (name)
        `)
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
        .select(`
          *,
          branches (name),
          regions (name)
        `)
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
        let cleanedTxns = (walletTxns || []).map(txn => ({ ...txn }));

// Find the most recent credit (they always have mpesa_reference)
let lastMpesa = null;

for (let i = cleanedTxns.length - 1; i >= 0; i--) {
  if (cleanedTxns[i].transaction_type === "credit" && cleanedTxns[i].mpesa_reference) {
    lastMpesa = cleanedTxns[i].mpesa_reference;
  }

  // If debit has null mpesa_reference → inherit from most recent credit
  if (
    cleanedTxns[i].transaction_type !== "credit" &&
    !cleanedTxns[i].mpesa_reference &&
    lastMpesa
  ) {
    cleanedTxns[i].mpesa_reference = lastMpesa;
  }
}

setWalletTransactions(cleanedTxns);

      setWalletTransactions(walletTxns || []);

      // Calculate wallet balance
   // Calculate wallet balance using signed amounts
const balance = (walletTxns || []).reduce((acc, txn) => {
  const amount = parseFloat(txn.amount || 0);
  return acc + amount;  // amount already has + or -
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
      const { data: customerInteractions } = await supabase
        .from("customer_interactions")
        .select("*")
        .eq("customer_id", customerId)
        .order("interaction_date", { ascending: false })
        .limit(10);

      setInteractions(customerInteractions || []);
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
  ];

  const getInitials = () => {
    const first = customer?.Firstname?.[0] || "";
    const last = customer?.Surname?.[0] || "";
    return `${first}${last}`.toUpperCase();
  };

  const formatCurrency = (amount) => {
    return `KES ${parseFloat(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleBack = () => {
    navigate(-1); // Go back to previous page
  };

  const renderOverview = () => {
  // Calculate outstanding balance
  const outstandingBalance = loanDetails 
    ? parseFloat(loanDetails.total_payable || 0) - loanInstallments.reduce((sum, inst) => sum + parseFloat(inst.paid_amount || 0), 0)
    : 0;
  
  const totalPaidAmount = loanInstallments.reduce((sum, inst) => sum + parseFloat(inst.paid_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Customer Profile Card */}
      <div className="bg-gradient-to-br from-slate-100 via-blue-100 to-cyan-100  border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className=" from-indigo-50 to-blue-50 rounded-2xl p-8 mb-8 border border-indigo-100">
          <div className="flex items-start gap-6">
            {/* Left: Passport Photo and Basic Info */}
           <div className="flex-shrink-0">
  <div className="flex flex-col items-center">
    {customer.passport_url ? (
      <img
        src={customer.passport_url}
        alt={`${customer.Firstname} ${customer.Surname}`}
        className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
      />
    ) : (
      <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl font-bold text-white border-4 border-white shadow-lg">
        {getInitials()}
      </div>
    )}
    <h2 className="text-sm  text-slate-600 mt-3 text-center">
      {customer.prefix} {customer.Firstname} {customer.Surname}
    </h2>

    {/* Contact Information below the name */}
    <div className="mt-3 space-y-1 text-slate-600 text-center">
      <div className="flex items-center justify-center gap-2">
        <PhoneIcon className="h-4 w-4" />
        <span className="text-sm">{customer.mobile}</span>
      </div>
      {customer.alternative_mobile && (
        <div className="flex items-center justify-center gap-2">
          <PhoneIcon className="h-3 w-3" />
          <span className="text-xs">Alt: {customer.alternative_mobile}</span>
        </div>
      )}
      <div className="flex items-center justify-center gap-2">
        <IdentificationIcon className="h-4 w-4" />
        <span className="text-sm">ID: {customer.id_number}</span>
      </div>
      {customer.branches?.name && (
        <div className="flex items-center justify-center gap-2">
          <BuildingLibraryIcon className="h-4 w-4" />
          <span className="text-sm">{customer.branches.name}</span>
        </div>
      )}
    </div>

    {/* Status badges */}
    <div className="mt-3 flex flex-wrap gap-1 justify-center">
      <span
        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          customer.status === "approved"
            ? "bg-green-600 text-white border border-green-300/50"
            : customer.status === "bm_review"
            ? "bg-yellow-500 text-white border border-yellow-300"
            : customer.status === "rejected"
            ? "bg-red-500 text-white border border-red-300"
            : "bg-gray-500 text-white border border-gray-300"
        }`}
      >
        {customer.status || "Pending"}
      </span>
      {customer.hasDisbursedLoan && (
        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-900 text-white border border-blue-700">
          Active Loan
        </span>
      )}
    </div>
  </div>
</div>


            {/* Right: Financial Details */}
            <div className="flex-1">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Wallet Balance */}
                <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg p-4 text-center">
                  <WalletIcon className="h-8 w-8 text-slate-900 mx-auto mb-2" />
                  <p className="text-xs text-slate-800 uppercase tracking-wider mb-1">Wallet Balance</p>
                  <p className="text-xl  text-slate-700">{formatCurrency(walletBalance)}</p>
                </div>

                {/* Principal Amount */}
                <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg p-4 text-center">
                  <CreditCardIcon className="h-8 w-8 text-slate-900 mx-auto mb-2" />
                  <p className="text-xs text-slate-800 uppercase tracking-wider mb-1">Principal Amount</p>
                  <p className="text-xl  text-slate-700">
                    {loanDetails ? formatCurrency(loanDetails.scored_amount) : "KES 0.00"}
                  </p>
                </div>

                {/* Interest */}
                <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg p-4 text-center">
                  <ChartBarIcon className="h-8 w-8 text-slate-900 mx-auto mb-2" />
                  <p className="text-xs text-slate-800 uppercase tracking-wider mb-1">Interest</p>
                  <p className="text-xl  text-slate-700">
                    {loanDetails ? formatCurrency(loanDetails.total_interest) : "KES 0.00"}
                  </p>
                </div>

                {/* Total Payable */}
                <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg p-4 text-center">
                  <DocumentTextIcon className="h-8 w-8 text-slate-900 mx-auto mb-2" />
                  <p className="text-xs text-slate-800 uppercase tracking-wider mb-1">Total Payable</p>
                  <p className="text-xl  text-slate-700">
                    {loanDetails ? formatCurrency(loanDetails.total_payable) : "KES 0.00"}
                  </p>
                </div>

                {/* Total Paid */}
                <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg p-4 text-center">
                  <CheckCircleIcon className="h-8 w-8 text-slate-900 mx-auto mb-2" />
                  <p className="text-xs text-slate-800 uppercase tracking-wider mb-1">Total Paid</p>
                  <p className="text-xl  text-slate-700">
                    {formatCurrency(totalPaidAmount)}
                  </p>
                </div>

                {/* Outstanding Balance */}
                <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg p-4 text-center">
                  <ExclamationCircleIcon className="h-8 w-8 text-slate-900 mx-auto mb-2" />
                  <p className="text-xs text-slate-800 uppercase tracking-wider mb-1">Outstanding Balance</p>
                  <p className="text-xl  text-slate-700">
                    {formatCurrency(outstandingBalance)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-lg  text-slate-600 mb-4 flex items-center">
            <IdentificationIcon className="h-5 w-5 mr-2 text-blue-600" />
            Personal Information
          </h3>
          <div className="space-y-3">
            <div className="flex items-start">
              <PhoneIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Mobile</p>
                <p className=" text-slate-600">{customer.mobile || "N/A"}</p>
              </div>
            </div>
            {customer.alternative_mobile && (
              <div className="flex items-start">
                <PhoneIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Alternative Mobile</p>
                  <p className=" text-slate-600">{customer.alternative_mobile}</p>
                </div>
              </div>
            )}
            <div className="flex items-start">
              <IdentificationIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">ID Number</p>
                <p className=" text-slate-600">{customer.id_number || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-start">
              <CalendarIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Date of Birth</p>
                <p className=" text-slate-600">
                  {customer.date_of_birth 
                    ? new Date(customer.date_of_birth).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <UserCircleIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Gender / Marital Status</p>
                <p className=" text-slate-600">
                  {customer.gender || "N/A"} / {customer.marital_status || "N/A"}
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <BriefcaseIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Occupation</p>
                <p className=" text-slate-600">{customer.occupation || "N/A"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <MapPinIcon className="h-5 w-5 mr-2 text-blue-600" />
            Address & Location
          </h3>
          <div className="space-y-3">
            <div className="flex items-start">
              <HomeIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Residence Status</p>
                <p className="font-medium text-gray-900">{customer.residence_status || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-start">
              <MapPinIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">County / Town</p>
                <p className="font-medium text-gray-900">
                  {customer.county || "N/A"} / {customer.town || "N/A"}
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <MapPinIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Road / Landmark</p>
                <p className="font-medium text-gray-900">
                  {customer.road || "N/A"} / {customer.landmark || "N/A"}
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Postal Address</p>
                <p className="font-medium text-gray-900">
                  {customer.postal_address || "N/A"} - {customer.code || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Business Information */}
      {customer.business_name && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-lg  text-slate-600 mb-4 flex items-center">
            <BriefcaseIcon className="h-5 w-5 mr-2 text-blue-600" />
            Business Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Business Name</p>
              <p className=" text-slate-600">{customer.business_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Business Type</p>
              <p className=" text-slate-600">{customer.business_type || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Location</p>
              <p className=" text-slate-600">{customer.business_location || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Daily Sales</p>
              <p className=" text-slate-600">
                {customer.daily_Sales ? formatCurrency(customer.daily_Sales) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Year Established</p>
              <p className=" text-slate-900">
                {customer.year_established 
                  ? new Date(customer.year_established).getFullYear()
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Local Authority License</p>
              <p className=" text-slate-900">
                {customer.has_local_authority_license ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Account Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-lg  text-slate-600 mb-4 flex items-center">
          <BuildingLibraryIcon className="h-5 w-5 mr-2 text-blue-600" />
          Account Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Branch</p>
            <p className=" text-slate-900">{customer.branches?.name || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Customer Since</p>
            <p className=" text-gray-900">
              {customer.created_at
                ? new Date(customer.created_at).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Customer Type</p>
            <p className=" text-slate-900">
              {customer.is_new_customer ? "New Customer" : "Returning Customer"}
            </p>
          </div>

         
       
        
        </div>
      </div>

   
    </div>
  );
};


  const renderLoanDetails = () => (
    <div className="space-y-6">
      {loanDetails ? (
        <>
          <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg p-6 text-slate-600">
            <h3 className="text-xl font-semibold mb-2">Current Loan - {loanDetails.product_name || loanDetails.product}</h3>
            <p className="text-4xl font-bold">
              {formatCurrency(loanDetails.scored_amount)}
            </p>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-slate-500 text-sm">Status</p>
                <p className="font-semibold capitalize">{loanDetails.status}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">Repayment State</p>
                <p className="font-semibold capitalize">{loanDetails.repayment_state || "N/A"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">Duration</p>
                <p className="font-semibold">{loanDetails.duration_weeks} weeks</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">Product Type</p>
                <p className="font-semibold capitalize">{loanDetails.product_type || "N/A"}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h4 className="font-semibold text-gray-900 mb-4">Loan Details</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Scored Amount</span>
                  <span className="font-medium">{formatCurrency(loanDetails.scored_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Interest Rate</span>
                  <span className="font-medium">{loanDetails.interest_rate || "0"}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Interest</span>
                  <span className="font-medium">{formatCurrency(loanDetails.total_interest)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Processing Fee</span>
                  <span className="font-medium">{formatCurrency(loanDetails.processing_fee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Registration Fee</span>
                  <span className="font-medium">{formatCurrency(loanDetails.registration_fee)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-900 font-semibold">Weekly Payment</span>
                  <span className="font-bold text-indigo-600">{formatCurrency(loanDetails.weekly_payment)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h4 className="font-semibold text-gray-900 mb-4">Loan Timeline</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Booked At</span>
                  <span className="font-medium">
                    {loanDetails.booked_at
                      ? new Date(loanDetails.booked_at).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Approved By BM</span>
                  <span className="font-medium">
                    {loanDetails.bm_reviewed_at
                      ? new Date(loanDetails.bm_reviewed_at).toLocaleDateString()
                      : "Pending"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Approved By RM</span>
                  <span className="font-medium">
                    {loanDetails.rm_reviewed_at
                      ? new Date(loanDetails.rm_reviewed_at).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Disbursed At</span>
                  <span className="font-medium">
                    {loanDetails.disbursed_at
                      ? new Date(loanDetails.disbursed_at).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Processing Fee Paid</span>
                  <span className={`font-medium ${loanDetails.processing_fee_paid ? 'text-green-600' : 'text-red-600'}`}>
                    {loanDetails.processing_fee_paid ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Registration Fee Paid</span>
                  <span className={`font-medium ${loanDetails.registration_fee_paid ? 'text-green-600' : 'text-red-600'}`}>
                    {loanDetails.registration_fee_paid ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Loan Installments */}
          {loanInstallments.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h4 className="font-semibold text-gray-900 mb-4">Installment Schedule</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Overdue</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loanInstallments.map((installment) => (
                      <tr key={installment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{installment.installment_number}</td>
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
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            installment.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : installment.status === 'partial'
                              ? 'bg-yellow-100 text-yellow-800'
                              : installment.status === 'overdue'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {installment.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {installment.days_overdue > 0 ? (
                            <span className="text-red-600 font-medium">{installment.days_overdue} days</span>
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
                      {payment.payment_method?.replace('_', ' ') || "N/A"}
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
        <h3 className="text-xl font-semibold mb-2">Wallet Balance</h3>
        <p className="text-4xl font-bold">{formatCurrency(walletBalance)}</p>
        <p className="text-green-100 mt-2">Available for transactions</p>
      </div>

      {/* Wallet Transactions */}
   <table className="min-w-full divide-y divide-gray-200">
  <thead className="bg-gray-50">
    <tr>
      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MPESA Ref</th>
      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
    </tr>
  </thead>

  <tbody className="bg-white divide-y divide-gray-200">
    {walletTransactions.map((txn, index) => (
      <tr key={index} className="hover:bg-gray-50">
        <td className="px-4 py-3 text-sm text-gray-900">
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
        <h4 className="font-semibold text-blue-900 mb-2">M-Pesa C2B Transactions</h4>
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
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        txn.status === 'applied'
                          ? 'bg-green-100 text-green-800'
                          : txn.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
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
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      interaction.interaction_type === 'call'
                        ? 'bg-blue-100 text-blue-800'
                        : interaction.interaction_type === 'visit'
                        ? 'bg-green-100 text-green-800'
                        : interaction.interaction_type === 'email'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {interaction.interaction_type || "Interaction"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(interaction.interaction_date).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 font-medium mb-1">
                    {interaction.subject || "No subject"}
                  </p>
                  <p className="text-sm text-gray-600">{interaction.notes || "No notes"}</p>
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
    <div className="p-4">
      {/* Header with Back Button */}
      <div className="mb-2">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Back to Customers
        </button>
        
      
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-1 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div>
        {activeTab === "overview" && renderOverview()}
        {activeTab === "loan" && renderLoanDetails()}
        {activeTab === "repayments" && renderRepaymentHistory()}
        {activeTab === "wallet" && renderWallet()}
        {activeTab === "statements" && renderStatements()}
        {activeTab === "interactions" && renderInteractions()}
      </div>
    </div>
  );
};

export default Customer360View;