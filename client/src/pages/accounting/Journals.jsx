import React, { useEffect, useState } from "react";
import { Eye, Plus, Search, CheckCircle, XCircle, MoreVertical, X, FileSpreadsheet, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Spinner from "../../components/Spinner";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";
import { API_BASE_URL } from "../../../config.js";

function Journals() {
  const [journals, setJournals] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false); // Valid: boolean or ID string if needed, but here boolean is enough for modal

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(30);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState(null); // 'approve' | 'reject'
  const [selectedJournalId, setSelectedJournalId] = useState(null);
  const [actionReason, setActionReason] = useState("");

  const navigate = useNavigate();
  const { profile } = useAuth();
  const toast = useToast();

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

  const openActionModal = (action, journalId) => {
    setModalAction(action);
    setSelectedJournalId(journalId);
    setActionReason("");
    setIsModalOpen(true);
  };

  const closeActionModal = () => {
    setIsModalOpen(false);
    setModalAction(null);
    setSelectedJournalId(null);
    setActionReason("");
  };

  const handleSubmitAction = async () => {
    if (modalAction === 'reject' && !actionReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    setActionLoading(true);
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      const endpoint = modalAction === 'approve' ? 'approve' : 'reject';

      const body = {
        tenant_id: profile?.tenant_id
      };

      if (modalAction === 'approve') {
        body.approval_note = actionReason;
      } else {
        body.rejection_reason = actionReason;
      }

      const response = await fetch(`${API_BASE_URL}/api/journals/${selectedJournalId}/${endpoint}`, {
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
        fetchJournals();
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
    j.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    j.description?.toLowerCase().includes(search.toLowerCase()) ||
    j.journal_type?.toLowerCase().includes(search.toLowerCase())
  );

  // Pagination Logic
  const totalPages = Math.ceil(filteredJournals.length / itemsPerPage);
  const paginatedJournals = filteredJournals.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const generatePageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      pages.push(1);
      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  if (loading) {
    return (

      <div className="p-6 bg-brand-surface min-h-screen flex items-center justify-center">
        <Spinner text="Loading journals..." />
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
            className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-white transition-colors bg-brand-btn hover:bg-brand-primary"
            onClick={() => navigate("/journals/new")}
          >
            <Plus size={14} /> New Entry
          </button>
          <button
            className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-brand-primary border border-brand-primary hover:bg-brand-secondary/10 transition-colors ml-2"
            onClick={() => navigate("/accounting/gl-entries")}
          >
            <FileSpreadsheet size={14} /> General Journal
          </button>

          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by customer, description, or type..."
              className="border border-gray-300 rounded-md pl-8 pr-3 py-1.5 w-64 text-xs focus:outline-none focus:ring-1 focus:ring-brand-btn focus:border-transparent"
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
              <tr className="bg-brand-surface border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Journal Type
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Customer
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Amount
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Description
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Created By
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Date
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedJournals.map((j) => (
                <tr
                  key={j.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm  text-gray-700 whitespace-nowrap">
                    {j.journal_type}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-700 whitespace-nowrap">
                    {j.customer_name || "Unknown"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right font-medium whitespace-nowrap">
                    {parseFloat(j.amount).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs ">
                    {j.description}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(j.status)}`}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {j.created_by_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-center whitespace-nowrap">
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
                            className="inline-flex items-center justify-center p-1 rounded hover:bg-blue-100 transition-colors"
                            onClick={() => openActionModal('approve', j.id)}
                            aria-label="Approve journal"
                            title="Approve"
                          >
                            <CheckCircle className="text-blue-600 hover:text-blue-800" size={16} />
                          </button>

                          <button
                            className="inline-flex items-center justify-center p-1 rounded hover:bg-red-100 transition-colors"
                            onClick={() => openActionModal('reject', j.id)}
                            aria-label="Reject journal"
                            title="Reject"
                          >
                            <XCircle className="text-red-600 hover:text-red-800" size={16} />
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

        {/* Pagination Controls */}
        {filteredJournals.length > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-2 sm:mb-0">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredJournals.length)}</span> of <span className="font-medium">{filteredJournals.length}</span> entries
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-600"
                title="First Page"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-600"
                title="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1 mx-2">
                {generatePageNumbers().map((page, i) => (
                  <button
                    key={i}
                    onClick={() => typeof page === 'number' && setCurrentPage(page)}
                    disabled={page === '...'}
                    className={`min-w-[28px] h-7 flex items-center justify-center rounded text-xs font-medium transition-colors ${currentPage === page
                      ? 'bg-blue-600 text-white'
                      : page === '...'
                        ? 'text-gray-400 cursor-default'
                        : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-600"
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-600"
                title="Last Page"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
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

export default Journals;