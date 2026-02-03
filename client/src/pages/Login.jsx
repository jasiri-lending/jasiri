import { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/userAuth";
import { useGlobalLoading } from "../hooks/LoadingContext";
import { useToast } from "../components/Toast.jsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Circular Code Input Component
const CircularCodeInput = ({ length = 6, value, onChange, disabled = false }) => {
  const inputsRef = useRef([]);
  const codeDigits = value.split('');

  const handleChange = (index, digit) => {
    if (!/^\d*$/.test(digit)) return;

    const newCode = [...codeDigits];
    newCode[index] = digit;
    const newCodeString = newCode.join('');

    onChange(newCodeString);

    // Auto focus next input
    if (digit && index < length - 1) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!codeDigits[index] && index > 0) {
        inputsRef.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').slice(0, length).replace(/\D/g, '');

    if (pasteData.length === length) {
      onChange(pasteData);
      inputsRef.current[length - 1].focus();
    }
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => (inputsRef.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={codeDigits[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          disabled={disabled}
          className="w-10 h-10 sm:w-12 sm:h-12 text-center text-xl sm:text-2xl font-semibold rounded-full border-2 border-gray-300 focus:border-[#586ab1] focus:outline-none focus:ring-2 focus:ring-[#586ab1] focus:ring-opacity-30 bg-white shadow-sm"
          style={{
            transition: 'all 0.2s ease',
            transform: codeDigits[index] ? 'scale(1.05)' : 'scale(1)'
          }}
        />
      ))}
    </div>
  );
};

// Timer Component
const CountdownTimer = ({ seconds, onResend, disabled = false }) => {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timerId = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="text-center mt-4">
      {timeLeft > 0 ? (
        <p className="text-sm text-gray-600">
          Request new code in <span className="font-semibold text-[#586ab1]">{formatTime(timeLeft)}</span>
        </p>
      ) : (
        <button
          onClick={() => {
            onResend();
            setTimeLeft(seconds);
          }}
          disabled={disabled}
          className="text-sm text-[#586ab1] hover:text-[#46528a] font-medium disabled:opacity-50"
        >
          Resend code
        </button>
      )}
    </div>
  );
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [userId, setUserId] = useState(null);
  const [step, setStep] = useState(1); // 1 = login, 2 = verify code, 3 = forgot password, 4 = reset password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { loading, setLoading } = useGlobalLoading();
  const { setUser, setProfile } = useAuth();
  const toast = useToast();
  const currentYear = new Date().getFullYear();

  // Step 1: login with email/password
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setUserId(data.userId);
      setStep(2);
      toast.success("Verification code sent to your email. Check your inbox!");
      console.log("Login successful. Verification code sent to email.");
    } catch (err) {
      console.error("Login error:", err);
      toast.error(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  // Resend verification code
  const handleResendCode = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      toast.success("New verification code sent to your email!");
      console.log("New verification code sent.");
    } catch (err) {
      console.error("Resend code error:", err);
      toast.error(err.message || "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  // In handleVerifyCode function, update the part after getting profile:
  const handleVerifyCode = async (e) => {
    e.preventDefault();

    if (!code || code.length !== 6) {
      toast.error("Enter the 6-digit verification code");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.error === "Code expired") {
          toast.error("Code expired. Request a new one.");
        } else if (data.error === "Invalid code") {
          toast.error("Incorrect verification code.");
        } else {
          toast.error(data.error || "Verification failed");
        }
        return;
      }

      if (!data.sessionToken) {
        throw new Error("Authentication failed — no session token");
      }

      // Store session
      localStorage.setItem("sessionToken", data.sessionToken);
      localStorage.setItem("userId", userId);
      localStorage.setItem("sessionExpiresAt", data.expiresAt);

      // Fetch profile with token
      const profileRes = await fetch(`${API_BASE_URL}/api/profile/${userId}`, {
        headers: {
          Authorization: `Bearer ${data.sessionToken}`,
        },
      });

      if (!profileRes.ok) {
        throw new Error("Failed to load user profile");
      }

      const profileResponse = await profileRes.json();

      if (!profileResponse?.id) {
        throw new Error("Invalid profile data");
      }

      // ✅ Store tenant if present
      if (profileResponse.tenant) {
        localStorage.setItem("tenant", JSON.stringify(profileResponse.tenant));
      }

      // Ensure consistent naming
      const normalizedProfile = {
        ...profileResponse,
        full_name: profileResponse.full_name || profileResponse.name || 'User',
        name: profileResponse.name || profileResponse.full_name || 'User'
        // Remove tenant from profile object since we store it separately
      };

      // Remove tenant from profile to avoid duplication
      delete normalizedProfile.tenant;

      // Create a user object for the auth context
      const userObj = {
        id: normalizedProfile.id,
        email: normalizedProfile.email,
        role: normalizedProfile.role
      };

     

      // Set both user and profile
      setUser(userObj);
      setProfile(normalizedProfile);

      // Store profile in localStorage
      localStorage.setItem("profile", JSON.stringify(normalizedProfile));

      toast.success("Login successful! Redirecting...");

      // Force a state update by waiting a tick
      await new Promise(resolve => setTimeout(resolve, 100));

      // Direct navigation

      if (["superadmin", "admin"].includes(normalizedProfile.role)) {
        console.log("Redirecting to /dashboard/admin");
        window.location.href = "/dashboard/admin";
      } else {
        window.location.href = "/dashboard";
      }

    } catch (err) {
      console.error("Verify code error:", err);
      toast.error(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  // Forgot password - request reset
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      toast.success(`Reset code sent to ${email}. Check your inbox!`);
      setStep(4); // Go to reset password step
    } catch (err) {
      console.error("Forgot password error:", err);
      toast.error(err.message || "Failed to process request");
    } finally {
      setLoading(false);
    }
  };

  // Verify reset code and set new password
  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (resetCode.length !== 6) {
      toast.error("Please enter a valid 6-digit reset code");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    // Check password strength
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

    if (!(hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar)) {
      toast.error("Password must include uppercase, lowercase, numbers, and special characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          resetCode,
          newPassword
        }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.error === "Reset code expired") {
          toast.error("Reset code has expired. Please request a new one.");
          setLoading(false);
          return;
        }
        throw new Error(data.error);
      }

      toast.success("Password reset successful! You can now login with your new password.");
      setTimeout(() => {
        setStep(1); // Go back to login
        setResetCode("");
        setNewPassword("");
        setConfirmPassword("");
      }, 3000);
      console.log("Password reset successful.");
    } catch (err) {
      console.error("Reset password error:", err);
      toast.error(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  // Resend reset code for password reset
  const handleResendResetCode = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/resend-reset-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      toast.success("New reset code sent to your email!");
      console.log("New reset code sent.");
    } catch (err) {
      console.error("Resend reset code error:", err);
      toast.error(err.message || "Failed to resend reset code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-lg overflow-hidden grid grid-cols-1 md:grid-cols-2">
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
              <img src="jasiri-white.png" alt="Jasiri Logo" className="object-contain w-48 h-48 lg:w-56 lg:h-56" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-center">Welcome Back</h1>
          </div>

          <div className="absolute bottom-4 left-4 text-blue-200 text-xs">Automation Moraans</div>
          <div className="absolute bottom-4 right-4 text-blue-200 text-xs">© {currentYear}</div>
        </div>

        {/* RIGHT SIDE */}
        <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
          {/* Mobile Logo - Shows only on mobile */}
          <div className="flex justify-center mb-6 md:hidden">
            <img src="jasiri-white.png" alt="Jasiri Logo" className="h-20 w-20 object-contain" />
          </div>

          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
              {step === 1 && "Welcome Back"}
              {step === 2 && "Verify Your Identity"}
              {step === 3 && "Reset Password"}
              {step === 4 && "Enter Reset Code"}
            </h2>
            <p className="text-sm sm:text-base text-gray-600">
              {step === 1 && "Sign in to continue to your dashboard"}
              {step === 2 && "Enter the 6-digit code sent to your email"}
              {step === 3 && "Enter your email to receive a reset code"}
              {step === 4 && "Enter the code and your new password"}
            </p>
          </div>

          <form onSubmit={
            step === 1 ? handleLogin :
              step === 2 ? handleVerifyCode :
                step === 3 ? handleForgotPassword :
                  handleResetPassword
          } className="space-y-5">

            {step === 1 ? (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#586ab1] focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#586ab1] focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="text-sm font-medium text-[#586ab1] hover:text-[#46528a]"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>
            ) : step === 2 ? (
              <div className="space-y-6">
                <div>
                  <p className="text-center text-sm text-gray-600 mb-6">
                    We've sent a 6-digit verification code to:<br />
                    <span className="font-semibold text-gray-800">{email}</span>
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-4 text-center">
                        Enter Verification Code
                      </label>
                      <CircularCodeInput
                        length={6}
                        value={code}
                        onChange={setCode}
                        disabled={loading}
                      />
                      <CountdownTimer
                        seconds={600} // 10 minutes
                        onResend={handleResendCode}
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : step === 3 ? (
              <div className="space-y-5">
                <div>
                 
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#586ab1] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="text-center text-sm text-gray-600 mb-6">
                    Reset code sent to:<br />
                    <span className="font-semibold text-gray-800">{email}</span>
                  </p>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-4 text-center">
                        Enter 6-Digit Reset Code
                      </label>
                      <CircularCodeInput
                        length={6}
                        value={resetCode}
                        onChange={setResetCode}
                        disabled={loading}
                      />
                      <CountdownTimer
                        seconds={900} // 15 minutes
                        onResend={handleResendResetCode}
                        disabled={loading}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <input
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#586ab1] focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showNewPassword ? (
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Must be at least 8 characters with uppercase, lowercase, numbers, and special characters
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#586ab1] focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showConfirmPassword ? (
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 space-y-3">
              <button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: "#586ab1" }}
                className="w-full text-white py-3 rounded-lg font-medium disabled:opacity-50 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <span>
                    {step === 1 ? "Sign In" :
                      step === 2 ? "Verify & Continue" :
                        step === 3 ? "Send Reset Code" :
                          "Reset Password"}
                  </span>
                )}
              </button>

              {(step === 2 || step === 3 || step === 4) && (
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setCode("");
                    setResetCode("");
                  }}
                  className="w-full text-gray-600 py-3 rounded-lg font-medium border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                >
                  ← Back to Login
                </button>
              )}
            </div>
          </form>

        

          <div className="mt-6 text-center text-xs text-gray-500">
            © {currentYear} Jasiri Lending Software. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}