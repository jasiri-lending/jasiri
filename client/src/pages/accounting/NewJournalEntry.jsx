import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, X } from "lucide-react";
import { useAuth } from "../../hooks/userAuth";

function NewJournalEntry() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [glAccounts, setGLAccounts] = useState([]);

  const [journalType, setJournalType] = useState("Credit Customer Account");
  const [accountType, setAccountType] = useState("Customer Account");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [description, setDescription] = useState("");
  const { profile } = useAuth();

  useEffect(() => {
    fetchCustomers();
    fetchGLAccounts();
  }, []);

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from("customers")
      .select("id, full_name, account_number")
      .eq("tenant_id", profile?.tenant_id)
      .order("full_name");
    if (data) setCustomers(data);
  };

  const fetchGLAccounts = async () => {
    const { data } = await supabase
      .from("gl_accounts")
      .select("id, account_code, account_name")
      .eq("tenant_id", profile?.tenant_id)
      .order("account_code");
    if (data) setGLAccounts(data);
  };

  const createJournal = async () => {
    if (!selectedAccount || !amount || !accountName) {
      alert("Please fill in all required fields.");
      return;
    }

    if (!selectedAccount || !amount || !accountName) {
      alert("Please fill in all required fields.");
      return;
    }

    const { error } = await supabase.from("journals").insert([
      {
        journal_type: journalType,
        account_type: accountType,
        account_id: selectedAccount,
        amount: parseFloat(amount),
        account_name: accountName,
        description,
        created_by: profile?.id,
        tenant_id: profile?.tenant_id,
        status: "Posted",
      },
    ]);

    if (error) {
      alert("Failed to create journal.");
      console.log(error);
    } else {
      alert("Journal created successfully!");
      navigate("/journals");
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Journals / New Journal Entry
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 max-w-5xl">
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-6">
            Create New Journal Entry
          </h2>

          <div className="grid grid-cols-2 gap-6">
            {/* LEFT COLUMN */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#586ab1] focus:border-transparent"
                  value={journalType}
                  onChange={(e) => setJournalType(e.target.value)}
                >
                  <option>Credit Customer Account</option>
                  {/* <option>Debit G/L Account</option> */}
                  <option>Charge Customer</option>
                  <option>Debit Customer Account</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Account Type <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#586ab1] focus:border-transparent"
                  value={accountType}
                  onChange={(e) => {
                    setAccountType(e.target.value);
                    setSelectedAccount("");
                  }}
                >
                  <option>Customer Account</option>
                  {/* <option>G/L Account</option> */}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Customer <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#586ab1] focus:border-transparent"
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                >
                  <option value="">Select customer</option>
                  {customers.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.account_number} - {cust.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#586ab1] focus:border-transparent"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Account Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#586ab1] focus:border-transparent"
                  type="text"
                  placeholder="Enter account name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#586ab1] focus:border-transparent resize-none"
                  rows="8"
                  placeholder="Enter description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
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
              onClick={createJournal}
              className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-white transition-colors"
              style={{ backgroundColor: "#586ab1" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#4a5a9d"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#586ab1"}
            >
              <Save size={14} /> Save Entry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewJournalEntry;