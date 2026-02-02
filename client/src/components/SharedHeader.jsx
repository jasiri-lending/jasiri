import { useNavigate } from "react-router-dom";
import {
  UserCircle, Settings, HelpCircle, LogOut,
  Shield, Menu
} from "lucide-react";
import { useAuth } from "../hooks/userAuth";
import { useTenant } from "../hooks/useTenant";

const SharedHeader = ({ onMenuClick }) => {
  const { profile, isLoading, logout } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const isAdmin = ["admin", "superadmin"].includes(profile?.role);
  const isSuperAdmin = profile?.role === "superadmin";

  // Role badge color mapping


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

  // // Navigation handlers
  // const handleSettingsClick = () => {
  //   navigate(isAdmin ? "/admin/settings" : "/settings");
  // };

  // const handleHelpClick = () => {
  //   navigate("/help");
  // };

  const handleLogout = async () => {
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

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Settings Button */}
            {/* <button
              onClick={handleSettingsClick}
              className="p-2 rounded-lg hover:bg-brand-secondary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 transition-all duration-200"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5 text-brand-primary" />
            </button> */}

            {/* Help Button */}
            {/* <button
              onClick={handleHelpClick}
              className="p-2 rounded-lg hover:bg-brand-secondary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 transition-all duration-200"
              aria-label="Help"
            >
              <HelpCircle className="h-5 w-5 text-brand-primary" />
            </button> */}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200"
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5 text-red-600" />
            </button>

            {/* Profile Button - Simplified version */}
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center space-x-2 lg:space-x-3 p-2 rounded-xl hover:bg-brand-secondary/10 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 transition-all duration-200 group border border-brand-secondary/20"
              aria-label="Go to profile"
            >
              <div className="flex items-center space-x-2 lg:space-x-3">
                <div className="relative">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
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
                    {profile?.full_name || 'User'}
                  </span>
                  <span className="text-xs text-brand-primary/70 leading-tight truncate w-full">
                    {getRoleDisplayName(profile?.role)}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default SharedHeader;