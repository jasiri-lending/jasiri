import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../hooks/userAuth";
import Spinner from "../../components/Spinner.jsx";
import { 
  MagnifyingGlassIcon, 
  ArrowPathIcon 
} from "@heroicons/react/24/outline";

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
            .select("status")
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
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
        <Spinner text="Loading loan applications..." />
      </div>
    );
  }

  if (!customers.length) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
        <h1 className="text-xs text-slate-500 mb-4 font-medium">
          Loan Applications
        </h1>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center text-xs text-gray-500">
            No approved customers available for loan booking.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen">
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
                className="border border-gray-300 rounded-md pl-8 pr-3 py-1.5 w-full text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Refresh Button */}
            <button 
              onClick={fetchApprovedCustomers}
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
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Loan Amount</th>
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
                        className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium"
                        style={{ backgroundColor: "#e0e7ff", color: "#586ab1" }}
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

                  {/* Loan Amount */}
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="text-xs text-gray-700 font-medium">
                      {application.caScoredAmount
                        ? `Ksh ${Number(application.caScoredAmount).toLocaleString()}`
                        : application.bmScoredAmount
                        ? `Ksh ${Number(application.bmScoredAmount).toLocaleString()}`
                        : "N/A"}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span 
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: "#10b981" }}
                    >
                      Approved
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {application.lastLoanStatus === "bm_review" ||
                     application.lastLoanStatus === "rm_review" ||
                     application.lastLoanStatus === "ca_review" ||
                     application.lastLoanStatus === "disbursed" ? (
                      <button
                        disabled
                        className="px-3 py-1.5 text-xs font-medium rounded-md text-white cursor-not-allowed"
                        style={{ backgroundColor: "#9ca3af" }}
                      >
                        Booked
                      </button>
                    ) : application.lastLoanStatus === "rejected" ? (
                      <button
                        disabled
                        className="px-3 py-1.5 text-xs font-medium rounded-md text-white cursor-not-allowed"
                        style={{ backgroundColor: "#ef4444" }}
                      >
                        Rejected
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          navigate(`/officer/loan-booking/${application.id}`, {
                            state: { customerData: application },
                          })
                        }
                        className="px-3 py-1.5 text-xs font-medium rounded-md text-white transition-colors whitespace-nowrap flex items-center justify-center mx-auto"
                        style={{ backgroundColor: "#586ab1" }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = "#4a5a9d"}
                        onMouseLeave={(e) => e.target.style.backgroundColor = "#586ab1"}
                      >
                        <svg
                          className="w-3 h-3 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                        Book Loan
                      </button>
                    )}
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