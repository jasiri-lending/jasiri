import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import Spinner from '../../components/Spinner.jsx';

const PendingTransfersList = ({ onApprove, onReject }) => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchPendingTransfers();
  }, [refreshKey]);

  const fetchPendingTransfers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_transfer_requests')
        .select(`
          id,
          created_at,
          remarks,
          branch_manager:branch_manager_id (full_name, id),
          current_branch:current_branch_id (name),
          new_branch:new_branch_id (name),
          current_officer:current_officer_id (full_name),
          new_officer:new_officer_id (full_name),
          transfer_items:customer_transfer_items (
            id,
            customer:customer_id (
              Firstname,
              Surname,
              id_number,
              mobile
            )
          )
        `)
        .eq('status', 'pending_approval')
        .eq('tenant_id', currentUser?.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransfers(data || []);
    } catch (error) {
      console.error('Error fetching pending transfers:', error);
      alert('Failed to load pending transfers: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (transferId) => {
    if (window.confirm('Are you sure you want to approve this transfer request?')) {
      await onApprove(transferId);
      setRefreshKey(prev => prev + 1); // Refresh the list
    }
  };

  const handleReject = async (transferId) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    if (window.confirm('Are you sure you want to reject this transfer request?')) {
      await onReject(transferId, rejectReason);
      setSelectedTransfer(null);
      setRejectReason('');
      setRefreshKey(prev => prev + 1); // Refresh the list
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center ">
        <Spinner text="Loading ..." />
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-sm  text-slate-600 mb-2">No Pending Transfers</h3>
        <p className="text-gray-500">All transfer requests have been processed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {transfers.map(transfer => (
        <div key={transfer.id} className="border border-blue-200 rounded-lg p-6 bg-blue-50 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className=" text-slate-600 text-sm">Transfer Request #{transfer.id.slice(0, 8).toUpperCase()}</h3>
                  <p className="text-sm text-gray-600">
                    Submitted on: {formatDate(transfer.created_at)}
                  </p>
                </div>
                <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1 rounded-full">
                  Pending Approval
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Source Details</h4>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Branch:</span> {transfer.current_branch?.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Officer:</span> {transfer.current_officer?.full_name}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Destination Details</h4>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">New Branch:</span> {transfer.new_branch?.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">New Officer:</span> {transfer.new_officer?.full_name}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Initiated By</h4>
                <p className="text-sm text-gray-600">
                  {transfer.branch_manager?.full_name}
                </p>
                {transfer.remarks && (
                  <div className="mt-2">
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Remarks</h4>
                    <p className="text-sm text-gray-600 bg-white p-3 rounded border">
                      {transfer.remarks}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Customers to Transfer ({transfer.transfer_items?.length || 0})
                </h4>
                <div className="bg-white rounded-lg border overflow-hidden">
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID Number</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {transfer.transfer_items?.slice(0, 5).map((item, index) => (
                          <tr key={item.id || index} className="hover:bg-gray-50">
                            <td className="px-4 py-2">
                              {item.customer?.Firstname} {item.customer?.Surname}
                            </td>
                            <td className="px-4 py-2">{item.customer?.id_number}</td>
                            <td className="px-4 py-2">{item.customer?.mobile}</td>
                          </tr>
                        ))}
                        {transfer.transfer_items?.length > 5 && (
                          <tr>
                            <td colSpan="3" className="px-4 py-2 text-center text-sm text-gray-500">
                              ... and {transfer.transfer_items.length - 5} more customers
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-blue-200">
            <button
              onClick={() => handleApprove(transfer.id)}
              className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Approve Transfer
            </button>
            <button
              onClick={() => setSelectedTransfer(selectedTransfer === transfer.id ? null : transfer.id)}
              className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reject Transfer
            </button>
          </div>

          {selectedTransfer === transfer.id && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-semibold text-red-700 mb-2">Rejection Reason</h4>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this transfer request..."
                className="w-full p-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                rows="3"
              />
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => handleReject(transfer.id)}
                  className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors font-semibold"
                >
                  Confirm Rejection
                </button>
                <button
                  onClick={() => {
                    setSelectedTransfer(null);
                    setRejectReason('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PendingTransfersList;