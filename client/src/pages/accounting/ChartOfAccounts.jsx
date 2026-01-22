import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2 } from "lucide-react";

const TABS = ["Asset", "Liability", "Equity", "Income", "Expense"];

export default function ChartOfAccounts() {
  const [activeTab, setActiveTab] = useState("Asset");
  const [accounts, setAccounts] = useState([]);
  const navigate = useNavigate();

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("account_type", activeTab.toUpperCase());

    if (!error) setAccounts(data);
  };

  useEffect(() => {
    fetchAccounts();
  }, [activeTab]);

  const deleteAccount = async (id) => {
    if (!window.confirm("Are you sure you want to delete this account?")) return;

    await supabase.from("chart_of_accounts").delete().eq("id", id);
    fetchAccounts();
  };

  return (
    <div className="p-6 bg-brand-surface min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Accounting / Chart of Accounts
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-800">
            Chart of Accounts
          </h2>
          <button
            onClick={() => navigate("/chart-of-accounts/new")}
            className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-white transition-colors"
            style={{ backgroundColor: "#586ab1" }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#4a5a9d"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#586ab1"}
          >
            <Plus size={14} /> New Account
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-4 border-b border-gray-200">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === t
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
                    {acc.code}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: "#586ab1" }}
                    >
                      {acc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/chart-of-accounts/${acc.id}`)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
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
    </div>
  );
}