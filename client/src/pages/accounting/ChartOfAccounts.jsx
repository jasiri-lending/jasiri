import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import { useToast } from "../../components/Toast";

const TABS = ["Asset", "Liability", "Equity", "Income", "Expense"];

export default function ChartOfAccounts() {
  const [activeTab, setActiveTab] = useState("Asset");
  const [accounts, setAccounts] = useState([]);
  const [editingAccount, setEditingAccount] = useState(null); // Account being edited
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const { success, error: toastError, warning } = useToast();

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .ilike("account_type", activeTab)
      .order("created_at", { ascending: false });

    if (!error) setAccounts(data);
    else console.error("Error fetching accounts:", error);
  };

  useEffect(() => {
    fetchAccounts();
  }, [activeTab]);

  const deleteAccount = async (id) => {
    if (!window.confirm("Are you sure you want to delete this account?")) return;

    const { error } = await supabase.from("chart_of_accounts").delete().eq("id", id);

    if (error) {
      toastError("Failed to delete account.");
    } else {
      success("Account deleted successfully.");
      fetchAccounts();
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
      const { error } = await supabase
        .from("chart_of_accounts")
        .update(updatedData)
        .eq("id", editingAccount.id);

      if (error) throw error;

      success("Account updated successfully!");
      fetchAccounts();
      closeEditModal();
    } catch (err) {
      console.error("Error updating account:", err);
      toastError(err.message || "Failed to update account.");
    }
  };

  return (
    <div className="p-6 bg-brand-surface min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium font-body">
        Accounting / Chart of Accounts
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-800 font-heading">
            Chart of Accounts
          </h2>
          <button
            onClick={() => navigate("/chart-of-accounts/new")}
            className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-white transition-colors shadow-sm"
            style={{ backgroundColor: "#586ab1" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#4a5a9d"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#586ab1"}
          >
            <Plus size={14} /> New Account
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-4 border-b border-gray-200">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === t
                  ? "text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                {t}
                {activeTab === t && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: "#586ab1" }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                  Account Name
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                  Type
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                  Category
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                  Code
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">
                  Status
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr
                  key={acc.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-xs font-medium text-gray-900">
                    {acc.account_name}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {acc.account_type}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {acc.account_category}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 font-medium">
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
                  <td className="p-8 text-center text-xs text-gray-500" colSpan={6}>
                    No {activeTab.toLowerCase()} accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.account_name || !form.account_type || !form.account_category) {
      warning("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    await onSave(form);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800 font-heading">Edit Account</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Account Name <span className="text-red-500">*</span></label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
              value={form.account_name}
              onChange={e => setForm({ ...form, account_name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                value={form.account_type}
                onChange={e => setForm({ ...form, account_type: e.target.value })}
              >
                <option value="ASSET">Asset</option>
                <option value="LIABILITY">Liability</option>
                <option value="EQUITY">Equity</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
                value={form.account_category}
                onChange={e => setForm({ ...form, account_category: e.target.value })}
              >
                <option value="Header Account">Header Account</option>
                <option value="Detail Account">Detail Account</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Code <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-3 py-2 rounded-lg text-xs font-medium text-white bg-brand-primary hover:bg-blue-800 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Save size={14} />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}