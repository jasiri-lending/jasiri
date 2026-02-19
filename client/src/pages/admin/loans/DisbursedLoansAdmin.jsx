import React, { useState, useEffect } from 'react';
import { supabase } from "../../../supabaseClient";
import { useAuth } from "../../../hooks/userAuth";
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
  BanknotesIcon
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";

const DisbursedLoansAdmin = () => {
  const { profile } = useAuth();
  const [loans, setLoans] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loanDetails, setLoanDetails] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [repaymentSchedule, setRepaymentSchedule] = useState([]);
  const [approvalTrail, setApprovalTrail] = useState([]);
  const [repaymentHistory, setRepaymentHistory] = useState([]);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchDisbursedLoans();
    }
  }, [profile]);

  useEffect(() => {
    if (selectedLoan) {
      fetchLoanFullDetails(selectedLoan.id);
    }
  }, [selectedLoan]);

  const fetchDisbursedLoans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("loans")
        .select(`
          *,
          customers (*)
        `)
        .eq('status', 'disbursed')
        .eq('tenant_id', profile?.tenant_id)
        .order('disbursed_at', { ascending: false });

      if (error) throw error;

      setLoans(data || []);
    } catch (error) {
      console.error("Error fetching disbursed loans:", error);
      toast.error("Failed to load disbursed loans");
    } finally {
      setLoading(false);
    }
  };

  const fetchLoanFullDetails = async (loanId) => {
    try {
      // Fetch loan with customer details
      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select(`
          *,
          customers (*)
        `)
        .eq('id', loanId)
        .eq('tenant_id', profile?.tenant_id)
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

      // RO who booked the loan
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

      // BM review
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

      // RM review (if new loan)
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

      // CA review
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

      // Disbursement
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
      generateRepaymentSchedule(loanData);

    } catch (error) {
      console.error("Error fetching loan details:", error);
      toast.error("Failed to load loan details");
    }
  };

  const generateRepaymentSchedule = (loan) => {
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

      // Check if this payment has been made
      const paymentRecord = repaymentHistory.find(repayment =>
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

  const getStatusBadge = (status) => {
    const statusConfig = {
      'disbursed': { color: 'bg-blue-100 text-blue-800', text: 'Active' },
      'completed': { color: 'bg-green-100 text-green-800', text: 'Completed' },
      'defaulted': { color: 'bg-red-100 text-red-800', text: 'Defaulted' },
      'pending': { color: 'bg-yellow-100 text-yellow-800', text: 'Pending' }
    };

    const config = statusConfig[status] || statusConfig['disbursed'];
    return (
      <span className={`${config.color} px-2 py-1 rounded-full text-xs font-semibold`}>
        {config.text}
      </span>
    );
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
      <span className={`${config.color} px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1`}>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading disbursed loans...</p>
        </div>
      </div>
    );
  }

  const performance = calculateLoanPerformance();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-indigo-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-blue-700 bg-clip-text text-transparent">
                Disbursed Loans
              </h1>
              <p className="text-gray-600 mt-2">
                Active loans that have been disbursed to customers
              </p>
            </div>
            <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-semibold">
              {loans.length} Active Loans
            </div>
          </div>
        </div>

        {loans.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <BanknotesIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Disbursed Loans</h3>
            <p className="text-gray-600">No loans have been disbursed yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Loans List */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg border border-indigo-100">
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-2xl">
                  <h2 className="text-xl font-bold flex items-center">
                    <BanknotesIcon className="h-6 w-6 mr-2" />
                    Active Loans
                  </h2>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {loans.map((loan) => (
                    <div
                      key={loan.id}
                      className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-indigo-50 transition-colors ${selectedLoan?.id === loan.id ? 'bg-indigo-100 border-l-4 border-l-indigo-500' : ''
                        }`}
                      onClick={() => setSelectedLoan(loan)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-gray-900">Loan #{loan.id}</span>
                        {getStatusBadge(loan.status)}
                      </div>
                      <p className="text-gray-900 font-medium">
                        {loan.customers?.Firstname} {loan.customers?.Surname}
                      </p>
                      <p className="text-sm text-gray-600">ID: {loan.customers?.id_number}</p>
                      <p className="text-sm text-gray-600">PHONE: {loan.customers?.mobile}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-indigo-600 font-bold">
                          KES {loan.scored_amount?.toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-500">
                          Disbursed: {new Date(loan.disbursed_at).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Loan Details */}
            <div className="lg:col-span-2">
              {selectedLoan ? (
                <div className="space-y-6">
                  {/* Loan Performance Summary */}
                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center mb-4">
                      <ChartBarIcon className="h-6 w-6 text-indigo-600 mr-3" />
                      Loan Performance
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="text-2xl font-bold text-green-600">{performance.paid}</div>
                        <div className="text-sm text-green-800 font-medium">Paid</div>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="text-2xl font-bold text-yellow-600">{performance.pending}</div>
                        <div className="text-sm text-yellow-800 font-medium">Pending</div>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                        <div className="text-2xl font-bold text-red-600">{performance.overdue}</div>
                        <div className="text-sm text-red-800 font-medium">Overdue</div>
                      </div>
                    </div>
                  </div>

                  {/* Loan Summary Info */}
                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center mb-4">
                      <DocumentTextIcon className="h-6 w-6 text-indigo-600 mr-3" />
                      Loan Summary Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-gray-600 font-medium">Loan ID:</span>
                          <span className="text-indigo-600 font-mono font-semibold">
                            #{loanDetails?.id}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 font-medium">Customer Name:</span>
                          <span className="text-gray-900 font-semibold">
                            {customer?.Firstname} {customer?.Surname}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 font-medium">ID Number:</span>
                          <span className="text-gray-900 font-semibold">
                            {customer?.id_number}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 font-medium">Product Type:</span>
                          <span className="text-purple-600 font-semibold">
                            {loanDetails?.product_name}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-gray-600 font-medium">Disbursed Amount:</span>
                          <span className="text-emerald-600 font-bold text-lg">
                            KES {loanDetails?.scored_amount?.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 font-medium">Duration:</span>
                          <span className="text-gray-900 font-semibold">
                            {loanDetails?.duration_weeks} weeks
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 font-medium">Weekly Repayment:</span>
                          <span className="text-blue-600 font-semibold">
                            KES {loanDetails?.weekly_payment?.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-gray-600 font-medium">Disbursement Date:</span>
                          <span className="text-indigo-600 font-semibold">
                            {new Date(loanDetails?.disbursed_at).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Repayment Schedule with Status */}
                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center mb-4">
                      <CalendarIcon className="h-6 w-6 text-green-600 mr-3" />
                      Repayment Schedule & Status
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Week</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Due Date</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Amount Due</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Paid Amount</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
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
                    <h3 className="text-xl font-bold text-gray-900 flex items-center mb-4">
                      <IdentificationIcon className="h-6 w-6 text-blue-600 mr-3" />
                      Loan History & Audit Trail
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
                              <span className="font-semibold text-gray-900">{step.role}</span>
                              <span className="text-sm text-gray-500">
                                {new Date(step.timestamp).toLocaleDateString('en-GB')}
                              </span>
                            </div>
                            <p className="text-gray-700">{step.name}</p>
                            {step.branch && <p className="text-sm text-gray-600">Branch: {step.branch}</p>}
                            {step.decision && (
                              <p className={`text-sm font-medium ${step.decision === 'approved' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                Decision: {step.decision.toUpperCase()}
                              </p>
                            )}
                            {step.comment && (
                              <p className="text-sm text-gray-600 mt-1">Comment: {step.comment}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                  <ExclamationTriangleIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a Loan</h3>
                  <p className="text-gray-600">Choose a loan from the list to view details and repayment status</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Add the missing ChartBarIcon component
const ChartBarIcon = (props) => (
  <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

export default DisbursedLoansAdmin;