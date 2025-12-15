import { useState } from "react";
import { API_BASE_URL } from "../../../../config.js";
import { useAuth } from "../../../hooks/userAuth.js";

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
      console.log("🌐 API URL:", `${API_BASE_URL}/api/report-users/create`);

      const res = await fetch(`${API_BASE_URL}/api/report-users/create`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
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
        setError(`Cannot connect to server at ${API_BASE_URL}. Please check if the server is running.`);
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
        <h2 className="text-2xl font-bold mb-4">Create Report Access User</h2>
        <p className="text-center text-gray-600">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow">
      <h2 className="text-2xl font-bold mb-4">Create Report Access User</h2>

      {/* Debug info - only shows API URL */}
      {import.meta.env.DEV && (
        <div className="mb-4 p-2 bg-gray-100 text-xs rounded">
          <p><strong>API:</strong> {API_BASE_URL}</p>
          <p><strong>Tenant ID:</strong> {profile?.tenant_id}</p>
        </div>
      )}

      {!showPassword ? (
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">Email</label>
            <input
              type="email"
              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>

          <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
            ℹ️ A secure password will be automatically generated
          </p>

          {!profile?.tenant_id && (
            <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
              ⚠️ Tenant information not available
            </p>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !profile?.tenant_id}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating User..." : "Create User"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-semibold mb-2">
              ✅ {message}
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800 font-medium mb-2">
              ⚠️ Important: Save this password now!
            </p>
            <p className="text-xs text-yellow-700">
              This password will not be shown again for security reasons.
            </p>
          </div>

          <div>
            <label className="block mb-1 font-medium">Generated Password</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={generatedPassword}
                className="flex-1 border p-2 rounded bg-gray-50 font-mono text-sm"
              />
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Email:</strong> {email || "(Email cleared)"}
            </p>
          </div>

          <button
            onClick={handleClosePasswordDisplay}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Done - Create Another User
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminCreateReportUser;