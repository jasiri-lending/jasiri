import { useState, useEffect } from 'react';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import {
  XCircleIcon,
  UserIcon,
  EyeIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

const RejectedLoans = () => {
  const { profile, loading: authLoading } = useAuth();
  const [rejectedLoans, setRejectedLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState(null);

  // Check user roles - only keep the ones we actually use
  const isBranchManager = profile?.role === "branch_manager";

  useEffect(() => {
    if (profile) {
      fetchRejectedLoans();
    }
  }, [profile]);

  const fetchRejectedLoans = async () => {
    try {
      let query = supabase
        .from("loans")
        .select(`
          *,
          customers (
            Firstname,
            Surname,
            mobile,
            id_number,
            branches (
              id,
              name,
              region_id
            )
          )
        `)
        .eq('status', 'rejected')
        .order('bm_reviewed_at', { ascending: false });

      // Filter by branch for branch managers
      if (isBranchManager && profile?.branch_id) {
        query = query.eq('branch_id', profile.branch_id);
      }
      // Filter by region for regional level roles
      else if (profile?.region_id && !isBranchManager) {
        const { data: branchesInRegion } = await supabase
          .from("branches")
          .select("id")
          .eq("region_id", profile.region_id);
        
        const branchIds = branchesInRegion?.map(b => b.id) || [];
        if (branchIds.length > 0) {
          query = query.in("branch_id", branchIds);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setRejectedLoans(data || []);
    } catch (error) {
      console.error("Error fetching rejected loans:", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading rejected loans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm  bg-gradient-to-r from-gray-600 to-gray-600 bg-clip-text text-transparent">
                Rejected Loans 
              </h2>
              {/* <p className="text-sm text-gray-500 mt-1">
                Role: {profile?.role?.replace(/_/g, " ").toUpperCase()} 
              </p> */}
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-100 to-blue-100 border border-indigo-200">
              <XCircleIcon className="h-3 w-3 text-indigo-600" />
              <span className="text-sm text-indigo-700">
                {rejectedLoans.length} Rejected
              </span>
            </div>
          </div>
        </div>

        {/* Rejected Loans Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              {/* Table Header */}
              <thead>
                <tr className="text-sm text-white"
          style={{ backgroundColor: "#586ab1" }}>
                  <th className="px-6 py-3 text-left font-medium">Loan ID</th>
                  <th className="px-6 py-3 text-left font-medium">Customer</th>
                  {!isBranchManager && (
                    <th className="px-6 py-3 text-left font-medium">Branch</th>
                  )}
                  <th className="px-6 py-3 text-left font-medium">Product</th>
                  <th className="px-6 py-3 text-right font-medium">Amount</th>
                  <th className="px-6 py-3 text-center font-medium">Rejected By</th>
                  <th className="px-6 py-3 text-center font-medium">Rejected Date</th>
                  <th className="px-6 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-gray-200">
                {rejectedLoans.map((loan, index) => (
                  <tr
                    key={loan.id}
                    className={`${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } hover:bg-gray-100 transition-colors text-gray-900`}
                  >
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className="font-mono text-indigo-600 font-semibold">
                        #{loan.id}
                      </span>
                    </td>

                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-5 w-5 text-gray-400" />
                        <div>
                          <div className="font-semibold">
                            {loan.customers?.Firstname} {loan.customers?.Surname}
                          </div>
                          <div className="text-xs text-gray-500">
                            {loan.customers?.mobile}
                          </div>
                        </div>
                      </div>
                    </td>

                    {!isBranchManager && (
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {loan.customers?.branches?.name || 'N/A'}
                        </span>
                      </td>
                    )}

                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className="font-semibold text-purple-600">
                        {loan.product_name || loan.product}
                      </span>
                    </td>

                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      <div className="font-bold text-emerald-600">
                        KES {loan.scored_amount?.toLocaleString()}
                      </div>
                    </td>

                    <td className="px-6 py-3 text-center whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        loan.bm_decision === 'rejected' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {loan.bm_decision === 'rejected' ? 'Branch Manager' : 'Regional Manager'}
                      </span>
                    </td>

                    <td className="px-6 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 text-gray-600">
                        <CalendarIcon className="h-4 w-4" />
                        <span className="text-xs">
                          {new Date(loan.bm_reviewed_at || loan.rm_reviewed_at).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-3 text-center whitespace-nowrap">
                      <button 
                        onClick={() => setSelectedLoan(loan)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition text-sm"
                      >
                        <EyeIcon className="h-4 w-4" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {rejectedLoans.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <XCircleIcon className="h-10 w-10 text-gray-400 mx-auto mb-4" />
              <h3 className="text-sm font-semibold text-slate-600 mb-2">No rejected loans</h3>
              <p>
                {isBranchManager 
                  ? "No loans have been rejected in your branch."
                  : "No loans have been rejected in your region."}
              </p>
            </div>
          )}
        </div>

        {/* Rejection Details Modal */}
        {selectedLoan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Rejection Details</h3>
                <button
                  onClick={() => setSelectedLoan(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircleIcon className="h-6 w-6 text-gray-600" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Loan ID</label>
                    <div className="text-lg font-semibold text-indigo-600">#{selectedLoan.id}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Customer</label>
                    <div className="text-lg font-semibold text-gray-900">
                      {selectedLoan.customers?.Firstname} {selectedLoan.customers?.Surname}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Amount</label>
                    <div className="text-lg font-semibold text-emerald-600">
                      KES {selectedLoan.scored_amount?.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Rejected Date</label>
                    <div className="text-lg font-semibold text-gray-900">
                      {new Date(selectedLoan.bm_reviewed_at || selectedLoan.rm_reviewed_at).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                  {!isBranchManager && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-500">Branch</label>
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedLoan.customers?.branches?.name || 'N/A'}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Rejected By</label>
                    <div className={`text-lg font-semibold ${
                      selectedLoan.bm_decision === 'rejected' ? 'text-red-600' : 'text-orange-600'
                    }`}>
                      {selectedLoan.bm_decision === 'rejected' ? 'Branch Manager' : 'Regional Manager'}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Loan Type</label>
                    <div className={`text-lg font-semibold ${
                      selectedLoan.is_new_loan ? 'text-green-600' : 'text-blue-600'
                    }`}>
                      {selectedLoan.is_new_loan ? 'New Loan' : 'Repeat Loan'}
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500 flex items-center mb-2">
                    <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1" />
                    Rejection Reason
                  </label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-gray-800">
                      {selectedLoan.bm_comment || selectedLoan.rm_comment || 'No specific reason provided'}
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-lg p-4 border border-red-200">
                  <div className="flex items-center">
                    <XCircleIcon className="h-5 w-5 text-red-600 mr-2" />
                    <span className="font-semibold text-red-800">Loan Status: REJECTED</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1">
                    This loan application has been rejected and cannot be processed further.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RejectedLoans;