// src/pages/UserProfile.jsx - HIGH-FIDELITY BRANDED VERSION
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
          className="w-12 h-14 text-center text-xl font-medium rounded-2xl
            border border-slate-200 focus:border-primary
            focus:outline-none focus:ring-4 focus:ring-primary/5
            bg-neutral transition-all duration-200"
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
        <div className="flex items-center justify-center gap-2 text-[13px] text-slate-500 font-medium">
          <Clock className="h-4 w-4" strokeWidth={1.5} />
          <span>
            Code expires in <span className="text-primary">{formatTime(timeLeft)}</span>
          </span>
        </div>
      ) : (
        <button
          onClick={() => {
            onResend();
            setTimeLeft(seconds);
          }}
          disabled={disabled}
          className="text-[13px] text-primary hover:text-brand-btn font-medium
            disabled:opacity-50 flex items-center gap-2 mx-auto transition-colors"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
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
          email: profile.email,
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Spinner message="Syncing secure profile..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* High-Fidelity Branded Header */}
      <div className="bg-primary pt-16 pb-32 px-6 relative overflow-hidden">
        {/* Background Decorative Pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white rounded-full -mr-64 -mt-64 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent rounded-full -ml-40 -mb-40 blur-3xl"></div>
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate(-1)}
                className="w-9 h-19 flex items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all backdrop-blur-md border border-white/10"
              >
                <ArrowLeft className="h-3 w-3" strokeWidth={1.5} />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-center text-white">Profile</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-white/5 p-2 pr-4 rounded-2xl border border-white/10 backdrop-blur-sm">
               <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10">
                  {previewUrl ? (
                    <img src={previewUrl} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/10 flex items-center justify-center">
                       <UserCircle className="w-6 h-6 text-white/40" strokeWidth={1.5} />
                    </div>
                  )}
               </div>
               <div className="flex flex-col">
                  <span className="text-[13px] text-white font-medium leading-none">{profile.full_name}</span>
                  <span className="text-[11px] text-white/40 mt-1 uppercase tracking-wider">{getRoleDisplayName(profile.role)}</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-6 -mt-16 relative z-20 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Navigation & Summary Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl shadow-primary/5 p-2">
               <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] transition-all duration-300 ${
                  activeTab === 'profile'
                    ? 'bg-primary text-white shadow-lg shadow-primary/20 font-medium'
                    : 'text-slate-500 hover:bg-brand-surface hover:text-primary font-medium'
                }`}
              >
                <Users className="h-4 w-4" strokeWidth={1.5} />
                Profile & Status
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] transition-all duration-300 mt-1 ${
                  activeTab === 'security'
                    ? 'bg-primary text-white shadow-lg shadow-primary/20 font-medium'
                    : 'text-slate-500 hover:bg-brand-surface hover:text-primary font-medium'
                }`}
              >
                <Shield className="h-4 w-4" strokeWidth={1.5} />
                Authentication
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xl shadow-primary/5 p-6 text-center">
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="relative inline-block mb-4 group cursor-pointer"
               >
                  <div className="w-20 h-20 rounded-full border-2 border-brand-surface p-1 group-hover:border-primary transition-all duration-300">
                    <div className="w-full h-full rounded-full overflow-hidden bg-slate-50 relative">
                      {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" /> : <UserCircle className="w-full h-full text-slate-200" />}
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Camera className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-full">
                       <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
               </button>
               <h3 className="text-[15px] font-medium text-primary">{profile.full_name}</h3>
               <p className="text-[13px] text-slate-400 mt-1">{getRoleDisplayName(profile.role)}</p>
            </div>
          </div>

          {/* Detailed Section Content */}
          <div className="lg:col-span-9">
            {activeTab === 'profile' ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Personal Section Card */}
                <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-primary/5 overflow-hidden">
                   <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-brand-surface flex items-center justify-center text-primary">
                            <UserCircle className="h-5 w-5" strokeWidth={1.5} />
                         </div>
                         <div>
                            <h2 className="text-[16px] font-medium text-primary">Personal Credentials</h2>
                            <p className="text-[12px] text-slate-400">Master identity and contact details</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {previewUrl && (
                          <button 
                            onClick={handleRemoveAvatar}
                            disabled={loading}
                            className="text-[12px] text-red-500 font-medium hover:underline flex items-center gap-1.5 disabled:opacity-50"
                          >
                             <X className="h-3.5 w-3.5" />
                             Remove Photo
                          </button>
                        )}
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[12px] text-brand-btn font-medium hover:underline flex items-center gap-1.5"
                        >
                           <Camera className="h-3.5 w-3.5" />
                           {previewUrl ? 'Change Photo' : 'Upload Photo'}
                        </button>
                      </div>
                      <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
                   </div>
                   <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                      <div className="space-y-1.5">
                         <label className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Legal Full Name</label>
                         <p className="text-[15px] text-primary font-medium">{profile.full_name}</p>
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Primary Email</label>
                         <div className="flex items-center gap-2">
                            <p className="text-[15px] text-primary font-medium">{profile.email}</p>
                            <Mail className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                         </div>
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Primary Contact</label>
                         <p className="text-[15px] text-primary font-medium">{profile.phone || 'Registry not shared'}</p>
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Work Reference</label>
                         <p className="text-[15px] text-primary font-medium">{profile.company_phone || '--'}</p>
                      </div>
                   </div>
                </div>

                {/* Work Section Card */}
                <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-primary/5 overflow-hidden">
                   <div className="px-8 py-6 border-b border-slate-50 flex items-center gap-4 bg-slate-50/30">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                         <Building className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div>
                         <h2 className="text-[16px] font-medium text-primary">Professional Placement</h2>
                         <p className="text-[12px] text-slate-400">Organizational hierarchy and role</p>
                      </div>
                   </div>
                   <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="flex gap-4">
                         <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shrink-0">
                            <MapPin className="h-4 w-4" strokeWidth={1.5} />
                         </div>
                         <div className="space-y-0.5">
                            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Assigned Region</span>
                            <p className="text-[14px] text-primary font-medium">{profile.region || 'Global Operations'}</p>
                         </div>
                      </div>
                      <div className="flex gap-4">
                         <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 shrink-0">
                            <Building className="h-4 w-4" strokeWidth={1.5} />
                         </div>
                         <div className="space-y-0.5">
                            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Branch Office</span>
                            <p className="text-[14px] text-primary font-medium">{profile.branch || 'Corporate Headquarters'}</p>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Activity Log Card */}
                <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-primary/5 p-8">
                   <div className="flex items-center justify-between mb-8">
                      <h2 className="text-[15px] font-medium text-primary flex items-center gap-3">
                         <Clock className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
                         System Lifecycle
                      </h2>
                   </div>
                   <div className="space-y-6">
                      <div className="flex items-center justify-between group">
                         <div className="flex items-center gap-4">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary group-hover:scale-150 transition-transform"></div>
                            <span className="text-[13px] text-slate-500 font-medium">Registry Created</span>
                         </div>
                         <span className="text-[13px] text-primary font-medium">{formatDate(profile.created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between group">
                         <div className="flex items-center gap-4">
                            <div className="h-1.5 w-1.5 rounded-full bg-accent group-hover:scale-150 transition-transform"></div>
                            <span className="text-[13px] text-slate-500 font-medium">Last Authentication</span>
                         </div>
                         <span className="text-[13px] text-primary font-medium">{profile.last_login ? formatDate(profile.last_login) : 'None Recorded'}</span>
                      </div>
                   </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Security Content */}
                <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-primary/5 overflow-hidden">
                   <div className="px-8 py-6 border-b border-slate-50 flex items-center gap-4 bg-slate-50/30">
                      <div className="w-10 h-10 rounded-xl bg-highlight/10 flex items-center justify-center text-highlight">
                         <Key className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div>
                         <h2 className="text-[16px] font-medium text-primary">Login & Access Security</h2>
                         <p className="text-[12px] text-slate-400">Update credentials and secure your account</p>
                      </div>
                   </div>
                   
                   <div className="p-8">
                      {passwordFlow === 'initial' ? (
                        <div className="py-10 flex flex-col items-center justify-center">
                           <div className="w-16 h-16 rounded-full bg-brand-surface flex items-center justify-center mb-6">
                              <Shield className="h-8 w-8 text-primary" strokeWidth={1} />
                           </div>
                           <h3 className="text-[17px] font-medium text-primary">Credentials Management</h3>
                           <p className="text-[13px] text-slate-500 mt-2 text-center max-w-sm font-medium">
                              For your security, we will send a unique 6-digit verification code to your email to authorize this credential change.
                           </p>
                           <button
                             onClick={requestPasswordChangeCode}
                             disabled={changingPassword}
                             className="mt-8 px-8 py-3 bg-brand-btn text-white rounded-2xl text-[14px] font-medium hover:bg-primary transition-all shadow-lg shadow-brand-btn/20 disabled:opacity-50"
                           >
                             {changingPassword ? 'Synchronizing...' : 'Request Verification Code'}
                           </button>
                        </div>
                      ) : (
                        <form onSubmit={verifyCodeAndChangePassword} className="space-y-10 max-w-xl mx-auto">
                           <div className="text-center space-y-2">
                              <div className="inline-flex h-10 w-10 rounded-full bg-accent/10 text-accent items-center justify-center mb-2">
                                 <Mail className="h-5 w-5" strokeWidth={1.5} />
                              </div>
                              <h4 className="text-[15px] font-medium text-primary">Verify Identity</h4>
                              <p className="text-[12px] text-slate-400 font-medium">Check your inbox for the code sent to {profile.email}</p>
                           </div>

                           <div className="space-y-6">
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

                           <div className="space-y-5 pt-4 border-t border-slate-50">
                              <div className="space-y-2">
                                 <label className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">New Secure Password</label>
                                 <div className="relative">
                                    <input
                                      type={showNewPassword ? "text" : "password"}
                                      value={newPassword}
                                      onChange={(e) => setNewPassword(e.target.value)}
                                      required
                                      className="w-full px-5 py-3 bg-neutral/30 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-surface focus:border-brand-secondary outline-none transition-all text-[14px] font-medium text-primary"
                                      placeholder="••••••••"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowNewPassword(!showNewPassword)}
                                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                    >
                                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                 </div>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Repeat Password</label>
                                 <div className="relative">
                                    <input
                                      type={showConfirmPassword ? "text" : "password"}
                                      value={confirmPassword}
                                      onChange={(e) => setConfirmPassword(e.target.value)}
                                      required
                                      className="w-full px-5 py-3 bg-neutral/30 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-brand-surface focus:border-brand-secondary outline-none transition-all text-[14px] font-medium text-primary"
                                      placeholder="••••••••"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                    >
                                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                 </div>
                              </div>
                           </div>

                           <div className="flex items-center justify-end gap-4 pt-6">
                              <button
                                type="button"
                                onClick={() => {
                                  setPasswordFlow('initial');
                                  setPasswordCode("");
                                  setNewPassword("");
                                  setConfirmPassword("");
                                }}
                                className="px-6 py-3 text-slate-500 text-[14px] font-medium hover:text-primary transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={changingPassword || passwordCode.length !== 6}
                                className="px-10 py-3 bg-primary text-white rounded-2xl text-[14px] font-medium hover:bg-brand-btn transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
                              >
                                {changingPassword ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="h-4 w-4" strokeWidth={1.5} />}
                                Secure Account
                              </button>
                           </div>
                        </form>
                      )}
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}