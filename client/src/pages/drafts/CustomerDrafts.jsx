import { useState, useEffect, useRef } from 'react';
import { 
  MagnifyingGlassIcon, 
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  UserIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../hooks/userAuth.js";
import CustomerVerificationForm from './CustomerVerification.jsx';
import Verification from './Verification.jsx';
import CustomerDetailsModal from '../../relationship-officer/components/CustomerDetailsModal.jsx';

const CustomerDrafts = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Get user profile from auth hook
  const { profile } = useAuth();
  const userRole = profile?.role;
  const userBranchId = profile?.branch_id;

  // Use ref to track if data has been fetched
  const hasFetchedData = useRef(false);

  // Fetch pending customers based on user role
  const fetchPendingCustomers = async () => {
    setLoading(true);
    try {
      if (!userRole) return;

      let query = supabase
        .from("customers")
        .select("*")
        .eq("form_status", "draft")
        .order("created_at", { ascending: false });

      // Set status filter based on role
      if (userRole === 'branch_manager') {
        query = query.eq("status", "bm_review");
        // BM can only see customers from their branch
        if (userBranchId) {
          query = query.eq("branch_id", userBranchId);
        }
      } else if (userRole === 'credit_analyst_officer') {
        query = query.eq("status", "ca_review");
        // CA can see all customers with ca_review status (no branch restriction)
      } else if (userRole === 'customer_service_officer') {
        query = query.eq("status", "cso_review");
        // CSO can see all customers with cso_review status
      } else {
        console.error("Unknown user role:", userRole);
        return;
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching pending customers:", error.message);
      } else {
        setCustomers(data || []);
        setFilteredCustomers(data || []);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch data once when profile is available
    if (profile && !hasFetchedData.current) {
      hasFetchedData.current = true;
      fetchPendingCustomers();
    }
  }, [profile]);

  // Search functionality
  useEffect(() => {
    if (!customers || customers.length === 0) return;
    
    const filtered = customers.filter(customer =>
      (customer.first_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (customer.last_name?.toLowerCase() || customer.surname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (customer.id_number?.toString() || customer.national_id?.toString() || '').includes(searchTerm) ||
      (customer.mobile || customer.phone_number || customer.phone || '').includes(searchTerm)
    );
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  const handleApprove = (customerId) => {
    setSelectedCustomer(customerId);
    setShowForm(true);
  };

  const handleView = (customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedCustomer(null);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
  };

 

  // Get appropriate verification form component based on role
  const getVerificationForm = () => {
    if (!selectedCustomer) return null;
    
    // For branch_manager and credit_analyst_officer: use CustomerVerificationForm
    if (userRole === 'branch_manager' || userRole === 'credit_analyst_officer') {
      return (
        <CustomerVerificationForm
          customerId={selectedCustomer}
          onClose={handleFormClose}
        />
      );
    }
    
    // For customer_service_officer: use Verification
    if (userRole === 'customer_service_officer') {
      return (
        <Verification
          customerId={selectedCustomer}
          onClose={handleFormClose}
        />
      );
    }

    return null;
  };

  // Get appropriate view customer component based on role
  const getCustomerDetailsModalComponent = () => {
    if (!selectedCustomer) return null;
    
    return (
      <CustomerDetailsModal
        customer={selectedCustomer}
        userRole={userRole}
        onClose={() => setIsModalOpen(false)}
      />
    );
  };

  // Helper function to get status display
  const getStatusDisplay = (status) => {
    if (!status) return 'N/A';
    
    const statusMap = {
      'bm_review': 'BM Review',
      'ca_review': 'CA Review',
      'cso_review': 'CSO Review',
      'cso_review_amend': 'CSO Review (Amend)',
      'bm_review_amend': 'BM Review (Amend)',
      'ca_review_amend': 'CA Review (Amend)'
    };
    
    return statusMap[status] || status;
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    const statusValue = typeof status === 'string' ? status.toLowerCase() : '';
    
    if (statusValue.includes('review') || statusValue.includes('pending')) return '#f59e0b'; // amber
    if (statusValue.includes('amend')) return '#8b5cf6'; // purple
    
    return '#586ab1'; // default blue
  };

  // Show loading if profile is not yet loaded
  if (!profile) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen font-sans">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#586ab1' }}></div>
            <span className="ml-3 text-gray-500 text-sm">Loading user information...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-gray-800 border-r border-gray-200 transition-all duration-300 p-6 min-h-screen font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xs text-slate-600 mb-1 font-medium tracking-wide">
            Drafts
          </h1>
        </div>
        <div className="text-xs text-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm" style={{backgroundColor:"#586ab1"}}>
          <span className="font-medium text-white">{filteredCustomers.length}</span> pending customers
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Search and Filters Header */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search and Filter Container */}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {/* Search Bar */}
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by first name, surname, ID number, or mobile..."
                  className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all duration-200 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Filter Button and Clear Filters */}
              <div className="flex items-center gap-2">
                {searchTerm && (
                  <button
                    onClick={clearFilters}
                    className="px-3 py-2 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-1.5 border border-gray-300"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-all duration-200 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 hover:text-gray-900"
                >
                  <AdjustmentsHorizontalIcon className="h-4 w-4" />
                  Filters
                  {searchTerm && (
                    <span className="ml-1 px-1.5 py-0.5 bg-gray-700 text-white rounded-full text-xs">
                      1
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {searchTerm && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs text-gray-500 mr-2">Active filters:</span>
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                  Search: "{searchTerm}"
                  <button
                    onClick={() => setSearchTerm("")}
                    className="ml-1 text-gray-500 hover:text-gray-700"
                  >
                    <XMarkIcon className="h-2.5 w-2.5" />
                  </button>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto font-sans">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ backgroundColor: '#E7F0FA' }}>
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Mobile
                </th>
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  ID Number
                </th>
                <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Prequalified Amount
                </th>
                <th className="px-4 py-3 text-center text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs tracking-wider whitespace-nowrap" style={{ color: '#0D2440' }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#586ab1' }}></div>
                      <span className="ml-3 text-gray-500 text-sm">Loading customers...</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer, index) => {
                  const fullName = `${customer.first_name || customer.Firstname || ""} ${customer.middle_name || ""} ${customer.last_name || customer.Surname || ""}`.trim();
                  const statusColor = getStatusColor(customer.status);
                  
                  return (
                    <tr 
                      key={customer.id} 
                      className={`border-b transition-colors hover:bg-gray-50 ${index % 2 === 0 ? '' : 'bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                        {fullName || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                        {customer.mobile || customer.phone_number || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#0D2440' }}>
                        {customer.id_number || customer.national_id || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap text-right" style={{ color: '#0D2440' }}>
                        {customer.prequalifiedAmount ? 
                          `Ksh ${Number(customer.prequalifiedAmount).toLocaleString()}` : 
                          "N/A"}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span 
                          className="inline-block px-3 py-1 rounded text-xs whitespace-nowrap"
                          style={{ 
                            backgroundColor: statusColor,
                            color: 'white'
                          }}
                        >
                          {getStatusDisplay(customer.status) || "N/A"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Customer */}
                          <button
                            onClick={() => handleView(customer)}
                            className="p-2 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 text-blue-600 hover:from-blue-100 hover:to-blue-200 hover:text-blue-700 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow"
                            title="View Customer Details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>

                          {/* Approve Button */}
                          <button
                            onClick={() => handleApprove(customer.id)}
                            className="p-2 rounded-lg bg-gradient-to-r from-green-50 to-green-100 border border-green-200 text-green-600 hover:from-green-100 hover:to-green-200 hover:text-green-700 hover:border-green-300 transition-all duration-200 shadow-sm hover:shadow"
                            title="Approve Customer"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* No Results */}
        {!loading && filteredCustomers.length === 0 && (
          <div className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center">
              <MagnifyingGlassIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">
              {searchTerm ? "No customers found" : "No pending approvals"}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {searchTerm
                ? "Try adjusting your search criteria"
                : "All customers have been processed or there are no pending approvals for your role."}
            </p>
          </div>
        )}
      </div>

      {/* View Customer Modal */}
      {isModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl font-bold z-10"
            >
              ✕
            </button>
            <div className="p-6">
              {getCustomerDetailsModalComponent()}
            </div>
          </div>
        </div>
      )}

      {/* Customer Verification Form Modal - Role-based */}
      {showForm && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={handleFormClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl font-bold z-10"
            >
              ✕
            </button>
            <div className="p-6">
              {getVerificationForm()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDrafts;