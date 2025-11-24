// src/components/OfficerHeader.jsx
import { Menu, User, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/userAuth';

const OfficerHeader = ({ sidebarOpen, setSidebarOpen }) => {
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
      relationship_officer: "bg-gradient-to-r from-blue-500 to-cyan-500",
      regional_manager: "bg-gradient-to-r from-purple-500 to-pink-500",
      admin: "bg-gradient-to-r from-red-500 to-orange-500",
      manager: "bg-gradient-to-r from-green-500 to-emerald-500",
      default: "bg-gradient-to-r from-gray-500 to-gray-700"
    };
    return colors[role] || colors.default;
  };

  const getRoleDisplayName = (role) => {
    const names = {
      relationship_officer: "Relationship Officer",
      regional_manager: "Regional Manager",
      admin: "Administrator",
      manager: "Branch Manager",
    };
    return names[role] || role;
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!profile) {
    return (
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 group md:hidden"
            >
              <Menu className="h-5 w-5 group-hover:scale-110 transition-transform" />
            </button>
           
          </div>
          <div className="animate-pulse">
            <div className="h-8 w-32 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50 backdrop-blur-sm bg-white/95">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left Section */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 group md:hidden"
          >
            <Menu className="h-5 w-5 group-hover:scale-110 transition-transform" />
          </button>
          
       
        </div>

        {/* Right Section - Profile */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 group"
          >
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-white font-semibold text-sm">
                    {getInitials(profile.name)}
                  </span>
                </div>
                <div className="absolute -bottom-1 -right-1">
                  <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
              </div>
              
              <div className="hidden md:flex flex-col items-start text-left">
                <span className="font-semibold text-gray-900 text-sm leading-tight">
                  {profile.name}
                </span>
                <span className="text-xs text-gray-500 leading-tight">
                  {getRoleDisplayName(profile.role)}
                </span>
              </div>
            </div>
            
            <ChevronDown 
              className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`} 
            />
          </button>

          {/* Profile Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50 animate-in fade-in-80 slide-in-from-top-2">
              {/* Profile Info */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-base">
                      {getInitials(profile.name)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{profile.full_name}</p>
                    <p className="text-sm text-gray-500 truncate">{profile.email}</p>
                  </div>
                </div>
                
                <div className="mt-2 flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getRoleBadgeColor(profile.role)}`}>
                    {getRoleDisplayName(profile.role)}
                  </span>
               
                </div>
              </div>

              {/* Role-specific Information */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="space-y-2">
                 
                    <>
                       <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Region:</span>
                        <span className="font-medium text-gray-900">{profile.region || 'All Regions'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Branch:</span>
                        <span className="font-medium text-gray-900">{profile.branch || 'Main Branch'}</span>
                      </div>
                      
                    </>
                 
                </div>
              </div>

              {/* Actions */}
              {/* <div className="py-2">
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150">
                  My Profile
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150">
                  Settings & Preferences
                </button>
                <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150">
                  Help Center
                </button>
              </div> */}

              {/* Logout */}
              <div className="border-t border-gray-100 pt-2">
                <button 
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 font-medium"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default OfficerHeader;