// src/components/SharedSidebar.jsx
import { useState, useEffect } from "react";
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
} from "lucide-react";
import { useAuth } from "../hooks/userAuth";

const SharedSidebar = () => {
  const [expandedItems, setExpandedItems] = useState({});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { profile } = useAuth();
  const location = useLocation();

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setIsMobileOpen(false);
      }
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
      setIsMobileOpen(!isMobileOpen);
    } else {
      setIsCollapsed(!isCollapsed);
      if (!isCollapsed) {
        setExpandedItems({});
      }
    }
  };

  const handleNavClick = () => {
    if (isMobile) {
      setIsMobileOpen(false);
    }
  };

  // Auto-expand parent when child is active
  useEffect(() => {
    getNavigation().forEach((item) => {
      if (item.children) {
        const isChildActive = item.children.some(
          (child) =>
            location.pathname === child.href ||
            location.pathname.startsWith(child.href + "/")
        );
        if (isChildActive) {
          setExpandedItems((prev) => ({
            ...prev,
            [item.name]: true,
          }));
        }
      }
    });
  }, [location.pathname, profile?.role]);

  const getNavigation = () => {
    const isOfficer = profile?.role === "relationship_officer";

    const baseNavigation = [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: Home,
      },
    ];

    const officerNavigation = isOfficer
      ? [
          {
            name: "Leads",
            href: "/officer/leads",
            icon: UserPlus,
          },
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

    // Registry Children - Dynamic based on role
    const registryChildren = [
      { name: "Customers", href: "/registry/customers", icon: Users },
    ];

    // Add Customer - Only for Relationship Officers
    if (isOfficer) {
      registryChildren.push({
        name: "Add Customer",
        href: "/officer/customers/add",
        icon: UserPlus,
      });
    }

    // Pending Amendments - Different routes for officers vs others
    if (isOfficer) {
      registryChildren.push({
        name: "Pending Amendments",
        href: "/officer/customers/amendments",
        icon: ClipboardList,
      });
    } else {
      registryChildren.push({
        name: "Pending Amendments",
        href: "/registry/pending-amendments",
        icon: ClipboardList,
      });
    }

    // Continue with shared registry items
    registryChildren.push(
      {
        name: "BM Pending",
        href: "/registry/bm-pending",
        icon: UserCheck,
      },
      {
        name: "Callbacks Pending",
        href: "/registry/callbacks-pending",
        icon: PhoneCall,
      },
      {
        name: "HQ Pending",
        href: "/registry/hq-pending",
        icon: UserCheck,
      },
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
      }
    );

    // Drafts Navigation - Dynamic based on role
    const draftsChildren = [];

    if (isOfficer) {
      draftsChildren.push({
        name: "Customer Drafts",
        href: "/officer/customers/drafts",
        icon: FileText,
      });
    } else {
      draftsChildren.push({
        name: "Customer Verification Drafts",
        href: "/drafts/customers",
        icon: UserCheck,
      });
    }

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
      ...officerNavigation,
      ...accountingNavigation,
      ...sharedNavigation,
    ];
  };

  const navigation = getNavigation();

  // Mobile View
  if (isMobile) {
    return (
      <>
        {/* Floating Menu Button - ALWAYS visible on mobile */}
        <button
          onClick={() => setIsMobileOpen(true)}
          className="fixed top-4 left-4 z-50 p-3 bg-white rounded-lg shadow-lg hover:shadow-xl transition-all border border-gray-200 lg:hidden"
          style={{ display: isMobileOpen ? "none" : "block" }}
        >
          <Menu className="h-6 w-6" style={{ color: "#586ab1" }} />
        </button>

        {/* Overlay - only visible when sidebar is open */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 w-72 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ${
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Header with Logo and Close Icon */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <img
                src="jasiri.png"
                alt="Jasiri Logo"
                className="w-12 h-12 object-contain rounded-lg"
              />
            </div>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-2 rounded-lg hover:bg-white transition-colors"
            >
              <X className="h-5 w-5" style={{ color: "#586ab1" }} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.children ? (
                  <div>
                    <div
                      onClick={() => toggleItem(item.name)}
                      className={`group flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all ${
                        expandedItems[item.name]
                          ? "bg-blue-100 shadow-md border border-blue-200"
                          : "hover:bg-white hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center">
                        <item.icon
                          className="h-5 w-5 mr-3 flex-shrink-0"
                          style={{ color: "#586ab1" }}
                        />
                        <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                          {item.name}
                        </span>
                      </div>
                      {expandedItems[item.name] ? (
                        <ChevronUp
                          className="h-4 w-4"
                          style={{ color: "#586ab1" }}
                        />
                      ) : (
                        <ChevronDown
                          className="h-4 w-4"
                          style={{ color: "#586ab1" }}
                        />
                      )}
                    </div>

                    {expandedItems[item.name] && (
                      <div className="ml-2 pl-4 mt-2 space-y-1 border-l-2 border-blue-300">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.name}
                            to={child.href}
                            onClick={handleNavClick}
                            className={({ isActive }) =>
                              `flex items-center px-3 py-2 text-xs rounded-lg transition-all whitespace-nowrap ${
                                isActive
                                  ? "bg-gradient-to-r from-blue-100 to-blue-50 text-blue-900 font-semibold shadow-sm border-l-3 border-blue-600"
                                  : "text-gray-700 hover:text-gray-900 hover:bg-white/80 hover:shadow-sm"
                              }`
                            }
                          >
                            <child.icon
                              className="h-3.5 w-3.5 mr-2 flex-shrink-0"
                              style={{ color: "#586ab1" }}
                            />
                            <span className="font-medium truncate">
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
                      `group flex items-center px-3 py-3 rounded-xl transition-all whitespace-nowrap ${
                        isActive
                          ? "bg-blue-100 shadow-md border border-blue-200"
                          : "hover:bg-white hover:shadow-sm"
                      }`
                    }
                  >
                    <item.icon
                      className="h-5 w-5 mr-3 flex-shrink-0"
                      style={{ color: "#586ab1" }}
                    />
                    <span className="text-sm font-semibold text-gray-800 truncate">
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

  // Desktop Sidebar
  return (
    <div
      className={`h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-gray-800 border-r border-gray-200 transition-all duration-300 ${
        isCollapsed ? "w-20" : "w-72"
      } flex-shrink-0 relative flex flex-col overflow-hidden`}
    >
      {/* Header - Logo always visible in both states */}
      <div
        className={`flex items-center justify-between p-4 flex-shrink-0 ${
          isCollapsed ? "flex-col space-y-4" : ""
        }`}
      >
        <div
          className={`flex items-center ${
            isCollapsed ? "justify-center w-full" : "space-x-3"
          }`}
        >
          <img
            src="/jasiri.png"
            alt="Jasiri Logo"
            className={`object-contain transition-all duration-300 ${
              isCollapsed ? "w-12 h-12" : "w-30 h-30"
            }`}
          />
        </div>

        {/* Collapse Button - Always visible and properly positioned */}
        <button
          onClick={toggleSidebar}
          className={`p-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:text-blue-600 hover:border-blue-300 transition-all duration-300 shadow-sm hover:shadow-md ${
            isCollapsed ? "w-full flex justify-center" : ""
          }`}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" style={{ color: "#586ab1" }} />
          ) : (
            <ChevronLeft className="h-4 w-4" style={{ color: "#586ab1" }} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {navigation.map((item) => (
          <div key={item.name}>
            {item.children ? (
              <div
                onClick={() => !isCollapsed && toggleItem(item.name)}
                className={`group flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all duration-300 ${
                  expandedItems[item.name] && !isCollapsed
                    ? "bg-blue-100 shadow-lg border border-blue-200"
                    : "bg-transparent hover:bg-white hover:shadow-md hover:border hover:border-gray-200"
                } ${isCollapsed ? "justify-center" : ""}`}
              >
                <div className="flex items-center">
                  <div
                    className={`flex items-center justify-center ${
                      isCollapsed ? "mr-0" : "mr-3"
                    }`}
                  >
                    <item.icon
                      className="h-4 w-4"
                      style={{ color: "#586ab1" }}
                    />
                  </div>
                  {!isCollapsed && (
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {item.name}
                    </span>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="text-gray-500 group-hover:text-gray-700 transition-colors">
                    {expandedItems[item.name] ? (
                      <ChevronUp
                        className="h-4 w-4"
                        style={{ color: "#586ab1" }}
                      />
                    ) : (
                      <ChevronDown
                        className="h-4 w-4"
                        style={{ color: "#586ab1" }}
                      />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-3 py-3 rounded-xl transition-all duration-300 ${
                    isActive
                      ? "bg-blue-100 shadow-lg border border-blue-200"
                      : "bg-transparent hover:bg-white hover:shadow-md hover:border hover:border-gray-200"
                  } ${isCollapsed ? "justify-center" : ""}`
                }
              >
                <div
                  className={`flex items-center justify-center ${
                    isCollapsed ? "mr-0" : "mr-3"
                  }`}
                >
                  <item.icon className="h-4 w-4" style={{ color: "#586ab1" }} />
                </div>
                {!isCollapsed && (
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {item.name}
                  </span>
                )}
              </NavLink>
            )}

            {/* Submenu */}
            {item.children && !isCollapsed && expandedItems[item.name] && (
              <div className="ml-2 pl-4 mt-2 space-y-1 border-l-2 border-blue-300">
                {item.children.map((child) => (
                  <NavLink
                    key={child.name}
                    to={child.href}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 text-xs rounded-lg transition-all duration-300 whitespace-nowrap ${
                        isActive
                          ? "bg-gradient-to-r from-blue-100 to-blue-50 text-blue-900 font-semibold shadow-sm border-l-3 border-blue-600"
                          : "text-gray-700 hover:text-gray-900 hover:bg-white/80 hover:shadow-sm"
                      }`
                    }
                  >
                    <child.icon
                      className="h-3.5 w-3.5 mr-2 flex-shrink-0"
                      style={{ color: "#586ab1" }}
                    />
                    <span className="font-medium truncate">{child.name}</span>
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