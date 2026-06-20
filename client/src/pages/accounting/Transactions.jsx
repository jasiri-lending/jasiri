import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { Search, Eye, CheckCircle, XCircle, Archive, Calendar, DollarSign, Phone, User, FileText, ArrowLeft, AlertTriangle, ChevronRight, CreditCard, UserCheck, Clock, BookOpen, X } from 'lucide-react';
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../components/Toast";
import { Pagination } from "../../components/Pagination.jsx";

import { usePermissions } from "../../hooks/usePermissions";
import { SkeletonTable } from '../../components/Skeleton';
import Modal from '../../components/Modal';


// Transaction Details Modal
const TransactionDetailsModal = ({ transaction, onClose }) => {
  if (!transaction) return null;

  const payload = transaction.raw_payload || {};
  // Supabase joins can sometimes return an array or an object
  const customer = Array.isArray(transaction.customers) ? transaction.customers[0] : transaction.customers;
  
  const firstName = customer?.Firstname || payload.Firstname || payload.FirstName || 'N/A';
  const surname = customer?.Surname || payload.SurName || payload.Surname || '';
  const fullName = `${firstName} ${surname}`.trim();
  const billRef = payload.BillRefNumber || transaction.reference || 'N/A';

  // Handle phone number resolution with hash detection
  const getDisplayPhone = () => {
    if (customer?.mobile) return customer.mobile;
    const rawPhone = transaction.phone_number || payload.MSISDN;
    if (rawPhone && String(rawPhone).length > 20) {
      return billRef !== 'N/A' ? billRef : 'Hashed';
    }
    return rawPhone || 'N/A';
  };

  return (
    <Modal open={!!transaction} title="Transaction Details" onClose={onClose} wide>
      <div className="space-y-4 font-outfit">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-brand-primary"  />
              <p className="text-xs font-outfit text-gray-600">Payer Name</p>
            </div>
            <p className="text-sm font-outfit text-gray-600">{fullName || 'N/A'}</p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-4 h-4 text-brand-primary"  />
              <p className="text-xs font-outfit text-gray-600">Phone Number</p>
            </div>
            <p className="text-sm font-outfit text-gray-600">
              {getDisplayPhone()}
            </p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-brand-primary"  />
              <p className="text-xs font-outfit text-gray-600">Amount</p>
            </div>
            <p className="text-sm font-outfit text-brand-primary">KSh {parseFloat(transaction.amount).toLocaleString()}</p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-brand-primary"  />
              <p className="text-xs font-outfit text-gray-600">M-Pesa Code</p>
            </div>
            <p className="text-sm font-outfit text-gray-600">{transaction.transaction_id}</p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-brand-primary"  />
              <p className="text-xs font-outfit text-gray-600">Bill Reference</p>
            </div>
            <p className="text-sm font-outfit text-gray-600">{billRef}</p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-brand-primary"  />
              <p className="text-xs font-outfit text-gray-600">Transaction Time</p>
            </div>
            <p className="text-sm font-outfit text-gray-600">
              {new Date(transaction.transaction_time || transaction.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {transaction.description && (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-600 mb-2 font-outfit">Description</p>
            <p className="text-gray-600 font-outfit">{transaction.description}</p>
          </div>
        )}

        {transaction.payment_type && (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-600 mb-2 font-outfit">Payment Type</p>
            <p className="text-gray-600 font-outfit">{transaction.payment_type}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};


const PAGE_SIZE = 50;

// Successful Transactions Component
// Shows: mpesa_c2b_transactions (status=applied) + suspense_transactions (status=reconciled)
const SuccessfulTransactions = ({ onViewDetails }) => {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (profile?.tenant_id) fetchSuccessfulTransactions();
  }, [profile?.tenant_id]);

  // Reset to page 1 when search changes
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const fetchSuccessfulTransactions = async () => {
    try {
      setLoading(true);

      // Fetch both sources in parallel
      const [c2bRes, reconciledRes] = await Promise.all([
        supabase
          .from('mpesa_c2b_transactions')
          .select('*, customers(mobile, Firstname, Surname)')
          .eq('status', 'applied')
          .eq('tenant_id', profile.tenant_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('suspense_transactions')
          .select('*, customers!linked_customer_id(Firstname, Surname, mobile)')
          .eq('status', 'reconciled')
          .eq('tenant_id', profile.tenant_id)
          .order('created_at', { ascending: false }),
      ]);

      // Normalize c2b transactions
      const c2b = (c2bRes.data || []).map(t => {
        const payload = t.raw_payload || {};
        return {
          _id: `c2b-${t.id}`,
          _source: 'c2b',
          id: t.id,
          transaction_id: t.transaction_id,
          amount: t.amount,
          created_at: t.created_at,
          status_label: 'Successful',
          status_color: 'bg-green-100 text-green-800',
          name: `${payload.Firstname || t.customers?.Firstname || ''} ${payload.SurName || t.customers?.Surname || ''}`.trim() || 'N/A',
          mobile: t.customers?.mobile || payload.MSISDN || '',
          bill_ref: payload.BillRefNumber || t.reference || 'N/A',
          raw: t,
        };
      });

      // Normalize reconciled suspense transactions
      const reconciled = (reconciledRes.data || []).map(t => {
        const customer = Array.isArray(t.customers) ? t.customers[0] : t.customers;
        return {
          _id: `rec-${t.id}`,
          _source: 'reconciled',
          id: t.id,
          transaction_id: t.transaction_id,
          amount: t.amount,
          created_at: t.created_at,
          status_label: 'Reconciled',
          status_color: 'bg-blue-100 text-blue-800',
          name: customer ? `${customer.Firstname || ''} ${customer.Surname || ''}`.trim() : (t.payer_name || 'N/A'),
          mobile: customer?.mobile || t.phone_number || '',
          bill_ref: t.billref || t.reference || '—',
          raw: t,
        };
      });

      // Merge and sort by date descending
      const merged = [...c2b, ...reconciled].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      setTransactions(merged);
    } catch (error) {
      console.error('Error fetching successful transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = transactions.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.bill_ref?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.mobile?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h3 className="text-xs font-semibold text-heading font-outfit">Successful Payments</h3>
          <p className="text-[10px] text-muted mt-0.5">
            Direct payments + reconciled suspense entries · {transactions.length} total
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="Search name, M-Pesa code, ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-56 pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-card text-body focus:border-brand-primary focus:outline-none transition-colors duration-200"
          />
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : (
        <>
          <div className="overflow-x-auto font-outfit border border-border-light rounded-xl shadow-card">
            <table className="min-w-full divide-y divide-border-light">
              <thead className="bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-outfit font-medium text-muted whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-xs font-outfit text-muted whitespace-nowrap">Mobile</th>
                  <th className="px-4 py-3 text-left text-xs font-outfit font-medium text-muted whitespace-nowrap">Bill Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-outfit font-medium text-muted whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-outfit font-medium text-muted whitespace-nowrap">M-Pesa Code</th>
                  <th className="px-4 py-3 text-left text-xs font-outfit font-medium text-muted whitespace-nowrap">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-outfit font-medium text-muted whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-outfit font-medium text-muted whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {paginated.map((t) => (
                  <tr key={t._id} className="hover:bg-surface transition-colors">
                    <td className="px-4 py-3 text-xs font-outfit text-body whitespace-nowrap">
                     {t.name}
                    </td>
                    <td className="px-4 py-3 text-xs font-outfit text-body whitespace-nowrap">{t.mobile}</td>
                    <td className="px-4 py-3 text-xs font-outfit text-body whitespace-nowrap">{t.bill_ref}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-heading font-semibold">
                      KSh {parseFloat(t.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs font-outfit text-brand-primary whitespace-nowrap">{t.transaction_id}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 text-[10px] font-medium rounded-full ${t.status_color}`}>
                        {t.status_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-outfit text-muted whitespace-nowrap">
                      {new Date(t.created_at).toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onViewDetails(t.raw)}
                        className="flex items-center gap-2 p-1.5 text-brand-primary hover:bg-brand-surface rounded-lg transition-colors"
                        aria-label="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted">
                No transactions found
              </div>
            )}
          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={filtered.length}
            itemsPerPage={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
};


// Approval Confirmation Modal
const ReconciliationApprovalModal = ({ transaction, onConfirm, onReject, onClose, isLoading }) => {
  if (!transaction) return null;
  const customer = transaction._customer;
  const initiator = transaction._initiator;

  return (
    <Modal open={!!transaction} title="Approve Reconciliation" onClose={onClose}>
      <div className="space-y-4 font-outfit">
        {/* Money Flow */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-3">Transaction Flow</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white rounded-lg p-3 border border-blue-100 text-center shadow-sm">
              <p className="text-xs text-slate-400 mb-1">M-Pesa Reference</p>
              <p className="font-bold text-emerald-600 text-sm">{transaction.transaction_id}</p>
              <p className="text-xs text-slate-500 mt-1">{transaction.payer_name || 'Unknown Payer'}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ChevronRight className="w-5 h-5 text-blue-400" />
              <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                KSh {parseFloat(transaction.amount).toLocaleString()}
              </span>
            </div>
            <div className="flex-1 bg-white rounded-lg p-3 border border-blue-100 text-center shadow-sm">
              <p className="text-xs text-slate-400 mb-1">Destination Customer</p>
              <p className="font-bold text-slate-800 text-sm">
                {customer ? `${customer.Firstname || ''} ${customer.Surname || ''}`.trim() : 'Loading...'}
              </p>
              <p className="text-xs text-slate-500 mt-1">{customer?.mobile || '—'}</p>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs text-slate-500">Amount</p>
            </div>
            <p className="font-bold text-slate-800">KSh {parseFloat(transaction.amount).toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs text-slate-500">Payer Mobile</p>
            </div>
            <p className="font-bold text-slate-800 text-sm">
              {transaction.phone_number && transaction.phone_number.length > 20
                ? 'Hashed'
                : transaction.phone_number || 'N/A'}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs text-slate-500">Proposed On</p>
            </div>
            <p className="font-bold text-slate-800 text-sm">
              {new Date(transaction.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs text-slate-500">Initiated By</p>
            </div>
            <p className="font-bold text-slate-800 text-sm">{initiator?.full_name || 'Unknown'}</p>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Approving this will <strong>credit KSh {parseFloat(transaction.amount).toLocaleString()}</strong> to the customer's wallet immediately. This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onReject(transaction.id)}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" /> Reject
          </button>
          <button
            onClick={() => onConfirm(transaction.id)}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Approve
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Pending Reconciliations Component
const PendingReconciliations = ({ onViewDetails, onRefresh }) => {
  const { profile } = useAuth();
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [approvalModal, setApprovalModal] = useState(null); // transaction to approve

  useEffect(() => {
    if (profile?.tenant_id) fetchPendingTransactions();
  }, [profile?.tenant_id]);

  const fetchPendingTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('suspense_transactions')
        .select('*')
        .eq('status', 'pending_approval')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich: fetch customer names and initiator names in parallel
      const enriched = await Promise.all((data || []).map(async (tx) => {
        const [customerRes, initiatorRes] = await Promise.all([
          tx.proposed_customer_id
            ? supabase.from('customers').select('Firstname, Surname, mobile, id_number').eq('id', tx.proposed_customer_id).maybeSingle()
            : Promise.resolve({ data: null }),
          tx.reconciled_by
            ? supabase.from('users').select('full_name').eq('auth_id', tx.reconciled_by).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        return {
          ...tx,
          _customer: customerRes.data || null,
          _initiator: initiatorRes.data || null,
        };
      }));

      setTransactions(enriched);
    } catch (error) {
      console.error('Error fetching pending transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async (transactionId, action) => {
    try {
      setActionLoading(transactionId);
      const response = await apiFetch(`/api/reconciliation/${transactionId}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ tenant_id: profile.tenant_id })
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        setApprovalModal(null);
        fetchPendingTransactions();
        if (onRefresh) onRefresh();
      } else {
        toast.error(data.error || `Failed to ${action} reconciliation`);
      }
    } catch (error) {
      console.error(`Error ${action}ing reconciliation:`, error);
      toast.error(`Error ${action}ing reconciliation`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      {/* Approval Modal */}
      {approvalModal && (
        <ReconciliationApprovalModal
          transaction={approvalModal}
          onClose={() => setApprovalModal(null)}
          onConfirm={(id) => executeAction(id, 'approve')}
          onReject={(id) => executeAction(id, 'reject')}
          isLoading={!!actionLoading}
        />
      )}

      <div className="space-y-4">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h3 className="text-xs font-semibold text-heading font-outfit">Pending Reconciliations</h3>
            <p className="text-[10px] text-muted mt-0.5">{transactions.length} awaiting approval</p>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : (
          <div className="overflow-x-auto font-outfit border border-border-light rounded-xl shadow-card">
            <table className="min-w-full divide-y divide-border-light">
              <thead className="bg-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium font-outfit text-muted whitespace-nowrap">M-Pesa Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium font-outfit text-muted whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium font-outfit text-muted whitespace-nowrap">Proposed To</th>
                  <th className="px-4 py-3 text-left text-xs font-medium font-outfit text-muted whitespace-nowrap">Mobile</th>
                  <th className="px-4 py-3 text-left text-xs font-medium font-outfit text-muted whitespace-nowrap">Proposed By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium font-outfit text-muted whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium font-outfit text-muted whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-surface transition-colors">
                    <td className="px-4 py-3 text-xs font-outfit whitespace-nowrap font-medium text-brand-primary">{transaction.transaction_id}</td>
                    <td className="px-4 py-3 text-xs font-outfit text-heading whitespace-nowrap font-semibold">
                      KSh {parseFloat(transaction.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {transaction._customer ? (
                        <div>
                          <p className="text-xs font-outfit text-body">
                            {`${transaction._customer.Firstname || ''} ${transaction._customer.Surname || ''}`.trim()}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted italic">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs font-outfit text-body">
                      {transaction._customer?.mobile}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-surface flex items-center justify-center shrink-0">
                           <User className="w-3 h-3 text-muted" />
                        </div>
                        <span className="text-xs font-outfit text-body">
                          {transaction._initiator?.full_name || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-outfit text-muted whitespace-nowrap">
                      {new Date(transaction.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex gap-2 items-center justify-end">
                        <button
                          onClick={() => onViewDetails(transaction)}
                          className="p-1.5 text-muted hover:text-heading hover:bg-surface rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {hasPermission('transaction.approve') ? (
                          transaction.reconciled_by === profile.id ? (
                            <span className="text-[10px] text-yellow-600 font-semibold bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-200 flex items-center gap-1 whitespace-nowrap">
                              <Clock className="w-3 h-3" /> Awaiting Checker
                            </span>
                          ) : (
                            <button
                              onClick={() => setApprovalModal(transaction)}
                              className="px-2.5 py-1 text-[10px] font-medium bg-brand-primary text-white rounded-lg hover:bg-forest-deep transition-all shadow-sm"
                            >
                              Review & Act
                            </button>
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length === 0 && (
              <div className="text-center py-12 text-muted">
                No pending reconciliations found
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

// Suspense Transactions Component
const SuspenseTransactions = ({ onReconcile, onArchive }) => {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (profile?.tenant_id) fetchSuspenseTransactions();
  }, [profile?.tenant_id]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const fetchSuspenseTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('suspense_transactions')
        .select('*')
        .eq('status', 'suspense')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching suspense transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = transactions.filter(t =>
    (t.payer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.transaction_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.phone_number || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h3 className="text-xs font-semibold text-heading font-outfit">Suspense Transactions</h3>
          <p className="text-[10px] text-muted mt-0.5">{transactions.length} unmatched payments</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="Search suspense..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-56 pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-card text-body focus:border-brand-primary focus:outline-none transition-colors duration-200"
          />
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={4} cols={5} />
      ) : (
        <>
          <div className="overflow-x-auto font-outfit border border-border-light rounded-xl shadow-card">
            <table className="min-w-full divide-y divide-border-light">
              <thead className="bg-surface">
                <tr>
                  {["First Name", "Phone Number", "Amount", "M-Pesa Code", "Status", "Created Date", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-medium text-muted whitespace-nowrap">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {paginated.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-surface transition-colors">
                    <td className="px-4 py-3 text-xs font-outfit text-body whitespace-nowrap">
                      {transaction.payer_name || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-xs font-outfit text-body whitespace-nowrap">
                      {transaction.phone_number && transaction.phone_number.length > 20
                        ? (transaction.billref || "Hashed")
                        : (transaction.phone_number || "N/A")}
                    </td>
                    <td className="px-4 py-3 text-xs font-outfit text-heading whitespace-nowrap font-semibold">
                      KSh {parseFloat(transaction.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs font-outfit text-brand-primary whitespace-nowrap font-medium">
                      {transaction.transaction_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 text-[10px] font-medium rounded-full bg-yellow-100 text-yellow-800">
                        {transaction.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-outfit text-muted whitespace-nowrap">
                      {new Date(transaction.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => onReconcile(transaction)}
                          className="flex items-center gap-1 px-2 py-0.5 text-white text-xs bg-brand-primary rounded-sm transition-all duration-300 hover:shadow-lg"
                          
                        >
                          Reconcile
                        </button>
                        <button
                          onClick={() => onArchive(transaction)}
                          className="flex items-center gap-1 px-2 py-0.5 bg-gray-600 text-white text-xs rounded-sm transition-all duration-300 hover:bg-gray-700"
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No suspense transactions found
              </div>
            )}
          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={filtered.length}
            itemsPerPage={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
};

// Main Transactions Component
function Transactions() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [activeTab, setActiveTab] = useState('successful');

  const [suspenseCount, setSuspenseCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchCounts = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { count: sCount } = await supabase
        .from('suspense_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'suspense')
        .eq('tenant_id', profile.tenant_id);
      
      const { count: pCount } = await supabase
        .from('suspense_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_approval')
        .eq('tenant_id', profile.tenant_id);

      setSuspenseCount(sCount || 0);
      setPendingCount(pCount || 0);
    } catch (err) {
      console.error("Error fetching counts:", err);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, [profile?.tenant_id]);

  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const handleReconcile = (transaction) => {
    navigate(`/accounting/reconcile/${transaction.id}`);
  };

  const handleArchive = async (transaction) => {
    if (!confirm(`Archive transaction ${transaction.transaction_id}?`)) return;
    try {
      const { error } = await supabase
        .from('suspense_transactions')
        .update({ status: 'archived' })
        .eq('id', transaction.id)
        .eq('tenant_id', profile?.tenant_id);

      if (error) throw error;

      toast.success('Transaction archived successfully');
      fetchCounts();
      setActiveTab('suspense');
    } catch (error) {
      console.error('Error archiving transaction:', error);
      toast.error('Failed to archive transaction');
    }
  };

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
      <div className="w-full">
        <div className="mb-4">
          <h1 className="text-xs text-muted mb-2">Accounting / Transactions</h1>
        </div>

        <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
          <div className="p-4 border-b border-border-light flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <h2 className="text-xs font-semibold text-heading font-outfit whitespace-nowrap">
                M-Pesa Transactions
              </h2>
              
              <div className="flex items-center gap-1 bg-border-light/40 p-1 rounded-lg border border-border-light">
                <button
                  onClick={() => setActiveTab("successful")}
                  className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                    activeTab === "successful"
                      ? "bg-brand-primary text-white shadow-sm"
                      : "text-muted hover:text-heading"
                  }`}
                >
                  Successful
                </button>

                <button
                  onClick={() => setActiveTab("pending")}
                  className={`relative px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                    activeTab === "pending"
                      ? "bg-brand-primary text-white shadow-sm"
                      : "text-muted hover:text-heading"
                  }`}
                >
                  Pending
                  {pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-semibold text-white border border-white">
                      {pendingCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("suspense")}
                  className={`relative px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                    activeTab === "suspense"
                      ? "bg-brand-primary text-white shadow-sm"
                      : "text-muted hover:text-heading"
                  }`}
                >
                  Suspense
                  {suspenseCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-yellow-500 text-[9px] font-semibold text-white border border-white">
                      {suspenseCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'successful' && (
              <SuccessfulTransactions onViewDetails={handleViewDetails} />
            )}

            {activeTab === 'pending' && (
              <PendingReconciliations 
                onViewDetails={handleViewDetails} 
                onRefresh={fetchCounts}
              />
            )}

            {activeTab === 'suspense' && (
              <SuspenseTransactions
                onReconcile={handleReconcile}
                onArchive={handleArchive}
              />
            )}
          </div>
        </div>

        {selectedTransaction && (
          <TransactionDetailsModal
            transaction={selectedTransaction}
            onClose={() => setSelectedTransaction(null)}
          />
        )}
      </div>
    </div>
  );
}

export default Transactions;