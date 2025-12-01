import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { Eye, Loader2, FileText } from "lucide-react";
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
        console.error("Supabase error:", error);
        toast.error("Failed to load drafts.");
        return;
      }

      setDrafts(data || []);
    } catch (err) {
      console.error("Unexpected error fetching drafts:", err);
      toast.error("Unexpected error fetching drafts.");
    } finally {
      setLoading(false);
    }
  };

  // FIX: Use profile.id instead of profile object to prevent infinite re-renders
  useEffect(() => {
    if (!authLoading && profile?.id) {
      fetchDrafts();
    }
  }, [profile?.id, authLoading]); // Only depend on profile.id, not the entire profile object

  const handleViewDraft = (draftId) => {
    navigate(`/officer/drafts/view/${draftId}`);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <Loader2 className="animate-spin h-8 w-8 mx-auto mb-3" style={{ color: "#586ab1" }} />
            <p className="text-gray-500 text-sm">Loading drafts...</p>
          </div>
        </div>
      );
    }

    if (drafts.length === 0) {
      return (
        <div className="text-center py-16 bg-white rounded-lg shadow-sm">
          <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg font-medium mb-2">No drafts available</p>
          <p className="text-gray-400 text-sm">Draft entries will appear here</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead style={{ backgroundColor: "#586ab1" }}>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Prefix
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  First Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Surname
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Mobile
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  ID Number
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Business
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {drafts.map((draft, index) => (
                <tr
                  key={draft.id}
                  className={`transition-colors hover:bg-gray-50 ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {draft.prefix || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                    {draft.Firstname || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                    {draft.Surname || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {draft.mobile || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {draft.id_number || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {draft.business_name || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {draft.business_location || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleViewDraft(draft.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md transition-all duration-200 hover:shadow-md"
                      style={{ backgroundColor: "#586ab1" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#4a5a9d";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#586ab1";
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin h-10 w-10 mx-auto mb-3" style={{ color: "#586ab1" }} />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
     <div className="max-w-7xl mx-auto">
  {/* Header */}
  <div className="mb-6 flex justify-between items-center">
    <h1 className="text-sm text-slate-600">Customer Drafts</h1>
    <p className="text-xs font-bold" style={{ color: "#586ab1" }}>
      {drafts.length}
    </p>
  </div>

  {/* Content */}
  {renderContent()}
</div>

    </div>
  );
};

export default OfficerDrafts;