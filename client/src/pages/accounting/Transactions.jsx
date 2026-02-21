import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { Search, Eye, CheckCircle, Archive, Calendar, DollarSign, Phone, User, FileText } from 'lucide-react';
import { useEffect, useState } from "react";

// Transaction Details Modal
const TransactionDetailsModal = ({ transaction, onClose }) => {
  if (!transaction) return null;

  const payload = transaction.raw_payload || {};
  const firstName = payload.Firstname || payload.FirstName || 'N/A';
  const middleName = payload.Middlename || payload.MiddleName || '';
  const surname = payload.SurName || payload.Surname || '';
  const fullName = `${firstName} ${middleName} ${surname}`.trim();
  const billRef = payload.BillRefNumber || transaction.reference || 'N/A';

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
                <p className="font-semibold text-gray-800">{payload.MSISDN || transaction.phone_number || 'N/A'}</p>
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

// Successful Transactions Component
const SuccessfulTransactions = ({ onViewDetails }) => {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchSuccessfulTransactions();
    }
  }, [profile?.tenant_id]);

  const fetchSuccessfulTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('mpesa_c2b_transactions')
        .select('*')
        .eq('status', 'applied')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching successful transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to extract data from raw_payload
  const getPayloadData = (transaction) => {
    const payload = transaction.raw_payload || {};
    return {
      firstName: payload.Firstname || payload.FirstName || 'N/A',
      billRef: payload.BillRefNumber || transaction.reference || 'N/A',
      fullName: `${payload.Firstname || ''} ${payload.Middlename || ''} ${payload.SurName || ''}`.trim() || 'N/A'
    };
  };

  const filteredTransactions = transactions.filter(t => {
    const payloadData = getPayloadData(t);
    return (
      payloadData.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payloadData.billRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Successful Transactions</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: "#586ab1" }}></div>
          <p className="mt-4 text-gray-600">Loading transactions...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">First Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Bill Reference</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">M-Pesa Code</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Created Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => {
                const payloadData = getPayloadData(transaction);
                return (
                  <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-800">{payloadData.firstName}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">{payloadData.billRef}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                      KSh {parseFloat(transaction.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{transaction.transaction_id}</td>
                    <td className="px-4 py-3">
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                        Successful
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(transaction.created_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onViewDetails(transaction)}
                        className="flex items-center gap-2 px-3 py-1 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg"
                        style={{ backgroundColor: "#586ab1" }}
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredTransactions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No successful transactions found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Suspense Transactions Component
const SuspenseTransactions = ({ onReconcile, onArchive }) => {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchSuspenseTransactions();
    }
  }, [profile?.tenant_id]);

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

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mt-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Suspense Transactions</h2>
        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-semibold rounded-full">
          {transactions.length} Pending
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: "#586ab1" }}></div>
          <p className="mt-4 text-gray-600">Loading suspense transactions...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
                {[
                  "First Name",
                  "Phone Number",
                  "Amount",
                  "M-Pesa Code",
                  "Status",
                  "Created Date",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                    {transaction.payer_name || "N/A"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                    {transaction.phone_number}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800 whitespace-nowrap">
                    KSh {parseFloat(transaction.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                    {transaction.transaction_id}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                      Suspense
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(transaction.created_at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
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

          {transactions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No suspense transactions found
            </div>
          )}
        </div>

      )}
    </div>
  );
};

// Main Transactions Component
function Transactions() {
  const { profile } = useAuth();
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [activeTab, setActiveTab] = useState('successful');

  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const handleReconcile = async (transaction) => {
    if (confirm(`Reconcile transaction ${transaction.transaction_id}?`)) {
      try {
        // Update the transaction status
        const { error } = await supabase
          .from('suspense_transactions')
          .update({ status: 'reconciled' })
          .eq('id', transaction.id)
          .eq('tenant_id', profile?.tenant_id);

        if (error) throw error;

        alert('Transaction reconciled successfully');
        window.location.reload();
      } catch (error) {
        console.error('Error reconciling transaction:', error);
        alert('Failed to reconcile transaction');
      }
    }
  };

  const handleArchive = async (transaction) => {
    if (confirm(`Archive transaction ${transaction.transaction_id}?`)) {
      try {
        const { error } = await supabase
          .from('suspense_transactions')
          .update({ status: 'archived' })
          .eq('id', transaction.id)
          .eq('tenant_id', profile?.tenant_id);

        if (error) throw error;

        alert('Transaction archived successfully');
        window.location.reload();
      } catch (error) {
        console.error('Error archiving transaction:', error);
        alert('Failed to archive transaction');
      }
    }
  };

  return (
    <div className="min-h-screen bg-brand-surface p-6">
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
            onClick={() => setActiveTab('suspense')}
            className={`px-6 py-2 rounded-xl text-sm transition-all duration-300 ${activeTab === 'suspense'
                ? 'text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            style={activeTab === 'suspense' ? { backgroundColor: "#586ab1" } : {}}
          >
            Suspense
          </button>
        </div>

        {activeTab === 'successful' && (
          <SuccessfulTransactions onViewDetails={handleViewDetails} />
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