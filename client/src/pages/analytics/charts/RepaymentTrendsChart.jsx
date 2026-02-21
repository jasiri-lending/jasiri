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
    <div
      className="bg-[#E7F0FA] p-4 rounded-lg shadow-xl border border-gray-200"
      style={{
        zIndex: 10000,
        pointerEvents: 'none',
        minWidth: '240px',
        maxWidth: '300px'
      }}
    >
      <p className="font-bold text-slate-600 mb-3 text-sm">
        {dateRange === 'week' || dateRange === 'month'
          ? data?.period
          : dateRange === 'quarter'
            ? `Q${Math.ceil(new Date(data?.period + '-01').getMonth() / 3) + 1} - ${data?.period}`
            : data?.period}
      </p>
      <div className="space-y-2">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Collection Amount:</span>
          <span className="font-semibold text-xs" style={{ color: HEADER_COLOR }}>
            Ksh {data?.amount?.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Transaction Count:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS[1] }}>
            {data?.count?.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Average per Transaction:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS[2] }}>
            Ksh {data?.count > 0 ? Math.round(data?.amount / data?.count).toLocaleString() : '0'}
          </span>
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

  // Fetch data with filters
  const fetchDataWithFilters = useCallback(async (filters, customDateRange = null) => {
    if (!tenant?.id) return;
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
    if (value >= 1000000) return `Ksh ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `Ksh ${(value / 1000).toFixed(0)}k`;
    return `Ksh ${value}`;
  };

  return (
    <div className="bg-[#E7F0FA] rounded-xl shadow-sm border border-gray-200 p-6 h-full">
      {/* Header with title and filters */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6" style={{ color: HEADER_COLOR }} />
          <h3 className="text-lg font-semibold" style={{ color: HEADER_COLOR }}>Repayment Trends</h3>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2  text-green-700 hover:bg-green-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            disabled={!localData || localData.length === 0}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

          {[
            {
              icon: <Calendar className="w-4 h-4 text-slate-500 shrink-0" />,
              value: localFilters.dateRange,
              onChange: (e) =>
                handleLocalFilterChange('dateRange', e.target.value),
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
              value: localFilters.region,
              onChange: (e) =>
                handleLocalFilterChange('region', e.target.value),
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
              value: localFilters.branch,
              onChange: (e) =>
                handleLocalFilterChange('branch', e.target.value),
              options: [
                { value: "all", label: "All Branches" },
                ...filteredBranches.map(branch => ({
                  value: branch.id,
                  label: branch.name
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
              value={localFilters.customStartDate}
              onChange={(e) =>
                handleLocalFilterChange('customStartDate', e.target.value)
              }
              className="h-9 px-3 text-sm rounded-lg border bg-[#E7F0FA] focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            <span className="text-slate-500 text-sm">to</span>

            <input
              type="date"
              value={localFilters.customEndDate}
              onChange={(e) =>
                handleLocalFilterChange('customEndDate', e.target.value)
              }
              className="h-9 px-3 text-sm rounded-lg border bg-[#E7F0FA] focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            <button
              onClick={applyCustomDateFilter}
              disabled={!localFilters.customStartDate || !localFilters.customEndDate}
              className="h-8 px-3 rounded-md text-xs font-medium text-white bg-[#586ab1] hover:bg-[#4b5aa6] disabled:opacity-50"
            >
              Apply
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
                <YAxis tickFormatter={formatYAxisTick} />
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
                <YAxis tickFormatter={formatYAxisTick} />
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