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
   Navigation builder
  ----------------------------------------------------- */
  const getNavigation = () => {
    const isOfficer = profile?.role === "relationship_officer";

    const baseNavigation = [
      { name: "Dashboard", href: "/dashboard", icon: Home },
    ];

    const analyticsNavigation = [
      {
        name: "Analytics",
        href: "/analytics",
        icon: BarChart3,
        roles: ["credit_analyst_officer"], // 🔐 ONLY analysts
      },
    ];

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

    const accountingNavigation = !isOfficer
      ? [
          {
            name: "Accounting",
            href: "/accounting",
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
            ],
          },
        ]
      : [];

    const registryChildren = [{ name: "Customers", href: "/registry/customers", icon: Users }];

    if (isOfficer) {
      registryChildren.push({
        name: "Add Customer",
        href: "/officer/customers/add",
        icon: UserPlus,
      });
    }

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

    const sharedNavigation = [
      {
        name: "Registry",
        href: "/registry",
        icon: Users,
        children: registryChildren,
      },
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
            href: "/loaning/disbursement-loans",
            icon: FileText,
          },
          {
            name: "Rejected Loans",
            href: "/loaning/rejected-loans",
            icon: FileText,
          },
          {
            name: "Penalty Settings",
            href: "/loaning/penalty-settings",
            icon: Settings,
            roles: ["credit_analyst_officer"],
          },
          {
            name: "Limit Adjustment",
            href: "/loaning/limit-adjustment",
            icon: Sliders,
            roles: ["credit_analyst_officer"],
          },
        ],
      },
      {
        name: "Drafts",
        href: "/drafts",
        icon: FileText,
        children: draftsChildren,
      },
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

    return [
      ...baseNavigation,
      ...analyticsNavigation,
      ...officerNavigation,
      ...accountingNavigation,
      ...sharedNavigation,
    ];
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
          <Menu className="h-6 w-6 text-slate-600 hover:text-[#586ab1]" />
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
          className={`fixed inset-y-0 left-0 w-64 bg-[#d9e2e8] shadow-2xl z-50 flex flex-col transform transition-transform duration-300 font-sans ${
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Header with Logo at the beginning (far left) */}
          <div className="flex items-center justify-between p-4 border-b border-gray-300 flex-shrink-0 h-20">
            <div className="flex items-center justify-start">
              <img
                src="/jasiri.png"
                alt="Jasiri Logo"
                className="w-32 h-auto object-contain"
              />
            </div>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X className="h-5 w-5 text-slate-600 hover:text-[#586ab1]" />
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
                      className={`group flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-all duration-200 hover:text-[#586ab1] text-slate-600 ${
                        expandedItems[item.name]
                          ? "text-[#586ab1]"
                          : "text-slate-600"
                      }`}
                    >
                      <div className="flex items-center">
                        <item.icon
                          className="h-5 w-5 mr-3 flex-shrink-0 transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]"
                        />
                        <span className="text-base  whitespace-nowrap truncate transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]">
                          {item.name}
                        </span>
                      </div>
                      {expandedItems[item.name] ? (
                        <ChevronUp 
                          className="h-4 w-4 transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]" 
                        />
                      ) : (
                        <ChevronDown 
                          className="h-4 w-4 transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]" 
                        />
                      )}
                    </div>

                    {expandedItems[item.name] && (
                      <div className="ml-2 pl-4 mt-1 space-y-1 border-l-2 border-gray-300">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.name}
                            to={child.href}
                            onClick={handleNavClick}
                            className={({ isActive }) =>
                              `group flex items-center px-3 py-2 rounded-lg transition-all duration-200 whitespace-nowrap hover:text-[#586ab1] text-slate-600 ${
                                isActive
                                  ? "text-[#586ab1]"
                                  : "text-slate-600"
                              }`
                            }
                          >
                            <child.icon
                              className="h-3.5 w-3.5 mr-2 flex-shrink-0 transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]"
                            />
                            <span className="text-sm  truncate transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]">
                              {child.name}
                            </span>
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
                      `group flex items-center px-3 py-3 rounded-lg transition-all duration-200 whitespace-nowrap hover:text-[#586ab1] text-slate-600 ${
                        isActive
                          ? "text-[#586ab1]"
                          : "text-slate-600"
                      }`
                    }
                  >
                    <item.icon
                      className="h-5 w-5 mr-3 flex-shrink-0 transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]"
                    />
                    <span className="text-base  truncate transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]">
                      {item.name}
                    </span>
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
      className={`h-full bg-[#d9e2e8] border-r border-gray-300 transition-all duration-300 font-sans ${
        isCollapsed ? "w-16" : "w-64"
      } flex-shrink-0 relative flex flex-col overflow-hidden`}
    >
      {/* Header - Logo at the beginning (far left) */}
      <div className="flex items-center p-4 border-b border-gray-300 flex-shrink-0 h-20 relative">
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
          className={`p-2 rounded-lg border border-gray-300 transition-all duration-200 ${
            isCollapsed 
              ? "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" 
              : "absolute top-4 right-4"
          }`}
          style={{ 
            backgroundColor: "#586ab1",
            color: "white"
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
                className={`group flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-all duration-200 hover:text-[#586ab1] text-slate-600 ${
                  expandedItems[item.name] && !isCollapsed
                    ? "text-[#586ab1]"
                    : "text-slate-600"
                } ${isCollapsed ? "justify-center" : ""}`}
              >
                <div className="flex items-center">
                  <div
                    className={`flex items-center justify-center ${
                      isCollapsed ? "mr-0" : "mr-3"
                    }`}
                  >
                    <item.icon
                      className="h-5 w-5 transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]"
                    />
                  </div>
                  {!isCollapsed && (
                    <span className="text-base  whitespace-nowrap truncate transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]">
                      {item.name}
                    </span>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="transition-colors">
                    {expandedItems[item.name] ? (
                      <ChevronUp 
                        className="h-4 w-4 transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]" 
                      />
                    ) : (
                      <ChevronDown 
                        className="h-4 w-4 transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]" 
                      />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-3 py-3 rounded-lg transition-all duration-200 hover:text-[#586ab1] text-slate-600 ${
                    isActive
                      ? "text-[#586ab1]"
                      : "text-slate-600"
                  } ${isCollapsed ? "justify-center" : ""}`
                }
              >
                <div
                  className={`flex items-center justify-center ${
                    isCollapsed ? "mr-0" : "mr-3"
                  }`}
                >
                  <item.icon 
                    className="h-5 w-5 transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]" 
                  />
                </div>
                {!isCollapsed && (
                  <span className="text-base whitespace-nowrap truncate transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]">
                    {item.name}
                  </span>
                )}
              </NavLink>
            )}

            {/* Submenu */}
            {item.children && !isCollapsed && expandedItems[item.name] && (
              <div className="ml-2 pl-4 mt-1 space-y-1 border-l-2 border-gray-300">
                {item.children.map((child) => (
                  <NavLink
                    key={child.name}
                    to={child.href}
                    className={({ isActive }) =>
                      `group flex items-center px-3 py-2 rounded-lg transition-all duration-200 whitespace-nowrap hover:text-[#586ab1] text-slate-600 ${
                        isActive
                          ? "text-[#586ab1]"
                          : "text-slate-600"
                      }`
                    }
                  >
                    <child.icon
                      className="h-3.5 w-3.5 mr-2 flex-shrink-0 transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]"
                    />
                    <span className="text-sm  truncate transition-colors duration-200 text-slate-600 group-hover:text-[#586ab1]">
                      {child.name}
                    </span>
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