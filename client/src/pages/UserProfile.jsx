// src/pages/UserProfile.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  UserCircle, ArrowLeft, Camera, Eye, EyeOff, 
  CheckCircle, Upload, Shield, Building, Mail, 
  Phone, MapPin, Users, Key, Save, X 
} from "lucide-react";
import { useAuth } from "../hooks/userAuth";
import { useGlobalLoading } from "../hooks/LoadingContext";
import { useToast } from "../components/Toast.jsx";
import { supabase } from "../supabaseClient";

export default function UserProfile() {
  const { profile, refreshProfile, logout } = useAuth();
  const { setLoading } = useGlobalLoading();
  const toast = useToast();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Upload states
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  
  // Role display names (same as in SharedHeader)
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
  
  // Initialize preview URL from profile avatar
  useEffect(() => {
    if (profile?.avatar) {
      setPreviewUrl(profile.avatar);
    }
  }, [profile]);
  
  // Handle avatar upload
  const handleAvatarUpload = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      
      // Validate file type
      if (!file.type.match('image/jpeg|image/png|image/gif|image/webp')) {
        toast.error('Please upload a valid image file (JPEG, PNG, GIF, WebP)');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      
      setUploading(true);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target.result);
      };
      reader.readAsDataURL(file);
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (uploadError) {
        throw uploadError;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);
      
      if (updateError) {
        throw updateError;
      }
      
      // Also update users table for backward compatibility
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ avatar: publicUrl })
        .eq('id', profile.id);
      
      if (userUpdateError) {
        console.warn('Could not update users table avatar:', userUpdateError);
      }
      
      // Refresh profile data
      await refreshProfile();
      
      toast.success('Profile photo updated successfully!');
      
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error(error.message || 'Failed to upload profile photo');
      setPreviewUrl(profile?.avatar || null);
    } finally {
      setUploading(false);
    }
  };
  
  // Handle password change
  const handlePasswordChange = async (e) => {
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
    
    setLoading(true);
    
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      
      const response = await fetch(`${API_BASE_URL}/api/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("sessionToken")}`
        },
        body: JSON.stringify({
          userId: profile.id,
          currentPassword,
          newPassword
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to change password");
      }
      
      toast.success("Password changed successfully!");
      
      // Reset form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsEditingPassword(false);
      
    } catch (error) {
      console.error("Password change error:", error);
      toast.error(error.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle remove avatar
  const handleRemoveAvatar = async () => {
    if (!confirm("Are you sure you want to remove your profile photo?")) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Remove avatar from profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', profile.id);
      
      if (updateError) {
        throw updateError;
      }
      
      // Also update users table for backward compatibility
      await supabase
        .from('users')
        .update({ avatar: null })
        .eq('id', profile.id);
      
      // Refresh profile data
      await refreshProfile();
      
      setPreviewUrl(null);
      toast.success("Profile photo removed successfully!");
      
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast.error(error.message || "Failed to remove profile photo");
    } finally {
      setLoading(false);
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
      <div className="min-h-screen bg-brand-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-brand-primary">Loading profile...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-brand-surface">
      {/* Header */}
      <div className="bg-white border-b border-brand-secondary/20 sticky top-0 z-30">
        <div className="px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg hover:bg-brand-secondary/10 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-brand-primary" />
              </button>
              <h1 className="text-xl font-semibold text-brand-primary">Profile Settings</h1>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-brand-primary/10 rounded-full">
                <Shield className="h-4 w-4 text-brand-primary" />
                <span className="text-sm font-medium text-brand-primary">
                  {getRoleDisplayName(profile.role)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="mt-6 flex space-x-1 border-b border-brand-secondary/10">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                activeTab === 'profile' 
                  ? 'text-brand-primary' 
                  : 'text-brand-primary/70 hover:text-brand-primary'
              }`}
            >
              Profile Details
              {activeTab === 'profile' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                activeTab === 'security' 
                  ? 'text-brand-primary' 
                  : 'text-brand-primary/70 hover:text-brand-primary'
              }`}
            >
              Security
              {activeTab === 'security' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary"></div>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="px-4 lg:px-6 py-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Avatar & Basic Info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-brand-secondary/20 p-6">
              {/* Avatar Upload Section */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
                    {previewUrl ? (
                      <img 
                        src={previewUrl} 
                        alt={profile.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-brand-primary/10 flex items-center justify-center">
                        <UserCircle className="h-16 w-16 text-brand-primary/50" />
                      </div>
                    )}
                  </div>
                  
                  {/* Upload Overlay */}
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <div className="text-center">
                      <Camera className="h-8 w-8 text-white mx-auto mb-2" />
                      <span className="text-white text-sm font-medium">Change Photo</span>
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
                  <p className="text-brand-primary/70 mt-1">{profile.email}</p>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-primary/10 text-brand-primary">
                      {getRoleDisplayName(profile.role)}
                    </span>
                  </div>
                </div>
                
                {/* Avatar Actions */}
                <div className="mt-6 flex flex-col space-y-2 w-full">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center justify-center space-x-2 w-full px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-btn transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>Upload New Photo</span>
                      </>
                    )}
                  </button>
                  
                  {previewUrl && (
                    <button
                      onClick={handleRemoveAvatar}
                      className="flex items-center justify-center space-x-2 w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <X className="h-4 w-4" />
                      <span>Remove Photo</span>
                    </button>
                  )}
                </div>
                
                {/* Upload Guidelines */}
                <div className="mt-6 pt-6 border-t border-brand-secondary/10">
                  <h3 className="text-sm font-medium text-brand-primary mb-2">Photo Guidelines</h3>
                  <ul className="text-xs text-brand-primary/60 space-y-1">
                    <li className="flex items-start">
                      <CheckCircle className="h-3 w-3 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
                      <span>Use a clear, recent photo of your face</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-3 w-3 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
                      <span>Max file size: 5MB</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-3 w-3 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
                      <span>Supported formats: JPG, PNG, GIF, WebP</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column - Details & Security */}
          <div className="lg:col-span-2">
            {activeTab === 'profile' ? (
              <div className="space-y-6">
                {/* Personal Information Card */}
                <div className="bg-white rounded-xl border border-brand-secondary/20 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-brand-primary">Personal Information</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-brand-primary/70">Full Name</label>
                        <div className="flex items-center p-3 bg-brand-surface rounded-lg border border-brand-secondary/10">
                          <Users className="h-4 w-4 text-brand-primary/50 mr-3" />
                          <span className="text-brand-primary">{profile.full_name}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-brand-primary/70">Email Address</label>
                        <div className="flex items-center p-3 bg-brand-surface rounded-lg border border-brand-secondary/10">
                          <Mail className="h-4 w-4 text-brand-primary/50 mr-3" />
                          <span className="text-brand-primary">{profile.email}</span>
                        </div>
                      </div>
                    </div>
                    
                    {profile.phone && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-brand-primary/70">Phone Number</label>
                        <div className="flex items-center p-3 bg-brand-surface rounded-lg border border-brand-secondary/10">
                          <Phone className="h-4 w-4 text-brand-primary/50 mr-3" />
                          <span className="text-brand-primary">{profile.phone}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Role & Location Card */}
                <div className="bg-white rounded-xl border border-brand-secondary/20 p-6">
                  <h3 className="text-lg font-semibold text-brand-primary mb-6">Role & Location</h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-brand-primary/70">Role</label>
                        <div className="flex items-center p-3 bg-brand-surface rounded-lg border border-brand-secondary/10">
                          <Shield className="h-4 w-4 text-brand-primary/50 mr-3" />
                          <span className="text-brand-primary">{getRoleDisplayName(profile.role)}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-brand-primary/70">Region</label>
                        <div className="flex items-center p-3 bg-brand-surface rounded-lg border border-brand-secondary/10">
                          <MapPin className="h-4 w-4 text-brand-primary/50 mr-3" />
                          <span className="text-brand-primary">{profile.region || 'Not assigned'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-brand-primary/70">Branch</label>
                      <div className="flex items-center p-3 bg-brand-surface rounded-lg border border-brand-secondary/10">
                        <Building className="h-4 w-4 text-brand-primary/50 mr-3" />
                        <span className="text-brand-primary">{profile.branch || 'Not assigned'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Account Activity Card */}
                <div className="bg-white rounded-xl border border-brand-secondary/20 p-6">
                  <h3 className="text-lg font-semibold text-brand-primary mb-6">Account Activity</h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-brand-secondary/10">
                      <span className="text-brand-primary/70">Account Created</span>
                      <span className="font-medium text-brand-primary">
                        {formatDate(profile.created_at)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center py-3 border-b border-brand-secondary/10">
                      <span className="text-brand-primary/70">Last Login</span>
                      <span className="font-medium text-brand-primary">
                        {profile.last_login ? formatDate(profile.last_login) : 'Never'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center py-3">
                      <span className="text-brand-primary/70">Status</span>
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                        <span className="font-medium text-brand-primary">Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Password Change Card */}
                <div className="bg-white rounded-xl border border-brand-secondary/20 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-brand-primary">Change Password</h3>
                    {!isEditingPassword ? (
                      <button
                        onClick={() => setIsEditingPassword(true)}
                        className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-btn transition-colors text-sm font-medium"
                      >
                        Change Password
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsEditingPassword(false);
                          setCurrentPassword("");
                          setNewPassword("");
                          setConfirmPassword("");
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  
                  {isEditingPassword ? (
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-brand-primary">Current Password</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Key className="h-4 w-4 text-brand-primary/50" />
                          </div>
                          <input
                            type={showCurrentPassword ? "text" : "password"}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                            className="w-full pl-10 pr-10 py-3 border border-brand-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-brand-surface"
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            {showCurrentPassword ? (
                              <EyeOff className="h-4 w-4 text-brand-primary/50" />
                            ) : (
                              <Eye className="h-4 w-4 text-brand-primary/50" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-brand-primary">New Password</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Key className="h-4 w-4 text-brand-primary/50" />
                          </div>
                          <input
                            type={showNewPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            className="w-full pl-10 pr-10 py-3 border border-brand-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-brand-surface"
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
                        <p className="text-xs text-brand-primary/60">
                          Must be at least 8 characters with uppercase, lowercase, numbers, and special characters
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-brand-primary">Confirm New Password</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Key className="h-4 w-4 text-brand-primary/50" />
                          </div>
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="w-full pl-10 pr-10 py-3 border border-brand-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent bg-brand-surface"
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
                      
                      <button
                        type="submit"
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-btn transition-colors font-medium"
                      >
                        <Save className="h-4 w-4" />
                        <span>Update Password</span>
                      </button>
                    </form>
                  ) : (
                    <div className="text-center py-8">
                      <Key className="h-12 w-12 text-brand-primary/30 mx-auto mb-4" />
                      <p className="text-brand-primary/70">
                        Click "Change Password" to update your account password
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Security Tips Card */}
                <div className="bg-white rounded-xl border border-brand-secondary/20 p-6">
                  <h3 className="text-lg font-semibold text-brand-primary mb-4">Security Tips</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-brand-primary/80">Use a unique password that you don't use elsewhere</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-brand-primary/80">Change your password regularly (every 90 days)</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-brand-primary/80">Never share your password with anyone</span>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-brand-primary/80">Enable two-factor authentication if available</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}