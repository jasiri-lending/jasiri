// src/components/SharedSidebar.jsx
import { useState, useEffect, useMemo } from "react";

import { NavLink, useLocation } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Database,
  Network,
  History,
  LogOut,
  Bell,
  Eye,
  Users,
  FileText,
  Calculator,
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
  Home,
  BarChart3
} from "lucide-react";
import { useAuth } from "../hooks/userAuth";
import { usePermissions } from "../hooks/usePermissions";

const SharedSidebar = () => {
  const [expandedItems, setExpandedItems] = useState({});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { profile } = useAuth();
  const { hasPermission, permissions } = usePermissions();
  const location = useLocation();

  /* -----------------------------------------------------
   Role access helper
  ----------------------------------------------------- */
  const hasAccess = (item) => {
    if (item.permission && !hasPermission(item.permission)) return false;
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

  /* -----------------------------------------------------
   Accordion toggle — same as every other module
  ----------------------------------------------------- */
  const toggleItem = (itemName) => {
    setExpandedItems((prev) => ({
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
   Navigation builder
  ----------------------------------------------------- */
  const getNavigation = () => {
    const isOfficer = profile?.role === "relationship_officer";
    const isSuperAdmin = profile?.role === "superadmin";
    const isAdmin = profile?.role === "admin";
    const isCreditAnalyst = profile?.role === "credit_analyst_officer";
    const isFinance = profile?.role === "accountant" || profile?.role === "finance_officer" || isCreditAnalyst;
    const hasAnalyticsAccess = ["admin", "superadmin", "branch_manager", "regional_manager", "credit_analyst_officer"].includes(profile?.role);

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
        { name: "Main Dashboard", href: "/dashboard/main", icon: PieChart },
        { name: "Financial Dashboard", href: "/financial/dashboard", icon: DollarSign }
      );
    } else {
      dashboardChildren.push(
        { name: "Main Dashboard", href: "/dashboard/main", icon: Home },
        { name: "Operations Dashboard", href: "/operations/dashboard", icon: Workflow }
      );
      if (isFinance) {
        dashboardChildren.push({ name: "Financial Dashboard", href: "/financial/dashboard", icon: DollarSign });
      }
      if (hasAnalyticsAccess) {
        dashboardChildren.push({ name: "Analytics Dashboard", href: "/analytics", icon: BarChart3 });
      }
    }

    const dashboardNavigation = [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: Gauge,
        children: dashboardChildren,

      },
    ];

    const officerNavigation = isOfficer
      ? [
        { name: "Leads", href: "/officer/leads", icon: UserPlus },
        { name: "Loan Applications", href: "/officer/loans/applications", icon: FileText },
      ]
      : [];

    const accountsFinanceNavigation = (isAdmin || isSuperAdmin || isFinance)
      ? [
        {
          name: "Accounts & Finance",
          href: "/accounts-finance",
          icon: Calculator,
          children: [
            { name: "Accounts Setup", href: "/accounting/chart-of-accounts", icon: BookOpen },
            { name: "Accounting Journals", href: "/accounting/journals", icon: Book },
            { name: "Financial Transactions", href: "/accounting/transactions", icon: CreditCard },
            { name: "Bank Reconciliations", href: "/accounting/bank-reconciliations", icon: Landmark },
          ],
        },
      ]
      : [];

    const creditSettingsNavigation = (isAdmin || isSuperAdmin)
      ? [
        {
          name: "Credit Settings",
          href: "/credit-settings",
          icon: Sliders,
          roles: ["admin", "superadmin"],
          children: [
            { name: "Loan Products", href: "/credit-settings/loan-products", icon: FileText },
            { name: "Scoring Engine", href: "/credit-settings/scoring", icon: Activity },
            { name: "Credit Limits", href: "/credit-settings/limits", icon: Sliders },
            { name: "Penalty Rules", href: "/credit-settings/penalties", icon: Settings },
          ],
        },
      ]
      : [];

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
            { name: "Tenant Features", href: "/tenant-features/admin", icon: Sliders },
            { name: "MPESA Config", href: "/tenants/mpesa-config/admin", icon: CreditCard },
          ],
        },
      ]
      : [];

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

    const administrationNavigation = (isAdmin || isSuperAdmin)
      ? [
        {
          name: "Administration",
          href: "/administration",
          icon: Settings,
          roles: ["admin", "superadmin"],
          children: [
            { name: "Branches", href: "/branches/admin", icon: GitBranch },
            { name: "Regions", href: "/regions/admin", icon: Map },
            { name: "Users", href: "/users/all/admin", icon: Users },
            { name: "User Groups", href: "/user-groups/admin", icon: Share2 },
            { name: "Partners", href: "/partners/admin", icon: Handshake },
            { name: "Report Access", href: "/users/report-access/admin", icon: FileKey },
            { name: "Workflow Settings", href: "/workflow-setting/admin", icon: Workflow },
            { name: "Workflow Statuses", href: "/workflow-statuses/admin", icon: ListTodo },
            { name: "Roles & Permissions", href: "/roles/admin", icon: ShieldAlert },
          ],
        },
      ]
      : [];

    const registryChildren = [
      { name: "Customers", href: "/registry/customers", icon: Users },
      { name: "Pending Amendments", href: isOfficer ? "/officer/customers/amendments" : "/registry/pending-amendments", icon: ClipboardList },
      { name: "BM Pending", href: "/registry/bm-pending", icon: UserCheck },
      { name: "Spoof Calling", href: "/registry/callbacks-pending", icon: PhoneCall },
      { name: "HQ Pending", href: "/registry/hq-pending", icon: UserCheck },
      { name: "Approvals Pending", href: "/registry/approvals-pending", icon: UserCheck },
      { name: "Customer Transfer", href: "/registry/customer-transfer", icon: Users },
      // { name: "Customer Categories", href: "/registry/customer-categories", icon: FolderOpen },
      { name: "Customer Edits", href: "/registry/customer-edits", icon: FileSpreadsheet },
      // { name: "Prequalified Amount Edit", href: "/registry/prequalified-amount-edit", icon: CreditCard },
      { name: "Guarantors", href: "/registry/guarantors", icon: Handshake },
      { name: "Refunds", href: "/admin/refunds", icon: DollarSign, permission: "refund.approve" }
    ];

    const loaningNavigation = [
      {
        name: "Loaning",
        href: "/loaning",
        icon: FileText,
        children: [
          { name: "All Loans", href: "/loaning/all", icon: FileText },
          { name: "Pending Branch Manager", href: "/loaning/pending-branch-manager", icon: FileText },
          { name: "Pending Regional Manager", href: "/loaning/pending-regional-manager", icon: FileText },
          { name: "Pending Disbursement", href: "/loaning/pending-disbursement", icon: FileText },
          { name: "Disbursed Loans", href: "/loaning/disbursement-loans", icon: FileText },
          { name: "Rejected Loans", href: "/loaning/rejected-loans", icon: FileText },
        ],
      },
    ];

    const draftsChildren = [
      isOfficer
        ? { name: "Customer Drafts", href: "/officer/customers/drafts", icon: FileText }
        : { name: "Customer Verification Drafts", href: "/drafts/customers", icon: UserCheck },
    ];

    const reportsNavigation = [
      {
        name: "Reports",
        href: "/reports",
        icon: BarChart3,
        children: [
          { name: "All Reports", href: "/reports/all", icon: FileText },
          { name: "PTP Reports", href: "/reports/ptp", icon: Handshake },
        ],
      },
    ];

    const sharedNavigation = [
      { name: "Registry", href: "/registry", icon: Users, children: registryChildren },
      ...loaningNavigation,
      { name: "Drafts", href: "/drafts", icon: FileText, children: draftsChildren },
      ...reportsNavigation,
    ];

    if (isSuperAdmin) {
      return [...dashboardNavigation, ...creditSettingsNavigation, ...tenantManagementNavigation, ...accountsFinanceNavigation, ...systemSettingsNavigation, ...auditLogsNavigation, ...administrationNavigation, ...sharedNavigation];
    } else if (isAdmin) {
      return [...dashboardNavigation, ...creditSettingsNavigation, ...accountsFinanceNavigation, ...administrationNavigation, ...sharedNavigation];
    } else if (isOfficer) {
      return [...dashboardNavigation, ...officerNavigation, ...sharedNavigation];
    } else if (isCreditAnalyst) {
      return [...dashboardNavigation, ...accountsFinanceNavigation, ...sharedNavigation];
    } else {
      return [...dashboardNavigation, ...sharedNavigation];
    }
  };

  const navigation = useMemo(() => {
    return getNavigation()
      .filter(hasAccess)
      .map((item) =>
        item.children
          ? { ...item, children: item.children.filter(hasAccess) }
          : item
      );
  }, [profile?.role, permissions]);


  const sidebarStyles = {
    bg: "bg-muted", // Light bluish-gray from tailwind config
    text: "text-slate-600",
    activeText: "text-brand-primary",
    hoverBg: "hover:bg-brand-primary/10",
    activeBg: "bg-brand-primary/10",
    border: "border-slate-200",
    icon: "text-slate-500",
    activeIcon: "text-brand-primary"
  };

  // Mobile View
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setIsMobileOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-stone-200 lg:hidden"
          style={{ display: isMobileOpen ? "none" : "block" }}
        >
          <Menu className="h-5 w-5 text-stone-600" />
        </button>

        {isMobileOpen && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsMobileOpen(false)} />
        )}

        <div className={`fixed inset-y-0 left-0 w-64 ${sidebarStyles.bg} shadow-2xl z-50 flex flex-col transform transition-transform duration-300 font-sans ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between px-4 border-b border-black/5 flex-shrink-0 h-[76px] relative">
            <div className="flex items-center justify-center w-full h-full relative">
              <img 
                src="/jasirif.png" 
                alt="Jasiri Logo" 
                style={{ height: '96px', width: 'auto', imageRendering: 'crisp-edges', display: 'block', position: 'absolute' }}
              />
            </div>

            <button onClick={() => setIsMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-black/5 transition-colors">
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1.5 custom-scrollbar">
            {navigation.map((item) => {
              const isParentActive = item.children?.some(
                (child) => location.pathname === child.href || location.pathname.startsWith(child.href + "/")
              );

              return (
                <div key={item.name}>
                  {item.children ? (
                    <div>
                      <div
                        onClick={() => toggleItem(item.name)}
                        className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 border-l-[3px] ${
                          isParentActive
                            ? "border-transparent text-brand-primary font-bold bg-transparent"
                            : expandedItems[item.name]
                            ? "border-transparent text-brand-primary font-bold bg-transparent"
                            : "border-transparent text-slate-600 hover:bg-black/5 hover:border-black/10"
                        }`}
                      >
                        <div className="flex items-center">
                          <item.icon className={`h-4 w-4 mr-3 shrink-0 transition-colors ${
                            (isParentActive || expandedItems[item.name]) ? "text-brand-primary" : "text-slate-500"
                          }`} />
                          <span className={`text-sm tracking-tight truncate ${(isParentActive || expandedItems[item.name]) ? 'font-bold' : 'font-semibold'}`}>{item.name}</span>
                        </div>
                        <div className="transition-transform duration-200">
                          {expandedItems[item.name] ? (
                            <ChevronDown className="h-3.5 w-3.5 text-brand-primary" />
                          ) : (
                            <ChevronRight className={`h-3.5 w-3.5 ${isParentActive ? 'text-brand-primary opacity-100' : 'opacity-40 group-hover:opacity-100'}`} />
                          )}
                        </div>
                      </div>

                      {expandedItems[item.name] && (
                        <div className="ml-4 pl-3 mt-1.5 space-y-1 border-l-2 border-slate-200 animate-in slide-in-from-top-1 duration-200">
                          {item.children.map((child) => {
                            const isChildActive = location.pathname === child.href || location.pathname.startsWith(child.href + "/");
                            return (
                              <NavLink
                                key={child.name}
                                to={child.href}
                                onClick={handleNavClick}
                                className={`group flex items-center px-3 py-2 rounded-md transition-all duration-200 whitespace-nowrap text-[13px] ${
                                  isChildActive
                                    ? "text-brand-primary bg-brand-primary/10 font-bold shadow-sm ring-1 ring-brand-primary/20"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-black/5 font-medium"
                                }`}
                              >
                                <child.icon className={`h-3.5 w-3.5 mr-2.5 shrink-0 transition-opacity duration-200 ${
                                  isChildActive ? 'text-brand-primary opacity-100' : 'text-slate-400 opacity-70 group-hover:opacity-100 group-hover:text-slate-600'
                                }`} />
                                <span className="truncate">{child.name}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <NavLink
                      to={item.href}
                      onClick={handleNavClick}
                      className={({ isActive }) =>
                        `group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 whitespace-nowrap border-l-[3px] ${
                          isActive 
                            ? "border-transparent text-brand-primary font-bold bg-transparent" 
                            : "border-transparent text-slate-600 hover:bg-black/5 hover:border-black/10 font-semibold"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={`h-4 w-4 mr-3 shrink-0 transition-colors ${isActive ? "text-brand-primary" : "text-slate-500"}`} />
                          <span className="truncate">{item.name}</span>
                        </>
                      )}
                    </NavLink>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </>
    );
  }

  // Desktop Sidebar
  return (
    <div className={`h-full ${sidebarStyles.bg} border-r border-black/5 transition-all duration-300 font-sans ${isCollapsed ? "w-16" : "w-60"} flex-shrink-0 relative flex flex-col overflow-hidden`}>
      <div className="flex items-center px-4 border-b border-black/5 flex-shrink-0 h-[76px] relative">
        {!isCollapsed && (
          <div className="flex items-center justify-center w-full h-full relative">
            <img 
              src="/jasirif.png" 
              alt="Jasiri Logo" 
              style={{ height: '176px', width: 'auto', imageRendering: 'crisp-edges', display: 'block', position: 'absolute' }}
            />
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className={`p-1.5 rounded-lg border border-slate-200 transition-all duration-200 bg-white shadow-sm text-slate-400 hover:text-brand-primary ${isCollapsed ? "absolute left-1/2 -translate-x-1/2" : "absolute right-4"}`}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 space-y-1.5 custom-scrollbar">
        {navigation.map((item) => {
          const isParentActive = item.children?.some(
            (child) => location.pathname === child.href || location.pathname.startsWith(child.href + "/")
          );
          
          return (
            <div key={item.name}>
              {item.children ? (
                <div>
                  <div
                    onClick={() => !isCollapsed && toggleItem(item.name)}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 border-l-[3px] ${
                      isParentActive && !isCollapsed
                        ? "border-transparent text-brand-primary font-bold bg-transparent"
                        : expandedItems[item.name] && !isCollapsed
                        ? "border-transparent text-brand-primary font-bold bg-transparent"
                        : "border-transparent text-slate-600 hover:bg-black/5 hover:border-black/10"
                    } ${isCollapsed ? "justify-center border-l-0" : ""}`}
                  >
                    <div className="flex items-center">
                      <item.icon className={`h-4 w-4 shrink-0 transition-colors ${isCollapsed ? "mr-0" : "mr-3"} ${
                        (isParentActive || expandedItems[item.name]) ? "text-brand-primary" : "text-slate-500"
                      }`} />
                      {!isCollapsed && <span className={`text-sm tracking-tight truncate ${(isParentActive || expandedItems[item.name]) ? 'font-bold' : 'font-semibold'}`}>{item.name}</span>}
                    </div>
                    {!isCollapsed && (
                      <div className="transition-transform duration-200">
                        {expandedItems[item.name] ? (
                          <ChevronDown className="h-3.5 w-3.5 text-brand-primary" />
                        ) : (
                          <ChevronRight className={`h-3.5 w-3.5 ${isParentActive ? 'text-brand-primary opacity-100' : 'opacity-40 group-hover:opacity-100'}`} />
                        )}
                      </div>
                    )}
                  </div>

                  {!isCollapsed && expandedItems[item.name] && (
                    <div className="ml-4 pl-3 mt-1.5 space-y-1 border-l-2 border-slate-200 animate-in slide-in-from-top-1 duration-200">
                      {item.children.map((child) => {
                        const isChildActive = location.pathname === child.href || location.pathname.startsWith(child.href + "/");
                        return (
                          <NavLink
                            key={child.name}
                            to={child.href}
                            className={`group flex items-center px-3 py-2 rounded-md transition-all duration-200 whitespace-nowrap text-[13px] ${
                              isChildActive
                                ? "text-brand-primary bg-brand-primary/10 font-bold shadow-sm ring-1 ring-brand-primary/20"
                                : "text-slate-500 hover:text-slate-900 hover:bg-black/5 font-medium"
                            }`}
                          >
                            <child.icon className={`h-3.5 w-3.5 mr-2.5 shrink-0 transition-opacity duration-200 ${
                              isChildActive ? 'text-brand-primary opacity-100' : 'text-slate-400 opacity-70 group-hover:opacity-100 group-hover:text-slate-600'
                            }`} />
                            <span className="truncate">{child.name}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    `group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 border-l-[3px] ${
                      isActive 
                        ? "border-transparent text-brand-primary font-bold bg-transparent" 
                        : "border-transparent text-slate-600 hover:bg-black/5 hover:border-black/10 font-semibold"
                    } ${isCollapsed ? "justify-center border-l-0" : ""}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className={`flex items-center justify-center shrink-0 ${isCollapsed ? "mr-0" : "mr-3"}`}>
                        <item.icon className={`h-4 w-4 transition-colors ${isActive ? "text-brand-primary" : "text-slate-500"}`} />
                      </div>
                      {!isCollapsed && <span className="text-sm tracking-tight truncate">{item.name}</span>}
                    </>
                  )}
                </NavLink>
              )}
            </div>
          );
        })}
      </nav>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
};

export default SharedSidebar;
