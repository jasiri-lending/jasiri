// src/components/HeaderAdmin.jsx
import { Menu, Shield, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../../hooks/userAuth";

const HeaderAdmin = ({ sidebarOpen, setSidebarOpen }) => {
  const { profile, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getRoleBadgeColor = (role) => {
    const colors = {
      super_admin: "bg-gradient-to-r from-red-100 to-orange-100 text-red-800 border-red-200",
      admin: "bg-red-100 text-red-800 border-red-200",
      regional_manager: "bg-purple-100 text-purple-800 border-purple-200",
      manager: "bg-blue-100 text-blue-800 border-blue-200",
      agent: "bg-green-100 text-green-800 border-green-200",
      default: "bg-gray-100 text-gray-800 border-gray-200"
    };
    return colors[role] || colors.default;
  };

  const getRoleDisplayName = (role) => {
    const names = {
      super_admin: "Super Administrator",
      admin: "Administrator",
      regional_manager: "Regional Manager",
      manager: "Branch Manager",
      agent: "Loan Agent",
    };
    return names[role] || role;
  };

  return (
    <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50 backdrop-blur-sm bg-white/95">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 group md:hidden"
          >
            <Menu className="h-5 w-5 group-hover:scale-110 transition-transform" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-orange-600 rounded-lg flex items-center justify-center shadow-sm">
              <Shield className="text-white h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
              <p className="text-xs text-gray-500">Full System Control</p>
            </div>
          </div>
        </div>

        {/* Right Section - User Profile */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 group"
          >
            <div className="flex items-center space-x-3">
              <div className="relative">
                {profile?.avatar ? (
                  <img 
                    src={profile.avatar} 
                    alt={profile?.full_name}
                    className="h-9 w-9 rounded-full border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="h-9 w-9 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center shadow-sm">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1">
                  <div className={`w-3 h-3 rounded-full border-2 border-white ${
                    profile?.status === 'online' ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                </div>
              </div>
              
              <div className="hidden md:flex flex-col items-start text-left">
                <span className="font-semibold text-gray-900 text-sm leading-tight">
                  {profile?.name || 'Super Admin'}
                </span>
                <span className="text-xs text-gray-500 leading-tight">
                  {getRoleDisplayName(profile?.role || 'super_admin')}
                </span>
              </div>
            </div>
            
            <ChevronDown 
              className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`} 
            />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50 animate-in fade-in-80 slide-in-from-top-2">
              {/* Profile Header in Dropdown */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  {profile?.avatar ? (
                    <img 
                      src={profile.avatar} 
                      alt={profile?.full_name}
                      className="h-11 w-11 rounded-full border-2 border-gray-100"
                    />
                  ) : (
                    <div className="h-11 w-11 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center">
                      <Shield className="h-7 w-7 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {profile?.full_name || 'System Administrator'}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {profile?.email || 'admin@ziralending.com'}
                    </p>
                  </div>
                </div>
                
                <div className="mt-2 flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(profile?.role || 'super_admin')}`}>
                    {getRoleDisplayName(profile?.role || 'super_admin')}
                  </span>
                  <span className="text-xs text-gray-500">
                    {profile?.lastLogin ? `Last login: ${profile.lastLogin}` : 'Active now'}
                  </span>
                </div>
              </div>

              {/* Admin Information */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Access Level:</span>
                    <span className="font-medium text-red-600">Full Control</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Employee ID:</span>
                    <span className="font-medium text-gray-900">
                      {profile?.employeeId || 'ADM-001'}
                    </span>
                  </div>
                  {profile?.branch && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Branch:</span>
                      <span className="font-medium text-gray-900">{profile.branch}</span>
                    </div>
                  )}
                  {profile?.region && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Region:</span>
                      <span className="font-medium text-gray-900">{profile.region}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Menu */}
              <div className="py-2">
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150">
                  My Profile
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150">
                  System Settings
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150">
                  Security Center
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150">
                  Help & Support
                </button>
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 pt-2">
                <button 
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 font-medium"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default HeaderAdmin;