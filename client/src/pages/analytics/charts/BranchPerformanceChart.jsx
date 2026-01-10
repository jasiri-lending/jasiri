// charts/BranchPerformanceChart.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Download, Calendar, Building, Globe } from 'lucide-react';
import { supabase } from "../../../supabaseClient";

// Define colors for each metric
const COLORS = {
  totalDisbursed: "#10b981",      // Green
  totalPayable: "#586ab1",        // Blue
  totalCollected: "#f59e0b",      // Amber
  totalOutstanding: "#8b5cf6",    // Purple
  nplAmount: "#f97316",           // Orange
  arrearsAmount: "#ef4444"        // Red
};

const METRIC_LABELS = {
  totalDisbursed: "Total Disbursed",
  totalPayable: "Total Payable",
  totalCollected: "Total Collected",
  totalOutstanding: "Outstanding",
  nplAmount: "NPL Amount",
  arrearsAmount: "Arrears"
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  
  const branchData = payload[0]?.payload;
  
  return (
    <div 
      className="bg-white p-4 rounded-lg shadow-xl border border-gray-200"
      style={{ 
        zIndex: 10000,
        pointerEvents: 'none',
        minWidth: '280px',
        maxWidth: '320px'
      }}
    >
      <p className="font-bold text-slate-600 mb-3 text-sm">Branch: {branchData?.name} </p>
      <div className="space-y-2">
        {/* Region */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Region:</span>
          <span className="text-slate-600 font-bold text-xs">{branchData?.region}</span>
        </div>
        
        {/* Total Disbursed - Green */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Total Disbursed:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS.totalDisbursed }}>
            Ksh {branchData?.totalDisbursed?.toLocaleString()}
          </span>
        </div>
        
        {/* Total Payable - Blue */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Total Payable:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS.totalPayable }}>
            Ksh {branchData?.totalPayable?.toLocaleString()}
          </span>
        </div>
        
        {/* Total Collected - Amber */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Total Collected:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS.totalCollected }}>
            Ksh {branchData?.totalCollected?.toLocaleString()}
          </span>
        </div>
        
        {/* Outstanding - Purple */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Outstanding:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS.totalOutstanding }}>
            Ksh {branchData?.totalOutstanding?.toLocaleString()}
          </span>
        </div>
        
        {/* Collection Rate - Conditional */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Collection Rate:</span>
          <span className={`font-semibold text-xs ${
            branchData?.collectionRate >= 80 ? 'text-green-600' :
            branchData?.collectionRate >= 60 ? 'text-orange-600' :
            'text-red-600'
          }`}>
            {branchData?.collectionRate}%
          </span>
        </div>
        
        {/* Loan Count - Default */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Loan Count:</span>
          <span className="text-slate-600 font-bold text-xs">{branchData?.loanCount}</span>
        </div>
        
        {/* Avg Loan Size - Default */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Avg Loan Size:</span>
          <span className="text-slate-600 font-bold text-xs">Ksh {branchData?.avgLoanSize?.toLocaleString()}</span>
        </div>
        
        {/* NPL Amount - Orange */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">NPL Amount:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS.nplAmount }}>
            Ksh {branchData?.nplAmount?.toLocaleString()}
          </span>
        </div>
        
        {/* Arrears - Red */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Arrears:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS.arrearsAmount }}>
            Ksh {branchData?.arrearsAmount?.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

// Get today's date for arrears calculation
const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper function for date filtering
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

// Optimized fetch function with proper arrears calculation
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
      console.error("Error fetching branch performance:", loansError);
      return [];
    }

    if (!loansData || loansData.length === 0) {
      return [];
    }

    const loanIds = loansData.map(loan => loan.id);
    
    // Fetch payments
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('loan_payments')
      .select('loan_id, paid_amount')
      .in('loan_id', loanIds);

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError);
    }

    // Fetch installments for arrears and NPL calculation
    const { data: installmentsData, error: installmentsError } = await supabase
      .from('loan_installments')
      .select('loan_id, due_date, due_amount, interest_paid, principal_paid, status')
      .in('loan_id', loanIds);

    if (installmentsError) {
      console.error("Error fetching installments:", installmentsError);
    }

    const paymentsByLoan = {};
    paymentsData?.forEach(payment => {
      if (!paymentsByLoan[payment.loan_id]) {
        paymentsByLoan[payment.loan_id] = 0;
      }
      paymentsByLoan[payment.loan_id] += Number(payment.paid_amount) || 0;
    });

    // Calculate arrears and NPL per loan
    const today = getTodayDate();
    const arrearsPerLoan = {};
    const nplLoans = new Set();

    installmentsData?.forEach(inst => {
      if (inst.due_date && inst.due_date <= today && ['overdue', 'partial'].includes(inst.status)) {
        const dueAmount = Number(inst.due_amount) || 0;
        const paidAmount = (Number(inst.interest_paid) || 0) + (Number(inst.principal_paid) || 0);
        const arrears = dueAmount - paidAmount;
        
        if (arrears > 0) {
          if (!arrearsPerLoan[inst.loan_id]) {
            arrearsPerLoan[inst.loan_id] = 0;
          }
          arrearsPerLoan[inst.loan_id] += arrears;
          
          // Check if loan is NPL (overdue for 90+ days)
          const dueDate = new Date(inst.due_date);
          const todayDate = new Date(today);
          const daysDiff = Math.floor((todayDate - dueDate) / (1000 * 60 * 60 * 24));
          
          if (daysDiff >= 90) {
            nplLoans.add(inst.loan_id);
          }
        }
      }
    });

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
          totalDisbursed: 0,
          totalPayable: 0,
          totalCollected: 0,
          totalArrears: 0,
          nplAmount: 0,
          nplCount: 0,
          loanCount: 0
        };
      }
      
      const loanAmount = Number(loan.scored_amount) || 0;
      const payableAmount = Number(loan.total_payable) || 0;
      const collectedAmount = paymentsByLoan[loan.id] || 0;
      const loanArrears = arrearsPerLoan[loan.id] || 0;
      
      branchMap[branchKey].totalDisbursed += loanAmount;
      branchMap[branchKey].totalPayable += payableAmount;
      branchMap[branchKey].totalCollected += collectedAmount;
      branchMap[branchKey].totalArrears += loanArrears;
      branchMap[branchKey].loanCount++;
      
      // Add to NPL if loan is past 90 days
      if (nplLoans.has(loan.id)) {
        branchMap[branchKey].nplAmount += (payableAmount - collectedAmount);
        branchMap[branchKey].nplCount++;
      }
    });

    // Process and format the data
    const branchData = Object.values(branchMap).map(branch => {
      const totalOutstanding = branch.totalPayable - branch.totalCollected;
      const collectionRate = branch.totalPayable > 0 
        ? (branch.totalCollected / branch.totalPayable) * 100 
        : 0;
      
      const nplRate = branch.totalPayable > 0 
        ? (branch.nplAmount / branch.totalPayable) * 100 
        : 0;
      
      const arrearsRate = totalOutstanding > 0 
        ? (branch.totalArrears / totalOutstanding) * 100 
        : 0;
      
      return {
        name: branch.name,
        code: branch.code,
        region: branch.region,
        totalDisbursed: Math.round(branch.totalDisbursed),
        totalPayable: Math.round(branch.totalPayable),
        totalCollected: Math.round(branch.totalCollected),
        totalOutstanding: Math.round(totalOutstanding),
        collectionRate: Math.round(collectionRate * 10) / 10,
        nplAmount: Math.round(branch.nplAmount),
        nplRate: Math.round(nplRate * 10) / 10,
        nplCount: branch.nplCount,
        arrearsAmount: Math.round(branch.totalArrears),
        arrearsRate: Math.round(arrearsRate * 10) / 10,
        loanCount: branch.loanCount,
        avgLoanSize: branch.loanCount > 0 
          ? Math.round(branch.totalDisbursed / branch.loanCount) 
          : 0
      };
    });

    // Sort by disbursed amount (descending) and apply top limit
    return branchData
      .sort((a, b) => b.totalDisbursed - a.totalDisbursed)
      .slice(0, topCount);

  } catch (error) {
    console.error("Error in fetchBranchPerformance:", error);
    return [];
  }
};

const BranchChart = () => {
  const [localData, setLocalData] = useState([]);
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

  // Fetch available regions and branches on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      // Fetch all regions
      const { data: regionsData } = await supabase
        .from('regions')
        .select('id, name')
        .order('name');
      
      if (regionsData) {
        setAvailableRegions(regionsData);
      }
      
      // Fetch all branches
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
    
    const csvData = localData.map(branch => ({
      'Branch Name': branch.name || 'Unknown',
      'Branch Code': branch.code || 'Unknown',
      'Region': branch.region || 'Unknown',
      'Total Disbursed': branch.totalDisbursed || 0,
      'Total Payable': branch.totalPayable || 0,
      'Total Collected': branch.totalCollected || 0,
      'Outstanding': branch.totalOutstanding || 0,
      'Collection Rate (%)': branch.collectionRate || 0,
      'NPL Amount': branch.nplAmount || 0,
      'NPL Rate (%)': branch.nplRate || 0,
      'Arrears': branch.arrearsAmount || 0,
      'Arrears Rate (%)': branch.arrearsRate || 0,
      'Loan Count': branch.loanCount || 0,
      'Avg Loan Size': branch.avgLoanSize || 0
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
  }, [localData]);


  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header with title and export */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building className="w-6 h-6" style={{ color: "#586ab1" }} />
          <h3 className="text-lg font-light" style={{ color: "#586ab1" }}>
            Branch Performance Analysis
          </h3>
        
        </div>
        
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          disabled={!localData || localData.length === 0}
        >
          <Download className="w-4 h-4" />
          Export
        </button>
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
            >
              <option value="all">All Branches</option>
              {filteredBranches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} 
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
            <button
              onClick={applyCustomDateFilter}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              disabled={!localFilters.customStartDate || !localFilters.customEndDate}
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Graph */}
     <div className="h-96" style={{ position: 'relative' }}>
        {localData && localData.length > 0 ? (
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
                tickFormatter={(value) => {
                  if (value.length > 15) {
                    return value.substring(0, 15) + '...';
                  }
                  return value;
                }}
              />
              <YAxis 
                fontSize={12}
                tickFormatter={(value) => `Ksh ${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(88, 106, 177, 0.1)' }}
                wrapperStyle={{ 
                  zIndex: 10000,
                  outline: 'none'
                }}
                position={{ y: 0 }}
                allowEscapeViewBox={{ x: true, y: true }}
              />
              <Legend
                verticalAlign="bottom"
                align="center"
                height={36}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar 
                dataKey="totalDisbursed" 
                name="Disbursed" 
                fill={COLORS.totalDisbursed} 
                radius={[2, 2, 0, 0]}
              />
              <Bar 
                dataKey="totalCollected" 
                name="Collected" 
                fill={COLORS.totalCollected} 
                radius={[2, 2, 0, 0]}
              />
              <Bar 
                dataKey="totalOutstanding" 
                name="Outstanding" 
                fill={COLORS.totalOutstanding} 
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No branch data available for the selected filters</p>
              <p className="text-gray-400 text-sm mt-1">
                Try adjusting your filters or date range
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Empty state message */}
      {localData.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No data available for the selected filters</p>
        </div>
      )}
    </div>
  );
};

export default BranchChart;