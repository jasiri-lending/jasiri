import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  UserCircle, ChevronDown, Settings, HelpCircle, LogOut,
  Shield, Menu 
} from "lucide-react";
import { useAuth } from "../hooks/userAuth";
import { useTenant } from "../hooks/useTenant";

const SharedHeader = ({ onMenuClick }) => {
  const { profile, isLoading, logout } = useAuth();
  const { tenant } = useTenant();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const isAdmin = ["admin", "superadmin"].includes(profile?.role);
  const isSuperAdmin = profile?.role === "superadmin";

  // Close dropdown when clicking outside or pressing Escape
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

  // Role badge color mapping
  const roleBadgeColors = {
    superadmin: "bg-purple-100 text-purple-800",
    admin: "bg-red-100 text-red-800",
    regional_manager: "bg-blue-100 text-blue-800",
    branch_manager: "bg-green-100 text-green-800",
    relationship_officer: "bg-indigo-100 text-indigo-800",
    credit_analyst_officer: "bg-amber-100 text-amber-800",
    customer_service_officer: "bg-cyan-100 text-cyan-800",
    default: "bg-gray-100 text-gray-800"
  };

  const roleDisplayNames = {
    superadmin: "Super Administrator",
    admin: "Administrator",
    regional_manager: "Regional Manager",
    branch_manager: "Branch Manager",
    relationship_officer: "Relationship Officer",
    credit_analyst_officer: "Credit Analyst",
    customer_service_officer: "Customer Service",
  };

  const getRoleBadgeColor = (role) => roleBadgeColors[role] || roleBadgeColors.default;
  const getRoleDisplayName = (role) => roleDisplayNames[role] || role;

  // Navigation handlers
  const handleProfileClick = () => {
    setIsDropdownOpen(false);
    navigate("/profile");
  };

  const handleSettingsClick = () => {
    setIsDropdownOpen(false);
    navigate(isAdmin ? "/admin/settings" : "/settings");
  };

  const handleHelpClick = () => {
    setIsDropdownOpen(false);
    navigate("/help");
  };

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await logout();
  };

  // Render skeleton while loading
  if (isLoading) {
    return (
      <header className="border-b border-brand-secondary/20 sticky top-0 z-30 bg-brand-surface">
        <div className="flex items-center justify-end px-4 lg:px-6 py-3">
          <div className="flex items-center space-x-4 lg:space-x-6">
            <div className="hidden md:block">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-full bg-gray-200 animate-pulse"></div>
              <div className="hidden md:block">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-1"></div>
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-brand-secondary/20 sticky top-0 z-30 bg-brand-surface">
      <div className="flex items-center justify-between px-4 lg:px-6 py-3">
        {/* Left Section - Menu Button and Admin Badge */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 transition-all duration-200 group lg:hidden"
          >
            <Menu className="h-5 w-5 group-hover:scale-110 transition-transform text-brand-primary" />
          </button>

          {/* Admin Panel Badge (only for admin users) */}
          {isAdmin && (
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-white/80 rounded-lg border border-brand-secondary/20">
              <Shield className="h-4 w-4 text-brand-primary" />
              <span className="text-sm font-semibold hidden sm:inline text-brand-primary">
                {isSuperAdmin ? "Super Admin Panel" : "Admin Panel"}
              </span>
            </div>
          )}
        </div>

        {/* Right Section - Company Name and User Profile */}
        <div className="flex items-center space-x-4 lg:space-x-6">
          {/* Company Name */}
          {tenant && !isSuperAdmin && (
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
              className={`flex items-center space-x-2 lg:space-x-3 p-2 rounded-xl hover:bg-brand-secondary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 transition-all duration-200 group border border-brand-secondary/20 ${
                isDropdownOpen ? 'bg-brand-secondary/10' : 'bg-transparent'
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
                    <div className={`w-3 h-3 rounded-full border-2 border-white ${
                      profile?.status === 'online' ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  </div>
                </div>

                <div className="hidden md:flex flex-col items-start text-left max-w-[120px] lg:max-w-[160px]">
                  <span className="font-semibold text-brand-primary text-sm leading-tight truncate w-full">
                    {profile?.full_name || 'User'}
                  </span>
                  <span className="text-xs text-brand-primary/70 leading-tight truncate w-full">
                    {getRoleDisplayName(profile?.role)}
                  </span>
                </div>
              </div>

              <ChevronDown
                className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 text-brand-primary ${
                  isDropdownOpen ? 'rotate-180' : ''
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
                  {/* Tenant Info (except superadmin) */}
                  {tenant && !isSuperAdmin && (
                    <div className="px-4 py-3 border-b border-brand-secondary/10">
                      <div className="flex items-center justify-center">
                        <div className="min-w-0">
                          <p className="text-brand-primary text-sm font-medium truncate text-center">
                            {tenant.company_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* User Profile Info */}
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
                          {profile?.full_name || 'User'}
                        </p>
                        <p className="text-sm text-brand-primary/70 truncate" title={profile?.email}>
                          {profile?.email}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(profile?.role)}`}>
                        {getRoleDisplayName(profile?.role)}
                      </span>
                    </div>
                  </div>

                  {/* Role-specific Details */}
                  <div className="px-4 py-3 border-b border-brand-secondary/10">
                    {profile?.role === "regional_manager" ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-brand-primary/70">Region:</span>
                          <span className="font-medium text-brand-primary">{profile?.region || 'All Regions'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-brand-primary/70">Branches:</span>
                          <span className="font-medium text-brand-primary">All</span>
                        </div>
                      </div>
                    ) : profile?.role === "branch_manager" ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-brand-primary/70">Branch:</span>
                          <span className="font-medium text-brand-primary">{profile?.branch || 'Main Branch'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-brand-primary/70">Region:</span>
                          <span className="font-medium text-brand-primary">{profile?.region || 'N/A'}</span>
                        </div>
                      </div>
                    ) : !isAdmin ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-brand-primary/70">Branch:</span>
                          <span className="font-medium text-brand-primary">{profile?.branch || 'N/A'}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Action Menu */}
                  <div className="py-2">
                    <button
                      onClick={handleProfileClick}
                      className="w-full text-left px-4 py-2.5 text-sm text-brand-primary hover:bg-brand-secondary/10 transition-colors duration-150 flex items-center group"
                      role="menuitem"
                    >
                      <UserCircle className="h-4 w-4 mr-2 text-brand-primary/60 group-hover:text-brand-primary" />
                      <span>My Profile</span>
                    </button>
                    <button
                      onClick={handleSettingsClick}
                      className="w-full text-left px-4 py-2.5 text-sm text-brand-primary hover:bg-brand-secondary/10 transition-colors duration-150 flex items-center group"
                      role="menuitem"
                    >
                      <Settings className="h-4 w-4 mr-2 text-brand-primary/60 group-hover:text-brand-primary" />
                      <span>Settings</span>
                    </button>
                    <button
                      onClick={handleHelpClick}
                      className="w-full text-left px-4 py-2.5 text-sm text-brand-primary hover:bg-brand-secondary/10 transition-colors duration-150 flex items-center group"
                      role="menuitem"
                    >
                      <HelpCircle className="h-4 w-4 mr-2 text-brand-primary/60 group-hover:text-brand-primary" />
                      <span>Help & Support</span>
                    </button>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-brand-secondary/10 pt-2">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 font-medium flex items-center group"
                      role="menuitem"
                    >
                      <LogOut className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
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

export default SharedHeader;