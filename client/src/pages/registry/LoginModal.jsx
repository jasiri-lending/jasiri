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
      const branchId = profile.branch_id || null;

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
      window.dispatchEvent(new Event("report-login"));

      setPassword("");
      if (onSuccess) onSuccess();
      if (onClose) onClose();

    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.2)] border border-white/40 w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-500 pointer-events-auto">
        {/* Compact Private Header */}
        <div className="bg-brand-secondary p-8 relative text-center">
          <button
            onClick={handleClose}
            className="absolute top-6 right-6 p-2 text-white/30 hover:text-white transition-colors hover:bg-white/10 rounded-full"
          >
            <XCircle className="w-5 h-5" />
          </button>
          
          <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-lg font-black text-white uppercase tracking-[0.25em] font-heading">Secure Reports</h2>
          
          {profile?.branch_id && (
            <div className="mt-3 flex items-center justify-center">
               <div className="bg-white/10 px-4 py-1.5 rounded-full flex items-center gap-2">
                  <Building2 className="w-3 h-3 text-white/70" />
                  <span className="text-[10px] text-white font-bold truncate max-w-[150px]">
                    {profile.branch}
                  </span>
               </div>
            </div>
          )}
        </div>

        <form onSubmit={handleLogin} className="p-10 space-y-8">
          {/* Extremely Simplified Password Input */}
          <div className="space-y-3 text-center">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.4em] flex items-center justify-center gap-2">
              <Lock className="w-3.5 h-3.5 text-brand-primary" />
              Access Code
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full bg-gray-50/50 border border-gray-100 px-6 py-5 rounded-3xl text-center text-3xl font-mono focus:ring-8 focus:ring-brand-primary/10 focus:border-brand-primary/20 outline-none transition-all placeholder:text-gray-100 tracking-[0.5em] text-brand-secondary"
            />
          </div>

          {error && (
            <div className="text-red-600 text-[11px] font-bold bg-red-50 p-4 rounded-2xl border border-red-200 animate-shake text-center">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-brand-primary text-white py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-brand-primary/40 hover:bg-blue-800 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:grayscale disabled:pointer-events-none flex items-center justify-center gap-3"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              {loading ? "VERIFYING..." : "LOGIN"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
