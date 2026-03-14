// src/components/reports/PTPReports.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { exportToCSV } from '../../utils/exportUtils';
import Spinner from "../../components/Spinner"; // ✅ Import your custom Spinner
import { Loader2, Filter, RefreshCw, Download, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../../hooks/userAuth.js';

const PTPReports = () => {
  const { profile } = useAuth();
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: 'all',
    officer: 'all',
    branch: 'all',
    region: 'all'
  });

  const [showFilters, setShowFilters] = useState(false);

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
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

      // Load regions
      const { data: regionData, error: regionError } = await supabase
        .from('regions')
        .select('id, name')
        .eq('tenant_id', profile?.tenant_id)
        .order('name');

      if (regionError) throw regionError;
      setRegions(regionData || []);
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
          *,
          loans!promise_to_pay_loan_id_fkey (
            id,
            scored_amount
          ),
          customers (
            Firstname,
            Middlename,
            Surname,
            mobile,
            branch:branch_id (
              name,
              region:region_id (name)
            )
          ),
          collector:created_by (
            full_name
          )
        `, { count: 'exact' })
        .eq('tenant_id', profile.tenant_id);

      // RBAC implementation
      if (profile.role === 'relationship_officer') {
        query = query.eq('created_by', profile.id);
      } else if (['branch_manager', 'customer_service_officer'].includes(profile.role)) {
        if (profile.branch_id) {
          query = query.filter('loans.branch_id', 'eq', profile.branch_id);
        }
      } else if (profile.role === 'regional_manager') {
        if (profile.region_id) {
          query = query.filter('loans.region_id', 'eq', profile.region_id);
        }
      }

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
      if (filters.branch !== 'all') {
        query = query.filter('customers.branch.name', 'eq', filters.branch);
      }
      if (filters.region !== 'all') {
        query = query.filter('customers.branch.region.name', 'eq', filters.region);
      }

      const { data: ptpData, error: ptpError } = await query.order('promised_date', { ascending: false });

      if (ptpError) throw ptpError;

      let filteredPtps = ptpData || [];

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
        officer_name: ptp.collector?.full_name || 'Unknown',
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
      {/* Header Section */}
      <div className="bg-brand-secondary rounded-xl shadow-md border border-gray-200 p-4 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-sm font-bold text-stone-600 uppercase tracking-wider">Reports</h1>
              <h2 className="text-lg font-semibold text-white mt-1">
                Promise to Pay Report
              </h2>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2 mt-2 flex-wrap justify-end">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border
                  ${showFilters
                    ? "bg-accent text-white shadow-md border-transparent hover:bg-brand-secondary"
                    : "text-gray-600 border-gray-200 hover:bg-brand-secondary hover:text-white"
                  }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {Object.values(filters).some(val => val && val !== 'all') && !showFilters && (
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </button>

              <button
                onClick={generateReport}
                disabled={loading}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-brand-secondary hover:text-white flex items-center gap-2 transition-all shadow-sm text-sm font-medium"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>

              <button
                onClick={handleExport}
                disabled={!reportData || loading}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-brand-secondary disabled:opacity-50 flex items-center gap-2 transition-all shadow-sm text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900">Report Filters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">End Date</label>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Status</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="kept">Kept</option>
                <option value="broken">Broken</option>
              </select>
            </div>

            {!['relationship_officer'].includes(profile?.role) && (
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Officer</label>
                <select
                  name="officer"
                  value={filters.officer}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="all">All Officers</option>
                  {officers.map(officer => (
                    <option key={officer.id} value={officer.id}>{officer.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            {!['relationship_officer', 'branch_manager', 'customer_service_officer', 'regional_manager'].includes(profile?.role) && (
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Region</label>
                <select
                  name="region"
                  value={filters.region}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="all">All Regions</option>
                  {regions.map(region => (
                    <option key={region.id} value={region.name}>{region.name}</option>
                  ))}
                </select>
              </div>
            )}

            {!['relationship_officer', 'branch_manager', 'customer_service_officer'].includes(profile?.role) && (
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Branch</label>
                <select
                  name="branch"
                  value={filters.branch}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="all">All Branches</option>
                  {branches
                    .filter(b => filters.region === 'all' || b.region?.name === filters.region)
                    .map(branch => (
                      <option key={branch.id} value={branch.name}>{branch.name}</option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={generateReport}
              disabled={loading}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-md font-bold"
            >
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      )}

      {loading && !reportData ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <Spinner text="Generating promise to pay report..." />
        </div>
      ) : reportData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-amber-50 p-5 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
              <p className="text-sm text-muted font-medium">Total Promises</p>
              <p className="text-2xl font-bold mt-1 text-primary">{reportData.summary.totalPromises}</p>
            </div>

            <div className="bg-emerald-50 p-5 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
              <p className="text-sm text-muted font-medium">Kept Promises</p>
              <p className="text-2xl font-bold mt-1 text-accent">{reportData.summary.keptPromises}</p>
              <p className="text-[10px] text-accent font-bold uppercase tracking-tighter mt-1">{formatPercentage(reportData.summary.keptPercentage)} Settlement rate</p>
            </div>

            <div className="bg-purple-50 p-5 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
              <p className="text-sm text-muted font-medium">Broken Promises</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{reportData.summary.brokenPromises}</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter mt-1">{formatPercentage(reportData.summary.brokenPercentage)} Failure rate</p>
            </div>

            <div className="bg-blue-50 p-5 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
              <p className="text-sm text-muted font-medium">Pending Promises</p>
              <p className="text-2xl font-bold mt-1 text-blue-600">{reportData.summary.pendingPromises}</p>
              <p className="text-[10px] text-blue-500 font-bold uppercase tracking-tighter mt-1">{formatPercentage(reportData.summary.pendingPercentage)} Waiting</p>
            </div>
          </div>



          {/* PTP Details Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">Promise to Pay Details</h3>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider bg-white px-3 py-1.5 rounded-lg border border-gray-100">{sortedPtps.length} Records Found</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Customer</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Contact</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Loan</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Amount</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap cursor-pointer hover:text-primary transition-colors" onClick={() => handleSort('promised_date')}>
                      Due Date {sortConfig.key === 'promised_date' && (<span className="ml-1 text-primary font-bold">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>)}
                    </th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Officer</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedPtps.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center">
                          <div className="p-4 bg-gray-50 rounded-full mb-4">
                            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <p className="text-gray-400 font-medium">No results found matching your criteria</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedPtps.map((ptp) => (
                      <tr key={ptp.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-bold text-gray-900">{ptp.customer_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ptp.customer_mobile}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-tighter">#{ptp.loan_id}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{formatCurrency(ptp.promised_amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{formatDate(ptp.promised_date)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(ptp.status)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-600">{ptp.officer_name.charAt(0)}</div>
                            <span className="text-sm font-medium text-gray-700">{ptp.officer_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <select
                            value={ptp.status}
                            onChange={(e) => handleStatusUpdate(ptp.id, e.target.value)}
                            className="bg-white border border-gray-200 text-gray-600 text-xs rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer shadow-sm hover:border-gray-300"
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
              <div className="px-6 py-5 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, sortedPtps.length)}</span> of <span className="font-medium">{sortedPtps.length}</span> entries
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm bg-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg shadow-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm bg-white"
                  >
                    <ChevronRight className="w-4 h-4" />
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