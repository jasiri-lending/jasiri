import React, { useState, useEffect } from 'react';
import { supabase } from "../../supabaseClient";
import {
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  CurrencyDollarIcon,
  ChatBubbleLeftRightIcon,
  CalendarIcon,
  DocumentTextIcon,
  ClockIcon,
  BanknotesIcon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  IdentificationIcon,
  LockClosedIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import { useAuth } from "../../hooks/userAuth"; 

const ApproveLoan = ({ loan, onComplete }) => {
  const { profile } = useAuth();
  const [loanDetails, setLoanDetails] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [bookedByUser, setBookedByUser] = useState(null);
  const [repaymentSchedule, setRepaymentSchedule] = useState([]);
  const [bmDecision, setBmDecision] = useState(null);
  const [walletInfo, setWalletInfo] = useState({
    balance: 0,
    registration_fee_paid: false,
    processing_fee_paid: false,
  });

  // Check user roles
  const isBranchManager = profile?.role === "branch_manager";
  const isRegionalManager = profile?.role === "regional_manager";

  useEffect(() => {
    if (loan) fetchLoanDetails();
  }, [loan]);

  const fetchLoanDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("loans")
        .select(`
          *,
          customers (*),
          bm:users!loans_bm_id_fkey (id,full_name, role)   
        `)
        .eq("id", loan.id)
        .single();

      if (error) throw error;

      // Fetch the user who booked the loan
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id,full_name, role")
        .eq("id", data.booked_by)
        .single();

      if (userError) {
        console.warn("Error fetching booked_by user:", userError);
      }

      // set states
      setLoanDetails(data);
      setCustomer(data.customers);
      setBookedByUser(userData || null);
      setBmDecision({
        decision: data.bm_decision,
        comment: data.bm_comment,
        reviewed_at: data.bm_reviewed_at,
        bm_id: data.bm_id,
        bm_name: data.bm?.full_name || null,  
        bm_role: data.bm?.role || null
      });

      if (data) {
        generateRepaymentSchedule(data);
        await fetchWalletAndFeeStatus(data);
      }
    } catch (error) {
      console.error("Error fetching loan details:", error);
    }
  };

  const fetchWalletAndFeeStatus = async (loanData) => {
    try {
      // Fetch wallet transactions
      const { data: walletTxns, error } = await supabase
        .from("customer_wallets")
        .select("amount, type")
        .eq("customer_id", loanData.customer_id);

      if (error) throw error;

      // Calculate wallet balance
      const balance = walletTxns.reduce(
        (sum, t) => sum + (t.type === "credit" ? t.amount : -t.amount),
        0
      );

      setWalletInfo({
        balance,
        registration_fee_paid: loanData.registration_fee_paid || false,
        processing_fee_paid: loanData.processing_fee_paid || false,
      });
    } catch (error) {
      console.error("Error fetching wallet info:", error);
    }
  };

  // Check if all required fees are paid
  const areFeesFullyPaid = () => {
    if (!loanDetails) return false;
    
    // For new loans: both registration and processing fees must be paid
    if (loanDetails.is_new_loan) {
      return walletInfo.registration_fee_paid && walletInfo.processing_fee_paid;
    }
    
    // For repeat loans: only processing fee must be paid
    return walletInfo.processing_fee_paid;
  };

  // Get fee payment status message
  const getFeePaymentMessage = () => {
    if (!loanDetails) return '';
    
    const unpaidFees = [];
    
    if (!walletInfo.processing_fee_paid) {
      unpaidFees.push('Processing Fee');
    }
    
    if (loanDetails.is_new_loan && !walletInfo.registration_fee_paid) {
      unpaidFees.push('Registration Fee');
    }
    
    if (unpaidFees.length === 0) return '';
    
    return `Cannot approve: ${unpaidFees.join(' and ')} not paid`;
  };

  // Branch Manager Approval Logic
  const approveLoanBM = async (loanId, approved, comment, profile) => {
    let newStatus = "rejected"; 

    if (approved) {
      if (loanDetails.is_new_loan) {
        newStatus = "rn_review";  // New loans go to Regional Manager
      } else {
        newStatus = "ca_review";  // Repeat loans go directly to Credit Analyst
      }
    }

    const { error } = await supabase
      .from("loans")
      .update({
        status: newStatus,
        bm_comment: comment,
        bm_id: profile?.id || null,
        bm_reviewed_at: new Date().toISOString(),
        bm_decision: approved ? 'approved' : 'rejected'
      })
      .eq("id", loanId);

    if (error) {
      console.error("Supabase error while approving loan:", error);
      throw error; 
    }
  };

  // Regional Manager Approval Logic
  const approveLoanRM = async (loanId, approved, comment, profile) => {
    let newStatus = "rejected"; 

    if (approved) {
      newStatus = "ca_review";  // Approved loans go to Credit Analyst for disbursement
    }

    const { error } = await supabase
      .from("loans")
      .update({
        status: newStatus,
        rm_comment: comment,
        rm_id: profile?.id || null,
        rm_reviewed_at: new Date().toISOString(),
        rm_decision: approved ? 'approved' : 'rejected'
      })
      .eq("id", loanId);

    if (error) {
      console.error("Supabase error while approving loan:", error);
      throw error; 
    }
  };

  const handleApprovalDecision = async (approved) => {
    if (!comment.trim()) {
      toast.error("Please provide a comment for your decision");
      return;
    }

    if (!profile?.id) {
      toast.error("User profile ID not found. Please log in again.");
      return;
    }

    // Check fees only for approval, not rejection
    if (approved && !areFeesFullyPaid()) {
      toast.error(getFeePaymentMessage());
      return;
    }

    setLoading(true);
    try {
      if (isBranchManager) {
        await approveLoanBM(loan.id, approved, comment, profile);
      } else if (isRegionalManager) {
        await approveLoanRM(loan.id, approved, comment, profile);
      }

      const successMessage = approved 
        ? `Loan approved & forwarded to ${getNextStage(approved)}` 
        : "Loan rejected successfully!";

      toast.success(successMessage);
      onComplete?.();
    } catch (error) {
      console.error("Error updating loan in handler:", error);
      toast.error("Error processing loan decision. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getNextStage = (approved) => {
    if (!approved) return "rejected";
    
    if (isBranchManager) {
      return loanDetails?.is_new_loan ? "Regional Manager" : "Credit Analyst";
    } else if (isRegionalManager) {
      return "Credit Analyst";
    }
    return "next stage";
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

  if (!loanDetails || !customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading loan details...</p>
        </div>
      </div>
    );
  }

  const feesPaid = areFeesFullyPaid();
  const feeMessage = getFeePaymentMessage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xsm  bg-slate-600 bg-clip-text text-transparent">
                {isRegionalManager ? 'Regional Manager Loan Review' : 'Branch Manager Loan Approval'}
              </h1>
              {/* <p className="text-xsm text-gray-500 mt-1">
                Role: {profile?.role?.replace(/_/g, " ").toUpperCase()} 
              </p> */}
              <div className="mt-2 text-sm text-gray-600">
                {isRegionalManager && bmDecision?.decision && (
                  <span className="ml-4">
                    <span className="font-medium">BM Decision:</span> 
                    <span className={`ml-1 px-2 py-1 rounded-full text-xs font-semibold ${
                      bmDecision.decision === 'approved' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {bmDecision.decision.toUpperCase()}
                    </span>
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-indigo-600">
                Loan #{loanDetails.id}
              </div>
              <div className="text-sm text-gray-500">
                Type: <span className={`font-semibold ${loanDetails.is_new_loan ? 'text-green-600' : 'text-blue-600'}`}>
                  {loanDetails.is_new_loan ? 'New Loan' : 'Repeat Loan'}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                Applied: {new Date(loanDetails.created_at).toLocaleDateString('en-GB')}
              </div>
            </div>
          </div>
        </div>

        {/* Fee Payment Alert */}
        {!feesPaid && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 p-6 mb-8 rounded-lg shadow-md">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-800 mb-1">
                  Fee Payment Required
                </h3>
                <p className="text-amber-700 text-sm">
                  {feeMessage}. The customer must pay all required fees before the loan can be approved.
                </p>
                <div className="mt-3 text-sm text-amber-600">
                  <strong>Required Fees:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {!walletInfo.processing_fee_paid && (
                      <li>Processing Fee: KES {loanDetails.processing_fee?.toLocaleString()}</li>
                    )}
                    {loanDetails.is_new_loan && !walletInfo.registration_fee_paid && (
                      <li>Registration Fee: KES {loanDetails.registration_fee?.toLocaleString()}</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Customer Information */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-slate-600 flex items-center mb-6">
              <UserIcon className="h-6 w-6 text-indigo-600 mr-3" />
              Customer Information
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Full Name:</span>
                <span className="text-slate-600 font-semibold">
                  {customer.Firstname} {customer.Surname}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">ID Number:</span>
                <span className="text-indigo-600 font-mono font-semibold">
                  {customer.id_number || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Mobile:</span>
                <span className="text-gray-900 font-semibold">
                  {customer.mobile}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Loan Type:</span>
                <span className={`font-semibold ${loanDetails.is_new_loan ? 'text-green-600' : 'text-blue-600'}`}>
                  {loanDetails.is_new_loan ? 'New Loan' : 'Repeat'}
                </span>
              </div>
            </div>
          </div>

          {/* Loan Details */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h3 className="text-lgs font-semibold text-gray-600 flex items-center mb-6">
              <CurrencyDollarIcon className="h-6 w-6 text-emerald-600 mr-3" />
              Loan Details
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Product:</span>
                <span className="text-purple-600 font-semibold">
                  {loanDetails.product_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Principal Amount:</span>
                <span className="text-emerald-600 font-bold text-lg">
                  KES {loanDetails.scored_amount?.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Duration:</span>
                <span className="text-gray-900 font-semibold">
                  {loanDetails.duration_weeks} weeks
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Processing Fee:</span>
                <span className="text-gray-900 font-semibold">
                  KES {loanDetails.processing_fee?.toLocaleString()}
                </span>
              </div>
              {loanDetails.registration_fee > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Registration Fee:</span>
                  <span className="text-gray-900 font-semibold">
                    KES {loanDetails.registration_fee?.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-4 border-t border-gray-200">
                <span className="text-gray-600 font-medium">Total Repayment:</span>
                <span className="text-indigo-600 font-bold text-xl">
                  KES {loanDetails.total_payable?.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet & Fee Status Section */}
        <div className={`rounded-lg shadow-lg p-6 border mt-8 ${
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
              <div className="text-sm text-gray-600 mb-2">Processing Fee</div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-slate-600">
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
                <div className="text-sm text-gray-600 mb-2">Registration Fee</div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-900">
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
        </div>

        {/* Branch Manager Decision (Visible to RM) */}
        {isRegionalManager && bmDecision && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 mt-8">
            <h3 className="text-lg font-semibold text-gray-600 flex items-center mb-4">
              <IdentificationIcon className="h-6 w-6 text-blue-600 mr-3" />
              Branch Manager Decision
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-gray-600 font-medium">Decision:</span>
                  <div className={`mt-1 px-3 py-1 rounded-full text-sm font-semibold inline-block ${
                    bmDecision.decision === 'approved' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {bmDecision.decision?.toUpperCase() || 'PENDING'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 font-medium">Reviewed On:</span>
                  <div className="text-gray-900 font-semibold">
                    {bmDecision.reviewed_at ? new Date(bmDecision.reviewed_at).toLocaleDateString('en-GB') : 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 font-medium">Branch Manager:</span>
                  <div className="text-gray-900 font-semibold">
                    {bmDecision.bm_name || 'N/A'}
                  </div>
                </div>
              </div>
              <div>
                <span className="text-gray-600 font-medium">Comments:</span>
                <div className="mt-1 p-3 bg-white rounded-lg border border-gray-200">
                  {bmDecision.comment || 'No comments provided'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Booked By Information */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 mt-8">
          <h3 className="text-lg font-semibold text-slate-600 flex items-center mb-4">
            <IdentificationIcon className="h-6 w-6 text-purple-600 mr-3" />
            Booked By
          </h3>
          {bookedByUser ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Name:</span>
                <span className="text-gray-600 font-semibold">
                  {bookedByUser.full_name}
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

        {/* Repayment Schedule */}
        {repaymentSchedule.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-8">
            <div className="bg-gray-100 text-gray-100 p-4">
              <h3 className="text-lg font-semibold flex items-center">
                <DocumentTextIcon className="h-6 w-6 mr-3" />
                Repayment Schedule
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Week</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Due Date</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-600">Principal</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-600">Interest</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-600">Fees</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-600">Installments</th>
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
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(payment.due_date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-600">
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

        {/* Manager Decision Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mt-8 border border-gray-200">
          <h3 className="text-lg font-semibold text-slate-600 flex items-center mb-6">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600 mr-3" />
            {isRegionalManager ? 'Regional Manager Decision' : 'Branch Manager Decision'}
          </h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Comments / Notes
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows="4"
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder={`Provide your comments and reasoning for the ${isRegionalManager ? 'regional' : 'branch'} approval/rejection decision...`}
                required
              />
            </div>

           <div className="flex gap-3 justify-end">
  <button
    onClick={() => handleApprovalDecision(false)}
    disabled={loading || !comment.trim()}
    className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-md hover:shadow-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {loading ? (
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
    ) : (
      <XCircleIcon className="h-4 w-4" />
    )}
    Reject Loan
  </button>

  <button
    onClick={() => handleApprovalDecision(true)}
    disabled={loading || !comment.trim() || !feesPaid}
    className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg hover:from-emerald-700 hover:to-green-700 transition-all shadow-md hover:shadow-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
    title={!feesPaid ? feeMessage : ''}
  >
    {loading ? (
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
    ) : (
      <CheckCircleIcon className="h-4 w-4" />
    )}
    {`Approve & Forward to ${getNextStage(true)}`}
  </button>
</div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default ApproveLoan;