// src/components/SidebarAdmin.jsx
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
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
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  Landmark,
  RefreshCw,
  ShieldAlert,
  Lock,
  Activity,
  Download,
  Mail,
  MessageSquare,
  Zap,
  Coins,
  Percent,
  CalendarDays,
  FolderOpen,
  Eye,
  Archive,
} from 'lucide-react';

const SidebarAdmin = ({ sidebarOpen, setSidebarOpen }) => {
  const [expandedItems, setExpandedItems] = useState({});

  const toggleItem = (itemName) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/dashboard/admin', 
      icon: Home,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10'
    },
    {
      name: 'User Management',
      href: '/users/admin',
      icon: Users,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      children: [
        { name: 'All Users', href: '/users/all/admin', icon: Users },
        { name: 'Add User', href: '/users/add/admin', icon: UserPlus },
        // { name: 'Roles & Permissions', href: '/users/roles/admin', icon: UserCog },
        { name: 'Suspended Users', href: '/users/suspended/admin', icon: UserX },
        {
  name: 'Report Access',
  href: '/users/report-access/admin',
  icon: UserCog,
},

        // { name: 'Password Resets', href: '/users/password-resets/admin', icon: Key },
      ],
    },
    {
      name: 'Loan Management',
      href: '/loans/admin',
      icon: FileText,
      color: 'text-red-400',
      bgColor: 'bg-red-400/10',
      children: [
        { name: 'All Loans', href: '/loans/all/admin', icon: FileText },
        { name: 'Pending Disbursement', href: '/loans/pending/admin', icon: Clock },
        // { name: 'Approved Loans', href: '/loans/approved/admin', icon: CheckCircle },
        { name: 'Rejected Loans', href: '/loans/rejected/admin', icon: XCircle },
        { name: 'Disbursed Loans', href: '/loans/disbursed/admin', icon: CreditCard },
        // { name: 'Loan Products', href: '/loans/products/admin', icon: FolderOpen },
        // { name: 'Restructure Loans', href: '/loans/restructure/admin', icon: RefreshCw },
        // { name: 'Write-offs', href: '/loans/writeoffs/admin', icon: Archive },
      ],
    },
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
        // { name: 'Payment Integrations', href: '/transactions/integrations/admin', icon: Zap },
      ],
    },
    // {
    //   name: 'Security & Risk',
    //   href: '/security/admin',
    //   icon: Shield,
    //   color: 'text-yellow-400',
    //   bgColor: 'bg-yellow-400/10',
    //   children: [
    //     { name: 'Guarantors', href: '/security/guarantors/admin', icon: Users },
    //     { name: 'Collateral Management', href: '/security/collateral/admin', icon: Lock },
    //     { name: 'Fraud Detection', href: '/security/fraud/admin', icon: ShieldAlert },
    //     { name: 'Blacklisted Borrowers', href: '/security/blacklist/admin', icon: UserX },
    //     { name: 'Credit Scoring', href: '/security/credit-scoring/admin', icon: BarChart3 },
    //     { name: 'Loan Limits', href: '/security/limits/admin', icon: Percent },
    //   ],
    // },
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

  return (
    <div className="h-full bg-gray-900 text-white w-64 overflow-y-auto border-r border-gray-800 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-orange-600 rounded-md flex items-center justify-center">
            <Shield className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">Admin Panel</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors md:hidden"
        >
          {sidebarOpen ? (
            <ChevronLeft className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </button>
      </div>
      
      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navigation.map((item) => (
          <div key={item.name} className="relative">
            {/* Main Navigation Item */}
            {item.children ? (
              <div
                onClick={() => toggleItem(item.name)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                  expandedItems[item.name] || window.location.pathname.startsWith(item.href)
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center mr-3 ${item.bgColor}`}>
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>

                <div className="text-gray-400 group-hover:text-white">
                  {expandedItems[item.name] ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>
            ) : (
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <div className={`w-8 h-8 rounded-md flex items-center justify-center mr-3 ${item.bgColor}`}>
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <span className="text-sm font-medium">{item.name}</span>
              </NavLink>
            )}

            {/* Submenu Items */}
            {item.children && (
              <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  expandedItems[item.name] ? 'max-h-[600px]' : 'max-h-0'
                }`}
              >
                <div className="ml-4 pl-6 mt-1 space-y-1 border-l border-gray-700">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.name}
                      to={child.href}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                          isActive
                            ? 'bg-indigo-900/30 text-indigo-200 border-l-2 border-indigo-500'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                        }`
                      }
                    >
                      {child.icon && <child.icon className="h-3.5 w-3.5 mr-2.5" />}
                      <span>{child.name}</span>
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