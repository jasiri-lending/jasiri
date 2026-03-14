import { useState, useEffect, useRef } from 'react';
import {
  MagnifyingGlassIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  UserIcon,
  PhoneIcon,
  IdentificationIcon,
  ClipboardDocumentCheckIcon,
  ArrowLeftIcon,
  InboxIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../hooks/userAuth.js";
import { useNavigate } from 'react-router-dom';
import Spinner from "../../components/Spinner";

const CustomerDrafts = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const { profile } = useAuth();
  const userRole = profile?.role;
  const userBranchId = profile?.branch_id;
  const hasFetchedData = useRef(false);

  const fetchPendingCustomers = async () => {
    setLoading(true);
    try {
      if (!userRole) return;

      let query = supabase
        .from("customers")
        .select(`
          *,
          branches (
            id,
            name
          ),
          regions (
            id,
            name
          ),
          users:created_by (
            id,
            full_name
          )
        `)
        .eq("tenant_id", profile?.tenant_id)
        .eq("form_status", "draft")
        .order("created_at", { ascending: false });

      if (userRole === 'branch_manager') {
        query = query.eq("status", "bm_review");
        if (userBranchId) query = query.eq("branch_id", userBranchId);
      } else if (userRole === 'credit_analyst_officer') {
        query = query.eq("status", "ca_review");
      } else if (userRole === 'customer_service_officer') {
        query = query.eq("status", "cso_review");
      } else {
        console.error("Unknown user role:", userRole);
        return;
      }

      const { data, error } = await query;
      if (error) throw error;

      setCustomers(data || []);
      setFilteredCustomers(data || []);
    } catch (err) {
      console.error("Error fetching drafts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile && !hasFetchedData.current) {
      hasFetchedData.current = true;
      fetchPendingCustomers();
    }
  }, [profile]);

  useEffect(() => {
    if (!customers) return;

    const terms = searchTerm.toLowerCase().split(' ').filter(Boolean);
    const filtered = customers.filter(customer => {
      const searchStr = `
        ${customer.first_name} ${customer.middle_name} ${customer.last_name} 
        ${customer.id_number} ${customer.national_id} ${customer.mobile} 
        ${customer.phone_number}
      `.toLowerCase();
      return terms.every(term => searchStr.includes(term));
    });
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  const handleApproveNavigation = (customerId) => {
    if (userRole === 'customer_service_officer') {
      navigate(`/customer/${customerId}/verify-customer_service_officer`);
    } else {
      navigate(`/customer/${customerId}/verify`);
    }
  };

  const handleViewNavigation = (customerId) => {
    navigate(`/customer/${customerId}/360`);
  };

  const getStatusDisplay = (status) => {
    const statusMap = {
      'bm_review': 'BM Review',
      'ca_review': 'CA Review',
      'cso_review': 'CSO Review',
      'cso_review_amend': 'CSO Review (Amend)',
      'bm_review_amend': 'BM Review (Amend)',
      'ca_review_amend': 'CA Review (Amend)'
    };
    return statusMap[status] || status || 'N/A';
  };

  if (!profile) return <div className="h-screen flex items-center justify-center bg-slate-50"><Spinner text="Loading profile..." /></div>;

  return (
    <div className="bg-muted transition-all duration-300 p-6 min-h-screen font-sans">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xs text-slate-600 mb-1 font-medium tracking-wide">
            Drafts / Customer Verification
          </h1>
        </div>
        <div className="text-xs text-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm bg-brand-primary">
          <span className="font-medium text-white">{filteredCustomers.length}</span> drafts pending
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Search Bar */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID, or mobile number..."
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-all duration-200 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 hover:text-gray-900"
                >
                  <AdjustmentsHorizontalIcon className="h-4 w-4" />
                  Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto font-sans">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="h-12 w-12 rounded-full border-4 border-slate-100 border-t-brand-primary animate-spin"></div>
              <p className="text-slate-500 font-medium">Synchronizing drafts...</p>
            </div>
          ) : filteredCustomers.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ backgroundColor: '#E7F0FA' }}>
                  <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap text-slate-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap text-slate-600">
                    ID Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap text-slate-600">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap text-slate-600">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-left text-xs tracking-wider whitespace-nowrap text-slate-600">
                    Region
                  </th>
                  <th className="px-4 py-3 text-center text-xs tracking-wider whitespace-nowrap text-slate-600">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-center text-xs tracking-wider whitespace-nowrap text-slate-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs tracking-wider whitespace-nowrap text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((customer, index) => {
                  const fullName = `${customer.Firstname || customer.first_name || ""} ${customer.Surname || customer.last_name || ""}`.trim() || "N/A";

                  return (
                    <tr key={customer.id} className={`border-b transition-colors hover:bg-gray-50 ${index % 2 === 0 ? '' : 'bg-gray-50'}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 capitalize">
                        {fullName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {customer.id_number || customer.national_id || "N/A"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {customer.mobile || customer.phone_number || "N/A"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {customer.branches?.name || (Array.isArray(customer.branches) ? customer.branches[0]?.name : null) || customer.Branch || customer.branch_name || "N/A"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                        {customer.regions?.name || (Array.isArray(customer.regions) ? customer.regions[0]?.name : null) || customer.Region || customer.region_name || "N/A"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-slate-600">
                        {customer.prequalifiedAmount ? Number(customer.prequalifiedAmount).toLocaleString() : "0"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200">
                          {getStatusDisplay(customer.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2 text-slate-600">
                          <button
                            onClick={() => handleViewNavigation(customer.id)}
                            className="p-1.5 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 text-blue-600 hover:from-blue-100 hover:to-blue-200 hover:text-blue-700 hover:border-blue-300 transition-all duration-200 shadow-sm"
                            title="View 360 View"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleApproveNavigation(customer.id)}
                            className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5"
                          >
                            <span>Resume</span>
                            <ChevronRightIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-24 flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                <BoxIcon className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">No drafts found</h3>
              <p className="text-slate-500 max-w-[280px] mt-1 text-sm">
                No draft verifications found matching your current role or criteria.
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 text-brand-primary font-bold text-xs uppercase tracking-widest hover:text-brand-primary/80"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

};

// Simple Fallback Box Icon if BoxIcon is not available
const BoxIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

export default CustomerDrafts;
