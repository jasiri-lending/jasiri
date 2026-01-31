// src/components/SharedSidebar.jsx
import { useState, useEffect, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  Calculator,
  Users,
  FileText,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Book,
  CreditCard,
  Landmark,
  FolderOpen,
  UserCheck,
  PhoneCall,
  Handshake,
  UserPlus,
  ClipboardList,
  FileSpreadsheet,
  X,
  Menu,
  Settings,
  Sliders,
  TrendingUp,
  PieChart,
  DollarSign,
  Activity,
  GitBranch,
  Map,
  Share2,
  FileKey,
  Workflow,
  ListTodo,
  ShieldAlert,
  Building,
  Gauge,
  Shield,
  FileBarChart,
  Database,
  Network,
  History,
  LogOut,
  Bell,
  Eye,
} from "lucide-react";
import { useAuth } from "../hooks/userAuth";

const SharedSidebar = () => {
  const [expandedItems, setExpandedItems] = useState({});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { profile } = useAuth();
  const location = useLocation();

  /* -----------------------------------------------------
   Role access helper
  ----------------------------------------------------- */
  const hasAccess = (item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.includes(profile?.role);
  };

  /* -----------------------------------------------------
   Mobile detection
  ----------------------------------------------------- */
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setIsMobileOpen(false);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const toggleItem = (itemName) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemName]: !prev[itemName],
    }));
  };

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileOpen((v) => !v);
    } else {
      setIsCollapsed((v) => !v);
      if (!isCollapsed) setExpandedItems({});
    }
  };

  const handleNavClick = () => {
    if (isMobile) setIsMobileOpen(false);
  };

  /* -----------------------------------------------------
   Navigation builder - REORGANIZED FOR SUPERADMIN
  ----------------------------------------------------- */
  const getNavigation = () => {
    const isOfficer = profile?.role === "relationship_officer";
    const isSuperAdmin = profile?.role === "superadmin";
    const isAdmin = profile?.role === "admin";
    const isCreditAnalyst = profile?.role === "credit_analyst_officer";

    // ==================== DASHBOARD MODULE ====================
    const dashboardChildren = [];
    
    if (isSuperAdmin) {
      dashboardChildren.push(
        { name: "SuperAdmin Dashboard", href: "/dashboard/superadmin", icon: Home },
        { name: "Analytics Dashboard", href: "/dashboard/analytics", icon: BarChart3 },
        { name: "Performance Dashboard", href: "/dashboard/performance", icon: TrendingUp },
        { name: "General Analysis", href: "/dashboard/general-analysis", icon: PieChart },
        { name: "Financial Dashboard", href: "/dashboard/financial", icon: DollarSign },
        { name: "System Health", href: "/dashboard/system-health", icon: Activity }
      );
    } else if (isAdmin) {
      dashboardChildren.push(
        { name: "Admin Dashboard", href: "/dashboard/admin", icon: Home },
        { name: "Analytics Dashboard", href: "/analytics", icon: BarChart3 },
        { name: "Performance Dashboard", href: "/dashboard/performance", icon: TrendingUp },
        { name: "General Analysis", href: "/dashboard/general-analysis", icon: PieChart },
        { name: "Financial Dashboard", href: "/dashboard/financial", icon: DollarSign }
      );
    } else {
      dashboardChildren.push(
        { name: "Main Dashboard", href: "/dashboard", icon: Home },
        { name: "Performance Dashboard", href: "/dashboard/performance", icon: TrendingUp },
        { name: "Operations Dashboard", href: "/operations/dashboard", icon: Workflow },

        { name: "Financial Dashboard", href: "/financial/dashboard", icon: DollarSign }


      );
      
      // Add analytics for credit analyst officer (linked to /analytics)
      if (isCreditAnalyst) {
        dashboardChildren.push(
          { name: "Analytics", href: "/analytics", icon: BarChart3 }
        );
      }
    }

    const dashboardNavigation = [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: Gauge,
        children: dashboardChildren.filter(hasAccess),
      },
    ];

    // ==================== OFFICER-SPECIFIC ====================
    const officerNavigation = isOfficer
      ? [
          { name: "Leads", href: "/officer/leads", icon: UserPlus },
          {
            name: "Loan Applications",
            href: "/officer/loans/applications",
            icon: FileText,
          },
        ]
      : [];

    // ==================== ACCOUNTS & FINANCE MODULE ====================
    // Now accessible to: admin, superadmin, and credit_analyst_officer
    const accountsFinanceNavigation = (isAdmin || isCreditAnalyst)
      ? [
          {
            name: "Accounts & Finance",
            href: "/accounts-finance",
            icon: Calculator,
            children: [
              {
                name: "Chart of Accounts",
                href: "/accounting/chart-of-accounts",
                icon: BookOpen,
              },
              { name: "Journals", href: "/accounting/journals", icon: Book },
              {
                name: "Transactions",
                href: "/accounting/transactions",
                icon: CreditCard,
              },
              {
                name: "Bank Reconciliations",
                href: "/accounting/bank-reconciliations",
                icon: Landmark,
              },
             
              {
                name: "Penalty Settings",
                href: "/loaning/penalty-settings",
                icon: Settings,
              },
            ],
          },
        ]
      : [];

    // ==================== TENANT MANAGEMENT MODULE (SuperAdmin only) ====================
    const tenantManagementNavigation = isSuperAdmin
      ? [
          {
            name: "Tenant Management",
            href: "/tenant-management",
            icon: Building,
            roles: ["superadmin"],
            children: [
              { name: "All Tenants", href: "/users/create-tenant/admin", icon: Building },
              { name: "Tenant Billing", href: "/tenant-management/billing", icon: CreditCard },
              { name: "Tenant Usage", href: "/tenant-management/usage", icon: Activity },
              { name: "MPESA Config", href: "/tenants/mpesa-config/admin", icon: CreditCard },
            ],
          },
        ]
      : [];

    // ==================== SYSTEM SETTINGS MODULE (SuperAdmin only) ====================
    const systemSettingsNavigation = isSuperAdmin
      ? [
          {
            name: "System Settings",
            href: "/system-settings",
            icon: Settings,
            roles: ["superadmin"],
            children: [
              { name: "General Settings", href: "/system-settings/general", icon: Settings },
              { name: "Email Settings", href: "/system-settings/email", icon: Bell },
              { name: "SMS Settings", href: "/system-settings/sms", icon: PhoneCall },
              { name: "API Configuration", href: "/system-settings/api-config", icon: Network },
              { name: "Database Settings", href: "/system-settings/database", icon: Database },
              { name: "Backup & Restore", href: "/system-settings/backup", icon: Shield },
              { name: "System Updates", href: "/system-settings/updates", icon: History },
            ],
          },
        ]
      : [];

    // ==================== AUDIT & LOGS MODULE (SuperAdmin only) ====================
    const auditLogsNavigation = isSuperAdmin
      ? [
          {
            name: "Audit & Logs",
            href: "/audit-logs",
            icon: Eye,
            roles: ["superadmin"],
            children: [
              { name: "System Logs", href: "/audit-logs/system", icon: Activity },
              { name: "User Activity Logs", href: "/audit-logs/user-activity", icon: Users },
              { name: "Login History", href: "/audit-logs/login-history", icon: LogOut },
              { name: "API Access Logs", href: "/audit-logs/api", icon: Network },
              { name: "Security Events", href: "/audit-logs/security", icon: ShieldAlert },
              { name: "Data Changes", href: "/audit-logs/data-changes", icon: Database },
            ],
          },
        ]
      : [];

    // ==================== ADMINISTRATION MODULE (for admin & superadmin) ====================
    const administrationNavigation = (isAdmin || isSuperAdmin)
      ? [
          {
            name: "Administration",
            href: "/administration",
            icon: Settings,
            roles: ["admin", "superadmin"],
            children: [
              { name: "Branches", href: "/administration/branches", icon: GitBranch },
              { name: "Regions", href: "/administration/regions", icon: Map },
              { name: "Users", href: "/administration/users", icon: Users },
              { name: "User Groups", href: "/administration/user-groups", icon: Share2 },
              { name: "Partners", href: "/administration/partners", icon: Handshake },
              { name: "Report Access", href: "/administration/report-access", icon: FileKey },
              { name: "Workflow Settings", href: "/administration/workflow-settings", icon: Workflow },
              { name: "Workflow Statuses", href: "/administration/workflow-statuses", icon: ListTodo },
              { name: "Roles & Permissions", href: "/administration/roles-permissions", icon: ShieldAlert },
            ],
          },
        ]
      : [];

    // ==================== REGISTRY MODULE ====================
    const registryChildren = [
      { name: "Customers", href: "/registry/customers", icon: Users }
    ];

    registryChildren.push(
      {
        name: "Pending Amendments",
        href: isOfficer
          ? "/officer/customers/amendments"
          : "/registry/pending-amendments",
        icon: ClipboardList,
      },
      { name: "BM Pending", href: "/registry/bm-pending", icon: UserCheck },
      {
        name: "Callbacks Pending",
        href: "/registry/callbacks-pending",
        icon: PhoneCall,
      },
      { name: "HQ Pending", href: "/registry/hq-pending", icon: UserCheck },
      {
        name: "Approvals Pending",
        href: "/registry/approvals-pending",
        icon: UserCheck,
      },
      {
        name: "Customer Transfer",
        href: "/registry/customer-transfer",
        icon: Users,
      },
      {
        name: "Customer Categories",
        href: "/registry/customer-categories",
        icon: FolderOpen,
      },
      {
        name: "Customer Edits",
        href: "/registry/customer-edits",
        icon: FileSpreadsheet,
      },
      {
        name: "Prequalified Amount Edit",
        href: "/registry/prequalified-amount-edit",
        icon: CreditCard,
      },
      { name: "Guarantors", href: "/registry/guarantors", icon: Handshake }
    );

    // ==================== LOANING MODULE ====================
    const loaningNavigation = [
      {
        name: "Loaning",
        href: "/loaning",
        icon: FileText,
        children: [
          { name: "All Loans", href: "/loaning/all", icon: FileText },
          {
            name: "Pending Branch Manager",
            href: "/loaning/pending-branch-manager",
            icon: FileText,
          },
          {
            name: "Pending Regional Manager",
            href: "/loaning/pending-regional-manager",
            icon: FileText,
          },
          {
            name: "Pending HQ",
            href: "/loaning/pending-hq",
            icon: FileText,
          },
          {
            name: "Pending Disbursement",
            href: "/loaning/pending-disbursement",
            icon: FileText,
          },
          {
            name: "Disbursed Loans",
            href: "/loaning/disbursed-loans",
            icon: FileText,
          },
          {
            name: "Rejected Loans",
            href: "/loaning/rejected-loans",
            icon: FileText,
          },
          {
            name: "Limit Adjustment",
            href: "/loaning/limit-adjustment",
            icon: Sliders,
            roles: ["credit_analyst_officer", "admin", "superadmin"],
          },
        ],
      },
    ];

    // ==================== DRAFTS MODULE ====================
    const draftsChildren = [
      isOfficer
        ? {
            name: "Customer Drafts",
            href: "/officer/customers/drafts",
            icon: FileText,
          }
        : {
            name: "Customer Verification Drafts",
            href: "/drafts/customers",
            icon: UserCheck,
          },
    ];

    // ==================== REPORTS MODULE ====================
    const reportsNavigation = [
      {
        name: "Reports",
        href: "/reports",
        icon: BarChart3,
        children: [
          { name: "All Reports", href: "/reports/all", icon: FileText },
          { name: "Financial Reports", href: "/reports/financial", icon: DollarSign },
          { name: "Performance Reports", href: "/reports/performance", icon: TrendingUp },
          { name: "Audit Reports", href: "/reports/audit", icon: Eye },
          { name: "PTP Reports", href: "/reports/ptp", icon: Handshake },
        ],
      },
    ];

    // ==================== COMBINE ALL MODULES ====================
    const sharedNavigation = [
      {
        name: "Registry",
        href: "/registry",
        icon: Users,
        children: registryChildren,
      },
      ...loaningNavigation,
      {
        name: "Drafts",
        href: "/drafts",
        icon: FileText,
        children: draftsChildren,
      },
      ...reportsNavigation,
    ];

    // Return navigation based on role
    if (isSuperAdmin) {
      return [
        ...dashboardNavigation,
        ...tenantManagementNavigation,
        ...accountsFinanceNavigation,
        ...systemSettingsNavigation,
        ...auditLogsNavigation,
        ...administrationNavigation,
        ...sharedNavigation,
      ];
    } else if (isAdmin) {
      return [
        ...dashboardNavigation,
        ...accountsFinanceNavigation,
        ...administrationNavigation,
        ...sharedNavigation,
      ];
    } else if (isOfficer) {
      return [
        ...dashboardNavigation,
        ...officerNavigation,
        ...sharedNavigation,
      ];
    } else if (isCreditAnalyst) {
      return [
        ...dashboardNavigation,
        ...accountsFinanceNavigation,
        ...sharedNavigation,
      ];
    } else {
      return [
        ...dashboardNavigation,
        ...sharedNavigation,
      ];
    }
  };

  /* -----------------------------------------------------
   Filter navigation by role (TOP + CHILDREN)
  ----------------------------------------------------- */
  const navigation = useMemo(() => {
    return getNavigation()
      .filter(hasAccess)
      .map((item) =>
        item.children
          ? {
              ...item,
              children: item.children.filter(hasAccess),
            }
          : item
      );
  }, [profile?.role]);

  /* -----------------------------------------------------
   Auto-expand active parent
  ----------------------------------------------------- */
  useEffect(() => {
    navigation.forEach((item) => {
      if (!item.children) return;
      const active = item.children.some(
        (child) =>
          location.pathname === child.href ||
          location.pathname.startsWith(child.href + "/")
      );
      if (active) {
        setExpandedItems((prev) => ({ ...prev, [item.name]: true }));
      }
    });
  }, [location.pathname, navigation]);

  // Mobile View
  if (isMobile) {
    return (
      <>
        {/* Floating Menu Button - ALWAYS visible on mobile */}
        <button
          onClick={() => setIsMobileOpen(true)}
          className="fixed top-4 left-4 z-50 p-3 bg-white rounded-lg shadow-lg hover:shadow-xl transition-all border border-gray-200 lg:hidden font-sans"
          style={{ display: isMobileOpen ? "none" : "block" }}
        >
          <Menu className="h-6 w-6 text-slate-700 hover:text-brand-primary" />
        </button>

        {/* Overlay - only visible when sidebar is open */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Sidebar - Reduced width from w-72 to w-64 */}
        <div
          className={`fixed inset-y-0 left-0 w-64 bg-brand-surface shadow-2xl z-50 flex flex-col transform transition-transform duration-300 font-sans ${
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Header with Logo at the beginning (far left) */}
          <div className="flex items-center justify-between p-4 border-b border-brand-secondary/20 flex-shrink-0 h-20">
            <div className="flex items-center justify-start">
              <img
                src="/jasiri.png"
                alt="Jasiri Logo"
                className="w-32 h-auto object-contain"
              />
            </div>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-2 rounded-lg hover:bg-brand-secondary/10 transition-colors"
            >
              <X className="h-5 w-5 text-slate-700 hover:text-brand-primary" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.children ? (
                  <div>
                    <div
                      onClick={() => toggleItem(item.name)}
                      className={`group flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
                        expandedItems[item.name]
                          ? "bg-brand-secondary/10 text-brand-primary"
                          : "text-slate-700 hover:bg-brand-secondary/5 hover:text-brand-primary"
                      }`}
                    >
                      <div className="flex items-center">
                        <item.icon
                          className={`h-5 w-5 mr-3 flex-shrink-0 transition-colors duration-200 ${
                            expandedItems[item.name]
                              ? "text-brand-primary"
                              : "text-slate-700 group-hover:text-brand-primary"
                          }`}
                        />
                        <span className="text-base whitespace-nowrap truncate font-medium">
                          {item.name}
                        </span>
                      </div>
                      {expandedItems[item.name] ? (
                        <ChevronUp className="h-4 w-4 text-brand-primary" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-700 group-hover:text-brand-primary" />
                      )}
                    </div>

                    {expandedItems[item.name] && (
                      <div className="ml-2 pl-4 mt-1 space-y-1 border-l-2 border-brand-secondary/20">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.name}
                            to={child.href}
                            onClick={handleNavClick}
                            className={({ isActive }) =>
                              `group flex items-center px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap font-medium ${
                                isActive
                                  ? "text-brand-primary bg-brand-secondary/5"
                                  : "text-slate-700 hover:text-brand-primary hover:bg-brand-secondary/5"
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <child.icon
                                  className={`h-3.5 w-3.5 mr-2 flex-shrink-0 transition-colors duration-200 ${
                                    isActive
                                      ? "text-brand-primary"
                                      : "text-slate-700 group-hover:text-brand-primary"
                                  }`}
                                />
                                <span className="text-sm truncate">
                                  {child.name}
                                </span>
                              </>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <NavLink
                    to={item.href}
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `group flex items-center px-3 py-3 rounded-xl transition-all duration-200 whitespace-nowrap font-medium ${
                        isActive
                          ? "text-brand-primary bg-brand-secondary/5"
                          : "text-slate-700 hover:bg-brand-secondary/5 hover:text-brand-primary"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={`h-5 w-5 mr-3 flex-shrink-0 transition-colors duration-200 ${
                            isActive
                              ? "text-brand-primary"
                              : "text-slate-700 group-hover:text-brand-primary"
                          }`}
                        />
                        <span className="text-base truncate">{item.name}</span>
                      </>
                    )}
                  </NavLink>
                )}
              </div>
            ))}
          </nav>
        </div>
      </>
    );
  }

  // Desktop Sidebar - Reduced width from w-72 to w-64
  return (
    <div
      className={`h-full bg-brand-surface border-r border-brand-secondary/20 transition-all duration-300 font-sans ${
        isCollapsed ? "w-20" : "w-64"
      } flex-shrink-0 relative flex flex-col overflow-hidden`}
    >
      {/* Header - Logo at the beginning (far left) */}
      <div className="flex items-center p-4 border-b border-brand-secondary/20 flex-shrink-0 h-20 relative">
        {/* Logo - Left aligned when sidebar is expanded */}
        {!isCollapsed && (
          <div className="flex items-start justify-start w-full">
            <img
              src="/jasirif.png"
              alt="Jasiri Logo"
              className="w-32 h-auto object-contain"
            />
          </div>
        )}

        {/* Collapse Button */}
        <button
          onClick={toggleSidebar}
          className={`p-2 rounded-lg border border-brand-secondary/20 transition-all duration-200 ${
            isCollapsed
              ? "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              : "absolute top-4 right-4"
          }`}
          style={{
            backgroundColor: "#fff",
            color: "#2E5E99",
          }}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navigation.map((item) => (
          <div key={item.name}>
            {item.children ? (
              <div
                onClick={() => !isCollapsed && toggleItem(item.name)}
                className={`group flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
                  expandedItems[item.name] && !isCollapsed
                    ? "bg-brand-secondary/10 text-brand-primary"
                    : "text-slate-700 hover:bg-brand-secondary/5 hover:text-brand-primary"
                } ${isCollapsed ? "justify-center" : ""}`}
              >
                <div className="flex items-center">
                  <div
                    className={`flex items-center justify-center ${
                      isCollapsed ? "mr-0" : "mr-3"
                    }`}
                  >
                    <item.icon
                      className={`h-5 w-5 transition-colors duration-200 ${
                        expandedItems[item.name] && !isCollapsed
                          ? "text-brand-primary"
                          : "text-slate-700 group-hover:text-brand-primary"
                      }`}
                    />
                  </div>
                  {!isCollapsed && (
                    <span className="text-base whitespace-nowrap truncate font-medium">
                      {item.name}
                    </span>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="transition-colors">
                    {expandedItems[item.name] ? (
                      <ChevronUp className="h-4 w-4 text-brand-primary" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-700 group-hover:text-brand-primary" />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-3 py-3 rounded-xl transition-all duration-200 font-medium ${
                    isActive
                      ? "text-brand-primary bg-brand-secondary/5"
                      : "text-slate-700 hover:bg-brand-secondary/5 hover:text-brand-primary"
                  } ${isCollapsed ? "justify-center" : ""}`
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={`flex items-center justify-center ${
                        isCollapsed ? "mr-0" : "mr-3"
                      }`}
                    >
                      <item.icon
                        className={`h-5 w-5 transition-colors duration-200 ${
                          isActive
                            ? "text-brand-primary"
                            : "text-slate-700 group-hover:text-brand-primary"
                        }`}
                      />
                    </div>
                    {!isCollapsed && (
                      <span className="text-base whitespace-nowrap truncate">
                        {item.name}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )}

            {/* Submenu */}
            {item.children && !isCollapsed && expandedItems[item.name] && (
              <div className="ml-2 pl-4 mt-1 space-y-1 border-l-2 border-brand-secondary/20">
                {item.children.map((child) => (
                  <NavLink
                    key={child.name}
                    to={child.href}
                    className={({ isActive }) =>
                      `group flex items-center px-3 py-2 rounded-xl transition-all duration-200 whitespace-nowrap font-medium ${
                        isActive
                          ? "text-brand-primary bg-brand-secondary/5"
                          : "text-slate-700 hover:text-brand-primary hover:bg-brand-secondary/5"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <child.icon
                          className={`h-3.5 w-3.5 mr-2 flex-shrink-0 transition-colors duration-200 ${
                            isActive
                              ? "text-brand-primary"
                              : "text-slate-700 group-hover:text-brand-primary"
                          }`}
                        />
                        <span className="text-sm truncate">{child.name}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
};

export default SharedSidebar;