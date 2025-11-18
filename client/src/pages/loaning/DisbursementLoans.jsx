import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { useNavigate } from "react-router-dom";
import {
  BanknotesIcon,
  EyeIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  UserIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const DisbursedLoans = () => {
  const { profile, loading: authLoading } = useAuth();
  const [loans, setLoans] = useState([]);
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [branches, setBranches] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const navigate = useNavigate();

  const isBranchManager = profile?.role === "branch_manager";
  const isRegionalManager = profile?.role === "regional_manager";
  const isSuperAdmin = profile?.role === "super_admin";
  const isGlobalRole = isSuperAdmin;

  useEffect(() => {
    if (profile) {
      fetchBranches();
      fetchDisbursedLoans();
    }
  }, [profile]);

  useEffect(() => {
    filterLoans();
  }, [loans, branchFilter, searchTerm]);

  const fetchBranches = async () => {
    try {
      let query = supabase.from("branches").select("id, name").order("name");
      
      if (isBranchManager && profile?.branch_id) {
        query = query.eq("id", profile.branch_id);
      } else if (isRegionalManager && profile?.region_id) {
        const { data: branchesInRegion } = await supabase
          .from("branches")
          .select("id")
          .eq("region_id", profile.region_id);
        const branchIds = branchesInRegion?.map((b) => b.id) || [];
        if (branchIds.length > 0) {
          query = query.in("id", branchIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchDisbursedLoans = async () => {
    try {
      setLoading(true);
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
          ),
          users!loans_created_by_fkey (
            full_name
          )
        `)
        .eq("status", "disbursed")
        .order("disbursed_at", { ascending: false });

      if (isBranchManager && profile?.branch_id) {
        query = query.eq("branch_id", profile.branch_id);
      } else if (isRegionalManager && profile?.region_id) {
        const { data: branchesInRegion } = await supabase
          .from("branches")
          .select("id")
          .eq("region_id", profile.region_id);
        const branchIds = branchesInRegion?.map((b) => b.id) || [];
        if (branchIds.length > 0) {
          query = query.in("branch_id", branchIds);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setLoans(data || []);
    } catch (error) {
      console.error("Error fetching disbursed loans:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterLoans = () => {
    let filtered = loans;

    if (branchFilter !== "all") {
      filtered = filtered.filter((loan) => 
        loan.customers?.branches?.id?.toString() === branchFilter
      );
    }
if (searchTerm) {
  filtered = filtered.filter(
    (loan) =>
      loan.customers?.Firstname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.customers?.Surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.customers?.mobile?.includes(searchTerm) ||
      (loan.customers?.id_number?.toString().includes(searchTerm)) || // <-- convert to string
      loan.id?.toString().includes(searchTerm)
  );
}


    setFilteredLoans(filtered);
  };

  const clearFilters = () => {
    setBranchFilter("all");
    setSearchTerm("");
  };

  const handleViewDetails = (loanId) => {
    navigate(`/viewdisbursedloans/${loanId}`);
  };

  const getStatusBadge = () => {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
        <BanknotesIcon className="h-3 w-3" />
        Disbursed
      </span>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading disbursed loans...</p>
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
              <h1 className="text-sm font-semibold text-slate-600">Disbursed Loans</h1>
             
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-50 border border-indigo-100">
              <BanknotesIcon className="h-3 w-3 text-indigo-600" />
              <span className="text-xs font-medium text-indigo-700">
                {filteredLoans.length} Active Loans
              </span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4 border border-indigo-100">
          <div className="flex flex-col gap-4">
            {/* Search and Filter Toggle */}
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              {/* Search Input */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Loans
                </label>
                <div className="relative">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by customer name, mobile, ID number, or loan ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                </div>
              </div>

              {/* Filter Toggle */}
              <div className="flex items-end space-x-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center px-4 py-3 border rounded-lg transition-colors text-sm ${
                    showFilters || branchFilter !== "all"
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <FunnelIcon className="h-5 w-5 mr-2" />
                  Filters
                  {branchFilter !== "all" && (
                    <span className="ml-2 px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full">
                      1
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Branch Filter */}
                  {(isGlobalRole || isRegionalManager) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Filter by Branch
                      </label>
                      <div className="flex items-center gap-2">
                        <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
                        <select
                          value={branchFilter}
                          onChange={(e) => setBranchFilter(e.target.value)}
                          className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        >
                          <option value="all">All Branches</option>
                          {branches.map((branch) => (
                            <option key={branch.id} value={branch.id.toString()}>
                              {branch.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Clear Filters */}
                  <div className="flex items-end">
                    <button
                      onClick={clearFilters}
                      className="flex items-center px-4 py-3 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <XMarkIcon className="h-4 w-4 mr-1" />
                      Clear Filters
                    </button>
                  </div>
                </div>

                {/* Active Filters Display */}
                {branchFilter !== "all" && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                    <span className="text-xs text-gray-600">Active filters:</span>
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      Branch: {branches.find((b) => b.id.toString() === branchFilter)?.name}
                      <button
                        onClick={() => setBranchFilter("all")}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Results Summary */}
        {loans.length > 0 && (
          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Showing {filteredLoans.length} of {loans.length} disbursed loans
              {(searchTerm || branchFilter !== "all") && " (filtered)"}
            </p>
          </div>
        )}

        {/* Loans Table */}
        <div className="bg-white rounded-lg shadow-lg border border-indigo-100 overflow-x-auto">
          <table className="w-full border-collapse min-w-[1000px]">
            <thead>
              <tr className="text-white text-sm" style={{ backgroundColor: "#586ab1" }}>
                <th className="px-4 py-4 text-left font-semibold whitespace-nowrap">
                  Loan Details
                </th>
                <th className="px-4 py-4 text-left font-semibold whitespace-nowrap">
                  Customer
                </th>
                <th className="px-4 py-4 text-left font-semibold whitespace-nowrap">
                  Contact
                </th>
                {(isGlobalRole || isRegionalManager) && (
                  <th className="px-4 py-4 text-left font-semibold whitespace-nowrap">
                    Branch
                  </th>
                )}
                <th className="px-4 py-4 text-center font-semibold whitespace-nowrap">
                  Duration
                </th>
                <th className="px-4 py-4 text-right font-semibold whitespace-nowrap">
                  Amount
                </th>
                <th className="px-4 py-4 text-center font-semibold whitespace-nowrap">
                  Status
                </th>
                <th className="px-4 py-4 text-center font-semibold whitespace-nowrap">
                  Disbursed Date
                </th>
                <th className="px-4 py-4 text-center font-semibold whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 text-sm">
              {filteredLoans.map((loan, index) => (
                <tr
                  key={loan.id}
                  className={`${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-indigo-50 transition-colors`}
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-mono font-semibold text-indigo-600">
                        #{loan.id}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {loan.product_name || "Standard Loan"}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">
                        {loan.customers?.Firstname} {loan.customers?.Surname}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        ID: {loan.customers?.id_number}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-gray-900">{loan.customers?.mobile}</div>
                  </td>
                  {(isGlobalRole || isRegionalManager) && (
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900">
                          {loan.customers?.branches?.name || "N/A"}
                        </span>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {loan.duration_weeks} weeks
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right whitespace-nowrap">
                    <div className="font-bold text-emerald-600">
                      KES {loan.scored_amount?.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Weekly: KES {loan.weekly_payment?.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    {getStatusBadge(loan.status)}
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center text-gray-600">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      {new Date(loan.disbursed_at).toLocaleDateString("en-GB")}
                    </div>
                  </td>
                 <td className="px-4 py-4 text-center whitespace-nowrap">
  <button
    onClick={() => handleViewDetails(loan.id)}
    className="flex items-center gap-1 px-2 py-1 text-white text-xs rounded-lg transition-all duration-300 hover:shadow-lg"
    style={{ backgroundColor: "#586ab1" }}
    title="View Loan Details"
  >
    <EyeIcon className="h-3 w-3" />
    View
  </button>
</td>

                </tr>
              ))}
            </tbody>
          </table>

          {filteredLoans.length === 0 && (
            <div className="text-center py-16">
              <BanknotesIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchTerm || branchFilter !== "all" ? "No loans found" : "No Disbursed Loans"}
              </h3>
              <p className="text-sm text-gray-600">
                {searchTerm || branchFilter !== "all"
                  ? "Try adjusting your filters or search criteria."
                  : "No loans have been disbursed yet."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DisbursedLoans;