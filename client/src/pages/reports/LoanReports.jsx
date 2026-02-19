// src/components/reports/LoanReports.jsx
import React, { useState, useEffect } from 'react';
import { exportToCSV } from '../../utils/exportUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import RepaymentHistoryModal from './RepaymentHistoryModal';
import Spinner from "../../components/Spinner"; // ✅ Import your custom Spinner

const LoanReports = () => {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    branch: 'all',
    officer: 'all',
    status: 'all'
  });

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'disbursed_date', direction: 'desc' });
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const itemsPerPage = 10;

  // Mock data for demonstration
  const mockLoans = [
    {
      id: 'LN-001',
      customer_name: 'John Kamau',
      disbursed_amount: 50000,
      mobile: '0712345678',
      interest_rate: 12.5,
      transaction_code: 'TXTY3546',
      status: 'active',
      disbursed_date: '2024-01-15',
      officer_name: 'Sarah Mwangi',
      branch_name: 'Nairobi CBD',
      total_repaid: 12500,
      currency: 'KES',
      loan_term: 12,
      weekly_installment: 4167
    },
    {
      id: 'LN-002',
      customer_name: 'Mary Wanjiku',
      disbursed_amount: 75000,
      interest_rate: 10.0,
      mobile: '0723456789',
      transaction_code: 'TXTY3547',
      status: 'closed',
      disbursed_date: '2024-01-20',
      officer_name: 'David Ochieng',
      branch_name: 'Westlands',
      total_repaid: 75000,
      currency: 'KES',
      loan_term: 16,
      weekly_installment: 4688
    },
    {
      id: 'LN-003',
      customer_name: 'Peter Kipchoge',
      disbursed_amount: 150000,
      mobile: '0734567890',
      transaction_code: 'TXTY3548',
      interest_rate: 15.0,
      status: 'defaulted',
      disbursed_date: '2024-02-01',
      officer_name: 'Sarah Mwangi',
      branch_name: 'Nairobi CBD',
      total_repaid: 45000,
      currency: 'KES',
      loan_term: 20,
      weekly_installment: 7500
    },
    {
      id: 'LN-004',
      customer_name: 'Grace Akinyi',
      disbursed_amount: 25000,
      mobile: '0745678901',
      transaction_code: 'TXTY3549',
      interest_rate: 8.5,
      status: 'active',
      disbursed_date: '2024-02-15',
      officer_name: 'James Mutiso',
      branch_name: 'Thika',
      total_repaid: 5000,
      currency: 'KES',
      loan_term: 8,
      weekly_installment: 3125
    },
    {
      id: 'LN-005',
      customer_name: 'Robert Gitonga',
      disbursed_amount: 100000,
      mobile: '0756789012',
      transaction_code: 'TXTY3550',
      interest_rate: 11.0,
      status: 'active',
      disbursed_date: '2024-03-01',
      officer_name: 'David Ochieng',
      branch_name: 'Westlands',
      total_repaid: 25000,
      currency: 'KES',
      loan_term: 15,
      weekly_installment: 6667
    }
  ];

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
      await new Promise(resolve => setTimeout(resolve, 1000));

      let filteredLoans = mockLoans;

      if (filters.startDate) {
        filteredLoans = filteredLoans.filter(loan => loan.disbursed_date >= filters.startDate);
      }
      if (filters.endDate) {
        filteredLoans = filteredLoans.filter(loan => loan.disbursed_date <= filters.endDate);
      }
      if (filters.branch !== 'all') {
        filteredLoans = filteredLoans.filter(loan => loan.branch_name === filters.branch);
      }
      if (filters.officer !== 'all') {
        filteredLoans = filteredLoans.filter(loan => loan.officer_name === filters.officer);
      }
      if (filters.status !== 'all') {
        filteredLoans = filteredLoans.filter(loan => loan.status === filters.status);
      }

      const totalLoans = filteredLoans.length;
      const totalDisbursed = filteredLoans.reduce((sum, loan) => sum + loan.disbursed_amount, 0);
      const totalRepaid = filteredLoans.reduce((sum, loan) => sum + loan.total_repaid, 0);
      const activeLoans = filteredLoans.filter(loan => loan.status === 'active').length;
      const defaultedLoans = filteredLoans.filter(loan => loan.status === 'defaulted').length;
      const defaultRate = totalLoans > 0 ? ((defaultedLoans / totalLoans) * 100).toFixed(1) : 0;

      const monthlyData = prepareMonthlyData(filteredLoans);
      const statusData = prepareStatusData(filteredLoans);

      setReportData({
        loans: filteredLoans,
        summary: {
          totalLoans,
          totalDisbursed,
          totalRepaid,
          activeLoans,
          defaultRate: parseFloat(defaultRate)
        },
        charts: {
          monthly: monthlyData,
          status: statusData
        }
      });

    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const prepareMonthlyData = (loans) => {
    const monthlyTotals = {};

    loans.forEach(loan => {
      const month = loan.disbursed_date.substring(0, 7);
      if (!monthlyTotals[month]) {
        monthlyTotals[month] = 0;
      }
      monthlyTotals[month] += loan.disbursed_amount;
    });

    return Object.entries(monthlyTotals).map(([month, amount]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      amount
    }));
  };

  const prepareStatusData = (loans) => {
    const statusCounts = {};

    loans.forEach(loan => {
      if (!statusCounts[loan.status]) {
        statusCounts[loan.status] = 0;
      }
      statusCounts[loan.status]++;
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      percentage: ((count / loans.length) * 100).toFixed(1)
    }));
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
    if (!reportData?.loans) return;

    const csvData = reportData.loans.map(loan => ({
      'Loan ID': loan.id,
      'Customer Name': loan.customer_name,
      'Mobile': loan.mobile,
      'Transaction Code': loan.transaction_code,
      'Disbursed Amount (KES)': loan.disbursed_amount,
      'Interest Rate (%)': loan.interest_rate,
      'Status': loan.status,
      'Disbursed Date': loan.disbursed_date,
      'Officer': loan.officer_name,
      'Branch': loan.branch_name,
      'Amount Repaid (KES)': loan.total_repaid
    }));

    exportToCSV(csvData, `loan-reports-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleViewRepaymentHistory = (loan) => {
    setSelectedLoan(loan);
    setShowRepaymentModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', label: 'Active' },
      closed: { color: 'bg-blue-100 text-blue-800', label: 'Closed' },
      defaulted: { color: 'bg-red-100 text-red-800', label: 'Defaulted' },
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' }
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const sortedLoans = React.useMemo(() => {
    if (!reportData?.loans) return [];

    const sorted = [...reportData.loans].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [reportData?.loans, sortConfig]);

  const paginatedLoans = sortedLoans.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(sortedLoans.length / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-600">Loan Reports</h1>
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
        <h2 className="text-lg font-semibold text-gray-600 mb-4">Filter Reports</h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              <option value="active">Active</option>
              <option value="closed">Closed</option>
              <option value="defaulted">Defaulted</option>
              <option value="pending">Pending</option>
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
          <Spinner text="Generating loan reports..." />
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
                  <p className="text-sm font-medium text-gray-600">Total Loans Disbursed</p>
                  <p className="text-2xl font-bold text-gray-600">{formatCurrency(reportData.summary.totalDisbursed)}</p>
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
                  <p className="text-sm font-medium text-gray-600">Total Amount Repaid</p>
                  <p className="text-2xl font-bold text-gray-600">{formatCurrency(reportData.summary.totalRepaid)}</p>
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
                  <p className="text-sm font-medium text-gray-600">Active Loans</p>
                  <p className="text-2xl font-bold text-gray-600">{reportData.summary.activeLoans}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Default Rate</p>
                  <p className="text-2xl font-bold text-gray-600">{reportData.summary.defaultRate}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-600 mb-4">Loans Disbursed per Month</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reportData.charts.monthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis
                    tickFormatter={(value) => `KES ${value / 1000}k`}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value), 'Amount']}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="amount" name="Disbursed Amount" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-600 mb-4">Loan Distribution by Status</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={reportData.charts.status}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ status, percentage }) => `${status}: ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {reportData.charts.status.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name, props) => [`${value} loans`, props.payload.status]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Loans Table */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-600">Loan Details</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('id')}
                    >
                      Loan ID
                      {sortConfig.key === 'id' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mobile
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('disbursed_amount')}
                    >
                      Disbursed Amount
                      {sortConfig.key === 'disbursed_amount' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Interest Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('disbursed_date')}
                    >
                      Disbursed Date
                      {sortConfig.key === 'disbursed_date' && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Officer / Branch
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedLoans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {loan.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {loan.customer_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {loan.customer_mobile}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatCurrency(loan.disbursed_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {loan.interest_rate}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(loan.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(loan.disbursed_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div>{loan.officer_name}</div>
                        <div className="text-xs text-gray-500">{loan.branch_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewRepaymentHistory(loan)}
                          className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                        >
                          Repayment History
                        </button>
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
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedLoans.length)} of {sortedLoans.length} results
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

      {/* Repayment History Modal */}
      {showRepaymentModal && selectedLoan && (
        <RepaymentHistoryModal
          loan={selectedLoan}
          onClose={() => setShowRepaymentModal(false)}
        />
      )}
    </div>
  );
};

export default LoanReports;