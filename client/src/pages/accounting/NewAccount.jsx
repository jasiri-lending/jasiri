
import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, X } from "lucide-react";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";
import { getNextCode } from "../../utils/accountingUtils";

export default function NewAccount() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { success, error: toastError, warning } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    account_name: "",
    account_type: "",
    account_category: "",
    code: "",
    status: "Active",
  });

  // Auto-generate code when account_type changes
  useEffect(() => {
    const fetchCode = async () => {
      if (form.account_type && profile?.tenant_id) {
        const nextCode = await getNextCode(form.account_type, profile.tenant_id);
        if (nextCode) {
          setForm(prev => ({ ...prev, code: nextCode }));
        }
      }
    };

    fetchCode();
  }, [form.account_type, profile?.tenant_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.account_name || !form.account_type || !form.account_category) {
      warning("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("chart_of_accounts").insert([{
        ...form,
        tenant_id: profile?.tenant_id
      }]);

      if (error) throw error;

      success("Account created successfully!");
      navigate("/accounting/chart-of-accounts");
    } catch (err) {
      console.error("Error creating account:", err);
      toastError(err.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-brand-surface min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium font-body">
        Accounting / Chart of Accounts / New Account
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 max-w-3xl font-body">
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-6 font-heading">
            Create New Account
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Account Name */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Account Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-colors"
                  placeholder="Enter account name"
                  value={form.account_name}
                  onChange={(e) =>
                    setForm({ ...form, account_name: e.target.value })
                  }
                />
              </div>

              {/* Account Type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Account Type <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-colors"
                  value={form.account_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      account_type: e.target.value,
                    })
                  }
                >
                  <option value="">Select Type</option>
                  <option value="ASSET">Asset</option>
                  <option value="LIABILITY">Liability</option>
                  <option value="EQUITY">Equity</option>
                  <option value="INCOME">Income</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </div>

              {/* Account Category */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Account Category <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-colors"
                  value={form.account_category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      account_category: e.target.value,
                    })
                  }
                >
                  <option value="">Select Category</option>
                  <option value="Header Account">Header Account</option>
                  <option value="Detail Account">Detail Account</option>
                </select>
              </div>

              {/* Code */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Account Code <span className="text-gray-400 font-normal">(Auto-generated)</span>
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-colors bg-gray-50"
                  placeholder="Auto-generated"
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Status
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-colors"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER WITH BUTTONS */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-between items-center bg-gray-50 rounded-b-lg">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-100 transition-colors"
            >
              <X size={16} /> Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-medium text-white bg-brand-primary hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-900/10"
            >
              <Save size={16} /> {isSubmitting ? "Saving..." : "Save Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}