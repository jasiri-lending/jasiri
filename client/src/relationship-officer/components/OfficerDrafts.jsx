import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../hooks/userAuth"; 
import { useNavigate } from "react-router-dom";


const OfficerDrafts = () => {
  const { profile, loading: authLoading } = useAuth(); 
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

   const navigate = useNavigate();

  // Fetch drafts
  const fetchDrafts = async () => {
    if (!profile?.id) {
      console.warn("No profile ID found. Skipping fetch.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, prefix, Firstname, Surname, mobile, id_number, business_name, business_location, form_status, created_by"
        )
        .eq("form_status", "draft")
         .eq("status", "pending")
        .eq("created_by", profile.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(" Supabase error:", error);
        toast.error("Failed to load drafts.");
        return;
      }

      setDrafts(data || []);
    } catch (err) {
      console.error(" Unexpected error fetching drafts:", err);
      toast.error("Unexpected error fetching drafts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && profile?.id) fetchDrafts();
  }, [profile, authLoading]);

  const handleViewDraft = (draftId) => {
    navigate(`/officer/drafts/view/${draftId}`);
  };

  // Extract the nested ternary into a separate variable
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="animate-spin h-6 w-6 text-blue-600" />
        </div>
      );
    }
    
    if (drafts.length === 0) {
      return <p className="text-gray-500 text-center">No drafts available.</p>;
    }
    
    return (
      <div className="overflow-x-auto bg-white rounded-lg shadow-md">
        <table className="min-w-full text-sm text-left text-gray-700">
          <thead className="bg-gray-100 uppercase text-gray-600 text-xs font-semibold">
            <tr>
              <th className="px-4 py-3">Prefix</th>
              <th className="px-4 py-3">First Name</th>
              <th className="px-4 py-3">Surname</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">ID Number</th>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft) => (
              <tr
                key={draft.id}
                className="border-b hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-2">{draft.prefix || "N/A"}</td>
                <td className="px-4 py-2">{draft.Firstname || "N/A"}</td>
                <td className="px-4 py-2">{draft.Surname || "N/A"}</td>
                <td className="px-4 py-2">{draft.mobile || "N/A"}</td>
                <td className="px-4 py-2">{draft.id_number || "N/A"}</td>
                <td className="px-4 py-2">{draft.business_name || "N/A"}</td>
                <td className="px-4 py-2">{draft.business_location || "N/A"}</td>
                <td className="px-4 py-2 text-center">
                  <button
                   onClick={() => handleViewDraft(draft.id)}

                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Eye className="h-4 w-4" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="animate-spin h-6 w-6 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-sm font-semibold mb-6 text-gray-800">
        Customer Drafts
      </h2>

      {renderContent()}

    </div>
  );
};

export default OfficerDrafts;