import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from "../../hooks/userAuth";
import { 
  MagnifyingGlassIcon, 
  EyeIcon,
  PhoneIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { supabase } from "../../supabaseClient";
import { useNavigate } from 'react-router-dom';
import Spinner from "../../components/Spinner.jsx";

const CallbackPending = () => {
  const [customers, setCustomers] = useState([]);
  const { profile } = useAuth();
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState({});
  const [regions, setRegions] = useState({});
  
  const navigate = useNavigate();
  
  // Use ref to track if data has been fetched
  const hasFetchedData = useRef(false);

  // Fetch branches and regions data
  const fetchBranchesAndRegions = async () => {
    try {
      const [branchesResponse, regionsResponse] = await Promise.all([
        supabase.from('branches').select('id, name'),
        supabase.from('regions').select('id, name')
      ]);

      if (branchesResponse.data) {
        const branchesMap = {};
        branchesResponse.data.forEach(branch => {
          branchesMap[branch.id] = branch.name;
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
    } catch (error) {
      console.error("Error fetching branches and regions:", error);
    }
  };

  const fetchPendingCustomers = async () => {
    if (!profile?.region_id) {
      console.warn("No region in profile yet, skipping fetch");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select(`
          *,
          customer_verifications(*)
        `)
        .eq("status", "cso_review")
        .eq("region_id", profile.region_id);

      if (error) {
        console.error("Error fetching pending customers:", error.message);
      } else {
        const enriched = (data || []).map((c) => {
          const bmVerification =
            c.customer_verifications?.find((v) => v.role === "bm") || null;
          return {
            ...c,
            bm_verification: bmVerification,
          };
        });
        setCustomers(enriched);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch - only runs once when profile is available
  useEffect(() => {
    if (profile?.region_id && !hasFetchedData.current) {
      hasFetchedData.current = true;
      fetchBranchesAndRegions();
      fetchPendingCustomers();
    }
  }, [profile?.region_id]);

  // Search functionality - separate effect
  useEffect(() => {
    if (!customers || customers.length === 0) {
      setFilteredCustomers([]);
      return;
    }
    
    const filtered = customers.filter(customer => {
      const fullName = `${customer.Firstname || ''} ${customer.Surname || ''}`.toLowerCase();
      return (
        fullName.includes(searchTerm.toLowerCase()) ||
        (customer.id_number?.toString() || customer.national_id?.toString() || '').includes(searchTerm) ||
        (customer.mobile || customer.phone_number || customer.phone || '').includes(searchTerm) ||
        (branches[customer.branch_id]?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (regions[customer.region_id]?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );
    });
    setFilteredCustomers(filtered);
  }, [searchTerm, customers, branches, regions]);

  const handleApprove = (customerId) => {
    navigate(`/customer/${customerId}/verify-customer_service_officer`);
  };

  const handleView = (customer) => {
    navigate(`/customer/${customer.id}/details`);
  };

  const handleRefresh = () => {
    fetchPendingCustomers();
  };

  if (loading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center ">
        <Spinner text="Loading pending callbacks..." />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Pending Callbacks
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
                placeholder="Search customers..."
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
              Showing <span className="font-medium">{filteredCustomers.length}</span> of <span className="font-medium">{customers.length}</span> customers awaiting review
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
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Branch</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Region</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Pre-Amount</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Mobile</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="text-center">
                      <PhoneIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-sm font-medium text-gray-900 mb-2">No pending callbacks</h3>
                      <p className="text-xs text-gray-500">
                        {searchTerm
                          ? "No customers match your search criteria."
                          : "All customers have been processed."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {customer.id_number || customer.national_id || "N/A"}
                    </td>

                    <td className="px-4 py-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {`${customer.Firstname || ''} ${customer.Surname || ''}`.trim() || "N/A"}
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {branches[customer.branch_id] || "N/A"}
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {regions[customer.region_id] || "N/A"}
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-700 text-right font-medium whitespace-nowrap">
                      {customer.prequalifiedAmount
                        ? `Ksh ${Number(customer.prequalifiedAmount).toLocaleString()}`
                        : "N/A"}
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {customer.mobile || "N/A"}
                    </td>

                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleView(customer)}
                          className="p-1.5 rounded-md bg-green-50 border border-green-200 text-green-600 hover:bg-green-100 hover:text-green-700 transition"
                          title="View Customer"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>

                        {profile?.role === "customer_service_officer" && (
                          <button
                            onClick={() => handleApprove(customer.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-md text-white transition-colors whitespace-nowrap inline-flex items-center gap-1"
                            style={{ backgroundColor: "#586ab1" }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = "#4a5a9d"}
                            onMouseLeave={(e) => e.target.style.backgroundColor = "#586ab1"}
                            title="Spoof Call"
                          >
                            <PhoneIcon className="h-3 w-3" />
                            Spoof Call
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

export default CallbackPending;