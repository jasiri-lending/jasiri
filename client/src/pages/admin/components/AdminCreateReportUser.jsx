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
  LayoutDashboard,
  Users,
  AlertTriangle
} from "lucide-react";
import CustomSelect from "../../../components/CustomSelect";

const AdminCreateReportUser = () => {
  const { profile } = useAuth();
  const [accessType, setAccessType] = useState("branch");
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

  const regionOptions = regions.map(r => ({ value: r.id, label: r.name }));

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

      if (!res.ok) throw new Error(data.error || "Failed to set password");

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
        <RefreshCw className="w-8 h-8 text-brand animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 font-outfit w-full flex items-start justify-center">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-heading flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-brand" />
            Report Access Manager
          </h1>
          <p className="text-sm text-muted mt-1">Configure secure access passcodes for branch tablets or administrative HQ access.</p>
        </div>

        {/* Main Card */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          {/* Access Type Toggle */}
          <div className="p-5 border-b border-border-light">
            <p className="text-xs font-bold text-heading uppercase tracking-widest mb-3">Access Type</p>
            <div className="flex gap-2 p-1 bg-surface rounded-lg border border-border-light">
              <button
                type="button"
                onClick={() => { setAccessType("branch"); setSelectedBranch(""); setBranchSearch(""); }}
                className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  accessType === "branch"
                    ? "bg-card text-brand shadow-sm border border-border"
                    : "text-muted hover:text-body"
                }`}
              >
                <Building2 className="w-4 h-4" />
                Branch Access
              </button>
              <button
                type="button"
                onClick={() => { setAccessType("master"); setSelectedBranch(""); setBranchSearch(""); }}
                className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  accessType === "master"
                    ? "bg-card text-brand shadow-sm border border-border"
                    : "text-muted hover:text-body"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Master Access (HQ)
              </button>
            </div>
          </div>

          <div className="p-6">
            {!showPassword ? (
              <form onSubmit={handleSetPassword} className="space-y-5">
                {accessType === "branch" ? (
                  <div className="space-y-5">
                    {/* Region Selection */}
                    <div>
                      <label className="text-xs font-bold text-heading flex items-center gap-1.5 mb-2">
                        <MapPin className="w-3.5 h-3.5 text-brand" />
                        Step 1: Select Region
                      </label>
                      <CustomSelect
                        value={selectedRegion}
                        onChange={(val) => {
                          setSelectedRegion(val);
                          setSelectedBranch("");
                        }}
                        options={[{ value: "", label: "Choose a region..." }, ...regionOptions]}
                        placeholder="Choose a region..."
                        fullWidth
                      />
                    </div>

                    {/* Branch Selection */}
                    <div className={`space-y-3 transition-all duration-300 ${!selectedRegion ? "opacity-40 pointer-events-none grayscale" : "opacity-100"}`}>
                      <label className="text-xs font-bold text-heading flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-brand" />
                        Step 2: Select Branch
                      </label>

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                        <input
                          type="text"
                          placeholder="Search branch name..."
                          value={branchSearch}
                          onChange={(e) => setBranchSearch(e.target.value)}
                          className="w-full bg-card border border-border pl-9 pr-4 py-2 rounded-lg text-xs text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all shadow-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg p-1">
                        {filteredBranches.map(b => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setSelectedBranch(b.id)}
                            className={`p-2.5 rounded-lg text-xs font-semibold transition-all border text-left flex items-center justify-between ${
                              selectedBranch === b.id
                                ? "bg-brand text-white border-brand shadow-sm"
                                : "bg-card text-body border-border hover:border-brand/40 hover:bg-surface"
                            }`}
                          >
                            {b.name}
                            {selectedBranch === b.id && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                        {filteredBranches.length === 0 && selectedRegion && (
                          <p className="col-span-2 text-center py-4 text-xs text-muted italic">No branches found in this region.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 bg-surface border border-border-light rounded-xl space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-brand/10 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-brand" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-heading">Master HQ Password</h4>
                        <p className="text-[10px] text-muted leading-tight mt-0.5">Grants unrestricted access across all branches. For HQ/Admin personnel only.</p>
                      </div>
                    </div>
                    <div className="p-3 bg-card border border-border rounded-lg">
                      <p className="text-[11px] text-muted font-medium italic">Master access passwords override branch restrictions and should only be shared with authorized personnel.</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-danger-fill/20 border border-danger-fill rounded-lg flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-danger-DEFAULT flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-danger-DEFAULT font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || (accessType === "branch" && !selectedBranch)}
                  className="w-full f-btn py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale disabled:pointer-events-none"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Generating..." : `Set ${accessType === "branch" ? "Branch" : "Master"} Report Password`}
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                {/* Success Banner */}
                <div className="bg-success-fill/30 border border-success-fill/50 p-5 rounded-xl text-center">
                  <div className="w-11 h-11 bg-success-fill/50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-5 h-5 text-success-text" />
                  </div>
                  <h3 className="text-sm font-bold text-success-text mb-1">Passcode Generated!</h3>
                  <p className="text-success-text/80 text-xs font-medium">{message}</p>
                </div>

                {/* Security Warning */}
                <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
                  <h4 className="text-amber-800 font-bold text-xs uppercase tracking-wider mb-1.5 flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Security Protocol
                  </h4>
                  <p className="text-xs text-amber-700 leading-relaxed font-medium">
                    Copy this password immediately. For security, it is stored encrypted and <strong>cannot be retrieved later</strong>. If lost, you must generate a new one.
                  </p>
                </div>

                {/* Password Display */}
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Access Password</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedPassword}
                      className="flex-1 bg-surface border-2 border-dashed border-border p-4 rounded-xl font-mono text-xl font-bold text-brand tracking-wider text-center focus:outline-none"
                    />
                    <button
                      onClick={copyToClipboard}
                      className={`px-5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
                        copied ? "bg-success-fill/60 text-success-text border border-success-fill" : "f-btn"
                      }`}
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  className="w-full px-4 py-3 bg-surface text-body rounded-lg text-xs font-semibold hover:bg-border-light transition-all border border-border"
                >
                  Generate Another Passcode
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-muted text-xs font-medium">
          &copy; {new Date().getFullYear()} Jasiri Lending Technologies. All user activities are logged.
        </p>
      </div>
    </div>
  );
};

export default AdminCreateReportUser;