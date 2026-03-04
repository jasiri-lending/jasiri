import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Repeat, Download, Calendar, Globe, Building } from 'lucide-react';
import { supabase } from "../../../supabaseClient";
import { useTenant } from "../../../hooks/useTenant";

// Use existing COLORS from shared constants
const COLORS = [
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#586ab1", // Blue Gray
  "#ef4444", // Red
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#84cc16", // Lime
  "#f97316", // Orange
  "#6366f1", // Indigo
  "#14b8a6", // Teal
  "#8b5cf6"  // Purple
];

const CHART_BG = '#d9e2e8';
const HEADER_COLOR = '#586ab1';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;

  return (
    <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-white/40 min-w-[300px] relative z-[9999]">
      <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Repeat className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Loyalty</p>
          <p className="font-black text-slate-800 text-base">{data?.category}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter mb-1">Total Loan Amount</p>
          <p className="text-2xl font-black text-indigo-700 tracking-tight">Ksh {data?.amount?.toLocaleString()}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Customers</p>
            <p className="text-sm font-black text-slate-700">{data?.count?.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Share</p>
            <p className="text-sm font-black text-slate-700">{data?.percentage}%</p>
          </div>
        </div>
      </div>
    </div>
  );
};



// Helper function for date filtering (same as branch chart)
const getDateFilter = (dateRange, isThisPeriod = false) => {
  const now = new Date();
  const dateFilter = new Date();

  switch (dateRange) {
    case 'week':
      if (isThisPeriod) {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        dateFilter.setDate(diff);
        dateFilter.setHours(0, 0, 0, 0);
      } else {
        dateFilter.setDate(dateFilter.getDate() - 7);
      }
      break;
    case 'month':
      if (isThisPeriod) {
        dateFilter.setDate(1);
        dateFilter.setHours(0, 0, 0, 0);
      } else {
        dateFilter.setMonth(dateFilter.getMonth() - 1);
      }
      break;
    case 'quarter':
      if (isThisPeriod) {
        const quarter = Math.floor(now.getMonth() / 3);
        dateFilter.setMonth(quarter * 3, 1);
        dateFilter.setHours(0, 0, 0, 0);
      } else {
        dateFilter.setMonth(now.getMonth() - 3);
      }
      break;
    case '6months':
      dateFilter.setMonth(now.getMonth() - 6);
      break;
    case 'year':
      if (isThisPeriod) {
        dateFilter.setFullYear(now.getFullYear(), 0, 1);
        dateFilter.setHours(0, 0, 0, 0);
      } else {
        dateFilter.setFullYear(now.getFullYear() - 1);
      }
      break;
    default:
      return null;
  }

  return dateFilter.toISOString();
};

// Enhanced fetch function with correct loyalty categories
const fetchCustomerLoyaltyData = async (dateRange, selectedRegion, selectedBranch, customDateRange, tenantId) => {
  try {
    let query = supabase
      .from('loans')
      .select(`
        id,
        customer_id,
        scored_amount,
        status,
        created_at,
        disbursed_at,
        branch_id,
        branches!inner(name, code, region_id),
        regions!inner(name)
      `)
      .eq('status', 'disbursed')
      .eq('tenant_id', tenantId);

    // Filter by branch if specified
    if (selectedBranch !== 'all') {
      query = query.eq('branch_id', selectedBranch);
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
      const dateFilter = getDateFilter(dateRange, true);
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }
    }

    const { data: loansData, error: loansError } = await query;
    if (loansError) {
      console.error("Error fetching customer loyalty data:", loansError);
      return [];
    }

    if (!loansData || loansData.length === 0) {
      return [];
    }

    // Group loans by customer and categorize by loan count
    const customerLoans = {};
    loansData.forEach(loan => {
      const customerId = loan.customer_id;
      if (!customerLoans[customerId]) {
        customerLoans[customerId] = {
          loanCount: 0,
          totalAmount: 0,
          loans: []
        };
      }

      customerLoans[customerId].loanCount++;
      customerLoans[customerId].totalAmount += Number(loan.scored_amount) || 0;
      customerLoans[customerId].loans.push(loan);
    });

    // Categorize customers by loan count
    const categories = {
      'First Time (1 loan)': { count: 0, amount: 0 },
      'Repeat (2-4 loans)': { count: 0, amount: 0 },
      'Frequent (5-8 loans)': { count: 0, amount: 0 },
      'Super (8+ loans)': { count: 0, amount: 0 }
    };

    Object.values(customerLoans).forEach(customer => {
      if (customer.loanCount === 1) {
        categories['First Time (1 loan)'].count++;
        categories['First Time (1 loan)'].amount += customer.totalAmount;
      } else if (customer.loanCount >= 2 && customer.loanCount <= 4) {
        categories['Repeat (2-4 loans)'].count++;
        categories['Repeat (2-4 loans)'].amount += customer.totalAmount;
      } else if (customer.loanCount >= 5 && customer.loanCount <= 8) {
        categories['Frequent (5-8 loans)'].count++;
        categories['Frequent (5-8 loans)'].amount += customer.totalAmount;
      } else if (customer.loanCount > 8) {
        categories['Super (8+ loans)'].count++;
        categories['Super (8+ loans)'].amount += customer.totalAmount;
      }
    });

    const totalCount = Object.values(categories).reduce((sum, cat) => sum + cat.count, 0);
    const totalAmount = Object.values(categories).reduce((sum, cat) => sum + cat.amount, 0);

    // Format data for chart
    return Object.entries(categories).map(([category, data], index) => ({
      category,
      count: data.count,
      amount: Math.round(data.amount),
      percentage: totalCount > 0 ? Math.round((data.count / totalCount) * 100) : 0,
      amountPercentage: totalAmount > 0 ? Math.round((data.amount / totalAmount) * 100) : 0,
      color: COLORS[index % COLORS.length]
    })).filter(item => item.count > 0);

  } catch (error) {
    console.error("Error in fetchCustomerLoyaltyData:", error);
    return [];
  }
};

const CustomerLoyaltyChart = () => {
  const { tenant } = useTenant();
  const [localData, setLocalData] = useState([]);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [localFilters, setLocalFilters] = useState({
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
  const fetchDataWithFilters = useCallback(async (filters, customDateRange = null) => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const loyaltyData = await fetchCustomerLoyaltyData(
        filters.dateRange,
        filters.region,
        filters.branch,
        customDateRange,
        tenant.id
      );
      setLocalData(loyaltyData);
    } catch (error) {
      console.error("Error fetching customer loyalty data:", error);
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

        // Fetch initial customer loyalty data
        await fetchDataWithFilters({
          dateRange: 'all',
          region: 'all',
          branch: 'all'
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
      'Customer Category': item.category || 'Unknown',
      'Customer Count': item.count || 0,
      'Total Loan Amount': item.amount || 0,
      'Percentage of Customers (%)': item.percentage || 0,
      'Percentage of Total Amount (%)': item.amountPercentage || 0,
      'Average Loan Size': item.count > 0 ? Math.round(item.amount / item.count) : 0
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-loyalty-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [localData]);

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 p-8 transition-all duration-300 hover:shadow-2xl h-full relative hover:z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg text-stone-600 whitespace-nowrap">Customer Retention Analysis</h3>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 text-stone-500 hover:text-stone-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-stone-200 hover:bg-stone-50"
          disabled={!localData || localData.length === 0}
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
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


      {/* Graph - matching old design */}
      <div className="h-80">
        {localData && localData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={localData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="category" />
              <YAxis
                fontSize={10}
                fontWeight="bold"
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="count" name="Customer Count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="amount" name="Total Loan Amount" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Repeat className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No customer loyalty data available for the selected filters</p>
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

export default CustomerLoyaltyChart;
