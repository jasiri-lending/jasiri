import React, { useState, useEffect } from 'react';
import { Search, UserPlus, AlertCircle, CheckCircle, XCircle, Loader2, Plus } from 'lucide-react';
import { supabase } from "../../supabaseClient";
import AddGuarantor from './AddGuarantor';

const Guarantors = () => {
  const [guarantors, setGuarantors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [convertingId, setConvertingId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [showAddGuarantor, setShowAddGuarantor] = useState(false);

  useEffect(() => {
    fetchGuarantors();
  }, []);

  const fetchGuarantors = async () => {
    try {
      setLoading(true);
      
      // Fetch guarantors with related customer data
      const { data: guarantorsData, error } = await supabase
        .from('guarantors')
        .select(`
          *,
          customer:customers!guarantors_customer_id_fkey(
            id,
            Firstname,
            Surname,
            Middlename,
            branch_id,
            region_id
          ),
          guaranteed_customer:customers!guarantors_guaranteed_customer_id_fkey(
            id,
            Firstname,
            Surname,
            Middlename
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch branches and regions separately
      const { data: branches } = await supabase
        .from('branches')
        .select('id, name');

      const { data: regions } = await supabase
        .from('regions')
        .select('id, name');

      // Create lookup maps
      const branchMap = {};
      const regionMap = {};
      
      branches?.forEach(b => branchMap[b.id] = b);
      regions?.forEach(r => regionMap[r.id] = r);

      // For each guarantor, check if the guaranteed customer has outstanding balance
      const guarantorsWithCustomerStatus = await Promise.all(
        guarantorsData.map(async (guarantor) => {
          let customerLoanStatus = 'N/A'; // Default status
          let canConvertToCustomer = false;

          // Check if guarantor is linked to a customer (the one they're guaranteeing)
          if (guarantor.guaranteed_customer_id) {
            // Get all loans for the guaranteed customer
            const { data: loans, error: loansError } = await supabase
              .from('loans')
              .select('id, status, repayment_state')
              .eq('customer_id', guarantor.guaranteed_customer_id);

            if (loansError) {
              console.error('Error fetching loans:', loansError);
              customerLoanStatus = 'Error';
            } else if (loans && loans.length > 0) {
              // Check if any loan has outstanding balance
              const hasOutstandingBalance = loans.some(loan => 
                loan.repayment_state !== 'completed' && loan.status === 'disbursed'
              );

              // Set status based on outstanding balance
              customerLoanStatus = hasOutstandingBalance ? 'Active' : 'Inactive';

              // Check if all disbursed loans are fully paid
              const allPaid = loans.every(loan => 
                loan.status !== 'disbursed' || loan.repayment_state === 'completed'
              );

              canConvertToCustomer = allPaid;
            } else {
              // No loans found for this customer
              customerLoanStatus = 'No Loans';
            }
          }

          // Get branch and region from guarantor's customer data (if they are also a customer)
          const branch = guarantor.customer?.branch_id ? branchMap[guarantor.customer.branch_id] : null;
          const region = guarantor.customer?.region_id ? regionMap[guarantor.customer.region_id] : null;

          return {
            ...guarantor,
            branch,
            region,
            customerLoanStatus,
            canConvertToCustomer
          };
        })
      );

      setGuarantors(guarantorsWithCustomerStatus);
    } catch (error) {
      console.error('Error fetching guarantors:', error);
      showNotification('error', 'Failed to load guarantors');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToCustomer = async (guarantor) => {
    if (!guarantor.canConvertToCustomer) {
      showNotification('error', 'Cannot convert guarantor. Please check loan status.');
      return;
    }

    setConvertingId(guarantor.id);

    try {
      // Get branch and region from the guarantor's data or customer they're guaranteeing
      const branch_id = guarantor.customer?.branch_id || guarantor.branch_id;
      const region_id = guarantor.customer?.region_id || guarantor.region_id;

      if (!branch_id || !region_id) {
        throw new Error('Branch and Region are required');
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
          branch_id: branch_id,
          region_id: region_id,
          created_by: guarantor.created_by,
          status: 'pending',
          form_status: 'submitted',
          is_new_customer: true
        })
        .select()
        .single();

      if (customerError) throw customerError;

      showNotification('success', `Successfully converted ${guarantor.Firstname} ${guarantor.Surname} to customer`);
      
      // Refresh the list
      await fetchGuarantors();
    } catch (error) {
      console.error('Error converting to customer:', error);
      showNotification('error', 'Failed to convert guarantor to customer');
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

  const filteredGuarantors = guarantors.filter(g => {
    const fullName = `${g.Firstname || ''} ${g.Middlename || ''} ${g.Surname || ''}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || 
           g.mobile?.includes(search) || 
           g.id_number?.toString().includes(search);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#586ab1" }} />
      </div>
    );
  }

  if (showAddGuarantor) {
    return (
      <AddGuarantor
        onClose={() => setShowAddGuarantor(false)}
        onSuccess={handleAddGuarantorSuccess}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#586ab1" }}>
          Guarantors Management
        </h1>
        <p className="text-gray-600">
          View and manage guarantors. Convert to customers when loans are fully paid.
        </p>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
          notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600" />
          )}
          <p className={notification.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {notification.message}
          </p>
        </div>
      )}

      {/* Action Bar */}
      <div className="mb-6 flex justify-between items-center">
        {/* Add Guarantor Button - Left */}
        <button
          onClick={() => setShowAddGuarantor(true)}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium transition-colors hover:opacity-90"
          style={{ backgroundColor: "#586ab1" }}
        >
          <Plus className="w-5 h-5" />
          Add Guarantor
        </button>

        {/* Search Bar - Right */}
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or ID number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-0 focus:outline-none"
            style={{ focusRing: "#586ab1" }}
          />
        </div>
      </div>

      {/* Guarantors Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: "#f0f2f8" }}>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#586ab1" }}>
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#586ab1" }}>
                  ID Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#586ab1" }}>
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#586ab1" }}>
                  Branch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#586ab1" }}>
                  Region
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#586ab1" }}>
                  Guaranteeing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#586ab1" }}>
                  Customer Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "#586ab1" }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredGuarantors.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    No guarantors found
                  </td>
                </tr>
              ) : (
                filteredGuarantors.map((guarantor) => (
                  <tr key={guarantor.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {guarantor.Firstname} {guarantor.Middlename} {guarantor.Surname}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {guarantor.id_number || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {guarantor.mobile || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {guarantor.branch?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {guarantor.region?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="text-sm text-gray-900">
                          {guarantor.guaranteed_customer ? 
                            `${guarantor.guaranteed_customer.Firstname || ''} ${guarantor.guaranteed_customer.Surname || ''}`.trim() : 
                            'No customer linked'
                          }
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {guarantor.guaranteed_customer ? (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          guarantor.customerLoanStatus === 'Active' 
                            ? 'bg-red-100 text-red-800' 
                            : guarantor.customerLoanStatus === 'Inactive'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {guarantor.customerLoanStatus === 'Active' && <AlertCircle className="w-3 h-3 mr-1" />}
                          {guarantor.customerLoanStatus === 'Inactive' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {guarantor.customerLoanStatus}
                        </span>
                      ) : (
                        <span className="text-gray-500 text-sm">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleConvertToCustomer(guarantor)}
                        disabled={!guarantor.canConvertToCustomer || convertingId === guarantor.id}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          guarantor.canConvertToCustomer && convertingId !== guarantor.id
                            ? 'text-white hover:opacity-90'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        style={
                          guarantor.canConvertToCustomer && convertingId !== guarantor.id
                            ? { backgroundColor: "#586ab1" }
                            : {}
                        }
                        title={
                          !guarantor.canConvertToCustomer
                            ? 'Customer being guaranteed must have all loans fully paid before conversion'
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 text-sm text-gray-600">
        Showing {filteredGuarantors.length} of {guarantors.length} guarantors
      </div>
    </div>
  );
};

export default Guarantors;