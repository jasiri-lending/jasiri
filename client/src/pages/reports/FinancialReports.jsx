// src/components/reports/FinancialReports.jsx
import React, { useState, useEffect } from 'react';
import { exportToCSV } from '../../utils/exportUtils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Spinner from "../../components/Spinner"; // ✅ Import your custom Spinner

const FinancialReports = () => {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    branch: 'all',
    reportType: 'summary',
    groupBy: 'monthly'
  });

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [branches, setBranches] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'branch_name', direction: 'asc' });
  const itemsPerPage = 8;

  // Mock data for demonstration
  const mockFinancialData = {
    summary: {
      totalDisbursed: 4250000,
      totalRepaid: 2980000,
      totalOutstanding: 1270000,
      totalInterestEarned: 425000,
      feesCollected: 85000,
      netProfit: 380000,
      collectionRate: 70.1,
      profitMargin: 8.9
    },
    branchBreakdown: [
      {
        branch_name: 'Nairobi CBD',
        total_disbursed: 1850000,
        total_repaid: 1350000,
        interest_income: 185000,
        fees: 37000,
        profit_margin: 9.2
      },
      {
        branch_name: 'Westlands',
        total_disbursed: 1200000,
        total_repaid: 820000,
        interest_income: 120000,
        fees: 24000,
        profit_margin: 8.5
      },
      {
        branch_name: 'Thika',
        total_disbursed: 750000,
        total_repaid: 510000,
        interest_income: 75000,
        fees: 15000,
        profit_margin: 8.1
      },
      {
        branch_name: 'Mombasa',
        total_disbursed: 450000,
        total_repaid: 300000,
        interest_income: 45000,
        fees: 9000,
        profit_margin: 7.8
      }
    ],
    trends: [
      { period: 'Jan 2024', disbursed: 850000, repaid: 520000, outstanding: 330000 },
      { period: 'Feb 2024', disbursed: 1150000, repaid: 780000, outstanding: 700000 },
      { period: 'Mar 2024', disbursed: 1250000, repaid: 980000, outstanding: 970000 },
      { period: 'Apr 2024', disbursed: 1000000, repaid: 700000, outstanding: 1270000 }
    ],
    revenueBreakdown: [
      { name: 'Interest Income', value: 425000, percentage: 83.3, color: '#0088FE' },
      { name: 'Fees Collected', value: 85000, percentage: 16.7, color: '#00C49F' }
    ]
  };

  const mockBranches = ['Nairobi CBD', 'Westlands', 'Thika', 'Mombasa'];

  useEffect(() => {
    loadStaticData();
    generateReport();
  }, []);

  const loadStaticData = async () => {
    setBranches(mockBranches);
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In a real application, you would use Supabase like this:
      /*
      let query = supabase
        .from('financial_summary')
        .select('*');

      if (filters.startDate) {
        query = query.gte('period', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('period', filters.endDate);
      }
      if (filters.branch !== 'all') {
        query = query.eq('branch_id', filters.branch);
      }

      const { data, error } = await query;
      */

      // For now, using mock data with filtering
      let filteredData = { ...mockFinancialData };

      if (filters.branch !== 'all') {
        filteredData.branchBreakdown = filteredData.branchBreakdown.filter(
          branch => branch.branch_name === filters.branch
        );

        // Adjust summary for single branch
        const branchData = filteredData.branchBreakdown[0];
        if (branchData) {
          filteredData.summary = {
            ...filteredData.summary,
            totalDisbursed: branchData.total_disbursed,
            totalRepaid: branchData.total_repaid,
            totalOutstanding: branchData.total_disbursed - branchData.total_repaid,
            totalInterestEarned: branchData.interest_income,
            feesCollected: branchData.fees,
            profitMargin: branchData.profit_margin,
            netProfit: branchData.interest_income + branchData.fees
          };
        }
      }

      setReportData(filteredData);

    } catch (error) {
      console.error('Error generating financial report:', error);
      alert('Failed to generate financial report');
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
    if (!reportData) return;

    let csvData = [];

    if (filters.reportType === 'summary') {
      csvData = [{
        'Total Disbursed (KES)': reportData.summary.totalDisbursed,
        'Total Repaid (KES)': reportData.summary.totalRepaid,
        'Total Outstanding Balance (KES)': reportData.summary.totalOutstanding,
        'Total Interest Earned (KES)': reportData.summary.totalInterestEarned,
        'Fees Collected (KES)': reportData.summary.feesCollected,
        'Collection Rate (%)': `${reportData.summary.collectionRate}%`,
        'Profit Margin (%)': `${reportData.summary.profitMargin}%`,
        'Net Profit (KES)': reportData.summary.netProfit
      }];
    } else {
      csvData = reportData.branchBreakdown.map(branch => ({
        'Branch': branch.branch_name,
        'Total Disbursed (KES)': branch.total_disbursed,
        'Total Repaid (KES)': branch.total_repaid,
        'Interest Income (KES)': branch.interest_income,
        'Fees (KES)': branch.fees,
        'Profit Margin (%)': `${branch.profit_margin}%`
      }));
    }

    exportToCSV(csvData, `financial-reports-${new Date().toISOString().split('T')[0]}.csv`);
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
    return `${value}%`;
  };

  // Sort and paginate branch data
  const sortedBranches = React.useMemo(() => {
    if (!reportData?.branchBreakdown) return [];

    const sorted = [...reportData.branchBreakdown].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [reportData?.branchBreakdown, sortConfig]);

  const paginatedBranches = sortedBranches.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(sortedBranches.length / itemsPerPage);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Financial Summary Reports</h1>
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter Financial Reports</h2>

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
              Report Type
            </label>
            <select
              name="reportType"
              value={filters.reportType}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="summary">Summary</option>
              <option value="detailed">Detailed Breakdown</option>
              <option value="cashflow">Cash Flow</option>
              <option value="profitability">Profitability</option>
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
          <Spinner text="Generating financial reports..." />
        </div>
      ) : reportData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Disbursed</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(reportData.summary.totalDisbursed)}</p>
                  <p className="text-xs text-green-600 mt-1">All time total</p>
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
                  <p className="text-sm font-medium text-gray-600">Total Repaid</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(reportData.summary.totalRepaid)}</p>
                  <p className="text-xs text-gray-600 mt-1">{reportData.summary.collectionRate}% collection rate</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Outstanding Balance</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(reportData.summary.totalOutstanding)}</p>
                  <p className="text-xs text-gray-600 mt-1">Active portfolio</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Interest Earned</p>
                  <p className="text-2xl font-bold text-purple-600">{formatCurrency(reportData.summary.totalInterestEarned)}</p>
                  <p className="text-xs text-gray-600 mt-1">Revenue generated</p>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Fees Collected</p>
                  <p className="text-2xl font-bold text-indigo-600">{formatCurrency(reportData.summary.feesCollected)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-600">Net Profit</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(reportData.summary.netProfit)}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">Profit Margin</p>
                <p className="text-xl font-bold text-blue-600">{formatPercentage(reportData.summary.profitMargin)}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Indicators</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Collection Rate</p>
                  <div className="relative pt-1">
                    <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                      <div
                        style={{ width: `${reportData.summary.collectionRate}%` }}
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
                      ></div>
                    </div>
                    <p className="text-xl font-bold text-gray-900 mt-2">{formatPercentage(reportData.summary.collectionRate)}</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Portfolio at Risk</p>
                  <div className="relative pt-1">
                    <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                      <div
                        style={{ width: '15%' }}
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-red-500"
                      ></div>
                    </div>
                    <p className="text-xl font-bold text-gray-900 mt-2">15%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Disbursement vs Repayment Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={reportData.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis
                    tickFormatter={(value) => `KES ${value / 1000}k`}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value), 'Amount']}
                    labelFormatter={(label) => `Period: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="disbursed"
                    name="Disbursed"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="repaid"
                    name="Repaid"
                    stroke="#10b981"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="outstanding"
                    name="Outstanding"
                    stroke="#f59e0b"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Breakdown</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={reportData.revenueBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {reportData.revenueBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatCurrency(value), 'Amount']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {reportData.revenueBreakdown.map((item, index) => (
                  <div key={index} className="text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm font-medium text-gray-700">{item.name}</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(item.value)}</p>
                    <p className="text-sm text-gray-600">{item.percentage}% of total</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Branch Performance Table */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Branch Performance Breakdown</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('branch_name')}
                    >
                      Branch
                      {sortConfig.key === 'branch_name' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('total_disbursed')}
                    >
                      Total Disbursed
                      {sortConfig.key === 'total_disbursed' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('total_repaid')}
                    >
                      Total Repaid
                      {sortConfig.key === 'total_repaid' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Interest Income
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fees
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('profit_margin')}
                    >
                      Profit Margin
                      {sortConfig.key === 'profit_margin' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedBranches.map((branch) => (
                    <tr key={branch.branch_name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {branch.branch_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(branch.total_disbursed)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                        {formatCurrency(branch.total_repaid)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                        {formatCurrency(branch.interest_income)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600">
                        {formatCurrency(branch.fees)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${branch.profit_margin >= 9 ? 'bg-green-100 text-green-800' :
                            branch.profit_margin >= 8 ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                          }`}>
                          {formatPercentage(branch.profit_margin)}
                        </span>
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
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedBranches.length)} of {sortedBranches.length} branches
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

export default FinancialReports;