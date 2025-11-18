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
} from "@heroicons/react/24/outline";

const ViewLoan = () => {
  const { loanId } = useParams();
  const navigate = useNavigate();
  
  const [loanDetails, setLoanDetails] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [bookedByUser, setBookedByUser] = useState(null);
  const [branchManager, setBranchManager] = useState(null);
  const [regionalManager, setRegionalManager] = useState(null);
  const [repaymentSchedule, setRepaymentSchedule] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('loanInformation');

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

      // Fetch the user who created the loan
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq('id', loanData.booked_by)
        .single();

      if (userError) {
        console.warn("Error fetching user details:", userError);
      }

      // Fetch branch manager and regional manager details if available
      if (loanData.bm_id) {
        const { data: bmData } = await supabase
          .from("users")
          .select("*")
          .eq('id', loanData.bm_id)
          .single();
        setBranchManager(bmData);
      }

      if (loanData.rm_id) {
        const { data: rmData } = await supabase
          .from("users")
          .select("*")
          .eq('id', loanData.rm_id)
          .single();
        setRegionalManager(rmData);
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
      setBookedByUser(userData || null);
      setPayments(paymentsData || []);

      // Generate repayment schedule if loan exists
      if (loanData) {
        generateRepaymentSchedule(loanData);
      }

    } catch (error) {
      console.error("Error fetching loan details:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateRepaymentSchedule = (loan) => {
    const schedule = [];
    const startDate = new Date(loan.created_at);
    const weeklyPayment = loan.weekly_payment || 0;
    const totalInterest = loan.total_interest || 0;
    const processingFee = loan.processing_fee || 0;
    const registrationFee = loan.registration_fee || 0;
    const principal = loan.scored_amount || 0;
    const duration = loan.duration_weeks || 0;

    for (let week = 1; week <= duration; week++) {
      const dueDate = new Date(startDate);
      dueDate.setDate(startDate.getDate() + (week * 7));
      
      schedule.push({
        week,
        due_date: dueDate.toISOString().split('T')[0],
        principal: week === duration ? principal : 0,
        interest: totalInterest / duration,
        processing_fee: week === 1 ? processingFee : 0,
        registration_fee: week === 1 ? registrationFee : 0,
        total: weeklyPayment
      });
    }
    
    setRepaymentSchedule(schedule);
  };

  // Calculate loan metrics based on payments
  const calculateLoanMetrics = () => {
    if (!loanDetails) return {};

    const totalPaid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
    const totalPayable = loanDetails.total_payable || 0;
    const outstandingBalance = Math.max(0, totalPayable - totalPaid);

    // Calculate next installment
    const nextInstallment = loanDetails.weekly_payment || 0;

    // Calculate charges (processing + registration fees)
    const charges = (loanDetails.processing_fee || 0) + (loanDetails.registration_fee || 0);

    // Calculate arrears and penalties (simplified - in real app, this would be more complex)
    const today = new Date();
    const loanStartDate = new Date(loanDetails.created_at);
    const expectedWeeks = Math.floor((today - loanStartDate) / (7 * 24 * 60 * 60 * 1000));
    const expectedPayments = Math.max(0, expectedWeeks - 1) * nextInstallment; // Give 1 week grace period
    const arrears = Math.max(0, expectedPayments - totalPaid);
    const penalties = arrears > 0 ? arrears * 0.1 : 0; // 10% penalty on arrears

    // Calculate next due date
    const paidInstallments = Math.floor(totalPaid / nextInstallment);
    const nextDueDate = new Date(loanStartDate);
    nextDueDate.setDate(loanStartDate.getDate() + ((paidInstallments + 1) * 7));
    
    // Calculate days until due
    const daysUntilDue = Math.ceil((nextDueDate - today) / (1000 * 60 * 60 * 24));

    // Calculate loan end date
    const loanEndDate = new Date(loanStartDate);
    loanEndDate.setDate(loanStartDate.getDate() + (loanDetails.duration_weeks * 7));

    return {
      totalPaid,
      outstandingBalance,
      nextInstallment,
      charges,
      arrears,
      penalties,
      nextDueDate: nextDueDate.toISOString().split('T')[0],
      daysUntilDue,
      loanEndDate: loanEndDate.toISOString().split('T')[0],
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
      case "disbursed":
        return <BanknotesIcon className="h-5 w-5 text-emerald-600" />;
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
      disbursed: "bg-emerald-100 text-emerald-800 border-emerald-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
    };
    return badges[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const formatStatus = (status) => {
    const statusMap = {
      "booked": "Booked",
      "bm_review": "Pending Branch Manager",
      "rm_review": "Pending Regional Manager", 
      "ca_review": "Pending Disbursement",
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
    return `KES ${(amount || 0).toLocaleString()}`;
  };

  // Section components
  const LoanInformationSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loan Details */}
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border border-emerald-200">
          <h3 className="text-xl font-bold text-gray-600 flex items-center mb-4">
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
          <h3 className="text-xl font-bold text-gray-600 flex items-center mb-4">
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
                {Math.round((loanMetrics.totalPaid / (loanDetails.total_payable || 1)) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div 
                className="bg-green-600 h-2.5 rounded-full" 
                style={{ width: `${Math.min(100, (loanMetrics.totalPaid / (loanDetails.total_payable || 1)) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      {payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4">
            <h3 className="text-xl font-bold flex items-center">
              <BanknotesIcon className="h-6 w-6 mr-3" />
              Recent Payments ({payments.length})
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
      {repaymentSchedule.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-600 to-gray-600 text-white p-4">
            <h3 className="text-xl font-bold flex items-center">
              <DocumentTextIcon className="h-6 w-6 mr-3" />
              Repayment Schedule
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Week</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Due Date</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Principal</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Interest</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Fees</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Installments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {repaymentSchedule.map((payment, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-indigo-600 font-semibold text-sm">{payment.week}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDate(payment.due_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                      {formatCurrency(payment.principal)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">
                      {formatCurrency(payment.interest)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-amber-600">
                      {formatCurrency(payment.processing_fee + payment.registration_fee)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-indigo-600">
                      {formatCurrency(payment.total)}
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

  const LoanInterestSection = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <h3 className="text-xl font-bold text-gray-600 flex items-center mb-4">
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
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
          <h3 className="text-xl font-bold text-gray-600 flex items-center mb-4">
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
          <h3 className="text-xl font-bold text-gray-600 flex items-center mb-4">
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
            <div className="flex justify-between items-center pt-2 border-t border-amber-200">
              <span className="text-gray-600 font-medium">Total Charges:</span>
              <span className="text-orange-600 font-bold">
                {formatCurrency(loanMetrics.charges)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border border-red-200">
          <h3 className="text-xl font-bold text-gray-600 flex items-center mb-4">
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
      {(loanDetails.bm_comment || loanDetails.rm_comment) && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
          <h3 className="text-xl font-bold text-gray-600 flex items-center mb-4">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-amber-600 mr-3" />
            Manager Comments
          </h3>
          <div className="space-y-4">
            {loanDetails.bm_comment && (
              <div className="bg-white rounded-lg p-4 border border-amber-200">
                <div className="text-sm font-semibold text-amber-700 mb-2">Branch Manager Comment:</div>
                <p className="text-gray-800">{loanDetails.bm_comment}</p>
              </div>
            )}
            {loanDetails.rm_comment && (
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="text-sm font-semibold text-blue-700 mb-2">Regional Manager Comment:</div>
                <p className="text-gray-800">{loanDetails.rm_comment}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
        <h3 className="text-xl font-bold text-gray-600 flex items-center mb-4">
          <CalendarIcon className="h-6 w-6 text-gray-600 mr-3" />
          Loan Timeline
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          
          {loanDetails.bm_approved_at && (
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">BM Approved</div>
              <div className="text-sm font-semibold text-green-600">
                {formatDate(loanDetails.bm_approved_at)}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(loanDetails.bm_approved_at).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          )}
          
          {loanDetails.rm_approved_at && (
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">RM Approved</div>
              <div className="text-sm font-semibold text-blue-600">
                {formatDate(loanDetails.rm_approved_at)}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(loanDetails.rm_approved_at).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          )}
          
          {loanDetails.disbursed_at && (
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1">Disbursed</div>
              <div className="text-sm font-semibold text-emerald-600">
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Loan Not Found</h2>
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
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-blue-200">
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
                <h1 className="text-xl font-bold text-gray-900">
                  Loan Details - #{loanDetails.id}
                </h1>
                <p className="text-gray-600 mt-1">
                  Complete information about this loan application
                </p>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${getStatusBadge(loanDetails.status)}`}>
              {getStatusIcon(loanDetails.status)}
              <span className="font-semibold text-lg">{formatStatus(loanDetails.status)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Customer Information */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
            <h3 className="text-xl font-bold text-gray-600 flex items-center mb-4">
              <UserIcon className="h-6 w-6 text-blue-600 mr-3" />
              Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-3">
                <div>
                  <span className="text-gray-600 font-medium block mb-1">Full Name:</span>
                  <span className="text-gray-900 font-semibold text-lg">
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
                    {loanDetails.is_new_loan ? 'New loan' : 'Returning Loan'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 font-medium block mb-1">Loan Status:</span>
                  <span className={`font-semibold ${getStatusBadge(loanDetails.status)} px-2 py-1 rounded-full text-sm`}>
                    {formatStatus(loanDetails.status)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Outstanding Balance & Next Installment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Outstanding Balance */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
              <h3 className="text-xl font-bold text-gray-600 flex items-center mb-4">
                <CurrencyDollarIcon className="h-6 w-6 text-purple-600 mr-3" />
                Outstanding Balance
              </h3>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {formatCurrency(loanMetrics.outstandingBalance)}
                </div>
                <p className="text-gray-600 text-sm">
                  Total amount remaining to be paid
                </p>
                <div className="mt-2 text-sm text-green-600">
                  Total Paid: {formatCurrency(loanMetrics.totalPaid)}
                </div>
              </div>
            </div>

            {/* Next Installment */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
              <h3 className="text-xl font-bold text-gray-600 flex items-center mb-4">
                <BanknotesIcon className="h-6 w-6 text-green-600 mr-3" />
                Next Installment
              </h3>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {formatCurrency(loanMetrics.nextInstallment)}
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Due Date:</span>
                  <span className="font-semibold">{formatDate(loanMetrics.nextDueDate)}</span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-gray-600">Days Left:</span>
                  <span className={`font-semibold ${loanMetrics.daysUntilDue <= 3 ? 'text-red-600' : 'text-green-600'}`}>
                    {loanMetrics.daysUntilDue} days
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-gray-600">Loan End Date:</span>
                  <span className="font-semibold">{formatDate(loanMetrics.loanEndDate)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Charges & Approval Team */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Charges Summary */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200">
              <h3 className="text-xl font-bold text-gray-600 flex items-center mb-4">
                <CreditCardIcon className="h-6 w-6 text-orange-600 mr-3" />
                Charges Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Total Charges:</span>
                  <span className="text-orange-600 font-semibold">
                    {formatCurrency(loanMetrics.charges)}
                  </span>
                </div>
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
              </div>
            </div>

            {/* Approval Team */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200 col-span-2">
              <h3 className="text-xl font-bold text-gray-600 flex items-center mb-4">
                <IdentificationIcon className="h-6 w-6 text-indigo-600 mr-3" />
                Approval Team
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Loan Officer */}
                <div className="bg-white rounded-lg p-4 border border-indigo-200">
                  <div className="text-sm font-semibold text-indigo-700 mb-2">Loan Officer</div>
                  {bookedByUser ? (
                    <div className="text-sm">
                      <div className="font-medium">{bookedByUser.full_name}</div>
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
                      <div className="font-medium">{branchManager.full_name}</div>
                      <div className="text-gray-500 text-xs mt-1">{formatDate(loanDetails.bm_reviewed_at)}</div>
                      {loanDetails.bm_comment && (
                        <div className="text-xs text-gray-600 mt-2">"{loanDetails.bm_comment}"</div>
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
                      <div className="font-medium">{regionalManager.full_name}</div>
                      <div className="text-gray-500 text-xs mt-1">{formatDate(loanDetails.rm_reviewed_at)}</div>
                      {loanDetails.rm_comment && (
                        <div className="text-xs text-gray-600 mt-2">"{loanDetails.rm_comment}"</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm">Pending approval</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Section Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                {sectionTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      className={`flex items-center gap-2 py-4 px-6 text-center font-medium text-sm border-b-2 transition-colors ${
                        activeSection === tab.id
                          ? 'border-blue-500 text-blue-600'
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