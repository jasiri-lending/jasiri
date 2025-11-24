// src/pages/Login.jsx
import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/userAuth";
import { useGlobalLoading } from "../hooks/LoadingContext";


export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const { loading, setLoading } = useGlobalLoading(); 
  const navigate = useNavigate();
  const { setUser, setProfile } = useAuth();

  const currentYear = new Date().getFullYear();

 const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Authenticate user
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;
      if (!authData?.user) throw new Error("Authentication failed");

      const userId = authData.user.id;

      // Fetch user details
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, full_name, email, role")
        .eq("id", userId)
        .maybeSingle();
      if (userError) throw userError;
      if (!userData) throw new Error("No user data found");

      // Fetch profile info (branch/region)
      const { data: basicProfile, error: basicError } = await supabase
        .from("profiles")
        .select("branch_id, region_id")
        .eq("id", userId)
        .single();
      if (basicError) throw basicError;

      let branchName = "N/A";
      let regionName = "N/A";

      if (basicProfile?.branch_id) {
        const { data: branchData } = await supabase
          .from("branches")
          .select("name")
          .eq("id", basicProfile.branch_id)
          .single();
        branchName = branchData?.name || "N/A";
      }

      if (basicProfile?.region_id) {
        const { data: regionData } = await supabase
          .from("regions")
          .select("name")
          .eq("id", basicProfile.region_id)
          .single();
        regionName = regionData?.name || "N/A";
      }

      const profileData = {
        id: userData.id,
        name: userData.full_name,
        email: userData.email,
        role: userData.role,
        branch_id: basicProfile?.branch_id || null,
        region_id: basicProfile?.region_id || null,
        branch: branchName,
        region: regionName,
      };

      setUser(authData.user);
      setProfile(profileData);

      // Redirect based on role
      switch (userData.role) {
        case "relationship_officer":
          navigate("/dashboard");
          break;
        case "admin":
          navigate("/dashboard/admin");
          break;
        default:
          navigate("/dashboard");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-lg overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* LEFT SIDE — Jasiri Branding */}
        <div
          className="flex flex-col justify-center items-center p-10 text-white relative"
          style={{
            background: "linear-gradient(135deg, #02880bff 0%, #0214d7ff 100%)",
          }}
        >
          {/* Decorative background */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-full"></div>
            <div className="absolute bottom-10 right-10 w-16 h-16 bg-white rounded-full"></div>
          </div>

          <div className="relative z-10 mb-6 flex flex-col items-center">
            {/* Jasiri Logo Image */}
            <div className="  rounded-2xl  flex items-center justify-center  overflow-hidden">
              <img
                src="jasiri-white.png"   // <-- replace this with your logo path
                alt="Jasiri Logo"
                className="object-contain w-full h-full"
              />
            </div>
          </div>

          <div className="absolute bottom-4 left-4 text-blue-200 text-xs">Automation Moraans</div>
          <div className="absolute bottom-4 right-4 text-blue-200 text-xs">
            © {currentYear}
          </div>
        </div>

        {/* RIGHT SIDE — Login Form */}
        <div className="p-10 flex flex-col justify-center">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Welcome Back</h2>
            <p className="text-gray-600">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#586ab1] transition-all duration-200"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#586ab1] transition-all duration-200"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-8 text-white py-3 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 hover:shadow-lg transform hover:-translate-y-0.5"
              style={{ backgroundColor: "#586ab1" }}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 
                      1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing In...
                </div>
              ) : (
                "Sign In"
              )}
            </button>

            <div className="mt-6 text-center">
              <a
                href="#"
                className="text-sm font-medium transition-colors duration-200"
                style={{ color: "#586ab1" }}
              >
                Forgot Password?
              </a>
            </div>
          </form>

          <div className="mt-8 text-center text-xs text-gray-500">
            © {currentYear} Jasiri Lending Software. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}