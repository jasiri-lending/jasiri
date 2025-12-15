// src/components/HeaderAdmin.jsx
import { Menu, Shield, ChevronDown, UserCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../../hooks/userAuth";
import { useTenant } from "../../../hooks/useTenant";

const HeaderAdmin = ({ sidebarOpen, setSidebarOpen }) => {
  const { profile, logout } = useAuth();
  const { tenant } = useTenant();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscapeKey);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, []);

  const getRoleBadgeColor = (role) => {
    const colors = {
      superadmin: "text-red-800",
      admin: "text-red-800",
      regional_manager: "text-purple-800",
      manager: "text-blue-800",
      agent: "text-green-800",
      default: "text-gray-800"
    };
    return colors[role] || colors.default;
  };

  const getRoleDisplayName = (role) => {
    const names = {
      superadmin: "Super Administrator",
      admin: "Administrator",
      regional_manager: "Regional Manager",
      manager: "Branch Manager",
      agent: "Loan Agent",
    };
    return names[role] || role;
  };

  const isSuperAdmin = profile?.role === "superadmin";

  return (
    <header className="border-b border-gray-200 sticky top-0 z-30 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="flex items-center justify-between px-4 lg:px-6 py-3">
        {/* Left Section - Menu Button (Mobile) & Admin Panel Badge */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-200 group md:hidden"
          >
            <Menu className="h-5 w-5 group-hover:scale-110 transition-transform" style={{ color: "#586ab1" }} />
          </button>

          {/* Admin Panel Badge */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-white/80 rounded-lg border border-gray-200">
            <Shield className="h-4 w-4" style={{ color: "#586ab1" }} />
            <span className="text-sm font-semibold hidden sm:inline" style={{ color: "#586ab1" }}>
              Admin Panel
            </span>
          </div>
        </div>

        {/* Right Section - Company Name (for admin only) and User Profile */}
        <div className="flex items-center space-x-4 lg:space-x-6">
          {/* Company Name - Only show for admin, not superadmin */}
          {!isSuperAdmin && tenant && (
            <div className="hidden md:block">
              <h1
                className="text-sm lg:text-sm font-medium truncate"
                style={{ color: "#586ab1" }}
                title={tenant?.company_name || 'Company'}
              >
                {tenant?.company_name || 'Company'}
              </h1>
            </div>
          )}

          {/* User Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 lg:space-x-3 p-2 rounded-xl hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all duration-200 group border border-gray-200"
              style={{
                backgroundColor: isDropdownOpen ? 'rgba(255, 255, 255, 0.9)' : 'transparent'
              }}
              aria-label="User menu"
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
            >
              <div className="flex items-center space-x-2 lg:space-x-3">
                <div className="relative">
                  {profile?.avatar ? (
                    <img 
                      src={profile.avatar} 
                      alt={profile?.full_name}
                      className="h-8 w-8 lg:h-9 lg:w-9 rounded-full border-2 border-white shadow-sm"
                    />
                  ) : (
                    <div className="h-8 w-8 lg:h-9 lg:w-9 rounded-full flex items-center justify-center shadow-sm bg-gradient-to-br from-blue-50 to-cyan-50 border border-[#586ab1]/20">
                      <UserCircle className="h-5 w-5 lg:h-6 lg:w-6" style={{ color: "#586ab1" }} />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1">
                    <div className={`w-3 h-3 rounded-full border-2 border-white ${
                      profile?.status === 'online' ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  </div>
                </div>
                
                <div className="hidden md:flex flex-col items-start text-left max-w-[120px] lg:max-w-[160px]">
                  <span className="font-semibold text-sm leading-tight truncate w-full" style={{ color: "#586ab1" }}>
                    {profile?.full_name || 'Admin User'}
                  </span>
                  <span className="text-xs leading-tight truncate w-full" style={{ color: "#586ab1", opacity: 0.7 }}>
                    {getRoleDisplayName(profile?.role || 'admin')}
                  </span>
                </div>
              </div>
              
              <ChevronDown 
                className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
                style={{ color: "#586ab1" }}
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <>
                {/* Backdrop for mobile */}
                <div 
                  className="fixed inset-0 z-40 lg:hidden" 
                  onClick={() => setIsDropdownOpen(false)}
                  aria-hidden="true"
                />

                <div 
                  className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50 animate-in fade-in-80 slide-in-from-top-2"
                  style={{
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)'
                  }}
                  role="menu"
                >
                  {/* Tenant Info - Only show for admin, not superadmin */}
                  {!isSuperAdmin && tenant && (
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center justify-center">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate text-center" style={{ color: "#586ab1" }}>
                            {tenant.company_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

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
                        <div className="h-11 w-11 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50 border border-[#586ab1]/20">
                          <UserCircle className="h-7 w-7" style={{ color: "#586ab1" }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate" style={{ color: "#586ab1" }}>
                          {profile?.full_name || 'System Administrator'}
                        </p>
                        <p className="text-sm truncate" style={{ color: "#586ab1", opacity: 0.7 }}>
                          {profile?.email || 'admin@system.com'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeColor(profile?.role || 'admin')}`}>
                        {getRoleDisplayName(profile?.role || 'admin')}
                      </span>
                      {/* {profile?.lastLogin && (
                        <span className="text-xs" style={{ color: "#586ab1", opacity: 0.7 }}>
                          Last login: {profile.lastLogin}
                        </span>
                      )} */}
                    </div>
                  </div>

                  {/* Admin Information */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span style={{ color: "#586ab1", opacity: 0.7 }}>Access Level:</span>
                        <span className="font-medium text-red-600">
                          {isSuperAdmin ? 'Full System Control' : 'Full Control'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: "#586ab1", opacity: 0.7 }}>Employee ID:</span>
                        <span className="font-medium" style={{ color: "#586ab1" }}>
                          {profile?.employeeId || (isSuperAdmin ? 'SUPERADM-001' : 'ADM-001')}
                        </span>
                      </div>
                      {!isSuperAdmin && profile?.branch && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color: "#586ab1", opacity: 0.7 }}>Branch:</span>
                          <span className="font-medium" style={{ color: "#586ab1" }}>{profile.branch}</span>
                        </div>
                      )}
                      {!isSuperAdmin && profile?.region && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color: "#586ab1", opacity: 0.7 }}>Region:</span>
                          <span className="font-medium" style={{ color: "#586ab1" }}>{profile.region}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Menu */}
                  <div className="py-2">
                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-[#586ab1]/5 transition-colors duration-150" style={{ color: "#586ab1" }}>
                      My Profile
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-[#586ab1]/5 transition-colors duration-150" style={{ color: "#586ab1" }}>
                      System Settings
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-[#586ab1]/5 transition-colors duration-150" style={{ color: "#586ab1" }}>
                      Security Center
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm hover:bg-[#586ab1]/5 transition-colors duration-150" style={{ color: "#586ab1" }}>
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
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default HeaderAdmin;