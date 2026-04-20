import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { Search, Eye, CheckCircle, XCircle, Archive, Calendar, DollarSign, Phone, User, FileText, ArrowLeft, AlertTriangle, ChevronRight, CreditCard, UserCheck, Clock } from 'lucide-react';
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../components/Toast";
import { apiFetch } from "../../utils/api";
import { usePermissions } from "../../hooks/usePermissions";
import Spinner from "../../components/Spinner";


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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-gray-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold" style={{ color: "#586ab1" }}>Transaction Details</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl transition-colors"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" style={{ color: "#586ab1" }} />
                  <p className="text-sm text-gray-600">Payer Name</p>
                </div>
                <p className="font-semibold text-gray-800">{fullName || 'N/A'}</p>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4" style={{ color: "#586ab1" }} />
                  <p className="text-sm text-gray-600">Phone Number</p>
                </div>
                <p className="font-semibold text-gray-800">
                  {getDisplayPhone()}
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4" style={{ color: "#586ab1" }} />
                  <p className="text-sm text-gray-600">Amount</p>
                </div>
                <p className="font-semibold text-gray-800">KSh {parseFloat(transaction.amount).toLocaleString()}</p>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4" style={{ color: "#586ab1" }} />
                  <p className="text-sm text-gray-600">M-Pesa Code</p>
                </div>
                <p className="font-semibold text-gray-800">{transaction.transaction_id}</p>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4" style={{ color: "#586ab1" }} />
                  <p className="text-sm text-gray-600">Bill Reference</p>
                </div>
                <p className="font-semibold text-gray-800">{billRef}</p>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4" style={{ color: "#586ab1" }} />
                  <p className="text-sm text-gray-600">Transaction Time</p>
                </div>
                <p className="font-semibold text-gray-800">
                  {new Date(transaction.transaction_time || transaction.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {transaction.description && (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Description</p>
                <p className="text-gray-800">{transaction.description}</p>
              </div>
            )}

            {transaction.payment_type && (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Payment Type</p>
                <p className="text-gray-800 capitalize">{transaction.payment_type}</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl text-white font-semibold transition-all duration-300 hover:shadow-lg"
              style={{ backgroundColor: "#586ab1" }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Shared Pagination Component
const Pagination = ({ currentPage, totalPages, totalItems, pageSize, onPageChange }) => {
  if (totalPages <= 1) return null;
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
      <p className="text-sm text-gray-500">
        Showing <span className="font-semibold text-gray-700">{start}–{end}</span> of{' '}
        <span className="font-semibold text-gray-700">{totalItems}</span> records
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="px-2 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          «
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ‹ Prev
        </button>

        {/* Page numbers (show up to 5 around current) */}
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
          .reduce((acc, p, idx, arr) => {
            if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
            acc.push(p);
            return acc;
          }, [])
          .map((item, idx) =>
            item === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 text-xs">…</span>
            ) : (
              <button
                key={item}
                onClick={() => onPageChange(item)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  item === currentPage
                    ? 'text-white border-transparent'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                style={item === currentPage ? { backgroundColor: '#586ab1' } : {}}
              >
                {item}
              </button>
            )
          )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-2 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          »
        </button>
      </div>
    </div>
  );
};

const PAGE_SIZE = 100;

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
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Successful Transactions</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Direct payments + reconciled suspense entries · {transactions.length} total
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search name, M-Pesa code, ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: "#586ab1" }}></div>
          <p className="mt-4 text-gray-600">Loading transactions...</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Bill Reference</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">M-Pesa Code</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Source</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((t) => (
                  <tr key={t._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800">{t.name}</p>
                      {t.mobile && <p className="text-xs text-gray-400">{t.mobile}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{t.bill_ref}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">
                      KSh {parseFloat(t.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-emerald-700">{t.transaction_id}</td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${t.status_color}`}>
                        {t.status_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(t.created_at).toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onViewDetails(t.raw)}
                        className="flex items-center gap-2 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                        style={{ backgroundColor: "#586ab1" }}
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No transactions found
              </div>
            )}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Approve Reconciliation</h2>
              <p className="text-slate-300 text-xs mt-0.5">Review and confirm this reconciliation request</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
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
      </div>
    </div>
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

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mt-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Pending Reconciliations</h2>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
            {transactions.length} Awaiting Approval
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Spinner text="Loading pending reconciliations..." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">M-Pesa Code</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Proposed To</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Initiated By</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-emerald-700">{transaction.transaction_id}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-800">
                      KSh {parseFloat(transaction.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {transaction._customer ? (
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {`${transaction._customer.Firstname || ''} ${transaction._customer.Surname || ''}`.trim()}
                          </p>
                          <p className="text-xs text-gray-400">{transaction._customer.mobile}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <span className="text-sm text-gray-700 font-medium">
                          {transaction._initiator?.full_name || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(transaction.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => onViewDetails(transaction)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {hasPermission('transaction.approve') ? (
                          transaction.reconciled_by === profile.id ? (
                            <span className="text-xs text-yellow-600 font-semibold bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-200 flex items-center gap-1 whitespace-nowrap">
                              <Clock className="w-3 h-3" /> Awaiting Checker
                            </span>
                          ) : (
                            <button
                              onClick={() => setApprovalModal(transaction)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-bold rounded-lg transition-all hover:shadow-md whitespace-nowrap"
                              style={{ backgroundColor: '#586ab1' }}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Review & Approve
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
              <div className="text-center py-16 text-gray-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No pending reconciliations</p>
                <p className="text-sm mt-1">All clear — nothing awaiting approval</p>
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
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mt-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Suspense Transactions</h2>
          <p className="text-xs text-gray-400 mt-0.5">{transactions.length} unmatched payments</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-semibold rounded-full">
            {transactions.length} Pending
          </span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all w-48"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: "#586ab1" }}></div>
          <p className="mt-4 text-gray-600">Loading suspense transactions...</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
                  {["First Name", "Phone Number", "Amount", "M-Pesa Code", "Status", "Created Date", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                      {transaction.payer_name || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                      {transaction.phone_number && transaction.phone_number.length > 20
                        ? (transaction.billref || "Hashed")
                        : (transaction.phone_number || "N/A")}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-800 whitespace-nowrap">
                      KSh {parseFloat(transaction.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-emerald-700 whitespace-nowrap">
                      {transaction.transaction_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                        Suspense
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(transaction.created_at).toLocaleString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => onReconcile(transaction)}
                          className="flex items-center gap-1 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                          style={{ backgroundColor: "#586ab1" }}
                        >
                          <CheckCircle className="w-4 h-4" />
                          Reconcile
                        </button>
                        <button
                          onClick={() => onArchive(transaction)}
                          className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white text-sm rounded-xl transition-all duration-300 hover:bg-gray-700"
                        >
                          <Archive className="w-4 h-4" />
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
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
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
    <div className="min-h-screen bg-muted p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-lg font-medium mb-2" style={{ color: "#586ab1" }}>M-Pesa Transactions</h1>
          <p className="text-gray-600 text-sm">Manage and monitor all M-Pesa transactions</p>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('successful')}
            className={`px-6 py-2 rounded-xl text-sm transition-all duration-300 ${activeTab === 'successful'
              ? 'text-white shadow-lg'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            style={activeTab === 'successful' ? { backgroundColor: "#586ab1" } : {}}
          >
            Successful
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-2 rounded-xl text-sm transition-all duration-300 relative ${activeTab === 'pending'
              ? 'text-white shadow-lg'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            style={activeTab === 'pending' ? { backgroundColor: "#586ab1" } : {}}
          >
            Pending Approval
            {pendingCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('suspense')}
            className={`px-6 py-2 rounded-xl text-sm transition-all duration-300 relative ${activeTab === 'suspense'
              ? 'text-white shadow-lg'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            style={activeTab === 'suspense' ? { backgroundColor: "#586ab1" } : {}}
          >
            Suspense
            {suspenseCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                {suspenseCount}
              </span>
            )}
          </button>
        </div>

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