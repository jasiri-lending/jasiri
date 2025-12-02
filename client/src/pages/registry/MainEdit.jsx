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
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      {/* Header */}
      <h1 className="text-sm  text-gray-900 mb-4" style={{ color: primaryColor }}>
        Customer Edits
      </h1>

      {/* Navigation Buttons */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        <button
          onClick={() => setActiveView('phone-id')}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm min-w-max whitespace-nowrap ${
            activeView === 'phone-id'
              ? 'text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          style={activeView === 'phone-id' ? { backgroundColor: primaryColor } : {}}
        >
          <PhoneIcon className="h-4 w-4" />
          Edit Phone & ID
        </button>

        <button
          onClick={() => setActiveView('details')}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm min-w-max whitespace-nowrap ${
            activeView === 'details'
              ? 'text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          style={activeView === 'details' ? { backgroundColor: primaryColor } : {}}
        >
          <DocumentTextIcon className="h-4 w-4" />
          Edit Other Details
        </button>
      </div>

      {/* Render Selected Component */}
      <div className="transition-all duration-300 ease-in-out">
        {activeView === 'phone-id' ? <CustomerEdits /> : <CustomerDetailsEdit />}
      </div>
    </div>
  );
}

export default ParentCustomerEditComponent;
