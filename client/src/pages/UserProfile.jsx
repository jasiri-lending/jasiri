// src/pages/UserProfile.jsx - REDESIGNED PREMIUM VERSION
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCircle, ArrowLeft, Camera, Eye, EyeOff,
  CheckCircle, Upload, Shield, Building, Mail,
  Phone, MapPin, Users, Key, Save, X, RefreshCw,
  Clock, Calendar, Check, AlertCircle, Lock, Bell
} from "lucide-react";
import { useAuth } from "../hooks/userAuth";
import { apiFetch } from "../utils/api";
import { useToast } from "../components/Toast.jsx";
import Spinner from "../components/Spinner.jsx";

// Reusable Circular Code Input Component
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
    <div className="flex justify-center gap-3" onPaste={handlePaste}>
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
          className="w-12 h-12 text-center text-xl font-semibold rounded-2xl
            border-2 border-slate-200 focus:border-[#586ab1]
            focus:outline-none focus:ring-4 focus:ring-[#586ab1]/10
            bg-white shadow-sm transition-all duration-200"
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
    <div className="text-center mt-6">
      {timeLeft > 0 ? (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <Clock className="h-4 w-4" />
          <span>
            Code expires in <span className="font-bold text-slate-700">{formatTime(timeLeft)}</span>
          </span>
        </div>
      ) : (
        <button
          onClick={() => {
            onResend();
            setTimeLeft(seconds);
          }}
          disabled={disabled}
          className="text-sm text-[#586ab1] hover:text-[#4a5a96] font-bold
            disabled:opacity-50 flex items-center gap-2 mx-auto transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Resend verification code
        </button>
      )}
    </div>
  );
};

export default function UserProfile() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('profile');

  // Password change states
  const [passwordFlow, setPasswordFlow] = useState('initial');
  const [passwordCode, setPasswordCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Upload states
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const roleDisplayNames = {
    superadmin: "Super Administrator",
    admin: "Administrator",
    regional_manager: "Regional Manager",
    branch_manager: "Branch Manager",
    relationship_officer: "Relationship Officer",
    credit_analyst_officer: "Credit Analyst",
    customer_service_officer: "Customer Service",
  };

  const getRoleDisplayName = (role) => roleDisplayNames[role] || role;

  useEffect(() => {
    if (profile?.avatar_url) {
      setPreviewUrl(`${profile.avatar_url}?t=${Date.now()}`);
    } else {
      setPreviewUrl(null);
    }
  }, [profile, avatarKey]);

  const handleAvatarUpload = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      if (!file.type.match('image/jpeg|image/png|image/gif|image/webp')) {
        toast.error('Please upload a valid image file');
        return;
      }

      setUploading(true);
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target.result);
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append('avatar', file);

      const response = await apiFetch(`/api/upload-avatar`, {
        method: "POST",
        body: formData,
        headers: {}
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Upload failed');

      await refreshProfile();
      setAvatarKey(Date.now());
      toast.success('Profile photo updated successfully!');
    } catch (error) {
      toast.error(error.message);
      setPreviewUrl(profile?.avatar_url ? `${profile.avatar_url}?t=${Date.now()}` : null);
    } finally {
      setUploading(false);
    }
  };

  const requestPasswordChangeCode = async () => {
    setChangingPassword(true);
    try {
      const response = await apiFetch(`/api/request-password-change-code`, {
        method: "POST",
        body: JSON.stringify({ userId: profile.id, email: profile.email }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error);
      setPasswordFlow('requested');
      toast.success("Verification code sent to your email!");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const resendPasswordChangeCode = async () => {
    await requestPasswordChangeCode();
  };

  const verifyCodeAndChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      const response = await apiFetch(`/api/verify-password-change-code`, {
        method: "POST",
        body: JSON.stringify({
          userId: profile.id,
          code: passwordCode,
          newPassword: newPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error);
      toast.success("Password changed successfully!");
      setPasswordFlow('initial');
      setPasswordCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!confirm("Remove profile photo?")) return;
    setLoading(true);
    try {
      const response = await apiFetch(`/api/delete-avatar`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error);
      setPreviewUrl(null);
      await refreshProfile();
      toast.success("Photo removed");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Spinner message="Synchronizing your account profile..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header Section */}
      <div className="bg-muted border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <button
                onClick={() => navigate(-1)}
                className="p-3 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all border border-slate-200"
              >
                <ArrowLeft className="h-3 w-3" />
              </button>
              <div>
                <h1 className="text-sm text-slate-600 ">Account Settings</h1>
                <p className="text-slate-500 text-xs mt-0.5">Manage your personal information and security</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-[#586ab1]/5 border border-[#586ab1]/10 flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#586ab1]" />
                <span className="text-sm font-semibold text-[#586ab1]">
                  {getRoleDisplayName(profile.role)}
                </span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-sm  text-emerald-700">Account Active</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('profile')}
              className={`pb-4 text-sm font-semibold transition-all relative ${activeTab === 'profile'
                  ? 'text-[#586ab1]'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <div className="flex items-center gap-2 px-1">
                <Users className="h-4 w-4" />
                Profile Details
              </div>
              {activeTab === 'profile' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#586ab1] rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`pb-4 text-sm font-semibold transition-all relative ${activeTab === 'security'
                  ? 'text-[#586ab1]'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <div className="flex items-center gap-2 px-1">
                <Lock className="h-4 w-4" />
                Security & Password
              </div>
              {activeTab === 'security' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#586ab1] rounded-full" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Avatar & Summary Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="h-24 bg-gradient-to-r from-[#586ab1] to-[#4a5a96]"></div>
              <div className="px-6 pb-8">
                <div className="-mt-12 flex justify-center">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden bg-slate-100 shadow-md">
                      {previewUrl ? (
                        <img
                          key={avatarKey}
                          src={previewUrl}
                          alt={profile.full_name}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const parent = e.target.parentElement;
                            parent.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-slate-50"><UserCircle class="h-16 w-16 text-slate-300" /></div>`;
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-50">
                          <UserCircle className="h-16 w-16 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 rounded-full cursor-pointer transition-all duration-300 backdrop-blur-[2px]">
                      <Camera className="h-6 w-6 text-white mb-1" />
                      <span className="text-[10px]  text-white uppercase tracking-wider">Change Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-5 text-center">
                  <h2 className="text-xl  text-slate-600">{profile.full_name}</h2>
                  <p className="text-slate-500 text-sm">{profile.email}</p>
                  
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                      ID: {profile.id?.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#586ab1] text-white rounded-xl hover:bg-[#4a5a96] transition-all font-semibold text-sm disabled:opacity-50 shadow-sm"
                  >
                    {uploading ? (
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploading ? 'Uploading...' : 'Update Photo'}
                  </button>
                  {previewUrl && (
                    <button
                      onClick={handleRemoveAvatar}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-all font-semibold text-sm"
                    >
                      <X className="h-4 w-4" />
                      Remove Photo
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-8">
            {activeTab === 'profile' ? (
              <div className="space-y-6">
                {/* Personal Information */}
                <div className="bg-green-50 rounded-2xl border border-slate-200 p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 rounded-xl bg-slate-50 text-[#586ab1]">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg  text-slate-600">Personal Information</h3>
                      <p className="text-slate-500 text-sm">Your identity and contact details</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 ">
                        {profile.full_name}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 ">
                        {profile.email}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Phone</label>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 ">
                        {profile.phone || 'Not Shared'}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Contact</label>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 ">
                        {profile.company_phone || '--'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Work Information */}
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 rounded-xl bg-slate-50 text-emerald-600">
                      <Building className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg  text-slate-600">Work & Organization</h3>
                      <p className="text-slate-500 text-sm">Your professional placement</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Region</label>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 font-italic">
                        {profile.region || 'Assigned Globally'}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Branch</label>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 font-italic">
                        {profile.branch || 'Headquarters'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Activity */}
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                  <h3 className="text-sm  text-slate-600 ">Recent Activity</h3>
                  <div className="space-y-5">
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm  text-slate-600">Account Created</p>
                          <p className="text-xs text-slate-500">System onboarding date</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-slate-600">{formatDate(profile.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                          <Clock className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm  text-slate-600">Last Login</p>
                          <p className="text-xs text-slate-500">Most recent session active</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-slate-600">{profile.last_login ? formatDate(profile.last_login) : 'Never'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 rounded-xl bg-slate-50 text-[#586ab1]">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg  text-slate-600">Security & Password</h3>
                      <p className="text-slate-500 text-sm">Update your authentication credentials</p>
                    </div>
                  </div>

                  {passwordFlow === 'initial' ? (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="h-20 w-20 rounded-full bg-white flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Lock className="h-10 w-10 text-[#586ab1]" />
                      </div>
                      <h4 className="text-lg  text-slate-600 mb-2">Change your password</h4>
                      <p className="text-slate-500 text-sm mb-8 max-w-sm mx-auto">
                        We'll send a 6-digit verification code to your registered email to confirm this request.
                      </p>
                      <button
                        onClick={requestPasswordChangeCode}
                        disabled={changingPassword}
                        className="px-8 py-3 bg-[#586ab1] text-white rounded-xl hover:bg-[#4a5a96] transition-all font-bold shadow-md shadow-[#586ab1]/20 disabled:opacity-50"
                      >
                        {changingPassword ? 'Initiating...' : 'Request Verification Code'}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={verifyCodeAndChangePassword} className="space-y-8">
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                            <Check className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Step 1: Verify Code</p>
                            <p className="text-sm  text-slate-600">Check your email at {profile.email}</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <CircularCodeInput
                            length={6}
                            value={passwordCode}
                            onChange={setPasswordCode}
                            disabled={changingPassword}
                          />
                          <CountdownTimer
                            seconds={600}
                            onResend={resendPasswordChangeCode}
                            disabled={changingPassword}
                          />
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-xs  text-slate-600 ">New Password</label>
                          <div className="relative">
                            <input
                              type={showNewPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              required
                              className="w-full pl-5 pr-12 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#586ab1]/20 focus:border-[#586ab1] outline-none transition-all font-semibold"
                              placeholder="Create strong password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                             <p className="text-sm text-emerald-600  flex items-center gap-2">
                               <AlertCircle className="h-3 w-3" />
                               Password must be 8+ chars with uppercase, lowercase, numbers & symbols.
                             </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs  text-slate-600 ">Confirm New Password</label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              required
                              className="w-full pl-5 pr-12 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#586ab1]/20 focus:border-[#586ab1] outline-none transition-all font-semibold"
                              placeholder="Repeat new password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <button
                          type="submit"
                          disabled={changingPassword || passwordCode.length !== 6}
                          className="flex-1 py-4 bg-[#586ab1] text-white rounded-xl hover:bg-[#4a5a96] transition-all font-bold shadow-lg shadow-[#586ab1]/20 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {changingPassword ? (
                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          ) : (
                            <Save className="h-5 w-5" />
                          )}
                          Update Security Credentials
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordFlow('initial');
                            setPasswordCode("");
                            setNewPassword("");
                            setConfirmPassword("");
                          }}
                          className="px-8 py-4 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}