import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, ArrowRight } from "lucide-react";
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
          {/* Action Buttons for Pending Journals */}
          {journal.status === 'pending' && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Pending Approval</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Requires approval from an authorized user to be posted to accounts.
                  </p>
                </div>
                {hasPermission('journal.approve') && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => openActionModal('approve')}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-white bg-brand-primary hover:bg-[#1E3A8A] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle size={12} />
                      Approve & Post
                    </button>
                    <button
                      onClick={() => openActionModal('reject')}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle size={12} />
                      Reject
                    </button>
                  </div>
                )}
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
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <button
            onClick={() => navigate("/accounting/journals")}
            className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Journals
          </button>
        </div>
      </div>

      {/* ACTION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex justify-between items-center ${modalAction === 'approve' ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'
              }`}>
              <h3 className={`text-sm font-semibold ${modalAction === 'approve' ? 'text-blue-800' : 'text-red-800'
                }`}>
                {modalAction === 'approve' ? 'Approve Journal Entry' : 'Reject Journal Entry'}
              </h3>
              <button
                onClick={closeActionModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={actionLoading}
              >
                <X size={18} />
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
                  <p className="text-sm text-gray-600 mb-4">
                    {modalAction === 'approve'
                      ? 'Are you sure you want to approve this journal? This will post the transaction to the ledger and update wallet balances.'
                      : 'Please provide a reason for rejecting this journal entry.'
                    }
                  </p>

                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-700">
                      {modalAction === 'approve' ? 'Approval Note (Optional)' : 'Rejection Reason (Required)'}
                    </label>
                    <textarea
                      className="w-full text-xs border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-brand-btn focus:border-transparent outline-none transition-all"
                      rows={4}
                      placeholder={modalAction === 'approve' ? 'Enter any notes...' : 'Enter reason for rejection...'}
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
                  className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAction}
                  className={`px-4 py-2 text-xs font-medium text-white rounded-md transition-colors ${modalAction === 'approve'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-red-600 hover:bg-red-700'
                    }`}
                >
                  {modalAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
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