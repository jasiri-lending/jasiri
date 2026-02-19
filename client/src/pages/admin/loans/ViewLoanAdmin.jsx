// src/components/ViewLoan.jsx
import { useState, useEffect } from 'react';
import { supabase } from "../../../supabaseClient";
import { useAuth } from "../../../hooks/userAuth";
import {
  UserIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  DocumentTextIcon,
  ClockIcon,
  BanknotesIcon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  IdentificationIcon,

  ChatBubbleLeftRightIcon,

  XCircleIcon,
} from "@heroicons/react/24/outline";

const ViewLoanAdmin = ({ loan, onClose }) => {
  const { profile } = useAuth();
  const [loanDetails, setLoanDetails] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [bookedByUser, setBookedByUser] = useState(null);
  const [repaymentSchedule, setRepaymentSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (loan) {
      fetchLoanDetails();
    }
  }, [loan]);

  const fetchLoanDetails = async () => {
    try {
      // Fetch loan with customer and user details
      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select(`
          *,
          customers (*)
        `)
        .eq('id', loan.id)
        .eq('tenant_id', profile?.tenant_id)
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

      setLoanDetails(loanData);
      setCustomer(loanData.customers);
      setBookedByUser(userData || null);

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

  const getStatusIcon = (status) => {
    switch (status) {
      case "booked":
        return <ClockIcon className="h-5 w-5 text-amber-600" />;
      case "pending_branch_manager":
        return <ClockIcon className="h-5 w-5 text-orange-600" />;
      case "pending_regional_manager":
        return <ClockIcon className="h-5 w-5 text-blue-600" />;
      case "pending_disbursement":
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
      pending_branch_manager: "bg-orange-100 text-orange-800 border-orange-200",
      pending_regional_manager: "bg-blue-100 text-blue-800 border-blue-200",
      pending_disbursement: "bg-purple-100 text-purple-800 border-purple-200",
      disbursed: "bg-emerald-100 text-emerald-800 border-emerald-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
    };
    return badges[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const formatStatus = (status) => {
    switch (status) {
      case "booked": return "Booked";
      case "pending_branch_manager": return "Pending Branch Manager";
      case "pending_regional_manager": return "Pending Regional Manager";
      case "pending_disbursement": return "Pending Disbursement";
      case "disbursed": return "Disbursed";
      case "rejected": return "Rejected";
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4 mx-auto"></div>
            <p className="text-gray-600 font-medium">Loading loan details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!loanDetails || !customer) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <XCircleIcon className="h-16 w-16 text-red-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Loan</h3>
            <p className="text-gray-600 mb-4">Unable to load loan details.</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-700 to-blue-700 bg-clip-text text-transparent">
                Loan Details - #{loanDetails.id}
              </h2>
              <p className="text-gray-600 mt-1">
                Complete information about this loan application
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${getStatusBadge(loanDetails.status)}`}>
                {getStatusIcon(loanDetails.status)}
                <span className="font-semibold">{formatStatus(loanDetails.status)}</span>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="h-6 w-6 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Customer Information */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <h3 className="text-xl font-bold text-gray-900 flex items-center mb-4">
                <UserIcon className="h-6 w-6 text-blue-600 mr-3" />
                Customer Information
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Full Name:</span>
                  <span className="text-gray-900 font-semibold text-right">
                    {customer.Firstname} {customer.Surname}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">ID Number:</span>
                  <span className="text-blue-600 font-mono font-semibold">
                    {customer.id_number || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium flex items-center">
                    <PhoneIcon className="h-4 w-4 mr-1" />
                    Mobile:
                  </span>
                  <span className="text-gray-900 font-semibold">
                    {customer.mobile}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Customer Type:</span>
                  <span className={`font-semibold ${loanDetails.is_new_customer ? 'text-green-600' : 'text-blue-600'}`}>
                    {loanDetails.is_new_customer ? 'New Customer' : 'Returning Customer'}
                  </span>
                </div>
              </div>
            </div>

            {/* Loan Details */}
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border border-emerald-200">
              <h3 className="text-xl font-bold text-gray-900 flex items-center mb-4">
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
                    KES {loanDetails.scored_amount?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Duration:</span>
                  <span className="text-gray-900 font-semibold">
                    {loanDetails.duration_weeks} weeks
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Interest Rate:</span>
                  <span className="text-gray-900 font-semibold">
                    {loanDetails.interest_rate}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Processing Fee:</span>
                  <span className="text-gray-900 font-semibold">
                    KES {loanDetails.processing_fee?.toLocaleString()}
                  </span>
                </div>
                {loanDetails.registration_fee > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Registration Fee:</span>
                    <span className="text-gray-900 font-semibold">
                      KES {loanDetails.registration_fee?.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                  <span className="text-gray-600 font-medium">Total Payable:</span>
                  <span className="text-emerald-600 font-bold text-lg">
                    KES {loanDetails.total_payable?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Weekly Payment:</span>
                  <span className="text-indigo-600 font-bold">
                    KES {loanDetails.weekly_payment?.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Booked By Information */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
              <h3 className="text-xl font-bold text-gray-900 flex items-center mb-4">
                <IdentificationIcon className="h-6 w-6 text-purple-600 mr-3" />
                Booked By
              </h3>
              {bookedByUser ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Name:</span>
                    <span className="text-gray-900 font-semibold">
                      {bookedByUser.full_name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Email:</span>
                    <span className="text-gray-900 font-semibold text-right text-sm">
                      {bookedByUser.email}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Role:</span>
                    <span className="text-purple-600 font-semibold">
                      {bookedByUser.role || 'Staff'}
                    </span>
                  </div>

                </div>
              ) : (
                <div className="text-center py-4">
                  <UserIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">User information not available</p>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 flex items-center mb-4">
              <CalendarIcon className="h-6 w-6 text-gray-600 mr-3" />
              Loan Timeline
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-1">Created</div>
                <div className="text-sm font-semibold text-gray-900">
                  {new Date(loanDetails.created_at).toLocaleDateString('en-GB')}
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
                    {new Date(loanDetails.bm_approved_at).toLocaleDateString('en-GB')}
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
                    {new Date(loanDetails.rm_approved_at).toLocaleDateString('en-GB')}
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
                    {new Date(loanDetails.disbursed_at).toLocaleDateString('en-GB')}
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

          {/* Comments Section */}
          {(loanDetails.bm_comment || loanDetails.rm_comment) && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
              <h3 className="text-xl font-bold text-gray-900 flex items-center mb-4">
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

          {/* Repayment Schedule */}
          {repaymentSchedule.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-4">
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
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Total</th>
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
                          {new Date(payment.due_date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                          KES {payment.principal.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">
                          KES {payment.interest.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-amber-600">
                          KES {(payment.processing_fee + payment.registration_fee).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-bold text-indigo-600">
                          KES {payment.total.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewLoanAdmin;