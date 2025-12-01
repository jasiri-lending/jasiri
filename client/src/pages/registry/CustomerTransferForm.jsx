import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient.js';

const CustomerTransferForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    currentBranch: '',
    currentOfficer: '',
    newBranch: '',
    newOfficer: ''
  });
  const [branches, setBranches] = useState([]);
  const [currentOfficers, setCurrentOfficers] = useState([]);
  const [newOfficers, setNewOfficers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (formData.currentBranch) {
      fetchOfficersByBranch(formData.currentBranch, 'current');
      setFormData(prev => ({ ...prev, currentOfficer: '' }));
    } else {
      setCurrentOfficers([]);
    }
  }, [formData.currentBranch]);

  useEffect(() => {
    if (formData.newBranch) {
      fetchOfficersByBranch(formData.newBranch, 'new');
      setFormData(prev => ({ ...prev, newOfficer: '' }));
    } else {
      setNewOfficers([]);
    }
  }, [formData.newBranch]);

  useEffect(() => {
    if (formData.currentBranch && formData.currentOfficer) {
      fetchCustomers();
    } else {
      setCustomers([]);
      setSelectedCustomers([]);
    }
  }, [formData.currentBranch, formData.currentOfficer]);

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');
      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchOfficersByBranch = async (branchId, type) => {
    try {
      // Get relationship officers assigned to this branch from the profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          users!inner (
            id,
            full_name,
            role
          )
        `)
        .eq('branch_id', branchId)
        .eq('users.role', 'relationship_officer');

      if (error) throw error;

      // Extract officers
      const officers = data.map(profile => ({
        id: profile.users.id,
        full_name: profile.users.full_name
      }));

      if (type === 'current') {
        setCurrentOfficers(officers);
      } else {
        setNewOfficers(officers);
      }
    } catch (error) {
      console.error('Error fetching officers for branch:', error);
      if (type === 'current') {
        setCurrentOfficers([]);
      } else {
        setNewOfficers([]);
      }
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('branch_id', formData.currentBranch)
        .eq('created_by', formData.currentOfficer);
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.newBranch || !formData.newOfficer || selectedCustomers.length === 0) {
      alert('Please fill all required fields and select at least one customer');
      return;
    }

    setLoading(true);
    try {
      // First, get the region_id for the new branch
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('region_id')
        .eq('id', formData.newBranch)
        .single();

      if (branchError) throw branchError;
      if (!branchData) throw new Error('Branch not found');

      const newRegionId = branchData.region_id;

      // Update all selected customers with new branch, region, and officer
      const { error } = await supabase
        .from('customers')
        .update({
          branch_id: formData.newBranch,
          region_id: newRegionId,
          created_by: formData.newOfficer,
          updated_at: new Date().toISOString()
        })
        .in('id', selectedCustomers);

      if (error) throw error;
      
      alert(`Successfully transferred ${selectedCustomers.length} customer(s)!`);
      navigate('/customer-transfers');
    } catch (error) {
      console.error('Error transferring customers:', error);
      alert('Failed to transfer customers: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCustomerSelection = (customerId) => {
    setSelectedCustomers(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedCustomers.length === filteredCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map(c => c.id));
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.Firstname?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.Surname?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.id_number?.toString().includes(customerSearch) ||
    customer.mobile?.includes(customerSearch)
  );

  // Get selected customer objects for display
  const selectedCustomerObjects = customers.filter(customer => 
    selectedCustomers.includes(customer.id)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-sm text-slate-600 mb-2">Create Customer Transfer</h1>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8">
            {/* Transfer Details Section */}
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current Branch */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.currentBranch}
                    onChange={(e) => setFormData({ ...formData, currentBranch: e.target.value, currentOfficer: '' })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900"
                    required
                  >
                    <option value="">Select Current Branch</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>

                {/* Current Officer */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Officer <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.currentOfficer}
                    onChange={(e) => setFormData({ ...formData, currentOfficer: e.target.value })}
                    disabled={!formData.currentBranch}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    required
                  >
                    <option value="">{formData.currentBranch ? 'Select Current Officer' : 'Select branch first'}</option>
                    {currentOfficers.map(officer => (
                      <option key={officer.id} value={officer.id}>
                        {officer.full_name}
                      </option>
                    ))}
                  </select>
                  {formData.currentBranch && currentOfficers.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">No relationship officers found for this branch</p>
                  )}
                </div>

                {/* New Branch */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    New Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.newBranch}
                    onChange={(e) => setFormData({ ...formData, newBranch: e.target.value, newOfficer: '' })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900"
                    required
                  >
                    <option value="">Select New Branch</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>

                {/* New Officer */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    New Officer <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.newOfficer}
                    onChange={(e) => setFormData({ ...formData, newOfficer: e.target.value })}
                    disabled={!formData.newBranch}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    required
                  >
                    <option value="">{formData.newBranch ? 'Select New Officer' : 'Select branch first'}</option>
                    {newOfficers.map(officer => (
                      <option key={officer.id} value={officer.id}>
                        {officer.full_name}
                      </option>
                    ))}
                  </select>
                  {formData.newBranch && newOfficers.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">No relationship officers found for this branch</p>
                  )}
                </div>
              </div>
            </div>

            {/* Customer Selection Section */}
            {formData.currentBranch && formData.currentOfficer && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Select Customers <span className="text-red-500">*</span>
                </h2>

                {/* Search Bar */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search customers by name, ID number, or phone..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                    <svg
                      className="absolute left-3.5 top-3.5 h-5 w-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Customer Selection Table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0">
                        <tr>
                          <th className="px-6 py-4 text-left whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={filteredCustomers.length > 0 && selectedCustomers.length === filteredCustomers.length}
                              onChange={toggleSelectAll}
                              className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                            />
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Customer Name
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            ID Number
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Phone Number
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredCustomers.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center justify-center gap-3">
                                <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <p className="text-gray-500 font-medium">No customers found</p>
                                <p className="text-gray-400 text-sm">Try adjusting your search criteria</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredCustomers.map(customer => (
                            <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={selectedCustomers.includes(customer.id)}
                                  onChange={() => toggleCustomerSelection(customer.id)}
                                  className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-medium text-gray-900">
                                  {customer.Firstname} {customer.Middlename || ''} {customer.Surname}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-900">{customer.id_number}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-900">{customer.mobile}</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Selected Customers Table */}
                {selectedCustomers.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Selected Customers for Transfer
                        <span className="bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full">
                          {selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''}
                        </span>
                      </h3>
                    </div>

                    <div className="bg-green-50 border-2 border-green-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gradient-to-r from-green-100 to-green-200 border-b border-green-300">
                              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                Customer Name
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                ID Number
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                Phone Number
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-green-200">
                            {selectedCustomerObjects.map(customer => (
                              <tr key={customer.id} className="hover:bg-green-100 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm font-medium text-gray-900">
                                    {customer.Firstname} {customer.Middlename || ''} {customer.Surname}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm text-gray-900">{customer.id_number}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm text-gray-900">{customer.mobile}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <button
                                    onClick={() => toggleCustomerSelection(customer.id)}
                                    className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold text-sm transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons - Reduced Size */}
          <div className="bg-gray-50 px-8 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/customer-transfers')}
              className="px-6 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-100 transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || selectedCustomers.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Transferring Customers...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Transfer Customers
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerTransferForm;