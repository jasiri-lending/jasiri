// src/pages/admin/components/HeaderAdmin.jsx
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
    <header className="border-b border-brand-secondary/20 sticky top-0 z-30 bg-brand-surface">
      <div className="flex items-center justify-between px-4 lg:px-6 py-3">
        {/* Left Section - Menu Button (Mobile) & Admin Panel Badge */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 transition-all duration-200 group md:hidden"
          >
            <Menu className="h-5 w-5 group-hover:scale-110 transition-transform text-brand-primary" />
          </button>

          {/* Admin Panel Badge */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-white/80 rounded-lg border border-brand-secondary/20">
            <Shield className="h-4 w-4 text-brand-primary" />
            <span className="text-sm font-semibold hidden sm:inline text-brand-primary">
              Admin Panel
            </span>
          </div>
        </div>

        {/* Right Section - Company Name and User Profile */}
        <div className="flex items-center space-x-4 lg:space-x-6">
          {/* Company Name */}
          {!isSuperAdmin && tenant && (
            <div className="hidden md:block">
              <h1
                className="text-sm lg:text-sm font-medium truncate text-brand-primary"
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
              className={`flex items-center space-x-2 lg:space-x-3 p-2 rounded-xl hover:bg-brand-secondary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 transition-all duration-200 group border border-brand-secondary/20 ${isDropdownOpen ? 'bg-brand-secondary/10' : 'bg-transparent'
                }`}
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
                    <div className="h-8 w-8 lg:h-9 lg:w-9 rounded-full flex items-center justify-center shadow-sm bg-white border border-brand-primary/20">
                      <UserCircle className="h-5 w-5 lg:h-6 lg:w-6 text-brand-primary" />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1">
                    <div className={`w-3 h-3 rounded-full border-2 border-white ${profile?.status === 'online' ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                  </div>
                </div>

                <div className="hidden md:flex flex-col items-start text-left max-w-[120px] lg:max-w-[160px]">
                  <span className="font-semibold text-brand-primary text-sm leading-tight truncate w-full">
                    {profile?.full_name || 'Admin User'}
                  </span>
                  <span className="text-xs text-brand-primary/70 leading-tight truncate w-full">
                    {getRoleDisplayName(profile?.role || 'admin')}
                  </span>
                </div>
              </div>

              <ChevronDown
                className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 text-brand-primary ${isDropdownOpen ? 'rotate-180' : ''
                  }`}
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
                  className="absolute right-0 mt-2 w-72 bg-brand-surface rounded-xl shadow-lg border border-brand-secondary/20 py-2 z-50 animate-in fade-in-80 slide-in-from-top-2"
                  style={{ boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)' }}
                  role="menu"
                >
                  {/* Profile Header */}
                  <div className="px-4 py-3 border-b border-brand-secondary/10">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {profile?.avatar ? (
                          <img
                            src={profile.avatar}
                            alt={profile?.full_name}
                            className="h-10 w-10 rounded-full border border-brand-secondary/20"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full flex items-center justify-center bg-white border border-brand-primary/20">
                            <UserCircle className="h-8 w-8 text-brand-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-brand-primary truncate text-sm">
                          {profile?.full_name || 'System Admin'}
                        </p>
                        <p className="text-sm text-brand-primary/70 truncate">
                          {profile?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="py-2">
                    <button className="w-full text-left px-4 py-2.5 text-sm text-brand-primary hover:bg-brand-secondary/10 transition-colors duration-150 flex items-center group">
                      <span>My Profile</span>
                    </button>
                    <button className="w-full text-left px-4 py-2.5 text-sm text-brand-primary hover:bg-brand-secondary/10 transition-colors duration-150 flex items-center group">
                      <span>System Settings</span>
                    </button>
                    <button className="w-full text-left px-4 py-2.5 text-sm text-brand-primary hover:bg-brand-secondary/10 transition-colors duration-150 flex items-center group">
                      <span>Security Center</span>
                    </button>
                    <button className="w-full text-left px-4 py-2.5 text-sm text-brand-primary hover:bg-brand-secondary/10 transition-colors duration-150 flex items-center group">
                      <span>Help & Support</span>
                    </button>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-brand-secondary/10 pt-2">
                    <button
                      onClick={logout}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 font-medium flex items-center group"
                    >
                      <span>Sign out</span>
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
