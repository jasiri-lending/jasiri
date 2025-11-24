import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import {
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  ChevronUpDownIcon
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";

const LoanPendingDisbursement = () => {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  const isCreditAnalyst = profile?.role === "credit_analyst_officer";

  useEffect(() => {
    if (profile) {
      fetchPendingDisbursementLoans();
    }
  }, [profile]);

  const fetchPendingDisbursementLoans = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("loans")
        .select(`
          *,
          customers (
            *,
            branches (
              id,
              name,
              region_id
            )
          )
        `)
        .eq('status', 'ca_review')
        .order('created_at', { ascending: false });

      // Filter by branch for branch managers
      if (profile?.role === "branch_manager" && profile?.branch_id) {
        query = query.eq('branch_id', profile.branch_id);
      }
      // Filter by region for regional level roles
      else if (profile?.region_id && profile?.role !== "branch_manager") {
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

      setLoans(data || []);
    } catch (error) {
      console.error("Error fetching pending disbursement loans:", error);
      toast.error("Failed to load loans");
    } finally {
      setLoading(false);
    }
  };

  const filteredLoans = loans.filter((loan) => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    const loanId = loan.id?.toString().toLowerCase() || "";
    const firstName = loan.customers?.Firstname?.toLowerCase() || "";
    const surname = loan.customers?.Surname?.toLowerCase() || "";
    const fullName = `${firstName} ${surname}`;
    const idNumber = loan.customers?.id_number?.toLowerCase() || "";
    const mobile = loan.customers?.mobile?.toLowerCase() || "";
    
    return (
      loanId.includes(search) ||
      firstName.includes(search) ||
      surname.includes(search) ||
      fullName.includes(search) ||
      idNumber.includes(search) ||
      mobile.includes(search)
    );
  });

  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const sortedLoans = [...filteredLoans].sort((a, b) => {
    if (sortConfig.key) {
      const aValue = getNestedValue(a, sortConfig.key);
      const bValue = getNestedValue(b, sortConfig.key);
      
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
    }
    return 0;
  });

  const handleViewLoan = (loanId) => {
    navigate(`/view-disbursed-loans/${loanId}`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading pending disbursements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-sm font-semibold text-slate-600">
                Loans Pending Disbursement
              </h1>
             
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-100 to-blue-100 border border-indigo-200">
              <ClockIcon className="h-3 w-3 text-indigo-600" />
              <span className="font-small text-xs text-indigo-700">
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
              placeholder="Search by loan ID, customer name, ID number, or mobile..."
              className="w-full pl-12 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {filteredLoans.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm ? "No loans found" : "No Pending Disbursements"}
            </h3>
            <p className="text-gray-600">
              {searchTerm 
                ? "No loans match your search criteria."
                : isCreditAnalyst 
                  ? "All loans have been disbursed. Great work!"
                  : "There are no loans pending disbursement in your area."}
            </p>
          </div>
        ) : (<div className="overflow-x-auto">
  <table className="min-w-full divide-y divide-gray-200">

    {/* HEADER */}
    <thead style={{ backgroundColor: "#586ab1" }}>
      <tr>
        {/* DATE */}
        <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
          Date
        </th>

        {/* LOAN ID */}
        <th
          className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer"
          onClick={() => handleSort('id')}
        >
          <div className="flex items-center gap-1">
            Loan ID
            <ChevronUpDownIcon className="h-4 w-4" />
          </div>
        </th>

        {/* CUSTOMER */}
        <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
          Customer
        </th>

        {/* BRANCH */}
        <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
          Branch
        </th>

        {/* PRODUCT */}
        <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
          Product
        </th>

        {/* AMOUNT */}
        <th
          className="px-6 py-3 text-right text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap cursor-pointer"
          onClick={() => handleSort('scored_amount')}
        >
          <div className="flex items-center justify-end gap-1">
            Amount
            <ChevronUpDownIcon className="h-4 w-4" />
          </div>
        </th>

        {/* DURATION */}
        <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
          Duration
        </th>

        {/* STATUS */}
        <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
          Status
        </th>

        {/* ACTION */}
        <th className="px-6 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap">
          Action
        </th>
      </tr>
    </thead>

    {/* BODY */}
    <tbody className="bg-white divide-y divide-gray-200">
      {sortedLoans.map((loan) => (
        <tr key={loan.id} className="hover:bg-gray-50 transition-colors">

          {/* DATE */}
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm text-gray-900">
              {new Date(loan.created_at).toLocaleDateString("en-GB")}
            </div>
          </td>

          {/* LOAN ID */}
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm font-mono font-bold text-indigo-600">
              #{loan.id}
            </div>
          </td>

          {/* CUSTOMER (name only) */}
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm font-medium text-gray-900">
              {loan.customers?.Firstname} {loan.customers?.Surname}
            </div>
          </td>

          {/* BRANCH */}
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm text-gray-900">
              {loan.customers?.branches?.name || "N/A"}
            </div>
          </td>

          {/* PRODUCT */}
          <td className="px-6 py-4 whitespace-nowrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              {loan.product_name}
            </span>

            {loan.is_new_loan && (
              <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                New
              </span>
            )}
          </td>

          {/* AMOUNT */}
          <td className="px-6 py-4 whitespace-nowrap text-right">
            <div className="text-sm font-bold text-emerald-600">
              KES {loan.scored_amount?.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">
              Weekly: KES {loan.weekly_payment?.toLocaleString()}
            </div>
          </td>

          {/* DURATION */}
          <td className="px-6 py-4 whitespace-nowrap text-center">
            <div className="text-sm font-semibold text-gray-900">
              {loan.duration_weeks} weeks
            </div>
          </td>

          {/* STATUS */}
          <td className="px-6 py-4 whitespace-nowrap text-center">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
              <CheckCircleIcon className="h-3 w-3 mr-1" />
              Ready
            </span>
          </td>

          {/* ACTION */}
          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
            <button
              onClick={() => handleViewLoan(loan.id)}
className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-100 rounded-full hover:bg-blue-200 transition-all"
style={{ backgroundColor: "#586ab1" }}
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


        )}
      </div>
    </div>
  );
};

export default LoanPendingDisbursement;