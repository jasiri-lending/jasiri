import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../hooks/userAuth";
import Spinner from "../../components/Spinner.jsx";
import {
  MagnifyingGlassIcon,
  ArrowPathIcon, BanknotesIcon, CheckCircleIcon, ClockIcon, XCircleIcon
} from "@heroicons/react/24/outline";

// ── Dynamic status helpers (mirrors ViewLoan.jsx) ──────────────────────────
const getLoanStatusBadge = (status) => {
  const badges = {
    bm_review: "bg-orange-100 text-orange-800 border border-orange-200",
    rm_review: "bg-blue-100 text-blue-800 border border-blue-200",
    ca_review: "bg-indigo-100 text-indigo-800 border border-indigo-200",
    approved: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    ready_for_disbursement: "bg-green-100 text-green-800 border border-green-200",
    disbursed: "bg-teal-100 text-teal-800 border border-teal-200",
    rejected: "bg-red-100 text-red-800 border border-red-200",
    completed: "bg-gray-100 text-gray-700 border border-gray-200",
  };
  return badges[status] || "bg-gray-100 text-gray-600 border border-gray-200";
};

const formatLoanStatus = (status) => {
  const map = {
    bm_review: "Pending BM",
    rm_review: "Pending RM",
    ca_review: "Pending CA",
    approved: "Approved",
    ready_for_disbursement: "Ready to Disburse",
    disbursed: "Disbursed",
    rejected: "Rejected",
    completed: "Completed",
  };
  return map[status] || (status ? status.replace(/_/g, " ") : "No Loan");
};
// ──────────────────────────────────────────────────────────────────────────

function LoanApplication() {
  const [customers, setCustomers] = useState([]);
  const navigate = useNavigate();
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { profile } = useAuth();
  const [lastFetchTime, setLastFetchTime] = useState(0);

  // Fetch approved customers only once in 5 minutes
  const fetchApprovedCustomers = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchTime < 300000) {
      return; // skip if fetched within 5 min
    }

    if (!profile?.id || profile.role !== "relationship_officer") {
      setCustomers([]);
      setFilteredCustomers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: customersData, error } = await supabase
        .from("customers")
        .select(`
          id,
          id_number,
          Firstname,
          Surname,
          mobile,
          prequalifiedAmount, 
          status
        `)
        .eq("status", "approved")
        .eq("created_by", profile.id);

      if (error) throw error;

      if (!customersData || customersData.length === 0) {
        setCustomers([]);
        setFilteredCustomers([]);
        setLastFetchTime(now);
        return;
      }

      // Fetch last loan + scored amounts for each customer
      const customersWithLoanStatus = await Promise.all(
        customersData.map(async (cust) => {
          const { data: lastLoan } = await supabase
            .from("loans")
.select("status, repayment_state")
            .eq("customer_id", cust.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const { data: bmRow } = await supabase
            .from("customer_verifications")
            .select("branch_manager_loan_scored_amount")
            .eq("customer_id", cust.id)
            .not("branch_manager_loan_scored_amount", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const { data: rmRow } = await supabase
            .from("customer_verifications")
            .select("credit_analyst_officer_loan_scored_amount")
            .eq("customer_id", cust.id)
            .not("credit_analyst_officer_loan_scored_amount", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...cust,
            lastLoanStatus: lastLoan?.status || null,
              lastRepaymentState: lastLoan?.repayment_state || null,
            bmScoredAmount: bmRow?.branch_manager_loan_scored_amount || 0,
            caScoredAmount: rmRow?.credit_analyst_officer_loan_scored_amount || 0,
          };
        })
      );

      setCustomers(customersWithLoanStatus);
      setFilteredCustomers(customersWithLoanStatus);
      setLastFetchTime(now);
    } catch (err) {
      console.error("Unexpected error fetching approved customers:", err);
      setCustomers([]);
      setFilteredCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [profile, lastFetchTime]);

  // Fetch once when profile is ready
  useEffect(() => {
    if (profile?.id && profile.role === "relationship_officer") {
      fetchApprovedCustomers();
    }
  }, [profile, fetchApprovedCustomers]);

  // Apply search filter
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCustomers(customers);
      return;
    }

    const term = searchTerm.toLowerCase();
    setFilteredCustomers(
      customers.filter(customer =>
        customer.id_number?.toString().toLowerCase().includes(term) ||
        customer.mobile?.toString().toLowerCase().includes(term) ||
        `${customer.Firstname} ${customer.Surname}`.toLowerCase().includes(term)
      )
    );
  }, [searchTerm, customers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-muted">
        <Spinner text="Loading loan applications..." />
      </div>
    );
  }

  if (!customers.length) {
    return (
      <div className="h-full bg-muted p-6 min-h-screen">
        <h1 className="text-xs text-slate-500 mb-4 font-medium">
          Loan Applications
        </h1>
        <div className="bg-muted rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center text-xs text-gray-500">
            No approved customers available for loan booking.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-muted p-6 min-h-screen">
      <h1 className="text-xs text-slate-500 mb-4 font-medium">
        Loan Applications
      </h1>

      {/* Search and Actions Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="p-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md w-full">
              <MagnifyingGlassIcon className="h-4 w-4 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by ID, phone or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
              />
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchApprovedCustomers}
              className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-all font-medium shadow-md flex items-center gap-2"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Customer</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">ID</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Phone</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Scored Amount</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">Status</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((application) => (
                <tr
                  key={application.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  {/* Customer Name */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div
                        className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium bg-brand-surface text-brand-primary border border-brand-primary/20"
                      >
                        {application.Firstname?.charAt(0)}
                        {application.Surname?.charAt(0)}
                      </div>
                      <div className="ml-3">
                        <div className="text-xs font-medium text-slate-600">
                          {application.Firstname} {application.Surname}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* ID */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-xs text-gray-700">{application.id_number}</div>
                  </td>

                  {/* Phone */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-xs text-gray-700">{application.mobile}</div>
                  </td>

                  {/* Scored Amount */}
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="text-xs text-gray-700 font-medium">
                      {application.caScoredAmount
                        ? `Ksh ${Number(application.caScoredAmount).toLocaleString()}`
                        : application.bmScoredAmount
                          ? `Ksh ${Number(application.bmScoredAmount).toLocaleString()}`
                          : "N/A"}
                    </div>
                  </td>

                  {/* Dynamic Loan Status */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {application.lastLoanStatus ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${getLoanStatusBadge(application.lastLoanStatus)}`}>
                        {application.lastRepaymentState === "completed"
                          ? <CheckCircleIcon className="h-3 w-3" />
                          : application.lastLoanStatus === "rejected"
                          ? <XCircleIcon className="h-3 w-3" />
                          : <ClockIcon className="h-3 w-3" />}
                        {application.lastRepaymentState === "completed"
                          ? "Completed"
                          : formatLoanStatus(application.lastLoanStatus)}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        No Loan
                      </span>
                    )}
                  </td>

                  {/* Actions */}
<td className="px-4 py-3 text-center whitespace-nowrap">
  {(() => {
    const status = application.lastLoanStatus?.toLowerCase()?.trim();
    const repayment = application.lastRepaymentState?.toLowerCase()?.trim();

    // Allow booking if fully paid
    if (repayment === "completed") {
      return (
        <button
          onClick={() =>
            navigate(`/officer/loan-booking/${application.id}`, {
              state: { customerData: application },
            })
          }
          className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-all font-medium text-xs flex items-center gap-2 shadow-sm mx-auto"
        >
          <BanknotesIcon className="h-4 w-4" />
          Book Loan
        </button>
      );
    }

    // Show "Booked" (disabled) immediately after booking (bm_review = just submitted)
    if (status === "bm_review") {
      return (
        <button
          disabled
          className="px-3 py-1.5 text-xs font-medium rounded-md text-white cursor-not-allowed flex items-center gap-1 mx-auto"
          style={{ backgroundColor: "#586ab1", opacity: 0.6 }}
        >
          <CheckCircleIcon className="h-3.5 w-3.5" />
          Booked
        </button>
      );
    }

    // Block if still in review pipeline
    const blockedStatuses = [
      "rm_review",
      "ca_review",
      "disbursed",
      "approved",
      "ready_for_disbursement"
    ];

    if (blockedStatuses.includes(status)) {
      return (
        <button
          disabled
          className="px-3 py-1.5 text-xs font-medium rounded-md text-white cursor-not-allowed"
          style={{ backgroundColor: "#9ca3af" }}
        >
          Active Loan
        </button>
      );
    }

    if (status === "rejected") {
      return (
        <button
          disabled
          className="px-3 py-1.5 text-xs font-medium rounded-md text-white cursor-not-allowed"
          style={{ backgroundColor: "#ef4444" }}
        >
          Rejected
        </button>
      );
    }

    // No loan or safe state → allow
    return (
      <button
        onClick={() =>
          navigate(`/officer/loan-booking/${application.id}`, {
            state: { customerData: application },
          })
        }
        className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-all font-medium text-xs flex items-center gap-2 shadow-sm mx-auto"
      >
        <BanknotesIcon className="h-4 w-4" />
        Book Loan
      </button>
    );
  })()}
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length === 0 && (
          <div className="p-8 text-center text-xs text-gray-500">
            {searchTerm ? (
              <p>No approved applications match your search</p>
            ) : (
              <p>No approved applications found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default LoanApplication;