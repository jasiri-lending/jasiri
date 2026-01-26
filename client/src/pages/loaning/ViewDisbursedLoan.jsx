import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { usePermissions } from "../../hooks/usePermissions";
import {
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  DocumentTextIcon,
  IdentificationIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  ArrowLeftIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import PromiseToPayForm from "../ptp/PromiseToPayForm";

const ViewDisbursedLoan = () => {
  const { loanId } = useParams();
  const { profile } = useAuth();
  const { hasPermission, loading: permsLoading } = usePermissions();
  const navigate = useNavigate();

  const [loanDetails, setLoanDetails] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [repaymentSchedule, setRepaymentSchedule] = useState([]);
  const [approvalTrail, setApprovalTrail] = useState([]);
  const [repaymentHistory, setRepaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPTPForm, setShowPTPForm] = useState(false);

  useEffect(() => {
    if (loanId) {
      fetchLoanFullDetails(loanId);
    }
  }, [loanId]);

  const fetchLoanFullDetails = async (loanId) => {
    try {
      setLoading(true);

      // Fetch loan with customer details
      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select(`
          *,
          customers (
            *,
            branches (
              id,
              name,
              region_id
            )
          )
        `)
        .eq('id', loanId)
        .single();

      if (loanError) throw loanError;

      // Fetch users involved in approval trail
      const userIds = [
        loanData.booked_by,
        loanData.bm_id,
        loanData.rm_id,
        loanData.ca_id
      ].filter(id => id);

      let usersData = {};
      if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("*")
          .in('id', userIds);

        if (!usersError && users) {
          users.forEach(user => {
            usersData[user.id] = user;
          });
        }
      }

      // Fetch repayment history
      const { data: repayments, error: repaymentError } = await supabase
        .from("repayments")
        .select("*")
        .eq('loan_id', loanId)
        .order('due_date', { ascending: true });

      if (!repaymentError) {
        setRepaymentHistory(repayments || []);
      }

      setLoanDetails(loanData);
      setCustomer(loanData.customers);

      // Build approval trail
      const trail = [];

      if (loanData.booked_by && usersData[loanData.booked_by]) {
        trail.push({
          role: 'Relationship Officer',
          name: usersData[loanData.booked_by].full_name,
          branch: usersData[loanData.booked_by].branch || 'N/A',
          action: 'Booked Loan',
          timestamp: loanData.created_at,
          comment: 'Loan application submitted'
        });
      }

      if (loanData.bm_reviewed_at) {
        trail.push({
          role: 'Branch Manager',
          name: loanData.bm_id && usersData[loanData.bm_id] ? usersData[loanData.bm_id].full_name : 'N/A',
          decision: loanData.bm_decision,
          comment: loanData.bm_comment,
          timestamp: loanData.bm_reviewed_at,
          action: 'BM Review'
        });
      }

      if (loanData.rm_reviewed_at && loanData.is_new_loan) {
        trail.push({
          role: 'Regional Manager',
          name: loanData.rm_id && usersData[loanData.rm_id] ? usersData[loanData.rm_id].full_name : 'N/A',
          decision: loanData.rm_decision,
          comment: loanData.rm_comment,
          timestamp: loanData.rm_reviewed_at,
          action: 'RM Review'
        });
      }

      if (loanData.ca_reviewed_at) {
        trail.push({
          role: 'Credit Analyst',
          name: loanData.ca_id && usersData[loanData.ca_id] ? usersData[loanData.ca_id].full_name : 'N/A',
          decision: loanData.ca_decision,
          comment: loanData.ca_comment,
          timestamp: loanData.ca_reviewed_at,
          action: 'CA Review'
        });
      }

      if (loanData.disbursed_at) {
        trail.push({
          role: 'System',
          name: 'Auto Disbursed',
          action: 'Funds Disbursed',
          timestamp: loanData.disbursed_at,
          comment: 'Loan amount disbursed to customer'
        });
      }

      setApprovalTrail(trail);
      generateRepaymentSchedule(loanData, repayments || []);

    } catch (error) {
      console.error("Error fetching loan details:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateRepaymentSchedule = (loan, repayments) => {
    const schedule = [];
    const startDate = new Date(loan.disbursed_at || loan.created_at);
    const weeklyPayment = loan.weekly_payment || 0;
    const totalInterest = loan.total_interest || 0;
    const processingFee = loan.processing_fee || 0;
    const registrationFee = loan.registration_fee || 0;
    const principal = loan.scored_amount || 0;
    const duration = loan.duration_weeks || 0;

    for (let week = 1; week <= duration; week++) {
      const dueDate = new Date(startDate);
      dueDate.setDate(startDate.getDate() + (week * 7));

      const paymentRecord = repayments.find(repayment =>
        new Date(repayment.due_date).toDateString() === dueDate.toDateString()
      );

      schedule.push({
        week,
        due_date: dueDate.toISOString().split('T')[0],
        principal: week === duration ? principal : 0,
        interest: totalInterest / duration,
        processing_fee: week === 1 ? processingFee : 0,
        registration_fee: week === 1 ? registrationFee : 0,
        total: weeklyPayment,
        status: paymentRecord ? paymentRecord.status : 'pending',
        paid_amount: paymentRecord ? paymentRecord.amount_paid : 0,
        paid_date: paymentRecord ? paymentRecord.payment_date : null
      });
    }

    setRepaymentSchedule(schedule);
  };

  const getPaymentStatusBadge = (status) => {
    const statusConfig = {
      'paid': { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
      'partial': { color: 'bg-yellow-100 text-yellow-800', icon: ClockIcon },
      'pending': { color: 'bg-gray-100 text-gray-800', icon: ClockIcon },
      'overdue': { color: 'bg-red-100 text-red-800', icon: XCircleIcon }
    };

    const config = statusConfig[status] || statusConfig['pending'];
    const IconComponent = config.icon;

    return (
      <span className={`${config.color} px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 justify-center`}>
        <IconComponent className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const calculateLoanPerformance = () => {
    if (!repaymentSchedule.length) return { paid: 0, pending: 0, overdue: 0 };

    const paid = repaymentSchedule.filter(p => p.status === 'paid').length;
    const pending = repaymentSchedule.filter(p => p.status === 'pending').length;
    const overdue = repaymentSchedule.filter(p => p.status === 'overdue').length;

    return { paid, pending, overdue, total: repaymentSchedule.length };
  };

  if (loading || permsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading loan details...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission('loan.view')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600 mb-4">You do not have permission to view loan details.</p>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-xl bg-gray-600 hover:bg-gray-700 mx-auto"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!loanDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loan Not Found</h3>
          <p className="text-gray-600 mb-4">The requested loan could not be found.</p>
          <button
            onClick={() => navigate("/disbursed-loans")}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-xl"
            style={{ backgroundColor: "#586ab1" }}
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Disbursed Loans
          </button>
        </div>
      </div>
    );
  }

  const performance = calculateLoanPerformance();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back
              </button>
              <div>
                <h1 className="text-sm text-center font-semibold text-slate-600">
                  Loan #{loanDetails.id} - {customer?.Firstname} {customer?.Surname}
                </h1>

              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
              <BanknotesIcon className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">
                Active Loan
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Loan Performance Summary */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
            <h3 className="text-sm font-semibold text-slate-600 flex items-center mb-4">
              <ChartBarIcon className="h-5 w-5 text-indigo-600 mr-2" />
              Loan Performance
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-lg font-semibold text-green-600">{performance.paid}</div>
                <div className="text-xs text-green-800 font-medium mt-1">Paid Installments</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-lg font-semibold text-yellow-600">{performance.pending}</div>
                <div className="text-xs text-yellow-800 font-medium mt-1">Pending</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="text-lg font-semibold text-red-600">{performance.overdue}</div>
                <div className="text-xs text-red-800 font-medium mt-1">Overdue</div>
              </div>
            </div>
          </div>

          {/* Loan Summary Info */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
            <h3 className="text-lg font-semibold text-slate-600 flex items-center mb-4">
              <DocumentTextIcon className="h-5 w-5 text-indigo-600 mr-2" />
              Loan Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">Loan ID:</span>
                  <span className="text-indigo-600 font-mono font-semibold">
                    #{loanDetails.id}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">Customer:</span>
                  <span className="text-gray-900 font-semibold">
                    {customer?.Firstname} {customer?.Surname}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">ID Number:</span>
                  <span className="text-gray-900 font-semibold">
                    {customer?.id_number}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">Product:</span>
                  <span className="text-purple-600 font-semibold">
                    {loanDetails.product_name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">Branch:</span>
                  <span className="text-gray-900 font-semibold">
                    {customer?.branches?.name || 'N/A'}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">Amount:</span>
                  <span className="text-emerald-600 font-bold text-lg">
                    KES {loanDetails.scored_amount?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">Duration:</span>
                  <span className="text-gray-900 font-semibold">
                    {loanDetails.duration_weeks} weeks
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">Weekly Payment:</span>
                  <span className="text-blue-600 font-semibold">
                    KES {loanDetails.weekly_payment?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-gray-600 font-medium">Disbursed Date:</span>
                  <span className="text-indigo-600 font-semibold">
                    {new Date(loanDetails.disbursed_at).toLocaleDateString('en-GB')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Repayment Schedule */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-600 flex items-center">
                <CalendarIcon className="h-5 w-5 text-green-600 mr-2" />
                Repayment Schedule
              </h3>
              {/* <button
                onClick={() => setShowPTPForm(true)}
                className="flex items-center gap-2 px-4 py-2 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                style={{ backgroundColor: "#586ab1" }}
              >
                <ClipboardDocumentCheckIcon className="h-4 w-4" />
                Add Promise to Pay
              </button> */}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Week</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Due Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Amount Due</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Paid Amount</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {repaymentSchedule.map((payment, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{payment.week}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(payment.due_date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        KES {payment.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                        {payment.paid_amount > 0 ? `KES ${payment.paid_amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {getPaymentStatusBadge(payment.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Loan History */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
            <h3 className="text-lg font-semibold text-slate-600 flex items-center mb-4">
              <IdentificationIcon className="h-5 w-5 text-blue-600 mr-2" />
              Audit Trail
            </h3>
            <div className="space-y-4">
              {approvalTrail.map((step, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full mt-2 ${step.decision === 'approved' ? 'bg-green-500' :
                      step.decision === 'rejected' ? 'bg-red-500' :
                        step.action === 'Funds Disbursed' ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-900">{step.role}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(step.timestamp).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{step.name}</p>
                    {step.branch && <p className="text-xs text-gray-600">Branch: {step.branch}</p>}
                    {step.decision && (
                      <p className={`text-xs font-medium mt-1 ${step.decision === 'approved' ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {step.decision.toUpperCase()}
                      </p>
                    )}
                    {step.comment && (
                      <p className="text-xs text-gray-600 mt-1">{step.comment}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Promise to Pay Form Modal */}
      {showPTPForm && (
        <PromiseToPayForm
          loan={loanDetails}
          customer={customer}
          createdBy={profile?.id}
          onClose={() => setShowPTPForm(false)}
        />
      )}
    </div>
  );
};

export default ViewDisbursedLoan;