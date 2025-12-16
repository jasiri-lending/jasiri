import  { useState, useEffect, useRef } from 'react';
import { 
  MagnifyingGlassIcon, 
  EyeIcon,
  CheckIcon,
  UserIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import Spinner from "../../components/Spinner.jsx";

const HQPending = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState({});
  const [regions, setRegions] = useState({});
  const [roUsers, setRoUsers] = useState({});
  
  // Get user profile from auth hook
  const { profile } = useAuth();
  const userRole = profile?.role;
  const userBranchId = profile?.branch_id;

  const navigate = useNavigate();

  // Use ref to track if data has been fetched
  const hasFetchedData = useRef(false);

  // Check if user is branch manager
  const isBranchManager = userRole === 'branch_manager';

  // Fetch branches, regions, and RO users data
  const fetchReferenceData = async () => {
    try {
      const [branchesResponse, regionsResponse, usersResponse] = await Promise.all([
        supabase.from('branches').select('id, name, region_id'),
        supabase.from('regions').select('id, name'),
        supabase.from('users').select('id, full_name')
      ]);

      if (branchesResponse.data) {
        const branchesMap = {};
        branchesResponse.data.forEach(branch => {
          branchesMap[branch.id] = { name: branch.name, region_id: branch.region_id };
        });
        setBranches(branchesMap);
      }

      if (regionsResponse.data) {
        const regionsMap = {};
        regionsResponse.data.forEach(region => {
          regionsMap[region.id] = region.name;
        });
        setRegions(regionsMap);
      }

      if (usersResponse.data) {
        const usersMap = {};
        usersResponse.data.forEach(user => {
          usersMap[user.id] = user.full_name;
        });
        setRoUsers(usersMap);
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  };

  const fetchPendingCustomers = async () => {
    if (!profile || !userRole) {
      console.warn("No profile or role available, skipping fetch");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("customers")
        .select("*")
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
        setCustomers(data || []);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch - only runs once when profile is available
  useEffect(() => {
    if (profile && userRole && !hasFetchedData.current) {
      hasFetchedData.current = true;
      fetchReferenceData();
      fetchPendingCustomers();
    }
  }, [profile?.id, userRole]);

  // Search functionality - separate effect
  useEffect(() => {
    if (!customers || customers.length === 0) {
      setFilteredCustomers([]);
      return;
    }
    
    const filtered = customers.filter(customer => {
      const fullName = `${customer.Firstname || ''} ${customer.Surname || ''}`.toLowerCase();
      const branchName = branches[customer.branch_id]?.name?.toLowerCase() || '';
      const regionId = branches[customer.branch_id]?.region_id;
      const regionName = regions[regionId]?.toLowerCase() || '';
      const roName = roUsers[customer.created_by]?.toLowerCase() || '';

      return (
        fullName.includes(searchTerm.toLowerCase()) ||
        (customer.id_number?.toString() || '').includes(searchTerm) ||
        (customer.mobile || '').includes(searchTerm) ||
        branchName.includes(searchTerm.toLowerCase()) ||
        regionName.includes(searchTerm.toLowerCase()) ||
        roName.includes(searchTerm.toLowerCase())
      );
    });
    setFilteredCustomers(filtered);
  }, [searchTerm, customers, branches, regions, roUsers]);

  const handleVerify = (customerId) => {
    navigate(`/customer/${customerId}/verify`);
  };

  const handleView = (customer) => {
    navigate(`/customer/${customer.id}/details`);
  };

  const handleRefresh = () => {
    fetchPendingCustomers();
  };

  // Show loading if profile is not yet loaded
  if (!profile) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
        <Spinner text="Loading user information..." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
        <Spinner text="Loading pending reviews..." />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Pending HQ Review
      </h1>

      {/* Search and Actions Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="h-4 w-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, ID, branch, region..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-gray-300 rounded-md pl-8 pr-3 py-1.5 w-full text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Refresh Button */}
            <button 
              onClick={handleRefresh}
              className="px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-colors border whitespace-nowrap"
              style={{ 
                backgroundColor: "#586ab1",
                color: "white",
                borderColor: "#586ab1"
              }}
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {/* Results Info */}
          <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
            <span>
              Showing <span className="font-medium">{filteredCustomers.length}</span> of <span className="font-medium">{customers.length}</span> customers pending review
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">ID Number</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Region</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Branch</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">RO</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Pre-Amount</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Mobile</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="text-center">
                      <UserIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-sm font-medium text-gray-900 mb-2">No pending reviews</h3>
                      <p className="text-xs text-gray-500">
                        {searchTerm
                          ? "No customers match your search criteria."
                          : "All customers have been processed."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const branch = branches[customer.branch_id];
                  const regionName = branch ? regions[branch.region_id] : 'N/A';
                  const branchName = branch?.name || 'N/A';
                  const roName = roUsers[customer.created_by] || 'N/A';

                  return (
                    <tr
                      key={customer.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {customer.id_number || "N/A"}
                      </td>

                      <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {`${customer.Firstname || ''} ${customer.Surname || ''}`.trim() || "N/A"}
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <MapPinIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          {regionName}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <BuildingOfficeIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          {branchName}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {roName}
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-700 text-right font-medium whitespace-nowrap">
                        {customer.prequalifiedAmount
                          ? `Ksh ${Number(customer.prequalifiedAmount).toLocaleString()}`
                          : "N/A"}
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <PhoneIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          {customer.mobile || "N/A"}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleView(customer)}
                            className="p-1.5 rounded-md bg-green-50 border border-green-200 text-green-600 hover:bg-green-100 hover:text-green-700 transition"
                            title="View Details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>

                          {isBranchManager && (
                            <button
                              onClick={() => handleVerify(customer.id)}
                              className="px-3 py-1.5 text-xs font-medium rounded-md text-white transition-colors whitespace-nowrap inline-flex items-center gap-1"
                              style={{ backgroundColor: "#586ab1" }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = "#4a5a9d"}
                              onMouseLeave={(e) => e.target.style.backgroundColor = "#586ab1"}
                              title="Verify Customer"
                            >
                              <CheckIcon className="h-3 w-3" />
                              Verify
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination info */}
        {filteredCustomers.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <div className="text-xs text-gray-600">
              Total pending: <span className="font-medium">{customers.length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HQPending;