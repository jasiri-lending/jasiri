// src/components/reports/OfficerReports.jsx
import React, { useState, useEffect } from 'react';
import { exportToCSV } from '../../utils/exportUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import Spinner from "../../components/Spinner"; // ✅ Import your custom Spinner

const OfficerReports = () => {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    branch: 'all',
    officer: 'all',
    metric: 'performance'
  });

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'total_collections', direction: 'desc' });
  const itemsPerPage = 10;

  // Mock data for demonstration
  const mockOfficerData = {
    summary: {
      totalLoansBooked: 156,
      totalAmountDisbursed: 4250000,
      totalCollections: 2980000,
      promiseKeptRate: 78.5,
      activeClients: 89,
      avgLoanSize: 27243,
      collectionEfficiency: 82.3
    },
    officers: [
      {
        id: 'OF-001',
        name: 'Sarah Mwangi',
        branch: 'Nairobi CBD',
        loans_booked: 42,
        amount_disbursed: 1150000,
        total_collections: 850000,
        promise_kept_rate: 85.2,
        active_clients: 28,
        target_achievement: 112,
        phone_calls: 156,
        visits_completed: 45
      },
      {
        id: 'OF-002',
        name: 'David Ochieng',
        branch: 'Westlands',
        loans_booked: 38,
        amount_disbursed: 980000,
        total_collections: 720000,
        promise_kept_rate: 79.8,
        active_clients: 24,
        target_achievement: 105,
        phone_calls: 142,
        visits_completed: 38
      },
      {
        id: 'OF-003',
        name: 'James Mutiso',
        branch: 'Thika',
        loans_booked: 35,
        amount_disbursed: 750000,
        total_collections: 520000,
        promise_kept_rate: 74.3,
        active_clients: 22,
        target_achievement: 98,
        phone_calls: 128,
        visits_completed: 42
      },
      {
        id: 'OF-004',
        name: 'Linda Wambui',
        branch: 'Nairobi CBD',
        loans_booked: 41,
        amount_disbursed: 1370000,
        total_collections: 890000,
        promise_kept_rate: 82.6,
        active_clients: 26,
        target_achievement: 108,
        phone_calls: 165,
        visits_completed: 48
      },
      {
        id: 'OF-005',
        name: 'Peter Kamau',
        branch: 'Mombasa',
        loans_booked: 28,
        amount_disbursed: 620000,
        total_collections: 410000,
        promise_kept_rate: 71.2,
        active_clients: 18,
        target_achievement: 87,
        phone_calls: 118,
        visits_completed: 35
      },
      {
        id: 'OF-006',
        name: 'Grace Akinyi',
        branch: 'Westlands',
        loans_booked: 32,
        amount_disbursed: 880000,
        total_collections: 590000,
        promise_kept_rate: 76.8,
        active_clients: 21,
        target_achievement: 95,
        phone_calls: 135,
        visits_completed: 40
      }
    ],
    performanceCharts: {
      loansBooked: [
        { officer: 'Sarah Mwangi', loans: 42 },
        { officer: 'Linda Wambui', loans: 41 },
        { officer: 'David Ochieng', loans: 38 },
        { officer: 'James Mutiso', loans: 35 },
        { officer: 'Grace Akinyi', loans: 32 },
        { officer: 'Peter Kamau', loans: 28 }
      ],
      collectionsTrend: [
        { month: 'Jan', collections: 650000 },
        { month: 'Feb', collections: 720000 },
        { month: 'Mar', collections: 810000 },
        { month: 'Apr', collections: 890000 },
        { month: 'May', collections: 950000 },
        { month: 'Jun', collections: 980000 }
      ]
    }
  };

  const mockBranches = ['Nairobi CBD', 'Westlands', 'Thika', 'Mombasa'];
  const mockOfficers = ['Sarah Mwangi', 'David Ochieng', 'James Mutiso', 'Linda Wambui', 'Peter Kamau', 'Grace Akinyi'];

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
        .from('officer_performance')
        .select(`
          *,
          branches(name),
          officers(name)
        `);

      if (filters.startDate) {
        query = query.gte('period', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('period', filters.endDate);
      }
      if (filters.branch !== 'all') {
        query = query.eq('branch_id', filters.branch);
      }
      if (filters.officer !== 'all') {
        query = query.eq('officer_id', filters.officer);
      }

      const { data, error } = await query;
      */

      // For now, using mock data with filtering
      let filteredData = { ...mockOfficerData };

      if (filters.branch !== 'all') {
        filteredData.officers = filteredData.officers.filter(
          officer => officer.branch === filters.branch
        );
      }
      if (filters.officer !== 'all') {
        filteredData.officers = filteredData.officers.filter(
          officer => officer.name === filters.officer
        );
      }

      // Recalculate summary based on filtered data
      if (filters.branch !== 'all' || filters.officer !== 'all') {
        const filteredOfficers = filteredData.officers;
        filteredData.summary = {
          totalLoansBooked: filteredOfficers.reduce((sum, officer) => sum + officer.loans_booked, 0),
          totalAmountDisbursed: filteredOfficers.reduce((sum, officer) => sum + officer.amount_disbursed, 0),
          totalCollections: filteredOfficers.reduce((sum, officer) => sum + officer.total_collections, 0),
          promiseKeptRate: filteredOfficers.length > 0
            ? filteredOfficers.reduce((sum, officer) => sum + officer.promise_kept_rate, 0) / filteredOfficers.length
            : 0,
          activeClients: filteredOfficers.reduce((sum, officer) => sum + officer.active_clients, 0),
          avgLoanSize: filteredOfficers.reduce((sum, officer) => sum + officer.amount_disbursed, 0) /
            filteredOfficers.reduce((sum, officer) => sum + officer.loans_booked, 0),
          collectionEfficiency: filteredOfficers.reduce((sum, officer) => sum + officer.total_collections, 0) /
            filteredOfficers.reduce((sum, officer) => sum + officer.amount_disbursed, 0) * 100
        };
      }

      setReportData(filteredData);

    } catch (error) {
      console.error('Error generating officer report:', error);
      alert('Failed to generate officer report');
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

  const handleExport = () => {
    if (!reportData?.officers) return;

    const csvData = reportData.officers.map(officer => ({
      'Officer ID': officer.id,
      'Officer Name': officer.name,
      'Branch': officer.branch,
      'Loans Booked': officer.loans_booked,
      'Amount Disbursed (KES)': officer.amount_disbursed,
      'Total Collections (KES)': officer.total_collections,
      'Promise Kept Rate (%)': officer.promise_kept_rate,
      'Active Clients': officer.active_clients,
      'Target Achievement (%)': officer.target_achievement,
      'Phone Calls': officer.phone_calls,
      'Visits Completed': officer.visits_completed
    }));

    exportToCSV(csvData, `officer-reports-${new Date().toISOString().split('T')[0]}.csv`);
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

  const getPerformanceBadge = (rate) => {
    if (rate >= 80) return { color: 'bg-green-100 text-green-800', label: 'Excellent' };
    if (rate >= 70) return { color: 'bg-blue-100 text-blue-800', label: 'Good' };
    if (rate >= 60) return { color: 'bg-yellow-100 text-yellow-800', label: 'Average' };
    return { color: 'bg-red-100 text-red-800', label: 'Needs Improvement' };
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // Sort and paginate officer data
  const sortedOfficers = React.useMemo(() => {
    if (!reportData?.officers) return [];

    const sorted = [...reportData.officers].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [reportData?.officers, sortConfig]);

  const paginatedOfficers = sortedOfficers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(sortedOfficers.length / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-600">Officer Performance Reports</h1>
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
        <h2 className="text-lg font-semibold text-gray-600 mb-4">Filter Officer Reports</h2>

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

        <div className="mt-4">
          <button
            onClick={generateReport}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {loading && !reportData ? (
        <div className="py-20">
          <Spinner text="Generating officer reports..." />
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
                  <p className="text-sm font-medium text-gray-600">Total Loans Booked</p>
                  <p className="text-2xl font-bold text-gray-600">{reportData.summary.totalLoansBooked}</p>
                  <p className="text-xs text-gray-600 mt-1">Active portfolio</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Amount Disbursed</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(reportData.summary.totalAmountDisbursed)}</p>
                  <p className="text-xs text-gray-600 mt-1">Current period</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Collections</p>
                  <p className="text-2xl font-bold text-purple-600">{formatCurrency(reportData.summary.totalCollections)}</p>
                  <p className="text-xs text-gray-600 mt-1">{formatPercentage(reportData.summary.collectionEfficiency)} efficiency</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Promise Kept Rate</p>
                  <p className="text-2xl font-bold text-orange-600">{formatPercentage(reportData.summary.promiseKeptRate)}</p>
                  <p className="text-xs text-gray-600 mt-1">Average performance</p>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Active Clients</p>
                <p className="text-3xl font-bold text-indigo-600">{reportData.summary.activeClients}</p>
                <p className="text-sm text-gray-600 mt-2">Currently managed</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Average Loan Size</p>
                <p className="text-3xl font-bold text-blue-600">{formatCurrency(reportData.summary.avgLoanSize)}</p>
                <p className="text-sm text-gray-600 mt-2">Per loan booked</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Collection Efficiency</p>
                <p className="text-3xl font-bold text-green-600">{formatPercentage(reportData.summary.collectionEfficiency)}</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${reportData.summary.collectionEfficiency}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-600 mb-4">Loans Booked per Officer</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reportData.performanceCharts.loansBooked}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="officer" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="loans" name="Loans Booked" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-600 mb-4">Collections Trend Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={reportData.performanceCharts.collectionsTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `KES ${value / 1000}k`} />
                  <Tooltip formatter={(value) => [formatCurrency(value), 'Collections']} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="collections"
                    name="Collections"
                    stroke="#10b981"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Officer Performance Table */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-600">Officer Performance Details</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Officer Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Branch
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('loans_booked')}
                    >
                      Loans Booked
                      {sortConfig.key === 'loans_booked' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('amount_disbursed')}
                    >
                      Amount Disbursed
                      {sortConfig.key === 'amount_disbursed' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('promise_kept_rate')}
                    >
                      PTP Kept
                      {sortConfig.key === 'promise_kept_rate' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('total_collections')}
                    >
                      Total Collections
                      {sortConfig.key === 'total_collections' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Active Clients
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedOfficers.map((officer) => {
                    const performance = getPerformanceBadge(officer.promise_kept_rate);
                    return (
                      <tr key={officer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0 bg-indigo-100 rounded-full flex items-center justify-center">
                              <span className="text-indigo-600 font-semibold text-sm">
                                {getInitials(officer.name)}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-600">{officer.name}</div>
                              <div className="text-sm text-gray-500">ID: {officer.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {officer.branch}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div className="font-medium">{officer.loans_booked}</div>
                          <div className="text-xs text-gray-500">{formatPercentage(officer.target_achievement)} target</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatCurrency(officer.amount_disbursed)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm text-gray-900 mr-2">{formatPercentage(officer.promise_kept_rate)}</span>
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-600 h-2 rounded-full"
                                style={{ width: `${officer.promise_kept_rate}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600">
                          {formatCurrency(officer.total_collections)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {officer.active_clients}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${performance.color}`}>
                            {performance.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedOfficers.length)} of {sortedOfficers.length} officers
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

export default OfficerReports;