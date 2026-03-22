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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <div className="text-center mb-8">
                    <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Set Your Password</h2>
                    <p className="text-gray-500 mt-2 text-sm">Welcome to Jasiri! Please create a secure password to activate your account.</p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Password set successfully! Redirecting to login...
                    </div>
                )}

                <form onSubmit={handleSetPassword} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all pr-12"
                                placeholder="Min 8 characters"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all pr-12"
                                placeholder="Re-enter password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showConfirmPassword ? (
                                    <EyeSlashIcon className="h-5 w-5" />
                                ) : (
                                    <EyeIcon className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || success || verifying}
                        style={{ backgroundColor: "#586ab1" }}
                        className="w-full text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50"
                    >
                        {loading ? "Saving..." : "Set Password & Activate"}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-xs text-gray-400">
                        Password must include uppercase, lowercase, numbers, and special characters.
                    </p>
                </div>
            </div>
        </div>
    );
}
