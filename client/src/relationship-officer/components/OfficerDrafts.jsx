import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { 
  EyeIcon, 
  DocumentTextIcon, 
  UserIcon, 
  PhoneIcon, 
  IdentificationIcon,
  BuildingStorefrontIcon,
  MapPinIcon,
  ArrowPathIcon
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import { useAuth } from "../../hooks/userAuth";
import { useNavigate } from "react-router-dom";
import Spinner from "../../components/Spinner";

const OfficerDrafts = () => {
  const { profile, loading: authLoading } = useAuth();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  
  // Use refs to track if data has been loaded
  const hasLoadedRef = useRef(false);
  const profileIdRef = useRef(null);

  // Memoized fetch function
  const fetchDrafts = useCallback(async () => {
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
          "id, prefix, Firstname, Surname, mobile, id_number, business_name, business_location, form_status, created_by, created_at"
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
  }, [profile?.id]);

  // Load data only once when profile becomes available
  useEffect(() => {
    if (profile?.id && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      profileIdRef.current = profile.id;
      fetchDrafts();
    }
    
    // If profile changes (user switches accounts), reload
    if (profile?.id && profileIdRef.current !== profile.id) {
      hasLoadedRef.current = false;
      profileIdRef.current = profile.id;
      fetchDrafts();
    }
  }, [profile?.id, fetchDrafts]);

  const handleViewDraft = useCallback((draftId) => {
    navigate(`/officer/drafts/view/${draftId}`);
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  if (authLoading || loading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
        <Spinner text="Loading drafts..." />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
      {/* Header */}
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-xs text-slate-500 font-medium">Customer Drafts</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-gray-200 shadow-sm">
            <DocumentTextIcon className="h-4 w-4 text-gray-500" />
            <span className="text-xs font-semibold text-slate-700">
              {drafts.length} Draft{drafts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button 
            onClick={handleRefresh}
            className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-colors border whitespace-nowrap"
            style={{ 
              backgroundColor: "#586ab1",
              color: "white",
              borderColor: "#586ab1"
            }}
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      {drafts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="text-center py-16">
            <DocumentTextIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-sm font-medium text-gray-900 mb-2">No drafts available</h3>
            <p className="text-xs text-gray-500">Draft entries will appear here</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr style={{ backgroundColor: "#fff" }}>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <UserIcon className="h-3 w-3" />
                      Prefix
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">
                    First Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">
                    Surname
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <PhoneIcon className="h-3 w-3" />
                      Mobile
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <IdentificationIcon className="h-3 w-3" />
                      ID Number
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <BuildingStorefrontIcon className="h-3 w-3" />
                      Business
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <MapPinIcon className="h-3 w-3" />
                      Location
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr
                    key={draft.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {draft.prefix || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {draft.Firstname || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {draft.Surname || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {draft.mobile || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {draft.id_number || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {draft.business_name || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {draft.business_location || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleViewDraft(draft.id)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md transition inline-flex items-center gap-1"
                        style={{ 
                          backgroundColor: "#586ab1",
                          color: "white",
                          borderColor: "#586ab1"
                        }}
                      >
                        <EyeIcon className="h-4 w-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerDrafts;