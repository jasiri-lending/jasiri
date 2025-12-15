// src/components/SidebarAdmin.jsx
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../../hooks/userAuth';

import {
  Home,
  Users,
  FileText,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  Shield,
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
  Building,
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
  const [expandedItems, setExpandedItems] = useState({});

  const toggleItem = (itemName) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemName]: !prev[itemName],
    }));
  };

  // Base Navigation (before filtering by role)
  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/dashboard/admin', 
      icon: Home,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10'
    },

    // USER MANAGEMENT
    {
      name: 'User Management',
      href: '/users/admin',
      icon: Users,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      children: [
        { name: 'All Users', href: '/users/all/admin', icon: Users },
        { name: 'Add User', href: '/users/add/admin', icon: UserPlus },
        { name: 'Suspended Users', href: '/users/suspended/admin', icon: UserX },
        { name: 'Report Access', href: '/users/report-access/admin', icon: UserCog },
      ],
    },

    // TENANT MANAGEMENT (SUPER ADMIN ONLY)
    {
      name: 'Tenant Management',
      href: '/tenants/admin',
      icon: Building,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
      superAdminOnly: true, // Mark as superadmin only
      children: [
        { name: 'All Tenants', href: '/users/create-tenant/admin', icon: Building },
        { name: 'MPESA Config', href: '/tenants/mpesa-config/admin', icon: CreditCard },
        { name: 'Tenant Reports', href: '/tenants/reports/admin', icon: FileText },
      ],
    },

    // LOANS
    {
      name: 'Loan Management',
      href: '/loans/admin',
      icon: FileText,
      color: 'text-red-400',
      bgColor: 'bg-red-400/10',
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
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
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
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-400/10',
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
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-400/10',
      children: [
        { name: 'General Settings', href: '/settings/general/admin', icon: Settings },
        { name: 'Interest Rates', href: '/settings/rates/admin', icon: Percent },
        { name: 'Fees & Penalties', href: '/settings/fees/admin', icon: Coins },
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
      color: 'text-pink-400',
      bgColor: 'bg-pink-400/10',
      children: [
        { name: 'Activity Logs', href: '/audit/activity/admin', icon: Activity },
        { name: 'Login History', href: '/audit/logins/admin', icon: Key },
        { name: 'Loan Changes', href: '/audit/loan-changes/admin', icon: FileText },
        { name: 'User Changes', href: '/audit/user-changes/admin', icon: Users },
        { name: 'Security Events', href: '/audit/security/admin', icon: ShieldAlert },
      ],
    },
  ];

  // ⭐ FIXED: Filter out items that require superadmin role
  const allowedNavigation = navigation.filter(item => {
    // If item is marked as superAdminOnly, only show to superadmin
    if (item.superAdminOnly && profile?.role !== "superadmin") {
      return false;
    }
    return true;
  });

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 w-64 overflow-y-auto border-r border-gray-200 flex-shrink-0">

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 h-20">
        <div className="flex items-center justify-start">
          <img
            src="/jasirif.png"
            alt="Jasiri Logo"
            className="w-32 h-auto object-contain"
          />
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-white transition-colors md:hidden"
        >
          {sidebarOpen ? (
            <ChevronLeft className="h-5 w-5" style={{ color: "#586ab1" }} />
          ) : (
            <ChevronRight className="h-5 w-5" style={{ color: "#586ab1" }} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {allowedNavigation.map((item) => (
          <div key={item.name} className="relative">

            {/* Main Navigation Item */}
            {item.children ? (
              <div
                onClick={() => toggleItem(item.name)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                  expandedItems[item.name] || window.location.pathname.startsWith(item.href)
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-white/60'
                }`}
              >
                <div className="flex items-center">
                  <item.icon className="h-4 w-4 mr-3" style={{ color: "#586ab1" }} />
                  <span className="text-sm font-medium" style={{ color: "#586ab1" }}>{item.name}</span>
                </div>

                <div className="text-gray-400">
                  {expandedItems[item.name] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            ) : (
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    isActive ? 'bg-white shadow-sm' : 'hover:bg-white/60'
                  }`
                }
              >
                <item.icon className="h-4 w-4 mr-3" style={{ color: "#586ab1" }} />
                <span className="text-sm font-medium" style={{ color: "#586ab1" }}>{item.name}</span>
              </NavLink>
            )}

            {/* Submenu */}
            {item.children && (
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  expandedItems[item.name] ? 'max-h-[600px]' : 'max-h-0'
                }`}
              >
                <div className="ml-2 pl-4 mt-1 space-y-1 border-l-2 border-gray-200">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.name}
                      to={child.href}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 text-xs rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-white shadow-sm'
                            : 'hover:bg-white/60'
                        }`
                      }
                    >
                      {child.icon && <child.icon className="h-3.5 w-3.5 mr-2.5" style={{ color: "#586ab1" }} />}
                      <span className="font-medium" style={{ color: "#586ab1" }}>{child.name}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            )}

          </div>
        ))}
      </nav>
    </div>
  );
};

export default SidebarAdmin;