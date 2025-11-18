import React, { useState, useEffect } from 'react';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import {
  ClockIcon,
  UserIcon,
  CurrencyDollarIcon,
  EyeIcon,
  CalendarIcon,
  CheckCircleIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import ApproveLoan from "./ApproveLoan";

const LoanPendingBm = () => {
  const { profile, loading: authLoading } = useAuth();
  const [pendingLoans, setPendingLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Check if user is branch manager
  const isBranchManager = profile?.role === "branch_manager";

  useEffect(() => {
    if (profile) {
      fetchPendingLoans();
    }
  }, [profile]);

  const fetchPendingLoans = async () => {
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
        .eq('status', 'bm_review')
        .order('created_at', { ascending: true });

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
      setPendingLoans(data || []);
    } catch (error) {
      console.error("Error fetching pending loans:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter loans based on search term
  const filteredLoans = pendingLoans.filter((loan) => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    const loanId = loan.id?.toString().toLowerCase() || "";
    const firstName = loan.customers?.Firstname?.toLowerCase() || "";
    const surname = loan.customers?.Surname?.toLowerCase() || "";
    const fullName = `${firstName} ${surname}`;
    
    return (
      loanId.includes(search) ||
      firstName.includes(search) ||
      surname.includes(search) ||
      fullName.includes(search)
    );
  });

  const handleComplete = () => {
    setSelectedLoan(null);
    fetchPendingLoans();
  };

  if (selectedLoan) {
    return <ApproveLoan loan={selectedLoan} onComplete={handleComplete} />;
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading pending loans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "#586ab1" }}>
                Loans Pending Branch Manager Approval
              </h2>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100">
              <ClockIcon className="h-3 w-3 text-indigo-600" />
              <span className="text-xs font-medium text-indigo-700">
                {filteredLoans.length} Pending
              </span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-8">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by loan ID or customer name..."
              className="w-full pl-12 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Pending Loans Table */}<div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
  <div className="overflow-x-auto">
    <table className="min-w-full border-collapse">
      {/* Table Header */}
      <thead>
        <tr
          className="text-sm text-white"
          style={{ backgroundColor: "#586ab1" }}
        >
          <th className="px-6 py-3 text-left font-medium whitespace-nowrap">Loan ID</th>
          <th className="px-6 py-3 text-left font-medium whitespace-nowrap">Customer Name</th>
          <th className="px-6 py-3 text-left font-medium whitespace-nowrap">Mobile</th>
          {!isBranchManager && (
            <th className="px-6 py-3 text-left font-medium whitespace-nowrap">Branch</th>
          )}
          <th className="px-6 py-3 text-left font-medium whitespace-nowrap">Product</th>
          <th className="px-6 py-3 text-right font-medium whitespace-nowrap">Amount</th>
          <th className="px-6 py-3 text-center font-medium whitespace-nowrap">Duration</th>
          <th className="px-6 py-3 text-center font-medium whitespace-nowrap">Applied Date</th>
          <th className="px-6 py-3 text-center font-medium whitespace-nowrap">Actions</th>
        </tr>
      </thead>

      {/* Table Body */}
      <tbody className="divide-y divide-gray-200">
        {filteredLoans.map((loan, index) => (
          <tr
            key={loan.id}
            className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition-colors text-gray-900`}
          >
            <td className="px-6 py-3 whitespace-nowrap">
              <span className="font-mono text-indigo-600 font-semibold">
                #{loan.id}
              </span>
            </td>

            <td className="px-6 py-3 whitespace-nowrap">
              <span className="font-semibold">
                {loan.customers?.Firstname} {loan.customers?.Surname}
              </span>
            </td>

            <td className="px-6 py-3 whitespace-nowrap">
              <span>{loan.customers?.mobile}</span>
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
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                {loan.duration_weeks} weeks
              </span>
            </td>

            <td className="px-6 py-3 text-center whitespace-nowrap">
              <div className="flex items-center justify-center gap-1 text-gray-600">
                <CalendarIcon className="h-4 w-4" />
                <span className="text-xs">
                  {new Date(loan.created_at).toLocaleDateString('en-GB')}
                </span>
              </div>
            </td>

            <td className="px-6 py-3 text-center whitespace-nowrap">
              {isBranchManager ? (
                <button
                  onClick={() => setSelectedLoan(loan)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-lg font-semibold transition hover:shadow-lg"
                  style={{ color: "#586ab1" }}
                >
                  <EyeIcon className="h-4 w-4" />
                  Review
                </button>
              ) : (
                <button
                  disabled
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 text-gray-500 rounded-md cursor-not-allowed text-sm"
                >
                  <LockClosedIcon className="h-4 w-4" />
                  View Only
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  {/* Empty State */}
  {filteredLoans.length === 0 && (
    <div className="text-center py-12 text-gray-500">
      <ClockIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        {searchTerm ? "No loans found" : "No pending approvals"}
      </h3>
      <p>
        {searchTerm
          ? "No loans match your search criteria."
          : isBranchManager
          ? "All loans have been reviewed by the branch manager."
          : "There are no loans pending branch manager approval in your area."}
      </p>
    </div>
  )}
</div>


      </div>
    </div>
  );
};

export default LoanPendingBm;