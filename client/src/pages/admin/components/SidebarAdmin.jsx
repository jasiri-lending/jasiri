// src/pages/admin/components/SidebarAdmin.jsx
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../../hooks/userAuth';

import {
  Home,
  Users,
  Settings,
  Building,
  GitBranch,
  Map,
  Share2,
  Handshake,
  FileKey,
  Workflow,
  ListTodo,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  BarChart3,
  DollarSign,
  Bell,
  Database,
  AlertTriangle,
  TrendingUp,
  PieChart,
  FileBarChart,
  UserCog,
  UserPlus,
  UserX,
  Key,
  XCircle,
  Clock,
  CreditCard,
  Landmark,
  CalendarDays,
  Coins,
  Percent,
  Mail,
  MessageSquare,
  Zap,
  Activity,
  Download,
  Eye,
  ShieldAlert,
} from 'lucide-react';

const SidebarAdmin = ({ sidebarOpen, setSidebarOpen }) => {
  const { profile } = useAuth();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState({});

  const toggleItem = (itemName) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemName]: !prev[itemName],
    }));
  };

  const isAdmin = profile?.role === "admin";
  const isSuperAdmin = profile?.role === "superadmin";

  // Admin navigation - simplified menu
  const adminNavigation = [
    { name: 'Dashboard', href: '/dashboard/admin', icon: Home },
    { name: 'Branches', href: '/branches/admin', icon: GitBranch },
    { name: 'Regions', href: '/regions/admin', icon: Map },
    { name: 'Users', href: '/users/all/admin', icon: Users },
    { name: 'User Groups', href: '/user-groups/admin', icon: Share2 },
    { name: 'Partners', href: '/partners/admin', icon: Handshake },
    { name: 'Settings', href: '/settings/admin', icon: Settings },
    { name: 'Report Access', href: '/users/report-access/admin', icon: FileKey },
    { name: 'Workflow Setting', href: '/workflow-setting/admin', icon: Workflow },
    { name: 'Workflow Statuses', href: '/workflow-statuses/admin', icon: ListTodo },
    { name: 'Roles & Permissions', href: '/roles/admin', icon: ShieldAlert },
  ];

  // Super Admin navigation - comprehensive menu with all features
  const superAdminNavigation = [
    { name: 'Dashboard', href: '/dashboard/admin', icon: Home },

    // USER MANAGEMENT
    {
      name: 'User Management',
      href: '/users/admin',
      icon: Users,
      children: [
        { name: 'All Users', href: '/users/all/admin', icon: Users },
        { name: 'Add User', href: '/users/add/admin', icon: UserPlus },
        { name: 'Suspended Users', href: '/users/suspended/admin', icon: UserX },
        { name: 'Report Access', href: '/users/report-access/admin', icon: UserCog },
        { name: 'Report Access', href: '/users/report-access/admin', icon: UserCog },
      ],
    },
    { name: 'Roles & Permissions', href: '/roles/admin', icon: ShieldAlert },

    // TENANT MANAGEMENT
    {
      name: 'Tenant Management',
      href: '/tenants/admin',
      icon: Building,
      children: [
        { name: 'All Tenants', href: '/users/create-tenant/admin', icon: Building },
        { name: 'MPESA Config', href: '/tenants/mpesa-config/admin', icon: CreditCard },
      ],
    },

    // LOANS
    {
      name: 'Loan Management',
      href: '/loans/admin',
      icon: FileText,
      children: [
        { name: 'All Loans', href: '/loans/all/admin', icon: FileText },
        { name: 'Pending Disbursement', href: '/loans/pending/admin', icon: Clock },
        { name: 'Rejected Loans', href: '/loans/rejected/admin', icon: XCircle },
        { name: 'Disbursed Loans', href: '/loans/disbursed/admin', icon: CreditCard },
      ],
    },

    // FINANCIAL TRANSACTIONS
    {
      name: 'Financial Transactions',
      href: '/transactions/admin',
      icon: DollarSign,
      children: [
        { name: 'All Transactions', href: '/transactions/all/admin', icon: CreditCard },
        { name: 'Payments Received', href: '/transactions/payments/admin', icon: Coins },
        { name: 'Disbursements', href: '/transactions/disbursements/admin', icon: Landmark },
        { name: 'Outstanding Balances', href: '/transactions/outstanding/admin', icon: AlertTriangle },
        { name: 'Overdue Loans', href: '/transactions/overdue/admin', icon: CalendarDays },
      ],
    },

    // REPORTS
    {
      name: 'Reports & Analytics',
      href: '/reports/admin',
      icon: BarChart3,
      children: [
        { name: 'Loan Portfolio', href: '/reports/portfolio/admin', icon: PieChart },
        { name: 'Repayment Analysis', href: '/reports/repayment/admin', icon: TrendingUp },
        { name: 'Revenue Reports', href: '/reports/revenue/admin', icon: DollarSign },
        { name: 'User Activity', href: '/reports/user-activity/admin', icon: Activity },
        { name: 'Custom Reports', href: '/reports/custom/admin', icon: FileBarChart },
        { name: 'Export Data', href: '/reports/export/admin', icon: Download },
      ],
    },

    // SETTINGS
    {
      name: 'System Settings',
      href: '/settings/admin',
      icon: Settings,
      children: [
        { name: 'General Settings', href: '/settings/general/admin', icon: Settings },
        { name: 'Interest Rates', href: '/settings/rates/admin', icon: Percent },
        { name: 'Penalty Settings', href: '/penalty-settings/admin', icon: AlertTriangle },
        { name: 'Fees', href: '/settings/fees/admin', icon: Coins },
        { name: 'Integrations', href: '/settings/integrations/admin', icon: Zap },
        { name: 'Notifications', href: '/settings/notifications/admin', icon: Bell },
        { name: 'Email Templates', href: '/settings/email/admin', icon: Mail },
        { name: 'SMS Templates', href: '/settings/sms/admin', icon: MessageSquare },
        { name: 'Backup & Restore', href: '/settings/backup/admin', icon: Database },
      ],
    },

    // AUDIT
    {
      name: 'Audit & Logs',
      href: '/audit/admin',
      icon: Eye,
      children: [
        { name: 'Activity Logs', href: '/audit/activity/admin', icon: Activity },
        { name: 'Login History', href: '/audit/logins/admin', icon: Key },
        { name: 'Loan Changes', href: '/audit/loan-changes/admin', icon: FileText },
        { name: 'User Changes', href: '/audit/user-changes/admin', icon: Users },
        { name: 'Security Events', href: '/audit/security/admin', icon: ShieldAlert },
      ],
    },
  ];

  const navigation = isSuperAdmin ? superAdminNavigation : adminNavigation;

  return (
    <div className={`h-full bg-brand-surface border-r border-brand-secondary/20 transition-all duration-300 flex-shrink-0 relative flex flex-col overflow-hidden ${sidebarOpen ? 'w-64' : 'w-20 hidden md:flex'}`}>

      {/* Header with Logo */}
      <div className="flex items-center justify-between p-4 border-b border-brand-secondary/20 h-20 flex-shrink-0">
        {sidebarOpen ? (
          <div className="flex items-center justify-start w-full">
            <img
              src="/jasirif.png"
              alt="Jasiri Logo"
              className="w-32 h-auto object-contain"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <img
              src="/jasiri-icon.png"
              alt="Icon"
              className="w-8 h-8 object-contain"
              onError={(e) => e.target.style.display = 'none'}
            />
          </div>
        )}

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg border border-brand-secondary/20 bg-white hover:bg-brand-secondary/5 transition-colors md:hidden"
        >
          {sidebarOpen ? (
            <ChevronLeft className="h-4 w-4 text-brand-primary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-brand-primary" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <div key={item.name}>
              {item.children ? (
                <div
                  onClick={() => toggleItem(item.name)}
                  className={`group flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 ${expandedItems[item.name] || location.pathname.startsWith(item.href)
                    ? 'bg-brand-secondary/10 text-brand-primary'
                    : 'text-slate-700 hover:bg-brand-secondary/5 hover:text-brand-primary'
                    } ${!sidebarOpen ? 'justify-center' : ''}`}
                >
                  <div className="flex items-center">
                    <item.icon className={`h-5 w-5 ${sidebarOpen ? 'mr-3' : 'mr-0'} transition-colors duration-200 ${isActive ? 'text-brand-primary' : 'text-slate-700 group-hover:text-brand-primary'
                      }`} />
                    {sidebarOpen && <span className="text-base font-medium truncate">{item.name}</span>}
                  </div>
                  {sidebarOpen && (
                    <div>
                      {expandedItems[item.name] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  )}
                </div>
              ) : (
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    `group flex items-center px-3 py-3 rounded-xl transition-all duration-200 font-medium ${isActive
                      ? 'text-brand-primary bg-brand-secondary/5'
                      : 'text-slate-700 hover:bg-brand-secondary/5 hover:text-brand-primary'
                    } ${!sidebarOpen ? 'justify-center' : ''}`
                  }
                >
                  <item.icon className="h-5 w-5 transition-colors duration-200 flex-shrink-0" />
                  {sidebarOpen && <span className="ml-3 text-base truncate">{item.name}</span>}
                </NavLink>
              )}

              {/* Submenu (if any) */}
              {item.children && sidebarOpen && expandedItems[item.name] && (
                <div className="ml-2 pl-4 mt-1 space-y-1 border-l-2 border-brand-secondary/20">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.name}
                      to={child.href}
                      className={({ isActive }) =>
                        `group flex items-center px-3 py-2 rounded-xl transition-all duration-200 text-sm font-medium ${isActive
                          ? 'text-brand-primary bg-brand-secondary/5'
                          : 'text-slate-700 hover:text-brand-primary hover:bg-brand-secondary/5'
                        }`
                      }
                    >
                      {child.icon && <child.icon className="h-4 w-4 mr-2" />}
                      <span className="truncate">{child.name}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
};

export default SidebarAdmin;
