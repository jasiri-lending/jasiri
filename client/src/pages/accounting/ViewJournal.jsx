import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { ArrowLeft } from "lucide-react";

function ViewJournal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [journal, setJournal] = useState(null);

  const fetchJournal = async () => {
    const { data, error } = await supabase
      .from("journals")
      .select(`
        *,
        customers:customer_id(first_name, middle_name, surname),
        profiles:created_by(full_name)
      `)
      .eq("id", id)
      .single();

    if (!error) setJournal(data);
  };

  useEffect(() => {
    fetchJournal();
  }, []);

  if (!journal) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <p className="text-xs text-gray-500">Loading journal details...</p>
        </div>
      </div>
    );
  }

  const customerFullName = journal.customers
    ? `${journal.customers.first_name || ""} ${journal.customers.middle_name || ""} ${journal.customers.surname || ""}`.trim()
    : "N/A";

  return (
    <div className="p-6 bg-brand-surface min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Journals / Journal Details
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 max-w-4xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-800">
            Journal Entry #{journal.id}
          </h2>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Type
              </label>
              <p className="text-xs text-gray-900 font-medium">
                {journal.journal_type}
              </p>
            </div>

            {/* Account Type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Account Type
              </label>
              <p className="text-xs text-gray-900 font-medium">
                {journal.account_type || "Customer Account"}
              </p>
            </div>

            {/* Account Name (Customer) */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Account Name
              </label>
              <p className="text-xs text-gray-900 font-medium">
                {journal.account_name || customerFullName}
              </p>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Amount
              </label>
              <p className="text-xs text-gray-900 font-semibold">
                {parseFloat(journal.amount).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>

            {/* Description */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Description
              </label>
              <p className="text-xs text-gray-900 leading-relaxed">
                {journal.description || "No description provided"}
              </p>
            </div>

            {/* Created By */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Created By
              </label>
              <p className="text-xs text-gray-900">
                {journal.profiles?.full_name || "N/A"}
              </p>
            </div>

            {/* Created At */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Created At
              </label>
              <p className="text-xs text-gray-900">
                {new Date(journal.created_at).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Status
              </label>
              <span
                className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: "#586ab1" }}
              >
                {journal.status}
              </span>
            </div>

            {/* Remarks */}
            {journal.remarks && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Remarks
                </label>
                <p className="text-xs text-gray-900 leading-relaxed">
                  {journal.remarks}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Back Button */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <button
            onClick={() => navigate("/journals")}
            className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Journals
          </button>
        </div>
      </div>
    </div>
  );
}

export default ViewJournal;