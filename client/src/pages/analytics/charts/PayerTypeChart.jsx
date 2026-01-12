import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Shield,  Calendar, Globe, Building, Download } from 'lucide-react';
import { supabase } from "../../../supabaseClient";
import { HEADER_COLOR, COLORS } from '../shared/constants';
import { formatCurrencyCompact } from '../shared/Format.js';

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

// Fetch payer type analysis with filters
const fetchPayerTypeAnalysis = async (dateRange, selectedRegion, selectedBranch, customDateRange) => {
  try {
    let query = supabase
      .from('loan_payments')
      .select(`
        paid_amount,
        payer_type,
        paid_at,
        loan_id,
        loans!inner(
          branch_id,
          region_id,
          created_at,
          branches!inner(name, code, region_id),
          regions!inner(name)
        )
      `)
      .not('payer_type', 'is', null);

    // Filter by branch if specified
    if (selectedBranch !== 'all') {
      query = query.eq('loans.branch_id', selectedBranch);
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
          query = query.in('loans.branch_id', branchIds);
        }
      }
    }

    // Handle date filtering
    if (customDateRange?.startDate && customDateRange?.endDate) {
      query = query
        .gte('paid_at', customDateRange.startDate)
        .lte('paid_at', customDateRange.endDate);
    } else if (dateRange !== 'all') {
      const startDate = getDateRangeStart(dateRange);
      if (startDate) {
        query = query.gte('paid_at', startDate);
      }
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching payer type analysis:", error);
      return {
        payerTypeBreakdown: [],
        payerTypePieData: []
      };
    }

    if (!data || data.length === 0) {
      return {
        payerTypeBreakdown: [],
        payerTypePieData: []
      };
    }

    const payerTypeTotals = {
      'customer': { amount: 0, count: 0, name: 'Customer' },
      'guarantor': { amount: 0, count: 0, name: 'Guarantor' },
      'next-of-kin': { amount: 0, count: 0, name: 'Next of Kin' },
      'third-party': { amount: 0, count: 0, name: 'Third Party' },
      'other': { amount: 0, count: 0, name: 'Other' }
    };

    data.forEach(payment => {
      const payerType = payment.payer_type?.toLowerCase() || 'other';
      const amount = Number(payment.paid_amount) || 0;
      
      if (payerTypeTotals[payerType]) {
        payerTypeTotals[payerType].amount += amount;
        payerTypeTotals[payerType].count++;
      } else {
        payerTypeTotals['other'].amount += amount;
        payerTypeTotals['other'].count++;
      }
    });

    const totalAmount = Object.values(payerTypeTotals).reduce((sum, type) => sum + type.amount, 0);
    const totalCount = Object.values(payerTypeTotals).reduce((sum, type) => sum + type.count, 0);

    // Bar chart data
    const payerTypeBreakdown = Object.entries(payerTypeTotals)
      .map(([key, value]) => ({
        type: value.name,
        amount: value.amount,
        count: value.count,
        percentage: totalAmount > 0 ? Math.round((value.amount / totalAmount) * 100) : 0,
        paymentPercentage: totalCount > 0 ? Math.round((value.count / totalCount) * 100) : 0
      }))
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    // Pie chart data
    const pieColors = [
      "#10b981", "#f59e0b", "#8b5cf6", "#586ab1", "#ef4444"
    ];
    
    const payerTypePieData = Object.entries(payerTypeTotals)
      .filter(([key, value]) => value.amount > 0)
      .map(([key, value], index) => ({
        name: value.name,
        value: value.amount,
        count: value.count,
        percentage: totalAmount > 0 ? Math.round((value.amount / totalAmount) * 100) : 0,
        color: pieColors[index % pieColors.length]
      }))
      .sort((a, b) => b.value - a.value);

    return {
      payerTypeBreakdown,
      payerTypePieData
    };

  } catch (error) {
    console.error("Error in fetchPayerTypeAnalysis:", error);
    return {
      payerTypeBreakdown: [],
      payerTypePieData: []
    };
  }
};

const PayerTypeChart = () => {
  const [barData, setBarData] = useState([]);
  const [pieData, setPieData] = useState([]);
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
      const result = await fetchPayerTypeAnalysis(
        filterParams.dateRange,
        filterParams.region,
        filterParams.branch,
        customDateRange
      );
      setBarData(result.payerTypeBreakdown);
      setPieData(result.payerTypePieData);
    } catch (error) {
      console.error("Error fetching payer type data:", error);
      setBarData([]);
      setPieData([]);
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
    if (!barData || barData.length === 0) return;
    
    const csvData = barData.map(item => ({
      'Payer Type': item.type,
      'Amount Paid': item.amount || 0,
      'Payment Count': item.count || 0,
      'Percentage': item.percentage || 0
    }));
    
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payer-type-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [barData]);


  return (
    <div className="bg-[#E7F0FA] rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6" style={{ color: HEADER_COLOR }} />
          <h3 className="text-lg font-semibold" style={{ color: HEADER_COLOR }}>
            Payer Type Analysis
          </h3>
        </div>
        <div className="flex items-center gap-3">
        
          <button
            onClick={handleExport}
            className="flex items-center gap-2  text-green-700 hover:bg-green-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            disabled={!barData || barData.length === 0}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
    {/* Filters */}
<div className="mb-6">
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

    {[
      {
        icon: <Calendar className="w-4 h-4 text-slate-500 shrink-0" />,
        value: filters.dateRange,
        onChange: (e) =>
          handleFilterChange('dateRange', e.target.value),
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
        onChange: (e) =>
          handleFilterChange('region', e.target.value),
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
        onChange: (e) =>
          handleFilterChange('branch', e.target.value),
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
        onChange={(e) =>
          handleFilterChange('customStartDate', e.target.value)
        }
        disabled={loading}
        className="h-9 px-3 text-sm rounded-lg border bg-[#E7F0FA] focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />

      <span className="text-slate-500 text-sm">to</span>

      <input
        type="date"
        value={filters.customEndDate}
        onChange={(e) =>
          handleFilterChange('customEndDate', e.target.value)
        }
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


      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-500">Loading payer type data...</p>
          </div>
        </div>
      ) : barData && barData.length > 0 ? (
        <>
          {/* Bar Chart */}
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="amount" name="Amount Paid" fill={HEADER_COLOR} radius={[4, 4, 0, 0]} />
                <Bar dataKey="count" name="Payment Count" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Pie Chart */}
          <div className="mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-4 text-center">
                Payment Distribution by Payer Type
              </h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#E7F0FA] p-4 border border-gray-200 rounded-lg shadow-lg">
                              <p className="font-semibold text-gray-900">{data.name}</p>
                              <p className="text-sm text-gray-600">
                                Amount: {formatCurrencyCompact(data.value)}
                              </p>
                              <p className="text-sm text-gray-600">
                                Payments: {data.count} transactions
                              </p>
                              <p className="text-sm text-gray-600">
                                Share: {data.percentage}%
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
        
        </>
      ) : (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No payer type data available</p>
            <p className="text-gray-400 text-sm mt-1">
              Try adjusting your filters or date range
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayerTypeChart;