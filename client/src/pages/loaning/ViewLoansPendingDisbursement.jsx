import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import {
  CheckCircleIcon,
  XCircleIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  DocumentTextIcon,
  IdentificationIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  BanknotesIcon,
  ArrowLeftIcon
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";

const ViewLoansPendingDisbursement = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [loanDetails, setLoanDetails] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [repaymentSchedule, setRepaymentSchedule] = useState([]);
  const [approvalTrail, setApprovalTrail] = useState([]);
  const [walletInfo, setWalletInfo] = useState({
    balance: 0,
    registration_fee_paid: false,
    processing_fee_paid: false,
  });
  const [loading, setLoading] = useState(true);

  const isCreditAnalyst = profile?.role === "credit_analyst_officer";

  useEffect(() => {
    if (id && profile) {
      fetchLoanFullDetails(id);
    }
  }, [id, profile]);

  const fetchWalletAndFeeStatus = async (loanData) => {
    try {
      const { data: walletTxns, error } = await supabase
        .from("customer_wallets")
        .select("amount, type")
        .eq("customer_id", loanData.customer_id);

      if (error) throw error;

      const balance = walletTxns?.reduce(
        (sum, t) => sum + (t.type === "credit" ? t.amount : -t.amount),
        0
      ) || 0;

      setWalletInfo({
        balance,
        registration_fee_paid: loanData.registration_fee_paid || false,
        processing_fee_paid: loanData.processing_fee_paid || false,
      });
    } catch (error) {
      console.error("Error fetching wallet info:", error);
    }
  };

  const areFeesFullyPaid = () => {
    if (!loanDetails) return false;
    
    if (loanDetails.is_new_loan) {
      return walletInfo.registration_fee_paid && walletInfo.processing_fee_paid;
    }
    
    return walletInfo.processing_fee_paid;
  };

  const fetchLoanFullDetails = async (loanId) => {
    try {
      setLoading(true);
      
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

      await fetchWalletAndFeeStatus(loanData);

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

      setLoanDetails(loanData);
      setCustomer(loanData.customers);
      
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
          role: 'Credit Analyst Officer',
          name: loanData.ca_id && usersData[loanData.ca_id] ? usersData[loanData.ca_id].full_name : 'N/A',
          decision: loanData.ca_decision,
          comment: loanData.ca_comment,
          timestamp: loanData.ca_reviewed_at,
          action: 'CA Review'
        });
      }

      setApprovalTrail(trail);
      generateRepaymentSchedule(loanData);

    } catch (error) {
      console.error("Error fetching loan details:", error);
      toast.error("Failed to load loan details");
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

  const handleDisbursement = async () => {
    try {
      const { error } = await supabase
        .from("loans")
        .update({
          status: 'ready_for_disbursement',
          disbursed_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Disbursement confirmed successfully!");
      navigate('/pending-disbursements');
    } catch (error) {
      console.error("Error disbursing loan:", error);
      toast.error("Failed to disburse loan");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading loan details...</p>
        </div>
      </div>
    );
  }

  if (!loanDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-slate-600 mb-2">Loan Not Found</h3>
          <p className="text-gray-600 mb-4">The requested loan could not be found.</p>
          <button
            onClick={() => navigate('/pending-disbursements')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Back to Loans List
          </button>
        </div>
      </div>
    );
  }

  const feesPaid = areFeesFullyPaid();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        {/* <button
          onClick={() => navigate('/pending-disbursements')}
          className="mb-6 flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back to Loans List
        </button> */}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-sm font-semibold text-center text-slate-600">
            Loan Details - #{loanDetails.id}
          </h1>
          <p className="text-gray-600 text-center mt-1">
            Complete loan information and disbursement processing
          </p>
        </div>

        <div className="space-y-6">
          {/* Loan Summary */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h3 className="text-sm font-semibold text-slate-600 flex items-center mb-6">
              <DocumentTextIcon className="h-6 w-6 text-indigo-600 mr-3" />
              Loan Summary Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-gray-600 font-medium">Loan ID:</span>
                  <span className="text-indigo-600 font-mono font-bold">
                    #{loanDetails.id}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-gray-600 font-medium">Customer:</span>
                  <span className="text-gray-900 font-semibold">
                    {customer?.Firstname} {customer?.Surname}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-gray-600 font-medium">ID Number:</span>
                  <span className="text-gray-900 font-semibold">
                    {customer?.id_number}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-gray-600 font-medium">Mobile:</span>
                  <span className="text-gray-900 font-semibold">
                    {customer?.mobile}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-gray-600 font-medium">Product:</span>
                  <span className="text-purple-600 font-semibold">
                    {loanDetails.product_name}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-gray-600 font-medium">Branch:</span>
                  <span className="text-gray-900 font-semibold">
                    {customer?.branches?.name || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-gray-600 font-medium">Loan Type:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    loanDetails.is_new_loan ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {loanDetails.is_new_loan ? 'New Loan' : 'Repeat '}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-gray-600 font-medium">Applied On:</span>
                  <span className="text-gray-900 font-semibold">
                    {new Date(loanDetails.created_at).toLocaleDateString('en-GB')}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-gray-600 font-medium">Approved Amount:</span>
                  <span className="text-emerald-600 font-bold text-lg">
                    KES {loanDetails.scored_amount?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-gray-600 font-medium">Duration:</span>
                  <span className="text-gray-900 font-semibold">
                    {loanDetails.duration_weeks} weeks
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-sm text-gray-600 font-medium">Weekly Payment:</span>
                  <span className="text-blue-600 font-semibold">
                    KES {loanDetails.weekly_payment?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-indigo-200 bg-indigo-50 px-2 rounded">
                  <span className="text-sm text-gray-700 font-bold">Total Payable:</span>
                  <span className="text-indigo-600 font-bold text-lg">
                    KES {loanDetails.total_payable?.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Wallet & Fee Status */}
          <div className={`rounded-2xl shadow-lg p-6 border ${
            feesPaid 
              ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200' 
              : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300'
          }`}>
            <h3 className="text-lg font-semibold text-slate-600 flex items-center mb-6">
              <BanknotesIcon className="h-6 w-6 text-emerald-600 mr-3" />
              Wallet & Fee Payment Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <div className="text-sm text-gray-600 mb-2">Wallet Balance</div>
                <div className="text-2xl font-bold text-indigo-600">
                  KES {walletInfo.balance.toLocaleString()}
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <div className="text-sm text-gray-600 mb-3">Processing Fee</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">
                    KES {loanDetails.processing_fee?.toLocaleString()}
                  </span>
                  {walletInfo.processing_fee_paid ? (
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-6 w-6 text-green-500" />
                      <span className="text-sm font-semibold text-green-600">Paid</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-6 w-6 text-amber-500" />
                      <span className="text-sm font-semibold text-amber-600">Unpaid</span>
                    </div>
                  )}
                </div>
              </div>

              {loanDetails.is_new_loan && (
                <div className="bg-white rounded-xl p-5 shadow-sm">
                  <div className="text-sm text-gray-600 mb-3">Registration Fee</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600">
                      KES {loanDetails.registration_fee?.toLocaleString()}
                    </span>
                    {walletInfo.registration_fee_paid ? (
                      <div className="flex items-center gap-2">
                        <CheckCircleIcon className="h-6 w-6 text-green-500" />
                        <span className="text-sm font-semibold text-green-600">Paid</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-6 w-6 text-amber-500" />
                        <span className="text-sm font-semibold text-amber-600">Unpaid</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {!feesPaid && (
              <div className="mt-4 p-4 bg-amber-100 border border-amber-300 rounded-lg">
                <p className="text-sm text-amber-800 font-medium flex items-center">
                  <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                  Required fees have not been fully paid. Disbursement cannot proceed until all fees are settled.
                </p>
              </div>
            )}
          </div>

          {/* Approval Trail */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-slate-600 flex items-center mb-6">
              <IdentificationIcon className="h-6 w-6 text-blue-600 mr-3" />
              Approval Audit Trail
            </h3>
            <div className="space-y-4">
              {approvalTrail.map((step, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                  <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                    step.decision === 'approved' ? 'bg-green-500' : 
                    step.decision === 'rejected' ? 'bg-red-500' : 'bg-blue-500'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold text-slate-600 text-sm">{step.role}</span>
                        <p className="text-gray-700 font-medium mt-1">{step.name}</p>
                        {step.branch && <p className="text-sm text-gray-600">Branch: {step.branch}</p>}
                      </div>
                      <span className="text-sm text-gray-500 whitespace-nowrap ml-4">
                        {new Date(step.timestamp).toLocaleDateString('en-GB')} {new Date(step.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {step.decision && (
                      <div className="mb-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                          step.decision === 'approved' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {step.decision === 'approved' ? (
                            <CheckCircleIcon className="h-4 w-4 mr-1" />
                          ) : (
                            <XCircleIcon className="h-4 w-4 mr-1" />
                          )}
                          {step.decision.toUpperCase()}
                        </span>
                      </div>
                    )}
                    {step.comment && (
                      <p className="text-sm text-gray-600 italic bg-white p-2 rounded border-l-4 border-blue-400">
                        "{step.comment}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Repayment Schedule */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-slate-600 flex items-center mb-6">
              <CalendarIcon className="h-6 w-6 text-green-600 mr-3" />
              Repayment Schedule Preview
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">Week</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-900">Due Date</th>
                    <th className="px-6 py-3 text-right text-sm font-bold text-gray-900">Principal</th>
                    <th className="px-6 py-3 text-right text-sm font-bold text-gray-900">Interest</th>
                    <th className="px-6 py-3 text-right text-sm font-bold text-gray-900">Fees</th>
                    <th className="px-6 py-3 text-right text-sm font-bold text-gray-900">Weekly Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {repaymentSchedule.map((payment, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        Week {payment.week}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(payment.due_date).toLocaleDateString('en-GB', { 
                          weekday: 'short', 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                        KES {payment.principal.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">
                        KES {payment.interest.toFixed(2)}
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
                <tfoot className="bg-gradient-to-r from-indigo-50 to-blue-50">
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                      Total Repayment:
                    </td>
                    <td className="px-6 py-4 text-right text-lg font-bold text-indigo-600">
                      KES {loanDetails.total_payable?.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Disbursement Action */}
          <div className={`rounded-2xl p-8 border-2 ${
            isCreditAnalyst && feesPaid
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300' 
              : isCreditAnalyst && !feesPaid
              ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300'
              : 'bg-gradient-to-r from-gray-50 to-blue-50 border-gray-300'
          }`}>
            <h3 className="text-sm font-semibold text-slate-600 flex items-center mb-4">
              {isCreditAnalyst && feesPaid ? (
                <>
                  <CheckCircleIcon className="h-7 w-7 text-green-600 mr-3" />
                  Ready for Disbursement
                </>
              ) : isCreditAnalyst && !feesPaid ? (
                <>
                  <ExclamationTriangleIcon className="h-7 w-7 text-amber-600 mr-3" />
                  Fees Payment Required
                </>
              ) : (
                <>
                  <LockClosedIcon className="h-7 w-7 text-gray-600 mr-3" />
                  View Only Mode
                </>
              )}
            </h3>
            <p className="text-gray-700 mb-6 text-xs">
              {isCreditAnalyst && feesPaid
                ? "This loan has been fully approved and all required fees have been paid. You can now proceed with disbursement."
                : isCreditAnalyst && !feesPaid
                ? "This loan has been approved but required fees have not been fully paid. Disbursement will be available once all fees are settled."
                : "You can view loan details but only Credit Analyst Officers can process disbursements."}
            </p>
            
            {isCreditAnalyst && feesPaid ? (
              <div className="flex gap-4">
                <button
                  onClick={handleDisbursement}
                  className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl font-bold text-lg"
                >
                  <CurrencyDollarIcon className="h-6 w-6" />
                  Confirm Disbursement
                </button>
                <button
                  onClick={() => navigate('/pending-disbursements')}
                  className="flex items-center gap-3 px-8 py-4 bg-white text-gray-700 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all font-semibold text-lg"
                >
                  Cancel
                </button>
              </div>
            ) : isCreditAnalyst && !feesPaid ? (
              <button
                disabled
                className="flex items-center gap-3 px-8 py-4 bg-gray-300 text-gray-500 rounded-xl cursor-not-allowed font-bold text-lg"
              >
                <LockClosedIcon className="h-6 w-6" />
                Disbursement Locked - Fees Required
              </button>
            ) : (
              <button
                disabled
                className="flex items-center gap-3 px-8 py-4 bg-gray-300 text-gray-500 rounded-xl cursor-not-allowed font-bold text-lg"
              >
                <LockClosedIcon className="h-6 w-6" />
                Disbursement Restricted
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewLoansPendingDisbursement;