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
      <div className="bg-[#E7F0FA] p-4 rounded-lg shadow-xl border border-gray-200">
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
    <div className="bg-[#E7F0FA] rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold text-red-700">
            Non-Performing Loans (NPL)
          </h3>
        </div>
        <div className="flex items-center gap-3">

          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-red-50 text-red-700 hover:bg-red-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            disabled={!data || data.length === 0}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

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
              onChange={(e) => handleFilterChange('customStartDate', e.target.value)}
              disabled={loading}
              className="h-9 px-3 text-sm rounded-lg border bg-[#E7F0FA] focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            <span className="text-slate-500 text-sm">to</span>

            <input
              type="date"
              value={filters.customEndDate}
              onChange={(e) => handleFilterChange('customEndDate', e.target.value)}
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


      {/* Chart */}
      <div className="h-80 mb-6">
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
      </div>


      {/* NPL Summary Stats */}
      {data && data.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700">Total NPL Amount</p>
                  <p className="text-2xl font-bold text-red-900">
                    {formatCurrencyCompact(totalNPL)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-red-700">Avg. Turnover %</p>
                  <p className="text-2xl font-bold text-red-900">
                    {Math.round(avgTurnover)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-700">Total Paid on NPL</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {formatCurrencyCompact(totalPaid)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-orange-700">Avg. Days Overdue</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {Math.round(avgDaysOverdue)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700">Total Loans at Risk</p>
                <p className="text-xl font-bold text-yellow-900">{data.length}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-yellow-700">Highest Days Overdue</p>
                <p className="text-xl font-bold text-yellow-900">
                  {data.length > 0 ? Math.max(...data.map(d => d.daysOverdue)) : 0} days
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NPLChart;