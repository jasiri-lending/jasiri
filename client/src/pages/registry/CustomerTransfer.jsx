import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient.js';
import { useToast } from '../../components/Toast.jsx'; // Adjust import path as needed
import Spinner from '../../components/Spinner.jsx';

const CustomerTransfer = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [expandedTransfer, setExpandedTransfer] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    fetchCurrentUser();
    fetchTransfers();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, role, full_name')
          .eq('id', user.id)
          .single();
        setCurrentUser(userData);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
      toast.error('Failed to load user data');
    }
  };

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_transfer_requests')
        .select(`
          *,
          branch_manager:branch_manager_id (full_name),
          regional_manager:regional_manager_id (full_name),
          credit_analyst:credit_analyst_id (full_name),
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransfers(data || []);
    } catch (error) {
      console.error('Error fetching transfers:', error);
      toast.error('Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTransfer = async (transferId) => {
    if (!currentUser?.id) {
      toast.error('User not authenticated');
      return;
    }

    setActionLoading(prev => ({ ...prev, [transferId]: 'approving' }));
    try {
      // 1. Update transfer request status
      const { error: updateError } = await supabase
        .from('customer_transfer_requests')
        .update({
          regional_manager_id: currentUser.id,
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId);

      if (updateError) throw updateError;

      // 2. Log workflow action
      const { error: logError } = await supabase
        .from('transfer_workflow_logs')
        .insert({
          transfer_request_id: transferId,
          user_id: currentUser.id,
          action: 'approved',
          remarks: 'Transfer approved by regional manager'
        });

      if (logError) throw logError;

      toast.success('Transfer approved successfully! Awaiting credit analyst execution.');
      await fetchTransfers();
    } catch (error) {
      console.error('Error approving transfer:', error);
      toast.error('Failed to approve transfer: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [transferId]: false }));
    }
  };

  const handleRejectTransfer = async (transferId, reason) => {
    if (!currentUser?.id) {
      toast.error('User not authenticated');
      return;
    }

    if (!reason?.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setActionLoading(prev => ({ ...prev, [transferId]: 'rejecting' }));
    try {
      const { error: updateError } = await supabase
        .from('customer_transfer_requests')
        .update({
          status: 'rejected',
          remarks: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId);

      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from('transfer_workflow_logs')
        .insert({
          transfer_request_id: transferId,
          user_id: currentUser.id,
          action: 'rejected',
          remarks: reason
        });

      if (logError) throw logError;

      toast.success('Transfer request rejected.');
      await fetchTransfers();
    } catch (error) {
      console.error('Error rejecting transfer:', error);
      toast.error('Failed to reject transfer: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [transferId]: false }));
    }
  };

  const handleExecuteTransfer = async (transferId) => {
    if (!currentUser?.id) {
      toast.error('User not authenticated');
      return;
    }

    setActionLoading(prev => ({ ...prev, [transferId]: 'executing' }));
    try {
      // 1. Get transfer request details
      const { data: transferRequest, error: fetchError } = await supabase
        .from('customer_transfer_requests')
        .select(`
          *,
          new_branch:new_branch_id (id, region_id),
          transfer_items:customer_transfer_items (
            customer_id
          )
        `)
        .eq('id', transferId)
        .single();

      if (fetchError) throw fetchError;

      // 2. Get all customer IDs from transfer items
      const customerIds = transferRequest.transfer_items.map(item => item.customer_id);

      if (customerIds.length === 0) {
        throw new Error('No customers found for transfer');
      }

      // 3. Update customers with new branch, region, and officer
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          branch_id: transferRequest.new_branch_id,
          region_id: transferRequest.new_branch.region_id,
          created_by: transferRequest.new_officer_id,
          updated_at: new Date().toISOString()
        })
        .in('id', customerIds);

      if (updateError) throw updateError;

      // 4. Update transfer request status
      const { error: statusError } = await supabase
        .from('customer_transfer_requests')
        .update({
          credit_analyst_id: currentUser.id,
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId);

      if (statusError) throw statusError;

      // 5. Update transfer items status
      const { error: itemsError } = await supabase
        .from('customer_transfer_items')
        .update({ status: 'transferred' })
        .eq('transfer_request_id', transferId);

      if (itemsError) throw itemsError;

      // 6. Log workflow action
      const { error: logError } = await supabase
        .from('transfer_workflow_logs')
        .insert({
          transfer_request_id: transferId,
          user_id: currentUser.id,
          action: 'completed',
          remarks: `Transferred ${customerIds.length} customer(s)`
        });

      if (logError) throw logError;

      toast.success(`Successfully transferred ${customerIds.length} customer(s)!`);
      await fetchTransfers();
    } catch (error) {
      console.error('Error executing transfer:', error);
      toast.error('Failed to execute transfer: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [transferId]: false }));
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending_approval: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
      approved: 'bg-green-100 text-green-800 border border-green-300',
      rejected: 'bg-red-100 text-red-800 border border-red-300',
      completed: 'bg-blue-100 text-blue-800 border border-blue-300'
    };
    const statusText = {
      pending_approval: 'PENDING APPROVAL',
      approved: 'APPROVED',
      rejected: 'REJECTED',
      completed: 'COMPLETED'
    };
    return (
      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-800 border border-gray-300'}`}>
        {statusText[status] || status?.toUpperCase()}
      </span>
    );
  };

  const getActionButtons = (transfer) => {
    if (!currentUser) return null;

    switch(currentUser.role) {
      case 'regional_manager':
        if (transfer.status === 'pending_approval') {
          return (
            <div className="flex gap-2">
              <button
                onClick={() => handleApproveTransfer(transfer.id)}
                disabled={actionLoading[transfer.id] === 'approving'}
                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading[transfer.id] === 'approving' ? 'Approving...' : 'Approve'}
              </button>
              <button
                onClick={() => {
                  const reason = prompt('Please enter rejection reason:');
                  if (reason) handleRejectTransfer(transfer.id, reason);
                }}
                disabled={actionLoading[transfer.id] === 'rejecting'}
                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading[transfer.id] === 'rejecting' ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          );
        }
        break;

      case 'credit_analyst_officer':
        if (transfer.status === 'approved') {
          return (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to execute this transfer?')) {
                  handleExecuteTransfer(transfer.id);
                }
              }}
              disabled={actionLoading[transfer.id] === 'executing'}
              className="px-3 py-1 bg-brand-btn text-white text-xs rounded hover:bg-brand-btn disabled:opacity-50"
            >
              {actionLoading[transfer.id] === 'executing' ? 'Executing...' : 'Execute'}
            </button>
          );
        }
        break;

      default:
        return null;
    }

    return null;
  };

  const toggleExpandTransfer = (transferId) => {
    setExpandedTransfer(expandedTransfer === transferId ? null : transferId);
  };

  const filteredTransfers = transfers.filter(transfer =>
    transfer.current_branch?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transfer.new_branch?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transfer.current_officer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transfer.new_officer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transfer.branch_manager?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <div className="min-h-screen bg-brand-surface p-4">
      <div className="h-full flex flex-col">
        {/* Header Section */}
        <div className="mb-4">
          <h1 className="text-sm text-slate-600 mb-1">Customer Transfer Requests</h1>
        </div>

        {/* Search and Action Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Create Transfer Button */}
            {currentUser?.role === 'branch_manager' && (
              <button
                onClick={() => navigate('/transfer')}
                className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Transfer Request
              </button>
            )}

            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search by branch, officer, or manager..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-1 min-h-0">
          <div className="h-full overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Transfer ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    From Branch/Officer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    To Branch/Officer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Customers
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Initiated By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Created Date
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                        <p className="text-gray-500 text-sm">Loading transfers...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-gray-500 text-sm">No transfer records found</p>
                        <p className="text-gray-400 text-xs">Try adjusting your search or create a new transfer</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((transfer) => (
                    <>
                      <tr key={transfer.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-mono text-gray-900">
                            #{transfer.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {transfer.current_branch?.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {transfer.current_officer?.full_name}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {transfer.new_branch?.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {transfer.new_officer?.full_name}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleExpandTransfer(transfer.id)}
                            className="inline-flex items-center gap-1 text-brand-btn hover:text-brand-btn-hoover font-semibold text-sm transition-colors"
                          >
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                              {transfer.transfer_items?.length || 0}
                            </span>
                            {expandedTransfer === transfer.id ? 'Hide' : 'View'} Customers
                            <svg
                              className={`w-4 h-4 transform ${expandedTransfer === transfer.id ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getStatusBadge(transfer.status)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <p className="text-sm text-gray-900">
                              {transfer.branch_manager?.full_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              Branch Manager
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-500">
                            {formatDate(transfer.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {getActionButtons(transfer)}
                        </td>
                      </tr>
                      
                      {/* Expanded row for customer details */}
                      {expandedTransfer === transfer.id && (
                        <tr>
                          <td colSpan="8" className="bg-gray-50 p-4">
                            <div className="border-l-4 border-blue-500 pl-4">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                Customer Details ({transfer.transfer_items?.length || 0} customers)
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {transfer.transfer_items?.map((item, index) => (
                                  <div key={item.id || index} className="bg-white p-4 rounded-lg border">
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <p className="font-medium text-gray-900">
                                          {item.customer?.Firstname} {item.customer?.Surname}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                          ID: {item.customer?.id_number}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          Phone: {item.customer?.mobile}
                                        </p>
                                      </div>
                                      <span className="text-xs font-medium text-gray-500">
                                        #{index + 1}
                                      </span>
                                    </div>
                                    <div className="mt-3 flex items-center text-xs text-gray-600">
                                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      Transferring to {transfer.new_branch?.name}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              
                              {/* Workflow Logs */}
                              {transfer.workflow_logs && transfer.workflow_logs.length > 0 && (
                                <div className="mt-6">
                                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Workflow History</h4>
                                  <div className="space-y-2">
                                    {transfer.workflow_logs.map((log, index) => (
                                      <div key={index} className="flex items-start gap-3 text-sm">
                                        <div className={`w-2 h-2 mt-1 rounded-full ${
                                          log.action === 'initiated' ? 'bg-blue-500' :
                                          log.action === 'approved' ? 'bg-green-500' :
                                          log.action === 'rejected' ? 'bg-red-500' :
                                          log.action === 'completed' ? 'bg-purple-500' : 'bg-gray-500'
                                        }`}></div>
                                        <div>
                                          <p className="font-medium text-gray-900">
                                            {log.action.charAt(0).toUpperCase() + log.action.slice(1)} by {log.user?.full_name}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {formatDate(log.created_at)}
                                          </p>
                                          {log.remarks && (
                                            <p className="text-xs text-gray-600 mt-1">
                                              {log.remarks}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results Count */}
        {!loading && filteredTransfers.length > 0 && (
          <div className="mt-3 text-center text-xs text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredTransfers.length}</span> transfer request{filteredTransfers.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerTransfer;