import { useState } from "react";
import { API_BASE_URL } from "../../../config";
import { useAuth } from "../../hooks/userAuth";

const LoginModal = ({ isOpen, onClose, onSuccess }) => {
  const { profile } = useAuth(); // Get logged-in user's profile
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
      const res = await fetch(`${API_BASE_URL}/api/checkReportUser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          tenant_id: profile.tenant_id, // Send logged-in user's tenant_id
        }),
      });

      let data;
      const contentType = res.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error("❌ Non-JSON response:", text);
        throw new Error("Server returned invalid JSON");
      }

      console.log("🔵 Login response:", res.status, data);

      if (!res.ok) {
        setError(data?.error || "Invalid email or password");
        return;
      }

      // ✅ Success - store report user info
      localStorage.setItem("reportUser", JSON.stringify({
        userId: data.userId,
        email: data.email,
        tenant_id: data.tenant_id,
        loggedAt: new Date().toISOString()
      }));
      
      setEmail("");
      setPassword("");
      onSuccess();
      onClose();

    } catch (err) {
      console.error("🔴 Login error:", err);
      setError(
        err.message === "Failed to fetch"
          ? "Server unreachable. Please try again later."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-lg w-96 p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-6 text-center">Report Login</h2>

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
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#586ab1]"
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
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#586ab1]"
            />
          </div>

          {!profile?.tenant_id && (
            <p className="text-amber-600 text-sm bg-amber-50 p-2 rounded">
              ⚠️ Loading session...
            </p>
          )}

          {error && (
            <p className="text-red-600 text-sm bg-red-50 p-2 rounded">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !profile?.tenant_id}
            className="w-full text-white py-2 rounded-lg bg-[#586ab1] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;