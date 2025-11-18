// src/pages/accounting/Accounting.jsx
import React from 'react'
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import ChartOfAccounts from './ChartOfAccounts'
import Journals from './Journals'
import Transactions from './Transactions'
import BankReconciliations from './BankReconciliations'

const Accounting = () => {
  const location = useLocation()
  const tabs = [
    { name: 'Chart of Accounts', href: '/accounting/chart-of-accounts' },
    { name: 'Journals', href: '/accounting/journals' },
    { name: 'Transactions', href: '/accounting/transactions' },
    { name: 'Bank Reconciliations', href: '/accounting/bank-reconciliations' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Accounting</h1>
      
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
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
          <Route path="chart-of-accounts" element={<ChartOfAccounts />} />
          <Route path="journals" element={<Journals />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="bank-reconciliations" element={<BankReconciliations />} />
          <Route path="*" element={<Navigate to="chart-of-accounts" />} />
        </Routes>
      </div>
    </div>
  )
}

export default Accounting