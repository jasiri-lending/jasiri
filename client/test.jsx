import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { usePermissions } from "../../hooks/usePermissions";
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
  DocumentTextIcon as NotesIcon,
  LockClosedIcon as LockIcon
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";

const _smsConfigCache = new Map();

const SMSService = {
  // ── Config Loader (with in-memory cache) ──────────────────────────────────
  async getConfig(tenantId) {
    if (!tenantId) throw new Error('tenantId is required to load SMS configuration');

    // Return cached config if available
    if (_smsConfigCache.has(tenantId)) {
      return _smsConfigCache.get(tenantId);
    }

    const { data, error } = await supabase
      .from('tenant_sms_settings')
      .select('base_url, api_key, partner_id, shortcode')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      console.error(`[SMSService] Failed to load config for tenant ${tenantId}:`, error);
      throw new Error(`SMS configuration not found for tenant: ${tenantId}`);
    }

    const config = {
      baseUrl: data.base_url,
      apiKey: data.api_key,
      partnerID: data.partner_id,
      defaultShortcode: data.shortcode,
    };

    // Store in cache
    _smsConfigCache.set(tenantId, config);
    console.log(`[SMSService] Config loaded and cached for tenant: ${tenantId}`);

    return config;
  },

  // ── Clear cache for a tenant (call this if credentials are updated) ────────
  clearConfigCache(tenantId = null) {
    if (tenantId) {
      _smsConfigCache.delete(tenantId);
      console.log(`[SMSService] Cache cleared for tenant: ${tenantId}`);
    } else {
      _smsConfigCache.clear();
      console.log('[SMSService] Entire SMS config cache cleared');
    }
  },

  // ── Phone Number Formatter ─────────────────────────────────────────────────
  formatPhoneNumberForSMS(phone) {
    if (!phone) {
      console.warn('[SMSService] Empty phone number provided');
      return '';
    }

    let cleaned = String(phone).replace(/\D/g, '');
    console.log(`[SMSService] Formatting phone: ${phone} -> cleaned: ${cleaned}`);

    if (cleaned.startsWith('254')) {
      if (cleaned.length === 12) return cleaned;
      if (cleaned.length === 13 && cleaned.startsWith('2540')) return '254' + cleaned.substring(4);
    } else if (cleaned.startsWith('0')) {
      if (cleaned.length === 10) return '254' + cleaned.substring(1);
      if (cleaned.length === 11 && cleaned.startsWith('07')) return '254' + cleaned.substring(2);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      if (cleaned.length === 9) return '254' + cleaned;
      if (cleaned.length === 10 && /^(70|71|72|11)/.test(cleaned)) return '254' + cleaned.substring(1);
    }

    console.error(`[SMSService] Invalid phone number format: ${phone} (cleaned: ${cleaned})`);
    return '';
  },

  // ── Core Send Function ─────────────────────────────────────────────────────
  async sendSMS(phoneNumber, message, tenantId, shortcode = null) {
    let formattedPhone = '';

    try {
      if (!tenantId) throw new Error('tenantId is required to send SMS');

      const config = await this.getConfig(tenantId);
      const effectiveShortcode = shortcode || config.defaultShortcode;

      formattedPhone = this.formatPhoneNumberForSMS(phoneNumber);
      if (!formattedPhone) throw new Error(`Invalid phone number format: ${phoneNumber}`);
      if (!message?.trim()) throw new Error('Message cannot be empty');

      const encodedMessage = encodeURIComponent(message.trim());
      const endpoint = `${config.baseUrl}/?apikey=${config.apiKey}&partnerID=${config.partnerID}&message=${encodedMessage}&shortcode=${effectiveShortcode}&mobile=${formattedPhone}`;

      console.log(`[SMSService] Sending SMS to ${formattedPhone} via tenant ${tenantId}`);

      await fetch(endpoint, { method: 'GET', mode: 'no-cors' });

      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      await this.logSMS({
        recipientPhone: formattedPhone,
        message,
        status: 'sent',
        senderId: effectiveShortcode,
        messageId,
        cost: 0,
        tenantId,
      });

      console.log(`[SMSService] ✅ SMS sent successfully to ${formattedPhone}`);
      return { success: true, messageId, recipient: formattedPhone };

    } catch (error) {
      console.error(`[SMSService] ❌ Failed to send SMS to ${phoneNumber}:`, error.message);

      if (formattedPhone) {
        await this.logSMS({
          recipientPhone: formattedPhone,
          message,
          status: 'failed',
          errorMessage: error.message,
          tenantId,
        });
      }

      return { success: false, error: error.message, originalNumber: phoneNumber };
    }
  },

  // ── SMS Logger ─────────────────────────────────────────────────────────────
  async logSMS({ recipientPhone, message, status, senderId, errorMessage, messageId, cost, customerId, tenantId }) {
    try {
      const { error } = await supabase
        .from('sms_logs')
        .insert({
          recipient_phone: recipientPhone,
          message,
          status,
          sender_id: senderId || null,
          error_message: errorMessage || null,
          message_id: messageId || null,
          customer_id: customerId || null,
          cost: cost ?? null,
          tenant_id: tenantId || null,
        });

      if (error) console.error('[SMSService] Failed to log SMS:', error);
    } catch (err) {
      console.error('[SMSService] Error logging SMS:', err);
    }
  },

  // ── Notification Helpers ───────────────────────────────────────────────────
  async sendLoanDisbursementNotification({ customerName, phoneNumber, amount, loanId, transactionId, tenantId }) {
    const message = `Dear ${customerName}, your loan of KES ${amount.toLocaleString()} has been disbursed successfully. Transaction ID: ${transactionId}. Loan ID: ${loanId}. Funds will reflect in your account shortly. Thank you for choosing us!`;
    return await this.sendSMS(phoneNumber, message, tenantId);
  },

  async sendLoanApprovalNotification({ customerName, phoneNumber, amount, loanId, tenantId }) {
    const message = `Dear ${customerName}, congratulations! Your loan application for KES ${amount.toLocaleString()} has been approved. Loan ID: ${loanId}. You will receive the funds shortly.`;
    return await this.sendSMS(phoneNumber, message, tenantId);
  },
};



// PRODUCTION M-Pesa Service - REAL TRANSACTIONS ONLY
const MpesaService = {
  async processLoanDisbursement(phoneNumber, amount, customerName, loanId, notes = '', processedBy = null) {
    try {
      const formattedPhone = SMSService.formatPhoneNumberForSMS(phoneNumber);

      if (!formattedPhone) {
        throw new Error(`Invalid phone number format: ${phoneNumber}`);
      }

      console.log(` Processing M-Pesa loan disbursement:`, {
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

      console.log(' M-Pesa Payload:', payload);

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

      console.log(' M-Pesa loan disbursement processed:', result);

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
      <div className="bg-brand-surface rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <NotesIcon className="h-5 w-5 text-blue-600" />
          Loan Disbursement Notes
        </h3>

        <div className="mb-4">
          <div className="bg-amber-50 rounded-lg p-3 mb-3">
            <div className="text-sm text-gray-700">
              <div className="font-semibold">{customer?.Firstname} {customer?.Surname}</div>
              <div>Loan ID: #{loanDetails?.id}</div>
              <div>Amount: KES {loanDetails?.scored_amount?.toLocaleString()}</div>
              <div>Phone: {customer?.mobile}</div>
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-600 mb-2">
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
            className="px-4 py-2 text-sm font-medium text-white bg-brand-btn rounded-md hover:bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
      <div className="bg-brand-surface rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
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

  const { hasPermission, loading: permsLoading, permissions } = usePermissions();
  const canDisburse = hasPermission('loan.disburse');
  const canViewReport = hasPermission('view_pending_disbursement_report');

  useEffect(() => {
    if (!authLoading && !permsLoading) {
      console.log("Debug: Permissions Check", {
        role: profile?.role,
        tenant_id: profile?.tenant_id,
        permissions: permissions,
        canDisburse: canDisburse
      });
    }
  }, [profile, permissions, authLoading, permsLoading, canDisburse]);

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
        .eq('tenant_id', profile?.tenant_id)
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

  if (loading || permsLoading) {
    return (
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Removed blocking canViewReport check. Page is now always accessible.

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
        <Spinner text="Loading loan details..." />
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
    <div className="min-h-screen bg-brand-surface py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}


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
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${loanDetails.is_new_loan ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
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
                <div className={`p-4 rounded-lg border-2 ${mpesaStatus === 'success' ? 'bg-green-50 border-green-200' :
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
                <div className={`p-4 rounded-lg border-2 ${smsStatus === 'success' ? 'bg-green-50 border-green-200' :
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
          <div className={`rounded-2xl shadow-lg p-6 border ${feesPaid
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
                  <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${step.decision === 'approved' ? 'bg-green-500' :
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
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${step.decision === 'approved'
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
          <div className={`rounded-2xl p-8 border-2 ${canDisburse && feesPaid
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
            : canDisburse && !feesPaid
              ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300'
              : 'bg-gradient-to-r from-gray-50 to-blue-50 border-gray-300'
            }`}>
            <h3 className="text-sm font-semibold text-slate-600 flex items-center mb-4">
              {canDisburse && feesPaid ? (
                <>
                  <CheckCircleIcon className="h-7 w-7 text-accent mr-3" />
                  Ready for Disbursement
                </>
              ) : canDisburse && !feesPaid ? (
                <>
                  <ExclamationTriangleIcon className="h-7 w-7 text-amber-600 mr-3" />
                  Fees Payment Required
                </>
              ) : (
                <>
                  <LockClosedIcon className="h-7 w-7 text-gray-600 mr-3" />
                  No Permission to Disburse
                </>
              )}
            </h3>
            <p className="text-gray-700 mb-6 text-xs">
              {canDisburse && feesPaid
                ? "This loan has been fully approved and all required fees have been paid. You can now proceed with disbursement."
                : canDisburse && !feesPaid
                  ? "This loan has been approved but required fees have not been fully paid. Disbursement will be available once all fees are settled."
                  : "You do not have the required permissions to disburse this loan."}
            </p>

            {canDisburse && (
              <div className="flex gap-3 flex-wrap">
                {feesPaid && (
                  <>
                    <button
                      onClick={() => setShowNotesModal(true)}
                      disabled={processingDisbursement}
                      className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CurrencyDollarIcon className="h-4 w-4" />
                      Process Disbursement
                    </button>

                    <button
                      onClick={viewTransactionHistory}
                      className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-brand-primary transition-all font-medium text-sm"
                    >
                      <DocumentTextIcon className="h-4 w-4" />
                      View History
                    </button>
                  </>
                )}

                <button
                  onClick={sendTestSMS}
                  disabled={!customer?.mobile}
                  className="flex items-center gap-2 px-3 py-1.5 bg-brand-btn text-white rounded-lg transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <EnvelopeIcon className="h-4 w-4" />
                  Send Test SMS
                </button>

                <button
                  onClick={() => navigate('/pending-disbursements')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium text-sm"
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

























import { useState, useEffect } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Share2,
  Printer,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useParams } from "react-router-dom";

const CustomerStatementModal = () => {
  // Load tenant from localStorage for company_name in exports
  const [tenant] = useState(() => {
    try {
      const saved = localStorage.getItem("tenant");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const { customerId } = useParams();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(40);
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [exportFormat, setExportFormat] = useState("csv");
  const [reportTimestamp, setReportTimestamp] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerInfo, setCustomerInfo] = useState({});

  // Statement period state
  const [statementPeriod, setStatementPeriod] = useState({
    startDate: "",
    endDate: "",
    period: ""
  });

  // Summary state
  const [statementSummary, setStatementSummary] = useState({
    totalLoanAmount: 0,
    principal: 0,
    interest: 0,
    totalPaid: 0,
    outstandingBalance: 0
  });

  // Set report timestamp on component mount
  useEffect(() => {
    setReportTimestamp(new Date().toLocaleString("en-KE"));

    // Set initial statement period
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    setStatementPeriod({
      startDate: firstDayOfMonth.toLocaleDateString("en-KE"),
      endDate: lastDayOfMonth.toLocaleDateString("en-KE"),
      period: "Monthly"
    });
  }, []);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!customerId) return;
      setLoading(true);

      try {
        const events = [];
        let runningBalance = 0;

        // 1️ Customer Info
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("id, Firstname,Surname, mobile, created_at")
          .eq("id", customerId)
          .single();

        if (customerError || !customer) {
          console.error(" Customer not found:", customerError?.message);
          setLoading(false);
          return;
        }

        setCustomerInfo(customer);

        // 2️ Loans
        const { data: loans = [] } = await supabase
          .from("loans")
          .select("id, scored_amount, processing_fee, registration_fee, disbursed_at, disbursed_date, created_at, total_payable, total_interest")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: true });

        // 3️ Loan Payments - FIXED: Get all loan payments for summary
        const { data: loanPayments = [], error: loanPaymentsError } = await supabase
          .from("loan_payments")
          .select(`
          id,
          loan_id,
          installment_id,
          paid_amount,
          balanceBefore,
          balance_after,
          mpesa_receipt,
          phone_number,
          paid_at,
          payment_type
        `)
          .in("loan_id", loans.map(l => l.id))
          .order("paid_at", { ascending: true });

        if (loanPaymentsError) {
          console.error(" Loan payments fetch failed:", loanPaymentsError.message);
        }

        // 4️ Loan Installments - FIXED: Get installments to calculate principal_paid + interest_paid
        const { data: loanInstallments = [], error: installmentsError } = await supabase
          .from("loan_installments")
          .select(`
          id,
          loan_id,
          principal_paid,
          interest_paid,
          paid_amount,
          status
        `)
          .in("loan_id", loans.map(l => l.id));

        if (installmentsError) {
          console.error(" Loan installments fetch failed:", installmentsError.message);
        }

        // Create a set of M-Pesa codes that are loan payments (to exclude from deposits)
        const loanPaymentMpesaCodes = new Set(
          (loanPayments || []).map(p => p.mpesa_receipt).filter(Boolean)
        );

        // 5️ C2B Payments (excluding those already in loan_payments)
        const normalizedMobile = customer.mobile?.replace(/^\+?254|^0/, "254");

        const { data: c2b = [], error: c2bError } = await supabase
          .from("mpesa_c2b_transactions")
          .select("id, amount, transaction_time, transaction_id, loan_id, phone_number, status, payment_type, reference, billref")
          .eq("status", "applied")
          .in("phone_number", [customer.mobile, normalizedMobile])
          .order("transaction_time", { ascending: true });

        if (c2bError) console.error(" C2B fetch error:", c2bError.message);

        // 6️ Loan Disbursement Transactions
        const { data: disbursements = [] } = await supabase
          .from("loan_disbursement_transactions")
          .select("id, amount, transaction_id, loan_id, processed_at, status")
          .eq("status", "success")
          .in("loan_id", loans.map(l => l.id))
          .order("processed_at", { ascending: true });

        // 7️ Wallet Transactions (Credits and Debits)
        const { data: walletTransactions, error: walletError } = await supabase
          .from("customer_wallets")
          .select("id, amount, created_at, mpesa_reference, type, narration, transaction_type")
          .eq("customer_id", customerId)
          .eq("tenant_id", tenant?.id)
          .order("created_at", { ascending: true });

        if (walletError) console.error(" Wallet fetch failed:", walletError.message);

        // Track processed transaction IDs to prevent duplicates
        const processedTransactionIds = new Set();

        // STEP 1: WALLET TRANSACTIONS (Including Joining Fee, Processing Fee, Deposits)
        (walletTransactions || []).forEach(w => {
          const transactionKey = `wallet-${w.id}`;
          if (processedTransactionIds.has(transactionKey)) return;
          processedTransactionIds.add(transactionKey);

          const amt = Number(w.amount || 0);

          // Standardize Naming based on transaction_type or narration
          let description = w.narration || "Wallet Transaction";
          let sequence = 10; // Default sequence for other wallet movements

          if (w.transaction_type === "registration") {
            description = "Joining Fee";
            sequence = 0; // First in history
          } else if (w.transaction_type === "processing") {
            description = "Processing Fee";
            sequence = 2; // Part of disbursement block
          } else if (w.narration?.toLowerCase().includes("credited to wallet")) {
            description = "Mobile Money Deposit";
            sequence = 4; // Treated as a deposit
          }

          // Balance = Prev + Credit - Debit
          // User wants wallet deposits as Debits (reducing debt? or just how their DB is)
          // 0 - 802 = -802. -802 - (-500) = -302.
          events.push({
            id: transactionKey,
            date: new Date(w.created_at),
            description: description,
            reference: w.mpesa_reference || "-",
            debit: amt, // Show raw amount (can be negative for fees)
            credit: 0,
            amount: -amt, // Subtract debit from balance
            sequence: sequence,
            timestamp: new Date(w.created_at).getTime(),
          });
        });

        // STEP 2: MOBILE MONEY DEPOSITS (C2B - excluding those already handled in wallet or loan payments)
        (c2b || []).forEach(c => {
          // Check if this M-Pesa code was already handled in loan_payments or wallet
          const mpesaCode = c.transaction_id;
          const isLoanPayment = loanPaymentMpesaCodes.has(mpesaCode);
          const isWalletCredit = (walletTransactions || []).some(w => w.mpesa_reference === mpesaCode);

          if (isLoanPayment || isWalletCredit) return;

          const transactionKey = `c2b-${mpesaCode}`;
          if (processedTransactionIds.has(transactionKey)) return;
          processedTransactionIds.add(transactionKey);

          const depositAmount = Number(c.amount || 0);
          const txDate = new Date(c.transaction_time);
          events.push({
            id: transactionKey,
            date: txDate,
            description: "Mobile Money Deposit",
            reference: mpesaCode,
            debit: 0,
            credit: depositAmount,
            amount: depositAmount,
            sequence: 4, // Repayment credit
            timestamp: txDate.getTime(),
          });
        });

        // STEP 3: LOAN DISBURSEMENTS
        (loans || []).forEach(loan => {
          const disb = (disbursements || []).find(d => d.loan_id === loan.id);
          if (!disb) return;

          const loanDate = new Date(disb.processed_at);
          const baseTimestamp = loanDate.getTime();

          // 3a. Credit: Mobile Money Disbursement (sending funds to customer)
          const disbAmount = Number(disb.amount);

          events.push({
            id: `disb-credit-${disb.id}`,
            date: loanDate,
            description: "Mobile Money Disbursement",
            reference: disb.transaction_id || "-",
            debit: 0,
            credit: disbAmount,
            amount: disbAmount, // Increases balance
            sequence: 1, // Follows Joining Fee
            timestamp: baseTimestamp,
          });

          // Processing Fee (sequence 2) comes from Wallet STEP 1

          // 3b. Debit: Loan Disbursement (booking the debt obligation)
          events.push({
            id: `loan-disb-${loan.id}`,
            date: loanDate,
            description: "Loan Disbursement",
            reference: "-",
            debit: disbAmount,
            credit: 0,
            amount: -disbAmount, // Decreases balance
            sequence: 3, // Follows Processing Fee
            timestamp: baseTimestamp,
          });
        });

        // STEP 4: LOAN PAYMENTS (Grouped per M-Pesa code)
        if (loanPayments.length > 0) {
          // Group payments by mpesa_receipt
          const groupedPayments = loanPayments.reduce((acc, payment) => {
            const ref = payment.mpesa_receipt || "MPESA";
            if (!acc[ref]) acc[ref] = [];
            acc[ref].push(payment);
            return acc;
          }, {});

          // Process each grouped transaction
          for (const [ref, payments] of Object.entries(groupedPayments)) {
            const paymentDate = new Date(payments[0].paid_at);
            const baseTimestamp = paymentDate.getTime();
            const totalPaid = payments.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);

            // 4a. Credit once: Mobile Money Deposit (if not already handled via wallet/C2B)
            const transactionKey = `loanpayment-credit-${ref}`;
            if (!processedTransactionIds.has(`wallet-${ref}`) &&
              !processedTransactionIds.has(`c2b-${ref}`) &&
              !processedTransactionIds.has(transactionKey)) {

              processedTransactionIds.add(transactionKey);
              events.push({
                id: transactionKey,
                date: paymentDate,
                description: "Mobile Money Deposit",
                reference: ref,
                debit: 0,
                credit: totalPaid,
                amount: totalPaid,
                sequence: 4, // Repayment credit
                timestamp: baseTimestamp,
              });
            }

            // 4b. Debit for each payment allocation (principal, interest, penalty)
            payments.forEach((p, idx) => {
              const amt = Number(p.paid_amount || 0);
              if (!amt) return;

              // Naming Overrides
              let desc = "Loan Repayment";
              if (p.payment_type === "principal") desc = "Principal Repayment";
              else if (p.payment_type === "interest") desc = "Interest Repayment";
              else if (p.payment_type === "penalty") desc = "Penalty Repayment";

              events.push({
                id: `payment-debit-${p.id}`,
                date: paymentDate,
                description: desc,
                reference: ref,
                debit: amt,
                credit: 0,
                amount: -amt, // Decreases balance
                sequence: 5 + idx, // Details after Credit
                timestamp: baseTimestamp,
              });
            });
          }
        }

        // STEP 4b: PENALTIES (from installments)
        (loanInstallments || []).forEach(inst => {
          const penalty = Number(inst.net_penalty || inst.penalty_amount || 0);
          if (penalty > 0) {
            const penaltyDate = new Date(inst.due_date);
            // Penalties are usually charged the day after due date
            penaltyDate.setDate(penaltyDate.getDate() + 1);

            const transactionKey = `penalty-${inst.id}`;
            if (processedTransactionIds.has(transactionKey)) return;
            processedTransactionIds.add(transactionKey);

            events.push({
              id: transactionKey,
              date: penaltyDate,
              description: "Late Payment Penalty",
              reference: "-",
              debit: penalty,
              credit: 0,
              amount: -penalty,
              sequence: 8, // Penalties usually late in the sequence
              timestamp: penaltyDate.getTime(),
            });
          }
        });

        // STEP 5: SORT & CALCULATE RUNNING BALANCE
        // Sort chronologically (oldest first) by timestamp and then sequence
        events.sort((a, b) => {
          if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
          return a.sequence - b.sequence;
        });

        // Calculate running balance in correctly sorted order
        events.forEach(e => {
          runningBalance += e.amount;
          e.balance = runningBalance;
        });

        // Add Balance B/F at the top (current date, showing final balance)
        const balanceBF = {
          id: "balance-bf",
          date: new Date(),
          description: "Balance B/F",
          reference: "-",
          debit: 0,
          credit: 0,
          balance: runningBalance,
          sequence: 0,
          timestamp: new Date().getTime(),
          isBalanceBF: true
        };

        // Reverse to show newest first (Balance B/F on top)
        const sortedEvents = [balanceBF, ...events.reverse()];

        // Update statement period
        if (events.length > 0) {
          const transactionDates = events.map(t => new Date(t.date));
          const minDate = new Date(Math.min(...transactionDates));
          const maxDate = new Date(Math.max(...transactionDates));

          setStatementPeriod(prev => ({
            ...prev,
            startDate: minDate.toLocaleDateString("en-KE"),
            endDate: maxDate.toLocaleDateString("en-KE")
          }));
        }

        const customerLoans = loans || [];

        // 1️ Principal = total scored_amount for all this customer's loans
        const principal = customerLoans.reduce((sum, loan) => sum + (loan.scored_amount || 0), 0);

        // 2️ Interest = total_interest for all this customer's loans
        const interest = customerLoans.reduce((sum, loan) => sum + (loan.total_interest || 0), 0);

        // 3️ Total Payable (Loan Amount) = sum of total_payable (principal + interest) + penalties
        const basePayable = (customerLoans || []).reduce((sum, loan) => sum + (loan.total_payable || 0), 0);
        const totalPenalties = (loanInstallments || []).reduce((sum, i) => sum + Number(i.net_penalty || i.penalty_amount || 0), 0);
        const totalLoanAmount = basePayable + totalPenalties;

        // 4️ Total Paid - Source primarily from loan_payments
        let totalPaid = 0;
        let interestPaidTotal = 0;
        let principalPaidTotal = 0;
        let penaltyPaidTotal = 0;

        if ((loanPayments || []).length > 0) {
          loanPayments.forEach(p => {
            const amt = Number(p.paid_amount || 0);
            if (p.payment_type === "interest") {
              interestPaidTotal += amt;
            } else if (p.payment_type === "principal") {
              principalPaidTotal += amt;
            } else if (p.payment_type === "penalty") {
              penaltyPaidTotal += amt;
            }
            // Sum all for total paid against the loan
            totalPaid += amt;
          });
        } else if ((loanInstallments || []).length > 0) {
          totalPaid = (loanInstallments || []).reduce((sum, i) => sum + (i.paid_amount || 0), 0);
        }

        console.log('Summary Calculation (AccountList):', {
          totalLoanAmount,
          principal,
          interest: (interest || 0),
          totalPenalties,
          totalPaid,
          interestPaidTotal,
          principalPaidTotal,
          penaltyPaidTotal
        });

        // 5️ Outstanding Balance = Total Payable - Total Paid
        const outstandingBalance = totalLoanAmount - totalPaid;

        // Update summary
        setStatementSummary({
          totalLoanAmount,   // total payable from loans table
          principal,         // scored_amount
          interest,          // total_interest
          totalPaid,         // from loan_payments OR installments (principal_paid + interest_paid)
          outstandingBalance // total payable - total paid
        });

        setTransactions(sortedEvents);
        setFilteredTransactions(sortedEvents);

      } catch (err) {
        console.error(" Statement generation failed:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [customerId]);

  const getDateRange = (filter) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start, end;

    switch (filter) {
      case "today":
        start = new Date(today);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case "week":
        start = new Date(today);
        start.setDate(start.getDate() - start.getDay());
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case "month":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "quarter":
        const currentQuarter = Math.floor(today.getMonth() / 3);
        start = new Date(today.getFullYear(), currentQuarter * 3, 1);
        end = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "year":
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
        break;
      case "custom":
        start = customStartDate ? new Date(customStartDate) : new Date(0);
        end = customEndDate ? new Date(customEndDate) : new Date();
        end.setHours(23, 59, 59, 999);
        break;
      default:
        return null;
    }
    return { start, end };
  };

  const applyFilters = (data, filter) => {
    const balanceBF = data.find((t) => t.isBalanceBF);
    const other = data.filter((t) => !t.isBalanceBF);

    let filtered = other;
    if (filter !== "all") {
      const range = getDateRange(filter);
      if (range) {
        filtered = other.filter((t) => {
          const txDate = new Date(t.date);
          return txDate >= range.start && txDate <= range.end;
        });
      }
    }

    setFilteredTransactions(balanceBF ? [balanceBF, ...filtered] : filtered);
    setCurrentPage(1);
  };

  const handleDateFilterChange = (filter) => {
    setDateFilter(filter);
    applyFilters(transactions, filter);
  };

  const handleCustomDateApply = () => {
    applyFilters(transactions, "custom");
  };

  // const handleSort = (key) => {
  //   if (key === "balance") return;
  //   const newDir =
  //     sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
  //   setSortConfig({ key, direction: newDir });

  //   const balanceBF = filteredTransactions.find((t) => t.isBalanceBF);
  //   const other = filteredTransactions.filter((t) => !t.isBalanceBF);

  //   const sorted = [...other].sort((a, b) => {
  //     let aVal = a[key],
  //       bVal = b[key];
  //     if (key === "date") {
  //       aVal = new Date(aVal);
  //       bVal = new Date(bVal);
  //     }
  //     const comp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  //     return newDir === "asc" ? comp : -comp;
  //   });

  //   setFilteredTransactions(balanceBF ? [balanceBF, ...sorted] : sorted);
  // };

  // Export Functions
  const getExportData = () => {
    return dateFilter === "all" ? transactions : filteredTransactions;
  };

  const getExportFileName = (ext) => {
    const firstName = customerInfo?.Firstname || "";
    const surname = customerInfo?.Surname || "";
    const name = `${firstName} ${surname}`.trim() || "Customer";
    return `${name} Account Statement.${ext}`;
  };

  const exportToCSV = () => {
    const data = getExportData();
    const headers = [
      "Date/Time",
      "Description",
      "Reference",
      "Debit",
      "Credit",
      "Balance",
    ];

    const csvContent = [
      headers.join(","),
      ...data.map((t) =>
        [
          `"${new Date(t.date).toLocaleString("en-KE")}"`,
          `"${t.description}"`,
          `"${t.reference}"`,
          `"${formatAmount(t.debit)}"`,
          `"${formatAmount(t.credit)}"`,
          `"${formatAmount(t.balance)}"`,
        ].join(",")
      ),
    ].join("\n");

    downloadFile(csvContent, getExportFileName("csv"), "text/csv");
  };

  const exportToWord = () => {
    const data = getExportData();
    const firstName = customerInfo?.Firstname || "";
    const surname = customerInfo?.Surname || "";
    const exportCustomerName = `${firstName} ${surname}`.trim() || "Customer";
    const companyName = tenant?.company_name || "Jasiri Lending Software";

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="UTF-8">
          <title>${exportCustomerName} Account Statement</title>
          <style>
            @page {
              size: A4;
              margin: 1in;
            }
            body { font-family: Arial, sans-serif; font-size: 10pt; margin: 0; padding: 0; }
            .header { text-align: center; margin-bottom: 10px; }
            .header h1 { font-size: 16pt; margin-bottom: 4px; }
            .header h2 { font-size: 13pt; margin-bottom: 6px; }
            .header p { margin: 2px 0; font-size: 10pt; }
            .summary { margin: 10px 0; padding: 8px; background: #f9f9f9; border: 1px solid #ddd; }
            .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .summary-table td { border: 1px solid #ddd; padding: 6px; text-align: center; }
            table { border-collapse: collapse; width: 98%; margin: 0 auto; }
            th, td { border: 1px solid #999; padding: 6px 8px; font-size: 9pt; }
            th { background-color: #f2f2f2; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${companyName}</h1>
            <h2>${exportCustomerName} Account Statement</h2>
            <p><strong>Mobile:</strong> ${customerInfo?.mobile || "N/A"}</p>
            <p><strong>Report Generated:</strong> ${reportTimestamp}</p>
          </div>

          <div class="summary">
            <table class="summary-table">
              <tr>
                <td><strong>Total Loan Amount</strong></td>
                <td><strong>Principal</strong></td>
                <td><strong>Interest</strong></td>
                <td><strong>Total Paid</strong></td>
                <td><strong>Outstanding Balance</strong></td>
              </tr>
              <tr>
                <td>${formatAmount(statementSummary.totalLoanAmount)}</td>
                <td>${formatAmount(statementSummary.principal)}</td>
                <td>${formatAmount(statementSummary.interest)}</td>
                <td>${formatAmount(statementSummary.totalPaid)}</td>
                <td>${formatAmount(statementSummary.outstandingBalance)}</td>
              </tr>
            </table>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Description</th>
                <th>Reference</th>
                <th>Debit (Ksh)</th>
                <th>Credit (Ksh)</th>
                <th>Balance (Ksh)</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((t) => `
                <tr>
                  <td>${new Date(t.date).toLocaleString("en-KE")}</td>
                  <td>${t.description}</td>
                  <td>${t.reference}</td>
                  <td>${formatAmount(t.debit)}</td>
                  <td>${formatAmount(t.credit)}</td>
                  <td>${formatAmount(t.balance)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div style="margin-top: 20px; font-style: italic; text-align: center; font-size: 9pt;">
            <p>Generated automatically by Jasiri Lending Software System.</p>
          </div>
        </body>
      </html>
    `;

    downloadFile(htmlContent, getExportFileName("doc"), "application/msword");
  };

  const exportToExcel = async () => {
    const XLSX = await import("xlsx");
    const data = getExportData();
    const firstName = customerInfo?.Firstname || "";
    const surname = customerInfo?.Surname || "";
    const exportCustomerName = `${firstName} ${surname}`.trim() || "Customer";
    const companyName = tenant?.company_name || "Jasiri Lending Software";

    const worksheetData = [
      [companyName],
      [`${exportCustomerName} Account Statement`],
      [`Report Generated: ${reportTimestamp}`],
      [],
      ["Total Loan Amount", "Principal", "Interest", "Total Paid", "Outstanding Balance"],
      [
        formatAmount(statementSummary.totalLoanAmount),
        formatAmount(statementSummary.principal),
        formatAmount(statementSummary.interest),
        formatAmount(statementSummary.totalPaid),
        formatAmount(statementSummary.outstandingBalance)
      ],
      [],
      ["Date/Time", "Description", "Reference", "Debit (Ksh)", "Credit (Ksh)", "Balance (Ksh)"],
      ...data.map((t) => [
        new Date(t.date).toLocaleString("en-KE"),
        t.description,
        t.reference,
        formatAmount(t.debit),
        formatAmount(t.credit),
        formatAmount(t.balance),
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Account Statement");

    const colWidths = [
      { wch: 22 }, { wch: 30 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];
    worksheet["!cols"] = colWidths;

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getExportFileName("xlsx");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF("p", "mm", "a4");

    const data = getExportData().map((t) => [
      new Date(t.date).toLocaleString("en-KE"),
      t.description,
      t.reference,
      formatAmount(t.debit),
      formatAmount(t.credit),
      formatAmount(t.balance),
    ]);

    const firstName = customerInfo?.Firstname || "";
    const surname = customerInfo?.Surname || "";
    const exportCustomerName = `${firstName} ${surname}`.trim() || "Customer";
    const companyName = tenant?.company_name || "Jasiri Lending Software";

    // Header
    doc.setFontSize(14);
    doc.text(companyName, 105, 15, { align: "center" });
    doc.setFontSize(11);
    doc.text(
      `${exportCustomerName} Account Statement`,
      105,
      22,
      { align: "center" }
    );
    doc.text(`Report Generated: ${reportTimestamp}`, 105, 29, {
      align: "center",
    });

    // Summary Table
    autoTable(doc, {
      head: [["Total Loan Amount", "Principal", "Interest", "Total Paid", "Outstanding Balance"]],
      body: [[
        formatAmount(statementSummary.totalLoanAmount),
        formatAmount(statementSummary.principal),
        formatAmount(statementSummary.interest),
        formatAmount(statementSummary.totalPaid),
        formatAmount(statementSummary.outstandingBalance)
      ]],
      startY: 40,
      styles: { fontSize: 9, cellPadding: 3 },
      theme: "grid",
    });

    // Main Table
    autoTable(doc, {
      head: [["Date/Time", "Description", "Reference", "Debit", "Credit", "Balance"]],
      body: data,
      startY: 60,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 45 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 25 },
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        textColor: [0, 0, 0],
      },
      theme: "grid",
    });

    doc.save(getExportFileName("pdf"));
  };

  const downloadFile = (content, fileName, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    switch (exportFormat) {
      case "csv":
        exportToCSV();
        break;
      case "excel":
        exportToExcel();
        break;
      case "word":
        exportToWord();
        break;
      case "pdf":
        exportToPDF();
        break;
      default:
        exportToCSV();
    }
  };

  const formatAmount = (amt) => {
    if (amt === 0) return "0.00";
    return new Intl.NumberFormat("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amt);
  };

  // const SortableHeader = ({ label, sortKey }) => {
  //   const isActive = sortConfig.key === sortKey;
  //   const isAsc = sortConfig.direction === "asc";
  //   return (
  //     <th
  //       onClick={() => handleSort(sortKey)}
  //       className="px-4 py-2 text-left text-xs font-semibold cursor-pointer text-white hover:bg-blue-700"
  //     >
  //       <div className="flex items-center gap-1">
  //         {label}
  //         {isActive &&
  //           (isAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
  //       </div>
  //     </th>
  //   );
  // };

  // Enhanced Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const currentData = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const generatePageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      pages.push(1);
      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  };

  const handleFindTransaction = () => {
    if (!searchTerm.trim()) {
      alert("Please enter a transaction ID to search.");
      return;
    }

    const found = transactions.find(
      (tx) =>
        tx.reference?.includes(searchTerm) ||
        tx.description?.includes(searchTerm)
    );

    if (found) {
      alert(`Transaction found: ${found.description} on ${new Date(found.date).toLocaleDateString()}`);
      setFilteredTransactions([found]); // show only that transaction
    } else {
      alert("Transaction not found.");
      // Reset to show all transactions if not found
      applyFilters(transactions, dateFilter);
    }
  };

  // Reset search and show all transactions
  const handleResetSearch = () => {
    setSearchTerm("");
    applyFilters(transactions, dateFilter);
  };

  // Share Report via Email (as PDF)
  const handleShareReport = async () => {
    try {
      const response = await fetch("/api/send-statement-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          customerName: customerInfo?.name,
          statementPeriod,
          reportTimestamp,
          statementSummary
        }),
      });

      if (!response.ok) throw new Error("Failed to send email");
      alert("Report shared successfully via email!");
    } catch (err) {
      console.error(err);
      alert("Error sharing report. Please try again.");
    }
  };

  // const handleGoBack = () => {
  //   navigate(-1);
  // };

  const customerName = `${customerInfo?.Firstname || ""} ${customerInfo?.Surname || ""}`.trim() || "Customer";

  return (
    <div className="min-h-screen bg-brand-surface py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Customer Statement Header */}
        <div className="mb-6 p-6 text-center flex flex-col items-center">
          {/* Customer Name */}
          <h2 className="text-2xl font-bold text-slate-600">
            {customerName}
          </h2>

          {/* Statement Title */}
          <p className="text-sm text-stone-600 mt-1 uppercase">
            Customer Account Statement
          </p>

          {/* Statement Period */}
          <p className="text-base text-gray-700 leading-relaxed mt-4">
            This report is for the{" "}
            <span className="font-bold text-blue-800">
              {statementPeriod.period}
            </span>{" "}
            period, starting on{" "}
            <span className="font-bold text-blue-800">
              {statementPeriod.startDate}
            </span>{" "}
            and ending on{" "}
            <span className="font-bold text-blue-800">
              {statementPeriod.endDate}
            </span>.
          </p>
        </div>



        {/* Filters and Export Section */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 mb-6">
          <div className="p-5">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              {/* Left Filters Section */}
              <div className="flex flex-wrap gap-3 items-center">
                {/* Date Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-700">Filter by:</label>
                  <select
                    value={dateFilter}
                    onChange={(e) => handleDateFilterChange(e.target.value)}
                    className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white hover:border-gray-400"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                    <option value="year">This Year</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>

                {/* Custom Date Range */}
                {dateFilter === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                    <span className="text-sm font-semibold text-gray-600">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                    <button
                      onClick={handleCustomDateApply}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
                    >
                      Apply
                    </button>
                  </div>
                )}

                {/* Items Per Page */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-700">Show:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white hover:border-gray-400"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Find Transaction */}
                <div className="flex items-center gap-2 border-2 border-gray-300 rounded-lg px-3 py-2 bg-white hover:border-gray-400 transition-all">
                  <Search size={16} className="text-gray-600" />
                  <input
                    type="text"
                    placeholder="Find by M-Pesa Txn ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="text-sm font-medium focus:outline-none w-40"
                  />
                  <button
                    onClick={handleFindTransaction}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Find
                  </button>
                  {searchTerm && (
                    <button
                      onClick={handleResetSearch}
                      className="text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Export Options */}
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="border-2 border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-white hover:border-gray-400"
                >
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                  <option value="word">Word</option>
                </select>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-all shadow-sm hover:shadow-md"
                >
                  <Download size={16} />
                  Export
                </button>

                {/* Share Report */}
                <button
                  onClick={handleShareReport}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
                >
                  <Share2 size={16} />
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>


        {/* Summary Table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 mb-2">
          <div className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-100 to-gray-50">
                    <th className="px-4 py-3 text-left font-bold text-sm text-gray-800 border-2 border-gray-300">Total Loan Amount</th>
                    <th className="px-4 py-3 text-left font-bold text-sm text-gray-800 border-2 border-gray-300">Principal</th>
                    <th className="px-4 py-3 text-left font-bold text-sm text-gray-800 border-2 border-gray-300">Interest</th>
                    <th className="px-4 py-3 text-left font-bold text-sm text-gray-800 border-2 border-gray-300">Total Paid</th>
                    <th className="px-4 py-3 text-left font-bold text-sm text-gray-800 border-2 border-gray-300">Outstanding Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 border-2 border-gray-300 text-right font-bold text-base text-blue-700">
                      {formatAmount(statementSummary.totalLoanAmount)}
                    </td>
                    <td className="px-4 py-3 border-2 border-gray-300 text-right font-bold text-base text-green-700">
                      {formatAmount(statementSummary.principal)}
                    </td>
                    <td className="px-4 py-3 border-2 border-gray-300 text-right font-bold text-base text-amber-600">
                      {formatAmount(statementSummary.interest)}
                    </td>
                    <td className="px-4 py-3 border-2 border-gray-300 text-right font-bold text-base text-purple-700">
                      {formatAmount(statementSummary.totalPaid)}
                    </td>
                    <td className="px-4 py-3 border-2 border-gray-300 text-right font-bold text-base text-red-700">
                      {formatAmount(statementSummary.outstandingBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200">
          <div className="p-5">
            {loading ? (
              <p className="text-center text-gray-500 py-12 text-base font-medium">
                Loading transactions...
              </p>
            ) : filteredTransactions.length === 0 ? (
              <p className="text-center text-gray-500 py-12 text-base font-medium">
                No transactions found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-indigo-100 to-blue-50">
                      <th className="px-4 py-4 text-left font-bold text-base text-indigo-900 border-b-2 border-indigo-300">Date</th>
                      <th className="px-4 py-4 text-left font-bold text-base text-indigo-900 border-b-2 border-indigo-300">Description</th>
                      <th className="px-4 py-4 text-left font-bold text-base text-indigo-900 border-b-2 border-indigo-300">Reference</th>
                      <th className="px-4 py-4 text-left font-bold text-base text-indigo-900 border-b-2 border-indigo-300">Debit</th>
                      <th className="px-4 py-4 text-left font-bold text-base text-indigo-900 border-b-2 border-indigo-300">Credit</th>
                      <th className="px-4 py-4 text-left font-bold text-base text-indigo-900 border-b-2 border-indigo-300">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentData.map((t) => (
                      <tr
                        key={t.id}
                        className={`border-b border-gray-200 transition-colors ${t.isBalanceBF
                          ? "bg-gray-100 font-bold"
                          : "hover:bg-blue-50"
                          }`}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                          {new Date(t.date).toLocaleString("en-KE")}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{t.description}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{t.reference}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-red-600">
                          {t.debit !== 0 ? formatAmount(t.debit) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">
                          {t.credit > 0 ? formatAmount(t.credit) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                          {formatAmount(t.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Enhanced Pagination */}
            {filteredTransactions.length > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-3 pt-4 border-t border-gray-200">
                <div className="text-sm font-medium text-gray-700">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(
                    currentPage * itemsPerPage,
                    filteredTransactions.length
                  )}{" "}
                  of {filteredTransactions.length} entries
                </div>

                <div className="flex items-center gap-2">
                  {/* First Page */}
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-200 transition-all disabled:cursor-not-allowed shadow-sm"
                  >
                    <ChevronsLeft size={16} />
                  </button>

                  {/* Previous Page */}
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-200 transition-all disabled:cursor-not-allowed shadow-sm"
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>

                  {/* Page Numbers */}
                  <div className="flex gap-1 mx-2">
                    {generatePageNumbers().map((page, index) => (
                      <button
                        key={index}
                        onClick={() =>
                          typeof page === "number" && setCurrentPage(page)
                        }
                        disabled={page === "..."}
                        className={`px-3 py-2 rounded-lg min-w-[40px] text-sm font-semibold transition-all shadow-sm ${currentPage === page
                          ? "bg-blue-600 text-white shadow-md"
                          : page === "..."
                            ? "bg-transparent cursor-default shadow-none"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  {/* Next Page */}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-200 transition-all disabled:cursor-not-allowed shadow-sm"
                  >
                    Next <ChevronRight size={16} />
                  </button>

                  {/* Last Page */}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-200 transition-all disabled:cursor-not-allowed shadow-sm"
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm font-medium text-gray-600">
            Generated by Jasiri Lending Software System • {reportTimestamp}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomerStatementModal;