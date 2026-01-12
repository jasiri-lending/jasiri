import  { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Repeat, Download, Calendar, Globe, Building } from 'lucide-react';
import { supabase } from "../../../supabaseClient";

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
    <div 
      className="bg-[#E7F0FA] p-4 rounded-lg shadow-xl border border-gray-200"
      style={{ 
        zIndex: 10000,
        pointerEvents: 'none',
        minWidth: '240px',
        maxWidth: '300px'
      }}
    >
      <p className="font-bold text-slate-600 mb-3 text-sm">{data?.category}</p>
      <div className="space-y-2">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Customer Count:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS[6] }}>
            {data?.count?.toLocaleString()}
          </span>
        </div>
        
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Total Loan Amount:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS[7] }}>
            Ksh {data?.amount?.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};



// Helper function for date filtering (same as branch chart)
const getDateFilter = (dateRange, isThisPeriod = false) => {
  const now = new Date();
  const dateFilter = new Date();
  
  switch(dateRange) {
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
const fetchCustomerLoyaltyData = async (dateRange, selectedRegion, selectedBranch, customDateRange) => {
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
      .eq('status', 'disbursed');

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
        
        // Fetch initial customer loyalty data
        const loyaltyData = await fetchCustomerLoyaltyData('all', 'all', 'all', null);
        setLocalData(loyaltyData);
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };
    
    fetchInitialData();
  }, []);

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

  // Fetch data with filters
  const fetchDataWithFilters = useCallback(async (filters, customDateRange = null) => {
    try {
      const loyaltyData = await fetchCustomerLoyaltyData(
        filters.dateRange,
        filters.region,
        filters.branch,
        customDateRange
      );
      setLocalData(loyaltyData);
    } catch (error) {
      console.error("Error fetching customer loyalty data:", error);
      setLocalData([]);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchDataWithFilters(localFilters);
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
    <div className="bg-[#E7F0FA] rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header with title - matching old design */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Repeat className="w-6 h-6" style={{ color: HEADER_COLOR }} />
          <h3 className="text-lg font-semibold" style={{ color: HEADER_COLOR }}>
            Customer Loyalty Analysis
          </h3>
        </div>
        <div className="flex items-center gap-4">
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
     {/* Customer Loyalty Filters */}
<div className="mb-6">
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

    {/* Date Range */}
    <div className="flex items-center h-11 gap-3 px-3 rounded-lg border border-slate-200 bg-[#E7F0FA] hover:border-slate-300 transition">
      <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
      <select
        value={localFilters.dateRange}
        onChange={(e) =>
          handleLocalFilterChange('dateRange', e.target.value)
        }
        className="w-full bg-transparent text-sm font-normal leading-tight text-slate-800 focus:outline-none cursor-pointer py-0.5"
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
    <div className="flex items-center h-11 gap-3 px-3 rounded-lg border border-slate-200 bg-[#E7F0FA] hover:border-slate-300 transition">
      <Globe className="w-4 h-4 text-slate-500 shrink-0" />
      <select
        value={localFilters.region}
        onChange={(e) =>
          handleLocalFilterChange('region', e.target.value)
        }
        className="w-full bg-transparent text-sm font-normal leading-tight text-slate-800 focus:outline-none cursor-pointer py-0.5"
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
    <div className="flex items-center h-11 gap-3 px-3 rounded-lg border border-slate-200 bg-[#E7F0FA] hover:border-slate-300 transition">
      <Building className="w-4 h-4 text-slate-500 shrink-0" />
      <select
        value={localFilters.branch}
        onChange={(e) =>
          handleLocalFilterChange('branch', e.target.value)
        }
        className="w-full bg-transparent text-sm font-normal leading-tight text-slate-800 focus:outline-none cursor-pointer py-0.5"
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


      {/* Graph - matching old design */}
      <div className="h-80">
        {localData && localData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={localData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="count" name="Customer Count" fill={COLORS[6]} />
              <Bar dataKey="amount" name="Total Loan Amount" fill={COLORS[7]} />
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