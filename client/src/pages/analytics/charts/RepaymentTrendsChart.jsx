import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Download, Calendar, Globe, Building, Filter } from 'lucide-react';
import { supabase } from "../../../supabaseClient";
import { useTenant } from "../../../hooks/useTenant";
import { HEADER_COLOR, COLORS } from '../shared/constants';

const CustomTooltip = ({ active, payload, dateRange }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;

  return (
    <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-white/40 min-w-[300px] relative z-[9999]">
      <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Repayment Trend</p>
          <p className="font-black text-slate-800 text-base">
            {dateRange === 'week' || dateRange === 'month'
              ? data?.period
              : dateRange === 'quarter'
                ? `Q${Math.ceil(new Date(data?.period + '-01').getMonth() / 3) + 1} - ${data?.period}`
                : data?.period}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter mb-1">Collection Amount</p>
          <p className="text-2xl font-black text-indigo-700 tracking-tight">Ksh {data?.amount?.toLocaleString()}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Transactions</p>
            <p className="text-sm font-black text-slate-700">{data?.count?.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Avg/Tx</p>
            <p className="text-sm font-black text-slate-700">Ksh {data?.count > 0 ? Math.round(data?.amount / data?.count).toLocaleString() : '0'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to generate periods based on date range
const generatePeriods = (dateRange, dataMinDate = null) => {
  const now = new Date();
  const periods = [];

  switch (dateRange) {
    case 'week': {
      // Get current week days (Monday to Sunday)
      const currentDay = now.getDay();
      const diff = currentDay === 0 ? -6 : 1 - currentDay; // Adjust to Monday
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);

      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const formattedDate = date.toISOString().split('T')[0];
        periods.push(formattedDate);
      }
      break;
    }

    case 'month': {
      // Get all days in current month
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const formattedDate = date.toISOString().split('T')[0];
        periods.push(formattedDate);
      }
      break;
    }

    case 'quarter': {
      // Get current quarter months (3 months)
      const currentMonth = now.getMonth();
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      const year = now.getFullYear();

      for (let i = 0; i < 3; i++) {
        const month = quarterStartMonth + i;
        const formattedMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
        periods.push(formattedMonth);
      }
      break;
    }

    case '6months': {
      // Get last 6 months including current month
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - i, 1);
        const formattedMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        periods.push(formattedMonth);
      }
      break;
    }

    case 'year': {
      // Get all months in current year
      const year = now.getFullYear();

      for (let i = 1; i <= 12; i++) {
        const formattedMonth = `${year}-${String(i).padStart(2, '0')}`;
        periods.push(formattedMonth);
      }
      break;
    }

    case 'all': {
      if (dataMinDate) {
        // Generate all months from the earliest data point to current month
        const startDate = new Date(dataMinDate);
        const endDate = new Date();

        let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

        while (current <= end) {
          const formattedMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
          periods.push(formattedMonth);
          current.setMonth(current.getMonth() + 1);
        }
      } else {
        // Fallback: Get last 12 months if no min date
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        for (let i = 11; i >= 0; i--) {
          const date = new Date(currentYear, currentMonth - i, 1);
          const formattedMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          periods.push(formattedMonth);
        }
      }
      break;
    }
  }

  return periods;
};

// Fetch repayment trends data
const fetchRepaymentTrendsData = async (dateRange, selectedRegion, selectedBranch, customDateRange, tenantId) => {
  try {
    let query = supabase
      .from('loan_payments')
      .select(`
        id,
        paid_amount,
        created_at,
        loan_id,
        loans!inner(
          branch_id,
          branches!inner(name, code, region_id),
          regions!inner(name)
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('loans.tenant_id', tenantId);

    // Filter by branch if specified
    if (selectedBranch !== 'all') {
      query = query.eq('loans.branch_id', selectedBranch);
    } else if (selectedRegion !== 'all') {
      // Filter by region if specified
      const { data: regionData } = await supabase
        .from('regions')
        .select('id')
        .eq('name', selectedRegion)
        .eq('tenant_id', tenantId)
        .single();

      if (regionData) {
        // Get all branches in this region
        const { data: branchesInRegion } = await supabase
          .from('branches')
          .select('id')
          .eq('region_id', regionData.id)
          .eq('tenant_id', tenantId);

        if (branchesInRegion?.length > 0) {
          const branchIds = branchesInRegion.map(b => b.id);
          query = query.in('loans.branch_id', branchIds);
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
    // For 'all' dateRange, we don't apply any date filter

    const { data: paymentsData, error: paymentsError } = await query;
    if (paymentsError) {
      console.error("Error fetching repayment trends data:", paymentsError);
      return [];
    }

    if (!paymentsData || paymentsData.length === 0) {
      return [];
    }

    // Find the minimum date for 'all' period generation
    let minDate = null;
    if (dateRange === 'all' && paymentsData.length > 0) {
      const dates = paymentsData.map(p => new Date(p.created_at));
      minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
    }

    // Generate periods based on date range
    const periods = generatePeriods(dateRange, minDate);

    // Initialize trends object with all periods
    const trends = {};
    periods.forEach(period => {
      trends[period] = {
        period,
        amount: 0,
        count: 0
      };
    });

    // Aggregate data by period
    paymentsData.forEach(payment => {
      const paymentDate = new Date(payment.created_at);
      const paidAmount = Number(payment.paid_amount) || 0;

      let period;
      if (dateRange === 'week' || dateRange === 'month') {
        // For daily view
        period = paymentDate.toISOString().split('T')[0];
      } else {
        // For monthly view
        period = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      }

      if (trends[period]) {
        trends[period].amount += paidAmount;
        trends[period].count++;
      }
    });

    // Convert to array and sort by period
    return Object.values(trends).sort((a, b) => {
      return new Date(a.period) - new Date(b.period);
    });

  } catch (error) {
    console.error("Error in fetchRepaymentTrendsData:", error);
    return [];
  }
};

// Helper function to get date range start
const getDateRangeStart = (dateRange) => {
  const now = new Date();
  const startDate = new Date();

  switch (dateRange) {
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
      return null;
  }

  startDate.setHours(0, 0, 0, 0);
  return startDate.toISOString();
};

const RepaymentTrendsChart = () => {
  const { tenant } = useTenant();
  const [localData, setLocalData] = useState([]);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [localFilters, setLocalFilters] = useState({
    dateRange: 'all', // Changed from 'week' to 'all' as default
    region: 'all',
    branch: 'all',
    customStartDate: '',
    customEndDate: '',
    chartType: 'area'
  });
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch data with filters
  const fetchDataWithFilters = useCallback(async (filters, customDateRange = null) => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const trendsData = await fetchRepaymentTrendsData(
        filters.dateRange,
        filters.region,
        filters.branch,
        customDateRange,
        tenant.id
      );
      setLocalData(trendsData);
    } catch (error) {
      console.error("Error fetching repayment trends data:", error);
      setLocalData([]);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  // Fetch available regions and branches on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch all regions
        const { data: regionsData, error: regionsError } = await supabase
          .from('regions')
          .select('id, name')
          .eq('tenant_id', tenant.id)
          .order('name');

        if (regionsError) throw regionsError;
        if (regionsData) {
          setAvailableRegions(regionsData);
        }

        // Fetch all branches
        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('id, name, code, region_id')
          .eq('tenant_id', tenant.id)
          .order('name');

        if (branchesError) throw branchesError;
        if (branchesData) {
          setAvailableBranches(branchesData);
        }

        // Fetch initial repayment trends data with 'all' as default
        await fetchDataWithFilters({
          dateRange: 'all',
          region: 'all',
          branch: 'all',
          chartType: 'area'
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
    if (localFilters.region === 'all') {
      setSelectedRegionId(null);
    } else {
      const region = availableRegions.find(r => r.name === localFilters.region);
      setSelectedRegionId(region?.id || null);
    }
  }, [localFilters.region, availableRegions]);

  const filteredBranches = localFilters.region === 'all'
    ? availableBranches
    : availableBranches.filter(branch => branch.region_id === selectedRegionId);

  // Initial data fetch sync with filters
  useEffect(() => {
    if (tenant?.id) {
      fetchDataWithFilters(localFilters);
    }
  }, [fetchDataWithFilters]);

  // Handle filter changes
  const handleLocalFilterChange = useCallback(async (key, value) => {
    const newFilters = { ...localFilters };

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

    setLocalFilters(newFilters);

    // Prepare custom date range if applicable
    let customDateRange = null;
    if (newFilters.dateRange === 'custom' && newFilters.customStartDate && newFilters.customEndDate) {
      customDateRange = {
        startDate: newFilters.customStartDate,
        endDate: newFilters.customEndDate
      };
    }

    fetchDataWithFilters(newFilters, customDateRange);
  }, [localFilters, availableRegions, fetchDataWithFilters]);

  // Apply custom date filter
  const applyCustomDateFilter = useCallback(async () => {
    if (localFilters.customStartDate && localFilters.customEndDate) {
      const customDateRange = {
        startDate: localFilters.customStartDate,
        endDate: localFilters.customEndDate
      };
      await fetchDataWithFilters({ ...localFilters, dateRange: 'custom' }, customDateRange);
    }
  }, [localFilters, fetchDataWithFilters]);

  // Export function
  const handleExport = useCallback(() => {
    if (!localData || localData.length === 0) return;

    const csvData = localData.map(item => ({
      'Period': item.period,
      'Collection Amount (Ksh)': item.amount || 0,
      'Transaction Count': item.count || 0,
      'Average per Transaction (Ksh)': item.count > 0 ? Math.round(item.amount / item.count) : 0
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repayment-trends-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [localData]);


  // Format X-axis tick based on date range
  const formatXAxisTick = (value) => {
    if (localFilters.dateRange === 'week' || localFilters.dateRange === 'month') {
      // For daily view, show day/month
      const date = new Date(value);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    } else {
      // For monthly view, show month name and year for all time data
      const date = new Date(value + '-01');
      if (localFilters.dateRange === 'all') {
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }
      return date.toLocaleDateString('en-US', { month: 'short' });
    }
  };

  // Format Y-axis tick
  const formatYAxisTick = (value) => {
    return value.toLocaleString();
  };

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 p-8 transition-all duration-300 hover:shadow-2xl relative hover:z-10">
      {/* Header with title and export */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg text-stone-600 whitespace-nowrap">Repayment Trends Analysis</h3>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-stone-200 hover:bg-stone-50"
            disabled={!localData || localData.length === 0}
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 mt-2">
        <div className="flex flex-nowrap items-center gap-2 relative z-20 w-full overflow-hidden">
          {[
            {
              label: "Timeframe",
              icon: <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />,
              value: localFilters.dateRange,
              onChange: (e) => handleLocalFilterChange('dateRange', e.target.value),
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
              value: localFilters.region,
              onChange: (e) => handleLocalFilterChange('region', e.target.value),
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
              value: localFilters.branch,
              onChange: (e) => handleLocalFilterChange('branch', e.target.value),
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
              value={localFilters.customStartDate}
              onChange={(e) => handleLocalFilterChange('customStartDate', e.target.value)}
              className="h-8 px-2 text-xs font-bold rounded border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
            />
            <span className="text-stone-300">→</span>
            <input
              type="date"
              value={localFilters.customEndDate}
              onChange={(e) => handleLocalFilterChange('customEndDate', e.target.value)}
              className="h-8 px-2 text-xs font-bold rounded border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
            />
            <button
              onClick={applyCustomDateFilter}
              disabled={!localFilters.customStartDate || !localFilters.customEndDate}
              className="h-8 px-4 rounded text-xs font-bold text-white bg-stone-600 hover:bg-stone-700 transition-all disabled:opacity-50"
            >
              Update
            </button>
          </div>
        )}
      </div>


      {/* Graph */}
      <div className="h-80">
        {localData && localData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {localFilters.chartType === 'area' ? (
              <AreaChart data={localData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="period"
                  tickFormatter={formatXAxisTick}
                />
                <YAxis
                  fontSize={10}
                  fontWeight="bold"
                  tickFormatter={formatYAxisTick}
                />
                <Tooltip content={<CustomTooltip dateRange={localFilters.dateRange} />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="amount"
                  name="Collection Amount"
                  stroke={HEADER_COLOR}
                  fill={HEADER_COLOR}
                  fillOpacity={0.3}
                />
              </AreaChart>
            ) : localFilters.chartType === 'line' ? (
              <AreaChart data={localData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="period"
                  tickFormatter={formatXAxisTick}
                />
                <YAxis
                  fontSize={10}
                  fontWeight="bold"
                  tickFormatter={formatYAxisTick}
                />
                <Tooltip content={<CustomTooltip dateRange={localFilters.dateRange} />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="amount"
                  name="Collection Amount"
                  stroke={HEADER_COLOR}
                  fill="transparent"
                  strokeWidth={2}
                />
              </AreaChart>
            ) : (
              <AreaChart data={localData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="period"
                  tickFormatter={formatXAxisTick}
                />
                <YAxis tickFormatter={formatYAxisTick} />
                <Tooltip content={<CustomTooltip dateRange={localFilters.dateRange} />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="amount"
                  name="Collection Amount"
                  stroke={HEADER_COLOR}
                  fill={HEADER_COLOR}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No repayment trends data available for the selected filters</p>
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

export default RepaymentTrendsChart;