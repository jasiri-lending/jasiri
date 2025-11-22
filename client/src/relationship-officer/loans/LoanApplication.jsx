import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../hooks/userAuth";

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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!customers.length) {
    return (
      <div className="text-center py-10 text-gray-600">
        No approved customers available for loan booking.
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {/* Header */}
        <div className="p-4 flex flex-col md:flex-row justify-between items-center bg-gray-50 gap-4">
          <h1 className="text-lg  text-slate-600">Loan Applications</h1>
          
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            {/* Centered Search Bar */}
            <div className="relative w-full md:w-96 mx-auto">
              <input
                type="text"
                placeholder="Search by ID, phone or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            
            <button 
              onClick={fetchApprovedCustomers}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center whitespace-nowrap"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Refresh
            </button>
          </div>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.map((application) => (
                <tr key={application.id} className="hover:bg-gray-50">
                  {/* Customer Name */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="font-medium text-green-800">
                          {application.Firstname?.charAt(0)}
                          {application.Surname?.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {application.Firstname} {application.Surname}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* ID */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{application.id_number}</div>
                  </td>

                  {/* Phone */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{application.mobile}</div>
                  </td>

                  {/* Loan Amount */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      Ksh{" "}
                      {application.caScoredAmount
                        ? Number(application.caScoredAmount).toLocaleString()
                        : application.bmScoredAmount
                        ? Number(application.bmScoredAmount).toLocaleString()
                        : "N/A"}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Approved
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {application.lastLoanStatus === "bm_review" ||
                     application.lastLoanStatus === "rm_review" ||
                      application.lastLoanStatus === "ca_review" ||
                     application.lastLoanStatus === "disbursed" ? (
                      <button
                        disabled
                        className="bg-gray-400 text-white px-4 py-2 rounded-md cursor-not-allowed"
                      >
                        Booked
                      </button>
                    ) : application.lastLoanStatus === "rejected" ? (
                      <button
                        disabled
                        className="bg-red-600 text-white px-4 py-2 rounded-md cursor-not-allowed"
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
          >
                        <svg
                          className="w-4 h-4 mr-1"
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
                        Book 
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredCustomers.length === 0 && (
          <div className="p-8 text-center text-gray-500 bg-gray-50">
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