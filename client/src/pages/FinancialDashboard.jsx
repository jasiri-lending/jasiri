import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from "../supabaseClient";
import { useTenant } from "../hooks/useTenant";
import {
  TrendingUp, TrendingDown, Percent,
  Receipt, Calendar, MapPin, Building,
  RefreshCw, PieChart as PieChartIcon, BarChart3,
  ShieldAlert, CreditCard, Target, ArrowUpRight, ArrowDownRight,
  Banknote, Activity, DollarSign, AlertTriangle, Landmark
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ComposedChart, Line, Bar
} from 'recharts';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import CustomSelect from '../components/CustomSelect';

// ========== BRAND COLORS ==========
const BRAND = {
  primary: '#1E3A8A',
  btn: '#586ab1',
  secondary: '#7BA4D0',
  surface: '#E7F0FA',
  accent: '#10B981',
  highlight: '#FACC15',
  text: '#111827',
  muted: '#E5E7EB',
  danger: '#EF4444',
  warning: '#F59E0B',
  navy: '#1E3A8A',
};

const CHART_COLORS = {
  interest: BRAND.accent,
  processing: BRAND.btn,
  registration: BRAND.secondary,
  penalties: BRAND.danger,
  writeoffs: '#B91C1C',
  disbursements: BRAND.navy,
  repayments: BRAND.accent,
  portfolio: BRAND.primary,
};

// ========== FORMATTING ==========
const formatNumber = (amount) => {
  if (amount === null || amount === undefined) return '0.00';
  const n = Number(amount);
  const [int, dec] = n.toFixed(2).split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
};

// ========== DATE UTILITIES ==========
const toKenyaDateStr = (d = new Date()) => {
  const kenya = new Date(new Date(d).getTime() + 3 * 60 * 60 * 1000);
  const y = kenya.getUTCFullYear();
  const mo = String(kenya.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(kenya.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
};
const getMonthStart = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); };
const getQuarterStart = () => { const n = new Date(); return new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1); };
const getYearStart = () => new Date(new Date().getFullYear(), 0, 1);

const resolveDateRange = (filters) => {
  const end = filters.dateRange === 'custom' ? filters.endDate : new Date();
  let start;
  switch (filters.dateRange) {
    case 'all_time': start = new Date(2000, 0, 1); break;
    case 'qtd': start = getQuarterStart(); break;
    case 'ytd': start = getYearStart(); break;
    case 'custom': start = filters.startDate; break;
    default: start = getMonthStart();
  }
  return { start, end };
};

// ========== SKELETONS & EMPTY ==========
const CardSkeleton = () => (
  <div className="animate-pulse p-6 bg-white rounded-2xl border" style={{ borderColor: '#E5E7EB' }}>
    <div className="flex items-center gap-3 mb-5">
      <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: BRAND.surface }} />
      <div className="h-4 rounded w-32" style={{ backgroundColor: BRAND.surface }} />
    </div>
    <div className="h-8 rounded w-40 mb-3" style={{ backgroundColor: BRAND.surface }} />
    <div className="h-3 rounded w-24" style={{ backgroundColor: BRAND.surface }} />
  </div>
);

const ChartSkeleton = () => (
  <div className="animate-pulse p-6 bg-white rounded-2xl border h-96" style={{ borderColor: '#E5E7EB' }}>
    <div className="h-5 rounded w-40 mb-2" style={{ backgroundColor: BRAND.surface }} />
    <div className="h-3 rounded w-56 mb-8" style={{ backgroundColor: BRAND.surface }} />
    <div className="h-56 rounded-xl w-full" style={{ backgroundColor: BRAND.surface }} />
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center h-56 text-center p-6">
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: BRAND.surface }}>
      <BarChart3 className="w-7 h-7" style={{ color: BRAND.secondary }} />
    </div>
    <h3 className="text-slate-600 text-xs  mb-1" style={{ color: BRAND.text }}>{title}</h3>
    <p className="text-sm max-w-xs" style={{ color: BRAND.muted }}>{description}</p>
  </div>
);

// ========== KPI CARD ==========
const KpiCard = ({ title, value, subtitle, icon: Icon, accentColor, trend, loading, highlight = false }) => {
  if (loading) return <CardSkeleton />;
  const trendPositive = trend >= 0;
  return (
    <div
      className="relative p-6 bg-white rounded-2xl transition-all duration-200 hover:shadow-md overflow-hidden"
      style={{ border: `${highlight ? 2 : 1}px solid ${highlight ? accentColor : '#E5E7EB'}` }}
    >
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center ">
            <div className="w-10 h-5 rounded-lg flex items-center justify-center flex-shrink-0"
              >
              <Icon className="w-3 h-3" style={{ color: accentColor }} />
            </div>
            <span className="text-sm text-slate-600">{title}</span>
          </div>
          {trend !== undefined && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
              style={{ backgroundColor: trendPositive ? '#D1FAE5' : '#FEE2E2', color: trendPositive ? '#065F46' : '#991B1B' }}>
              {trendPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className="text-2xl  font-semibold font-sans mb-1" style={{ color: accentColor }}>
          {formatNumber(value)}
        </div>
        {subtitle && <div className="text-xs mt-1" style={{ color: BRAND.muted }}>{subtitle}</div>}
      </div>
    </div>
  );
};

// ========== CHART CARD ==========
const ChartCard = ({ title, subtitle, icon: Icon, children, loading, className = "" }) => {
  if (loading) return <ChartSkeleton />;
  return (
    <div className={`bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow duration-200 ${className}`}
      style={{ borderColor: '#E5E7EB' }}>
      <div className="px-6 py-4 border-b flex items-center gap-3 bg-brand-surface"
      >
        {Icon && (
          <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: BRAND.primary }}>
            <Icon className="w-3 h-3 text-white" />
          </div>
        )}
        <div>
          <h3 className=" text-sm text-slate-600" >{title}</h3>
          {subtitle && <p className="text-xs mt-0.5 text-slate-600" >{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
};

// ========== REVENUE ROW (with mini progress bar) ==========
const RevenueRow = ({ label, sub, value, color, pct }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm text-slate-600" >{label}</span>
        {sub && <span className="text-xs ml-2 text-slate-600" >{sub}</span>}
      </div>
      <span className="text-sm font-semibold font-sans" style={{ color }}>{formatNumber(value)}</span>
    </div>
    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
    </div>
  </div>
);

// ========== PROFIT SUMMARY ==========
const ProfitSummaryCard = ({ metrics, loading }) => {
  if (loading) return <ChartSkeleton />;
  const {
    interestRevenue, processingRevenue, registrationRevenue,
    penaltiesFromLoans, penaltiesFromInstallments,
    operationalCosts, totalRevenue, writeOffs, netProfit,
  } = metrics;
  const isProfitable = netProfit >= 0;
  const max = Math.max(totalRevenue, 1);

  const rows = [
    { label: 'Interest Paid', sub: 'loan_payments.interest_paid', value: interestRevenue, color: BRAND.accent },
    { label: 'Processing Fees', sub: 'loans.processing_fee', value: processingRevenue, color: BRAND.btn },
    { label: 'Registration Fees', sub: 'loans.registration_fee', value: registrationRevenue, color: BRAND.secondary },
    { label: 'Penalties (loan-level)', sub: 'loans.net_penalties accrued', value: penaltiesFromLoans, color: BRAND.warning },
    { label: 'Penalties (installments)', sub: 'installments.net_penalty', value: penaltiesFromInstallments, color: BRAND.danger },
    { label: 'Operational Costs', sub: 'Actual expenses', value: operationalCosts, color: BRAND.primary },
    { label: 'Write-offs', sub: 'Defaulted loans', value: writeOffs, color: '#B91C1C' },
  ];

  return (
    <div className="bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-shadow"
      style={{ borderColor: '#E5E7EB' }}>
      <div className="px-6 py-4 border-b flex items-center gap-3"
        style={{ borderColor: BRAND.surface, backgroundColor: BRAND.surface }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: BRAND.accent }}>
          <Target className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-sm text-slate-600" >Revenue & Cost Breakdown</h3>
          <p className="text-xs mt-0.5 text-slate-600" >All sources — period overview</p>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {rows.map(({ label, sub, value, color }) => (
          <RevenueRow key={label} label={label} sub={sub} value={value} color={color} pct={(value / max) * 100} />
        ))}

        <div className="h-px" style={{ backgroundColor: BRAND.surface }} />

        <div className="p-4 rounded-xl border-2"
          style={{
            backgroundColor: isProfitable ? '#D1FAE5' : '#FEE2E2',
            borderColor: isProfitable ? '#6EE7B7' : '#FCA5A5',
          }}>
          <div className="flex items-center justify-between mb-1.5">
            <div>
              <div className="text-sm font-bold" style={{ color: isProfitable ? '#065F46' : '#991B1B' }}>Net Profit</div>
              <div className="text-xs" style={{ color: isProfitable ? '#059669' : '#DC2626' }}>Revenue − Costs − Write-offs</div>
            </div>
            <div className="text-xl font-bold font-sans" style={{ color: isProfitable ? '#065F46' : '#991B1B' }}>
              {formatNumber(netProfit)}
            </div>
          </div>
          <div className="text-xs font-semibold" style={{ color: isProfitable ? '#059669' : '#DC2626' }}>
            {isProfitable ? '✓ Profitable this period' : '✗ Loss-making this period'}
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== SECTION HEADER ==========
const SectionHeader = ({ icon: Icon, title }) => (
  <div className="flex items-center mb-5">
    <div className="px-2 py-1.5 rounded-r-full flex items-center gap-2 shadow-sm bg-brand-primary" >
      <Icon className="w-2 h-2 text-xs text-white" strokeWidth={2.5} />
      <h2 className="text-white text-xs  whitespace-nowrap">{title}</h2>
    </div>
  </div>
);

// ========== CUSTOM TOOLTIP ==========
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-xl shadow-lg p-3 text-sm" style={{ borderColor: BRAND.surface }}>
      <p className="font-semibold mb-2 text-slate-600" >{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex items-center gap-1.5 text-slate-600" >
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="font-mono font-semibold text-slate-600" >{formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ========== FILTER BAR (sticky removed) ==========
const FilterBar = ({ filters, filterOptions, onFilterChange, loading, lastUpdated }) => {
  const [isCustomRange, setIsCustomRange] = useState(false);

  const handleDateRangeChange = (e) => {
    const val = e.target.value;
    setIsCustomRange(val === 'custom');
    onFilterChange('dateRange', val);
  };

  const selectBase = "pl-8 pr-2 py-1 h-8 rounded-lg text-[11px] font-bold border appearance-none outline-none cursor-pointer bg-white transition-all";

  return (
    <div className="bg-white border-b px-6 py-5" style={{ borderColor: BRAND.surface }}> {/* sticky removed */}
      <div className="w-full flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
            <Activity className="w-3 h-3 text-brand-primary" />
          <div>
            <h1 className="text-lg text-brand-primary" >Financial Dashboard</h1>
            
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-50">
          <div className="w-48">
            <CustomSelect
              value={filters.dateRange}
              onChange={(val) => handleDateRangeChange({ target: { value: val } })}
              options={[
                { value: 'all_time', label: 'All Time' },
                { value: 'mtd', label: 'Month to Date' },
                { value: 'qtd', label: 'Quarter to Date' },
                { value: 'ytd', label: 'Year to Date' },
                { value: 'custom', label: 'Custom Range' }
              ]}
              compact
            />
          </div>

          {isCustomRange && (
            <>
              <DatePicker selected={filters.startDate} onChange={(d) => onFilterChange('startDate', d)}
                selectsStart startDate={filters.startDate} endDate={filters.endDate}
                className="px-3 py-2 border rounded-xl text-sm w-36 outline-none" placeholderText="Start Date" />
              <span className="text-sm" style={{ color: BRAND.muted }}>to</span>
              <DatePicker selected={filters.endDate} onChange={(d) => onFilterChange('endDate', d)}
                selectsEnd startDate={filters.startDate} endDate={filters.endDate} minDate={filters.startDate}
                className="px-3 py-2 border rounded-xl text-sm w-36 outline-none" placeholderText="End Date" />
            </>
          )}

          <div className="w-48">
            <CustomSelect
              value={filters.region}
              onChange={(val) => onFilterChange('region', val)}
              options={[
                { value: 'all', label: 'All Regions' },
                ...filterOptions.regions.map(r => ({ value: r.id, label: r.name }))
              ]}
              compact
              searchable
            />
          </div>

          <div className="w-48">
            <CustomSelect
              value={filters.branch}
              onChange={(val) => onFilterChange('branch', val)}
              options={[
                { value: 'all', label: 'All Branches' },
                ...filterOptions.branches.map(b => ({ value: b.id, label: b.name }))
              ]}
              compact
              searchable
            />
          </div>

          <button onClick={() => onFilterChange('_refresh', true)} disabled={loading}
            className="flex items-center gap-2 px-3 h-8 rounded-lg text-[10px]  text-white transition-all hover:opacity-90 disabled:opacity-60 bg-brand-primary shadow-sm"
            >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
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

  const [filterOptions, setFilterOptions] = useState({ regions: [], branches: [] });
  const [filters, setFilters] = useState({
    dateRange: 'mtd',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Month to Date start
    endDate: new Date(),
    region: 'all',
    branch: 'all',
  });

  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [kpis, setKpis] = useState({
    interestPaid: 0,
    principalPaid: 0,
    penaltiesPaid: 0,
    totalPaymentsAmount: 0,
    processingFeesCharged: 0,
    registrationFeesCharged: 0,
    netPenaltiesOnLoans: 0,
    netPenaltiesOnInstallments: 0,
    outstandingPrincipal: 0,
    writeOffs: 0,
    totalRevenue: 0,
  });

  const [cashFlowData, setCashFlowData] = useState([]);
  const [portfolioTrend, setPortfolioTrend] = useState([]);
  const [pieBreakdown, setPieBreakdown] = useState([]);
  const [profitability, setProfitability] = useState({
    interestRevenue: 0, processingRevenue: 0, registrationRevenue: 0,
    penaltiesFromLoans: 0, penaltiesFromInstallments: 0,
    operationalCosts: 0, totalRevenue: 0, writeOffs: 0, netProfit: 0,
  });

  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (!tenant?.id) return;
    const load = async () => {
      const [regRes, brRes] = await Promise.all([
        supabase.from('regions').select('id, name').eq('tenant_id', tenant.id).order('name'),
        supabase.from('branches').select('id, name').eq('tenant_id', tenant.id).order('name'),
      ]);
      setFilterOptions({ regions: regRes.data || [], branches: brRes.data || [] });
    };
    load();
  }, [tenant?.id]);

  const fetchAll = useCallback(async (currentFilters, tenantId) => {
    if (!tenantId) return;
    const myId = ++fetchIdRef.current;
    setLoading(true);

    try {
      const { start, end } = resolveDateRange(currentFilters);
      const startStr = toKenyaDateStr(start);
      const endStr = toKenyaDateStr(end);

      // --- Robust Geo Filtering Logic ---
      let targetLoanIds = null;
      const filteringActive = currentFilters.region !== 'all' || currentFilters.branch !== 'all';
      
      if (filteringActive) {
        let q = supabase.from('loans').select('id').eq('tenant_id', tenantId);
        if (currentFilters.region !== 'all') q = q.eq('region_id', currentFilters.region);
        if (currentFilters.branch !== 'all') q = q.eq('branch_id', currentFilters.branch);
        const { data: loanIds } = await q;
        targetLoanIds = loanIds?.map(l => l.id) || [];
      }

      const geo = (q, table = null) => {
        if (!filteringActive) return q;

        // For tables that have loan_id, we filter by the resolved targetLoanIds
        const hasLoanId = ['loan_payments', 'loan_installments', 'loan_fees_log'].includes(table);
        if (hasLoanId) {
            if (targetLoanIds.length === 0) return q.eq('loan_id', -1); // Force empty if no loans in region
            return q.in('loan_id', targetLoanIds);
        }

        // For tables that have direct geo columns (loans, disbursements, etc)
        if (currentFilters.region !== 'all') q = q.eq('region_id', currentFilters.region);
        if (currentFilters.branch !== 'all') q = q.eq('branch_id', currentFilters.branch);
        return q;
      };

      const [
        paymentsRes,
        disbursedLoansRes,
        allDisbursedLoansRes,
        allPaymentsRes,
        writeOffsRes,
        cashDisbursementsRes,
        cashRepaymentsRes,
        portfolioLoansRes,
        portfolioPaymentsRes,
        installmentPenaltiesRes,
        operationalExpensesRes,
        feesLogRes,
      ] = await Promise.all([
        geo(supabase.from('loan_payments').select('paid_amount, interest_paid, principal_paid, penalty_paid, created_at, loan_id, payment_type, paid_at').eq('tenant_id', tenantId), 'loan_payments'),
        geo(supabase.from('loans').select('id, processing_fee, registration_fee, processing_fee_paid, registration_fee_paid, net_penalties, scored_amount, disbursed_at').eq('tenant_id', tenantId).eq('status', 'disbursed'), 'loans'),
        geo(supabase.from('loans').select('id, scored_amount').eq('tenant_id', tenantId).eq('status', 'disbursed'), 'loans'),
        geo(supabase.from('loan_payments').select('loan_id, paid_amount, principal_paid').eq('tenant_id', tenantId), 'loan_payments'),
        geo(supabase.from('loans').select('total_payable, disbursed_at').eq('tenant_id', tenantId).eq('status', 'disbursed').eq('repayment_state', 'defaulted'), 'loans'),
        geo(supabase.from('loans').select('scored_amount, disbursed_at').eq('tenant_id', tenantId).eq('status', 'disbursed'), 'loans'),
        geo(supabase.from('loan_payments').select('paid_amount, created_at, paid_at').eq('tenant_id', tenantId), 'loan_payments'),
        geo(supabase.from('loans').select('scored_amount, disbursed_at, status').eq('tenant_id', tenantId).order('disbursed_at'), 'loans'),
        geo(supabase.from('loan_payments').select('paid_amount, created_at, loan_id').eq('tenant_id', tenantId), 'loan_payments'),
        geo(supabase.from('loan_installments').select('net_penalty, loan_id, tenant_id, updated_at').eq('tenant_id', tenantId).gt('penalty_amount', 0), 'loan_installments'),
        supabase.from('operational_expenses').select('amount, date').eq('tenant_id', tenantId),
        geo(supabase.from('loan_fees_log').select('fee_type, paid_amount, created_at').eq('tenant_id', tenantId), 'loan_fees_log'),
      ]);

      if (fetchIdRef.current !== myId) return;

      // Aggregating Fees from log
      let processingFees = 0, registrationFees = 0;
      feesLogRes.data?.forEach(f => {
        const feeDate = toKenyaDateStr(f.created_at);
        if (feeDate >= startStr && feeDate <= endStr) {
            if (f.fee_type === 'processing') processingFees += Number(f.paid_amount) || 0;
            if (f.fee_type === 'registration') registrationFees += Number(f.paid_amount) || 0;
        }
      });

      // Aggregating Penalties from loans
      let netPenaltiesOnLoans = disbursedLoansRes.data?.reduce((s, l) => s + (Number(l.net_penalties) || 0), 0) ?? 0;

      // Payments aggregation
      let interestPaid = 0, principalPaid = 0, penaltiesPaid = 0, totalPaymentsAmount = 0;
      paymentsRes.data?.forEach(p => {
        const paidDate = toKenyaDateStr(p.paid_at || p.created_at);
        if (paidDate < startStr || paidDate > endStr) return;

        const paidAmt = Number(p.paid_amount) || 0;
        if (p.payment_type === 'interest') {
          interestPaid += paidAmt;
        } else if (p.payment_type === 'principal') {
          principalPaid += paidAmt;
        } else if (p.payment_type === 'penalty' || p.payment_type === 'penalties') {
          penaltiesPaid += paidAmt;
        } else {
          interestPaid += Number(p.interest_paid) || 0;
          principalPaid += Number(p.principal_paid) || 0;
          penaltiesPaid += Number(p.penalty_paid) || 0;
        }
        totalPaymentsAmount += paidAmt;
      });

      // Installment-level penalties
      const netPenaltiesOnInstallments = installmentPenaltiesRes.data?.reduce((s, i) => {
        const upDate = toKenyaDateStr(i.updated_at);
        return (upDate >= startStr && upDate <= endStr) ? s + (Number(i.net_penalty) || 0) : s;
      }, 0) ?? 0;

      // Outstanding principal
      const loanPrincipalPaidMap = {};
      allPaymentsRes.data?.forEach(p => {
        loanPrincipalPaidMap[p.loan_id] = (loanPrincipalPaidMap[p.loan_id] || 0) + (Number(p.principal_paid) || 0);
      });
      const outstandingPrincipal = allDisbursedLoansRes.data?.reduce((s, l) =>
        s + Math.max(0, (Number(l.scored_amount) || 0) - (loanPrincipalPaidMap[l.id] || 0)), 0
      ) ?? 0;

      // Write-offs
      const writeOffs = writeOffsRes.data?.reduce((s, l) => {
        const writeOffDate = toKenyaDateStr(l.disbursed_at);
        return (writeOffDate >= startStr && writeOffDate <= endStr) ? s + (Number(l.total_payable) || 0) : s;
      }, 0) ?? 0;

      // Total revenue
      const totalRevenue = interestPaid + processingFees + registrationFees + penaltiesPaid;

      // Operational costs (dynamic sum from table)
      const operationalCosts = operationalExpensesRes.data?.reduce((sum, row) => {
        const expDate = toKenyaDateStr(row.date);
        return (expDate >= startStr && expDate <= endStr) ? sum + (Number(row.amount) || 0) : sum;
      }, 0) ?? 0;

      setKpis({
        interestPaid, principalPaid, penaltiesPaid, totalPaymentsAmount,
        processingFeesCharged: processingFees,
        registrationFeesCharged: registrationFees,
        netPenaltiesOnLoans,
        netPenaltiesOnInstallments,
        outstandingPrincipal,
        writeOffs,
        totalRevenue,
      });

      // Cash flow
      const disByDay = {}, repByDay = {};
      cashDisbursementsRes.data?.forEach(l => {
        const d = l.disbursed_at?.split('T')[0];
        if (d) disByDay[d] = (disByDay[d] || 0) + (Number(l.scored_amount) || 0);
      });
      cashRepaymentsRes.data?.forEach(p => {
        const d = p.created_at?.split('T')[0];
        if (d) repByDay[d] = (repByDay[d] || 0) + (Number(p.paid_amount) || 0);
      });
      const allDates = Array.from(new Set([...Object.keys(disByDay), ...Object.keys(repByDay)])).sort();
      setCashFlowData(allDates.map(date => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        disbursements: disByDay[date] || 0,
        repayments: repByDay[date] || 0,
      })));

      // Portfolio trend
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
        if (d && dailyBalances[d] !== undefined)
          dailyBalances[d] -= Number(p.paid_amount) || 0;
      });
      setPortfolioTrend(
        Object.entries(dailyBalances)
          .sort(([a], [b]) => new Date(a) - new Date(b))
          .slice(-30)
          .map(([date, value]) => ({
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: Math.max(0, value),
          }))
      );

      // Revenue pie
      setPieBreakdown([
        { name: 'Interest', value: interestPaid, color: CHART_COLORS.interest },
        { name: 'Processing Fees', value: processingFees, color: CHART_COLORS.processing },
        { name: 'Reg. Fees', value: registrationFees, color: CHART_COLORS.registration },
        { name: 'Penalties', value: penaltiesPaid, color: CHART_COLORS.penalties },
      ].filter(i => i.value > 0));

      // Profitability (operationalCosts now from DB)
      setProfitability({
        interestRevenue: interestPaid,
        processingRevenue: processingFees,
        registrationRevenue: registrationFees,
        penaltiesFromLoans: netPenaltiesOnLoans,
        penaltiesFromInstallments: netPenaltiesOnInstallments,
        operationalCosts,           // dynamic value
        totalRevenue,
        writeOffs,
        netProfit: totalRevenue - operationalCosts - writeOffs,
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      if (fetchIdRef.current === myId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!tenant?.id) return;
    const t = setTimeout(() => fetchAll(filters, tenant.id), 300);
    return () => clearTimeout(t);
  }, [tenant?.id, filters, fetchAll]);

  const handleFilterChange = useCallback((key, value) => {
    if (key === '_refresh') { setFilters(prev => ({ ...prev, _ts: Date.now() })); return; }
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const tickFmt = (v) => v === 0 ? '0' : Number(v).toLocaleString();

  return (
<div className="min-h-screen bg-page">
        <FilterBar
        filters={filters} filterOptions={filterOptions}
        onFilterChange={handleFilterChange} loading={loading} lastUpdated={lastUpdated}
      />

      <div className="w-full px-6 py-8 space-y-10">

        {/* ═══ Section 1: Revenue KPIs ═══ */}
        <section>
          <SectionHeader icon={Banknote} title="Revenue & Income" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <KpiCard title="Total Revenue" value={kpis.totalRevenue}
              icon={DollarSign} accentColor={BRAND.primary} loading={loading} highlight />
            <KpiCard title="Interest Paid" value={kpis.interestPaid}
              icon={Percent} accentColor={BRAND.accent} loading={loading} />
            <KpiCard title="Processing Fees" value={kpis.processingFeesCharged}
              icon={Receipt} accentColor={BRAND.btn} loading={loading} />
            <KpiCard title="Registration Fees" value={kpis.registrationFeesCharged}
              icon={Landmark} accentColor={BRAND.secondary} loading={loading} />
          </div>
        </section>

        {/* ═══ Section 2: Penalties & Risk ═══ */}
        <section>
          <SectionHeader icon={AlertTriangle} title="Penalties & Risk" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <KpiCard title="Penalties Paid (Cash)" value={kpis.penaltiesPaid}
              icon={ShieldAlert} accentColor={BRAND.danger} loading={loading} />
            <KpiCard title="Accrued Penalties — Loans" value={kpis.netPenaltiesOnLoans}
              icon={AlertTriangle} accentColor={BRAND.warning} loading={loading} />
            <KpiCard title="Accrued Penalties — Installments" value={kpis.netPenaltiesOnInstallments}
              icon={AlertTriangle} accentColor='#f97316' loading={loading} />
            <KpiCard title="Write-offs" value={kpis.writeOffs}
              icon={TrendingDown} accentColor='#B91C1C' loading={loading} />
          </div>
        </section>

        {/* ═══ Section 3: Portfolio ═══ */}
        <section>
          <SectionHeader icon={CreditCard} title="Portfolio" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <KpiCard title="Outstanding Principal" value={kpis.outstandingPrincipal}
              icon={CreditCard} accentColor={BRAND.navy} loading={loading} />
            <KpiCard title="Principal Repaid" value={kpis.principalPaid}
              icon={TrendingUp} accentColor={BRAND.accent} loading={loading} />
            <KpiCard title="Total Payments Received" value={kpis.totalPaymentsAmount}
              icon={Banknote} accentColor={BRAND.primary} loading={loading} />
          </div>
        </section>

        {/* ═══ Section 4: Charts ═══ */}
        <section>
          <SectionHeader icon={BarChart3} title="Cash Flow & Portfolio Trend" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <ChartCard title="Cash Flow" subtitle="Disbursements vs Repayments — selected period" icon={BarChart3} loading={loading}>
              {cashFlowData.length === 0
                ? <EmptyState title="No Cash Flow Data" description="Appears once disbursements or repayments exist in the selected period." />
                : (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={cashFlowData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BRAND.surface} vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} dy={8} />
                      <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickFormatter={tickFmt} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} width={80} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                      <Bar dataKey="disbursements" name="Disbursements" fill={CHART_COLORS.disbursements} radius={[4, 4, 0, 0]} barSize={16} />
                      <Line type="monotone" dataKey="repayments" name="Repayments" stroke={CHART_COLORS.repayments}
                        strokeWidth={2.5} dot={{ strokeWidth: 2, r: 3, fill: 'white' }} activeDot={{ r: 5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
            </ChartCard>

            <ChartCard title="Portfolio Trend" subtitle="Cumulative outstanding balance — last 30 data points" icon={TrendingUp} loading={loading}>
              {portfolioTrend.length === 0
                ? <EmptyState title="No Portfolio Data" description="Appears once you have active loans." />
                : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={portfolioTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={BRAND.primary} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={BRAND.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={BRAND.surface} vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} dy={8} />
                      <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickFormatter={tickFmt} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} width={80} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="value" name="Portfolio Value"
                        stroke={BRAND.primary} strokeWidth={2.5} fill="url(#portfolioGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
            </ChartCard>
          </div>
        </section>

        {/* ═══ Section 5: Revenue Pie + Profitability ═══ */}
        <section>
          <SectionHeader icon={PieChartIcon} title="Revenue Composition & Profitability" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <ChartCard title="Revenue Composition" subtitle="Cash collected — by income type" icon={PieChartIcon} loading={loading}>
              {pieBreakdown.length === 0
                ? <EmptyState title="No Revenue Data" description="Breakdown appears once revenue exists for this period." />
                : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieBreakdown} cx="50%" cy="50%"
                          outerRadius={80} innerRadius={42}
                          dataKey="value" paddingAngle={3}
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {pieBreakdown.map((e, i) => (
                            <Cell key={i} fill={e.color} stroke="#FFF" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => formatNumber(v)} contentStyle={{ borderRadius: '12px', border: `1px solid ${BRAND.surface}` }} />
                        <Legend layout="vertical" verticalAlign="middle" align="right"
                          wrapperStyle={{ paddingLeft: '12px', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
            </ChartCard>

            <div className="lg:col-span-2">
              <ProfitSummaryCard metrics={profitability} loading={loading} />
            </div>
          </div>
        </section>

        {/* ═══ Footer ═══ */}
        
      </div>
    </div>
  );
};

export default FinancialDashboard;