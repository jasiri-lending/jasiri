import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast.jsx";
import Spinner from "../components/Spinner";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PasswordSetup() {
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [verifying, setVerifying] = useState(true);
    const navigate = useNavigate();
    const toast = useToast();

    useEffect(() => {
        // 1. Get email and code from URL query parameters (not fragment!)
        const params = new URLSearchParams(window.location.search);
        const emailParam = params.get("email");
        const codeParam = params.get("code");

        if (!emailParam || !codeParam) {
            setError("Invalid invitation link. Please make sure you clicked the full link in your email.");
            setVerifying(false);
            return;
        }

        // 2. Setup page is now instant - no session required
        setVerifying(false);
    }, []);

    const handleSetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters");
            setLoading(false);
            return;
        }

        // Strength check matching Login.jsx
        const hasUpperCase = /[A-Z]/.test(newPassword);
        const hasLowerCase = /[a-z]/.test(newPassword);
        const hasNumbers = /\d/.test(newPassword);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

        if (!(hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar)) {
            setError("Password must include uppercase, lowercase, numbers, and special characters");
            setLoading(false);
            return;
        }

        try {
            const params = new URLSearchParams(window.location.search);
            const email = params.get("email");
            const setupCode = params.get("code");

            // Call our new custom session-less setup API
            const response = await fetch(`${API_BASE_URL}/api/setup-invite-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    setupCode,
                    newPassword
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Failed to set password");
            }

            setSuccess(true);
            toast.success("Password set successfully! You can now log in.");

            setTimeout(() => {
                navigate("/login", { replace: true });
            }, 3000);
        } catch (err) {
            console.error("Set password error:", err);
            setError(err.message || "Failed to set password. Link may have expired.");
        } finally {
            setLoading(false);
        }
    };

    if (verifying) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Spinner text="Verifying invitation..." />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
                
                {/* LEFT SIDE - Desktop Only */}
                <div
                    className="hidden md:flex flex-col justify-center items-center p-8 lg:p-10 text-white relative overflow-hidden"
                    style={{ background: "linear-gradient(135deg, #02880bff 0%, #0214d7ff 100%)" }}
                >
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-full"></div>
                        <div className="absolute bottom-10 right-10 w-16 h-16 bg-white rounded-full"></div>
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="rounded-2xl flex items-center justify-center overflow-hidden mb-6">
                            <img src="/jasiri-white.png" alt="Jasiri Logo" className="object-contain w-64 h-64 lg:w-72 lg:h-72" />
                        </div>
                        
                    </div>

                    <div className="absolute bottom-4 left-4 text-blue-200 text-xs">Automation Moraans</div>
                    <div className="absolute bottom-4 right-4 text-blue-200 text-xs">© {new Date().getFullYear()}</div>
                </div>

                {/* RIGHT SIDE */}
                <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                    {/* Mobile Logo */}
                    <div className="flex justify-center mb-6 md:hidden">
                        <img src="/jasirif.png" alt="Jasiri Logo" className="h-24 w-auto object-contain" />
                    </div>

                    <div className="text-center mb-8">
                        <h2 className="text-2xl sm:text-3xl  text-gray-800 mb-2">Create Password</h2>
                    </div>

                    {error && (
                        <div className="mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded text-sm flex items-start shadow-sm">
                            <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="mb-6 bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded text-sm flex items-start shadow-sm">
                            <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>Password set successfully! Redirecting to login...</span>
                        </div>
                    )}

                    <form onSubmit={handleSetPassword} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">New Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-[18px] w-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full pl-[36px] pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#586ab1] focus:border-transparent transition-all text-sm"
                                    placeholder="Enter your new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? (
                                        <EyeSlashIcon className="h-5 w-5" />
                                    ) : (
                                        <EyeIcon className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">Confirm New Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-[18px] w-[18px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full pl-[36px] pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#586ab1] focus:border-transparent transition-all text-sm"
                                    placeholder="Confirm your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    {showConfirmPassword ? (
                                        <EyeSlashIcon className="h-5 w-5" />
                                    ) : (
                                        <EyeIcon className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading || success || verifying}
                                style={{ backgroundColor: "#586ab1" }}
                                className="w-full text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving Password...
                                    </span>
                                ) : (
                                    "Set Password & Activate"
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8">
                        <p className="text-xs text-center text-gray-500">
                            Must be at least 8 characters with uppercase, lowercase, numbers, and special characters.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
