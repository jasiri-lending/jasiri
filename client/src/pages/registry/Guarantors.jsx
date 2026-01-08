import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Filter, AlertCircle, CheckCircle, XCircle, Loader2, Plus } from 'lucide-react';
import { supabase } from "../../supabaseClient";
import AddGuarantor from './AddGuarantor';
import Spinner from '../../components/Spinner';

const Guarantors = () => {
  const [guarantors, setGuarantors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [convertingId, setConvertingId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [showAddGuarantor, setShowAddGuarantor] = useState(false);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    branch: '',
    region: ''
  });

  useEffect(() => {
    const initializeData = async () => {
      await fetchBranchesAndRegions();
      await fetchGuarantors();
    };
    initializeData();
  }, []);

  const fetchBranchesAndRegions = async () => {
    try {
      const [branchesResponse, regionsResponse] = await Promise.all([
        supabase.from('branches').select('id, name, region_id').order('name'),
        supabase.from('regions').select('id, name').order('name')
      ]);

      if (branchesResponse.error) throw branchesResponse.error;
      if (regionsResponse.error) throw regionsResponse.error;

      setBranches(branchesResponse.data || []);
      setRegions(regionsResponse.data || []);
    } catch (error) {
      console.error('Error fetching branches and regions:', error);
    }
  };
const fetchGuarantors = async () => {
  try {
    setLoading(true);

    let query = supabase
      .from('guarantors')
      .select(`
        *,
        customer:customers (
          id,
          Firstname,
          Surname,
          Middlename,
          mobile,
          id_number,
          branch_id,
          region_id,
          branch:branches (
            id,
            name
          ),
          region:regions (
            id,
            name
          )
        )
      `)
      .eq('is_guarantor', true);

    // Apply filters via CUSTOMER (since relationships exist there)
    if (filters.branch) {
      query = query.eq('customers.branch_id', filters.branch);
    }

    if (filters.region) {
      query = query.eq('customers.region_id', filters.region);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const guarantorsWithStatus = await Promise.all(
      data.map(async (guarantor) => {
        let canConvertToCustomer = false;
        let guaranteedCustomers = [];
        let customersWithUnpaidLoans = [];

        if (guarantor.customer) {
          const loanStatus = await checkCustomerLoanStatus(guarantor.customer.id);

          guaranteedCustomers.push({
            customer: guarantor.customer,
            loanStatus
          });

          if (!loanStatus.hasActiveLoans) {
            canConvertToCustomer = true;
          } else {
            customersWithUnpaidLoans.push({
              customer: guarantor.customer,
              outstandingBalance: loanStatus.outstandingBalance,
              loanId: loanStatus.loanId,
              repaymentState: loanStatus.repaymentState,
              loanDetails: loanStatus.loanDetails
            });
          }
        }

        return {
          ...guarantor,

          // Flatten for easy UI access
          branch: guarantor.customer?.branch || null,
          region: guarantor.customer?.region || null,

          canConvertToCustomer,
          guaranteed_customers: guaranteedCustomers,
          customersWithUnpaidLoans,
          allCustomersClear: customersWithUnpaidLoans.length === 0
        };
      })
    );

    setGuarantors(guarantorsWithStatus);
  } catch (error) {
    console.error('❌ Error fetching guarantors:', error);
    showNotification('error', 'Failed to load guarantors');
  } finally {
    setLoading(false);
  }
};



  const checkCustomerLoanStatus = async (customerId) => {
    try {
      // Get all disbursed loans for this customer
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select(`
          id,
          total_payable,
          status,
          repayment_state,
          total_penalties,
          penalty_waived,
          net_penalties,
          created_at,
          product_name
        `)
        .eq('customer_id', customerId)
        .eq('status', 'disbursed')
        .order('created_at', { ascending: false });

      if (loansError) throw loansError;

      if (!loans || loans.length === 0) {
        return { 
          hasActiveLoans: false, 
          outstandingBalance: 0, 
          loanId: null, 
          repaymentState: null,
          loanCount: 0,
          loanDetails: []
        };
      }

      // Check each loan for outstanding balance
      let hasActiveLoans = false;
      let totalOutstanding = 0;
      let firstLoanId = null;
      let firstRepaymentState = null;
      const loanDetails = [];

      for (const loan of loans) {
        // Get all payments for this loan
        const { data: payments, error: paymentsError } = await supabase
          .from('loan_payments')
          .select(`
            paid_amount,
            principal_paid,
            interest_paid,
            penalty_paid,
            paid_at
          `)
          .eq('loan_id', loan.id);

        if (paymentsError) continue;

        // Calculate total paid from all payment types
        const totalPaid = payments?.reduce((sum, payment) => {
          return sum + 
            parseFloat(payment.paid_amount || 0) + 
            parseFloat(payment.principal_paid || 0) + 
            parseFloat(payment.interest_paid || 0) + 
            parseFloat(payment.penalty_paid || 0);
        }, 0) || 0;

        const totalPayable = parseFloat(loan.total_payable || 0);
        const netPenalties = parseFloat(loan.net_penalties || 0);
        
        // Calculate outstanding balance
        const outstanding = Math.max(0, (totalPayable - totalPaid) + netPenalties);

        // Store loan details
        const loanDetail = {
          loanId: loan.id,
          productName: loan.product_name,
          totalPayable: totalPayable,
          totalPaid: totalPaid,
          netPenalties: netPenalties,
          outstandingBalance: outstanding,
          repaymentState: loan.repayment_state,
          status: loan.status,
          paymentCount: payments?.length || 0,
          lastPaymentDate: payments && payments.length > 0 
            ? new Date(Math.max(...payments.map(p => new Date(p.paid_at).getTime()))) 
            : null
        };
        
        loanDetails.push(loanDetail);

        if (outstanding > 0.01) {
          hasActiveLoans = true;
          totalOutstanding += outstanding;
          
          if (!firstLoanId) {
            firstLoanId = loan.id;
            firstRepaymentState = loan.repayment_state;
          }
        }
      }

      return { 
        hasActiveLoans, 
        outstandingBalance: totalOutstanding,
        loanId: firstLoanId,
        repaymentState: firstRepaymentState,
        loanCount: loans.length,
        loanDetails
      };
    } catch (error) {
      console.error(`❌ Error checking loan status for customer ${customerId}:`, error);
      return { 
        hasActiveLoans: true, 
        outstandingBalance: 0, 
        loanId: null, 
        repaymentState: null,
        loanCount: 0,
        loanDetails: []
      };
    }
  };

  const handleConvertToCustomer = async (guarantor) => {
    if (!guarantor.canConvertToCustomer) {
      showNotification('error', 'Cannot convert guarantor. The customer they guarantee still has unpaid loans.');
      return;
    }

    if (guarantor.guaranteed_customers.length === 0) {
      showNotification('error', 'Cannot convert guarantor. They must guarantee at least one customer.');
      return;
    }

    setConvertingId(guarantor.id);

    try {
      let branch_id = guarantor.branch_id;
      let region_id = guarantor.region_id;

      // If no branch/region, get from guaranteed customer
      if (!branch_id || !region_id) {
        if (guarantor.guaranteed_customers && guarantor.guaranteed_customers.length > 0) {
          const firstCustomer = guarantor.guaranteed_customers[0].customer;
          if (firstCustomer) {
            branch_id = firstCustomer.branch_id;
            region_id = firstCustomer.region_id;
          }
        }
      }

      if (!branch_id || !region_id) {
        showNotification('error', 'Branch and Region information is required for conversion');
        setConvertingId(null);
        return;
      }

      // Create a new customer from guarantor data
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          prefix: guarantor.prefix,
          Firstname: guarantor.Firstname,
          Surname: guarantor.Surname,
          Middlename: guarantor.Middlename,
          marital_status: guarantor.marital_status,
          residence_status: guarantor.residence_status,
          mobile: guarantor.mobile,
          id_number: guarantor.id_number,
          postal_address: guarantor.postal_address,
          code: guarantor.code,
          county: guarantor.county,
          date_of_birth: guarantor.date_of_birth,
          gender: guarantor.gender,
          alternative_mobile: guarantor.alternative_number,
          passport_url: guarantor.passport_url,
          id_front_url: guarantor.id_front_url,
          id_back_url: guarantor.id_back_url,
          occupation: guarantor.occupation,
          city_town: guarantor.city_town,
          branch_id: branch_id,
          region_id: region_id,
          created_by: guarantor.created_by,
          status: 'pending',
          form_status: 'submitted',
          is_new_customer: true,
          is_guarantor: true
        })
        .select()
        .single();

      if (customerError) throw customerError;

      // Mark the guarantor as converted (set is_guarantor to false)
      const { error: updateError } = await supabase
        .from('guarantors')
        .update({ 
          is_guarantor: false
        })
        .eq('id', guarantor.id);

      if (updateError) throw updateError;

      showNotification('success', `Successfully converted ${guarantor.Firstname} ${guarantor.Surname} to customer`);
      
      await fetchGuarantors();
    } catch (error) {
      console.error('Error converting to customer:', error);
      showNotification('error', 'Failed to convert guarantor to customer: ' + error.message);
    } finally {
      setConvertingId(null);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleAddGuarantorSuccess = () => {
    setShowAddGuarantor(false);
    fetchGuarantors();
    showNotification('success', 'Guarantor added successfully');
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFilterSubmit = () => {
    fetchGuarantors();
  };

  const handleClearFilters = () => {
    setFilters({
      branch: '',
      region: ''
    });
    fetchGuarantors();
  };

  const filteredGuarantors = guarantors.filter(g => {
    const fullName = `${g.Firstname || ''} ${g.Middlename || ''} ${g.Surname || ''}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    
    if (fullName.includes(search) || 
        g.mobile?.includes(search) || 
        g.id_number?.toString().includes(search)) {
      return true;
    }
    
    if (g.guaranteed_customers) {
      return g.guaranteed_customers.some(gc => {
        const customerName = `${gc.customer?.Firstname || ''} ${gc.customer?.Surname || ''}`.toLowerCase();
        return customerName.includes(search) || 
               gc.customer?.mobile?.includes(search) ||
               gc.customer?.id_number?.toString().includes(search);
      });
    }
    
    return false;
  });
  // ========== LOADING STATE ==========
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#d9e2e8' }}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Spinner text="Loading guarantor..." />
          </div>
        </div>
      </div>
    );
  }

  if (showAddGuarantor) {
    return (
      <AddGuarantor
        onClose={() => setShowAddGuarantor(false)}
        onSuccess={handleAddGuarantorSuccess}
        branches={branches}
        regions={regions}
      />
    );
  }

  return (
  <div className="p-6 max-w-7xl mx-auto">
  <div className="mb-6">
    <div className="flex justify-between items-start">
      <div>
        <h1 className="text-sm  mb-1" style={{ color: "#586ab1" }}>
          Guarantors Management
        </h1>
        
      </div>
    </div>
  </div>

  {notification && (
    <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
      notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
    }`}>
      {notification.type === 'success' ? (
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
      ) : (
        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
      )}
      <p className={`text-sm ${notification.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
        {notification.message}
      </p>
    </div>
  )}

  {/* Main Controls Row */}
  <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    {/* Add Button */}
    <button
      onClick={() => setShowAddGuarantor(true)}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white rounded-md transition-colors hover:opacity-90 whitespace-nowrap flex-shrink-0"
      style={{ backgroundColor: "#586ab1" }}
    >
      <Plus className="w-4 h-4" />
      Add Guarantor
    </button>

    {/* Search and Filter Controls */}
    <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
      {/* Search Bar */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, phone, or ID number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Filter Button */}
      <div className="flex items-center gap-4 w-full sm:w-auto">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          <Filter className="w-4 h-4" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
          {(filters.region || filters.branch) && (
            <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full"></span>
          )}
        </button>

        {/* Apply Filters Button - Only show when filters are visible */}
        {showFilters && (
          <button
            onClick={handleFilterSubmit}
            className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors hover:opacity-90 whitespace-nowrap"
            style={{ backgroundColor: "#586ab1" }}
          >
            Apply
          </button>
        )}
      </div>
    </div>
  </div>

  {/* Filters Section - Conditionally Rendered */}
  {showFilters && (
    <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Filter Guarantors</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={handleClearFilters}
            className="text-xs px-3 py-1.5 text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Region
          </label>
          <select
            name="region"
            value={filters.region}
            onChange={handleFilterChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Regions</option>
            {regions.map(region => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Branch
          </label>
          <select
            name="branch"
            value={filters.branch}
            onChange={handleFilterChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Branches</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )}

  <div className="bg-white rounded-lg shadow overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px]">
        <thead style={{ backgroundColor: "#f0f2f8" }}>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#586ab1" }}>
              Guarantor Details
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#586ab1" }}>
              ID 
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#586ab1" }}>
              Phone
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#586ab1" }}>
              Customer
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#586ab1" }}>
              Loan Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#586ab1" }}>
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#586ab1" }}>
              Action
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredGuarantors.length === 0 ? (
            <tr>
              <td colSpan="7" className="px-4 py-12 text-center">
                <div className="flex flex-col items-center justify-center">
                  <UserPlus className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">No guarantors found</p>
                  <p className="text-gray-400 text-xs mt-1">Try adding a new guarantor or adjust your search</p>
                </div>
              </td>
            </tr>
          ) : (
            filteredGuarantors.map((guarantor) => (
              <tr key={guarantor.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4">
                  <div className="flex flex-col min-w-[200px]">
                    <div className="font-medium text-gray-900 text-sm truncate">
                      {guarantor.Firstname} {guarantor.Middlename} {guarantor.Surname}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {guarantor.branch?.name || 'No Branch'} • {guarantor.region?.name || 'No Region'}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-gray-700 text-sm font-mono truncate max-w-[120px]">
                    {guarantor.id_number || 'N/A'}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-gray-700 text-sm truncate max-w-[130px]">
                    {guarantor.mobile || 'N/A'}
                  </div>
                </td>
                <td className="px-4 py-4">
                  {guarantor.guaranteed_customers && guarantor.guaranteed_customers.length > 0 ? (
                    <div className="space-y-2 min-w-[200px]">
                      {guarantor.guaranteed_customers.map((gc, index) => (
                        <div key={index} className="bg-blue-50 rounded p-3">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 text-sm truncate">
                                {gc.customer?.Firstname} {gc.customer?.Surname}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                <span className="text-xs text-gray-500">
                                  ID: {gc.customer?.id_number || 'N/A'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Phone: {gc.customer?.mobile || 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm italic">No customer linked</div>
                  )}
                </td>
                <td className="px-4 py-4">
                  {guarantor.customersWithUnpaidLoans && guarantor.customersWithUnpaidLoans.length > 0 ? (
                    <div className="space-y-2 min-w-[200px]">
                      {guarantor.customersWithUnpaidLoans.map((customer, index) => (
                        <div key={index} className="bg-red-50 rounded p-3 border border-red-100">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-red-700 truncate">
                                {customer.customer.Firstname} {customer.customer.Surname}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-xs font-semibold text-red-600">
                                  KES {customer.outstandingBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                </span>
                                <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full capitalize">
                                  {customer.repaymentState}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded p-3">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium">All loans cleared</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div className="flex">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      guarantor.canConvertToCustomer
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      {guarantor.canConvertToCustomer ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1.5 flex-shrink-0" />
                          Eligible
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1.5 flex-shrink-0" />
                          Not Eligible
                        </>
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-center">
                    <button
                      onClick={() => handleConvertToCustomer(guarantor)}
                      disabled={!guarantor.canConvertToCustomer || convertingId === guarantor.id}
                      className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap min-w-[150px] ${
                        guarantor.canConvertToCustomer && convertingId !== guarantor.id
                          ? 'text-white hover:shadow-md active:scale-[0.98]'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      style={
                        guarantor.canConvertToCustomer && convertingId !== guarantor.id
                          ? { backgroundColor: "#586ab1" }
                          : {}
                      }
                      title={
                        !guarantor.canConvertToCustomer
                          ? 'Customer still has unpaid loans'
                          : 'Convert to customer'
                      }
                    >
                      {convertingId === guarantor.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Converting...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Convert to Customer
                        </>
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>

  {filteredGuarantors.length > 0 && (
    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-gray-600">
          Showing <span className="font-semibold">{filteredGuarantors.length}</span> of{" "}
          <span className="font-semibold">{guarantors.length}</span> guarantors
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-600">
              Eligible: <span className="font-semibold">{guarantors.filter(g => g.canConvertToCustomer).length}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm text-gray-600">
              Not eligible: <span className="font-semibold">{guarantors.filter(g => !g.canConvertToCustomer).length}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )}
</div>
  );
};

export default Guarantors;