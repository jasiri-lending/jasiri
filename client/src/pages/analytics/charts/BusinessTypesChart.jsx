import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Briefcase, Calendar, Globe, Building, Download, Filter } from 'lucide-react';
import { supabase } from "../../../supabaseClient";
import { HEADER_COLOR, COLORS } from '../shared/constants';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0]?.payload;
  
  return (
    <div className="bg-white p-4 rounded-lg shadow-xl border border-gray-200">
      <p className="font-bold text-slate-600 mb-3 text-sm">{data?.name}</p>
      <div className="space-y-2">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Customer Count:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS[4] }}>
            {data?.count?.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Total Daily Income:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS[5] }}>
            Ksh {data?.totalIncome?.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Avg Daily Income:</span>
          <span className="font-semibold text-xs">
            Ksh {data?.count > 0 ? Math.round(data?.totalIncome / data?.count).toLocaleString() : '0'}
          </span>
        </div>
      </div>
    </div>
  );
};

// Helper function to get date range start
const getDateRangeStart = (dateRange) => {
  const now = new Date();
  const startDate = new Date();
  
  switch(dateRange) {
    case 'week':
      startDate.setDate(now.getDate() - 6); // Last 7 days including today
      break;
    case 'month':
      startDate.setDate(1); // First day of current month
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate.setMonth(quarter * 3, 1); // First day of current quarter
      break;
    case '6months':
      startDate.setMonth(now.getMonth() - 5); // Last 6 months including current
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear(), 0, 1); // First day of current year
      break;
    default:
      return null; // 'all' doesn't need a start date
  }
  
  startDate.setHours(0, 0, 0, 0);
  return startDate.toISOString();
};

// Fetch business types data
const fetchBusinessTypesData = async (dateRange, selectedRegion, selectedBranch, customDateRange, showTopTen) => {
  try {
    let query = supabase
      .from('loans')
      .select(`
        id,
        customer_id,
        created_at,
        branch_id,
        branches!inner(name, code, region_id),
        regions!inner(name),
        customers!inner(business_type, daily_Sales)
      `)
      .eq('status', 'disbursed')
      .not('customers.business_type', 'is', null);

    // Filter by branch if specified
    if (selectedBranch !== 'all') {
      query = query.eq('branch_id', selectedBranch);
    } else if (selectedRegion !== 'all') {
      // Filter by region if specified
      const { data: regionData } = await supabase
        .from('regions')
        .select('id')
        .eq('name', selectedRegion)
        .single();
      
      if (regionData) {
        // Get all branches in this region
        const { data: branchesInRegion } = await supabase
          .from('branches')
          .select('id')
          .eq('region_id', regionData.id);
        
        if (branchesInRegion?.length > 0) {
          const branchIds = branchesInRegion.map(b => b.id);
          query = query.in('branch_id', branchIds);
        }
      }
    }

    // Handle date filtering
    if (customDateRange?.startDate && customDateRange?.endDate) {
      query = query
        .gte('created_at', customDateRange.startDate)
        .lte('created_at', customDateRange.endDate);
    } else if (dateRange !== 'all') {
      const startDate = getDateRangeStart(dateRange);
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
    }

    const { data: loansData, error: loansError } = await query;
    
    if (loansError) {
      console.error("Error fetching business types data:", loansError);
      return [];
    }

    if (!loansData || loansData.length === 0) {
      return [];
    }

    // Process business types data
    const businessMap = {};
    
    // Track unique customers to avoid duplicates
    const processedCustomers = new Set();

    loansData.forEach(loan => {
      const customer = loan.customers;
      if (customer && customer.business_type && !processedCustomers.has(loan.customer_id)) {
        processedCustomers.add(loan.customer_id);
        
        const businessType = customer.business_type || 'Unknown';
        const dailySales = Number(customer.daily_Sales) || 0;
        
        if (!businessMap[businessType]) {
          businessMap[businessType] = {
            name: businessType,
            count: 0,
            totalIncome: 0
          };
        }
        
        businessMap[businessType].count++;
        businessMap[businessType].totalIncome += dailySales;
      }
    });

    // Convert to array
    let result = Object.values(businessMap);
    
    // Sort by count (descending)
    result.sort((a, b) => b.count - a.count);
    
    // Limit to top 10 if showTopTen is true
    if (showTopTen && result.length > 10) {
      result = result.slice(0, 10);
    }
    
    // Calculate average income per customer
    result = result.map(item => ({
      ...item,
      avgDailyIncome: item.count > 0 ? Math.round(item.totalIncome / item.count) : 0
    }));

    return result;

  } catch (error) {
    console.error("Error in fetchBusinessTypesData:", error);
    return [];
  }
};

const BusinessTypesChart = () => {
  const [data, setData] = useState([]);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: 'all', // Default to all time
    region: 'all',
    branch: 'all',
    customStartDate: '',
    customEndDate: ''
  });
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTopTen, setShowTopTen] = useState(true); // Default to showing top 10

  // Fetch available regions and branches on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch all regions
        const { data: regionsData, error: regionsError } = await supabase
          .from('regions')
          .select('id, name')
          .order('name');
        
        if (regionsError) throw regionsError;
        if (regionsData) {
          setAvailableRegions(regionsData);
        }
        
        // Fetch all branches
        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('id, name, code, region_id')
          .order('name');
        
        if (branchesError) throw branchesError;
        if (branchesData) {
          setAvailableBranches(branchesData);
        }
        
        // Fetch initial business types data
        await fetchDataWithFilters({
          dateRange: 'all',
          region: 'all',
          branch: 'all'
        }, null, showTopTen);
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };
    
    fetchInitialData();
  }, []);

  // Filter branches by selected region
  useEffect(() => {
    if (filters.region === 'all') {
      setSelectedRegionId(null);
    } else {
      const region = availableRegions.find(r => r.name === filters.region);
      setSelectedRegionId(region?.id || null);
    }
  }, [filters.region, availableRegions]);

  const filteredBranches = filters.region === 'all' 
    ? availableBranches 
    : availableBranches.filter(branch => branch.region_id === selectedRegionId);

  // Fetch data with filters
  const fetchDataWithFilters = useCallback(async (filterParams, customDateRange = null, topTen = true) => {
    setLoading(true);
    try {
      const businessData = await fetchBusinessTypesData(
        filterParams.dateRange,
        filterParams.region,
        filterParams.branch,
        customDateRange,
        topTen
      );
      setData(businessData);
    } catch (error) {
      console.error("Error fetching business types data:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchDataWithFilters(filters, null, showTopTen);
  }, [fetchDataWithFilters, showTopTen]);

  // Handle filter changes
  const handleFilterChange = useCallback(async (key, value) => {
    const newFilters = { ...filters };
    
    // Reset branch when region changes
    if (key === 'region') {
      newFilters.region = value;
      newFilters.branch = 'all';
      
      // Update selected region ID
      if (value === 'all') {
        setSelectedRegionId(null);
      } else {
        const region = availableRegions.find(r => r.name === value);
        setSelectedRegionId(region?.id || null);
      }
    } else if (key === 'dateRange') {
      newFilters.dateRange = value;
      if (value === 'custom') {
        setShowCustomDate(true);
        return;
      } else {
        setShowCustomDate(false);
      }
    } else {
      newFilters[key] = value;
    }
    
    setFilters(newFilters);
    
    // Prepare custom date range if applicable
    let customDateRange = null;
    if (newFilters.dateRange === 'custom' && newFilters.customStartDate && newFilters.customEndDate) {
      customDateRange = {
        startDate: newFilters.customStartDate,
        endDate: newFilters.customEndDate
      };
    }
    
    fetchDataWithFilters(newFilters, customDateRange, showTopTen);
  }, [filters, availableRegions, fetchDataWithFilters, showTopTen]);

  // Toggle top ten filter
  const handleTopTenToggle = useCallback(() => {
    const newShowTopTen = !showTopTen;
    setShowTopTen(newShowTopTen);
    fetchDataWithFilters(filters, null, newShowTopTen);
  }, [showTopTen, filters, fetchDataWithFilters]);

  // Apply custom date filter
  const applyCustomDateFilter = useCallback(async () => {
    if (filters.customStartDate && filters.customEndDate) {
      const customDateRange = {
        startDate: filters.customStartDate,
        endDate: filters.customEndDate
      };
      await fetchDataWithFilters({ ...filters, dateRange: 'custom' }, customDateRange, showTopTen);
    }
  }, [filters, fetchDataWithFilters, showTopTen]);

  // Export function
  const handleExport = useCallback(() => {
    if (!data || data.length === 0) return;
    
    const csvData = data.map(item => ({
      'Business Type': item.name,
      'Customer Count': item.count || 0,
      'Total Daily Income (Ksh)': item.totalIncome || 0,
      'Average Daily Income (Ksh)': item.avgDailyIncome || 0
    }));
    
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `business-types-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [data]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
      {/* Header with title and filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6" style={{ color: HEADER_COLOR }} />
          <h3 className="text-lg font-semibold" style={{ color: HEADER_COLOR }}>Business Types Analysis</h3>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleTopTenToggle}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showTopTen ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
          >
            <Filter className="w-4 h-4" />
            {showTopTen ? 'Showing Top 10' : 'Showing All'}
          </button>
          
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-gray-50 text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            disabled={!data || data.length === 0}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="grid grid-cols-4 gap-3 items-center">
          {/* Date Range */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              className="bg-transparent border-none text-sm focus:outline-none w-full"
              disabled={loading}
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="6months">Last 6 Months</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Region */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
            <Globe className="w-4 h-4 text-gray-500" />
            <select
              value={filters.region}
              onChange={(e) => handleFilterChange('region', e.target.value)}
              className="bg-transparent border-none text-sm focus:outline-none w-full"
              disabled={loading}
            >
              <option value="all">All Regions</option>
              {availableRegions.map(region => (
                <option key={region.id} value={region.name}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
            <Building className="w-4 h-4 text-gray-500" />
            <select
              value={filters.branch}
              onChange={(e) => handleFilterChange('branch', e.target.value)}
              className="bg-transparent border-none text-sm focus:outline-none w-full"
              disabled={loading}
            >
              <option value="all">All Branches</option>
              {filteredBranches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
          </div>

          {/* Top Ten Toggle - Mobile friendly */}
          <div className="flex items-center justify-end">
            <span className="text-sm text-gray-600 mr-2">{showTopTen ? 'Top 10' : 'All'}</span>
            <button
              onClick={handleTopTenToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${showTopTen ? 'bg-blue-600' : 'bg-gray-300'}`}
              disabled={loading}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${showTopTen ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {showCustomDate && (
          <div className="mt-4 flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <input
                type="date"
                value={filters.customStartDate}
                onChange={(e) => handleFilterChange('customStartDate', e.target.value)}
                className="border rounded px-2 py-1 text-sm"
                disabled={loading}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                value={filters.customEndDate}
                onChange={(e) => handleFilterChange('customEndDate', e.target.value)}
                className="border rounded px-2 py-1 text-sm"
                disabled={loading}
              />
            </div>
            <button
              onClick={applyCustomDateFilter}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              disabled={!filters.customStartDate || !filters.customEndDate || loading}
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Graph */}
      <div className="h-80">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-gray-500">Loading business types data...</p>
            </div>
          </div>
        ) : data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={60}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="count" name="Customer Count" fill={COLORS[4]} />
              <Bar dataKey="totalIncome" name="Total Daily Income" fill={COLORS[5]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No business types data available for the selected filters</p>
              <p className="text-gray-400 text-sm mt-1">
                Try adjusting your filters or date range
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Summary Stats */}
      {data && data.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">Total Business Types</p>
              <p className="text-lg font-semibold" style={{ color: HEADER_COLOR }}>{data.length}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-lg font-semibold" style={{ color: COLORS[4] }}>
                {data.reduce((sum, item) => sum + (item.count || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Avg Daily Income</p>
              <p className="text-lg font-semibold" style={{ color: COLORS[5] }}>
                Ksh {data.reduce((sum, item) => sum + (item.totalIncome || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessTypesChart;