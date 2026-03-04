// charts/BranchPerformanceChart.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Download, Calendar, Building, Globe } from 'lucide-react';
import { supabase } from "../../../supabaseClient";
import { useTenant } from "../../../hooks/useTenant";

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
    <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-white/40 min-w-[320px] relative z-[9999]">
      <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
        <div className="p-2 bg-emerald-50 rounded-lg">
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{branchData?.region}</p>
          <p className="font-black text-slate-800 text-base">{branchData?.name}</p>
        </div>
      </div>

      <div className="space-y-3">
        {[
          { label: "Disbursed", value: branchData?.totalDisbursed, color: COLORS.totalDisbursed, icon: "💰" },
          { label: "Collected", value: branchData?.totalCollected, color: COLORS.totalCollected, icon: "📥" },
          { label: "Outstanding", value: branchData?.totalOutstanding, color: COLORS.totalOutstanding, icon: "📊" },
          { label: "Arrears", value: branchData?.arrearsAmount, color: COLORS.arrearsAmount, icon: "⚠️" },
          { label: "NPL Amount", value: branchData?.nplAmount, color: COLORS.nplAmount, icon: "🚨" }
        ].map((item, idx) => (
          <div key={idx} className="flex justify-between items-center group">
            <div className="flex items-center gap-2">
              <span className="text-xs grayscale group-hover:grayscale-0 transition-all">{item.icon}</span>
              <span className="text-slate-500 text-xs font-bold">{item.label}</span>
            </div>
            <span className="font-black text-xs tracking-tight" style={{ color: item.color }}>
              Ksh {item.value?.toLocaleString()}
            </span>
          </div>
        ))}

        <div className="pt-3 mt-3 border-t border-slate-100 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Collection Rate</span>
            <span className={`text-lg font-black ${branchData?.collectionRate >= 80 ? 'text-emerald-600' : branchData?.collectionRate >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
              {branchData?.collectionRate}%
            </span>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Avg Loan Size</span>
            <p className="text-base font-black text-slate-700">Ksh {branchData?.avgLoanSize?.toLocaleString()}</p>
          </div>
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

// Optimized fetch function with proper arrears calculation
const fetchBranchPerformance = async (dateRange, selectedRegion, selectedBranch, customDateRange, topCount, tenantId) => {
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
      .in('loan_id', loanIds)
      .eq('tenant_id', tenantId);

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError);
    }

    // Fetch installments for arrears and NPL calculation
    const { data: installmentsData, error: installmentsError } = await supabase
      .from('loan_installments')
      .select('loan_id, due_date, due_amount, interest_paid, principal_paid, status')
      .in('loan_id', loanIds)
      .eq('tenant_id', tenantId);

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
  const { tenant } = useTenant();
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
  const [loading, setLoading] = useState(false);

  // Fetch available regions and branches on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!tenant?.id) return;
      // Fetch all regions
      const { data: regionsData } = await supabase
        .from('regions')
        .select('id, name')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (regionsData) {
        setAvailableRegions(regionsData);
      }

      // Fetch all branches
      const { data: branchesData } = await supabase
        .from('branches')
        .select('id, name, code, region_id')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (branchesData) {
        setAvailableBranches(branchesData);
      }

      // Fetch initial branch data
      const branchData = await fetchBranchPerformance('all', 'all', 'all', null, 10, tenant.id);
      setLocalData(branchData);
    };

    fetchInitialData();
  }, [tenant?.id]);

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
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const branchData = await fetchBranchPerformance(
        filters.dateRange,
        filters.region,
        filters.branch,
        customDateRange,
        filters.topCount,
        tenant.id
      );
      setLocalData(branchData);
    } catch (error) {
      console.error("Error fetching branch data:", error);
      setLocalData([]);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

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
    <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 p-8 transition-all duration-300 hover:shadow-2xl relative hover:z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg text-stone-600 whitespace-nowrap">Branch Performance Analysis</h3>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 text-stone-500 hover:text-stone-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-stone-200 hover:bg-stone-50"
          disabled={!localData || localData.length === 0}
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
                ...availableRegions.map(r => ({
                  value: r.name,
                  label: r.name
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
                ...filteredBranches.map(b => ({
                  value: b.id,
                  label: b.name
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

        {/* Custom Date Range */}
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
                fontSize={10}
                fontWeight="bold"
                tickFormatter={(value) => value.toLocaleString()}
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