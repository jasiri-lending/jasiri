import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../hooks/userAuth.js';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../components/Toast.jsx';
import Spinner from '../../components/Spinner.jsx';

// Format a role slug into a readable label, e.g. 'branch_manager' → 'Branch Manager'
const formatRole = (role) =>
  role ? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';

const TransferReviewPage = () => {
  const { transferId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { hasPermission } = usePermissions();
  const toast = useToast();

  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  useEffect(() => {
    if (profile && transferId) fetchTransfer();
  }, [profile, transferId]);

  const fetchTransfer = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_transfer_requests')
        .select(`
          *,
          branch_manager:branch_manager_id (full_name, role),
          regional_manager:regional_manager_id (full_name, role),
          credit_analyst:credit_analyst_id (full_name, role),
          current_branch:current_branch_id (name),
          new_branch:new_branch_id (name, region_id),
          current_officer:current_officer_id (full_name),
          new_officer:new_officer_id (full_name),
          transfer_items:customer_transfer_items (
            id,
            customer:customer_id (
              id,
              Firstname,
              Middlename,
              Surname,
              id_number,
              mobile
            )
          ),
          workflow_logs:transfer_workflow_logs (
            action,
            user:user_id (full_name, role),
            created_at,
            remarks
          )
        `)
        .eq('id', transferId)
        .eq('tenant_id', profile.tenant_id)
        .single();

      if (error) throw error;
      setTransfer(data);
    } catch (error) {
      console.error('Error fetching transfer:', error);
      toast.error('Failed to load transfer details.');
      navigate('/registry/customer-transfer');
    } finally {
      setLoading(false);
    }
  };

  // ─── Approve (transfers.confirm) ───────────────────────────────────────────
  const handleApprove = async () => {
    if (!hasPermission('transfers.confirm')) {
      toast.error('You do not have permission to approve transfers.');
      return;
    }
    setActionLoading(true);
    try {
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

      const { error: logError } = await supabase
        .from('transfer_workflow_logs')
        .insert({
          transfer_request_id: transferId,
          user_id: profile.id,
          tenant_id: profile.tenant_id,
          action: 'approved',
          remarks: null // Removed redundant text
        });
      if (logError) throw logError;

      toast.success('Transfer approved! Awaiting final authorization.');
      navigate('/registry/customer-transfer');
    } catch (error) {
      console.error('Error approving transfer:', error);
      toast.error('Failed to approve transfer.');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Reject (transfers.confirm) ────────────────────────────────────────────
  const handleReject = async () => {
    if (!hasPermission('transfers.confirm')) {
      toast.error('You do not have permission to reject transfers.');
      return;
    }
    if (!rejectReason.trim()) {
      toast.warning('Please provide a reason for rejection.');
      return;
    }
    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('customer_transfer_requests')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId)
        .eq('tenant_id', profile.tenant_id);
      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from('transfer_workflow_logs')
        .insert({
          transfer_request_id: transferId,
          user_id: profile.id,
          tenant_id: profile.tenant_id,
          action: 'rejected',
          remarks: `Rejected: ${rejectReason}`
        });
      if (logError) throw logError;

      toast.success('Transfer request rejected.');
      navigate('/registry/customer-transfer');
    } catch (error) {
      console.error('Error rejecting transfer:', error);
      toast.error('Failed to reject transfer.');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Execute (transfers.authorize) ─────────────────────────────────────────
  const handleExecute = async () => {
    if (!hasPermission('transfers.authorize')) {
      toast.error('You do not have permission to execute transfers.');
      return;
    }
    setActionLoading(true);
    try {
      const customerIds = transfer.transfer_items.map(i => i.customer.id || i.customer_id).filter(Boolean);

      // Update customers
      if (customerIds.length > 0) {
        const { error: custErr } = await supabase
          .from('customers')
          .update({
            branch_id: transfer.new_branch_id,
            region_id: transfer.new_branch?.region_id || null,
            created_by: transfer.new_officer_id,
            updated_at: new Date().toISOString()
          })
          .in('id', customerIds)
          .eq('tenant_id', profile.tenant_id);
        if (custErr) throw custErr;
      }

      // Update request status
      const { error: statusErr } = await supabase
        .from('customer_transfer_requests')
        .update({
          credit_analyst_id: profile.id,
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', transferId)
        .eq('tenant_id', profile.tenant_id);
      if (statusErr) throw statusErr;

      // Update items
      await supabase
        .from('customer_transfer_items')
        .update({ status: 'transferred' })
        .eq('transfer_request_id', transferId)
        .eq('tenant_id', profile.tenant_id);

      // Log
      const { error: logErr } = await supabase
        .from('transfer_workflow_logs')
        .insert({
          transfer_request_id: transferId,
          user_id: profile.id,
          tenant_id: profile.tenant_id,
          action: 'completed',
          remarks: null // Removed redundant text
        });
      if (logErr) throw logErr;

      toast.success(`Successfully transferred ${transfer.transfer_items.length} customer(s)!`);
      navigate('/registry/customer-transfer');
    } catch (error) {
      console.error('Error executing transfer:', error);
      toast.error('Failed to execute transfer.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }) : '—';

  const logColor = {
    initiated: 'bg-blue-500',
    approved: 'bg-green-500',
    rejected: 'bg-red-500',
    completed: 'bg-purple-500',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Spinner text="Loading transfer details..." />
      </div>
    );
  }

  if (!transfer) return null;

  const canApproveReject = hasPermission('transfers.confirm') && transfer.status === 'pending_approval';
  const canExecute = hasPermission('transfers.authorize') && transfer.status === 'approved';

  return (
    <div className="min-h-screen bg-muted p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/registry/customer-transfer')}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Transfers
            </button>
            <h1 className="text-lg font-semibold text-slate-700">
              Transfer Request <span className="font-mono text-slate-500">#{transfer.id.slice(0, 8).toUpperCase()}</span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Submitted on {formatDate(transfer.created_at)}</p>
          </div>

          {/* Status pill */}
          <span className={`inline-flex px-4 py-1.5 rounded-full text-xs font-bold tracking-wide border ${
            transfer.status === 'pending_approval' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' :
            transfer.status === 'approved'         ? 'bg-green-50  text-green-700  border-green-300'  :
            transfer.status === 'completed'        ? 'bg-blue-50   text-blue-700   border-blue-300'   :
            transfer.status === 'rejected'         ? 'bg-red-50    text-red-700    border-red-300'    :
            'bg-gray-100 text-gray-700 border-gray-300'
          }`}>
            {transfer.status === 'pending_approval' ? 'Pending Approval' :
             transfer.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
        </div>

        {/* ── Transfer Route ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Transfer Details</h2>

          {/* From → To visual */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">From Branch</p>
              <p className="font-bold text-gray-900">{transfer.current_branch?.name}</p>
              <p className="text-sm text-gray-500 mt-1">{transfer.current_officer?.full_name}</p>
            </div>

            <div className="flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>

            <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">To Branch</p>
              <p className="font-bold text-gray-900">{transfer.new_branch?.name}</p>
              <p className="text-sm text-gray-500 mt-1">{transfer.new_officer?.full_name}</p>
            </div>
          </div>

          {/* Initiated by */}
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Initiated By ({formatRole(transfer.branch_manager?.role)})</p>
              <p className="text-sm font-semibold text-gray-800">{transfer.branch_manager?.full_name}</p>
            </div>
            {transfer.regional_manager && (
              <>
                <div className="mx-2 text-gray-300">|</div>
                <div>
                  <p className="text-xs text-gray-500">Approved By ({formatRole(transfer.regional_manager?.role)})</p>
                  <p className="text-sm font-semibold text-gray-800">{transfer.regional_manager.full_name}</p>
                </div>
              </>
            )}
          </div>

          {transfer.remarks && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Remarks</p>
              <p className="text-sm text-gray-700">{transfer.remarks}</p>
            </div>
          )}
        </div>

        {/* ── Customers Being Transferred ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Customers Being Transferred
            </h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
              {transfer.transfer_items?.length || 0} customers
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ID Number</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Destination</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transfer.transfer_items?.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-sm text-gray-400">{idx + 1}</td>
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-gray-900">
                        {item.customer?.Firstname} {item.customer?.Middlename || ''} {item.customer?.Surname}
                      </p>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">{item.customer?.id_number}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{item.customer?.mobile}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">{transfer.current_branch?.name}</span>
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span className="text-xs font-semibold text-green-700">{transfer.new_branch?.name}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Workflow Timeline ── */}
        {transfer.workflow_logs && transfer.workflow_logs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Workflow History</h2>
            <div className="space-y-3">
              {[...transfer.workflow_logs]
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                .map((log, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${logColor[log.action] || 'bg-gray-400'}`} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800 capitalize">
                        {log.action}{' '}
                        <span className="font-normal text-gray-500">
                          by {log.user?.full_name}
                          {log.user?.role && (
                            <span className="ml-1 text-xs text-gray-400">({formatRole(log.user.role)})</span>
                          )}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(log.created_at)}</p>
                      {log.remarks && 
                       !log.remarks.toLowerCase().includes('initiated by') && 
                       !log.remarks.toLowerCase().includes('approved by') && 
                       !log.remarks.toLowerCase().includes('transferred') && (
                        <p className="text-xs text-gray-600 mt-0.5 italic">{log.remarks}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Action Panel ── */}
        {(canApproveReject || canExecute) && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Your Action</h2>

            {/* APPROVE / REJECT */}
            {canApproveReject && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  As <strong>{formatRole(profile?.role)}</strong>, you can approve or reject this transfer request.
                </p>

                {!showRejectInput ? (
                  <div className="flex gap-3">
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      id="approve-transfer-btn"
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      {actionLoading ? (
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      Approve Transfer
                    </button>
                    <button
                      onClick={() => setShowRejectInput(true)}
                      disabled={actionLoading}
                      id="reject-transfer-trigger-btn"
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject Transfer
                    </button>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-semibold text-red-700">Rejection Reason</p>
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Please clearly state the reason for rejection..."
                      rows={3}
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all bg-white"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setShowRejectInput(false); setRejectReason(''); }}
                        className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={actionLoading || !rejectReason.trim()}
                        id="confirm-reject-btn"
                        className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? 'Rejecting…' : 'Confirm Rejection'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* EXECUTE */}
            {canExecute && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  As <strong>{formatRole(profile?.role)}</strong>, this transfer has been approved and is ready for execution.
                  Executing will move all {transfer.transfer_items?.length} customer(s) to <strong>{transfer.new_branch?.name}</strong>.
                </p>
                <button
                  onClick={handleExecute}
                  disabled={actionLoading}
                  id="execute-transfer-btn"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-btn text-white rounded-lg font-semibold text-sm hover:bg-brand-btn-hover disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {actionLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Executing Transfer…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Execute Transfer Now
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferReviewPage;
