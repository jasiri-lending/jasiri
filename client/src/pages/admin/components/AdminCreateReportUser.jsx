import { useState } from "react";
import { useAuth } from "../../../hooks/userAuth.js";
import { apiFetch } from "../../../utils/api";

const AdminCreateReportUser = () => {
  const { profile } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    setGeneratedPassword("");
    setCopied(false);

    if (!profile?.tenant_id) {
      setError("Tenant ID not found. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      const payload = {
        email: email.trim(),
        tenant_id: profile.tenant_id
      };

      console.log("📤 Creating report user:", payload);

      const res = await apiFetch("/api/report-users/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      console.log("📡 Response status:", res.status, res.statusText);

      // Check if response is ok before parsing
      if (!res.ok) {
        let errorMsg = "Failed to create user";
        try {
          const errorData = await res.json();
          errorMsg = errorData.error || errorMsg;
          console.log("❌ Error response:", errorData);
        } catch (jsonErr) {
          console.error("❌ Failed to parse error JSON:", jsonErr);
          errorMsg = `Server error: ${res.status} ${res.statusText}`;
        }
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // Parse successful response
      const data = await res.json();
      console.log("✅ Success response:", data);
      setLoading(false);

      if (data.success) {
        setMessage("User created successfully!");
        setGeneratedPassword(data.password);
        setShowPassword(true);
        setEmail("");
      } else {
        setError(data.error || "Failed to create user");
      }

    } catch (err) {
      setLoading(false);
      console.error("❌ Create user error:", err);

      if (err.message === "Failed to fetch") {
        setError("Cannot connect to server. Please check if the backend is running.");
      } else if (err.name === "SyntaxError") {
        setError("Server returned invalid response. Please check server logs.");
      } else {
        setError(err.message || "Network error. Please try again.");
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClosePasswordDisplay = () => {
    setShowPassword(false);
    setGeneratedPassword("");
    setMessage("");
  };

  // Show loading state while profile is being fetched
  if (!profile) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow">
        <h2 className="text-2xl font-bold mb-4 font-heading text-brand-primary">Create Report Access User</h2>
        <p className="text-center text-gray-600">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow">
      <h2 className="text-2xl font-bold mb-4 font-heading text-brand-primary">Create Report Access User</h2>

      {/* Info context */}
      <div className="mb-6 p-4 bg-brand-surface border border-brand-secondary/20 rounded-lg text-sm">
        <p className="text-brand-primary/80">This will create a new user with access to <strong>Reports Only</strong> for your tenant.</p>
      </div>

      {!showPassword ? (
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">User Email Address</label>
            <input
              type="email"
              className="w-full border border-gray-300 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. report.manager@jasiri.com"
              required
            />
          </div>

          <div className="text-xs text-brand-primary/70 bg-gray-50 p-3 rounded-lg flex items-start gap-2 border border-gray-100">
            <span className="text-brand-primary font-bold italic">i</span>
            <p>A secure password will be automatically generated and shown on the next screen.</p>
          </div>

          {!profile?.tenant_id && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
              ⚠️ Authentication error: Tenant ID missing. Please refresh the page.
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="font-semibold mb-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                Error Creating User
              </p>
              <p className="ml-3.5 opacity-90">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !profile?.tenant_id}
            className="w-full bg-brand-primary text-white py-2.5 rounded-lg font-semibold shadow-sm hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Processing..." : "Generate Report User"}
          </button>
        </form>
      ) : (
        <div className="space-y-5 animate-in fade-in zoom-in duration-300">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <p className="text-emerald-800 font-bold mb-1 italic">
              Success!
            </p>
            <p className="text-emerald-700 text-sm">
              {message}
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
              <p className="text-sm text-amber-800 font-bold uppercase tracking-wider">
                Action Required
              </p>
            </div>
            <p className="text-xs text-amber-700 leading-relaxed font-medium">
              Copy this password immediately. For security, it will <strong>not be displayed again</strong> once you close this window.
            </p>
          </div>

          <div className="relative group">
            <label className="block mb-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Temporary Password</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={generatedPassword}
                className="flex-1 border-2 border-brand-secondary/10 p-3 rounded-xl bg-gray-50 font-mono text-base font-bold text-brand-primary shadow-inner"
              />
              <button
                onClick={copyToClipboard}
                className={`px-5 py-2.5 rounded-xl font-bold transition-all duration-200 ${copied
                  ? "bg-emerald-600 text-white"
                  : "bg-brand-primary text-white hover:bg-blue-800 shadow-md hover:shadow-lg active:scale-95"
                  }`}
              >
                {copied ? "COPIED!" : "COPY"}
              </button>
            </div>
          </div>

          <div className="bg-brand-surface border border-brand-secondary/20 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-brand-primary/50 uppercase tracking-widest font-bold mb-1">Assigned Email</p>
            <p className="text-sm text-brand-primary font-semibold">
              {email || "(Success)"}
            </p>
          </div>

          <button
            onClick={handleClosePasswordDisplay}
            className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors border border-slate-200"
          >
            Create Another User
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminCreateReportUser;