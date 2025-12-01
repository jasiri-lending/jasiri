import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';

const CustomerTransferTable = () => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({
    currentBranch: 'All Branches',
    currentOfficer: 'All Officers',
    newBranch: 'All Branches',
    newOfficer: 'All Officers'
  });
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);

  useEffect(() => {
    fetchBranches();
    fetchOfficers();
    fetchTransfers();
  }, [filters]);

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

  const fetchOfficers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, Firstname, Surname')
        .order('Firstname');
      
      if (error) throw error;
      setOfficers(data || []);
    } catch (error) {
      console.error('Error fetching officers:', error);
    }
  };

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('customer_transfers')
        .select(`
          *,
          current_branch:branches!customer_transfers_current_branch_id_fkey(name),
          new_branch:branches!customer_transfers_new_branch_id_fkey(name),
          current_officer:users!customer_transfers_current_officer_id_fkey(Firstname, Surname),
          new_officer:users!customer_transfers_new_officer_id_fkey(Firstname, Surname),
          created_by_user:users!customer_transfers_created_by_fkey(Firstname, Surname)
        `)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      
      if (error) throw error;
      setTransfers(data || []);
    } catch (error) {
      console.error('Error fetching transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status?.toUpperCase()}
      </span>
    );
  };

  const handleTransferClick = () => {
    setShowForm(true);
  };

  if (showForm) {
    return <CustomerTransferForm onClose={() => setShowForm(false)} onSuccess={fetchTransfers} />;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Customer Transfers</h1>
          <button
            onClick={handleTransferClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            Create Transfer
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Branch</label>
              <select
                value={filters.currentBranch}
                onChange={(e) => handleFilterChange('currentBranch', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option>All Branches</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Officer</label>
              <select
                value={filters.currentOfficer}
                onChange={(e) => handleFilterChange('currentOfficer', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option>All Officers</option>
                {officers.map(officer => (
                  <option key={officer.id} value={officer.id}>
                    {officer.Firstname} {officer.Surname}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Branch</label>
              <select
                value={filters.newBranch}
                onChange={(e) => handleFilterChange('newBranch', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option>All Branches</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Officer</label>
              <select
                value={filters.newOfficer}
                onChange={(e) => handleFilterChange('newOfficer', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option>All Officers</option>
                {officers.map(officer => (
                  <option key={officer.id} value={officer.id}>
                    {officer.Firstname} {officer.Surname}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registry</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Branch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Officer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Branch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Officer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-4 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : transfers.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-4 text-center text-gray-500">
                      No records to display
                    </td>
                  </tr>
                ) : (
                  transfers.map((transfer, index) => (
                    <tr key={transfer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transfer.current_branch?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transfer.current_officer?.Firstname} {transfer.current_officer?.Surname}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transfer.new_branch?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transfer.new_officer?.Firstname} {transfer.new_officer?.Surname}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {getStatusBadge(transfer.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transfer.created_by_user?.Firstname} {transfer.created_by_user?.Surname}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(transfer.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// Customer Transfer Form Component
const CustomerTransferForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    currentBranch: '',
    currentOfficer: '',
    newBranch: '',
    newOfficer: '',
    customerName: '',
    idNumber: '',
    phoneNumber: ''
  });
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBranches();
    fetchOfficers();
  }, []);

  useEffect(() => {
    if (formData.currentBranch && formData.currentOfficer) {
      fetchCustomers();
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

  const fetchOfficers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, Firstname, Surname')
        .order('Firstname');
      
      if (error) throw error;
      setOfficers(data || []);
    } catch (error) {
      console.error('Error fetching officers:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          branch:branches(name),
          officer:users(Firstname, Surname)
        `)
        .eq('branch_id', formData.currentBranch)
        .eq('created_by', formData.currentOfficer);
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleCustomerSelection = (customerId) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.newBranch || !formData.newOfficer || selectedCustomers.length === 0) {
      alert('Please fill all required fields and select at least one customer');
      return;
    }

    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const transferData = {
        current_branch_id: formData.currentBranch,
        current_officer_id: formData.currentOfficer,
        new_branch_id: formData.newBranch,
        new_officer_id: formData.newOfficer,
        customer_ids: selectedCustomers,
        status: 'pending',
        created_by: user?.id,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('customer_transfers')
        .insert(transferData);

      if (error) throw error;

      alert('Transfer request created successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating transfer:', error);
      alert('Failed to create transfer request');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer => 
    customer.Firstname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.Surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.id_number?.toString().includes(searchTerm) ||
    customer.mobile?.includes(searchTerm)
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Create Transfer </h1>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
          >
            ✕ Close
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Branch *</label>
              <select
                value={formData.currentBranch}
                onChange={(e) => handleInputChange('currentBranch', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Branch</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Officer *</label>
              <select
                value={formData.currentOfficer}
                onChange={(e) => handleInputChange('currentOfficer', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Officer</option>
                {officers.map(officer => (
                  <option key={officer.id} value={officer.id}>
                    {officer.Firstname} {officer.Surname}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Branch *</label>
              <select
                value={formData.newBranch}
                onChange={(e) => handleInputChange('newBranch', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Branch</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Officer *</label>
              <select
                value={formData.newOfficer}
                onChange={(e) => handleInputChange('newOfficer', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select Officer</option>
                {officers.map(officer => (
                  <option key={officer.id} value={officer.id}>
                    {officer.Firstname} {officer.Surname}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.currentBranch && formData.currentOfficer && (
            <>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="overflow-x-auto mb-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Select</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                          No customers found
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map(customer => (
                        <tr key={customer.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedCustomers.includes(customer.id)}
                              onChange={() => toggleCustomerSelection(customer.id)}
                              className="h-4 w-4 text-blue-600 rounded"
                            />
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {customer.Firstname} {customer.Middlename} {customer.Surname}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{customer.id_number}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{customer.mobile}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{customer.branch?.name}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || selectedCustomers.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Submitting...' : 'Submit Transfer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerTransferTable;