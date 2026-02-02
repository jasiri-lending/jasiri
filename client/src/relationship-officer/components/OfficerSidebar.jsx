import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  FileText,
  Users,
  ClipboardList,
  CheckCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  UserPlus,
} from 'lucide-react';

const OfficerSidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const [expandedItems, setExpandedItems] = useState({});

  const toggleItem = (itemName) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemName]: !prev[itemName],
    }));
  };

  const navigation = [
    {
      name: 'Dashboard',
      href: '/officer',
      icon: Home,
      color: 'text-brand-primary',
      bgColor: 'bg-brand-surface',
      noChildren: true, // direct NavLink
    },
    {
      name: 'Customer',
      href: '/officer/customers',
      icon: Users,
      color: 'text-brand-primary',
      bgColor: 'bg-brand-surface',
      children: [
        {
          name: 'View Customers',
          href: '/officer/customers',
          icon: Users
        },
        {
          name: 'Pending Amendments',
          href: '/officer/customers/amendments',
          icon: ClipboardList
        },
        {
          name: 'Customer Drafts',
          href: '/officer/customers/drafts',
          icon: FileText // or use a better icon like 'Archive' from lucide-react
        },
        // { 
        //   name: 'Loan Drafts', 
        //   href: '/officer/loans/drafts', 
        //   icon: FileText // you can also use 'Briefcase' or 'Wallet' if preferred
        // },
      ],
    },

    {
      name: 'Loan Processing',
      href: '/officer/loans',
      icon: FileText,
      color: 'text-brand-primary',
      bgColor: 'bg-brand-surface',
      children: [
        {
          name: 'Loan Applications',
          href: '/officer/loans/applications',
          icon: FileText
        },

        // { 
        //   name: 'Loans', 
        //   href: '/officer/loans',  
        //   icon: FileText 
        // },
      ],
    }
    ,
    {
      name: 'Leads',
      href: '/officer/leads',
      icon: UserPlus,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      noChildren: true, // direct NavLink
    },

  ];

  return (
    <div className="h-full bg-gray-900 text-white w-64 overflow-y-auto border-r border-gray-800 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-brand-primary rounded-md flex items-center justify-center">
            <BarChart3 className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">Officer Portal</span>
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
            {item.noChildren ? (
              /* Direct NavLink (Dashboard, Leads, etc.) */
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 ${isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <div
                  className={`w-8 h-8 rounded-md flex items-center justify-center mr-3 ${item.bgColor}`}
                >
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <span className="text-sm font-medium">{item.name}</span>
              </NavLink>
            ) : (
              <>
                {/* Main Navigation Item with Children */}
                <div
                  onClick={() => toggleItem(item.name)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${expandedItems[item.name] || window.location.pathname.startsWith(item.href)
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                >
                  <div className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-md flex items-center justify-center mr-3 ${item.bgColor}`}
                    >
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

                {/* Submenu Items */}
                {item.children && (
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedItems[item.name] ? 'max-h-96' : 'max-h-0'
                      }`}
                  >
                    <div className="ml-4 pl-6 mt-1 space-y-1 border-l border-gray-700">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.name}
                          to={child.href}
                          className={({ isActive }) =>
                            `flex items-center px-3 py-2 text-sm rounded-md transition-colors duration-200 ${isActive
                              ? 'bg-brand-primary/20 text-brand-primary border-l-2 border-brand-primary'
                              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                            }`
                          }
                        >
                          {child.icon && (
                            <child.icon className="h-3.5 w-3.5 mr-2.5" />
                          )}
                          <span>{child.name}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
};

export default OfficerSidebar;
