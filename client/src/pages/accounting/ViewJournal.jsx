import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";
import Spinner from "../../components/Spinner";
import { API_BASE_URL } from "../../../config";

function ViewJournal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [journal, setJournal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { profile } = useAuth();
  const toast = useToast();

  const fetchJournal = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const response = await fetch(
        `${API_BASE_URL}/api/journals/${id}?tenant_id=${profile?.tenant_id}`,
        {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json'
          }
        }
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

  const handleAction = async (action) => {
    let url = '';
    let body = {};

    // Check Permissions for Approval/Rejection
    // Check Permissions for Approval/Rejection
    const allowedRoles = ['admin', 'superadmin', 'credit_analyst', 'credit_analyst_officer'];
    if (!allowedRoles.includes(profile.role)) {
      toast.error("You do not have permission to perform this action. Credit Analyst role required.");
      return;
    }

    switch (action) {
      case 'approve':
        const approvalNote = prompt("Enter approval note (optional):");
        if (approvalNote === null) return;
        url = `${API_BASE_URL}/api/journals/${id}/approve`;
        body = { tenant_id: profile?.tenant_id, approval_note: approvalNote };
        break;
      case 'reject':
        const rejectionReason = prompt("Enter rejection reason:");
        if (!rejectionReason) {
          toast.error("Rejection reason is required");
          return;
        }
        url = `${API_BASE_URL}/api/journals/${id}/reject`;
        body = { tenant_id: profile?.tenant_id, rejection_reason: rejectionReason };
        break;
      default:
        return;
    }

    if (action === 'approve' && !window.confirm("Approve and Post this journal? This will update wallets and GL.")) {
      return;
    }

    setActionLoading(true);
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        fetchJournal();
      } else {
        toast.error(`Action failed: ${data.error}`);
      }
    } catch (error) {
      console.error(`Error ${action}ing journal:`, error);
      toast.error(`Failed to ${action} journal`);
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
    <div className="p-6 bg-brand-surface min-h-screen">
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
                    Requires approval from a Credit Analyst to be posted to accounts.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction('approve')}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-white bg-brand-primary hover:bg-[#1E3A8A] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    ) : (
                      <CheckCircle size={12} />
                    )}
                    Approve & Post
                  </button>
                  <button
                    onClick={() => handleAction('reject')}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    ) : (
                      <XCircle size={12} />
                    )}
                    Reject
                  </button>
                </div>
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
    </div>
  );
}

export default ViewJournal;