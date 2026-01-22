import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { 
  EyeIcon, 
  DocumentTextIcon, 
  ArrowPathIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import { useAuth } from "../../hooks/userAuth";
import { useNavigate } from "react-router-dom";
import Spinner from "../../components/Spinner";

const OfficerDrafts = () => {
  const { profile, loading: authLoading } = useAuth();
  const [drafts, setDrafts] = useState([]);
  const [filteredDrafts, setFilteredDrafts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
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
      setFilteredDrafts(data || []);
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

  // Search functionality
  useEffect(() => {
    if (!drafts || drafts.length === 0) return;
    
    const filtered = drafts.filter(draft =>
      (draft.Firstname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (draft.Surname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (draft.mobile || '').toString().includes(searchTerm) ||
      (draft.id_number || '').toString().includes(searchTerm) ||
      (draft.business_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
    setFilteredDrafts(filtered);
  }, [searchTerm, drafts]);

  const handleViewDraft = useCallback((draftId) => {
    navigate(`/officer/drafts/view/${draftId}`);
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const clearSearch = () => {
    setSearchTerm("");
  };

  if (authLoading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen font-sans">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#586ab1' }}></div>
          <span className="ml-3 text-gray-500 text-sm">Loading user information...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-brand-surface text-gray-800 border-r border-gray-200 transition-all duration-300 p-6 min-h-screen font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xs text-slate-600 mb-1 font-medium tracking-wide">
             Customer Drafts
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm" style={{backgroundColor:"#586ab1"}}>
            <span className="font-medium text-white">{filteredDrafts.length}</span> draft{filteredDrafts.length !== 1 ? 's' : ''}
          </div>
          <button 
            onClick={handleRefresh}
            className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-all duration-200 border whitespace-nowrap"
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

      {/* Main Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Search Bar Only - No Filters */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search Container */}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {/* Search Bar */}
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, mobile, ID number, or business..."
                  className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all duration-200 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Clear Search Button */}
              {searchTerm && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={clearSearch}
                    className="px-3 py-2 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-1.5 border border-gray-300"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                    Clear Search
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Active Search Display */}
          {searchTerm && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs text-gray-500 mr-2">Active search:</span>
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                  "{searchTerm}"
                  <button
                    onClick={clearSearch}
                    className="ml-1 text-gray-500 hover:text-gray-700"
                  >
                    <XMarkIcon className="h-2.5 w-2.5" />
                  </button>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto font-sans">
          {loading ? (
            <div className="px-6 py-12 text-center">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#586ab1' }}></div>
                <span className="ml-3 text-gray-500 text-sm">Loading drafts...</span>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ backgroundColor: '#E7F0FA' }}>
                  <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                    Prefix
                  </th>
                  <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                    First Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                    Surname
                  </th>
                  <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                    Mobile
                  </th>
                  <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                    ID Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                    Business
                  </th>
                  <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                    Location
                  </th>
                  <th className="px-4 py-3 text-center text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredDrafts.map((draft, index) => (
                  <tr 
                    key={draft.id} 
                    className={`border-b transition-colors hover:bg-gray-50 ${index % 2 === 0 ? '' : 'bg-gray-50'}`}
                  >
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {draft.prefix || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {draft.Firstname || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {draft.Surname || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {draft.mobile || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {draft.id_number || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {draft.business_name || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                      {draft.business_location || "N/A"}
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center">
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* No Results */}
        {!loading && filteredDrafts.length === 0 && (
          <div className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center">
              <DocumentTextIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">
              {searchTerm ? "No drafts found" : "No drafts available"}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {searchTerm
                ? "Try adjusting your search criteria"
                : "Draft entries will appear here when you save customer forms"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfficerDrafts;