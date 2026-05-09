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
import { useToast } from "../../components/Toast";
import { useAuth } from "../../hooks/userAuth"; 
import Spinner from '../../components/Spinner';
import WorkflowActionPanel from '../../components/workflow/WorkflowActionPanel';


const ApproveLoan = ({ loan, onComplete }) => {
  const { profile } = useAuth();
  const { success, error: toastError, info, warning } = useToast();
  const [loanDetails, setLoanDetails] = useState(null);
  const [customer, setCustomer] = useState(null);
const [loadingApprove, setLoadingApprove] = useState(false);
const [loadingReject, setLoadingReject] = useState(false);

// Legacy handlers removed - handled by WorkflowActionPanel


  // Role checks removed - WorkflowActionPanel handles permissions based on node roles

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

      // Role-based access control check
      const { role, id: userId, branch_id, region_id } = profile;
      const isGlobalRole = ['super_admin', 'admin', 'credit_analyst_officer'].includes(role);
      
      let hasAccess = isGlobalRole;
      if (!hasAccess) {
        if (role === 'relationship_officer') {
          hasAccess = data.booked_by === userId;
        } else if (['branch_manager', 'customer_service_officer'].includes(role)) {
          hasAccess = data.branch_id === branch_id;
        } else if (role === 'regional_manager') {
          hasAccess = data.region_id === region_id;
        }
      }

      if (!hasAccess) {
        console.warn("Access denied: User does not have permission to review this loan.");
        setLoanDetails(null);
        return;
      }

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
    const { data: walletTxns, error } = await supabase
      .from("customer_wallets")
      .select("credit, debit")                    // ⬅ use new columns
      .eq("customer_id", loanData.customer_id);

    if (error) throw error;

    // balance = sum(credit) - sum(debit)
    const balance =
      walletTxns?.reduce(
        (sum, t) => sum + (Number(t.credit || 0) - Number(t.debit || 0)),
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


  // Check if all required fees are paid
  const areFeesFullyPaid = () => {
    if (!loanDetails) return false;
    
    // For new loans: both registration and processing fees must be paid
    if (loanDetails.is_new_loan) {
      return walletInfo.registration_fee_paid && walletInfo.processing_fee_paid;
    }
    
    // For Repite loans: only processing fee must be paid
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

// Legacy approval logic removed

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

  if (!profile) return null;

  if (!loanDetails || !customer) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center">
        <Spinner text="Loading loans..." />
      </div>
    );
  }

  const feesPaid = areFeesFullyPaid();
  const feeMessage = getFeePaymentMessage();

  return (
    <div className="min-h-screen bg-muted text-gray-800 p-6">
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xsm  bg-slate-600 bg-clip-text text-transparent">
                Loan Review & Approval
              </h1>

            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-indigo-600">
                Loan #{loanDetails.id}
              </div>
              <div className="text-sm text-gray-500">
                Type: <span className={`font-semibold ${loanDetails.is_new_loan ? 'text-green-600' : 'text-blue-600'}`}>
                  {loanDetails.is_new_loan ? 'New Loan' : 'Repite Loan'}
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





        {/* Manager Decision Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mt-8 border border-gray-200">
          <h3 className="text-lg font-semibold text-slate-600 flex items-center mb-6">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-blue-600 mr-3" />
            Decision Panel
          </h3>
          
          <div className="space-y-6">
            <div>
              <WorkflowActionPanel 
                entityId={loan.id} 
                entityType="loan" 
                onActionComplete={() => {
                  fetchLoanDetails();
                  onComplete?.();
                }}
              />
            </div>


          </div>
        </div>
      </div>
    </div>
  );
};

export default ApproveLoan;