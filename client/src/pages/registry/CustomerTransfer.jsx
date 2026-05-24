import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/userAuth.js';
import { usePermissions } from '../../hooks/usePermissions';
import { useWorkflowRoles } from '../../hooks/useWorkflowRoles';
import { useToast } from '../../components/Toast.jsx';
import { supabase } from '../../supabaseClient';
import Spinner from '../../components/Spinner.jsx';

const CustomerTransfer = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const { hasPermission } = usePermissions();
  const workflowRoles = useWorkflowRoles();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTransfer, setExpandedTransfer] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    if (profile) {
      fetchTransfers();
    }
  }, [profile]);


  const fetchTransfers = async () => {
    try {
      if (!profile) return;
      setLoading(true);

      let query = supabase
        .from('customer_transfer_requests')
        .select(`
          *,
          branch_manager:branch_manager_id (full_name),
          regional_manager:regional_manager_id (full_name),
          credit_analyst:credit_analyst_id (full_name),
          current_branch:current_branch_id (name, region_id),
          new_branch:new_branch_id (name, region_id),
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
          ),
          workflow_logs:transfer_workflow_logs (
            action,
            user:user_id (full_name),
            created_at,
            remarks
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

      if (profile.role === 'relationship_officer') {
        query = query.or(`current_officer_id.eq.${profile.id},new_officer_id.eq.${profile.id}`);
      } else if (profile.role === 'branch_manager' && profile.branch_id) {
        query = query.or(`current_branch_id.eq.${profile.branch_id},new_branch_id.eq.${profile.branch_id}`);
      } else if (profile.role === 'regional_manager' || profile.role === 'credit_analyst_officer' || profile.role === 'customer_service_officer') {
        // No additional restriction for these roles via query builder
      } else {
        setTransfers([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query;
      if (error) throw error;
      
      let roleFilteredTransfers = data || [];
      
      if (profile?.role === 'regional_manager' && profile.region_id) {
        roleFilteredTransfers = roleFilteredTransfers.filter(t => 
          (t.current_branch?.region_id?.toString() === profile.region_id?.toString()) || 
          (t.new_branch?.region_id?.toString() === profile.region_id?.toString())
        );
      }

      setTransfers(roleFilteredTransfers);
    } catch (error) {
      console.error('Error fetching transfers:', error);
      toast.error('Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTransfer = async (transferId) => {
    if (!hasPermission('transfers.confirm')) {
      toast.error('You do not have permission to approve transfers');
      return;
    }
    if (!profile?.id || !profile?.tenant_id) {
      toast.error('User authentication error. Please refresh and try again.');
      return;
    }

    setActionLoading(prev => ({ ...prev, [transferId]: 'approving' }));
    try {
      // 1. Update transfer request status
      const { error: updateError } = await supabase
        .from('customer_transfer_requests')
        .update({
          regional_manager_id: profile.id,
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId)
        .eq('tenant_id', profile.tenant_id);

      if (updateError) throw updateError;

      // 2. Log workflow action
      const { error: logError } = await supabase
        .from('transfer_workflow_logs')
        .insert({
          transfer_request_id: transferId,
          user_id: profile.id,
          tenant_id: profile.tenant_id,
          action: 'approved',
          remarks: `Transfer approved by ${workflowRoles.confirm}`
        });

      if (logError) throw logError;

      toast.success(`Transfer approved successfully! Awaiting ${workflowRoles.authorize} execution.`);
      await fetchTransfers();
    } catch (error) {
      console.error('Error approving transfer:', error);
      toast.error('Failed to approve transfer. Please try again.');
    } finally {
      setActionLoading(prev => ({ ...prev, [transferId]: false }));
    }
  };

  const handleRejectTransfer = async (transferId, reason) => {
    if (!hasPermission('transfers.confirm')) {
      toast.error('You do not have permission to reject transfers');
      return;
    }
    if (!profile?.id || !profile?.tenant_id) {
      toast.error('User authentication error. Please refresh and try again.');
      return;
    }

    if (!reason?.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setActionLoading(prev => ({ ...prev, [transferId]: 'rejecting' }));
    try {
      // 1. Update transfer request status
      const { error: updateError } = await supabase
        .from('customer_transfer_requests')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId)
        .eq('tenant_id', profile.tenant_id);

      if (updateError) throw updateError;

      // 2. Add workflow log
      const { error: logError } = await supabase
        .from('transfer_workflow_logs')
        .insert({
          transfer_request_id: transferId,
          user_id: profile.id,
          tenant_id: profile.tenant_id,
          action: 'rejected',
          remarks: `Transfer rejected: ${reason}`
        });

      if (logError) throw logError;

      toast.success('Transfer request rejected.');
      await fetchTransfers();
    } catch (error) {
      console.error('Error rejecting transfer:', error);
      toast.error('Failed to reject transfer. Please try again.');
    } finally {
      setActionLoading(prev => ({ ...prev, [transferId]: false }));
    }
  };

  const handleExecuteTransfer = async (transferId) => {
    if (!hasPermission('transfers.authorize')) {
      toast.error('You do not have permission to authorize transfers');
      return;
    }
    if (!profile?.id || !profile?.tenant_id) {
      toast.error('User authentication error. Please refresh and try again.');
      return;
    }

    setActionLoading(prev => ({ ...prev, [transferId]: 'executing' }));
    try {
      // 1. Get transfer details including customers
      const { data: transfer, error: fetchError } = await supabase
        .from('customer_transfer_requests')
        .select(`
          *,
          transfer_items:customer_transfer_items (
            customer_id
          )
        `)
        .eq('id', transferId)
        .eq('tenant_id', profile.tenant_id)
        .single();

      if (fetchError) throw fetchError;

      // 2. Update each customer's branch and officer
      if (transfer.transfer_items && transfer.transfer_items.length > 0) {
        const customerIds = transfer.transfer_items.map(item => item.customer_id);

        const { error: customerUpdateError } = await supabase
          .from('customers')
          .update({
            branch_id: transfer.new_branch_id,
            created_by: transfer.new_officer_id,
            updated_at: new Date().toISOString()
          })
          .in('id', customerIds)
          .eq('tenant_id', profile.tenant_id);

        if (customerUpdateError) throw customerUpdateError;
      }

      // 3. Update transfer request status
      const { error: statusError } = await supabase
        .from('customer_transfer_requests')
        .update({
          credit_analyst_id: profile.id,
          status: 'executed',
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId)
        .eq('tenant_id', profile.tenant_id);

      if (statusError) throw statusError;

      // 4. Update transfer items status
      const { error: itemsError } = await supabase
        .from('customer_transfer_items')
        .update({ status: 'transferred' })
        .eq('transfer_request_id', transferId)
        .eq('tenant_id', profile.tenant_id);

      // 5. Log workflow action
      const { error: logError } = await supabase
        .from('transfer_workflow_logs')
        .insert({
          transfer_request_id: transferId,
          user_id: profile.id,
          tenant_id: profile.tenant_id,
          action: 'executed',
          remarks: `Successfully transferred ${transfer.transfer_items.length} customer(s)`
        });

      if (logError) throw logError;

      toast.success(`Successfully transferred ${transfer.transfer_items.length} customer(s)!`);
      await fetchTransfers();
    } catch (error) {
      console.error('Error executing transfer:', error);
      toast.error('Failed to execute transfer. Please try again.');
    } finally {
      setActionLoading(prev => ({ ...prev, [transferId]: false }));
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending_approval: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
      approved: 'bg-green-100 text-green-800 border border-green-300',
      rejected: 'bg-red-100 text-red-800 border border-red-300',
      completed: 'bg-brand-primary text-brand-primary border border-brand-primary'
    };
    const statusText = {
      pending_approval: 'PENDING APPROVAL',
      approved: 'APPROVED',
      rejected: 'REJECTED',
      completed: 'COMPLETED'
    };
    return (
      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-outfit lowercase ${styles[status] || 'bg-gray-100 text-gray-800 border border-gray-300'}`}>
        {statusText[status] || status?.toUpperCase()}
      </span>
    );
  };

    const getActionButtons = (transfer) => {
    if (!profile) return null;

    // Determine if the user can review the transfer (approve/reject) based on permissions and status
    const canReview =
      (transfer.status === 'pending_approval' && hasPermission('transfers.confirm')) ||
      (transfer.status === 'approved' && hasPermission('transfers.authorize'));

    // If can review, navigate to the dedicated review page
    if (canReview) {
      return (
        <button
          onClick={() => navigate(`/registry/customer-transfer/${transfer.id}/review`)}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-outfit border shadow-sm transition-colors bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
        >
          Review
        </button>
      );
    }

    // Fallback: view details button for other statuses
    return (
      <button
        onClick={() => navigate(`/registry/customer-transfer/${transfer.id}/review`)}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-outfit border shadow-sm transition-colors bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
      >
        View Details
      </button>
    );
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
    <div className="min-h-screen bg-muted p-4">
      <div className="h-full flex flex-col">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xs text-slate-600 mb-1 font-outfit font-semibold">
              Registry / Customer Transfer Requests
            </h1>
          </div>
          <div className="text-xs text-brand-primary ">
            <span className="font-medium font-outfit text-brand-primary">{transfers.length}</span> transfer requests
          </div>
        </div>

        {/* Search and Action Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Create Transfer Button */}
            {hasPermission('transfers.initiate') && (
              <button
                onClick={() => navigate('/transfer')}
                className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-sm font-semibold text-[13px]  font-outfit shadow-md hover:shadow-lg transition-all duration-200"
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
className="w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm transition-all outline-none focus:border-slate-400 focus:ring-0"              />
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
              <thead className="sticky top-0 bg-white z-10 font-outfit text-[11px] text-slate-600  border-b border-gray-200">
                <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-outfit whitespace-nowrap ">
                  Transfer ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-outfit whitespace-nowrap ">
                  From Branch/Officer
                </th>
                <th className="px-4 py-3 text-left text-xs font-outfit whitespace-nowrap ">
                  To Branch/Officer
                </th>
                <th className="px-4 py-3 text-left text-xs font-outfit whitespace-nowrap ">
                  Customers
                </th>
                <th className="px-4 py-3 text-left text-xs font-outfit whitespace-nowrap ">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-outfit whitespace-nowrap ">
                  Initiated By
                </th>
                <th className="px-4 py-3 text-left text-xs font-outfit whitespace-nowrap ">
                  Created Date
                </th>
                <th className="px-4 py-3 text-center text-xs font-outfit whitespace-nowrap ">
                  Actions
                </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
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
                    <React.Fragment key={transfer.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs  text-gray-600 font-outfit">
                            #{transfer.id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <p className="text-xs font-outfit text-gray-600">
                              {transfer.current_branch?.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {transfer.current_officer?.full_name}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <p className="text-xs font-outfit text-gray-600">
                              {transfer.new_branch?.name}
                            </p>
                            <p className="text-xs font-outfit text-gray-500">
                              {transfer.new_officer?.full_name}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => toggleExpandTransfer(transfer.id)}
                            className="inline-flex items-center gap-1 text-brand-primary  hover:text-brand-btn-hover  text-xs transition-colors"
                          >
                            
                            {expandedTransfer === transfer.id ? 'Hide' : 'View'} Customers
                            <svg
                              className={`w-3 h-3 transform ${expandedTransfer === transfer.id ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            
                          </button>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {getStatusBadge(transfer.status)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <p className="text-xs text-slate-600">
                              {transfer.branch_manager?.full_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {workflowRoles.initiate}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs text-slate-600">
                            {formatDate(transfer.created_at)}
                          </span>
                        </td>
                        <td className="px-2 py-0.5 text-xs whitespace-nowrap text-center">
                          {getActionButtons(transfer)}
                        </td>
                      </tr>

                      {/* Expanded row for customer details */}
                      {expandedTransfer === transfer.id && (
                        <tr>
                          <td colSpan="8" className="bg-gray-50 p-4">
                            <div className="border-l-4 border-brand-primary pl-4">
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
                                        <div className={`w-2 h-2 mt-1 rounded-full ${log.action === 'initiated' ? 'bg-blue-500' :
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
                    </React.Fragment>
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
