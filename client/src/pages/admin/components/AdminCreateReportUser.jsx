import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../hooks/userAuth.js";
import { apiFetch } from "../../../utils/api";
import { supabase } from "../../../supabaseClient";
import { 
  Building2, 
  MapPin, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Copy, 
  ShieldCheck,
  ChevronDown,
  LayoutDashboard,
  Users
} from "lucide-react";

const AdminCreateReportUser = () => {
  const { profile } = useAuth();
  const [accessType, setAccessType] = useState("branch"); // "branch" or "master"
  const [regions, setRegions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch Regions
  useEffect(() => {
    const fetchRegions = async () => {
      if (!profile?.tenant_id || accessType !== "branch") return;
      const { data, error } = await supabase
        .from("regions")
        .select("id, name")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      
      if (!error) setRegions(data || []);
    };
    fetchRegions();
  }, [profile?.tenant_id, accessType]);

  // Fetch Branches for selected region
  useEffect(() => {
    const fetchBranches = async () => {
      if (!selectedRegion || accessType !== "branch") {
        setBranches([]);
        return;
      }
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .eq("region_id", selectedRegion)
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      
      if (!error) setBranches(data || []);
    };
    fetchBranches();
  }, [selectedRegion, profile?.tenant_id, accessType]);

  const filteredBranches = useMemo(() => {
    if (!branchSearch) return branches;
    return branches.filter(b => b.name.toLowerCase().includes(branchSearch.toLowerCase()));
  }, [branches, branchSearch]);

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (accessType === "branch" && !selectedBranch) return;

    setLoading(true);
    setMessage("");
    setError("");
    setGeneratedPassword("");
    setCopied(false);

    try {
      const payload = {
        branch_id: accessType === "branch" ? selectedBranch : null,
        tenant_id: profile.tenant_id
      };

      const res = await apiFetch("/api/report-users/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to set password");
      }

      setMessage(data.message || "Password generated successfully!");
      setGeneratedPassword(data.password);
      setShowPassword(true);
      
    } catch (err) {
      console.error("❌ Set password error:", err);
      setError(err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setShowPassword(false);
    setGeneratedPassword("");
    setMessage("");
    setSelectedBranch("");
    setBranchSearch("");
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 ">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden translate-y-0 transition-all duration-300">
        {/* Header Header */}
        <div className="bg-brand-secondary p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/10 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-white">Report Access Manager</h2>
          </div>
          <p className="text-brand-surface/70 text-sm">Configure secure access passcodes for branch tablets or administrative HQ access.</p>
        </div>

        <div className="p-8">
          {!showPassword ? (
            <form onSubmit={handleSetPassword} className="space-y-6">
              {/* Access Type Toggle */}
              <div className="space-y-3 p-1 bg-gray-50 rounded-2xl border border-gray-100 flex">
                <button
                  type="button"
                  onClick={() => setAccessType("branch")}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    accessType === "branch" 
                      ? "bg-white text-brand-primary shadow-sm border border-gray-200" 
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  BRANCH ACCESS
                </button>
                <button
                  type="button"
                  onClick={() => setAccessType("master")}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    accessType === "master" 
                      ? "bg-white text-brand-primary shadow-sm border border-gray-200" 
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  MASTER ACCESS (HQ/ADMIN)
                </button>
              </div>

              {accessType === "branch" ? (
                <div className="space-y-6 animate-in slide-in-from-left-2 duration-300">
                  {/* Region Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 pl-1">
                      <MapPin className="w-3 h-3 text-brand-primary" />
                      Step 1: Select Region
                    </label>
                    <div className="relative">
                      <select
                        value={selectedRegion}
                        onChange={(e) => {
                          setSelectedRegion(e.target.value);
                          setSelectedBranch("");
                        }}
                        className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all appearance-none cursor-pointer"
                        required
                      >
                        <option value="">Choose a region...</option>
                        {regions.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Branch Selection */}
                  <div className={`space-y-2 transition-all duration-300 ${!selectedRegion ? 'opacity-40 pointer-events-none grayscale' : 'opacity-100'}`}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 pl-1">
                      <Building2 className="w-3 h-3 text-brand-primary" />
                      Step 2: Select Branch
                    </label>
                    
                    {/* Search Box */}
                    <div className="relative mb-3 group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-brand-primary transition-colors" />
                      <input
                        type="text"
                        placeholder="Search branch name..."
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 pl-11 pr-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-gray-200">
                      {filteredBranches.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBranch(b.id)}
                          className={`p-2.5 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between ${
                            selectedBranch === b.id 
                              ? "bg-brand-primary text-white border-brand-primary shadow-md" 
                              : "bg-white text-gray-600 border-gray-100 hover:border-brand-primary/30 hover:bg-gray-50"
                          }`}
                        >
                          {b.name}
                          {selectedBranch === b.id && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                      ))}
                      {filteredBranches.length === 0 && selectedRegion && (
                        <p className="col-span-2 text-center py-4 text-xs text-gray-400 italic">No branches found in this region.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-brand-surface border border-brand-secondary/10 rounded-2xl space-y-4 animate-in slide-in-from-right-2 duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-brand-primary uppercase tracking-tight">Master HQ Password</h4>
                      <p className="text-[10px] text-gray-500 font-medium leading-tight">This passcode allows administrators and HQ staff to access reports without branch-specific identification.</p>
                    </div>
                  </div>
                  <div className="p-4 bg-white/50 border border-brand-secondary/5 rounded-xl">
                    <p className="text-[11px] text-brand-primary/70 font-semibold italic">Note: Master access passwords override branch restrictions and should only be shared with authorized personnel.</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-red-600 font-bold">!</span>
                  </div>
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (accessType === "branch" && !selectedBranch)}
                className="w-full bg-brand-primary text-white py-3 rounded-xl text-xs font-bold shadow-lg hover:bg-blue-800 transition-all hover:shadow-brand-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:pointer-events-none mt-4 flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {loading ? "GENERATING..." : `SET ${accessType.toUpperCase()} REPORT PASSWORD`}
              </button>
            </form>
          ) : (
            <div className="space-y-8 animate-in fade-in zoom-in duration-300">
              <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-emerald-900 mb-1">Passcode Generated!</h3>
                <p className="text-emerald-700 text-sm font-medium">{message}</p>
              </div>

              <div className="bg-amber-50 border-l-4 border-amber-400 p-6 rounded-r-2xl">
                <h4 className="text-amber-800 font-bold text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Security Protocol
                </h4>
                <p className="text-xs text-amber-700 leading-relaxed font-medium">
                  Copy this password immediately. For security, it is stored encrypted and <strong>cannot be retrieved later</strong>. If lost, you must generate a new one.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Access Password</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedPassword}
                    className="flex-1 bg-gray-50 border-2 border-dashed border-gray-200 p-4 rounded-2xl font-mono text-xl font-bold text-brand-primary tracking-wider text-center"
                  />
                  <button
                    onClick={copyToClipboard}
                    className={`px-6 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg ${
                      copied ? "bg-emerald-600 text-white" : "bg-brand-primary text-white hover:bg-blue-800 shadow-brand-primary/20 active:scale-95"
                    }`}
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "COPIED!" : "COPY"}
                  </button>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="w-full bg-gray-100 text-gray-600 py-3 rounded-2xl text-xs font-bold hover:bg-gray-200 transition-all border border-gray-200"
              >
                GENERATE ANOTHER PASSCODE
              </button>
            </div>
          )}
        </div>
      </div>
      
      <p className="mt-8 text-center text-gray-400 text-xs font-medium">
        &copy; {new Date().getFullYear()} Jasiri Lending Technologies. All user activities are logged.
      </p>
    </div>
  );
};

export default AdminCreateReportUser;