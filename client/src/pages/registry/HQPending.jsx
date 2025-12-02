import { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon, 
  EyeIcon,
  CheckIcon,
  ClockIcon,
  UserIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";

const  HQPending = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Get user profile from auth hook
  const { profile } = useAuth();
  const userRole = profile?.role;
  const userBranchId = profile?.branch_id;

  const navigate = useNavigate(); 

  // Check if user is branch manager
  const isBranchManager = userRole === 'branch_manager';

  // Fetch pending customers with related data
  const fetchPendingCustomers = async () => {
    setLoading(true);
    try {
      if (!userRole) return;

      let query = supabase
        .from("customers")
        .select(`
          *,
          branch:branches!customers_branch_id_fkey(
            id,
            name,
            region:regions!branches_region_id_fkey(
              id,
              name
            )
          ),
          created_by_user:users!customers_created_by_fkey(
            id,
            full_name
          )
        `)
        .eq("status", "ca_review")
        .neq("form_status", "draft")
        .order("created_at", { ascending: false });

      // BM can only see customers from their branch
      if (userRole === 'branch_manager' && userBranchId) {
        query = query.eq("branch_id", userBranchId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching pending customers:", error.message);
      } else {
        const customersData = data || [];
        setCustomers(customersData);
        setFilteredCustomers(customersData);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch only once when component mounts and profile is available
  useEffect(() => {
    if (profile && userRole) {
      fetchPendingCustomers();
    }
  }, [profile?.id]); // Only depend on profile id to prevent unnecessary re-fetches

  // Search functionality
  useEffect(() => {
    if (!customers || customers.length === 0) {
      setFilteredCustomers([]);
      return;
    }
    
    const filtered = customers.filter(customer =>
      (customer.Firstname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (customer.Surname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (customer.id_number?.toString() || '').includes(searchTerm.toLowerCase()) ||
      (customer.mobile || '').includes(searchTerm) ||
      (customer.branch?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (customer.branch?.region?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (customer.created_by_user?.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  // Updated handlers to use navigation
  const handleVerify = (customerId) => {
    navigate(`/customer/${customerId}/verify`);
  };

  const handleView = (customer) => {
    navigate(`/customer/${customer.id}/details`);
  };

  // Helper function to get full name
  const getFullName = (customer) => {
    const firstName = customer.Firstname || '';
    const lastName = customer.Surname || '';
    return `${firstName} ${lastName}`.trim() || 'N/A';
  };

  // Helper function to get RO name
  const getROName = (customer) => {
    return customer.created_by_user?.full_name || 'N/A';
  };

  // Helper function to get Region name
  const getRegionName = (customer) => {
    return customer.branch?.region?.name || 'N/A';
  };

  // Helper function to get Branch name
  const getBranchName = (customer) => {
    return customer.branch?.name || 'N/A';
  };

  // Show loading if profile is not yet loaded
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-500">Loading user information...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-slate-600 text-xs">Pending BM Review</h1>
        </div>

        {/* Table with integrated search */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          {/* Search Bar - Top Right of Table */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">
              Total: {filteredCustomers.length} {filteredCustomers.length === 1 ? 'customer' : 'customers'}
            </div>
            <div className="relative w-96">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, ID, branch, region..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["ID Number", "Name", "Region", "Branch", "RO", "Prequalified Amount", "Mobile", "Actions"].map((head) => (
                    <th
                      key={head}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-gray-500 text-sm">Loading customers...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16">
                      <div className="text-center">
                        <ClockIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No pending reviews</h3>
                        <p className="text-gray-500 text-sm">
                          {searchTerm
                            ? "No customers match your search criteria."
                            : "All customers have been processed."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                            <UserIcon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="ml-3">
                            <div className="font-medium text-gray-900 text-sm">
                              {customer.id_number || "N/A"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800 whitespace-nowrap">
                        {getFullName(customer)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-700">
                          <MapPinIcon className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                          <span>{getRegionName(customer)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-700">
                          <BuildingOfficeIcon className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                          <span>{getBranchName(customer)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {getROName(customer)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-block px-3 py-1 text-sm font-semibold text-green-700 bg-green-50 rounded-lg">
                          {customer.prequalifiedAmount
                            ? `KES ${Number(customer.prequalifiedAmount).toLocaleString()}`
                            : "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-700">
                          <PhoneIcon className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                          <span>{customer.mobile || "N/A"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleView(customer)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200 transition-all"
                            title="View Details"
                          >
                            <EyeIcon className="w-4 h-4 mr-1" />
                            View
                          </button>
                          {isBranchManager && (
                            <button
                              onClick={() => handleVerify(customer.id)}
                              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-full hover:bg-green-200 transition-all"
                              title="Verify Customer"
                            >
                              <CheckIcon className="w-4 h-4 mr-1" />
                              Verify
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HQPending;