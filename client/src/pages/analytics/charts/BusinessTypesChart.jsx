import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Briefcase, Calendar, Globe, Building, Download } from 'lucide-react';
import { supabase } from "../../../supabaseClient";
import { useTenant } from "../../../hooks/useTenant";
import { HEADER_COLOR, COLORS } from '../shared/constants';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;

  return (
    <div className="bg-[#E7F0FA] p-4 rounded-lg shadow-xl border border-gray-200">
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

const fetchBusinessTypesData = async (dateRange, selectedRegion, selectedBranch, customDateRange, showTopTen, tenantId) => {
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
      .eq('tenant_id', tenantId)
      .not('customers.business_type', 'is', null);

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

    const businessMap = {};
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

    let result = Object.values(businessMap);
    result.sort((a, b) => b.count - a.count);

    if (showTopTen && result.length > 10) {
      result = result.slice(0, 10);
    }

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
  const [showTopTen, setShowTopTen] = useState(true);

  const fetchDataWithFilters = useCallback(async (filterParams, customDateRange = null, topTen = true) => {
    if (!tenant?.id) return;
    try {
      const businessData = await fetchBusinessTypesData(
        filterParams.dateRange,
        filterParams.region,
        filterParams.branch,
        customDateRange,
        topTen,
        tenant.id
      );
      setData(businessData);
    } catch (error) {
      console.error("Error fetching business types data:", error);
      setData([]);
    }
  }, [tenant?.id]);

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
          branch: 'all'
        }, null, showTopTen);
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };

    if (tenant?.id) {
      fetchInitialData();
    }
  }, [tenant?.id, fetchDataWithFilters, showTopTen]);

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

    fetchDataWithFilters(newFilters, customDateRange, showTopTen);
  }, [filters, availableRegions, fetchDataWithFilters, showTopTen]);

  const handleTopTenToggle = useCallback(() => {
    const newShowTopTen = !showTopTen;
    setShowTopTen(newShowTopTen);
    fetchDataWithFilters(filters, null, newShowTopTen);
  }, [showTopTen, filters, fetchDataWithFilters]);

  const applyCustomDateFilter = useCallback(async () => {
    if (filters.customStartDate && filters.customEndDate) {
      const customDateRange = {
        startDate: filters.customStartDate,
        endDate: filters.customEndDate
      };
      await fetchDataWithFilters({ ...filters, dateRange: 'custom' }, customDateRange, showTopTen);
    }
  }, [filters, fetchDataWithFilters, showTopTen]);

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
    <div className="bg-[#E7F0FA] rounded-xl shadow-sm border border-gray-200 p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6" style={{ color: HEADER_COLOR }} />
          <h3 className="text-lg font-semibold" style={{ color: HEADER_COLOR }}>Business Types Analysis</h3>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 text-green-700 hover:bg-green-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            disabled={!data || data.length === 0}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
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

          <div className="flex items-center justify-end">
            <span className="text-sm text-gray-600 mr-2">{showTopTen ? 'Top 10' : 'All'}</span>
            <button
              onClick={handleTopTenToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showTopTen ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showTopTen ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {showCustomDate && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Calendar className="w-4 h-4 text-slate-500" />

            <input
              type="date"
              value={filters.customStartDate}
              onChange={(e) => handleFilterChange('customStartDate', e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border bg-[#E7F0FA] focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            <span className="text-slate-500 text-sm">to</span>

            <input
              type="date"
              value={filters.customEndDate}
              onChange={(e) => handleFilterChange('customEndDate', e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border bg-[#E7F0FA] focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            <button
              onClick={applyCustomDateFilter}
              disabled={!filters.customStartDate || !filters.customEndDate}
              className="h-8 px-3 rounded-md text-xs font-medium text-white bg-[#586ab1] hover:bg-[#4b5aa6] disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      <div className="h-80">
        {data && data.length > 0 ? (
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
    </div>
  );

};

export default BusinessTypesChart;