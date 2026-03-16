import { useState } from 'react';
import CustomerEdits from './CustomerEdit.jsx';
import CustomerDetailsEdit from './OtherDetailsEdits';
import { PhoneIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useAuth } from "../../hooks/userAuth.js";

function ParentCustomerEditComponent() {
  const [activeView, setActiveView] = useState('phone-id');
  const { profile, loading: authLoading } = useAuth();

  const primaryColor = "#586ab1";

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-3"
            style={{ borderColor: primaryColor }}
          ></div>
          <p className="text-gray-600 text-base">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-md">
          <div className="text-red-500 text-5xl mb-3">🔒</div>
          <h1 className="text-lg font-semibold mb-2" style={{ color: primaryColor }}>
            Access Denied
          </h1>
          <p className="text-gray-600 text-sm mb-5">
            You must be logged in to access this page.
          </p>
          <a
            href="/login"
            className="inline-block py-2.5 px-5 rounded-lg text-white font-medium text-sm transition-colors"
            style={{ backgroundColor: primaryColor }}
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  // Role check
  const allowedRoles = [
    'relationship_officer',
    'branch_manager',
    'regional_manager',
    'credit_analyst_officer',
    'customer_service_officer',
    'superadmin'
  ];

  if (!allowedRoles.includes(profile.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-md">
          <div className="text-yellow-500 text-5xl mb-3">⚠️</div>
          <h1 className="text-lg font-semibold mb-2" style={{ color: primaryColor }}>
            Permission Required
          </h1>
          <p className="text-gray-600 text-sm mb-3">
            Your role ({profile.role}) does not have permission to access the customer edit features.
          </p>
          <p className="text-xs text-gray-500 mb-5">
            Contact your administrator if you believe this is an error.
          </p>
          <a
            href="/dashboard"
            className="inline-block py-2.5 px-5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-muted">
      {/* Clean Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-sm  text-slate-600 tracking-tight">
            Customer Edits
          </h1>
        </div>

        {/* Minimal Navigation Buttons */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/50">
          <button
            onClick={() => setActiveView('phone-id')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-300 ${activeView === 'phone-id' ? 'bg-white text-[#586ab1] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <PhoneIcon className="h-4 w-4" />
            Phone & ID
          </button>
          <button
            onClick={() => setActiveView('details')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-300 ${activeView === 'details' ? 'bg-white text-[#586ab1] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <DocumentTextIcon className="h-4 w-4" />
            Other Details
          </button>
        </div>
      </div>

      {/* Render Selected Component */}
      <div className="animate-in fade-in duration-500">
        {activeView === 'phone-id' ? <CustomerEdits /> : <CustomerDetailsEdit />}
      </div>
    </div>
  );
}

export default ParentCustomerEditComponent;
