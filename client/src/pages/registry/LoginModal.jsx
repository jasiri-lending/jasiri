import { useState } from "react";
import { API_BASE_URL } from "../../../config";
import { useAuth } from "../../hooks/userAuth";
import { apiFetch } from "../../utils/api";
import { supabase } from "../../supabaseClient";
import { 
  Building2, 
  Lock, 
  XCircle,
  RefreshCw,
  ShieldCheck
} from "lucide-react";

const LoginModal = ({ isOpen, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleClose = () => {
    localStorage.removeItem("reportUser");
    if (onClose) onClose();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!profile?.tenant_id) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      // Automatically use the branch_id from the user's profile
      // If the user is an admin/HQ and has no branch_id, it will be null
      // and the backend will validate against the tenant's master report password.
      const branchRoles = ["relationship_officer", "branch_manager", "customer_service_officer"];
      const isBranchUser = branchRoles.includes(profile?.role);
      const branchId = isBranchUser ? (profile.branch_id || null) : null;

      const res = await apiFetch(`/api/checkReportUser`, {
        method: "POST",
        body: JSON.stringify({
          branch_id: branchId,
          password,
          tenant_id: profile.tenant_id,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        setError("Invalid credentials");
        return;
      }

      const reportUserData = {
        userId: data.userId,
        branchName: data.branchName,
        tenant_id: data.tenant_id,
        loggedAt: new Date().toISOString(),
      };

      localStorage.setItem("reportUser", JSON.stringify(reportUserData));
      
      // Close and trigger success immediately to speed up UI transition
      if (onSuccess) onSuccess();
      if (onClose) onClose();
      
      // Notify other components for reactive updates
      window.dispatchEvent(new Event("report-login"));
      setPassword("");

    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop - Subtle & No Blur */}
      <div 
        className="absolute inset-0 bg-slate-900/10 transition-opacity duration-300" 
        onClick={handleClose}
      />
      
      {/* Centered Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header - Sleek & Compact */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary/5 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h2 className="text-sm font-black text-brand-primary uppercase tracking-tight">Secure Reports</h2>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-0.5">Authorization Required</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-brand-primary transition-colors hover:bg-gray-100 rounded-lg"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Branch Context Info (Optional) */}
          {profile?.branch_id && ["relationship_officer", "branch_manager", "customer_service_officer"].includes(profile?.role) && (
            <div className="bg-brand-primary/5 border border-brand-primary/10 rounded-xl p-3 flex items-center gap-3">
              <Building2 className="w-4 h-4 text-brand-primary/70" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-brand-primary uppercase">Branch Authentication</p>
                <p className="text-[10px] text-brand-primary/60 font-bold truncate tracking-tight">{profile.branch}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em] mb-1.5 block">Access Code</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-gray-300" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-gray-200 pl-11 pr-4 py-3 rounded-xl text-sm font-black text-brand-primary focus:ring-2 focus:ring-brand-primary/5 focus:border-brand-primary outline-none transition-all placeholder:text-gray-200"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100 text-red-600 animate-in slide-in-from-top-2">
                <Lock className="w-4 h-4 flex-shrink-0" />
                <p className="text-[10px] font-bold uppercase tracking-tight leading-tight">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-brand-primary text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-primary/20 hover:bg-brand-secondary active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin text-white/50" /> : <ShieldCheck className="w-4 h-4" />}
              {loading ? "VERIFYING..." : "LOGIN"}
            </button>
          </form>
        </div>

        <div className="p-4 border-t border-gray-100 bg-slate-50/50 flex flex-col items-center">
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">Enterprise Data Access Policy</p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
