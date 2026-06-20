
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, X } from "lucide-react";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";
import { getNextCode } from "../../utils/accountingUtils";
import { apiFetch } from "../../utils/api";
import CustomSelect from "../../components/CustomSelect";

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
      const response = await apiFetch(`/api/chart-of-accounts`, {
        method: "POST",
        body: JSON.stringify(form)
      });
      const data = await response.json();

      if (data.success) {
        success("Account created successfully!");
        navigate("/accounting/chart-of-accounts");
      } else {
        throw new Error(data.error || "Failed to create account.");
      }
    } catch (err) {
      console.error("Error creating account:", err);
      toastError(err.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
      <h1 className="text-xs text-muted mb-4 font-medium font-outfit">
        Accounting / Chart of Accounts / New Account
      </h1>

      <div className="bg-card rounded-xl shadow-card border border-border max-w-3xl font-outfit">
        <div className="p-6">
          <h2 className="text-xs font-semibold text-heading mb-6 font-outfit">
            Create New Account
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Account Name */}
              <div className="col-span-2">
                <label className=" text-xs  text-gray-600 font-outfit mb-1.5">
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
                <label className="text-xs text-body font-outfit mb-1.5 block">
                  Account Type <span className="text-red-500">*</span>
                </label>
                <CustomSelect
                  value={form.account_type}
                  onChange={(val) => setForm({ ...form, account_type: val })}
                  options={[
                    { value: "ASSET", label: "Asset" },
                    { value: "LIABILITY", label: "Liability" },
                    { value: "EQUITY", label: "Equity" },
                    { value: "INCOME", label: "Income" },
                    { value: "EXPENSE", label: "Expense" },
                  ]}
                  placeholder="Select Type"
                  fullWidth
                  compact
                />
              </div>

              {/* Account Category */}
              <div>
                <label className="text-xs text-body font-outfit mb-1.5 block">
                  Account Category <span className="text-red-500">*</span>
                </label>
                <CustomSelect
                  value={form.account_category}
                  onChange={(val) => setForm({ ...form, account_category: val })}
                  options={[
                    { value: "Header Account", label: "Header Account" },
                    { value: "Detail Account", label: "Detail Account" },
                  ]}
                  placeholder="Select Category"
                  fullWidth
                  compact
                />
              </div>

              {/* Code */}
              <div>
                <label className="text-xs  text-gray-600 font-outfit mb-1.5">
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
                <label className="text-xs text-body font-outfit mb-1.5 block">
                  Status
                </label>
                <CustomSelect
                  value={form.status}
                  onChange={(val) => setForm({ ...form, status: val })}
                  options={[
                    { value: "Active", label: "Active" },
                    { value: "Inactive", label: "Inactive" },
                  ]}
                  fullWidth
                  compact
                />
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER WITH BUTTONS */}
        <div className="border-t border-border-light px-6 py-4 flex justify-between items-center bg-surface rounded-b-lg">
          <button
            onClick={() => navigate(-1)}
            className="px-2 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium text-body border border-border hover:bg-surface transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-2 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium text-body border border-border hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-2 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium text-white bg-brand-primary hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSubmitting ? "Saving..." : "Save Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}