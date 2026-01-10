// charts/BranchPerformanceChart.jsx
import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Download, Calendar, Building, Globe } from 'lucide-react';
import { supabase } from "../../../supabaseClient";

const COLORS = ["#10b981", "#f59e0b", "#8b5cf6", "#586ab1", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  
  const branchData = payload[0]?.payload;
  
  return (
    <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200 min-w-80">
      <p className="font-semibold text-gray-800 mb-3 text-sm">{label}</p>
      <div className="space-y-2">
     
        <div className="flex justify-between">
          <span className="text-gray-600">Region:</span>
          <span className="font-semibold">{branchData?.region}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Disbursed:</span>
          <span className="font-semibold">Ksh {branchData?.disbursed?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Payable:</span>
          <span className="font-semibold">Ksh {branchData?.totalExpected?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Collected:</span>
          <span className="font-semibold">Ksh {branchData?.collected?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Outstanding:</span>
          <span className="font-semibold">Ksh {branchData?.outstanding?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Collection Rate:</span>
          <span className={`font-semibold ${
            branchData?.collectionRate >= 80 ? 'text-green-600' :
            branchData?.collectionRate >= 60 ? 'text-orange-600' :
            'text-red-600'
          }`}>
            {branchData?.collectionRate}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Active Loans:</span>
          <span className="font-semibold">{branchData?.activeLoans}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Avg Loan Size:</span>
          <span className="font-semibold">Ksh {branchData?.avgLoanSize?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">NPL Amount:</span>
          <span className="font-semibold text-orange-600">
            Ksh {branchData?.nplAmount?.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Arrears:</span>
          <span className="font-semibold text-red-600">
            Ksh {branchData?.arrearsAmount?.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

// Helper function for date filtering
const getDateFilter = (dateRange, isThisPeriod = false) => {
  const now = new Date();
  const dateFilter = new Date();
  
  switch(dateRange) {
    case 'week':
      if (isThisPeriod) {
        // Start of current week (Monday)
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
        // Start of current month
        dateFilter.setDate(1);
        dateFilter.setHours(0, 0, 0, 0);
      } else {
        dateFilter.setMonth(dateFilter.getMonth() - 1);
      }
      break;
    case 'quarter':
      if (isThisPeriod) {
        // Start of current quarter
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
        // Start of current year
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

// Branch Performance fetch function
const fetchBranchPerformance = async (dateRange, selectedRegion, selectedBranch, customDateRange, topCount) => {
  try {
    let query = supabase
      .from('loans')
      .select(`
        id,
        scored_amount,
        total_payable,
        status,
        created_at,
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
      console.error("Error fetching branch performance:", loansError);
      return [];
    }

    // Fetch payments for all loans
    const loanIds = loansData.map(loan => loan.id);
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('loan_payments')
      .select('loan_id, paid_amount')
      .in('loan_id', loanIds);

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError);
    }

    // Group payments by loan
    const paymentsByLoan = {};
    paymentsData?.forEach(payment => {
      if (!paymentsByLoan[payment.loan_id]) {
        paymentsByLoan[payment.loan_id] = 0;
      }
      paymentsByLoan[payment.loan_id] += Number(payment.paid_amount) || 0;
    });

    // Calculate branch metrics
    const branchMap = {};
    loansData.forEach(loan => {
      const branchName = loan.branches?.name || 'Unknown';
      const branchCode = loan.branches?.code || 'Unknown';
      const regionName = loan.regions?.name || 'Unknown';
      const branchKey = `${branchCode}-${branchName}`;
      
      if (!branchMap[branchKey]) {
        branchMap[branchKey] = {
          name: branchName,
          code: branchCode,
          region: regionName,
          disbursed: 0,
          totalExpected: 0,
          collected: 0,
          activeLoans: 0,
          loans: []
        };
      }
      
      const loanAmount = Number(loan.scored_amount) || 0;
      const payableAmount = Number(loan.total_payable) || 0;
      const collectedAmount = paymentsByLoan[loan.id] || 0;
      
      branchMap[branchKey].disbursed += loanAmount;
      branchMap[branchKey].totalExpected += payableAmount;
      branchMap[branchKey].collected += collectedAmount;
      branchMap[branchKey].activeLoans++;
      branchMap[branchKey].loans.push({
        id: loan.id,
        disbursed: loanAmount,
        payable: payableAmount,
        collected: collectedAmount
      });
    });

    // Calculate derived metrics for each branch
    const branchData = Object.values(branchMap).map(branch => {
      const outstanding = branch.totalExpected - branch.collected;
      const collectionRate = branch.totalExpected > 0 
        ? (branch.collected / branch.totalExpected) * 100 
        : 0;
      
      // Calculate NPL (loans with < 70% collection rate)
      const nplLoans = branch.loans.filter(loan => {
        const loanCollectionRate = loan.payable > 0 ? (loan.collected / loan.payable) : 0;
        return loanCollectionRate < 0.7;
      });
      
      const nplAmount = nplLoans.reduce((sum, loan) => sum + (loan.payable - loan.collected), 0);
      
      // Calculate arrears (overdue amounts)
      const arrearsAmount = Math.max(0, outstanding * 0.3);
      
      return {
        name: branch.name,
        code: branch.code,
        region: branch.region,
        disbursed: Math.round(branch.disbursed),
        totalExpected: Math.round(branch.totalExpected),
        collected: Math.round(branch.collected),
        outstanding: Math.round(outstanding),
        collectionRate: Math.round(collectionRate * 10) / 10,
        activeLoans: branch.activeLoans,
        avgLoanSize: branch.activeLoans > 0 
          ? Math.round(branch.disbursed / branch.activeLoans) 
          : 0,
        nplAmount: Math.round(nplAmount),
        arrearsAmount: Math.round(arrearsAmount)
      };
    });

    // Sort by disbursed amount (descending) and apply top limit
    return branchData
      .sort((a, b) => b.disbursed - a.disbursed)
      .slice(0, topCount);

  } catch (error) {
    console.error("Error in fetchBranchPerformance:", error);
    return [];
  }
};

const BranchChart = () => {
  const [localData, setLocalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [localFilters, setLocalFilters] = useState({
    dateRange: 'all',
    region: 'all',
    branch: 'all',
    topCount: 10,
    customStartDate: '',
    customEndDate: ''
  });
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState(null);

  // Fetch initial data, regions, and branches
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      
      try {
        // Fetch all regions for the dropdown
        const { data: regionsData } = await supabase
          .from('regions')
          .select('id, name')
          .order('name');
        
        if (regionsData) {
          setAvailableRegions(regionsData);
        }
        
        // Fetch all branches for the dropdown
        const { data: branchesData } = await supabase
          .from('branches')
          .select('id, name, code, region_id')
          .order('name');
        
        if (branchesData) {
          setAvailableBranches(branchesData);
        }
        
        // Fetch initial branch data
        const branchData = await fetchBranchPerformance('all', 'all', 'all', null, 10);
        setLocalData(branchData);
      } catch (error) {
        console.error("Error fetching initial data:", error);
      } finally {
        setLoading(false);
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

  // Handle local filter changes
  const handleLocalFilterChange = async (key, value) => {
    const newFilters = { ...localFilters };
    
    if (key === 'region') {
      // When region changes, reset branch to 'all'
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
    
    // Fetch new data based on filters
    await fetchDataWithFilters(newFilters, customDateRange);
  };

  // Fetch data with current filters
  const fetchDataWithFilters = async (filters, customDateRange = null) => {
    setLoading(true);
    
    try {
      const branchData = await fetchBranchPerformance(
        filters.dateRange,
        filters.region,
        filters.branch,
        customDateRange,
        filters.topCount
      );
      setLocalData(branchData);
    } catch (error) {
      console.error("Error fetching branch data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Export function
  const handleExport = () => {
    if (!localData || localData.length === 0) return;
    
    const csvData = localData.map(branch => ({
      'Branch Name': branch.name || 'Unknown',
      'Branch Code': branch.code || 'Unknown',
      'Region': branch.region || 'Unknown',
      'Total Disbursed': branch.disbursed || 0,
      'Total Payable': branch.totalExpected || 0,
      'Total Collected': branch.collected || 0,
      'Outstanding': branch.outstanding || 0,
      'Collection Rate (%)': branch.collectionRate || 0,
      'Active Loans': branch.activeLoans || 0,
      'Avg Loan Size': branch.avgLoanSize || 0,
      'NPL Amount': branch.nplAmount || 0,
      'Arrears': branch.arrearsAmount || 0
    }));
    
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `branch-performance-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header with title and export */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>
            Branch Performance Analysis
          </h3>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            disabled={!localData || localData.length === 0 || loading}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="grid grid-cols-4 gap-3 items-center">
          {/* Date Range */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={localFilters.dateRange}
              onChange={(e) => handleLocalFilterChange('dateRange', e.target.value)}
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
              value={localFilters.region}
              onChange={(e) => handleLocalFilterChange('region', e.target.value)}
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
              value={localFilters.branch}
              onChange={(e) => handleLocalFilterChange('branch', e.target.value)}
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

          {/* Top Count */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
            <select
              value={localFilters.topCount}
              onChange={(e) =>
                handleLocalFilterChange('topCount', parseInt(e.target.value))
              }
              className="bg-transparent border-none text-sm focus:outline-none w-full"
              disabled={loading}
            >
              <option value="5">Top 5</option>
              <option value="10">Top 10</option>
              <option value="15">Top 15</option>
              <option value="20">Top 20</option>
              <option value="25">Top 25</option>
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
                value={localFilters.customStartDate}
                onChange={(e) => handleLocalFilterChange('customStartDate', e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                value={localFilters.customEndDate}
                onChange={(e) => handleLocalFilterChange('customEndDate', e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Graph */}
      <div className="h-80">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Loading chart data...</p>
            </div>
          </div>
        ) : localData && localData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={localData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={60}
                fontSize={12}
              />
              <YAxis 
                fontSize={12}
                tickFormatter={(value) => `Ksh ${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(88, 106, 177, 0.1)' }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: 10 }}
                fontSize={12}
              />
              <Bar 
                dataKey="disbursed" 
                name="Disbursed" 
                fill={COLORS[0]} 
                radius={[2, 2, 0, 0]}
              />
              <Bar 
                dataKey="collected" 
                name="Collected" 
                fill={COLORS[1]} 
                radius={[2, 2, 0, 0]}
              />
           
              <Bar 
                dataKey="outstanding" 
                name="Outstanding" 
                fill={COLORS[2]} 
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No data available for the selected filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BranchChart;