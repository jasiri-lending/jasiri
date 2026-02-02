import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, X } from "lucide-react";
import { useAuth } from "../../hooks/userAuth";

export default function NewAccount() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [headerAccounts, setHeaderAccounts] = useState([]);

  const [form, setForm] = useState({
    account_name: "",
    account_type: "",
    account_category: "",
    parent_id: null,
    code: "",
    status: "Active",
  });

  // Load header accounts when account_type changes
  useEffect(() => {
    const loadHeaderAccounts = async () => {
      if (!form.account_type) return;

      const { data } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("account_type", form.account_type)
        .eq("account_category", "Header Account")
        .eq("tenant_id", profile?.tenant_id);

      setHeaderAccounts(data || []);
    };

    loadHeaderAccounts();
  }, [form.account_type]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.account_name || !form.account_type || !form.account_category || !form.code) {
      alert("Please fill in all required fields.");
      return;
    }

    const { error } = await supabase.from("chart_of_accounts").insert([{
      ...form,
      tenant_id: profile?.tenant_id
    }]);

    if (error) {
      alert("Failed to create account.");
      console.log(error);
    } else {
      alert("Account created successfully!");
      navigate("/chart-of-accounts");
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Accounting / Chart of Accounts / New Account
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 max-w-3xl">
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-6">
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
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#586ab1] focus:border-transparent"
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
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#586ab1] focus:border-transparent"
                  value={form.account_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      account_type: e.target.value,
                      parent_id: null,
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
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#586ab1] focus:border-transparent"
                  value={form.account_category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      account_category: e.target.value,
                      parent_id: null,
                    })
                  }
                >
                  <option value="">Select Category</option>
                  <option value="Header Account">Header Account</option>
                  <option value="Detail Account">Detail Account</option>
                </select>
              </div>

              {/* Parent Account (only for Detail Accounts) */}
              {form.account_category === "Detail Account" && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Parent Account (Header)
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#586ab1] focus:border-transparent"
                    value={form.parent_id || ""}
                    onChange={(e) =>
                      setForm({ ...form, parent_id: Number(e.target.value) || null })
                    }
                  >
                    <option value="">Select Parent (Optional)</option>
                    {headerAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.account_name}
                      </option>
                    ))}
                  </select>
                  {headerAccounts.length === 0 && form.account_type && (
                    <p className="text-xs text-gray-500 mt-1">
                      No header accounts available for this type. Create a header account first.
                    </p>
                  )}
                </div>
              )}

              {/* Code */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Account Code <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#586ab1] focus:border-transparent"
                  placeholder="Enter code"
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
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#586ab1] focus:border-transparent"
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
        <div className="border-t border-gray-200 px-6 py-4 flex justify-between items-center bg-gray-50">
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => navigate(-1)}
              className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-100 transition-colors"
            >
              <X size={14} /> Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-white transition-colors"
              style={{ backgroundColor: "#586ab1" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#4a5a9d"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#586ab1"}
            >
              <Save size={14} /> Save Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}