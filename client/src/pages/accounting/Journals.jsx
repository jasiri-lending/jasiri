import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { Eye, Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

function Journals() {
  const [journals, setJournals] = useState([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const fetchJournals = async () => {
    const { data, error } = await supabase
      .from("journals")
      .select(`
        id,
        journal_type,
        amount,
        description,
        status,
        created_at,
        created_by,
        customer_id,
        customers:customer_id(full_name),
        profiles:created_by(full_name)
      `)
      .order("created_at", { ascending: false });

    if (!error) setJournals(data);
  };

  useEffect(() => {
    fetchJournals();
  }, []);

  const filteredJournals = journals.filter((j) =>
    j.customers?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 bg-brand-surface min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Journals / Journals Summary
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          {/* NEW ENTRY BUTTON */}
          <button
            className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-white transition-colors"
            style={{ backgroundColor: "#586ab1" }}
            onClick={() => navigate("/journals/new")}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#4a5a9d"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#586ab1"}
          >
            <Plus size={14} /> New Entry
          </button>

          <div className="relative">
            <Search 
              size={14} 
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by customer..."
              className="border border-gray-300 rounded-md pl-8 pr-3 py-1.5 w-64 text-xs focus:outline-none focus:ring-1 focus:border-transparent"
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
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                  Journal Type
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                  Customer Name
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">
                  Amount
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                  Description
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                  Created By
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">
                  Created At
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredJournals.map((j) => (
                <tr 
                  key={j.id} 
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {j.journal_type}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-900">
                    {j.customers?.full_name || "Unknown"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 text-right font-medium">
                    {j.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">
                    {j.description}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span 
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: "#586ab1" }}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {j.profiles?.full_name}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 text-center">
                    {new Date(j.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      className="inline-flex items-center justify-center p-1 rounded hover:bg-gray-100 transition-colors"
                      onClick={() => navigate(`/journals/${j.id}`)}
                      aria-label="View journal"
                    >
                      <Eye
                        className="text-gray-600 hover:text-gray-900"
                        size={16}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredJournals.length === 0 && (
          <div className="p-8 text-center text-xs text-gray-500">
            No journals found
          </div>
        )}
      </div>
    </div>
  );
}

export default Journals;