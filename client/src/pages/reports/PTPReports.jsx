// src/components/reports/PTPReports.jsx
import React, { useState, useEffect } from 'react';
import { exportToCSV } from '../../utils/exportUtils';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PTPReports = () => {
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
  const [sortConfig, setSortConfig] = useState({ key: 'promise_date', direction: 'desc' });
  const itemsPerPage = 10;

  // Mock data for demonstration
  const mockPTPData = {
    summary: {
      totalPromises: 156,
      keptPromises: 122,
      brokenPromises: 18,
      pendingPromises: 16,
      totalPromisedAmount: 2850000,
      keptPercentage: 78.2,
      brokenPercentage: 11.5,
      pendingPercentage: 10.3,
      collectedAmount: 2345000
    },
    ptps: [
      {
        id: 'PTP-001',
        customer_name: 'John Kamau',
        loan_id: 'LN-001',
        promised_amount: 25000,
        promise_date: '2024-04-15',
        status: 'kept',
        officer_name: 'Sarah Mwangi',
        branch: 'Nairobi CBD',
        remarks: 'Paid in full on time',
        created_date: '2024-04-10',
        actual_payment_date: '2024-04-15',
        actual_amount_paid: 25000
      },
      {
        id: 'PTP-002',
        customer_name: 'Mary Wanjiku',
        loan_id: 'LN-002',
        promised_amount: 15000,
        promise_date: '2024-04-16',
        status: 'pending',
        officer_name: 'David Ochieng',
        branch: 'Westlands',
        remarks: 'Waiting for payment',
        created_date: '2024-04-11',
        actual_payment_date: null,
        actual_amount_paid: null
      },
      {
        id: 'PTP-003',
        customer_name: 'Peter Kipchoge',
        loan_id: 'LN-003',
        promised_amount: 35000,
        promise_date: '2024-04-14',
        status: 'broken',
        officer_name: 'Sarah Mwangi',
        branch: 'Nairobi CBD',
        remarks: 'Customer unavailable',
        created_date: '2024-04-09',
        actual_payment_date: null,
        actual_amount_paid: 0
      },
      {
        id: 'PTP-004',
        customer_name: 'Grace Akinyi',
        loan_id: 'LN-004',
        promised_amount: 18000,
        promise_date: '2024-04-17',
        status: 'kept',
        officer_name: 'James Mutiso',
        branch: 'Thika',
        remarks: 'Partial payment made',
        created_date: '2024-04-12',
        actual_payment_date: '2024-04-17',
        actual_amount_paid: 18000
      },
      {
        id: 'PTP-005',
        customer_name: 'Robert Gitonga',
        loan_id: 'LN-005',
        promised_amount: 42000,
        promise_date: '2024-04-13',
        status: 'kept',
        officer_name: 'Linda Wambui',
        branch: 'Nairobi CBD',
        remarks: 'Paid early',
        created_date: '2024-04-08',
        actual_payment_date: '2024-04-12',
        actual_amount_paid: 42000
      },
      {
        id: 'PTP-006',
        customer_name: 'Susan Njeri',
        loan_id: 'LN-006',
        promised_amount: 22000,
        promise_date: '2024-04-18',
        status: 'partial',
        officer_name: 'David Ochieng',
        branch: 'Westlands',
        remarks: 'Paid 15,000, balance pending',
        created_date: '2024-04-13',
        actual_payment_date: '2024-04-18',
        actual_amount_paid: 15000
      },
      {
        id: 'PTP-007',
        customer_name: 'Michael Omondi',
        loan_id: 'LN-007',
        promised_amount: 30000,
        promise_date: '2024-04-16',
        status: 'pending',
        officer_name: 'Sarah Mwangi',
        branch: 'Nairobi CBD',
        remarks: 'Confirmed payment tomorrow',
        created_date: '2024-04-11',
        actual_payment_date: null,
        actual_amount_paid: null
      },
      {
        id: 'PTP-008',
        customer_name: 'Elizabeth Atieno',
        loan_id: 'LN-008',
        promised_amount: 28000,
        promise_date: '2024-04-15',
        status: 'broken',
        officer_name: 'James Mutiso',
        branch: 'Thika',
        remarks: 'Customer relocated',
        created_date: '2024-04-10',
        actual_payment_date: null,
        actual_amount_paid: 0
      }
    ],
    chartData: {
      statusBreakdown: [
        { name: 'Kept', value: 122, percentage: 78.2, color: '#10b981' },
        { name: 'Pending', value: 16, percentage: 10.3, color: '#f59e0b' },
        { name: 'Broken', value: 18, percentage: 11.5, color: '#ef4444' }
      ],
      officerPerformance: [
        { officer: 'Sarah Mwangi', kept: 45, broken: 5, pending: 8 },
        { officer: 'David Ochieng', kept: 32, broken: 6, pending: 4 },
        { officer: 'James Mutiso', kept: 25, broken: 4, pending: 3 },
        { officer: 'Linda Wambui', kept: 20, broken: 3, pending: 1 }
      ]
    }
  };

  const mockBranches = ['Nairobi CBD', 'Westlands', 'Thika', 'Mombasa'];
  const mockOfficers = ['Sarah Mwangi', 'David Ochieng', 'James Mutiso', 'Linda Wambui'];

  useEffect(() => {
    loadStaticData();
    generateReport();
  }, []);

  const loadStaticData = async () => {
    setBranches(mockBranches);
    setOfficers(mockOfficers);
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real application, you would use Supabase like this:
      /*
      let query = supabase
        .from('promises_to_pay')
        .select(`
          *,
          customers(name),
          loans(id),
          officers(name),
          branches(name)
        `);

      if (filters.startDate) {
        query = query.gte('promise_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('promise_date', filters.endDate);
      }
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.officer !== 'all') {
        query = query.eq('officer_id', filters.officer);
      }
      if (filters.branch !== 'all') {
        query = query.eq('branch_id', filters.branch);
      }

      const { data, error } = await query;
      */

      // For now, using mock data with filtering
      let filteredData = { ...mockPTPData };

      if (filters.startDate) {
        filteredData.ptps = filteredData.ptps.filter(
          ptp => ptp.promise_date >= filters.startDate
        );
      }
      if (filters.endDate) {
        filteredData.ptps = filteredData.ptps.filter(
          ptp => ptp.promise_date <= filters.endDate
        );
      }
      if (filters.status !== 'all') {
        filteredData.ptps = filteredData.ptps.filter(
          ptp => ptp.status === filters.status
        );
      }
      if (filters.officer !== 'all') {
        filteredData.ptps = filteredData.ptps.filter(
          ptp => ptp.officer_name === filters.officer
        );
      }
      if (filters.branch !== 'all') {
        filteredData.ptps = filteredData.ptps.filter(
          ptp => ptp.branch === filters.branch
        );
      }

      // Recalculate summary based on filtered data
      const filteredPtps = filteredData.ptps;
      const totalPromises = filteredPtps.length;
      const keptPromises = filteredPtps.filter(ptp => ptp.status === 'kept').length;
      const brokenPromises = filteredPtps.filter(ptp => ptp.status === 'broken').length;
      const pendingPromises = filteredPtps.filter(ptp => ptp.status === 'pending').length;
      const partialPromises = filteredPtps.filter(ptp => ptp.status === 'partial').length;
      
      filteredData.summary = {
        totalPromises,
        keptPromises,
        brokenPromises,
        pendingPromises,
        partialPromises,
        totalPromisedAmount: filteredPtps.reduce((sum, ptp) => sum + ptp.promised_amount, 0),
        collectedAmount: filteredPtps.reduce((sum, ptp) => sum + (ptp.actual_amount_paid || 0), 0),
        keptPercentage: totalPromises > 0 ? (keptPromises / totalPromises * 100) : 0,
        brokenPercentage: totalPromises > 0 ? (brokenPromises / totalPromises * 100) : 0,
        pendingPercentage: totalPromises > 0 ? (pendingPromises / totalPromises * 100) : 0
      };

      setReportData(filteredData);

    } catch (error) {
      console.error('Error generating PTP report:', error);
      alert('Failed to generate PTP report');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const handleStatusUpdate = async (ptpId, newStatus) => {
    try {
      // In a real application, you would update in Supabase:
      /*
      const { error } = await supabase
        .from('promises_to_pay')
        .update({ status: newStatus })
        .eq('id', ptpId);

      if (error) throw error;
      */

      // For now, update locally
      setReportData(prev => ({
        ...prev,
        ptps: prev.ptps.map(ptp => 
          ptp.id === ptpId ? { ...ptp, status: newStatus } : ptp
        )
      }));

      // Regenerate report to recalculate summary
      generateReport();
      
    } catch (error) {
      console.error('Error updating PTP status:', error);
      alert('Failed to update PTP status');
    }
  };

  const handleExport = () => {
    if (!reportData?.ptps) return;
    
    const csvData = reportData.ptps.map(ptp => ({
      'PTP ID': ptp.id,
      'Customer Name': ptp.customer_name,
      'Loan ID': ptp.loan_id,
      'Promised Amount (KES)': ptp.promised_amount,
      'Promise Date': ptp.promise_date,
      'Status': ptp.status,
      'Officer': ptp.officer_name,
      'Branch': ptp.branch,
      'Remarks': ptp.remarks,
      'Created Date': ptp.created_date,
      'Actual Payment Date': ptp.actual_payment_date,
      'Actual Amount Paid (KES)': ptp.actual_amount_paid
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
    return new Date(dateString).toLocaleDateString('en-KE');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      kept: { color: 'bg-green-100 text-green-800', label: 'Kept' },
      broken: { color: 'bg-red-100 text-red-800', label: 'Broken' },
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      partial: { color: 'bg-blue-100 text-blue-800', label: 'Partial' }
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
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
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

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className=" text-lg font-semibold  text-gray-600">Promise to Pay Reports</h1>
        <div className="flex space-x-3">
          <button
            onClick={generateReport}
            disabled={loading}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
          >
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
      <div className="bg-white p-6 rounded-lg shadow-sm border">
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
              <option value="partial">Partial</option>
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
                <option key={officer} value={officer}>{officer}</option>
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
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mt-4">
          <button
            onClick={generateReport}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : 'Generate Report'}
          </button>
        </div>
      </div>

      {reportData && (
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
          {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Total Promised Amount</p>
                <p className="text-3xl font-bold text-indigo-600">{formatCurrency(reportData.summary.totalPromisedAmount)}</p>
                <p className="text-sm text-gray-600 mt-2">Amount customers promised to pay</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Actual Amount Collected</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(reportData.summary.collectedAmount)}</p>
                <p className="text-sm text-gray-600 mt-2">
                  {formatPercentage((reportData.summary.collectedAmount / reportData.summary.totalPromisedAmount) * 100)} collection rate
                </p>
              </div>
            </div>
          </div> */}

          {/* Charts */}
          {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Promise Status Breakdown</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={reportData.chartData.statusBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {reportData.chartData.statusBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name, props) => [`${value} promises`, props.payload.name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Promises by Officer</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reportData.chartData.officerPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="officer" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="kept" name="Kept" fill="#10b981" />
                  <Bar dataKey="broken" name="Broken" fill="#ef4444" />
                  <Bar dataKey="pending" name="Pending" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div> */}

          {/* PTP Details Table */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Promise to Pay Details</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PTP ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loan ID
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('promised_amount')}
                    >
                      Promised Amount
                      {sortConfig.key === 'promised_amount' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('promise_date')}
                    >
                      Promise Date
                      {sortConfig.key === 'promise_date' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Officer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remarks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedPtps.map((ptp) => (
                    <tr key={ptp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {ptp.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {ptp.customer_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {ptp.loan_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(ptp.promised_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(ptp.promise_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(ptp.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {ptp.officer_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {ptp.remarks}
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
                          <option value="partial">Partial</option>
                        </select>
                      </td>
                    </tr>
                  ))}
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
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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