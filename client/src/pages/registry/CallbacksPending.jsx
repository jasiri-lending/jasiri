import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from "../../hooks/userAuth";
import { 
  MagnifyingGlassIcon, 
  EyeIcon,
  CheckIcon,
  ClockIcon,
  UserIcon,
  PhoneIcon,
  BuildingLibraryIcon,
  MapIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { supabase } from "../../supabaseClient";
import { useNavigate } from 'react-router-dom';

const CallbackPending = () => {
  const [customers, setCustomers] = useState([]);
  const { profile } = useAuth();
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState({});
  const [regions, setRegions] = useState({});
  
  const navigate = useNavigate();

  // Fetch branches and regions data - memoized to prevent re-creation
  const fetchBranchesAndRegions = useCallback(async () => {
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
  }, []); // No dependencies - only created once

  const fetchPendingCustomers = useCallback(async () => {
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
  }, [profile?.region_id]); // Only depends on region_id

  // Initial data fetch - only runs once when profile is available
  useEffect(() => {
    if (profile?.region_id) {
      fetchBranchesAndRegions();
      fetchPendingCustomers();
    }
  }, [profile?.region_id, fetchBranchesAndRegions, fetchPendingCustomers]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            
            {/* Left: Header */}
            <div className="space-y-1">
              <h1 className="text-lg  text-slate-600 tracking-tight">
                Pending Callbacks
              </h1>
              <p className="text-sm text-slate-600 flex items-center gap-2">
                <ClockIcon className="w-4 h-4" />
                <span className="font-medium text-sm">{filteredCustomers.length}</span> 
                {filteredCustomers.length === 1 ? 'customer' : 'customers'} awaiting review
              </p>
            </div>

            {/* Right: Search */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-1 w-full lg:w-96 hover:shadow-md transition-shadow duration-200">
              <div className="relative">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  className="w-full pl-12 pr-4 py-3 text-sm border-0 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all placeholder-slate-400 bg-slate-50/50"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

          </div>
        </div>

   

        {/* Table */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200/60 overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full whitespace-nowrap">
      <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
        <tr>
          {["ID Number", "Name", "Branch", "Region", "Pre-Amount", "Mobile", "Actions"].map((head) => (
            <th
              key={head}
              className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider"
            >
              {head}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y divide-slate-100">
        {loading ? (
          <tr>
            <td colSpan="7" className="px-6 py-16 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600"></div>
                </div>
                <span className="mt-4 text-slate-600 text-sm font-medium">Loading customers...</span>
              </div>
            </td>
          </tr>
        ) : filteredCustomers.length === 0 ? (
          <tr>
            <td colSpan="7" className="px-6 py-16 text-center">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No pending callbacks</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                {searchTerm
                  ? "No customers match your search criteria. Try adjusting your filters."
                  : "All customers have been processed. Great job!"}
              </p>
            </td>
          </tr>
        ) : (
          filteredCustomers.map((customer, index) => (
            <tr
              key={customer.id}
              className="hover:bg-slate-50/80 transition-colors duration-150"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                {customer.id_number || customer.national_id || "N/A"}
              </td>

              <td className="px-6 py-4 text-sm font-medium text-slate-900">
                {`${customer.Firstname || ''} ${customer.Surname || ''}`.trim() || "N/A"}
              </td>

              <td className="px-6 py-4 text-sm text-slate-700 font-medium">
                {branches[customer.branch_id] || "N/A"}
              </td>

              <td className="px-6 py-4 text-sm text-slate-700 font-medium">
                {regions[customer.region_id] || "N/A"}
              </td>

              <td className="px-6 py-4">
                <span className="inline-flex items-center px-3 py-1.5 text-sm font-bold text-emerald-700   ">
                  {customer.prequalifiedAmount
                    ? `KES ${Number(customer.prequalifiedAmount).toLocaleString()}`
                    : "N/A"}
                </span>
              </td>

              <td className="px-6 py-4 text-sm text-slate-700 font-medium">
                {customer.mobile || "N/A"}
              </td>

              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleView(customer)}
                    className="inline-flex items-center px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 hover:shadow-sm transition-all duration-200 border border-blue-200"
                  >
                    View
                  </button>

                  {profile?.role === "customer_service_officer" && (
                    <button
                      onClick={() => handleApprove(customer.id)}
                      className="inline-flex items-center px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 hover:shadow-sm transition-all duration-200 border border-emerald-200"
                    >
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
</div>

      </div>
    </div>
  );
};

export default CallbackPending;