import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  EyeIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XMarkIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import SkeletonPage from "../../components/Skeleton";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";
import { apiFetch } from "../../utils/api";
import { usePermissions } from "../../hooks/usePermissions";
import { Pagination } from "../../components/Pagination.jsx";
import Modal from "../../components/Modal";
import CustomSelect from "../../components/CustomSelect";

export default function Journals() {
  const [journals, setJournals] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Filter States
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

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
  const { hasPermission } = usePermissions();

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "posted", label: "Posted" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  // Dynamic list of unique journal types loaded from journals
  const typeOptions = [
    { value: "all", label: "All Types" },
    ...Array.from(new Set(journals.map((j) => j.journal_type).filter(Boolean))).map((t) => ({
      value: t.toLowerCase(),
      label: t,
    })),
  ];

  const fetchJournals = async () => {
    try {
      const response = await apiFetch(`/api/journals`, {
        method: "GET",
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
    if (modalAction === "reject" && !actionReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    setActionLoading(true);
    const endpoint = modalAction === "approve" ? "approve" : "reject";
    const body = {
      tenant_id: profile?.tenant_id,
      reason: actionReason,
    };

    try {
      const response = await apiFetch(`/api/journals/${selectedJournalId}/${endpoint}`, {
        method: "POST",
        body: JSON.stringify(body),
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
      case "pending":
        return "bg-warning-fill text-warning-text border border-warning-text/10";
      case "posted":
      case "approved":
        return "bg-success-fill text-success-text border border-success-text/10";
      case "rejected":
        return "bg-danger-fill text-danger-text border border-danger-text/10";
      default:
        return "bg-surface text-muted border border-border-light";
    }
  };

  const filteredJournals = journals.filter((j) => {
    const matchesSearch =
      j.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      j.description?.toLowerCase().includes(search.toLowerCase()) ||
      j.journal_type?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || j.status?.toLowerCase() === statusFilter;
    const matchesType = typeFilter === "all" || j.journal_type?.toLowerCase() === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredJournals.length / itemsPerPage);
  const paginatedJournals = filteredJournals.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, typeFilter]);

  if (loading) {
    return <SkeletonPage />;
  }

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
      <div className="w-full space-y-6">
        {/* Header / Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-heading tracking-tight">Journals Summary</h1>
            <p className="text-muted text-xs mt-0.5">
              Manage and audit double-entry accounting journals
            </p>
          </div>
        </div>

        {/* Toolbar & Filter Card */}
        <div className="bg-card rounded-xl border border-border shadow-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {hasPermission("journal.create") && (
              <button
                className="inline-flex items-center gap-1.5 bg-brand-primary text-white px-3.5 py-2 rounded-lg hover:bg-brand-primary/90 transition-all shadow-btn text-xs active:scale-95 font-medium"
                onClick={() => navigate("/journals/new")}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                New Entry
              </button>
            )}
            <button
              className="inline-flex items-center gap-1.5 bg-surface border border-border text-body px-3.5 py-2 rounded-lg hover:border-brand-primary/40 hover:text-brand-primary transition-colors text-xs font-medium"
              onClick={() => navigate("/accounting/gl-entries")}
            >
              <DocumentTextIcon className="w-3.5 h-3.5" />
              General Journal
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Status Filter */}
            <div className="w-full sm:w-40">
              <CustomSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusOptions}
                compact
              />
            </div>

            {/* Type Filter */}
            <div className="w-full sm:w-44">
              <CustomSelect
                value={typeFilter}
                onChange={setTypeFilter}
                options={typeOptions}
                compact
              />
            </div>

            {/* Search Bar */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-card focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 hover:border-muted transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface border-b border-border-light text-muted text-[10px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Journal Type</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5">Created By</th>
                  <th className="px-5 py-3.5 text-center">Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border-light">
                {paginatedJournals.map((j) => (
                  <tr key={j.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-xs font-semibold text-heading uppercase tracking-wider">
                        {j.journal_type}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-xs text-body font-medium">{j.customer_name || "—"}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-xs font-semibold text-heading">
                        {parseFloat(j.amount).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs truncate">
                      <span className="text-xs text-muted" title={j.description}>
                        {j.description}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase ${getStatusColor(
                          j.status
                        )}`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted">{j.created_by_name}</td>
                    <td className="px-5 py-3.5 text-xs text-muted text-center">
                      {new Date(j.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          className="p-1.5 text-muted hover:text-brand-primary hover:bg-success-fill rounded-lg transition-colors"
                          onClick={() => navigate(`/journals/${j.id}`)}
                          title="View Details"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>

                        {j.status === "pending" && hasPermission("journal.approve") && (
                          <button
                            className="p-1.5 text-muted hover:text-brand-primary hover:bg-success-fill rounded-lg transition-colors"
                            onClick={() => navigate(`/journals/${j.id}`)}
                            title="Review & Approve"
                          >
                            <CheckCircleIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredJournals.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-5 py-12 text-center text-xs text-muted">
                      {journals.length === 0 ? "No journals found" : "No matching journals"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            totalItems={filteredJournals.length}
            itemsPerPage={itemsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* Approve/Reject Modal Action */}
      <Modal
        open={isModalOpen}
        title={modalAction === "approve" ? "Approve Journal Entry" : "Reject Journal Entry"}
        onClose={closeActionModal}
        onSave={handleSubmitAction}
        saving={actionLoading}
        saveLabel={modalAction === "approve" ? "Confirm Approval" : "Confirm Rejection"}
      >
        <div className="space-y-4">
          <p className="text-xs text-muted leading-relaxed">
            {modalAction === "approve"
              ? "Are you sure you want to approve this journal? This will post the transaction to the ledger and update wallet balances."
              : "Please provide a reason for rejecting this journal entry."}
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-heading">
              {modalAction === "approve" ? "Approval Note (Optional)" : "Rejection Reason (Required)"}
            </label>
            <textarea
              className="block w-full rounded-lg border bg-card text-xs py-2 px-3 transition-all outline-none placeholder:text-muted border-border hover:border-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
              rows={4}
              placeholder={
                modalAction === "approve" ? "Enter any notes..." : "Enter reason for rejection..."
              }
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}