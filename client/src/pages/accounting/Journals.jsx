import React, { useEffect, useState } from "react";
import { Eye, Plus, Search, CheckCircle, XCircle, Send, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/userAuth";
import { API_BASE_URL } from "../../../config.js";

function Journals() {
  const [journals, setJournals] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const navigate = useNavigate();
  const { profile } = useAuth();

  const fetchJournals = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        console.error("No session token found");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/journals?tenant_id=${profile?.tenant_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setJournals(data.journals || []);
      } else {
        console.error("Failed to fetch journals:", data.error);
      }
    } catch (error) {
      console.error("Error fetching journals:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchJournals();
    }
  }, [profile?.tenant_id]);

  const handlePostJournal = async (journalId) => {
    if (!window.confirm("Are you sure you want to post this journal? This will create accounting entries.")) {
      return;
    }

    setActionLoading(journalId);
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const response = await fetch(`${API_BASE_URL}/api/journals/${journalId}/post`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenant_id: profile?.tenant_id,
          posted_by: profile?.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        fetchJournals(); // Refresh the list
      } else {
        alert(`Failed to post journal: ${data.error}`);
      }
    } catch (error) {
      console.error("Error posting journal:", error);
      alert("Failed to post journal");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveJournal = async (journalId) => {
    const approvalNote = prompt("Enter approval note (optional):");
    
    setActionLoading(`approve-${journalId}`);
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const response = await fetch(`${API_BASE_URL}/api/journals/${journalId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenant_id: profile?.tenant_id,
          approval_note: approvalNote
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        fetchJournals();
      } else {
        alert(`Failed to approve journal: ${data.error}`);
      }
    } catch (error) {
      console.error("Error approving journal:", error);
      alert("Failed to approve journal");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectJournal = async (journalId) => {
    const rejectionReason = prompt("Enter rejection reason:");
    if (!rejectionReason) {
      alert("Rejection reason is required");
      return;
    }
    
    setActionLoading(`reject-${journalId}`);
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const response = await fetch(`${API_BASE_URL}/api/journals/${journalId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenant_id: profile?.tenant_id,
          rejection_reason: rejectionReason
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        fetchJournals();
      } else {
        alert(`Failed to reject journal: ${data.error}`);
      }
    } catch (error) {
      console.error("Error rejecting journal:", error);
      alert("Failed to reject journal");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'posted':
        return 'bg-green-100 text-green-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredJournals = journals.filter((j) =>
    j.customers?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    j.description?.toLowerCase().includes(search.toLowerCase()) ||
    j.journal_type?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 bg-brand-surface min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#586ab1] mx-auto"></div>
          <p className="text-xs text-gray-500 mt-2">Loading journals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-brand-surface min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Journals / Journals Summary
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          {/* NEW ENTRY BUTTON */}
          <button
            className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-white transition-colors"
            style={{ backgroundColor: "#586ab1" }}
            onClick={() => navigate("/journals/new")}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#4a5a9d"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#586ab1"}
          >
            <Plus size={14} /> New Entry
          </button>

          <div className="relative">
            <Search 
              size={14} 
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by customer, description, or type..."
              className="border border-gray-300 rounded-md pl-8 pr-3 py-1.5 w-64 text-xs focus:outline-none focus:ring-1 focus:border-transparent"
              style={{ focusRingColor: "#586ab1" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                  Type
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                  Customer
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">
                  Amount
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                  Description
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                  Created By
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">
                  Date
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredJournals.map((j) => (
                <tr 
                  key={j.id} 
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {j.journal_type}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-900">
                    {j.customers?.full_name || "Unknown"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 text-right font-medium">
                    {parseFloat(j.amount).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">
                    {j.description}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span 
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(j.status)}`}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {j.profiles?.full_name}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 text-center">
                    {new Date(j.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        className="inline-flex items-center justify-center p-1 rounded hover:bg-gray-100 transition-colors"
                        onClick={() => navigate(`/journals/${j.id}`)}
                        aria-label="View journal"
                        title="View Details"
                      >
                        <Eye className="text-gray-600 hover:text-gray-900" size={16} />
                      </button>
                      
                      {j.status === 'pending' && (
                        <>
                          <button
                            className={`inline-flex items-center justify-center p-1 rounded hover:bg-green-100 transition-colors ${actionLoading === j.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => handlePostJournal(j.id)}
                            disabled={actionLoading === j.id}
                            aria-label="Post journal"
                            title="Post to Accounting"
                          >
                            {actionLoading === j.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#586ab1]"></div>
                            ) : (
                              <Send className="text-green-600 hover:text-green-800" size={16} />
                            )}
                          </button>
                          
                          <button
                            className={`inline-flex items-center justify-center p-1 rounded hover:bg-blue-100 transition-colors ${actionLoading === `approve-${j.id}` ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => handleApproveJournal(j.id)}
                            disabled={actionLoading === `approve-${j.id}`}
                            aria-label="Approve journal"
                            title="Approve"
                          >
                            {actionLoading === `approve-${j.id}` ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#586ab1]"></div>
                            ) : (
                              <CheckCircle className="text-blue-600 hover:text-blue-800" size={16} />
                            )}
                          </button>
                          
                          <button
                            className={`inline-flex items-center justify-center p-1 rounded hover:bg-red-100 transition-colors ${actionLoading === `reject-${j.id}` ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => handleRejectJournal(j.id)}
                            disabled={actionLoading === `reject-${j.id}`}
                            aria-label="Reject journal"
                            title="Reject"
                          >
                            {actionLoading === `reject-${j.id}` ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#586ab1]"></div>
                            ) : (
                              <XCircle className="text-red-600 hover:text-red-800" size={16} />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredJournals.length === 0 && (
          <div className="p-8 text-center text-xs text-gray-500">
            {journals.length === 0 ? "No journals found" : "No matching journals"}
          </div>
        )}
      </div>
    </div>
  );
}

export default Journals;