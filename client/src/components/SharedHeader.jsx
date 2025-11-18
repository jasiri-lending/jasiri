// src/components/Header.jsx
import { Bars3Icon, UserCircleIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/userAuth";

const SharedHeader = ({ sidebarOpen, setSidebarOpen }) => {
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
      regional_manager: "bg-purple-100 text-purple-800 border-purple-200",
      branch_manager: "bg-blue-100 text-blue-800 border-blue-200",
      relationship_officer: "bg-green-100 text-green-800 border-green-200",
      credit_analyst_officer: "bg-amber-100 text-amber-800 border-amber-200",
      customer_service_officer: "bg-cyan-100 text-cyan-800 border-cyan-200",
      admin: "bg-red-100 text-red-800 border-red-200",
      default: "bg-gray-100 text-gray-800 border-gray-200"
    };
    return colors[role] || colors.default;
  };

  const getRoleDisplayName = (role) => {
    const names = {
      regional_manager: "Regional Manager",
      branch_manager: "Branch Manager",
      relationship_officer: "Relationship Officer",
      credit_analyst_officer: "Credit Analyst",
      customer_service_officer: "Customer Service",
      admin: "Administrator",
    };
    return names[role] || role;
  };

  return (
    <header className="bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 border-b border-gray-200 shadow-sm sticky top-0 z-50 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-gray-600 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 group md:hidden"
          >
            <Bars3Icon className="h-5 w-5 group-hover:scale-110 transition-transform" style={{ color: "#586ab1" }} />
          </button>
        </div>

        {/* Right Section - User Profile */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-3 p-2 rounded-xl hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 group border border-transparent hover:border-gray-200"
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
                  <div className="h-9 w-9 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center shadow-sm">
                    <UserCircleIcon className="h-7 w-7 text-white" />
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
                  {profile?.full_name || 'User'}
                </span>
                <span className="text-xs text-gray-500 leading-tight">
                  {getRoleDisplayName(profile?.role)}
                </span>
              </div>
            </div>
            
            <ChevronDownIcon 
              className={`h-4 w-4 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`} 
              style={{ color: "#586ab1" }}
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
                    <div className="h-11 w-11 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center">
                      <UserCircleIcon className="h-9 w-9 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{profile?.full_name || 'User'}</p>
                    <p className="text-sm text-gray-500 truncate">{profile?.email}</p>
                  </div>
                </div>
                
                <div className="mt-2 flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(profile?.role)}`}>
                    {getRoleDisplayName(profile?.role)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {profile?.lastLogin ? `Last login: ${profile.lastLogin}` : 'Active now'}
                  </span>
                </div>
              </div>

              {/* Role-specific Information */}
              <div className="px-4 py-3 border-b border-gray-100">
                {profile?.role === "regional_manager" ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Region:</span>
                      <span className="font-medium text-gray-900">{profile?.region || 'All Regions'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Branches:</span>
                      <span className="font-medium text-gray-900">{profile?.branchCount || 'All'}</span>
                    </div>
                  </div>
                ) : profile?.role === "branch_manager" ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Branch:</span>
                      <span className="font-medium text-gray-900">{profile?.branch || 'Main Branch'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Region:</span>
                      <span className="font-medium text-gray-900">{profile?.region || 'N/A'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Branch:</span>
                      <span className="font-medium text-gray-900">{profile?.branch || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Employee ID:</span>
                      <span className="font-medium text-gray-900">{profile?.employeeId || 'N/A'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Menu */}
              <div className="py-2">
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center">
                  <UserCircleIcon className="h-4 w-4 mr-2" style={{ color: "#586ab1" }} />
                  My Profile
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center">
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "#586ab1" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center">
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "#586ab1" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Help & Support
                </button>
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 pt-2">
                <button 
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 font-medium flex items-center"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
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

export default SharedHeader;