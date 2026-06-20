import { useState } from "react";
import { useAuth } from "../../hooks/userAuth";
import { apiFetch } from "../../utils/api";
import { 
  Building2, 
  Lock, 
  RefreshCw,
  ShieldCheck
} from "lucide-react";
import Modal from "../../components/Modal";

const LoginModal = ({ isOpen, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      
      if (onSuccess) onSuccess();
      if (onClose) onClose();
      
      window.dispatchEvent(new Event("report-login"));
      setPassword("");

    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={isOpen} title="SECURE REPORTS" onClose={handleClose}>
      <div className="space-y-4 font-outfit">
        {/* Header Icon & Sub-description */}
        <div className="flex items-center gap-3 pb-2 border-b border-border-light">
          <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-heading uppercase tracking-wider leading-none">Security Required</h4>
            <p className="text-[10px] text-muted uppercase tracking-widest mt-1">Authorized Staff Only</p>
          </div>
        </div>

        {/* Branch Context Info (Optional) */}
        {profile?.branch_id && ["relationship_officer", "branch_manager", "customer_service_officer"].includes(profile?.role) && (
          <div className="bg-surface border border-border-light rounded-md p-3 flex items-center gap-3">
            <Building2 className="w-4 h-4 text-brand" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-heading uppercase">Branch Authentication</p>
              <p className="text-xs text-muted truncate">{profile.branch}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted mb-1 block">Access Code</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-muted" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                placeholder="••••••••"
                className="w-full bg-card border border-border pl-9 pr-3 py-2 rounded-md text-sm text-body placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-danger-fill rounded-md border border-danger-text/10 text-danger-text text-xs font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-brand text-white py-2 px-4 rounded-md text-xs font-semibold uppercase tracking-wider shadow-sm hover:bg-forest-deep active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {loading ? "VERIFYING..." : "ENTER"}
          </button>
        </form>

        <div className="pt-2 text-center border-t border-border-light">
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Enterprise Data Access Policy</p>
        </div>
      </div>
    </Modal>
  );
};

export default LoginModal;
