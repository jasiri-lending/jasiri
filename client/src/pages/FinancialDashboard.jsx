import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from "../supabaseClient";
import { useTenant } from "../hooks/useTenant";
import {
  TrendingUp, TrendingDown, DollarSign, Percent,
  Receipt, AlertTriangle, Calendar,
  Filter, MapPin, Building,
  RefreshCw,
  PieChart as PieChartIcon,
  BarChart3,
  ShieldAlert,
  CreditCard,
  Target
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

// ========== CONSTANTS ==========
const COLORS = {
  income:     '#10B981',
  profit:     '#059669',
  portfolio:  '#3B82F6',
  assets:     '#2563EB',
  fees:       '#F59E0B',
  penalties:  '#EF4444',
  writeoffs:  '#B91C1C',
  disbursements: '#F97316',
  repayments:    '#10B981',
};

// ========== PURE UTILITIES (defined outside component — never recreated) ==========
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return "0.00";
  const n = Number(amount);
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  const [int, dec] = n.toFixed(2).split('.');
  return `$${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${ dec}`;
};

const toKenyaDateStr = (d = new Date()) => {
  const kenya = new Date(new Date(d).getTime() + 3 * 60 * 60 * 1000);
  const y  = kenya.getUTCFullYear();
  const mo = String(kenya.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(kenya.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
};

const getMonthStart  = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); };
const getQuarterStart = () => { const n = new Date(); return new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1); };
const getYearStart   = () => new Date(new Date().getFullYear(), 0, 1);

const resolveDateRange = (filters) => {
  const end = filters.dateRange === 'custom' ? filters.endDate : new Date();
  let start;
  switch (filters.dateRange) {
    case 'qtd':    start = getQuarterStart(); break;
    case 'ytd':    start = getYearStart();    break;
    case 'custom': start = filters.startDate; break;
    default:       start = getMonthStart();   // 'mtd'
  }
  return { start, end };
};

// ========== UI PRIMITIVES ==========
const CardSkeleton = () => (
  <div className="animate-pulse p-6 bg-white rounded-xl shadow-sm border border-gray-200">
    <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
    <div className="h-8 bg-gray-200 rounded w-2/3 mb-2" />
    <div className="h-3 bg-gray-100 rounded w-1/2" />
  </div>
);

const ChartSkeleton = () => (
  <div className="animate-pulse p-6 bg-white rounded-xl shadow-sm border border-gray-200 h-80">
    <div className="h-4 bg-gray-200 rounded w-1/4 mb-6" />
    <div className="h-48 bg-gray-100 rounded w-full" />
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center h-64 text-center p-6">
    <div className="p-4 bg-gray-50 rounded-full mb-4 border border-gray-200">
      <BarChart3 className="w-10 h-10 text-gray-400" />
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-500 max-w-md">{description}</p>
  </div>
);

// ========== STAT CARD ==========
const FinancialStatCard = ({ title, value, subtitle, icon: Icon, color, trend, tooltip, loading }) => {
  if (loading) return <CardSkeleton />;
  return (
    <div className="relative p-5 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100 group hover:border-gray-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${color}15`, border: `1px solid ${color}20` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <span className="text-sm font-medium text-gray-600">{title}</span>
          </div>
          <div className="text-2xl font-bold mb-1" style={{ color }}>{formatCurrency(value)}</div>
          {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${trend >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span className="text-xs font-medium">{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      {tooltip && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="text-xs text-gray-400 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );
};

// ========== CHART CARD WRAPPER ==========
const ChartCard = ({ title, subtitle, icon: Icon, children, loading, className = "" }) => {
  if (loading) return <ChartSkeleton />;
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200 ${className}`}>
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
              <Icon className="w-5 h-5 text-blue-600" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-800 text-lg">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
};

// ========== PROFIT SUMMARY CARD ==========
const ProfitSummaryCard = ({ metrics, loading }) => {
  if (loading) {
    return (
      <div className="animate-pulse bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="space-y-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex justify-between">
              <div className="h-3 bg-gray-100 rounded w-1/3" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { operationalCosts, totalRevenue, writeOffs, penaltiesCollected, netProfit } = metrics;
  const isProfitable = netProfit >= 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-lg bg-green-50 border border-green-100">
          <Target className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 text-lg">Profitability Summary</h3>
          <p className="text-sm text-gray-500">Period performance overview</p>
        </div>
      </div>

      <div className="space-y-4">
        {[
          { label: 'Total Revenue',        sub: 'Interest + Fees + Penalties', value: totalRevenue,       cls: 'text-green-600' },
          { label: 'Operational Costs',    sub: 'Staff, utilities, etc.',       value: operationalCosts,   cls: '' },
          { label: 'Penalties Collected',  sub: 'Late payment fees',            value: penaltiesCollected, cls: 'text-amber-600' },
          { label: 'Write-offs',           sub: 'Unrecoverable loans',          value: writeOffs,          cls: 'text-red-600' },
        ].map(({ label, sub, value, cls }) => (
          <div key={label} className="flex justify-between items-center pb-3 border-b border-gray-100">
            <div>
              <span className="text-gray-600">{label}</span>
              <p className="text-xs text-gray-400">{sub}</p>
            </div>
            <span className={`font-medium ${cls}`}>{formatCurrency(value)}</span>
          </div>
        ))}

        <div className="pt-2">
          <div className="flex justify-between items-center">
            <div>
              <span className="font-semibold text-gray-800">Net Profit</span>
              <p className="text-xs text-gray-400">After all deductions</p>
            </div>
            <span className={`text-2xl font-bold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(netProfit)}
            </span>
          </div>
          <div className={`text-sm mt-2 px-3 py-1.5 rounded-lg ${isProfitable ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
            {isProfitable ? '✓ Profitable this period' : '✗ Loss making this period'}
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== FILTER BAR ==========
const FilterBar = ({ filters, filterOptions, onFilterChange }) => {
  const [isCustomRange, setIsCustomRange] = useState(false);

  const handleDateRangeChange = (e) => {
    const val = e.target.value;
    setIsCustomRange(val === 'custom');
    onFilterChange('dateRange', val);
  };

  return (
    <div className="bg-white border-b border-gray-200 px-8 py-6 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100">
            <Filter className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Financial Dashboard</h2>
            <p className="text-sm text-gray-500">Monitor your financial performance and metrics</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Date Range */}
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={filters.dateRange}
              onChange={handleDateRangeChange}
              className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white hover:border-gray-400 transition-colors"
            >
              <option value="mtd">Month to Date</option>
              <option value="qtd">Quarter to Date</option>
              <option value="ytd">Year to Date</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {isCustomRange && (
            <div className="flex items-center gap-2">
              <DatePicker
                selected={filters.startDate}
                onChange={(date) => onFilterChange('startDate', date)}
                selectsStart
                startDate={filters.startDate}
                endDate={filters.endDate}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm w-36 hover:border-gray-400 transition-colors"
                placeholderText="Start Date"
              />
              <span className="text-gray-400 text-sm">to</span>
              <DatePicker
                selected={filters.endDate}
                onChange={(date) => onFilterChange('endDate', date)}
                selectsEnd
                startDate={filters.startDate}
                endDate={filters.endDate}
                minDate={filters.startDate}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm w-36 hover:border-gray-400 transition-colors"
                placeholderText="End Date"
              />
            </div>
          )}

          {/* Region */}
          <div className="relative">
            <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={filters.region}
              onChange={(e) => onFilterChange('region', e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white hover:border-gray-400 transition-colors"
            >
              <option value="all">All Regions</option>
              {filterOptions.regions.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div className="relative">
            <Building className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={filters.branch}
              onChange={(e) => onFilterChange('branch', e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white hover:border-gray-400 transition-colors"
            >
              <option value="all">All Branches</option>
              {filterOptions.branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={() => onFilterChange('_refresh', true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm hover:shadow"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

// ========== MAIN COMPONENT ==========
const FinancialDashboard = () => {
  const { tenant } = useTenant();

  // ---- Separate filter options from fetch-triggering filters ----
  const [filterOptions, setFilterOptions] = useState({ regions: [], branches: [] });
  const [filters, setFilters] = useState({
    dateRange:  'mtd',
    startDate:  getMonthStart(),
    endDate:    new Date(),
    region:     'all',
    branch:     'all',
  });

  // ---- Data states ----
  const [loading, setLoading]           = useState(true);
  const [lastUpdated, setLastUpdated]   = useState(null);
  const [kpis, setKpis]                 = useState({
    interestEarned: 0, processingFees: 0, penaltiesCollected: 0,
    totalRevenue: 0, outstandingPrincipal: 0, writeOffs: 0,
  });
  const [cashFlowData, setCashFlowData]         = useState([]);
  const [revenueBreakdown, setRevenueBreakdown] = useState([]);
  const [portfolioTrend, setPortfolioTrend]     = useState([]);
  const [profitability, setProfitability]       = useState({
    operationalCosts: 0, totalRevenue: 0, writeOffs: 0, penaltiesCollected: 0, netProfit: 0,
  });

  // ---- Use a ref to track in-flight fetches and prevent race conditions ----
  const fetchIdRef = useRef(0);

  // ---- Fetch filter options once on mount ----
  useEffect(() => {
    if (!tenant?.id) return;
    const load = async () => {
      const [regRes, brRes] = await Promise.all([
        supabase.from('regions').select('id, name').eq('tenant_id', tenant.id).order('name'),
        supabase.from('branches').select('id, name').eq('tenant_id', tenant.id).order('name'),
      ]);
      setFilterOptions({
        regions:  regRes.data  || [],
        branches: brRes.data   || [],
      });
    };
    load();
  }, [tenant?.id]);

  // ---- Main fetch, called whenever filters change ----
  const fetchAll = useCallback(async (currentFilters, tenantId) => {
    if (!tenantId) return;

    // Stamp this fetch — any older in-flight fetches will be ignored
    const myId = ++fetchIdRef.current;
    setLoading(true);

    try {
      const { start, end } = resolveDateRange(currentFilters);
      const startStr = toKenyaDateStr(start);
      const endStr   = toKenyaDateStr(end);

      // Run all queries in parallel
      const [
        paymentsRes,
        loansRes,
        activeLoansRes,
        allPaymentsRes,
        writeOffsRes,
        disbursementsRes,
        repaymentsRes,
        portfolioLoansRes,
        portfolioPaymentsRes,
      ] = await Promise.all([
        supabase.from('loan_payments')
          .select('interest_paid')
          .eq('tenant_id', tenantId)
          .gte('created_at', startStr)
          .lte('created_at', endStr),

        supabase.from('loans')
          .select('processing_fee, penalty_fee')
          .eq('tenant_id', tenantId)
          .gte('disbursed_at', startStr)
          .lte('disbursed_at', endStr),

        supabase.from('loans')
          .select('id, total_payable')
          .eq('tenant_id', tenantId)
          .eq('status', 'disbursed'),

        supabase.from('loan_payments')
          .select('paid_amount, loan_id')
          .eq('tenant_id', tenantId),

        supabase.from('loans')
          .select('total_payable')
          .eq('status', 'defaulted')
          .eq('tenant_id', tenantId)
          .gte('defaulted_at', startStr)
          .lte('defaulted_at', endStr),

        supabase.from('loans')
          .select('scored_amount, disbursed_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'disbursed')
          .gte('disbursed_at', startStr)
          .lte('disbursed_at', endStr),

        supabase.from('loan_payments')
          .select('paid_amount, created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', startStr)
          .lte('created_at', endStr),

        supabase.from('loans')
          .select('scored_amount, disbursed_at, status')
          .eq('tenant_id', tenantId)
          .order('disbursed_at'),

        supabase.from('loan_payments')
          .select('paid_amount, created_at, loan_id')
          .eq('tenant_id', tenantId),
      ]);

      // Bail if a newer fetch has started
      if (fetchIdRef.current !== myId) return;

      // ---- KPIs ----
      const interestEarned = paymentsRes.data?.reduce(
        (s, p) => s + (Number(p.interest_paid) || 0), 0) ?? 0;

      let processingFees = 0, penaltiesCollected = 0;
      loansRes.data?.forEach(l => {
        processingFees      += Number(l.processing_fee) || 0;
        penaltiesCollected  += Number(l.penalty_fee)    || 0;
      });

      const loanPaymentMap = {};
      allPaymentsRes.data?.forEach(p => {
        loanPaymentMap[p.loan_id] = (loanPaymentMap[p.loan_id] || 0) + (Number(p.paid_amount) || 0);
      });
      const outstandingPrincipal = activeLoansRes.data?.reduce((s, l) => {
        return s + Math.max(0, (Number(l.total_payable) || 0) - (loanPaymentMap[l.id] || 0));
      }, 0) ?? 0;

      const writeOffs = writeOffsRes.data?.reduce(
        (s, l) => s + (Number(l.total_payable) || 0), 0) ?? 0;

      const totalRevenue = interestEarned + processingFees + penaltiesCollected;

      setKpis({ interestEarned, processingFees, penaltiesCollected, totalRevenue, outstandingPrincipal, writeOffs });

      // ---- Cash Flow ----
      const disByDay = {}, repByDay = {};
      disbursementsRes.data?.forEach(l => {
        const d = l.disbursed_at?.split('T')[0];
        if (d) disByDay[d] = (disByDay[d] || 0) + (Number(l.scored_amount) || 0);
      });
      repaymentsRes.data?.forEach(p => {
        const d = p.created_at?.split('T')[0];
        if (d) repByDay[d] = (repByDay[d] || 0) + (Number(p.paid_amount) || 0);
      });
      const allDates = Array.from(new Set([...Object.keys(disByDay), ...Object.keys(repByDay)])).sort();
      setCashFlowData(allDates.map(date => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        disbursements: disByDay[date] || 0,
        repayments:    repByDay[date] || 0,
      })));

      // ---- Revenue Breakdown ----
      const breakdown = [
        { name: 'Interest Income',  value: interestEarned,      color: COLORS.income },
        { name: 'Processing Fees',  value: processingFees,      color: COLORS.fees },
        { name: 'Penalties',        value: penaltiesCollected,  color: COLORS.penalties },
      ].filter(i => i.value > 0);
      setRevenueBreakdown(breakdown);

      // ---- Portfolio Trend ----
      const dailyBalances = {};
      let running = 0;
      portfolioLoansRes.data?.forEach(l => {
        const d = l.disbursed_at?.split('T')[0];
        if (d && l.status === 'disbursed') {
          running += Number(l.scored_amount) || 0;
          dailyBalances[d] = running;
        }
      });
      portfolioPaymentsRes.data?.forEach(p => {
        const d = p.created_at?.split('T')[0];
        if (d && dailyBalances[d] !== undefined) {
          dailyBalances[d] -= Number(p.paid_amount) || 0;
        }
      });
      const trend = Object.entries(dailyBalances)
        .sort(([a], [b]) => new Date(a) - new Date(b))
        .map(([date, value]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: Math.max(0, value),
        }))
        .slice(-30);
      setPortfolioTrend(trend);

      // ---- Profitability (calculated directly from fetched data — no extra effect) ----
      const operationalCosts = totalRevenue * 0.25;
      setProfitability({
        operationalCosts,
        totalRevenue,
        writeOffs,
        penaltiesCollected,
        netProfit: totalRevenue - operationalCosts - writeOffs,
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      if (fetchIdRef.current === myId) setLoading(false);
    }
  }, []); // no deps — receives everything as arguments

  // ---- Trigger fetch when tenant or filters change (debounced) ----
  useEffect(() => {
    if (!tenant?.id) return;
    const timer = setTimeout(() => fetchAll(filters, tenant.id), 300);
    return () => clearTimeout(timer);
  }, [tenant?.id, filters, fetchAll]);

  // ---- Filter change handler ----
  const handleFilterChange = useCallback((key, value) => {
    if (key === '_refresh') {
      // Force re-trigger by bumping a dummy counter inside filters
      setFilters(prev => ({ ...prev, _ts: Date.now() }));
      return;
    }
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-gray-50">
      <FilterBar
        filters={filters}
        filterOptions={filterOptions}
        onFilterChange={handleFilterChange}
      />

      <div className="px-8 pb-8 max-w-7xl mx-auto">

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="lg:col-span-2">
            <FinancialStatCard
              title="Total Revenue"
              value={kpis.totalRevenue}
              subtitle="Interest + Fees + Penalties"
              icon={DollarSign}
              color={COLORS.portfolio}
              trend={15.7}
              tooltip="Total revenue from all sources"
              loading={loading}
            />
          </div>
          <FinancialStatCard
            title="Interest Earned"
            value={kpis.interestEarned}
            subtitle="From loan interest"
            icon={Percent}
            color={COLORS.income}
            trend={12.5}
            loading={loading}
          />
          <FinancialStatCard
            title="Processing Fees"
            value={kpis.processingFees}
            subtitle="Loan origination fees"
            icon={Receipt}
            color={COLORS.fees}
            trend={8.2}
            loading={loading}
          />
          <FinancialStatCard
            title="Penalties Collected"
            value={kpis.penaltiesCollected}
            subtitle="Late payment fees"
            icon={ShieldAlert}
            color={COLORS.penalties}
            trend={5.3}
            loading={loading}
          />
          <FinancialStatCard
            title="Outstanding Principal"
            value={kpis.outstandingPrincipal}
            subtitle="Active loan portfolio"
            icon={CreditCard}
            color={COLORS.assets}
            loading={loading}
          />
        </div>

        {/* Cash Flow */}
        <div className="mb-8">
          <ChartCard
            title="Cash Flow Analysis"
            subtitle="Disbursements vs Repayments"
            icon={BarChart3}
            loading={loading}
          >
            {cashFlowData.length === 0
              ? <EmptyState title="No Cash Flow Data" description="Cash flow data will appear once you have disbursements and repayments in the selected period." />
              : (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="date" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                    <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                    <Tooltip
                      formatter={(v) => [formatCurrency(v), 'Amount']}
                      labelFormatter={(l) => `Date: ${l}`}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                    <Bar dataKey="disbursements" name="Disbursements" fill={COLORS.disbursements} radius={[4, 4, 0, 0]} barSize={20} />
                    <Line type="monotone" dataKey="repayments" name="Repayments" stroke={COLORS.repayments} strokeWidth={3} dot={{ strokeWidth: 2, r: 3 }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
          </ChartCard>
        </div>

        {/* Revenue Breakdown + Portfolio Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <ChartCard title="Revenue Breakdown" subtitle="Distribution of income sources" icon={PieChartIcon} loading={loading}>
            {revenueBreakdown.length === 0
              ? <EmptyState title="No Revenue Data" description="Revenue breakdown will appear once you have revenue in the selected period." />
              : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                        outerRadius={90}
                        innerRadius={40}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {revenueBreakdown.map((entry, i) => (
                          <Cell key={`cell-${i}`} fill={entry.color} stroke="#FFF" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(v)} />
                      <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ paddingLeft: '20px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
          </ChartCard>

          <ChartCard title="Portfolio Value Trend" subtitle="30-day performance overview" icon={BarChart3} loading={loading}>
            {portfolioTrend.length === 0
              ? <EmptyState title="No Portfolio Data" description="Portfolio trend will appear once you have active loans." />
              : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={portfolioTrend}>
                      <defs>
                        <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={COLORS.portfolio} stopOpacity={0.8} />
                          <stop offset="95%" stopColor={COLORS.portfolio} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                      <XAxis dataKey="date" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                      <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                      <Tooltip
                        formatter={(v) => [formatCurrency(v), 'Portfolio Value']}
                        labelFormatter={(l) => `Date: ${l}`}
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                      />
                      <Area type="monotone" dataKey="value" stroke={COLORS.portfolio} strokeWidth={3} fill="url(#portfolioGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
          </ChartCard>
        </div>

        {/* Profitability */}
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <ChartCard title="Profitability Analysis" subtitle="Revenue, Costs, and Write-offs" icon={BarChart3} loading={loading}>
                {kpis.totalRevenue === 0
                  ? <EmptyState title="No Profitability Data" description="Profitability metrics will appear once you have revenue and expense data." />
                  : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: 'Revenue',   value: profitability.totalRevenue,       fill: COLORS.income },
                            { name: 'Costs',     value: profitability.operationalCosts,   fill: COLORS.penalties },
                            { name: 'Write-offs',value: profitability.writeOffs,          fill: COLORS.writeoffs },
                          ]}
                          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                          <XAxis dataKey="name" stroke="#6B7280" tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                          <YAxis stroke="#6B7280" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                          <Tooltip formatter={(v) => formatCurrency(v)} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={60}>
                            {[COLORS.income, COLORS.penalties, COLORS.writeoffs].map((color, i) => (
                              <Cell key={i} fill={color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
              </ChartCard>
            </div>
            <ProfitSummaryCard metrics={profitability} loading={loading} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
                <span className="text-sm text-gray-600">{loading ? 'Loading data...' : 'All systems operational'}</span>
              </div>
              <button
                onClick={() => handleFilterChange('_refresh', true)}
                disabled={loading}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors ${loading ? 'text-gray-400 border-gray-200' : 'text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100'}`}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            {lastUpdated && (
              <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                Last updated: {lastUpdated.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;