import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { UserCog, Calendar, Globe, Building, Download } from 'lucide-react';
import { supabase } from "../../../supabaseClient";
import { HEADER_COLOR, COLORS } from '../shared/constants';
import { useTenant } from "../../../hooks/useTenant";


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

// Fetch customer distribution by county with filters
const fetchCustomerDistribution = async (dateRange, selectedRegion, selectedBranch, customDateRange, tenantId) => {
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
      .eq('tenant_id', tenantId)
      .not('county', 'is', null);

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
        name: county,
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
  const { tenant } = useTenant();
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

  // Fetch data with filters
  const fetchDataWithFilters = useCallback(async (filterParams, customDateRange = null) => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const distributionData = await fetchCustomerDistribution(
        filterParams.dateRange,
        filterParams.region,
        filterParams.branch,
        customDateRange,
        tenant.id
      );
      setData(distributionData);
    } catch (error) {
      console.error("Error fetching customer distribution:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  // Fetch available regions and branches on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!tenant?.id) return;
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
          branch: 'all'
        });
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };

    fetchInitialData();
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



  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;

    const item = payload[0].payload;

    return (
      <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-white/40 min-w-[280px] relative z-[9999]">
        <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Globe className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Regional Reach</p>
            <p className="font-black text-slate-800 text-base">{item.county}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter mb-1">Customer Count</p>
            <p className="text-2xl font-black text-indigo-700 tracking-tight">{item.customers.toLocaleString()}</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Market Share</p>
            <p className="text-sm font-black text-slate-700">{item.percentage}%</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 p-8 transition-all duration-300 hover:shadow-2xl relative hover:z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg text-stone-600 whitespace-nowrap">Customer Distribution by County</h3>

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
              onChange={(e) => handleFilterChange('customEndDate', e.target.value)}
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
                nameKey="name"
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
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <UserCog className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                No customer distribution data available
              </p>
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

export default CountyChart;