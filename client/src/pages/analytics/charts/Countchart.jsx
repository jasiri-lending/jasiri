import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { UserCog, Calendar, Globe, Building, Download } from 'lucide-react';
import { supabase } from "../../../supabaseClient";
import { HEADER_COLOR, COLORS } from '../shared/constants';

// Helper function to get date range start
const getDateRangeStart = (dateRange) => {
  const now = new Date();
  const startDate = new Date();
  
  switch(dateRange) {
    case 'week':
      startDate.setDate(now.getDate() - 6);
      break;
    case 'month':
      startDate.setDate(1);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate.setMonth(quarter * 3, 1);
      break;
    case '6months':
      startDate.setMonth(now.getMonth() - 5);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear(), 0, 1);
      break;
    default:
      return null;
  }
  
  startDate.setHours(0, 0, 0, 0);
  return startDate.toISOString();
};

// Fetch customer distribution by county with filters
const fetchCustomerDistribution = async (dateRange, selectedRegion, selectedBranch, customDateRange) => {
  try {
    let query = supabase
      .from('customers')
      .select(`
        id,
        county,
        created_at,
        branch_id,
        region_id,
        branches!inner(name, code, region_id),
        regions!inner(name)
      `)
      .not('county', 'is', null);

    // Filter by branch if specified
    if (selectedBranch !== 'all') {
      query = query.eq('branch_id', selectedBranch);
    } else if (selectedRegion !== 'all') {
      const { data: regionData } = await supabase
        .from('regions')
        .select('id')
        .eq('name', selectedRegion)
        .single();
      
      if (regionData) {
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

    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching customer distribution:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const countyMap = {};
    data.forEach(customer => {
      const county = customer.county || 'Unknown';
      if (!countyMap[county]) {
        countyMap[county] = 0;
      }
      countyMap[county]++;
    });

    const totalCustomers = data.length;

    return Object.entries(countyMap)
      .map(([county, count]) => ({
        county,
        customers: count,
        percentage: Math.round((count / totalCustomers) * 100)
      }))
      .sort((a, b) => b.customers - a.customers)
      .slice(0, 10);

  } catch (error) {
    console.error("Error in fetchCustomerDistribution:", error);
    return [];
  }
};

const CountyChart = () => {
  const [data, setData] = useState([]);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: 'all',
    region: 'all',
    branch: 'all',
    customStartDate: '',
    customEndDate: ''
  });
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch available regions and branches on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: regionsData, error: regionsError } = await supabase
          .from('regions')
          .select('id, name')
          .order('name');
        
        if (regionsError) throw regionsError;
        if (regionsData) {
          setAvailableRegions(regionsData);
        }
        
        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('id, name, code, region_id')
          .order('name');
        
        if (branchesError) throw branchesError;
        if (branchesData) {
          setAvailableBranches(branchesData);
        }
        
        await fetchDataWithFilters({
          dateRange: 'all',
          region: 'all',
          branch: 'all'
        });
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
  const fetchDataWithFilters = useCallback(async (filterParams, customDateRange = null) => {
    setLoading(true);
    try {
      const distributionData = await fetchCustomerDistribution(
        filterParams.dateRange,
        filterParams.region,
        filterParams.branch,
        customDateRange
      );
      setData(distributionData);
    } catch (error) {
      console.error("Error fetching customer distribution:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback(async (key, value) => {
    const newFilters = { ...filters };
    
    if (key === 'region') {
      newFilters.region = value;
      newFilters.branch = 'all';
      
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
    
    let customDateRange = null;
    if (newFilters.dateRange === 'custom' && newFilters.customStartDate && newFilters.customEndDate) {
      customDateRange = {
        startDate: newFilters.customStartDate,
        endDate: newFilters.customEndDate
      };
    }
    
    fetchDataWithFilters(newFilters, customDateRange);
  }, [filters, availableRegions, fetchDataWithFilters]);

  // Apply custom date filter
  const applyCustomDateFilter = useCallback(async () => {
    if (filters.customStartDate && filters.customEndDate) {
      const customDateRange = {
        startDate: filters.customStartDate,
        endDate: filters.customEndDate
      };
      await fetchDataWithFilters({ ...filters, dateRange: 'custom' }, customDateRange);
    }
  }, [filters, fetchDataWithFilters]);

  // Export function
  const handleExport = useCallback(() => {
    if (!data || data.length === 0) return;
    
    const csvData = data.map(item => ({
      'County': item.county,
      'Customers': item.customers,
      'Percentage': item.percentage + '%'
    }));
    
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-distribution-by-county-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [data]);

  const totalCustomers = data.reduce((sum, item) => sum + item.customers, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    
    const item = payload[0].payload;
    
    return (
      <div className="bg-white p-4 rounded-lg shadow-xl border border-gray-200">
        <p className="font-bold text-slate-600 mb-2 text-sm">{item.county}</p>
        <div className="space-y-1">
          <p className="text-xs text-gray-600">
            Customers: <span className="font-semibold">{item.customers.toLocaleString()}</span>
          </p>
          <p className="text-xs text-gray-600">
            Percentage: <span className="font-semibold">{item.percentage}%</span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCog className="w-6 h-6" style={{ color: HEADER_COLOR }} />
          <h3 className="text-lg font-semibold" style={{ color: HEADER_COLOR }}>
            Customer Distribution by County
          </h3>
        </div>
        <div className="flex items-center gap-3">
       
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
        <div className="grid grid-cols-3 gap-3 items-center">
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

      {/* Chart */}
      <div className="h-80">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
              <p className="text-gray-500">Loading customer distribution...</p>
            </div>
          </div>
        ) : data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.county}: ${entry.percentage}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="customers"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <UserCog className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No customer distribution data available</p>
              <p className="text-gray-400 text-sm mt-1">
                Try adjusting your filters or date range
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {data && data.length > 0 && (
        <div className="mt-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Top Counties</h4>
            <div className="space-y-2">
              {data.slice(0, 5).map((county, index) => (
                <div key={county.county} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm text-gray-700">{county.county}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">
                      {county.customers.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-500 w-12 text-right">
                      {county.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CountyChart;