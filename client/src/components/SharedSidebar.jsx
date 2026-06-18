// src/components/SharedSidebar.jsx
import { useState, useEffect, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, ChevronDown, XCircle, Menu,
  Settings, Sliders, TrendingUp, PieChart, DollarSign, Activity,
  GitBranch, Map, Share2, FileKey, Workflow, ListTodo, ShieldAlert,
  Building, Gauge, Shield, Database, Network, History, LogOut,
  Bell, Eye, Users, FileText, Calculator, BookOpen, Book, CreditCard,
  Landmark, FolderOpen, UserCheck, PhoneCall, Handshake, UserPlus,
  ClipboardList, FileSpreadsheet, Home, BarChart3, CheckCircle,
} from "lucide-react";
import { useAuth } from "../hooks/userAuth";
import { usePermissions } from "../hooks/usePermissions";

const SharedSidebar = () => {
  const [expandedItems, setExpandedItems] = useState({});
  const [isCollapsed, setIsCollapsed]     = useState(false);
  const [isMobileOpen, setIsMobileOpen]   = useState(false);
  const [isMobile, setIsMobile]           = useState(false);
  const { profile }                        = useAuth();
  const { hasPermission, permissions }     = usePermissions();
  const location                           = useLocation();

  /* ── Role access helper ─────────────────────────────────── */
  const hasAccess = (item) => {
    if (item.permission && !hasPermission(item.permission)) return false;
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.includes(profile?.role);
  };

  /* ── Mobile detection ───────────────────────────────────── */
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

  /* ── Accordion toggle ───────────────────────────────────── */
  const toggleItem = (itemName) =>
    setExpandedItems((prev) => ({ [itemName]: !prev[itemName] }));

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileOpen((v) => !v);
    } else {
      setIsCollapsed((v) => !v);
      if (!isCollapsed) setExpandedItems({});
    }
  };

  const handleNavClick = () => { if (isMobile) setIsMobileOpen(false); };

  /* ── Navigation builder ─────────────────────────────────── */
  const getNavigation = () => {
    const isOfficer       = profile?.role === "relationship_officer";
    const isSuperAdmin    = profile?.role === "superadmin";
    const isAdmin         = profile?.role === "admin";
    const isCreditAnalyst = profile?.role === "credit_analyst_officer";
    const isFinance       = profile?.role === "accountant" || profile?.role === "finance_officer" || isCreditAnalyst;
    const hasAnalyticsAccess = ["admin","superadmin","branch_manager","regional_manager","credit_analyst_officer"].includes(profile?.role);

    const dashboardChildren = [];
    if (isSuperAdmin) {
      dashboardChildren.push(
        { name: "SuperAdmin Dashboard",  href: "/dashboard/superadmin",    icon: Home },
        { name: "Analytics Dashboard",   href: "/analytics",                icon: BarChart3 },
        { name: "Performance Dashboard", href: "/dashboard/performance",    icon: TrendingUp },
        { name: "General Analysis",      href: "/dashboard/main",           icon: PieChart },
        { name: "Financial Dashboard",   href: "/financial/dashboard",      icon: DollarSign },
        { name: "Operations Dashboard",  href: "/operations/dashboard",     icon: Workflow },
        { name: "System Health",         href: "/dashboard/system-health",  icon: Activity },
      );
    } else if (isAdmin) {
      dashboardChildren.push(
        { name: "Admin Dashboard",      href: "/dashboard/admin",       icon: Home },
        { name: "Analytics Dashboard",  href: "/analytics",             icon: BarChart3 },
        { name: "Main Dashboard",       href: "/dashboard/main",        icon: PieChart },
        { name: "Operations Dashboard", href: "/operations/dashboard",  icon: Workflow },
        { name: "Financial Dashboard",  href: "/financial/dashboard",   icon: DollarSign },
      );
    } else {
      dashboardChildren.push(
        { name: "Main Dashboard",       href: "/dashboard/main",       icon: Home },
        { name: "Operations Dashboard", href: "/operations/dashboard", icon: Workflow },
      );
      if (isFinance)          dashboardChildren.push({ name: "Financial Dashboard", href: "/financial/dashboard", icon: DollarSign });
      if (hasAnalyticsAccess) dashboardChildren.push({ name: "Analytics Dashboard", href: "/analytics",          icon: BarChart3  });
    }

    const dashboardNavigation     = [{ name: "Dashboard",         href: "/dashboard",         icon: Gauge,      children: dashboardChildren }];
    const accountsFinanceNavigation = (isAdmin || isSuperAdmin || isFinance) ? [{
      name: "Accounts & Finance", href: "/accounts-finance", icon: Calculator,
      children: [
        { name: "Accounts Setup",         href: "/accounting/chart-of-accounts",     icon: BookOpen  },
        { name: "Accounting Journals",    href: "/accounting/journals",               icon: Book      },
        { name: "Financial Transactions", href: "/accounting/transactions",           icon: CreditCard },
        { name: "Bank Reconciliations",   href: "/accounting/bank-reconciliations",   icon: Landmark  },
      ],
    }] : [];
    const creditSettingsNavigation  = (isAdmin || isSuperAdmin) ? [{
      name: "Credit Settings", href: "/credit-settings", icon: Sliders, roles: ["admin","superadmin"],
      children: [
        { name: "Loan Products", href: "/credit-settings/loan-products", icon: FileText  },
        { name: "Scoring Engine",href: "/credit-settings/scoring",       icon: Activity  },
        { name: "Credit Limits", href: "/credit-settings/limits",        icon: Sliders   },
        { name: "Penalty Rules", href: "/credit-settings/penalties",     icon: Settings  },
      ],
    }] : [];
    const tenantManagementNavigation = isSuperAdmin ? [{
      name: "Tenant Management", href: "/tenant-management", icon: Building, roles: ["superadmin"],
      children: [
        { name: "All Tenants",    href: "/users/tenants/admin",           icon: Building  },
        { name: "Create Tenant",  href: "/users/create-tenant/admin",     icon: Building  },
        { name: "Tenant Billing", href: "/tenant-management/billing",     icon: CreditCard },
        { name: "Tenant Usage",   href: "/tenant-management/usage",       icon: Activity  },
        { name: "Tenant Features",href: "/tenant-features/admin",         icon: Sliders   },
        { name: "MPESA Config",   href: "/tenants/mpesa-config/admin",    icon: CreditCard },
      ],
    }] : [];
    const systemSettingsNavigation = isSuperAdmin ? [{
      name: "System Settings", href: "/system-settings", icon: Settings, roles: ["superadmin"],
      children: [
        { name: "General Settings", href: "/system-settings/general",   icon: Settings  },
        { name: "Email Settings",   href: "/system-settings/email",     icon: Bell      },
        { name: "SMS Settings",     href: "/system-settings/sms",       icon: PhoneCall },
        { name: "API Configuration",href: "/system-settings/api-config",icon: Network   },
        { name: "Database Settings",href: "/system-settings/database",  icon: Database  },
        { name: "Backup & Restore", href: "/system-settings/backup",    icon: Shield    },
        { name: "System Updates",   href: "/system-settings/updates",   icon: History   },
      ],
    }] : [];
    const auditLogsNavigation = isSuperAdmin ? [{
      name: "Audit & Logs", href: "/audit-logs", icon: Eye, roles: ["superadmin"],
      children: [
        { name: "System Logs",       href: "/audit-logs/system",        icon: Activity   },
        { name: "User Activity Logs",href: "/audit-logs/user-activity", icon: Users      },
        { name: "Login History",     href: "/audit-logs/login-history", icon: LogOut     },
        { name: "API Access Logs",   href: "/audit-logs/api",           icon: Network    },
        { name: "Security Events",   href: "/audit-logs/security",      icon: ShieldAlert},
        { name: "Data Changes",      href: "/audit-logs/data-changes",  icon: Database   },
      ],
    }] : [];
    const administrationNavigation = (isAdmin || isSuperAdmin) ? [{
      name: "Administration", href: "/administration", icon: Settings, roles: ["admin","superadmin"],
      children: [
        { name: "Branches",           href: "/branches/admin",                 icon: GitBranch  },
        { name: "Regions",            href: "/regions/admin",                  icon: Map        },
        { name: "Users",              href: "/users/all/admin",                icon: Users      },
        { name: "Add User",           href: "/users/add/admin",                icon: UserPlus   },
        { name: "Suspended Users",    href: "/users/suspended/admin",          icon: ShieldAlert},
        { name: "User Groups",        href: "/user-groups/admin",              icon: Share2     },
        { name: "Partners",           href: "/partners/admin",                 icon: Handshake  },
        { name: "Report Access",      href: "/users/report-access/admin",      icon: FileKey    },
        { name: "Workflow Settings",  href: "/workflow-setting/admin",         icon: Workflow   },
        { name: "Workflow Statuses",  href: "/workflow-statuses/admin",        icon: ListTodo   },
        { name: "Roles & Permissions",href: "/roles/admin",                    icon: ShieldAlert},
      ],
    }] : [];

    const registryChildren = [
      { name: "Customers",          href: isOfficer ? "/officer/customers" : "/registry/customers",                       icon: Users        },
    ];
    if (isOfficer) {
      registryChildren.push({ name: "Add Customer", href: "/officer/customers/add", icon: UserPlus });
    }
    registryChildren.push(
      { name: "Pending Amendments", href: isOfficer ? "/officer/customers/amendments" : "/registry/pending-amendments",  icon: ClipboardList },
      { name: "Pending Approvals",  href: "/registry/approvals-pending",                                                  icon: UserCheck    },
      { name: "Customer Transfer",  href: "/registry/customer-transfer",                                                  icon: Users        },
      { name: "Customer Edits",     href: "/registry/customer-edits",                                                     icon: FileSpreadsheet },
      { name: "Guarantors",         href: "/registry/guarantors",                                                         icon: Handshake    },
      { name: "Refunds",            href: "/admin/refunds",                                                               icon: DollarSign, permission: "refund.approve" },
    );

    const leadsChildren = [
      { name: "All Leads",       href: "/leads/all",       icon: Users    },
      { name: "Aging Leads",     href: "/leads/aging",     icon: History  },
      { name: "Converted Leads", href: "/leads/converted", icon: CheckCircle },
      { name: "Lead Insights",   href: "/leads/insights",  icon: BarChart3 },
    ];

    const loaningChildren = [];
    if (isAdmin || isSuperAdmin) {
      loaningChildren.push(
        { name: "All Loans (Admin)",           href: "/loans/all/admin",             icon: FileText },
        { name: "Pending (Admin)",             href: "/loans/pending/admin",         icon: FileText },
        { name: "Rejected (Admin)",            href: "/loans/rejected/admin",        icon: FileText },
        { name: "Disbursed (Admin)",           href: "/loans/disbursed/admin",       icon: FileText },
        { name: "Restructure (Admin)",         href: "/loans/restructure/admin",     icon: FileText },
        { name: "Write-offs (Admin)",          href: "/loans/writeoffs/admin",       icon: FileText },
      );
    } else if (isOfficer) {
      loaningChildren.push(
        { name: "Loans Dashboard",              href: "/officer/loans",                        icon: Home },
        { name: "Loan Applications",            href: "/officer/loans/applications",           icon: FileText },
        { name: "Approval Queue",               href: "/officer/loans/approval",               icon: FileText },
        { name: "Disbursed Loans",              href: "/loaning/disbursement-loans",           icon: CheckCircle },
      );
    } else {
      loaningChildren.push(
        { name: "All Loans",                    href: "/loaning/all",                          icon: FileText },
        { name: "Pending Branch Manager",       href: "/loaning/pending-branch-manager",       icon: FileText },
        { name: "Pending Regional Manager",     href: "/loaning/pending-regional-manager",     icon: FileText },
        { name: "Pending Disbursement",         href: "/loaning/pending-disbursement",         icon: FileText },
        { name: "Disbursed Loans",              href: "/loaning/disbursement-loans",           icon: FileText },
        { name: "Rejected Loans",               href: "/loaning/rejected-loans",               icon: FileText },
      );
    }

    const loaningNavigation = [{
      name: "Loaning", href: "/loaning", icon: FileText,
      children: loaningChildren
    }];

    const draftsChildren = [
      isOfficer
        ? { name: "Customer Drafts",              href: "/officer/customers/drafts", icon: FileText  }
        : { name: "Customer Verification Drafts", href: "/drafts/customers",         icon: UserCheck },
    ];
    if (isOfficer) {
      draftsChildren.push({ name: "Loan Drafts", href: "/officer/loans/drafts", icon: FileText });
    }

    const reportsNavigation = [{
      name: "Reports", href: "/reports", icon: BarChart3,
      children: [
        { name: "All Reports",      href: "/reports/all",             icon: FileText  },
        { name: "Income Statement", href: "/reports/income-statement",icon: BarChart3 },
        { name: "PTP Reports",      href: "/reports/ptp",             icon: Handshake },
      ],
    }];

    const sharedNavigation = [
      { name: "Leads",    href: "/leads",   icon: UserPlus, children: leadsChildren    },
      { name: "Registry", href: "/registry",icon: Users,    children: registryChildren },
      ...loaningNavigation,
      { name: "Drafts",   href: "/drafts",  icon: FileText, children: draftsChildren   },
      ...reportsNavigation,
    ];

    if (isSuperAdmin) return [...dashboardNavigation, ...creditSettingsNavigation, ...tenantManagementNavigation, ...accountsFinanceNavigation, ...systemSettingsNavigation, ...auditLogsNavigation, ...administrationNavigation, ...sharedNavigation];
    if (isAdmin)      return [...dashboardNavigation, ...creditSettingsNavigation, ...accountsFinanceNavigation, ...administrationNavigation, ...sharedNavigation];
    if (isCreditAnalyst) return [...dashboardNavigation, ...accountsFinanceNavigation, ...sharedNavigation];
    return [...dashboardNavigation, ...sharedNavigation];
  };

  const navigation = useMemo(() =>
    getNavigation()
      .filter(hasAccess)
      .map((item) => item.children ? { ...item, children: item.children.filter(hasAccess) } : item),
    [profile?.role, permissions]
  );

  /* ── Shared class fragments (Forest Finance tokens) ─────── */
  // Parent button — inactive
  const parentBase   = "group w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 font-outfit min-w-0";
  const parentIdle   = "text-muted hover:bg-surface";
  const parentActive = "text-brand bg-surface";
  // Child link — inactive
  const childBase    = "group flex items-center px-3 py-2 rounded-md transition-all duration-200 font-outfit text-sm min-w-0";
  const childIdle    = "text-muted hover:text-heading hover:bg-surface font-medium";
  const childActive  = "text-brand bg-surface font-semibold";
  // Icon
  const iconIdle     = "text-muted opacity-70 group-hover:opacity-100";
  const iconActive   = "text-brand opacity-100";
  // Leaf NavLink
  const leafBase     = "group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 font-outfit font-semibold min-w-0";
  const leafIdle     = "text-muted hover:bg-surface";
  const leafActive   = "text-brand";

  /* ════════════════════════════════════════════════════════════
     MOBILE
  ════════════════════════════════════════════════════════════ */
  if (isMobile) {
    return (
      <>
        {/* Hamburger */}
        <button
          onClick={() => setIsMobileOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 bg-card rounded-lg shadow-card border border-border lg:hidden"
          style={{ display: isMobileOpen ? "none" : "block" }}
        >
          <Menu className="h-5 w-5 text-muted" />
        </button>

        {/* Backdrop */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-midnight/70 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Drawer */}
        <div className={`
          fixed inset-y-0 left-0 w-72 bg-card shadow-modal z-50 flex flex-col font-outfit
          transition-transform duration-300
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 border-b border-border-light flex-shrink-0 h-[76px]">
            <div className="flex items-center justify-start w-full h-full pl-4">
              <img src="/jasiri_f.png" alt="Jasiri Logo" style={{ height: "120px", width: "auto", objectFit: "contain" }} />
            </div>
            <button onClick={() => setIsMobileOpen(false)} className="p-1.5 rounded-full hover:bg-surface transition-colors">
              <XCircle className="h-5 w-5 text-muted" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1.5 custom-scrollbar">
            {navigation.map((item, index) => {
              const isParentActive = item.children?.some(
                (c) => location.pathname === c.href || location.pathname.startsWith(c.href + "/")
              );
              return (
                <div key={item.name}>
                  {item.children ? (
                    <div className="mb-1">
                      <button
                        onClick={() => toggleItem(item.name)}
                        className={`${parentBase} ${(isParentActive || expandedItems[item.name]) ? parentActive : parentIdle}`}
                      >
                        <div className="flex items-center min-w-0">
                          <item.icon className={`h-5 w-5 mr-3 shrink-0 transition-colors ${(isParentActive || expandedItems[item.name]) ? iconActive : iconIdle}`} />
                          <span className="text-base tracking-tight truncate font-semibold">{item.name}</span>
                        </div>
                        <span className="transition-transform duration-300">
                          {expandedItems[item.name]
                            ? <ChevronDown  className={`h-4 w-4 ${iconActive}`} />
                            : <ChevronRight className={`h-4 w-4 ${isParentActive ? iconActive : "text-muted opacity-60 group-hover:opacity-100"}`} />
                          }
                        </span>
                      </button>

                      {expandedItems[item.name] && (
                        <div className="ml-2 pl-2 mt-1 space-y-0.5 border-l border-border-light animate-in slide-in-from-top-1 duration-300">
                          {item.children.map((child) => {
                            const isChildActive = location.pathname === child.href || location.pathname.startsWith(child.href + "/");
                            return (
                              <NavLink key={child.name} to={child.href} onClick={handleNavClick}
                                className={`${childBase} ${isChildActive ? childActive : childIdle}`}
                              >
                                <child.icon className={`h-4 w-4 mr-2.5 shrink-0 transition-opacity duration-300 ${isChildActive ? iconActive : iconIdle}`} />
                                <span className="leading-tight truncate">{child.name}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mb-1">
                      <NavLink to={item.href} onClick={handleNavClick}
                        className={({ isActive }) => `${leafBase} ${isActive ? leafActive : leafIdle}`}
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon className={`h-5 w-5 mr-3 shrink-0 transition-colors ${isActive ? iconActive : iconIdle}`} />
                            <span className="text-base tracking-tight truncate">{item.name}</span>
                          </>
                        )}
                      </NavLink>
                    </div>
                  )}

                  {index < navigation.length - 1 && (
                    <div className="my-1.5 border-b border-border-light" />
                  )}
                </div>
              );
            })}
          </nav>

          <style>{scrollbarCSS}</style>
        </div>
      </>
    );
  }

  /* ════════════════════════════════════════════════════════════
     DESKTOP
  ════════════════════════════════════════════════════════════ */
  return (
    <div className={`
      h-full bg-white border-r border-border-light
      transition-all duration-300 font-outfit flex-shrink-0
      relative flex flex-col overflow-hidden z-50
      ${isCollapsed ? "w-16" : "w-72"}
    `}>
      {/* Header */}
      <div className="flex items-center px-4 border-b border-border-light flex-shrink-0 h-[76px] relative">
        {!isCollapsed && (
          <div className="flex items-center justify-center w-full h-full">
            <img src="/jasiri_f.png" alt="Jasiri Logo" className="h-40 w-auto object-contain" />
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className={`
            p-1.5 transition-all duration-200 text-muted hover:text-brand rounded-md hover:bg-mint/10
            ${isCollapsed ? "absolute left-1/2 -translate-x-1/2" : "absolute right-4"}
          `}
        >
          {isCollapsed ? <ChevronRight className="h-6 w-6" /> : <ChevronLeft className="h-6 w-6" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 space-y-1.5 custom-scrollbar">
        {navigation.map((item, index) => {
          const isParentActive = item.children?.some(
            (c) => location.pathname === c.href || location.pathname.startsWith(c.href + "/")
          );
          return (
            <div key={item.name} className="relative">
              {item.children ? (
                <div className="mb-1">
                  <button
                    onClick={() => !isCollapsed && toggleItem(item.name)}
                    className={`
                      ${parentBase}
                      ${(isParentActive || expandedItems[item.name]) && !isCollapsed ? parentActive : parentIdle}
                      ${isCollapsed ? "justify-center" : ""}
                    `}
                  >
                    <div className="flex items-center min-w-0">
                      <item.icon className={`
                        h-5 w-5 shrink-0 transition-colors
                        ${isCollapsed ? "mr-0" : "mr-3"}
                        ${(isParentActive || expandedItems[item.name]) ? iconActive : iconIdle}
                      `} />
                      {!isCollapsed && (
                        <span className="text-base truncate font-semibold">{item.name}</span>
                      )}
                    </div>
                    {!isCollapsed && (
                      <span className="transition-transform duration-300">
                        {expandedItems[item.name]
                          ? <ChevronDown  className={`h-4 w-4 ${iconActive}`} />
                          : <ChevronRight className={`h-4 w-4 ${isParentActive ? iconActive : "text-muted opacity-60 group-hover:opacity-100"}`} />
                        }
                      </span>
                    )}
                  </button>

                  {!isCollapsed && expandedItems[item.name] && (
                    <div className="ml-2 pl-2 mt-1 space-y-0.5 border-l border-border-light animate-in slide-in-from-top-1 duration-300">
                      {item.children.map((child) => {
                        const isChildActive = location.pathname === child.href || location.pathname.startsWith(child.href + "/");
                        return (
                          <NavLink key={child.name} to={child.href}
                            className={`${childBase} ${isChildActive ? childActive : childIdle}`}
                          >
                            <child.icon className={`h-4 w-4 mr-2.5 shrink-0 transition-opacity duration-300 ${isChildActive ? iconActive : iconIdle}`} />
                            <span className="leading-tight truncate">{child.name}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-1">
                  <NavLink
                    to={item.href}
                    className={({ isActive }) =>
                      `${leafBase} ${isActive ? leafActive : leafIdle} ${isCollapsed ? "justify-center" : ""}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={`
                          h-5 w-5 shrink-0 transition-colors
                          ${isCollapsed ? "mr-0" : "mr-3"}
                          ${isActive ? iconActive : iconIdle}
                        `} />
                        {!isCollapsed && (
                          <span className="text-base truncate">{item.name}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                </div>
              )}

              {index < navigation.length - 1 && !isCollapsed && (
                <div className="mx-4 my-1.5 border-b border-border-light" />
              )}
            </div>
          );
        })}
      </nav>

      <style>{scrollbarCSS}</style>
    </div>
  );
};

/* ── Scrollbar styles ───────────────────────────────────────── */
const scrollbarCSS = `
  .custom-scrollbar::-webkit-scrollbar        { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track  { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb  { background: rgba(26,122,74,0.15); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(26,122,74,0.30); }
`;

export default SharedSidebar;