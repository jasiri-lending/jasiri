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
import Spinner from '../../components/Spinner';

const PendingBM = () => {
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
        .eq("status", "bm_review")
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


   if (loading) {
      return (
        <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center ">
          <Spinner text="Loading ..." />
        </div>
      );
    }
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
     <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
    <div className="text-xs font-medium text-gray-700">
      Total: {filteredCustomers.length} {filteredCustomers.length === 1 ? 'customer' : 'customers'}
    </div>

    <div className="relative w-64">
      <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        placeholder="Search..."
        className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    </div>
  </div>

  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          {["ID Number", "Name", "Region", "Branch", "RO", "Prequalified", "Mobile", "Actions"].map((head) => (
            <th
              key={head}
              className="px-3 py-2 text-left text-[10px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap"
            >
              {head}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y divide-gray-200">
        {filteredCustomers.map((customer) => (
          <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
            <td className="px-3 py-2 whitespace-nowrap">
              <div className="flex items-center">
                <UserIcon className="w-4 h-4 text-blue-600" />
                <span className="ml-2">{customer.id_number || "N/A"}</span>
              </div>
            </td>

            <td className="px-3 py-2 whitespace-nowrap text-[11px]">{getFullName(customer)}</td>

            <td className="px-3 py-2 whitespace-nowrap text-[11px]">
              <div className="flex items-center">
                <MapPinIcon className="w-3 h-3 mr-1 text-gray-400" />
                {getRegionName(customer)}
              </div>
            </td>

            <td className="px-3 py-2 whitespace-nowrap text-[11px]">
              <div className="flex items-center">
                <BuildingOfficeIcon className="w-3 h-3 mr-1 text-gray-400" />
                {getBranchName(customer)}
              </div>
            </td>

            <td className="px-3 py-2 whitespace-nowrap text-[11px]">{getROName(customer)}</td>

            <td className="px-3 py-2 whitespace-nowrap">
              <span className="px-2 py-0.5 text-[10px] font-medium text-green-700 bg-green-50 rounded">
                {customer.prequalifiedAmount
                  ? `KES ${Number(customer.prequalifiedAmount).toLocaleString()}`
                  : "N/A"}
              </span>
            </td>

            <td className="px-3 py-2 whitespace-nowrap text-[11px]">
              <div className="flex items-center">
                <PhoneIcon className="w-3 h-3 mr-1 text-gray-400" />
                {customer.mobile || "N/A"}
              </div>
            </td>

            <td className="px-3 py-2 whitespace-nowrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleView(customer)}
                  className="px-2 py-1 text-[10px] bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  View
                </button>

                {isBranchManager && (
                  <button
                    onClick={() => handleVerify(customer.id)}
                    className="px-2 py-1 text-[10px] bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Verify
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>

    </div>
  );
};

export default PendingBM;