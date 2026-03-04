import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Heart, Calendar, Globe, Building, Download } from 'lucide-react';
import { supabase } from "../../../supabaseClient";
import { useTenant } from "../../../hooks/useTenant";
import { HEADER_COLOR, COLORS } from '../shared/constants';

// Helper function to get date range start
const getDateRangeStart = (dateRange) => {
  const now = new Date();
  const startDate = new Date();

  switch (dateRange) {
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
const fetchMaritalStatusData = async (dateRange, selectedRegion, selectedBranch, customDateRange, tenantId) => {
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
      .eq('tenant_id', tenantId)
      .not('marital_status', 'is', null);

    // Filter by branch if specified
    if (selectedBranch !== 'all') {
      query = query.eq('branch_id', selectedBranch);
    } else if (selectedRegion !== 'all') {
      const { data: regionData } = await supabase
        .from('regions')
        .select('id')
        .eq('name', selectedRegion)
        .eq('tenant_id', tenantId)
        .single();

      if (regionData) {
        const { data: branchesInRegion } = await supabase
          .from('branches')
          .select('id')
          .eq('region_id', regionData.id)
          .eq('tenant_id', tenantId);

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
  const { tenant } = useTenant();
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

  // Fetch data with filters
  const fetchDataWithFilters = useCallback(async (filterParams, customDateRange = null) => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const distribution = await fetchMaritalStatusData(
        filterParams.dateRange,
        filterParams.region,
        filterParams.branch,
        customDateRange,
        tenant.id
      );
      setData(distribution);
    } catch (error) {
      console.error("Error fetching marital status data:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  // Fetch available regions and branches on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: regionsData, error: regionsError } = await supabase
          .from('regions')
          .select('id, name')
          .eq('tenant_id', tenant.id)
          .order('name');

        if (regionsError) throw regionsError;
        if (regionsData) {
          setAvailableRegions(regionsData);
        }

        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('id, name, code, region_id')
          .eq('tenant_id', tenant.id)
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

    if (tenant?.id) {
      fetchInitialData();
    }
  }, [tenant?.id, fetchDataWithFilters]);

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

  // Initial data fetch sync with filters
  useEffect(() => {
    if (tenant?.id) {
      fetchDataWithFilters(filters);
    }
  }, [fetchDataWithFilters]);

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

    // Don't refetch if we're setting custom dates (wait for apply)
    if (key === 'customStartDate' || key === 'customEndDate') {
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
      <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-white/40 min-w-[280px] relative z-[9999]">
        <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
          <div className="p-2 bg-pink-50 rounded-lg">
            <Heart className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Demographic Insights</p>
            <p className="font-black text-slate-800 text-base">{item.name}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-pink-50/50 rounded-2xl border border-pink-100">
            <p className="text-[9px] font-black text-pink-400 uppercase tracking-tighter mb-1">Customer Count</p>
            <p className="text-2xl font-black text-pink-700 tracking-tight">{item.value.toLocaleString()}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Distribution</p>
            <p className="text-sm font-black text-slate-700">{percentage}%</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 p-8 transition-all duration-300 hover:shadow-2xl h-full relative hover:z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg text-stone-600 whitespace-nowrap">Marital Status Breakdown</h3>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 text-stone-500 hover:text-stone-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-stone-200 hover:bg-stone-50"
          disabled={!data || data.length === 0}
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
      </div>

      <div className="mb-4 mt-2">
        <div className="flex flex-nowrap items-center gap-2 relative z-20 w-full overflow-hidden">
          {[
            {
              label: "Timeframe",
              icon: <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />,
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
              label: "Region",
              icon: <Globe className="w-3.5 h-3.5 text-stone-400 shrink-0" />,
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
              label: "Branch",
              icon: <Building className="w-3.5 h-3.5 text-stone-400 shrink-0" />,
              value: filters.branch,
              onChange: (e) => handleFilterChange('branch', e.target.value),
              options: [
                { value: "all", label: "All Branches" },
                ...filteredBranches.map(branch => ({
                  value: branch.id,
                  label: branch.name
                }))
              ]
            }
          ].map((item, idx) => (
            <div key={idx} className="flex-1 min-w-0 flex items-center h-8 gap-1.5 px-2 rounded-lg border border-stone-200 bg-transparent hover:border-stone-300 transition focus-within:ring-1 focus-within:ring-stone-400/20">
              {item.icon}
              <select
                value={item.value}
                onChange={item.onChange}
                disabled={loading}
                className="w-full bg-transparent text-[10px] font-bold text-stone-600 focus:outline-none cursor-pointer py-1 truncate"
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

        {showCustomDate && (
          <div className="mt-4 flex flex-wrap items-center gap-3 bg-stone-50/50 p-3 rounded-lg border border-stone-100">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <input
              type="date"
              value={filters.customStartDate}
              onChange={(e) => handleFilterChange('customStartDate', e.target.value)}
              className="h-8 px-2 text-xs font-bold rounded border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
            />
            <span className="text-stone-300">→</span>
            <input
              type="date"
              value={filters.customEndDate}
              onChange={(e) => handleLocalFilterChange('customEndDate', e.target.value)}
              className="h-8 px-2 text-xs font-bold rounded border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
            />
            <button
              onClick={applyCustomDateFilter}
              disabled={!filters.customStartDate || !filters.customEndDate}
              className="h-8 px-4 rounded text-xs font-bold text-white bg-stone-600 hover:bg-stone-700 transition-all disabled:opacity-50"
            >
              Update
            </button>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-80">
        {data && data.length > 0 ? (
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
                  label={({ name, value }) =>
                    `${name}: ${Math.round((value / total) * 100)}%`
                  }
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={10} fontWeight="bold" />
                <YAxis fontSize={10} fontWeight="bold" tickFormatter={(v) => v.toLocaleString()} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="value"
                  name="Count"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
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
