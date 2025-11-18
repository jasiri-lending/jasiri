// src/pages/registry/Registry.jsx

import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import Customers from './AllCustomers'
import PendingAmendments from './PendingAmendments'
import ApprovalsPending from './ApprovalPending'
import CallbacksPending from './CallbacksPending'
import CustomerTransfer from './CustomerTransfer'
import CustomerCategories from './CustomerCategories'

const Registry = () => {
  const location = useLocation()
  const tabs = [
    { name: 'Customers', href: '/registry/customers' },
    { name: 'Pending Amendments', href: '/registry/pending-amendments' },
    { name: 'Approvals Pending', href: '/registry/approvals-pending' },
    { name: 'Callbacks Pending', href: '/registry/callbacks-pending' },
    
    { name: 'Customer Categories', href: '/registry/customer-categories' },
  ]

  return (
    <div>
      
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <Link
              key={tab.name}
              to={tab.href}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                location.pathname === tab.href
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </Link>
          ))}
        </nav>
      </div>
      
      <div className="mt-6">
        <Routes>
          <Route path="customers" element={<Customers />} />
          <Route path="pending-amendments" element={<PendingAmendments />} />
          <Route path="approvals-pending" element={<ApprovalsPending />} />
          <Route path="callbacks-pending" element={<CallbacksPending />} />
          <Route path="customer-transfer" element={<CustomerTransfer />} />
          <Route path="customer-categories" element={<CustomerCategories />} />
          <Route path="*" element={<Navigate to="customers" />} />
        </Routes>
      </div>
    </div>
  )
}

export default Registry