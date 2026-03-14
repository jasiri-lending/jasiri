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
        .select("*")
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
    <div className="min-h-screen bg-muted p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
           
            <h1 className="text-sm  text-slate-600 tracking-tight">
              Customer Drafts
            </h1>
          
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200 px-4 py-2 rounded-xl shadow-sm flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></div>
              <span className="text-sm font-semibold text-slate-700">
                {filteredCustomers.length} <span className="text-slate-400 font-normal">Drafts Pending</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white shadow-xl shadow-slate-200/50 mb-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <MagnifyingGlassIcon className="h-3 w-3 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID, or mobile number..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-slate-700 placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-medium transition-all shadow-sm"
          >
            <AdjustmentsHorizontalIcon className="h-3 w-3" />
            <span>Filters</span>
          </button>
        </div>

        {/* Drafts Grid/Table */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <InboxIcon className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
              <p className="text-slate-500 font-medium animate-pulse">Synchronizing drafts...</p>
            </div>
          ) : filteredCustomers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Customer Details</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Identity</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Amount</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center text-indigo-600 border border-indigo-200 shrink-0">
                            <UserIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 leading-none mb-1 capitalize group-hover:text-indigo-600 transition-colors">
                              {`${customer.first_name} ${customer.last_name}`}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                              <PhoneIcon className="h-3 w-3" />
                              {customer.mobile || "N/A"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          <IdentificationIcon className="h-3.5 w-3.5" />
                          <span className="text-xs font-bold">{customer.id_number || "---"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-bold text-slate-900">
                          <span className="text-[10px] text-slate-400 font-medium mr-1 uppercase">KES</span>
                          {customer.prequalifiedAmount ? Number(customer.prequalifiedAmount).toLocaleString() : "0"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-200">
                          <div className="h-1 w-1 rounded-full bg-amber-600"></div>
                          {getStatusDisplay(customer.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleViewNavigation(customer.id)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View 360 Degree View"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleApproveNavigation(customer.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 text-xs font-bold transition-all"
                          >
                            <span>Resume</span>
                            <ChevronRightIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-24 flex flex-col items-center justify-center text-center">
              <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                <BoxIcon className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">All clear!</h3>
              <p className="text-slate-500 max-w-[280px] mt-2 text-sm">
                No draft verifications found matching your current role or criteria.
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-6 text-indigo-600 font-bold text-xs uppercase tracking-widest hover:text-indigo-700 flex items-center gap-2"
                >
                  Clear search terms
                  <XMarkIcon className="h-3 w-3" />
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
