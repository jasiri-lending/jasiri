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
  ArrowLeftIcon,
  PhoneIcon,
  EnvelopeIcon,
  DocumentTextIcon as NotesIcon
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";

// SMS Service Configuration
const CELCOM_AFRICA_CONFIG = {
  baseUrl: 'https://isms.celcomafrica.com/api/services/sendsms',
  apiKey: '17323514aa8ce2613e358ee029e65d99',
  partnerID: '928',
  defaultShortcode: 'MularCredit'
};

// SMS Service Functions
// SMS Service Functions - UPDATED with customer_id support
const SMSService = {
  formatPhoneNumberForSMS(phone) {
    if (!phone) {
      console.warn('Empty phone number provided');
      return '';
    }
    
    let cleaned = String(phone).replace(/\D/g, '');
    
    console.log('Formatting phone:', phone, '-> cleaned:', cleaned);
    
    if (cleaned.startsWith('254')) {
      if (cleaned.length === 12) {
        return cleaned;
      } else if (cleaned.length === 13 && cleaned.startsWith('2540')) {
        return '254' + cleaned.substring(4);
      }
    } else if (cleaned.startsWith('0')) {
      if (cleaned.length === 10) {
        return '254' + cleaned.substring(1);
      } else if (cleaned.length === 11 && cleaned.startsWith('07')) {
        return '254' + cleaned.substring(2);
      }
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      if (cleaned.length === 9) {
        return '254' + cleaned;
      } else if (cleaned.length === 10 && (cleaned.startsWith('70') || cleaned.startsWith('71') || cleaned.startsWith('72') || cleaned.startsWith('11'))) {
        return '254' + cleaned.substring(1);
      }
    }
    
    console.error('Invalid phone number format:', phone, 'cleaned:', cleaned);
    return '';
  },

  async sendSMS(phoneNumber, message, shortcode = CELCOM_AFRICA_CONFIG.defaultShortcode, customerId = null) {
    try {
      const formattedPhone = this.formatPhoneNumberForSMS(phoneNumber);
      
      if (!formattedPhone) {
        const errorMsg = `Invalid phone number format: ${phoneNumber}`;
        console.error('❌ SMS Error:', errorMsg);
        throw new Error(errorMsg);
      }

      if (!message || message.trim().length === 0) {
        throw new Error('Message cannot be empty');
      }

      const encodedMessage = encodeURIComponent(message.trim());
      const endpoint = `${CELCOM_AFRICA_CONFIG.baseUrl}/?apikey=${CELCOM_AFRICA_CONFIG.apiKey}&partnerID=${CELCOM_AFRICA_CONFIG.partnerID}&message=${encodedMessage}&shortcode=${shortcode}&mobile=${formattedPhone}`;

      console.log('🚀 Sending SMS via Celcom Africa to:', formattedPhone, 'Customer ID:', customerId);

      const response = await fetch(endpoint, {
        method: 'GET',
        mode: 'no-cors',
      });

      console.log('✅ SMS request sent successfully to:', formattedPhone);

      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await this.logSMS(
        formattedPhone,
        message,
        'sent',
        shortcode,
        undefined,
        messageId,
        0,
        customerId  // Pass customer_id here
      );

      return {
        success: true,
        message: 'SMS sent successfully',
        messageId: messageId,
        cost: 0,
        recipient: formattedPhone
      };
      
    } catch (error) {
      console.error('❌ SMS sending error:', error);
      
      const formattedPhone = this.formatPhoneNumberForSMS(phoneNumber);
      if (formattedPhone) {
        await this.logSMS(
          formattedPhone,
          message,
          'failed',
          shortcode,
          error.message,
          null,
          0,
          customerId  // Pass customer_id even on failure
        );
      }
      
      return { 
        success: false, 
        error: error.message,
        originalNumber: phoneNumber
      };
    }
  },

  async logSMS(recipientPhone, message, status, senderId, errorMessage, messageId, cost, customerId) {
    try {
      const logData = {
        recipient_phone: recipientPhone,
        message: message,
        status: status,
        error_message: errorMessage,
        message_id: messageId,
        sender_id: senderId,
        cost: cost,
        customer_id: customerId  // Include customer_id in log
      };

      console.log('📝 Logging SMS:', logData);

      const { error } = await supabase
        .from('sms_logs')
        .insert(logData);

      if (error) {
        console.error('Failed to log SMS:', error);
      } else {
        console.log('✅ SMS logged successfully with customer_id:', customerId);
      }
    } catch (error) {
      console.error('Error logging SMS:', error);
    }
  },

  async sendLoanDisbursementNotification(customerName, phoneNumber, amount, loanId, transactionId, customerId = null) {
    const message = `Dear ${customerName}, your loan of KES ${amount.toLocaleString()} has been disbursed successfully. Transaction ID: ${transactionId}. Loan ID: ${loanId}. Funds will reflect in your account shortly. Thank you for choosing Mular Credit!`;
    
    return await this.sendSMS(phoneNumber, message, CELCOM_AFRICA_CONFIG.defaultShortcode, customerId);
  },

  async sendLoanApprovalNotification(customerName, phoneNumber, amount, loanId, customerId = null) {
    const message = `Dear ${customerName}, congratulations! Your loan application for KES ${amount.toLocaleString()} has been approved. Loan ID: ${loanId}. You will receive the funds shortly. - Mular Credit`;
    
    return await this.sendSMS(phoneNumber, message, CELCOM_AFRICA_CONFIG.defaultShortcode, customerId);
  }
};

// PRODUCTION M-Pesa Service - REAL TRANSACTIONS ONLY
const MpesaService = {
  async processLoanDisbursement(phoneNumber, amount, customerName, loanId, notes = '', processedBy = null) {
    try {
      const formattedPhone = SMSService.formatPhoneNumberForSMS(phoneNumber);
      
      if (!formattedPhone) {
        throw new Error(`Invalid phone number format: ${phoneNumber}`);
      }

      console.log(`💰 Processing M-Pesa loan disbursement:`, {
        customer: customerName,
        amount,
        phone: formattedPhone,
        loanId,
        notes
      });
      
      // PRODUCTION ENDPOINT ONLY
      const MPESA_API_BASE = 'https://mpesa-22p0.onrender.com/api';
      
      // EXACT PAYLOAD MATCHING YOUR BACKEND
      const payload = {
        phoneNumber: formattedPhone,
        amount: Math.round(amount),
        employeeNumber: loanId,
        fullName: customerName
      };

      console.log('📤 M-Pesa Payload:', payload);

      const response = await fetch(`${MPESA_API_BASE}/mpesa/b2c`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('M-Pesa API Error Response:', errorText);
        throw new Error(`M-Pesa API returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      console.log('✅ M-Pesa loan disbursement processed:', result);
      
      // Log the successful transaction
      await this.logMpesaTransaction({
        loanId,
        phoneNumber: formattedPhone,
        amount,
        customerName,
        transactionId: result.transactionId || `B2C_${Date.now()}`,
        status: 'success',
        response: result,
        notes: notes,
        processedBy: processedBy
      });
      
      return {
        success: true,
        message: result.message || 'Disbursement processed successfully',
        transactionId: result.transactionId || `B2C_${Date.now()}`,
        rawResponse: result
      };
      
    } catch (error) {
      console.error('❌ M-Pesa loan disbursement error:', error);
      
      // Log failed transaction - NO MOCK FALLBACK
      await this.logMpesaTransaction({
        loanId,
        phoneNumber,
        amount,
        customerName,
        status: 'failed',
        error: error.message,
        notes: notes,
        processedBy: processedBy
      });
      
      throw new Error(`M-Pesa disbursement failed: ${error.message}`);
    }
  },

  async logMpesaTransaction(transactionData) {
    try {
      const { error } = await supabase
        .from('loan_disbursement_transactions')
        .insert({
          loan_id: transactionData.loanId,
          customer_phone: transactionData.phoneNumber,
          amount: transactionData.amount,
          customer_name: transactionData.customerName,
          transaction_id: transactionData.transactionId,
          status: transactionData.status,
          response_data: transactionData.response,
          error_message: transactionData.error,
          notes: transactionData.notes,
          is_mock: false,
          processed_by: transactionData.processedBy,
          processed_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to log M-Pesa transaction:', error);
      }
    } catch (error) {
      console.error('Error logging M-Pesa transaction:', error);
    }
  },

  async getLoanTransactions(loanId) {
    try {
      const { data, error } = await supabase
        .from('loan_disbursement_transactions')
        .select(`
          *,
          processed_by_user:processed_by (
            id,
            full_name,
            email
          )
        `)
        .eq('loan_id', loanId)
        .order('processed_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching loan transactions:', error);
      return [];
    }
  }
};

// Disbursement Notes Modal Component
const DisbursementNotesModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  loanDetails, 
  customer,
  isLoading = false 
}) => {
  const [notes, setNotes] = useState('');
  const [includeSMS, setIncludeSMS] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setNotes('');
      setIncludeSMS(true);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!notes.trim()) {
      toast.error('Please provide disbursement notes');
      return;
    }
    onConfirm(notes.trim(), includeSMS);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <NotesIcon className="h-5 w-5 text-blue-600" />
          Loan Disbursement Notes
        </h3>
        
        <div className="mb-4">
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="text-sm text-gray-700">
              <div className="font-semibold">{customer?.Firstname} {customer?.Surname}</div>
              <div>Loan ID: #{loanDetails?.id}</div>
              <div>Amount: KES {loanDetails?.scored_amount?.toLocaleString()}</div>
              <div>Phone: {customer?.mobile}</div>
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-2">
            Disbursement Notes <span className="text-red-500">*</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter notes for this disbursement (required for audit trail)..."
            rows={4}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            These notes will be recorded in the transaction history and audit trail.
          </p>
        </div>

        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeSMS}
              onChange={(e) => setIncludeSMS(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              Send SMS notification to customer
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            Customer will receive an SMS confirmation with transaction details.
          </p>
        </div>
        
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !notes.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <CurrencyDollarIcon className="w-4 h-4" />
                Confirm Disbursement
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Transaction History Modal Component
const TransactionHistoryModal = ({ 
  isOpen, 
  onClose, 
  transactions,
  isLoading = false 
}) => {
  if (!isOpen) return null;

  const getStatusBadge = (status) => {
    const config = {
      success: { bg: 'bg-green-100', text: 'text-green-800', label: 'Success' },
      failed: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
      processing: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Processing' }
    };
    const statusConfig = config[status] || config.failed;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
        {statusConfig.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Disbursement Transaction History</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
              <p className="text-gray-600">No disbursement transactions have been recorded for this loan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed By</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {new Date(transaction.processed_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                        {transaction.transaction_id || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        KES {transaction.amount?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getStatusBadge(transaction.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                        <div className="line-clamp-2">{transaction.notes || 'No notes'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {transaction.processed_by_user?.full_name || 'System'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
  const [processingDisbursement, setProcessingDisbursement] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState(null);
  const [smsStatus, setSmsStatus] = useState(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

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
        .select("credit, debit")                    
        .eq("customer_id", loanData.customer_id);

      if (error) throw error;

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

  // PRODUCTION-ONLY DISBURSEMENT HANDLER
  const handleDisbursementWithNotes = async (notes, includeSMS) => {
    if (!areFeesFullyPaid()) {
      toast.error("Cannot disburse loan. Required fees have not been fully paid.");
      return;
    }

    // Validate user session first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      toast.error("Authentication error. Please log in again.");
      navigate('/login');
      return;
    }

    setProcessingDisbursement(true);
    setMpesaStatus(null);
    setSmsStatus(null);
    setShowNotesModal(false);

    try {
      // Step 1: Process REAL M-Pesa disbursement
      setMpesaStatus('processing');
      toast.info("🔄 Processing M-Pesa disbursement...");

      const mpesaResult = await MpesaService.processLoanDisbursement(
        customer.mobile,
        loanDetails.scored_amount,
        `${customer.Firstname} ${customer.Surname}`,
        loanDetails.id,
        notes,
        user.id
      );

      if (mpesaResult.success) {
        setMpesaStatus('success');
        toast.success("💰 M-Pesa disbursement processed successfully! Money has been sent.");

        // Step 2: Send SMS notification if requested
        if (includeSMS) {
          setSmsStatus('processing');
          toast.info("📱 Sending disbursement notification...");

          const smsResult = await SMSService.sendLoanDisbursementNotification(
            `${customer.Firstname} ${customer.Surname}`,
            customer.mobile,
            loanDetails.scored_amount,
            loanDetails.id,
            mpesaResult.transactionId
          );

          if (smsResult.success) {
            setSmsStatus('success');
            toast.success("✅ SMS notification sent successfully!");
          } else {
            setSmsStatus('failed');
            toast.warning("📱 Money sent but SMS notification failed");
          }
        }

        // Step 3: Update loan status in database
        const { error } = await supabase
          .from("loans")
          .update({
            status: 'disbursed',
            disbursed_at: new Date().toISOString(),
            mpesa_transaction_id: mpesaResult.transactionId,
            disbursement_notes: notes,
            disbursed_by: user.id
          })
          .eq("id", id);

        if (error) {
          console.error("Error updating loan status:", error);
          throw new Error("Failed to update loan status in database");
        }

        toast.success("✅ Loan disbursed successfully! Money has been transferred to customer.");
        
        setTimeout(() => {
          navigate('/pending-disbursements');
        }, 3000);
        
      } else {
        setMpesaStatus('failed');
        throw new Error(mpesaResult.message || 'M-Pesa disbursement failed');
      }

    } catch (error) {
      console.error("❌ Error during loan disbursement:", error);
      setMpesaStatus('failed');
      
      // Specific error messages for production
      if (error.message.includes('Failed to fetch')) {
        toast.error("🌐 Network error: Cannot connect to M-Pesa service. Please check your internet connection.");
      } else if (error.message.includes('Invalid phone number')) {
        toast.error("📱 Invalid customer phone number format. Please verify the mobile number.");
      } else if (error.message.includes('insufficient funds')) {
        toast.error("💸 Insufficient funds in M-Pesa business account. Please contact finance.");
      } else if (error.message.includes('timeout')) {
        toast.error("⏰ M-Pesa service timeout. Please try again.");
      } else {
        toast.error(`❌ Disbursement failed: ${error.message}`);
      }
    } finally {
      setProcessingDisbursement(false);
    }
  };

  const sendTestSMS = async () => {
    if (!customer) return;

    try {
      setSmsStatus('processing');
      toast.info("Sending test SMS...");

      const result = await SMSService.sendLoanApprovalNotification(
        `${customer.Firstname} ${customer.Surname}`,
        customer.mobile,
        loanDetails.scored_amount,
        loanDetails.id
      );

      if (result.success) {
        setSmsStatus('success');
        toast.success("Test SMS sent successfully!");
      } else {
        setSmsStatus('failed');
        toast.error(`Failed to send SMS: ${result.error}`);
      }
    } catch (error) {
      setSmsStatus('failed');
      toast.error(`SMS error: ${error.message}`);
    }
  };

  const viewTransactionHistory = async () => {
    setLoadingTransactions(true);
    setShowTransactionHistory(true);
    
    try {
      const transactionData = await MpesaService.getLoanTransactions(id);
      setTransactions(transactionData);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      toast.error('Failed to load transaction history');
    } finally {
      setLoadingTransactions(false);
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
                  <span className="text-gray-900 font-semibold flex items-center">
                    <PhoneIcon className="h-4 w-4 mr-1 text-green-600" />
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

          {/* M-Pesa & SMS Status */}
          {(mpesaStatus || smsStatus) && (
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-slate-600 flex items-center mb-6">
                <EnvelopeIcon className="h-6 w-6 text-blue-600 mr-3" />
                Disbursement Status
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* M-Pesa Status */}
                <div className={`p-4 rounded-lg border-2 ${
                  mpesaStatus === 'success' ? 'bg-green-50 border-green-200' :
                  mpesaStatus === 'failed' ? 'bg-red-50 border-red-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700">M-Pesa Disbursement</span>
                    {mpesaStatus === 'processing' && (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                    )}
                    {mpesaStatus === 'success' && (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    )}
                    {mpesaStatus === 'failed' && (
                      <XCircleIcon className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {mpesaStatus === 'processing' && 'Processing payment...'}
                    {mpesaStatus === 'success' && 'Payment processed successfully'}
                    {mpesaStatus === 'failed' && 'Payment processing failed'}
                  </p>
                </div>

                {/* SMS Status */}
                <div className={`p-4 rounded-lg border-2 ${
                  smsStatus === 'success' ? 'bg-green-50 border-green-200' :
                  smsStatus === 'failed' ? 'bg-red-50 border-red-200' :
                  smsStatus === 'processing' ? 'bg-blue-50 border-blue-200' :
                  'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700">SMS Notification</span>
                    {smsStatus === 'processing' && (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                    )}
                    {smsStatus === 'success' && (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    )}
                    {smsStatus === 'failed' && (
                      <XCircleIcon className="h-5 w-5 text-red-500" />
                    )}
                    {!smsStatus && (
                      <ExclamationTriangleIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {smsStatus === 'processing' && 'Sending notification...'}
                    {smsStatus === 'success' && 'Notification sent successfully'}
                    {smsStatus === 'failed' && 'Failed to send notification'}
                    {!smsStatus && 'Not sent'}
                  </p>
                </div>
              </div>
            </div>
          )}

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
            
            {isCreditAnalyst && (
              <div className="flex gap-4 flex-wrap">
                {feesPaid && (
                  <>
                    <button
                      onClick={() => setShowNotesModal(true)}
                      disabled={processingDisbursement}
                      className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CurrencyDollarIcon className="h-6 w-6" />
                      Process Disbursement
                    </button>
                    
                    <button
                      onClick={viewTransactionHistory}
                      className="flex items-center gap-3 px-6 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-semibold text-lg"
                    >
                      <DocumentTextIcon className="h-5 w-5" />
                      View History
                    </button>
                  </>
                )}
                
                <button
                  onClick={sendTestSMS}
                  disabled={!customer?.mobile}
                  className="flex items-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <EnvelopeIcon className="h-5 w-5" />
                  Send Test SMS
                </button>
                
                <button
                  onClick={() => navigate('/pending-disbursements')}
                  className="flex items-center gap-3 px-6 py-4 bg-white text-gray-700 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all font-semibold text-lg"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Disbursement Notes Modal */}
      <DisbursementNotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        onConfirm={handleDisbursementWithNotes}
        loanDetails={loanDetails}
        customer={customer}
        isLoading={processingDisbursement}
      />

      {/* Transaction History Modal */}
      <TransactionHistoryModal
        isOpen={showTransactionHistory}
        onClose={() => setShowTransactionHistory(false)}
        transactions={transactions}
        isLoading={loadingTransactions}
      />
    </div>
  );
};

export default ViewLoansPendingDisbursement;