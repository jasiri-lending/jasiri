// src/components/reports/PTPReports.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { exportToCSV } from '../../utils/exportUtils';
import Spinner from "../../components/Spinner"; // ✅ Import your custom Spinner
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/userAuth.js';

const PTPReports = () => {
  const { profile } = useAuth();
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
    officer: 'all',
    branch: 'all'
  });

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'promised_date', direction: 'desc' });
  const itemsPerPage = 10;

  useEffect(() => {
    if (profile?.tenant_id) {
      loadStaticData();
      generateReport();
    }
  }, [profile]);

  const loadStaticData = async () => {
    try {
      // Load branches
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('id, name')
        .eq('tenant_id', profile?.tenant_id)
        .order('name');

      if (branchError) throw branchError;
      setBranches(branchData || []);

      // Load officers (users)
      const { data: officerData, error: officerError } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('tenant_id', profile?.tenant_id)
        .order('full_name');

      if (officerError) throw officerError;
      setOfficers(officerData || []);
    } catch (error) {
      console.error('Error loading static data:', error);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      // Build query for promises to pay
      let query = supabase
        .from('promise_to_pay')
        .select(`
          id,
          loan_id,
          customer_id,
          promised_amount,
          promised_date,
          status,
          remarks,
          created_at,
          created_by,
          customers!promise_to_pay_customer_id_fkey (
            id,
            Firstname,
            Middlename,
            Surname,
            mobile
          ),
          loans!promise_to_pay_loan_id_fkey (
            id,
            scored_amount
          ),
          users!promise_to_pay_created_by_fkey (
            id,
            full_name
          )
        `)
        .eq('tenant_id', profile?.tenant_id);

      // Apply filters
      if (filters.startDate) {
        query = query.gte('promised_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('promised_date', filters.endDate);
      }
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.officer !== 'all') {
        query = query.eq('created_by', filters.officer);
      }

      const { data: ptpData, error: ptpError } = await query.order('promised_date', { ascending: false });

      if (ptpError) throw ptpError;

      // If branch filter is applied, we need to filter by customer's branch
      let filteredPtps = ptpData || [];
      if (filters.branch !== 'all') {
        // Get customers in this branch
        const { data: branchCustomers, error: bcError } = await supabase
          .from('customers')
          .select('id')
          .eq('branch_id', filters.branch)
          .eq('tenant_id', profile?.tenant_id);

        if (bcError) throw bcError;

        const branchCustomerIds = branchCustomers.map(c => c.id);
        filteredPtps = filteredPtps.filter(ptp => branchCustomerIds.includes(ptp.customer_id));
      }

      // Calculate summary statistics
      const totalPromises = filteredPtps.length;
      const keptPromises = filteredPtps.filter(ptp => ptp.status === 'kept').length;
      const brokenPromises = filteredPtps.filter(ptp => ptp.status === 'broken').length;
      const pendingPromises = filteredPtps.filter(ptp => ptp.status === 'pending').length;

      const summary = {
        totalPromises,
        keptPromises,
        brokenPromises,
        pendingPromises,
        totalPromisedAmount: filteredPtps.reduce((sum, ptp) => sum + parseFloat(ptp.promised_amount || 0), 0),
        keptPercentage: totalPromises > 0 ? (keptPromises / totalPromises * 100) : 0,
        brokenPercentage: totalPromises > 0 ? (brokenPromises / totalPromises * 100) : 0,
        pendingPercentage: totalPromises > 0 ? (pendingPromises / totalPromises * 100) : 0
      };

      // Transform data for display
      const transformedPtps = filteredPtps.map(ptp => ({
        id: ptp.id,
        customer_name: ptp.customers
          ? `${ptp.customers.Firstname} ${ptp.customers.Middlename || ''} ${ptp.customers.Surname}`.trim()
          : 'Unknown',
        customer_mobile: ptp.customers?.mobile || 'N/A',
        loan_id: ptp.loan_id,
        loan_amount: ptp.loans?.scored_amount || 0,
        promised_amount: parseFloat(ptp.promised_amount || 0),
        promised_date: ptp.promised_date,
        status: ptp.status,
        officer_name: ptp.users?.full_name || 'Unknown',
        remarks: ptp.remarks || '',
        created_at: ptp.created_at
      }));

      setReportData({
        summary,
        ptps: transformedPtps
      });

    } catch (error) {
      console.error('Error generating PTP report:', error);
      alert('Failed to generate PTP report: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // const handleFilterChange = (e) => {
  //   const { name, value } = e.target;
  //   setFilters(prev => ({ ...prev, [name]: value }));
  // };

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const handleStatusUpdate = async (ptpId, newStatus) => {
    try {
      const { error } = await supabase
        .from('promise_to_pay')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', ptpId);

      if (error) throw error;

      // Refresh report data
      generateReport();

    } catch (error) {
      console.error('Error updating PTP status:', error);
      alert('Failed to update PTP status: ' + error.message);
    }
  };

  const handleExport = () => {
    if (!reportData?.ptps) return;

    const csvData = reportData.ptps.map(ptp => ({
      'PTP ID': ptp.id,
      'Customer Name': ptp.customer_name,
      'Customer Mobile': ptp.customer_mobile,
      'Loan ID': ptp.loan_id,
      'Loan Amount (KES)': ptp.loan_amount,
      'Promised Amount (KES)': ptp.promised_amount,
      'Promise Date': ptp.promised_date,
      'Status': ptp.status,
      'Officer': ptp.officer_name,
      'Remarks': ptp.remarks,
      'Created Date': new Date(ptp.created_at).toLocaleDateString('en-GB')
    }));

    exportToCSV(csvData, `ptp-reports-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value) => {
    return `${value.toFixed(1)}%`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      kept: { color: 'bg-green-100 text-green-800', label: 'Kept' },
      broken: { color: 'bg-red-100 text-red-800', label: 'Broken' },
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' }
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  // Sort and paginate PTP data
  const sortedPtps = React.useMemo(() => {
    if (!reportData?.ptps) return [];

    const sorted = [...reportData.ptps].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal < bVal) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [reportData?.ptps, sortConfig]);

  const paginatedPtps = sortedPtps.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(sortedPtps.length / itemsPerPage);

  return (
    <div className="space-y-6 bg-brand-surface p-6 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-sm  text-gray-600">Promise to Pay Reports </h1>
        <div className="flex space-x-3">
          <button
            onClick={generateReport}
            disabled={loading}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={!reportData}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      {/* <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-lg font-semibold text-gray-600 mb-4">Filter PTP Reports</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="kept">Kept</option>
              <option value="broken">Broken</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Officer
            </label>
            <select
              name="officer"
              value={filters.officer}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Officers</option>
              {officers.map(officer => (
                <option key={officer.id} value={officer.id}>{officer.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch
            </label>
            <select
              name="branch"
              value={filters.branch}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mt-4">
          <button
            onClick={generateReport}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div> */}

      {loading && !reportData ? (
        <div className="py-20">
          <Spinner text="Generating promise to pay report..." />
        </div>
      ) : reportData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Promises</p>
                  <p className="text-2xl font-bold text-gray-900">{reportData.summary.totalPromises}</p>
                  <p className="text-xs text-gray-600 mt-1">All promises</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Kept Promises</p>
                  <p className="text-2xl font-bold text-green-600">{reportData.summary.keptPromises}</p>
                  <p className="text-xs text-gray-600 mt-1">{formatPercentage(reportData.summary.keptPercentage)} rate</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Broken Promises</p>
                  <p className="text-2xl font-bold text-red-600">{reportData.summary.brokenPromises}</p>
                  <p className="text-xs text-gray-600 mt-1">{formatPercentage(reportData.summary.brokenPercentage)} rate</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Promises</p>
                  <p className="text-2xl font-bold text-yellow-600">{reportData.summary.pendingPromises}</p>
                  <p className="text-xs text-gray-600 mt-1">{formatPercentage(reportData.summary.pendingPercentage)} pending</p>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          {/* <div className="grid grid-cols-1 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Total Promised Amount</p>
                <p className="text-3xl font-bold text-indigo-600">{formatCurrency(reportData.summary.totalPromisedAmount)}</p>
                <p className="text-sm text-gray-600 mt-2">Amount customers promised to pay</p>
              </div>
            </div>
          </div> */}

          {/* PTP Details Table */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm  text-slate-600">Promise to Pay Details</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      Customer Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      Mobile
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      Loan ID
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('promised_amount')}
                    >
                      Promised Amount
                      {sortConfig.key === 'promised_amount' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('promised_date')}
                    >
                      Promise Date
                      {sortConfig.key === 'promised_date' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      Officer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      Remarks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedPtps.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                        No promises to pay found for the selected filters
                      </td>
                    </tr>
                  ) : (
                    paginatedPtps.map((ptp) => (
                      <tr key={ptp.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {ptp.customer_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {ptp.customer_mobile}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          #{ptp.loan_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(ptp.promised_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(ptp.promised_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(ptp.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {ptp.officer_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {ptp.remarks || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <select
                            value={ptp.status}
                            onChange={(e) => handleStatusUpdate(ptp.id, e.target.value)}
                            className="text-xs border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="pending">Pending</option>
                            <option value="kept">Kept</option>
                            <option value="broken">Broken</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedPtps.length)} of {sortedPtps.length} promises
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PTPReports;