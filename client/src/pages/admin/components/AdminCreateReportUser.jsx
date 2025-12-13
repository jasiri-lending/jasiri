import { useState } from "react";
import { API_BASE_URL } from "../../../../config.js";

const AdminCreateReportUser = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const res = await fetch(`${API_BASE_URL}/api/report-users/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setMessage("User created successfully!");
      setEmail("");
      setPassword("");
    } else {
      setMessage(data.error || "Failed to create user");
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow">
      <h2 className="text-2xl font-bold mb-4">Create Report Access User</h2>

      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Email</label>
          <input
            type="email"
            className="w-full border p-2 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Password</label>
          <input
            type="password"
            className="w-full border p-2 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {message && (
          <p className="text-sm text-center text-blue-600">{message}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          {loading ? "Saving..." : "Create User"}
        </button>
      </form>
    </div>
  );
};

export default AdminCreateReportUser;
