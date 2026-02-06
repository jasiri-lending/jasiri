import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, Send, Clock } from "lucide-react";
import { useAuth } from "../../hooks/userAuth";
import { API_BASE_URL } from "../../../config";

function ViewJournal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [journal, setJournal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { profile } = useAuth();

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
    let confirmMessage = '';
    
    switch (action) {
      case 'post':
        confirmMessage = "Are you sure you want to post this journal to accounting?";
        url = `${API_BASE_URL}/api/journals/${id}/post`;
        body = { tenant_id: profile?.tenant_id, posted_by: profile?.id };
        break;
      case 'approve':
        const approvalNote = prompt("Enter approval note (optional):");
        if (approvalNote === null) return; // User cancelled
        url = `${API_BASE_URL}/api/journals/${id}/approve`;
        body = { tenant_id: profile?.tenant_id, approval_note: approvalNote };
        break;
      case 'reject':
        const rejectionReason = prompt("Enter rejection reason:");
        if (!rejectionReason) {
          alert("Rejection reason is required");
          return;
        }
        url = `${API_BASE_URL}/api/journals/${id}/reject`;
        body = { tenant_id: profile?.tenant_id, rejection_reason: rejectionReason };
        break;
      default:
        return;
    }

    if (action === 'post' && !window.confirm(confirmMessage)) {
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
        alert(data.message);
        fetchJournal(); // Refresh journal data
      } else {
        alert(`Action failed: ${data.error}`);
      }
    } catch (error) {
      console.error(`Error ${action}ing journal:`, error);
      alert(`Failed to ${action} journal`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'posted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'approved':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-brand-surface min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#586ab1] mx-auto"></div>
          <p className="text-xs text-gray-500 mt-2">Loading journal details...</p>
        </div>
      </div>
    );
  }

  if (!journal) {
    return (
      <div className="p-6 bg-brand-surface min-h-screen">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-xs text-gray-500">Journal not found</p>
          <button
            onClick={() => navigate("/journals")}
            className="mt-4 px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-100 transition-colors mx-auto"
          >
            <ArrowLeft size={14} /> Back to Journals
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
                <div className="flex items-center gap-2">
                  <Clock className="text-yellow-600" size={16} />
                  <p className="text-xs font-medium text-yellow-800">
                    This journal is pending. Choose an action:
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction('post')}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    ) : (
                      <Send size={12} />
                    )}
                    Post to Accounting
                  </button>
                  <button
                    onClick={() => handleAction('approve')}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    ) : (
                      <CheckCircle size={12} />
                    )}
                    Approve
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
                  Customer
                </label>
                <p className="text-xs text-gray-900">
                  {journal.customers?.full_name || "Unknown"}
                  {journal.customers?.account_number && (
                    <span className="text-gray-500 ml-2">(#{journal.customers.account_number})</span>
                  )}
                </p>
              </div>
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

            {/* Reference Number */}
            {journal.reference_number && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Reference Number
                </label>
                <p className="text-xs text-gray-900 font-medium">
                  {journal.reference_number}
                </p>
              </div>
            )}

            {/* Created By */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Created By
              </label>
              <p className="text-xs text-gray-900">
                {journal.profiles?.full_name || "N/A"}
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
                    {journal.approvers?.full_name || "N/A"}
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
                    {journal.rejectors?.full_name || "N/A"}
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

            {/* Journal Entry Details (if posted) */}
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
                                  <div className="text-gray-500 text-xs">{line.account?.account_code}</div>
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

        {/* Footer with Back Button */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <button
            onClick={() => navigate("/journals")}
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