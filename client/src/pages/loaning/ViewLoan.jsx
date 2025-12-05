// src/pages/ViewLoanPage.jsx
import { useState, useEffect } from 'react';
import { supabase } from "../../supabaseClient";
import { useParams, useNavigate } from 'react-router-dom';
import {
  UserIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  DocumentTextIcon,
  ClockIcon,
  BanknotesIcon,
  ArrowLeftIcon,
  PhoneIcon,
  IdentificationIcon,
  XCircleIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  CreditCardIcon,
  ReceiptPercentIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  DocumentChartBarIcon,
  CheckCircleIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";

const ViewLoan = () => {
  const { loanId } = useParams();
  const navigate = useNavigate();
  
  const [loanDetails, setLoanDetails] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [bookedByUser, setBookedByUser] = useState(null);
  const [branchManager, setBranchManager] = useState(null);
  const [regionalManager, setRegionalManager] = useState(null);
  const [disbursedByUser, setDisbursedByUser] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('loanInformation');
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    if (loanId) {
      fetchLoanDetails();
    }
  }, [loanId]);

  const fetchLoanDetails = async () => {
    try {
      // Fetch loan with customer and branch details
      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select(`
          *,
          customers (
            Firstname,
            Surname,
            mobile,
            id_number,
            branch_id,
            created_at,
            branches (
              id,
              name,
              region_id,
              regions (
                id,
                name
              )
            )
          )
        `)
        .eq('id', loanId)
        .single();

      if (loanError) throw loanError;

      // Fetch loan installments to calculate actual payments
      const { data: installmentsData, error: installmentsError } = await supabase
        .from("loan_installments")
        .select("*")
        .eq('loan_id', loanId)
        .order('installment_number', { ascending: true });

      if (installmentsError) {
        console.warn("Error fetching installments:", installmentsError);
      }

      // Fetch user details
      const usersToFetch = [];
      const userIds = new Set();

      if (loanData.booked_by) userIds.add(loanData.booked_by);
      if (loanData.bm_id) userIds.add(loanData.bm_id);
      if (loanData.rm_id) userIds.add(loanData.rm_id);
      if (loanData.disbursed_by) userIds.add(loanData.disbursed_by);

      const usersData = {};
      
      // Fetch all users in one go if possible
      for (const userId of userIds) {
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq('id', userId)
          .single();
        
        if (userData) {
          usersData[userId] = userData;
        }
      }

      // Set user states
      if (loanData.booked_by && usersData[loanData.booked_by]) {
        setBookedByUser(usersData[loanData.booked_by]);
      }
      if (loanData.bm_id && usersData[loanData.bm_id]) {
        setBranchManager(usersData[loanData.bm_id]);
      }
      if (loanData.rm_id && usersData[loanData.rm_id]) {
        setRegionalManager(usersData[loanData.rm_id]);
      }
      if (loanData.disbursed_by && usersData[loanData.disbursed_by]) {
        setDisbursedByUser(usersData[loanData.disbursed_by]);
      }

      // Fetch payments from mpesa_c2b_transactions
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("mpesa_c2b_transactions")
        .select("*")
        .eq('loan_id', loanId)
        .eq('status', 'applied')
        .order('transaction_time', { ascending: true });

      if (paymentsError) {
        console.warn("Error fetching payments:", paymentsError);
      }

      setLoanDetails(loanData);
      setCustomer(loanData.customers);
      setInstallments(installmentsData || []);
      setPayments(paymentsData || []);

    } catch (error) {
      console.error("Error fetching loan details:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total paid from installments (interest_paid + principal_paid)
  const calculateTotalPaid = () => {
    if (!installments || installments.length === 0) return 0;
    
    return installments.reduce((total, installment) => {
      const interestPaid = parseFloat(installment.interest_paid || 0);
      const principalPaid = parseFloat(installment.principal_paid || 0);
      return total + interestPaid + principalPaid;
    }, 0);
  };

  // Calculate loan metrics based on installments and loan details
  const calculateLoanMetrics = () => {
    if (!loanDetails) return {};

    const totalPaid = calculateTotalPaid();
    const totalPayable = parseFloat(loanDetails.total_payable || 0);
    const outstandingBalance = Math.max(0, totalPayable - totalPaid);
    const weeklyPayment = parseFloat(loanDetails.weekly_payment || 0);
    const principalAmount = parseFloat(loanDetails.scored_amount || 0);
    const totalInterest = parseFloat(loanDetails.total_interest || 0);

    // Calculate charges
    const processingFee = parseFloat(loanDetails.processing_fee || 0);
    const registrationFee = parseFloat(loanDetails.registration_fee || 0);
    const totalCharges = processingFee + registrationFee;

    // Calculate progress
    const progressPercentage = totalPayable > 0 ? (totalPaid / totalPayable) * 100 : 0;

    // Find overdue installments
    const today = new Date();
    const overdueInstallments = installments.filter(installment => {
      if (!installment.due_date || installment.status === 'paid') return false;
      const dueDate = new Date(installment.due_date);
      return dueDate < today && (installment.principal_paid || 0) + (installment.interest_paid || 0) < installment.due_amount;
    });

    // Calculate arrears
    let arrears = 0;
    overdueInstallments.forEach(installment => {
      const dueAmount = parseFloat(installment.due_amount || 0);
      const paidAmount = parseFloat(installment.principal_paid || 0) + parseFloat(installment.interest_paid || 0);
      arrears += Math.max(0, dueAmount - paidAmount);
    });

    // Calculate penalties (10% of arrears)
    const penalties = arrears * 0.1;

    // Calculate next due date from pending installments
    const pendingInstallments = installments.filter(i => 
      i.status === 'pending' || i.status === 'partial' || i.status === 'overdue'
    ).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

    const nextDueDate = pendingInstallments.length > 0 
      ? new Date(pendingInstallments[0].due_date)
      : null;

    const daysUntilDue = nextDueDate 
      ? Math.ceil((nextDueDate - today) / (1000 * 60 * 60 * 24))
      : null;

    // Calculate loan end date
    const loanStartDate = new Date(loanDetails.created_at);
    const loanEndDate = new Date(loanStartDate);
    loanEndDate.setDate(loanStartDate.getDate() + (loanDetails.duration_weeks * 7));

    return {
      totalPaid,
      outstandingBalance,
      nextInstallment: weeklyPayment,
      totalCharges,
      arrears,
      penalties,
      progressPercentage,
      overdueInstallments: overdueInstallments.length,
      pendingInstallments: pendingInstallments.length,
      nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
      daysUntilDue,
      loanEndDate: loanEndDate.toISOString().split('T')[0],
      principalAmount,
      totalInterest,
    };
  };

  const loanMetrics = calculateLoanMetrics();

  const getStatusIcon = (status) => {
    switch (status) {
      case "booked":
        return <ClockIcon className="h-5 w-5 text-amber-600" />;
      case "bm_review":
        return <ClockIcon className="h-5 w-5 text-orange-600" />;
      case "rm_review":
        return <ClockIcon className="h-5 w-5 text-blue-600" />;
      case "ca_review":
        return <ClockIcon className="h-5 w-5 text-purple-600" />;
      case "ready_for_disbursement":
        return <ClockIcon className="h-5 w-5 text-green-600" />;
      case "disbursed":
        return <CheckCircleIcon className="h-5 w-5 text-emerald-600" />;
      case "rejected":
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      booked: "bg-amber-100 text-amber-800 border-amber-200",
      bm_review: "bg-orange-100 text-orange-800 border-orange-200",
      rm_review: "bg-blue-100 text-blue-800 border-blue-200",
      ca_review: "bg-purple-100 text-purple-800 border-purple-200",
      ready_for_disbursement: "bg-green-100 text-green-800 border-green-200",
      disbursed: "bg-emerald-100 text-emerald-800 border-emerald-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
    };
    return badges[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getInstallmentStatusBadge = (status) => {
    const badges = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      partial: "bg-blue-100 text-blue-800 border-blue-200",
      paid: "bg-green-100 text-green-800 border-green-200",
      overdue: "bg-red-100 text-red-800 border-red-200",
      defaulted: "bg-red-100 text-red-800 border-red-200",
    };
    return badges[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const formatStatus = (status) => {
    const statusMap = {
      "booked": "Booked",
      "bm_review": "Pending Branch Manager",
      "rm_review": "Pending Regional Manager", 
      "ca_review": "Pending Credit Analysis",
      "ready_for_disbursement": "Ready for Disbursement",
      "disbursed": "Disbursed",
      "rejected": "Rejected",
    };
    return statusMap[status] || status;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const formatCurrency = (amount) => {
    return `KES ${parseFloat(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Section components
  const LoanInformationSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loan Details */}
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border border-emerald-200">
          <h3 className="text-lg font-semibold text-gray-600 flex items-center mb-4">
            <CurrencyDollarIcon className="h-6 w-6 text-emerald-600 mr-3" />
            Loan Details 
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Product:</span>
              <span className="text-purple-600 font-semibold">
                {loanDetails.product_name || loanDetails.product}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Principal Amount:</span>
              <span className="text-emerald-600 font-bold text-lg">
                {formatCurrency(loanDetails.scored_amount)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Duration:</span>
              <span className="text-gray-900 font-semibold">
                {loanDetails.duration_weeks} weeks
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Processing Fee:</span>
              <span className="text-gray-900 font-semibold">
                {formatCurrency(loanDetails.processing_fee)}
              </span>
            </div>
            {loanDetails.registration_fee > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Registration Fee:</span>
                <span className="text-gray-900 font-semibold">
                  {formatCurrency(loanDetails.registration_fee)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
              <span className="text-gray-600 font-medium">Total Payable:</span>
              <span className="text-emerald-600 font-bold text-lg">
                {formatCurrency(loanDetails.total_payable)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Weekly Payment:</span>
              <span className="text-indigo-600 font-bold">
                {formatCurrency(loanDetails.weekly_payment)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-gray-600 flex items-center mb-4">
            <BanknotesIcon className="h-6 w-6 text-blue-600 mr-3" />
            Payment Summary
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Total Paid:</span>
              <span className="text-green-600 font-bold text-lg">
                {formatCurrency(loanMetrics.totalPaid)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Outstanding Balance:</span>
              <span className="text-red-600 font-bold text-lg">
                {formatCurrency(loanMetrics.outstandingBalance)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Progress:</span>
              <span className="text-gray-900 font-semibold">
                {Math.round(loanMetrics.progressPercentage)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div 
                className="bg-green-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(100, loanMetrics.progressPercentage)}%` }}
              ></div>
            </div>
            {loanMetrics.overdueInstallments > 0 && (
              <div className="flex justify-between items-center pt-2 border-t border-red-200">
                <span className="text-red-600 font-medium">Overdue Installments:</span>
                <span className="text-red-600 font-bold">
                  {loanMetrics.overdueInstallments}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      {payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4">
            <h3 className="text-xl font-bold flex items-center">
              <BanknotesIcon className="h-6 w-6 mr-3" />
              Recent Transactions ({payments.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Transaction ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Phone Number</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.slice(-10).reverse().map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDate(payment.transaction_time)}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-blue-600">
                      {payment.transaction_id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {payment.phone_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-green-600">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        payment.payment_type === 'repayment' 
                          ? 'bg-green-100 text-green-800'
                          : payment.payment_type === 'processing'
                          ? 'bg-blue-100 text-blue-800'
                          : payment.payment_type === 'registration'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {payment.payment_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        payment.status === 'applied'
                          ? 'bg-green-100 text-green-800'
                          : payment.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {payment.status}
                      </span>
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

  const LoanScheduleSection = () => (
    <div className="space-y-6">
      {installments.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4">
            <h3 className="text-xl font-bold flex items-center">
              <DocumentTextIcon className="h-6 w-6 mr-3" />
              Repayment Schedule ({installments.length} installments)
            </h3>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Paid: {installments.filter(i => i.status === 'paid').length}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>Pending: {installments.filter(i => i.status === 'pending').length}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Overdue: {installments.filter(i => i.status === 'overdue').length}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Partial: {installments.filter(i => i.status === 'partial').length}</span>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">#</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Due Date</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Due Amount</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Principal Due</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Interest Due</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Paid Amount</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {installments.map((installment) => {
                  const paidAmount = (parseFloat(installment.principal_paid || 0) + parseFloat(installment.interest_paid || 0));
                  const isOverdue = new Date(installment.due_date) < new Date() && installment.status !== 'paid';
                  
                  return (
                    <tr key={installment.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            installment.status === 'paid' ? 'bg-green-100' :
                            installment.status === 'overdue' ? 'bg-red-100' :
                            installment.status === 'partial' ? 'bg-blue-100' :
                            'bg-gray-100'
                          }`}>
                            <span className={`font-semibold text-sm ${
                              installment.status === 'paid' ? 'text-green-600' :
                              installment.status === 'overdue' ? 'text-red-600' :
                              installment.status === 'partial' ? 'text-blue-600' :
                              'text-gray-600'
                            }`}>
                              {installment.installment_number}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="text-gray-900">{formatDate(installment.due_date)}</div>
                        {installment.paid_date && (
                          <div className="text-xs text-green-600">Paid: {formatDate(installment.paid_date)}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                        {formatCurrency(installment.due_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-purple-600">
                        {formatCurrency(installment.principal_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">
                        {formatCurrency(installment.interest_amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        <div className={`font-semibold ${paidAmount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {formatCurrency(paidAmount)}
                        </div>
                        {paidAmount > 0 && (
                          <div className="text-xs text-gray-500">
                            Principal: {formatCurrency(installment.principal_paid)} | 
                            Interest: {formatCurrency(installment.interest_paid)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getInstallmentStatusBadge(installment.status)}`}>
                          {installment.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Installments Found</h3>
          <p className="text-gray-600">Installments will be generated once the loan is disbursed.</p>
        </div>
      )}
    </div>
  );

  const LoanInterestSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-gray-600 flex items-center mb-4">
            <ChartBarIcon className="h-6 w-6 text-blue-600 mr-3" />
            Interest Breakdown
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Total Interest:</span>
              <span className="text-blue-600 font-bold text-lg">
                {formatCurrency(loanDetails.total_interest)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Weekly Interest:</span>
              <span className="text-gray-900 font-semibold">
                {formatCurrency((loanDetails.total_interest || 0) / (loanDetails.duration_weeks || 1))}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Interest Rate:</span>
              <span className="text-gray-900 font-semibold">
                {loanDetails.interest_rate || 'N/A'}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Interest Paid:</span>
              <span className="text-green-600 font-semibold">
                {formatCurrency(installments.reduce((sum, i) => sum + parseFloat(i.interest_paid || 0), 0))}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
          <h3 className="text-lg font-semibold text-gray-600 flex items-center mb-4">
            <ReceiptPercentIcon className="h-6 w-6 text-green-600 mr-3" />
            Payment Summary
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Principal Amount:</span>
              <span className="text-gray-900 font-semibold">
                {formatCurrency(loanDetails.scored_amount)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Total Interest:</span>
              <span className="text-blue-600 font-semibold">
                {formatCurrency(loanDetails.total_interest)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Principal Paid:</span>
              <span className="text-emerald-600 font-semibold">
                {formatCurrency(installments.reduce((sum, i) => sum + parseFloat(i.principal_paid || 0), 0))}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-green-200">
              <span className="text-gray-600 font-medium">Total Payable:</span>
              <span className="text-green-600 font-bold text-lg">
                {formatCurrency(loanDetails.total_payable)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ChargesPenaltiesSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
          <h3 className="text-lg font-semibold text-gray-600 flex items-center mb-4">
            <CreditCardIcon className="h-6 w-6 text-amber-600 mr-3" />
            Charges & Fees
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Processing Fee:</span>
              <span className="text-amber-600 font-semibold">
                {formatCurrency(loanDetails.processing_fee)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Registration Fee:</span>
              <span className="text-amber-600 font-semibold">
                {formatCurrency(loanDetails.registration_fee)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Processing Fee Paid:</span>
              <span className={`font-semibold ${loanDetails.processing_fee_paid ? 'text-green-600' : 'text-red-600'}`}>
                {loanDetails.processing_fee_paid ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Registration Fee Paid:</span>
              <span className={`font-semibold ${loanDetails.registration_fee_paid ? 'text-green-600' : 'text-red-600'}`}>
                {loanDetails.registration_fee_paid ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-amber-200">
              <span className="text-gray-600 font-medium">Total Charges:</span>
              <span className="text-orange-600 font-bold">
                {formatCurrency(loanMetrics.totalCharges)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border border-red-200">
          <h3 className="text-lg font-semibold text-gray-600 flex items-center mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mr-3" />
            Arrears & Penalties
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Arrears:</span>
              <span className="text-red-600 font-semibold">
                {formatCurrency(loanMetrics.arrears)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Penalties:</span>
              <span className="text-red-600 font-semibold">
                {formatCurrency(loanMetrics.penalties)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Overdue Installments:</span>
              <span className="text-red-600 font-semibold">
                {loanMetrics.overdueInstallments}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Days Overdue:</span>
              <span className="text-red-600 font-semibold">
                {installments.reduce((sum, i) => sum + (i.days_overdue || 0), 0)} days
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-red-200">
              <span className="text-gray-600 font-medium">Total Due:</span>
              <span className="text-red-600 font-bold">
                {formatCurrency(loanMetrics.arrears + loanMetrics.penalties)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const NotesSection = () => (
    <div className="space-y-6">
      {/* Manager Comments */}
      {(loanDetails.bm_comment || loanDetails.rm_comment || loanDetails.disbursement_notes) && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
          <h3 className="text-lg font-semibold text-gray-600 flex items-center mb-4">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-amber-600 mr-3" />
            Manager Comments & Notes
          </h3>
          <div className="space-y-4">
            {loanDetails.bm_comment && (
              <div className="bg-white rounded-lg p-4 border border-amber-200">
                <div className="text-sm font-semibold text-amber-700 mb-2 flex items-center">
                  <UserGroupIcon className="h-4 w-4 mr-2" />
                  Branch Manager Comment:
                </div>
                <p className="text-gray-800">{loanDetails.bm_comment}</p>
              </div>
            )}
            {loanDetails.rm_comment && (
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="text-sm font-semibold text-blue-700 mb-2 flex items-center">
                  <UserGroupIcon className="h-4 w-4 mr-2" />
                  Regional Manager Comment:
                </div>
                <p className="text-gray-800">{loanDetails.rm_comment}</p>
              </div>
            )}
            {loanDetails.disbursement_notes && (
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <div className="text-sm font-semibold text-green-700 mb-2 flex items-center">
                  <BanknotesIcon className="h-4 w-4 mr-2" />
                  Disbursement Notes:
                </div>
                <p className="text-gray-800">{loanDetails.disbursement_notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-600 flex items-center mb-4">
          <CalendarIcon className="h-6 w-6 text-gray-600 mr-3" />
          Loan Timeline
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">Created</div>
            <div className="text-sm font-semibold text-gray-900">
              {formatDate(loanDetails.created_at)}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(loanDetails.created_at).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
          
          {loanDetails.bm_reviewed_at && (
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">BM Reviewed</div>
              <div className="text-sm font-semibold text-green-600">
                {formatDate(loanDetails.bm_reviewed_at)}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(loanDetails.bm_reviewed_at).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          )}
          
          {loanDetails.rm_reviewed_at && (
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">RM Reviewed</div>
              <div className="text-sm font-semibold text-blue-600">
                {formatDate(loanDetails.rm_reviewed_at)}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(loanDetails.rm_reviewed_at).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          )}
          
          {loanDetails.approved_by_rm_at && (
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">RM Approved</div>
              <div className="text-sm font-semibold text-emerald-600">
                {formatDate(loanDetails.approved_by_rm_at)}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(loanDetails.approved_by_rm_at).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          )}
          
          {loanDetails.disbursed_at && (
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">Disbursed</div>
              <div className="text-sm font-semibold text-indigo-600">
                {formatDate(loanDetails.disbursed_at)}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(loanDetails.disbursed_at).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Navigation tabs for sections
  const sectionTabs = [
    { id: 'loanInformation', name: 'Loan Information', icon: DocumentTextIcon },
    { id: 'loanSchedule', name: 'Loan Schedule', icon: ClipboardDocumentListIcon },
    { id: 'loanInterest', name: 'Loan Interest', icon: ChartBarIcon },
    { id: 'chargesPenalties', name: 'Charges & Penalties', icon: ReceiptPercentIcon },
    { id: 'notes', name: 'Notes', icon: DocumentChartBarIcon },
  ];

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'loanInformation':
        return <LoanInformationSection />;
      case 'loanSchedule':
        return <LoanScheduleSection />;
      case 'loanInterest':
        return <LoanInterestSection />;
      case 'chargesPenalties':
        return <ChargesPenaltiesSection />;
      case 'notes':
        return <NotesSection />;
      default:
        return <LoanInformationSection />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading loan details...</p>
        </div>
      </div>
    );
  }

  if (!loanDetails || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <XCircleIcon className="h-16 w-16 text-red-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Loan Not Found</h2>
          <p className="text-gray-600 mb-4">Unable to load loan details.</p>
          <button
            onClick={() => navigate('/loans')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Loans
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Go back"
              >
                <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Loan Details - #{loanDetails.id}
                </h1>
                <p className="text-gray-600 mt-1">
                  Complete information about this loan application
                </p>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${getStatusBadge(loanDetails.status)}`}>
              {getStatusIcon(loanDetails.status)}
              <span className="font-semibold">{formatStatus(loanDetails.status)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Customer Information */}
          <div className="bg-white rounded-xl p-6 border border-blue-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-600 flex items-center mb-4">
              <UserIcon className="h-6 w-6 text-blue-600 mr-3" />
              Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-3">
                <div>
                  <span className="text-gray-600 font-medium block mb-1">Full Name:</span>
                  <span className="text-gray-900 text-lg font-semibold">
                    {customer.Firstname} {customer.Surname}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 font-medium block mb-1">ID Number:</span>
                  <span className="text-blue-600 font-mono font-semibold">
                    {customer.id_number || 'N/A'}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <span className="text-gray-600 font-medium block mb-1 flex items-center">
                    <PhoneIcon className="h-4 w-4 mr-1" />
                    Mobile:
                  </span>
                  <span className="text-gray-900 font-semibold">
                    {customer.mobile}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 font-medium block mb-1">Customer Since:</span>
                  <span className="text-gray-900 font-semibold">
                    {formatDate(customer.created_at)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-gray-600 font-medium block mb-1">Branch:</span>
                  <span className="text-gray-900 font-semibold">
                    {customer.branches?.name || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 font-medium block mb-1">Region:</span>
                  <span className="text-gray-900 font-semibold">
                    {customer.branches?.regions?.name || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-gray-600 font-medium block mb-1">Loan Type:</span>
                  <span className={`font-semibold text-lg ${loanDetails.is_new_loan ? 'text-green-600' : 'text-blue-600'}`}>
                    {loanDetails.is_new_loan ? 'New Loan' : 'Returning Loan'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 font-medium block mb-1">Repayment State:</span>
                  <span className={`font-semibold px-2 py-1 rounded-full text-sm ${
                    loanDetails.repayment_state === 'completed' ? 'bg-green-100 text-green-800' :
                    loanDetails.repayment_state === 'overdue' ? 'bg-red-100 text-red-800' :
                    loanDetails.repayment_state === 'partial' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {loanDetails.repayment_state || 'ongoing'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Outstanding Balance & Next Installment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Outstanding Balance */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-600 flex items-center mb-4">
                <CurrencyDollarIcon className="h-6 w-6 text-purple-600 mr-3" />
                Outstanding Balance
              </h3>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 mb-2">
                  {formatCurrency(loanMetrics.outstandingBalance)}
                </div>
                <p className="text-gray-600 text-sm">
                  Total amount remaining to be paid
                </p>
                <div className="mt-2 flex justify-center items-center gap-4">
                  <div className="text-sm text-green-600">
                    <ArrowTrendingUpIcon className="h-4 w-4 inline mr-1" />
                    Total Paid: {formatCurrency(loanMetrics.totalPaid)}
                  </div>
                  <div className="text-sm text-gray-600">
                    | Progress: {Math.round(loanMetrics.progressPercentage)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Next Installment */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-600 flex items-center mb-4">
                <BanknotesIcon className="h-6 w-6 text-green-600 mr-3" />
                Next Installment
              </h3>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-2">
                  {formatCurrency(loanMetrics.nextInstallment)}
                </div>
                <div className="space-y-2">
                  {loanMetrics.nextDueDate ? (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Due Date:</span>
                        <span className="font-semibold">{formatDate(loanMetrics.nextDueDate)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Days Left:</span>
                        <span className={`font-semibold ${loanMetrics.daysUntilDue <= 3 ? 'text-red-600' : 'text-green-600'}`}>
                          {loanMetrics.daysUntilDue} days
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-600">
                      All installments are completed
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Loan End Date:</span>
                    <span className="font-semibold">{formatDate(loanMetrics.loanEndDate)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Approval Team with Disbursed By */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-600 flex items-center mb-4">
              <IdentificationIcon className="h-6 w-6 text-indigo-600 mr-3" />
              Approval Team
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Loan Officer */}
              <div className="bg-white rounded-lg p-4 border border-indigo-200">
                <div className="text-sm font-semibold text-indigo-700 mb-2">Loan Officer</div>
                {bookedByUser ? (
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{bookedByUser.full_name}</div>
                    <div className="text-gray-500 text-xs mt-1">{formatDate(loanDetails.created_at)}</div>
                    <div className="text-xs text-gray-600 mt-2">Booked the loan</div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">Not available</div>
                )}
              </div>

              {/* Branch Manager */}
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <div className="text-sm font-semibold text-green-700 mb-2">Branch Manager</div>
                {branchManager ? (
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{branchManager.full_name}</div>
                    <div className="text-gray-500 text-xs mt-1">{formatDate(loanDetails.bm_reviewed_at)}</div>
                    {loanDetails.bm_decision && (
                      <div className={`text-xs mt-1 ${loanDetails.bm_decision === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                        Decision: {loanDetails.bm_decision}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">Pending approval</div>
                )}
              </div>

              {/* Regional Manager */}
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="text-sm font-semibold text-blue-700 mb-2">Regional Manager</div>
                {regionalManager ? (
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{regionalManager.full_name}</div>
                    <div className="text-gray-500 text-xs mt-1">{formatDate(loanDetails.rm_reviewed_at)}</div>
                    {loanDetails.rm_decision && (
                      <div className={`text-xs mt-1 ${loanDetails.rm_decision === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                        Decision: {loanDetails.rm_decision}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">Pending approval</div>
                )}
              </div>

              {/* Disbursed By */}
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="text-sm font-semibold text-purple-700 mb-2">Disbursed By</div>
                {disbursedByUser ? (
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{disbursedByUser.full_name}</div>
                    <div className="text-gray-500 text-xs mt-1">{formatDate(loanDetails.disbursed_at)}</div>
                    {loanDetails.is_mock_disbursement && (
                      <div className="text-xs text-amber-600 mt-1">Mock Disbursement</div>
                    )}
                  </div>
                ) : loanDetails.status === 'disbursed' ? (
                  <div className="text-gray-500 text-sm">Not recorded</div>
                ) : (
                  <div className="text-gray-500 text-sm">Not disbursed yet</div>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Section Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200 bg-gray-50">
              <nav className="flex -mb-px">
                {sectionTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      className={`flex items-center gap-2 py-4 px-6 text-center font-medium text-sm border-b-2 transition-colors ${
                        activeSection === tab.id
                          ? 'border-blue-500 text-blue-600 bg-white'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      onClick={() => setActiveSection(tab.id)}
                    >
                      <Icon className="h-5 w-5" />
                      {tab.name}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {renderActiveSection()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewLoan;