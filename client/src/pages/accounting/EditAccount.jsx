import { supabase } from "../../supabaseClient";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, X } from "lucide-react";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";
import { useState, useEffect } from "react";
import CustomSelect from "../../components/CustomSelect";
import { SkeletonForm } from "../../components/Skeleton";

export default function EditAccount() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { success, error: toastError, warning } = useToast();
  const [form, setForm] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAccount = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", profile.tenant_id)
        .single();

      if (error) throw error;
      setForm(data);
    } catch (err) {
      console.error("Error loading account:", err);
      toastError("Failed to load account details.");
    }
  };

  useEffect(() => {
    if (profile?.tenant_id) {
      loadAccount();
    }
  }, [id, profile?.tenant_id]);

  const saveChanges = async (e) => {
    e.preventDefault();

    // Code is now optional, deleted parent_id logic
    if (!form.account_name || !form.account_type || !form.account_category) {
      warning("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("chart_of_accounts")
        .update({
          account_name: form.account_name,
          account_type: form.account_type,
          account_category: form.account_category,
          code: form.code, // Optional
          status: form.status
        })
        .eq("id", id)
        .eq("tenant_id", profile?.tenant_id);

      if (error) throw error;

      success("Account updated successfully!");
      navigate("/accounting/chart-of-accounts");
    } catch (err) {
      console.error("Error updating account:", err);
      toastError(err.message || "Failed to update account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!form) {
    return (
      <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
        <div className="max-w-3xl"><SkeletonForm fields={4} /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
      <h1 className="text-xs text-muted mb-4 font-medium">
        Accounting / Chart of Accounts / Edit Account
      </h1>

      <div className="bg-card rounded-xl shadow-card border border-border max-w-3xl">
        <div className="p-6">
          <h2 className="text-sm font-semibold text-heading mb-6 font-heading">
            Edit Account
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
                  value={form.account_name || ""}
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
                  value={form.account_type || ""}
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
                  value={form.account_category || ""}
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
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Account Code <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-colors"
                  placeholder="Enter code"
                  type="text"
                  value={form.code || ""}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-xs text-body font-outfit mb-1.5 block">
                  Status
                </label>
                <CustomSelect
                  value={form.status || "Active"}
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
        <div className="border-t border-border-light px-6 py-4 flex justify-between items-center bg-surface rounded-b-lg font-outfit">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-medium text-body border border-border hover:bg-surface transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-medium text-body border border-border hover:bg-surface transition-colors"
            >
              <X size={16} /> Cancel
            </button>
            <button
              onClick={saveChanges}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-medium text-white bg-brand-primary hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Save size={16} /> {isSubmitting ? "Saving..." : "Update Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}