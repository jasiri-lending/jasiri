import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Heart,  Calendar, Globe, Building } from 'lucide-react';
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

// Fetch marital status data with filters
const fetchMaritalStatusData = async (dateRange, selectedRegion, selectedBranch, customDateRange) => {
  try {
    let query = supabase
      .from('customers')
      .select(`
        id,
        marital_status,
        created_at,
        branch_id,
        region_id,
        branches!inner(name, code, region_id),
        regions!inner(name)
      `)
      .not('marital_status', 'is', null);

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
      console.error("Error fetching marital status:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const maritalStatusCounts = {};
    data.forEach(customer => {
      const status = customer.marital_status || 'Unknown';
      maritalStatusCounts[status] = (maritalStatusCounts[status] || 0) + 1;
    });

    return Object.entries(maritalStatusCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

  } catch (error) {
    console.error("Error in fetchMaritalStatusData:", error);
    return [];
  }
};

const MaritalStatusChart = () => {
  const [data, setData] = useState([]);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: 'all',
    region: 'all',
    branch: 'all',
    customStartDate: '',
    customEndDate: '',
    viewType: 'pie'
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
          branch: 'all',
          viewType: 'pie'
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
      const maritalData = await fetchMaritalStatusData(
        filterParams.dateRange,
        filterParams.region,
        filterParams.branch,
        customDateRange
      );
      setData(maritalData);
    } catch (error) {
      console.error("Error fetching marital status data:", error);
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
    
    // Don't refetch if only viewType changed
    if (key === 'viewType') {
      return;
    }
    
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
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const csvData = data.map(item => ({
      'Marital Status': item.name,
      'Count': item.value,
      'Percentage': Math.round((item.value / total) * 100) + '%'
    }));
    
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marital-status-distribution-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [data]);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    
    const item = payload[0].payload;
    const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
    
    return (
      <div className="bg-[#E7F0FA] p-4 rounded-lg shadow-xl border border-gray-200">
        <p className="font-bold text-slate-600 mb-2 text-sm">{item.name}</p>
        <div className="space-y-1">
          <p className="text-xs text-gray-600">
            Count: <span className="font-semibold">{item.value.toLocaleString()}</span>
          </p>
          <p className="text-xs text-gray-600">
            Percentage: <span className="font-semibold">{percentage}%</span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#E7F0FA] rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Heart className="w-6 h-6" style={{ color: HEADER_COLOR }} />
          <h3 className="text-lg font-semibold" style={{ color: HEADER_COLOR }}>
            Marital Status Distribution
          </h3>
        </div>
      
      </div>

    {/* Filters */}
<div className="mb-6">
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

    {[
      {
        icon: <Calendar className="w-4 h-4 text-slate-500 shrink-0" />,
        value: filters.dateRange,
        onChange: (e) => handleFilterChange('dateRange', e.target.value),
        options: [
          { value: "all", label: "All Time" },
          { value: "week", label: "This Week" },
          { value: "month", label: "This Month" },
          { value: "quarter", label: "This Quarter" },
          { value: "6months", label: "Last 6 Months" },
          { value: "year", label: "This Year" },
          { value: "custom", label: "Custom Range" }
        ]
      },
      {
        icon: <Globe className="w-4 h-4 text-slate-500 shrink-0" />,
        value: filters.region,
        onChange: (e) => handleFilterChange('region', e.target.value),
        options: [
          { value: "all", label: "All Regions" },
          ...availableRegions.map(region => ({
            value: region.name,
            label: region.name
          }))
        ]
      },
      {
        icon: <Building className="w-4 h-4 text-slate-500 shrink-0" />,
        value: filters.branch,
        onChange: (e) => handleFilterChange('branch', e.target.value),
        options: [
          { value: "all", label: "All Branches" },
          ...filteredBranches.map(branch => ({
            value: branch.id,
            label: `${branch.name} (${branch.code})`
          }))
        ]
      }
    ].map((item, idx) => (
      <div
        key={idx}
        className="flex items-center h-11 gap-3 px-3 rounded-lg border border-slate-200 bg-[#E7F0FA] hover:border-slate-300 transition"
      >
        {item.icon}
        <select
          value={item.value}
          onChange={item.onChange}
          disabled={loading}
          className="w-full bg-transparent text-sm font-normal leading-tight text-slate-800 focus:outline-none cursor-pointer py-0.5"
        >
          {item.options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    ))}
  </div>

  {/* Custom Date Range */}
  {showCustomDate && (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Calendar className="w-4 h-4 text-slate-500" />

      <input
        type="date"
        value={filters.customStartDate}
        onChange={(e) => handleFilterChange('customStartDate', e.target.value)}
        disabled={loading}
        className="h-9 px-3 text-sm rounded-lg border bg-[#E7F0FA] focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />

      <span className="text-slate-500 text-sm">to</span>

      <input
        type="date"
        value={filters.customEndDate}
        onChange={(e) => handleFilterChange('customEndDate', e.target.value)}
        disabled={loading}
        className="h-9 px-3 text-sm rounded-lg border bg-[#E7F0FA] focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />

      <button
        onClick={applyCustomDateFilter}
        disabled={!filters.customStartDate || !filters.customEndDate || loading}
        className="h-8 px-3 rounded-md text-xs font-medium text-white bg-[#586ab1] hover:bg-[#4b5aa6] disabled:opacity-50"
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
              <p className="text-gray-500">Loading marital status data...</p>
            </div>
          </div>
        ) : data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {filters.viewType === 'pie' ? (
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${Math.round((value / total) * 100)}%`}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="value" name="Count" fill={HEADER_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No marital status data available</p>
              <p className="text-gray-400 text-sm mt-1">
                Try adjusting your filters or date range
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default MaritalStatusChart;