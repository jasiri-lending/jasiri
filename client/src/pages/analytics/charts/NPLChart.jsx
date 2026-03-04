import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { AlertTriangle, Download, Filter, Calendar, Globe, Building } from 'lucide-react';
import { supabase } from "../../../supabaseClient";
import { HEADER_COLOR, COLORS } from '../shared/constants';
import { formatCurrencyCompact } from '../shared/Format.js';
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

// Fetch NPL data with filters - A loan is NPL if any installment is overdue by 90+ days
const fetchNPLData = async (dateRange, selectedRegion, selectedBranch, customDateRange, tenantId) => {
  try {
    let query = supabase
      .from('loans')
      .select(`
        id,
        scored_amount,
        total_payable,
        weekly_payment,
        created_at,
        branch_id,
        region_id,
        repayment_state,
        branches!inner(name, code, region_id),
        regions!inner(name)
      `)
      .eq('status', 'disbursed')
      .eq('tenant_id', tenantId);

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

    // Handle date filtering (loan creation date)
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
      console.error("Error fetching NPL data:", loansError);
      return [];
    }

    if (!loansData || loansData.length === 0) {
      return [];
    }

    // Fetch installments for all loans
    const loanIds = loansData.map(loan => loan.id);
    const { data: installmentsData, error: installmentsError } = await supabase
      .from('loan_installments')
      .select('loan_id, due_date, due_amount, paid_amount, days_overdue, status')
      .in('loan_id', loanIds)
      .eq('tenant_id', tenantId);

    if (installmentsError) {
      console.error("Error fetching installments:", installmentsError);
    }

    // Group installments by loan
    const installmentsByLoan = {};

    installmentsData?.forEach(installment => {
      if (!installmentsByLoan[installment.loan_id]) {
        installmentsByLoan[installment.loan_id] = [];
      }
      installmentsByLoan[installment.loan_id].push(installment);
    });

    const now = new Date();
    const nplAnalysis = [];

    loansData.forEach(loan => {
      const installments = installmentsByLoan[loan.id] || [];

      if (installments.length === 0) return;

      // Calculate total amounts
      let totalDue = 0;
      let totalPaid = 0;
      let maxDaysOverdue = 0;
      let hasOverdueInstallment = false;

      installments.forEach(installment => {
        const dueAmount = Number(installment.due_amount) || 0;
        const paidAmount = Number(installment.paid_amount) || 0;
        const daysOverdue = Number(installment.days_overdue) || 0;

        totalDue += dueAmount;
        totalPaid += paidAmount;

        // Track maximum days overdue
        if (daysOverdue > maxDaysOverdue) {
          maxDaysOverdue = daysOverdue;
        }

        // Check if installment is overdue
        if (daysOverdue > 0 || installment.status === 'overdue') {
          hasOverdueInstallment = true;
        }
      });

      const overdueAmount = Math.max(0, totalDue - totalPaid);

      // NPL criteria: any installment overdue by 90+ days
      if (maxDaysOverdue >= 90 && overdueAmount > 0) {
        const totalAmount = Number(loan.total_payable) || 0;
        const turnoverPercentage = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;

        nplAnalysis.push({
          loanId: loan.id,
          branch: loan.branches?.name || 'Unknown',
          overdueAmount: Math.round(overdueAmount),
          totalAmount: Math.round(totalAmount),
          paidAmount: Math.round(totalPaid),
          turnoverPercentage,
          daysOverdue: maxDaysOverdue,
          weeklyPayment: Number(loan.weekly_payment) || 0,
          repaymentState: loan.repayment_state
        });
      }
    });

    return nplAnalysis.sort((a, b) => b.overdueAmount - a.overdueAmount);

  } catch (error) {
    console.error("Error in fetchNPLData:", error);
    return [];
  }
};

const NPLChart = () => {
  const { tenant } = useTenant();
  const [data, setData] = useState([]);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: 'all',
    region: 'all',
    branch: 'all',
    customStartDate: '',
    customEndDate: '',
    sortBy: 'amount'
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
      const nplData = await fetchNPLData(
        filterParams.dateRange,
        filterParams.region,
        filterParams.branch,
        customDateRange,
        tenant.id
      );
      setData(nplData);
    } catch (error) {
      console.error("Error fetching NPL data:", error);
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
          branch: 'all',
          sortBy: 'amount'
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

    // Don't refetch if only sortBy changed
    if (key === 'sortBy') {
      return;
    }

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

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    if (filters.sortBy === 'amount') return b.overdueAmount - a.overdueAmount;
    if (filters.sortBy === 'percentage') return a.turnoverPercentage - b.turnoverPercentage;
    if (filters.sortBy === 'days') return b.daysOverdue - a.daysOverdue;
    return 0;
  });

  const topNPL = sortedData.slice(0, 10);

  // Export function
  const handleExport = useCallback(() => {
    if (!data || data.length === 0) return;

    const csvData = data.map(item => ({
      'Loan ID': item.loanId,
      'Branch': item.branch,
      'Overdue Amount': item.overdueAmount,
      'Total Amount': item.totalAmount,
      'Paid Amount': item.paidAmount,
      'Turnover %': item.turnoverPercentage,
      'Days Overdue': item.daysOverdue
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `npl-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [data]);

  const totalNPL = data.reduce((sum, loan) => sum + loan.overdueAmount, 0);
  const totalPaid = data.reduce((sum, loan) => sum + loan.paidAmount, 0);
  const avgTurnover = data.length > 0
    ? data.reduce((sum, loan) => sum + loan.turnoverPercentage, 0) / data.length
    : 0;
  const avgDaysOverdue = data.length > 0
    ? data.reduce((sum, loan) => sum + loan.daysOverdue, 0) / data.length
    : 0;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;

    const item = payload[0].payload;

    return (
      <div className="bg-[#E7F0FA] p-4 rounded-lg shadow-xl border border-gray-200 relative z-[9999]">
        <p className="font-bold text-slate-600 mb-2 text-sm">Loan: {item.loanId}</p>
        <div className="space-y-1">
          <p className="text-xs text-gray-600">
            Branch: <span className="font-semibold">{item.branch}</span>
          </p>
          <p className="text-xs text-gray-600">
            Overdue: <span className="font-semibold text-red-600">{formatCurrencyCompact(item.overdueAmount)}</span>
          </p>
          <p className="text-xs text-gray-600">
            Paid: <span className="font-semibold text-green-600">{formatCurrencyCompact(item.paidAmount)}</span>
          </p>
          <p className="text-xs text-gray-600">
            Turnover: <span className="font-semibold">{item.turnoverPercentage}%</span>
          </p>
          <p className="text-xs text-gray-600">
            Days Overdue: <span className="font-semibold">{item.daysOverdue}</span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 p-8 transition-all duration-300 hover:shadow-2xl relative hover:z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg text-stone-600 whitespace-nowrap">
          Non-Performing Loans <span className="text-red-700/70 font-bold">(NPL)</span> Analysis
        </h3>

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
                  label: `${branch.name} (${branch.code})`
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
        {
          showCustomDate && (
            <div className="mt-4 flex flex-wrap items-center gap-3 bg-stone-50/50 p-3 rounded-lg border border-stone-100">
              <Calendar className="w-3.5 h-3.5 text-stone-400" />
              <input
                type="date"
                value={filters.customStartDate}
                onChange={(e) => handleFilterChange('customStartDate', e.target.value)}
                disabled={loading}
                className="h-8 px-2 text-xs font-bold rounded border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
              />
              <span className="text-stone-300">→</span>
              <input
                type="date"
                value={filters.customEndDate}
                onChange={(e) => handleFilterChange('customEndDate', e.target.value)}
                disabled={loading}
                className="h-8 px-2 text-xs font-bold rounded border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
              />
              <button
                onClick={applyCustomDateFilter}
                disabled={!filters.customStartDate || !filters.customEndDate || loading}
                className="h-8 px-4 rounded text-xs font-bold text-white bg-stone-600 hover:bg-stone-700 transition-all disabled:opacity-50"
              >
                Update
              </button>
            </div>
          )
        }
      </div >


      {/* Chart */}
      < div className="h-80 mb-6" >
        {topNPL && topNPL.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topNPL}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="loanId"
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="overdueAmount" name="Overdue Amount" fill="#ef4444" />
              <Bar dataKey="paidAmount" name="Paid Amount" fill="#10b981" />
              <Bar
                dataKey="turnoverPercentage"
                name="Turnover %"
                fill="#f97316"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No NPL data available</p>
              <p className="text-gray-400 text-sm mt-1">
                Loans are classified as NPL when any installment is overdue by 90+ days
              </p>
            </div>
          </div>
        )}
      </div >


      {/* NPL Summary Stats */}
      {
        data && data.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            <div className="p-2.5 bg-gradient-to-br from-red-50 to-red-100/50 rounded-lg border border-red-100 shadow-sm group hover:scale-[1.01] transition-transform">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-red-400">Total NPL Amount</span>
                <div className="w-6 h-6 rounded-full bg-red-200/50 flex items-center justify-center text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-base font-black text-red-900 tracking-tight">
                {formatCurrencyCompact(totalNPL)}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[8px] font-bold text-red-600 bg-red-200/50 px-1.5 py-0.5 rounded-full uppercase">Action Required</span>
              </div>
            </div>

            <div className="p-2.5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-lg border border-emerald-100 shadow-sm group hover:scale-[1.01] transition-transform">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Collection Recovery</span>
                <div className="w-6 h-6 rounded-full bg-emerald-200/50 flex items-center justify-center text-emerald-600">
                  <Download className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-base font-black text-emerald-900 tracking-tight">
                {formatCurrencyCompact(totalPaid)}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[9px] font-bold text-emerald-600">{Math.round((totalPaid / (totalPaid + totalNPL)) * 100)}% Recovery Rate</span>
              </div>
            </div>

            <div className="p-2.5 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-lg border border-slate-100 shadow-sm group hover:scale-[1.01] transition-transform">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Risk Profile</span>
                <div className="w-6 h-6 rounded-full bg-slate-200/50 flex items-center justify-center text-slate-600">
                  <Globe className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-base font-black text-slate-900 tracking-tight">{data.length}</p>
                  <p className="text-[8px] font-bold text-slate-500 uppercase">Loans at Risk</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-black text-slate-900 tracking-tight">{Math.max(...data.map(d => d.daysOverdue))}</p>
                  <p className="text-[8px] font-bold text-slate-500 uppercase">Max Days</p>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default NPLChart;