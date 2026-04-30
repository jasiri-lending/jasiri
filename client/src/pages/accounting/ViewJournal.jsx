import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, ArrowRight, AlertCircle, X, Info } from "lucide-react";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";
import Spinner from "../../components/Spinner";
import { apiFetch } from "../../utils/api";
import { usePermissions } from "../../hooks/usePermissions";

function ViewJournal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [journal, setJournal] = useState(null);
  const [loading, setLoading] = useState(true);
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState(null); // 'approve' | 'reject'
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const { profile } = useAuth();
  const toast = useToast();
  const { hasPermission } = usePermissions();

  const fetchJournal = async () => {
    try {
      const response = await apiFetch(
        `/api/journals/${id}?tenant_id=${profile?.tenant_id}`
      );

      const data = await response.json();

      if (data.success) {
        setJournal(data.journal);
      } else {
        console.error("Failed to fetch journal:", data.error);
      }
    } catch (error) {
      console.error("Error fetching journal:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchJournal();
    }
  }, [id, profile?.tenant_id]);

  const openActionModal = (action) => {
    setModalAction(action);
    setActionReason("");
    setIsModalOpen(true);
  };

  const closeActionModal = () => {
    setIsModalOpen(false);
    setModalAction(null);
    setActionReason("");
  };

  const handleSubmitAction = async () => {
    if (modalAction === 'reject' && !actionReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    setActionLoading(true);
    const endpoint = modalAction === 'approve' ? 'approve' : 'reject';
    const body = {
      tenant_id: profile?.tenant_id,
      [modalAction === 'approve' ? 'approval_note' : 'rejection_reason']: actionReason
    };

    try {
      const response = await apiFetch(`/api/journals/${id}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        fetchJournal();
        closeActionModal();
      } else {
        toast.error(`Action failed: ${data.error}`);
      }
    } catch (error) {
      console.error(`Error ${modalAction}ing journal:`, error);
      toast.error(`Failed to ${modalAction} journal`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200'; // Approved is finalized now
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (!journal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Journal not found</h2>
          <button
            onClick={() => navigate("/accounting/journals")}
            className="mt-4 px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-100 transition-colors mx-auto"
          >
            <ArrowLeft size={14} />
            Back to Journals
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6 bg-muted min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Journals / Journal Details
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 max-w-5xl mx-auto">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">
              Journal Entry #{journal.id}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Created on {formatDate(journal.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(journal.status)}`}>
              {journal.status.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="p-6">
          {/* Pending Notice (No Buttons here) */}
          {journal.status === 'pending' && (
            <div className="mb-8 p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="text-amber-600 h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900">Pending Review</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  This journal entry is currently awaiting authorization. Please review the details below before taking action.
                </p>
              </div>
            </div>
          )}

          {/* Journal Details */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            {/* Basic Information */}
            <div className="col-span-2 grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-md">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Journal Type
                </label>
                <p className="text-xs text-gray-900 font-medium capitalize">
                  {journal.journal_type}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Amount
                </label>
                <p className="text-xs text-gray-900 font-semibold">
                  {parseFloat(journal.amount).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {journal.journal_type === 'transfer' ? 'Sender' : 'Customer'}
                </label>
                <p className="text-xs text-gray-900">
                  {journal.customer_name || "Unknown"}
                  {journal.customers?.account_number && (
                    <span className="text-gray-500 ml-2">(#{journal.customers.account_number})</span>
                  )}
                </p>
              </div>
              {/* Recipient for Transfer */}
              {journal.journal_type === 'transfer' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Recipient
                  </label>
                  <div className="flex items-center gap-2">
                    <ArrowRight size={12} className="text-gray-400" />
                    <p className="text-xs text-gray-900">
                      {journal.recipient_name || "Unknown"}
                    </p>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Entry Date
                </label>
                <p className="text-xs text-gray-900">
                  {new Date(journal.entry_date).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Description
              </label>
              <p className="text-xs text-gray-900 leading-relaxed p-3 bg-gray-50 rounded">
                {journal.description || "No description provided"}
              </p>
            </div>

            {/* Created By */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Created By
              </label>
              <p className="text-xs text-gray-900">
                {journal.created_by_name || "N/A"}
              </p>
            </div>

            {/* Created At */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Created At
              </label>
              <p className="text-xs text-gray-900">
                {formatDate(journal.created_at)}
              </p>
            </div>

            {/* Approval Information */}
            {journal.approved_by && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Approved By
                  </label>
                  <p className="text-xs text-gray-900">
                    {journal.approved_by_name || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Approved At
                  </label>
                  <p className="text-xs text-gray-900">
                    {formatDate(journal.approved_at)}
                  </p>
                </div>
                {journal.approval_note && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Approval Note
                    </label>
                    <p className="text-xs text-gray-900 italic">
                      "{journal.approval_note}"
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Rejection Information */}
            {journal.rejected_by && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Rejected By
                  </label>
                  <p className="text-xs text-gray-900">
                    {journal.rejected_by_name || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Rejected At
                  </label>
                  <p className="text-xs text-gray-900">
                    {formatDate(journal.rejected_at)}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Rejection Reason
                  </label>
                  <p className="text-xs text-gray-900 italic text-red-600">
                    "{journal.rejection_reason}"
                  </p>
                </div>
              </>
            )}

            {/* Account Entries */}
            {journal.journal_entry_id && journal.journal_entries && (
              <div className="col-span-2 mt-6">
                <h3 className="text-xs font-semibold text-gray-700 mb-3 border-b pb-2">
                  Accounting Entries
                </h3>
                <div className="bg-gray-50 rounded-md p-4">
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Journal Entry ID
                    </label>
                    <p className="text-xs text-gray-900 font-mono">
                      {journal.journal_entry_id}
                    </p>
                  </div>

                  {journal.journal_entries?.journal_entry_lines?.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">
                        Double Entry Lines
                      </label>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="px-3 py-2 text-left font-medium text-gray-600">Account</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-600">Debit</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-600">Credit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {journal.journal_entries.journal_entry_lines.map((line, index) => (
                              <tr key={line.id} className="border-b border-gray-200">
                                <td className="px-3 py-2">
                                  <div className="font-medium">{line.account?.account_name}</div>
                                  <div className="text-gray-500 text-xs">{line.account?.code}</div>
                                </td>
                                <td className="px-3 py-2 text-right font-medium">
                                  {parseFloat(line.debit).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="px-3 py-2 text-right font-medium">
                                  {parseFloat(line.credit).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-8 py-6 bg-gray-50 flex justify-between items-center rounded-b-lg">
          <button
            onClick={() => navigate("/accounting/journals")}
            className="px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-semibold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-900 transition-all shadow-sm"
          >
            <ArrowLeft size={16} /> Back to Journals
          </button>

          {journal.status === 'pending' && hasPermission('journal.approve') && (
            <div className="flex gap-3">
              <button
                onClick={() => openActionModal('reject')}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-lg flex items-center gap-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all shadow-md shadow-red-100 hover:shadow-red-200 active:scale-95 disabled:opacity-50 disabled:scale-100"
              >
                <XCircle size={16} />
                Reject Entry
              </button>
              <button
                onClick={() => openActionModal('approve')}
                disabled={actionLoading}
                className="px-6 py-2.5 rounded-lg flex items-center gap-2 text-xs font-bold text-white bg-brand-primary hover:bg-[#1E3A8A] transition-all shadow-md shadow-brand-primary/20 hover:shadow-brand-primary/40 active:scale-95 disabled:opacity-50 disabled:scale-100"
              >
                <CheckCircle size={16} />
                Approve & Post
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ACTION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className={`px-6 py-5 border-b flex justify-between items-center ${modalAction === 'approve' ? 'bg-brand-surface/30' : 'bg-red-50'
              }`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${modalAction === 'approve' ? 'bg-brand-primary/10 text-brand-primary' : 'bg-red-100 text-red-600'
                  }`}>
                  {modalAction === 'approve' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                </div>
                <h3 className={`text-sm font-bold ${modalAction === 'approve' ? 'text-brand-primary' : 'text-red-800'
                  }`}>
                  {modalAction === 'approve' ? 'Approve & Post Journal' : 'Reject Journal Entry'}
                </h3>
              </div>
              <button
                onClick={closeActionModal}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full"
                disabled={actionLoading}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {actionLoading ? (
                <div className="py-8 flex justify-center">
                  <Spinner text={modalAction === 'approve' ? 'Approving Journal...' : 'Rejecting Journal...'} />
                </div>
              ) : (
                <>
                  <div className="mb-6 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-inner">
                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                      <h4 className="text-[10px] uppercase tracking-widest font-black text-slate-500">Transaction Summary</h4>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-y-4 gap-x-6">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1">Type</span>
                        <span className="text-xs font-bold text-slate-700 capitalize">{journal?.journal_type}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1">Total Amount</span>
                        <span className="text-xs font-black text-brand-primary">KES {parseFloat(journal?.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="col-span-2 flex flex-col pt-3 border-t border-slate-100">
                        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1">Primary Customer</span>
                        <span className="text-xs font-semibold text-slate-800">{journal?.customer_name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] leading-relaxed text-blue-800">
                      {modalAction === 'approve'
                        ? 'Confirming this action will finalize the journal entry, post it to the General Ledger, and update relevant customer wallet balances.'
                        : 'Please state the reason for rejecting this entry. This will be recorded in the audit logs.'
                      }
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                      {modalAction === 'approve' ? 'Approval Note (Optional)' : 'Rejection Reason (Required)'}
                    </label>
                    <textarea
                      className="w-full text-xs border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all placeholder:text-gray-300 min-h-[100px]"
                      placeholder={modalAction === 'approve' ? 'Add a brief note about this approval...' : 'Provide specific reasons for this rejection...'}
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            {!actionLoading && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button
                  onClick={closeActionModal}
                  className="px-4 py-2 text-xs font-bold text-slate-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-slate-700 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAction}
                  className={`px-6 py-2 text-xs font-bold text-white rounded-lg transition-all shadow-md active:scale-95 ${modalAction === 'approve'
                    ? 'bg-brand-primary hover:bg-[#1E3A8A] shadow-brand-primary/20'
                    : 'bg-red-600 hover:bg-red-700 shadow-red-100'
                    }`}
                >
                  {modalAction === 'approve' ? 'Post to Ledger' : 'Confirm Rejection'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ViewJournal;