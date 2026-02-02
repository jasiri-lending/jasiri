// src/pages/UserProfile.jsx - CORRECTED VERSION
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  UserCircle, ArrowLeft, Camera, Eye, EyeOff, 
  CheckCircle, Upload, Shield, Building, Mail, 
  Phone, MapPin, Users, Key, Save, X, RefreshCw,
  Clock, Calendar, Check, AlertCircle, Lock, Bell
} from "lucide-react";
import { useAuth } from "../hooks/userAuth";
import { useGlobalLoading } from "../hooks/LoadingContext";
import { useToast } from "../components/Toast.jsx";

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
          className="w-12 h-12 text-center text-xl font-semibold rounded-full 
            border-2 border-brand-secondary/30 focus:border-brand-primary 
            focus:outline-none focus:ring-2 focus:ring-brand-primary/30 
            bg-white shadow-sm transition-all duration-200"
          style={{
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
        <div className="flex items-center justify-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-brand-primary/70" />
          <span className="text-brand-primary/70">
            Request new code in{" "}
            <span className="font-semibold text-brand-primary">{formatTime(timeLeft)}</span>
          </span>
        </div>
      ) : (
        <button
          onClick={() => {
            onResend();
            setTimeLeft(seconds);
          }}
          disabled={disabled}
          className="text-sm text-brand-primary hover:text-brand-btn font-medium 
            disabled:opacity-50 flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Resend code
        </button>
      )}
    </div>
  );
};

export default function UserProfile() {
  const { profile, refreshProfile, logout } = useAuth();
  const { loading, setLoading } = useGlobalLoading(); // Added loading here
  const toast = useToast();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('profile');
  
  // Password change states - Code-based approach
  const [passwordFlow, setPasswordFlow] = useState('initial'); // initial, requested, verifying
  const [passwordCode, setPasswordCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false); // Local loading state for password change
  
  // Upload states
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const fileInputRef = useRef(null);
  
  // Role display names
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
  
  // Initialize preview URL
  useEffect(() => {
    if (profile?.avatar_url) {
      const cacheBustedUrl = `${profile.avatar_url}?t=${Date.now()}`;
      setPreviewUrl(cacheBustedUrl);
    } else {
      setPreviewUrl(null);
    }
  }, [profile, avatarKey]);

  // Handle avatar upload
  const handleAvatarUpload = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      
      if (!file.type.match('image/jpeg|image/png|image/gif|image/webp')) {
        toast.error('Please upload a valid image file (JPEG, PNG, GIF, WebP)');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      
      if (!profile?.id) {
        toast.error('Profile not loaded. Please refresh the page.');
        return;
      }
      
      setUploading(true);
      
      // Create temporary preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target.result);
      };
      reader.readAsDataURL(file);
      
      const formData = new FormData();
      formData.append('avatar', file);
      
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const sessionToken = localStorage.getItem("sessionToken");
      
      if (!sessionToken) {
        throw new Error('No session token found. Please log in again.');
      }
      
      const response = await fetch(`${API_BASE_URL}/api/upload-avatar`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${sessionToken}` },
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload avatar');
      }
      
      if (data.url) {
        const cacheBustedUrl = `${data.url}?t=${Date.now()}`;
        setPreviewUrl(cacheBustedUrl);
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      await refreshProfile();
      setAvatarKey(Date.now());
      
      toast.success('Profile photo updated successfully!');
      
    } catch (error) {
      console.error('❌ Error uploading avatar:', error);
      toast.error(error.message || 'Failed to upload profile photo');
      setPreviewUrl(profile?.avatar_url ? `${profile.avatar_url}?t=${Date.now()}` : null);
    } finally {
      setUploading(false);
    }
  };
  
  // Request password change code
  const requestPasswordChangeCode = async () => {
    setChangingPassword(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const sessionToken = localStorage.getItem("sessionToken");
      
      const response = await fetch(`${API_BASE_URL}/api/request-password-change-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ email: profile.email }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send verification code");
      }
      
      setPasswordFlow('requested');
      toast.success("Verification code sent to your email!");
      
    } catch (error) {
      console.error("Password change request error:", error);
      toast.error(error.message || "Failed to send verification code");
    } finally {
      setChangingPassword(false);
    }
  };

  // Resend password change code
  const resendPasswordChangeCode = async () => {
    setChangingPassword(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const sessionToken = localStorage.getItem("sessionToken");
      
      const response = await fetch(`${API_BASE_URL}/api/resend-password-change-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ email: profile.email }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to resend verification code");
      }
      
      toast.success("New verification code sent to your email!");
      
    } catch (error) {
      console.error("Resend code error:", error);
      toast.error(error.message || "Failed to resend verification code");
    } finally {
      setChangingPassword(false);
    }
  };

  // Verify code and change password
  const verifyCodeAndChangePassword = async (e) => {
    e.preventDefault();
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
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
    
    if (passwordCode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    
    setChangingPassword(true);
    
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const sessionToken = localStorage.getItem("sessionToken");
      
      const response = await fetch(`${API_BASE_URL}/api/verify-password-change-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          email: profile.email,
          code: passwordCode,
          newPassword
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to change password");
      }
      
      toast.success("Password changed successfully!");
      
      // Reset form
      setPasswordCode("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFlow('initial');
      
    } catch (error) {
      console.error("Password change error:", error);
      toast.error(error.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };
  
  // Handle remove avatar
  const handleRemoveAvatar = async () => {
    if (!confirm("Are you sure you want to remove your profile photo?")) {
      return;
    }
    
    setLoading(true);
    
    try {
      if (!profile?.id) {
        throw new Error('Profile not loaded. Please refresh the page.');
      }
      
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      const sessionToken = localStorage.getItem("sessionToken");
      
      if (!sessionToken) {
        throw new Error('No session token found. Please log in again.');
      }
      
      const response = await fetch(`${API_BASE_URL}/api/delete-avatar`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${sessionToken}` }
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete avatar');
      }
      
      setPreviewUrl(null);
      await refreshProfile();
      setAvatarKey(Date.now());
      
      toast.success("Profile photo removed successfully!");
      
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast.error(error.message || "Failed to remove profile photo");
    } finally {
      setLoading(false);
    }
  };

  // Force refresh avatar
  const forceRefreshAvatar = () => {
    setAvatarKey(Date.now());
    if (profile?.avatar_url) {
      const cacheBustedUrl = `${profile.avatar_url}?force=${Date.now()}`;
      setPreviewUrl(cacheBustedUrl);
      toast.info('Avatar refreshed!');
    }
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-surface/50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-brand-primary/70">Loading profile...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-surface to-white">
      {/* Non-sticky Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-brand-secondary/10 shadow-sm">
        <div className="px-6 py-5 max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2.5 rounded-xl hover:bg-brand-surface transition-all duration-200 
                  hover:shadow-sm group"
              >
                <ArrowLeft className="h-5 w-5 text-brand-primary group-hover:text-brand-btn" />
              </button>
              <div>
                <h1 className="text-sm font-bold bg-gradient-to-r from-brand-primary to-brand-btn bg-clip-text text-transparent">
                  Profile Settings
                </h1>
                <p className="text-xs text-brand-primary/60 mt-1">
                  Manage your account and security preferences
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-primary/10 to-brand-btn/10 
                rounded-full border border-brand-primary/20">
                <Shield className="h-4 w-4 text-brand-primary" />
                <span className="text-sm font-semibold text-brand-primary">
                  {getRoleDisplayName(profile.role)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Tabs - Glass Morphism */}
          <div className="mt-8">
            <div className="flex space-x-1 bg-white/50 backdrop-blur-sm rounded-xl p-1.5 border border-brand-secondary/10 
              shadow-sm w-fit">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  activeTab === 'profile' 
                    ? 'bg-white shadow-sm text-brand-primary' 
                    : 'text-brand-primary/60 hover:text-brand-primary hover:bg-white/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Profile Details
                </div>
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  activeTab === 'security' 
                    ? 'bg-white shadow-sm text-brand-primary' 
                    : 'text-brand-primary/60 hover:text-brand-primary hover:bg-white/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Security
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="px-6 py-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Avatar Card */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-2xl border border-brand-secondary/10 p-6 shadow-lg 
              hover:shadow-xl transition-shadow duration-300">
              {/* Avatar Section */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl 
                    ring-4 ring-brand-primary/10">
                    {previewUrl ? (
                      <img 
                        key={avatarKey}
                        src={previewUrl} 
                        alt={profile.full_name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const parent = e.target.parentElement;
                          parent.innerHTML = `
                            <div class="w-full h-full bg-gradient-to-br from-brand-primary/10 to-brand-btn/10 
                              flex items-center justify-center">
                              <UserCircle class="h-16 w-16 text-brand-primary/30" />
                            </div>
                          `;
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-brand-primary/10 to-brand-btn/10 
                        flex items-center justify-center">
                        <UserCircle className="h-16 w-16 text-brand-primary/30" />
                      </div>
                    )}
                  </div>
                  
                  {/* Upload Overlay */}
                  <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center 
                    opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer">
                    <div className="text-center transform -translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      <div className="bg-white/20 backdrop-blur-sm rounded-full p-2 inline-block">
                        <Camera className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-white text-xs font-medium mt-1 block">Change Photo</span>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={uploading}
                    />
                  </div>
                </div>
                
                <div className="mt-6 text-center">
                  <h2 className="text-xl font-bold text-brand-primary">{profile.full_name}</h2>
                  <p className="text-brand-primary/70 mt-1 flex items-center justify-center gap-2">
                    <Mail className="h-3 w-3" />
                    <span className="text-sm">{profile.email}</span>
                  </p>
                  <div className="mt-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold 
                      bg-gradient-to-r from-brand-primary/10 to-brand-btn/10 text-brand-primary 
                      border border-brand-primary/20">
                      {getRoleDisplayName(profile.role)}
                    </span>
                  </div>
                </div>
                
                {/* Avatar Actions - SMALLER BUTTONS */}
                <div className="mt-6 flex flex-col gap-2 w-full">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-brand-primary text-white 
                      rounded-lg hover:bg-brand-btn transition-all duration-200 text-sm
                      disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-3 w-3" />
                        <span>Upload Photo</span>
                      </>
                    )}
                  </button>
                  
                  {previewUrl && (
                    <button
                      onClick={handleRemoveAvatar}
                      className="flex items-center justify-center gap-2 px-3 py-2 border border-red-300 
                        text-red-600 rounded-lg hover:bg-red-50 transition-all duration-200 text-sm"
                    >
                      <X className="h-3 w-3" />
                      <span>Remove Photo</span>
                    </button>
                  )}
                </div>
                
                {/* Avatar Refresh */}
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={forceRefreshAvatar}
                    className="p-1.5 rounded-full bg-brand-surface hover:bg-brand-secondary/20 
                      transition-colors"
                    title="Refresh avatar"
                  >
                    <RefreshCw className="h-3 w-3 text-brand-primary/60" />
                  </button>
                  <span className="text-xs text-brand-primary/50">
                    {profile.avatar_url ? 'Avatar loaded' : 'No avatar'}
                  </span>
                </div>
                
                {/* Upload Guidelines */}
                <div className="mt-6 pt-6 border-t border-brand-secondary/10">
                  <h3 className="text-xs font-semibold text-brand-primary mb-3 flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Photo Guidelines
                  </h3>
                  <ul className="text-xs text-brand-primary/60 space-y-1.5">
                    <li className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1"></div>
                      <span>Use a clear, recent photo of your face</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1"></div>
                      <span>Max file size: 5MB</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-1"></div>
                      <span>Supported formats: JPG, PNG, GIF, WebP</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column - Details & Security */}
          <div className="lg:col-span-8">
            {activeTab === 'profile' ? (
              <div className="space-y-6">
                {/* Personal Information Card */}
                <div className="bg-white rounded-xl border border-brand-secondary/10 p-6 shadow-lg 
                  hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-brand-primary">Personal Information</h3>
                      <p className="text-xs text-brand-primary/60 mt-1">Your basic profile details</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-brand-primary/10 to-brand-btn/10 
                      flex items-center justify-center">
                      <Users className="h-4 w-4 text-brand-primary" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-brand-primary/70">Full Name</label>
                        <div className="flex items-center p-3 bg-brand-surface/50 rounded-lg border border-brand-secondary/10 
                          group hover:border-brand-primary/30 transition-colors duration-200">
                          <Users className="h-4 w-4 text-brand-primary/50 mr-3" />
                          <span className="text-brand-primary font-medium">{profile.full_name}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-brand-primary/70">Email Address</label>
                        <div className="flex items-center p-3 bg-brand-surface/50 rounded-lg border border-brand-secondary/10 
                          group hover:border-brand-primary/30 transition-colors duration-200">
                          <Mail className="h-4 w-4 text-brand-primary/50 mr-3" />
                          <span className="text-brand-primary font-medium">{profile.email}</span>
                        </div>
                      </div>
                    </div>
                    
                    {profile.phone && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-brand-primary/70">Phone Number</label>
                        <div className="flex items-center p-3 bg-brand-surface/50 rounded-lg border border-brand-secondary/10 
                          group hover:border-brand-primary/30 transition-colors duration-200">
                          <Phone className="h-4 w-4 text-brand-primary/50 mr-3" />
                          <span className="text-brand-primary font-medium">{profile.phone}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Role & Location Card */}
                <div className="bg-white rounded-xl border border-brand-secondary/10 p-6 shadow-lg 
                  hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-brand-primary">Role & Location</h3>
                      <p className="text-xs text-brand-primary/60 mt-1">Your organizational information</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-brand-primary/10 to-brand-btn/10 
                      flex items-center justify-center">
                      <Building className="h-4 w-4 text-brand-primary" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-brand-primary/70">Role</label>
                        <div className="flex items-center p-3 bg-brand-surface/50 rounded-lg border border-brand-secondary/10 
                          group hover:border-brand-primary/30 transition-colors duration-200">
                          <Shield className="h-4 w-4 text-brand-primary/50 mr-3" />
                          <span className="text-brand-primary font-medium">{getRoleDisplayName(profile.role)}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-brand-primary/70">Region</label>
                        <div className="flex items-center p-3 bg-brand-surface/50 rounded-lg border border-brand-secondary/10 
                          group hover:border-brand-primary/30 transition-colors duration-200">
                          <MapPin className="h-4 w-4 text-brand-primary/50 mr-3" />
                          <span className="text-brand-primary font-medium">{profile.region || 'Not assigned'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-brand-primary/70">Branch</label>
                      <div className="flex items-center p-3 bg-brand-surface/50 rounded-lg border border-brand-secondary/10 
                        group hover:border-brand-primary/30 transition-colors duration-200">
                        <Building className="h-4 w-4 text-brand-primary/50 mr-3" />
                        <span className="text-brand-primary font-medium">{profile.branch || 'Not assigned'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Account Activity Card */}
                <div className="bg-white rounded-xl border border-brand-secondary/10 p-6 shadow-lg 
                  hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-brand-primary">Account Activity</h3>
                      <p className="text-xs text-brand-primary/60 mt-1">Your account timeline</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-brand-primary/10 to-brand-btn/10 
                      flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-brand-primary" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-brand-secondary/10">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <span className="text-brand-primary font-medium">Account Created</span>
                          <p className="text-xs text-brand-primary/50">When your account was created</p>
                        </div>
                      </div>
                      <span className="font-semibold text-brand-primary text-sm">
                        {formatDate(profile.created_at)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center py-3 border-b border-brand-secondary/10">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <span className="text-brand-primary font-medium">Last Login</span>
                          <p className="text-xs text-brand-primary/50">Your most recent login</p>
                        </div>
                      </div>
                      <span className="font-semibold text-brand-primary text-sm">
                        {profile.last_login ? formatDate(profile.last_login) : 'Never'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <Check className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <span className="text-brand-primary font-medium">Account Status</span>
                          <p className="text-xs text-brand-primary/50">Current account status</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                        <span className="font-semibold text-green-600 text-sm">Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Password Change Card */}
                <div className="bg-white rounded-xl border border-brand-secondary/10 p-6 shadow-lg 
                  hover:shadow-xl transition-shadow duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-brand-primary">Change Password</h3>
                      <p className="text-xs text-brand-primary/60 mt-1">Secure your account with a new password</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-brand-primary/10 to-brand-btn/10 
                      flex items-center justify-center">
                      <Lock className="h-4 w-4 text-brand-primary" />
                    </div>
                  </div>
                  
                  {passwordFlow === 'initial' ? (
                    <div className="text-center py-8">
                      <div className="h-16 w-16 rounded-full bg-gradient-to-r from-brand-primary/10 to-brand-btn/10 
                        flex items-center justify-center mx-auto mb-4">
                        <Key className="h-8 w-8 text-brand-primary" />
                      </div>
                      <p className="text-brand-primary/70 mb-6 max-w-md mx-auto text-sm">
                        To change your password, we'll send a verification code to your email address. 
                        This ensures your account remains secure.
                      </p>
                      <button
                        onClick={requestPasswordChangeCode}
                        disabled={changingPassword}
                        className="px-6 py-3 bg-brand-primary text-white 
                          rounded-lg hover:bg-brand-btn transition-all duration-200 font-semibold text-sm
                          disabled:opacity-50"
                      >
                        Send Verification Code
                      </button>
                    </div>
                  ) : passwordFlow === 'requested' ? (
                    <form onSubmit={verifyCodeAndChangePassword} className="space-y-6">
                      <div className="text-center mb-6">
                        <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                          <Bell className="h-6 w-6 text-green-600" />
                        </div>
                        <p className="text-brand-primary/70 text-sm">
                          We've sent a 6-digit verification code to:<br />
                          <span className="font-semibold text-brand-primary">{profile.email}</span>
                        </p>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-brand-primary mb-3 text-center">
                            Enter Verification Code
                          </label>
                          <CircularCodeInput
                            length={6}
                            value={passwordCode}
                            onChange={setPasswordCode}
                            disabled={changingPassword}
                          />
                          <CountdownTimer
                            seconds={600} // 10 minutes
                            onResend={resendPasswordChangeCode}
                            disabled={changingPassword}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-brand-primary mb-2">
                            New Password
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Key className="h-4 w-4 text-brand-primary/50" />
                            </div>
                            <input
                              type={showNewPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              required
                              className="w-full pl-10 pr-10 py-2.5 border border-brand-secondary/20 rounded-lg 
                                focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-transparent 
                                bg-brand-surface/50 transition-all duration-200 text-sm"
                              placeholder="Enter new password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            >
                              {showNewPassword ? (
                                <EyeOff className="h-4 w-4 text-brand-primary/50" />
                              ) : (
                                <Eye className="h-4 w-4 text-brand-primary/50" />
                              )}
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-brand-primary/60">
                            Must be at least 8 characters with uppercase, lowercase, numbers, and special characters
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-brand-primary mb-2">
                            Confirm New Password
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Key className="h-4 w-4 text-brand-primary/50" />
                            </div>
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              required
                              className="w-full pl-10 pr-10 py-2.5 border border-brand-secondary/20 rounded-lg 
                                focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-transparent 
                                bg-brand-surface/50 transition-all duration-200 text-sm"
                              placeholder="Confirm new password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4 text-brand-primary/50" />
                              ) : (
                                <Eye className="h-4 w-4 text-brand-primary/50" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordFlow('initial');
                            setPasswordCode("");
                            setNewPassword("");
                            setConfirmPassword("");
                          }}
                          className="px-4 py-2.5 border border-brand-secondary/20 text-brand-primary 
                            rounded-lg hover:bg-brand-surface transition-all duration-200 font-medium text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={changingPassword}
                          className="px-4 py-2.5 bg-brand-primary text-white 
                            rounded-lg hover:bg-brand-btn transition-all duration-200 font-semibold text-sm
                            disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {changingPassword ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              <span>Update Password</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}