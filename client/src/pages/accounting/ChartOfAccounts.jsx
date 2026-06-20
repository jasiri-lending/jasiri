import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";
import { apiFetch } from "../../utils/api";
import { Pagination } from "../../components/Pagination.jsx";
import CustomSelect from '../../components/CustomSelect';
import Modal from '../../components/Modal';
import { SkeletonTable } from '../../components/Skeleton';

const TABS = ["Asset", "Liability", "Equity", "Income", "Expense"];

export default function ChartOfAccounts() {
  const [activeTab, setActiveTab] = useState("Asset");
  const [accounts, setAccounts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [editingAccount, setEditingAccount] = useState(null); // Account being edited
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { success, error: toastError, warning } = useToast();

  const fetchAccounts = async () => {
    if (!profile?.tenant_id) return;
    try {
      setLoading(true);
      const response = await apiFetch(`/api/chart-of-accounts?account_type=${activeTab}`);
      const data = await response.json();
      if (data.success) {
        setAccounts(data.accounts || []);
      } else {
        console.error("Error fetching accounts:", data.error);
        toastError(data.error || "Failed to fetch accounts.");
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toastError("Failed to fetch accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [activeTab]);

  const deleteAccount = async (id) => {
    if (!window.confirm("Are you sure you want to delete this account?")) return;

    try {
      const response = await apiFetch(`/api/chart-of-accounts/${id}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.success) {
        success("Account deleted successfully.");
        fetchAccounts();
      } else {
        toastError(data.error || "Failed to delete account.");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      toastError("Failed to delete account.");
    }
  };

  const openEditModal = (account) => {
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const closeEditModal = () => {
    setEditingAccount(null);
    setIsModalOpen(false);
  };

  const handleUpdate = async (updatedData) => {
    try {
      const response = await apiFetch(`/api/chart-of-accounts`, {
        method: "POST",
        body: JSON.stringify({ ...updatedData, id: editingAccount.id })
      });
      const data = await response.json();

      if (data.success) {
        success("Account updated successfully!");
        fetchAccounts();
        closeEditModal();
      } else {
        toastError(data.error || "Failed to update account.");
      }
    } catch (err) {
      console.error("Error updating account:", err);
      toastError(err.message || "Failed to update account.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
        <SkeletonTable rows={5} cols={6} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
      <h1 className="text-xs text-slate-500 mb-4 font-medium font-outfit">
        Accounting / Chart of Accounts 
      </h1>

      <div className="bg-card rounded-xl shadow-card border border-border">
        <div className="p-4 border-b border-border-light flex justify-between items-center bg-surface">
          <h2 className="text-xs font-semibold text-heading font-outfit">
            Chart of Accounts 
          </h2>
          <button
            onClick={() => navigate("/chart-of-accounts/new")}
            className="px-2 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-white transition-colors shadow-sm bg-brand-primary hover:bg-brand-primary/90"
          >
            <Plus size={14} /> New Account
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-4 border-b border-border-light">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === t
                  ? "text-heading"
                  : "text-muted hover:text-heading"
                  }`}
              >
                {t}
                {activeTab === t && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary rounded-full"
                    
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto font-outfit">
          <table className="min-w-full divide-y divide-border-light">
            <thead className="bg-surface">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap text-muted">
                  Account Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap text-muted">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap text-muted">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap text-muted">
                  Code
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium whitespace-nowrap text-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium whitespace-nowrap text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {accounts.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage).map((acc) => (
                <tr
                  key={acc.id}
                  className="hover:bg-surface transition-colors"
                >
                  <td className="px-4 py-3 text-xs font-outfit text-body">
                    {acc.account_name}
                  </td>
                  <td className="px-4 py-3 text-xs font-outfit text-body">
                    {acc.acc_type || acc.account_type}
                  </td>
                  <td className="px-4 py-3 text-xs font-outfit text-body">
                    {acc.account_category}
                  </td>
                  <td className="px-4 py-3 text-xs font-outfit text-body">
                    {acc.code || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${acc.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                        }`}
                    >
                      {acc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(acc)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-brand-primary hover:bg-brand-surface transition-colors"
                        aria-label="Edit account"
                      >
                        <Edit2 size={12} />
                        Edit
                      </button>
                      <button
                        onClick={() => deleteAccount(acc.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                        aria-label="Delete account"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td className="p-8 text-center text-xs text-muted" colSpan={6}>
                    No {activeTab.toLowerCase()} accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        <Pagination totalItems={accounts.length} itemsPerPage={itemsPerPage} currentPage={currentPage} onPageChange={setCurrentPage} />
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={closeEditModal}
          onSave={handleUpdate}
          warning={warning}
        />
      )}
    </div>
  );
}

// Modal Component
function EditAccountModal({ account, onClose, onSave, warning }) {
  const [form, setForm] = useState({
    account_name: account.account_name,
    account_type: account.account_type,
    account_category: account.account_category,
    code: account.code || "",
    status: account.status || "Active"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.account_name || !form.account_type || !form.account_category) {
      warning("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    await onSave(form);
    setIsSubmitting(false);
  };

  return (
    <Modal open={true} title="Edit Account" onClose={onClose} onSave={handleSubmit} saving={isSubmitting} saveLabel="Save Changes">
      <div className="space-y-4 font-outfit">
        <div>
          <label className="text-xs text-body mb-1 block">Account Name <span className="text-red-500">*</span></label>
          <input
            className="w-full border border-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none bg-card"
            value={form.account_name}
            onChange={e => setForm({ ...form, account_name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-body mb-1 block">Type <span className="text-red-500">*</span></label>
            <CustomSelect
              value={form.account_type}
              onChange={val => setForm({ ...form, account_type: val })}
              options={[
                { value: "ASSET", label: "Asset" },
                { value: "LIABILITY", label: "Liability" },
                { value: "EQUITY", label: "Equity" },
                { value: "INCOME", label: "Income" },
                { value: "EXPENSE", label: "Expense" }
              ]}
              compact
              fullWidth
            />
          </div>
          <div>
            <label className="text-xs text-body mb-1 block">Category <span className="text-red-500">*</span></label>
            <CustomSelect
              value={form.account_category}
              onChange={val => setForm({ ...form, account_category: val })}
              options={[
                { value: "Header Account", label: "Header Account" },
                { value: "Detail Account", label: "Detail Account" }
              ]}
              compact
              fullWidth
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-body mb-1 block">
            Code <span className="text-muted font-normal">(Optional)</span>
          </label>
          <input
            className="w-full border border-border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none bg-card"
            value={form.code}
            onChange={e => setForm({ ...form, code: e.target.value })}
          />
        </div>

        <div>
          <label className="text-xs text-body mb-1 block">Status</label>
          <CustomSelect
            value={form.status}
            onChange={val => setForm({ ...form, status: val })}
            options={[
              { value: "Active", label: "Active" },
              { value: "Inactive", label: "Inactive" }
            ]}
            compact
            fullWidth
          />
        </div>
      </div>
    </Modal>
  );
}