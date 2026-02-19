import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import Spinner from '../../components/Spinner.jsx';

const ApprovedTransfersList = ({ onExecute }) => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [executingTransfer, setExecutingTransfer] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchApprovedTransfers();
  }, [refreshKey]);

  const fetchApprovedTransfers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_transfer_requests')
        .select(`
          id,
          created_at,
          updated_at,
          remarks,
          branch_manager:branch_manager_id (full_name),
          regional_manager:regional_manager_id (full_name),
          current_branch:current_branch_id (name),
          new_branch:new_branch_id (name, region_id),
          current_officer:current_officer_id (full_name),
          new_officer:new_officer_id (full_name),
          transfer_items:customer_transfer_items (
            id,
            customer:customer_id (
              Firstname,
              Surname,
              id_number,
              mobile,
              branch_id,
              region_id,
              created_by
            )
          ),
          workflow_logs:transfer_workflow_logs (
            action,
            user:user_id (full_name),
            created_at,
            remarks
          )
        `)
        .eq('status', 'approved')
        .eq('tenant_id', currentUser?.tenant_id)
        .order('updated_at', { ascending: true });

      if (error) throw error;
      setTransfers(data || []);
    } catch (error) {
      console.error('Error fetching approved transfers:', error);
      alert('Failed to load approved transfers: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (transferId) => {
    if (window.confirm('Are you sure you want to execute this transfer? This action cannot be undone.')) {
      setExecutingTransfer(transferId);
      try {
        await onExecute(transferId);
        setRefreshKey(prev => prev + 1); // Refresh the list
      } finally {
        setExecutingTransfer(null);
      }
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
      <div className="min-h-screen" style={{ backgroundColor: '#d9e2e8' }}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Spinner text="Loading 360 view..." />
          </div>
        </div>
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="text-sm  text-gray-900 mb-2">No Approved Transfers</h3>
        <p className="text-gray-500">All transfers have been executed or are pending approval.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {transfers.map(transfer => {
        const initiationLog = transfer.workflow_logs?.find(log => log.action === 'initiated');
        const approvalLog = transfer.workflow_logs?.find(log => log.action === 'approved');

        return (
          <div key={transfer.id} className="border border-green-200 rounded-lg p-6 bg-green-50 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className=" text-slate-600 text-xl mb-1">
                  Transfer Request #{transfer.id.slice(0, 8).toUpperCase()}
                </h3>
                <div className="flex items-center gap-4">
                  <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
                    Approved - Ready for Execution
                  </span>
                  <span className="text-sm text-gray-600">
                    Approved on: {formatDate(transfer.updated_at)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Left Column - Transfer Details */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Transfer Details</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">From Branch</p>
                      <p className="text-sm text-gray-900">{transfer.current_branch?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">To Branch</p>
                      <p className="text-sm text-gray-900">{transfer.new_branch?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">From Officer</p>
                      <p className="text-sm text-gray-900">{transfer.current_officer?.full_name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">To Officer</p>
                      <p className="text-sm text-gray-900">{transfer.new_officer?.full_name}</p>
                    </div>
                  </div>

                  {transfer.remarks && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Remarks</p>
                      <p className="text-sm text-gray-900 bg-white p-3 rounded border">
                        {transfer.remarks}
                      </p>
                    </div>
                  )}
                </div>

                {/* Workflow Timeline */}
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Workflow Timeline</h4>
                  <div className="space-y-3">
                    {initiationLog && (
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Initiated by {initiationLog.user?.full_name}</p>
                          <p className="text-xs text-gray-500">{formatDate(initiationLog.created_at)}</p>
                        </div>
                      </div>
                    )}
                    {approvalLog && (
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Approved by {approvalLog.user?.full_name}</p>
                          <p className="text-xs text-gray-500">{formatDate(approvalLog.created_at)}</p>
                          {approvalLog.remarks && (
                            <p className="text-xs text-gray-600 mt-1">{approvalLog.remarks}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Customer List */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">
                    Customers to Transfer ({transfer.transfer_items?.length || 0})
                  </h4>
                  <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                    Ready for Transfer
                  </span>
                </div>

                <div className="bg-white rounded-lg border overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Number</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Branch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {transfer.transfer_items?.map((item, index) => (
                          <tr key={item.id || index} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {item.customer?.Firstname} {item.customer?.Surname}
                                </p>
                                <p className="text-xs text-gray-500">{item.customer?.mobile}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">{item.customer?.id_number}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-900">
                                  {transfer.current_branch?.name}
                                </span>
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                                <span className="text-xs font-medium text-green-600">
                                  {transfer.new_branch?.name}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-600">
                  <p className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    This transfer will move {transfer.transfer_items?.length || 0} customer(s) from {transfer.current_branch?.name} to {transfer.new_branch?.name}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-green-200 flex justify-end">
              <button
                onClick={() => handleExecute(transfer.id)}
                disabled={executingTransfer === transfer.id}
                className="px-6 py-3 bg-brand-btn text-white rounded-lg hover:bg-brand-btn-hover disabled:bg-brand-btn-disabled disabled:cursor-not-allowed transition-colors font-semibold flex items-center gap-3"
              >
                {executingTransfer === transfer.id ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Executing Transfer...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Execute Transfer Now
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ApprovedTransfersList;