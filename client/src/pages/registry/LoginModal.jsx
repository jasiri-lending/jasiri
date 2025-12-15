import { useState } from "react";
import { API_BASE_URL } from "../../../config";
import { useAuth } from "../../hooks/userAuth";

const LoginModal = ({ isOpen, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate tenant_id is available
    if (!profile?.tenant_id) {
      setError("Session expired. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      console.log("🔐 Attempting login for:", email.trim());
      console.log("🌐 API URL:", `${API_BASE_URL}/api/checkReportUser`);

      const res = await fetch(`${API_BASE_URL}/api/checkReportUser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          tenant_id: profile.tenant_id,
        }),
      });

      console.log("📡 Response status:", res.status, res.statusText);

      // Check if response is JSON
      const contentType = res.headers.get("content-type");
      let data;

      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
        console.log("📥 Response data:", data);
      } else {
        const text = await res.text();
        console.error("❌ Non-JSON response:", text);
        throw new Error("Server returned invalid response");
      }

      // Check if request was successful
      if (!res.ok) {
        setError(data?.error || "Invalid email or password");
        setLoading(false);
        return;
      }

      // Verify we have the expected data
      if (!data.success || !data.userId) {
        console.error("❌ Invalid response structure:", data);
        setError("Login failed. Please try again.");
        setLoading(false);
        return;
      }

      // ✅ Success - store report user info
      console.log("✅ Login successful!");
      
      const reportUserData = {
        userId: data.userId,
        email: data.email,
        tenant_id: data.tenant_id,
        loggedAt: new Date().toISOString(),
      };

      localStorage.setItem("reportUser", JSON.stringify(reportUserData));
      console.log("💾 Stored in localStorage:", reportUserData);

      // Clear form
      setEmail("");
      setPassword("");

      // Call success callbacks
      if (onSuccess) onSuccess();
      if (onClose) onClose();

    } catch (err) {
      console.error("Login error:", err);
      
      if (err.message === "Failed to fetch") {
        setError(`Cannot connect to server at ${API_BASE_URL}. Please check if the server is running.`);
      } else if (err.message.includes("JSON")) {
        setError("Server error. Please contact support.");
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-lg w-96 p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl leading-none"
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="text-xl  mb-6 text-center text-slate-600">Report Login</h2>

        {/* Debug info in development */}
        {/* {import.meta.env.DEV && (
          <div className="mb-4 p-2 bg-gray-100 text-xs rounded">
            <p><strong>API:</strong> {API_BASE_URL}</p>
            <p><strong>Tenant:</strong> {profile?.tenant_id || "Loading..."}</p>
          </div>
        )} */}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="user@example.com"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#586ab1] focus:border-[#586ab1]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#586ab1] focus:border-[#586ab1]"
            />
          </div>

          {!profile?.tenant_id && (
            <p className="text-amber-600 text-sm bg-amber-50 p-2 rounded">
              ⚠️ Loading session...
            </p>
          )}

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded border border-red-200">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !profile?.tenant_id}
            className="w-full text-white py-2 rounded-lg bg-[#586ab1] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-gray-500">
          <p>This login is for report access only.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;