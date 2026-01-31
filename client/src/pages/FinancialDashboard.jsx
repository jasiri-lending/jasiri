import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from "../supabaseClient";
import { 
  TrendingUp, TrendingDown, DollarSign, Percent, 
  Receipt, Wallet, AlertTriangle, Calendar,
  Filter, MapPin, Building, Package,
  ChevronDown, ChevronUp, RefreshCw,
  TrendingUp as LineChartIcon,
  PieChart as PieChartIcon,
  AreaChart as AreaChartIcon,
  BarChart3,
  ShieldAlert,
  CreditCard,
  Coins,
  Target
} from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

// Color System for Financial Dashboard - Using Tailwind colors
const FINANCIAL_COLORS = {
  primary: {
    income: '#10B981', // Emerald
    profit: '#059669',
    portfolio: '#3B82F6', // Blue
    assets: '#2563EB',
    fees: '#F59E0B', // Amber
    penalties: '#EF4444', // Red for penalties
    neutral: '#D97706',
    losses: '#DC2626',
    writeoffs: '#B91C1C',
    background: '#F9FAFB',
    cardBg: '#FFFFFF',
    surface: '#F3F4F6',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    border: '#E5E7EB'
  },
  charts: {
    disbursements: '#F97316', // Orange
    repayments: '#10B981', // Green
    interest: '#10B981',
    processingFees: '#F59E0B',
    penalties: '#EF4444',
    portfolioArea: '#3B82F6',
    areaGradient: 'url(#portfolioGradient)'
  }
};

// ========== UTILITY FUNCTIONS ==========
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return "0.00";
  const numAmount = Number(amount);
  
  // Format with K, M, B for large numbers
  if (numAmount >= 1000000000) {
    return `$${(numAmount / 1000000000).toFixed(1)}B`;
  }
  if (numAmount >= 1000000) {
    return `$${(numAmount / 1000000).toFixed(1)}M`;
  }
  if (numAmount >= 1000) {
    return `$${(numAmount / 1000).toFixed(1)}K`;
  }
  
  const parts = numAmount.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimalPart = parts[1];
  return `$${integerPart}.${decimalPart}`;
};

const getLocalYYYYMMDD = (d = new Date()) => {
  const date = new Date(d);
  const kenyaTime = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const year = kenyaTime.getUTCFullYear();
  const month = String(kenyaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kenyaTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const getQuarterStart = () => {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  return new Date(now.getFullYear(), quarter * 3, 1);
};

const getYearStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
};

// ========== REUSABLE COMPONENTS ==========

// Loading Skeleton Components
const CardSkeleton = () => (
  <div className="animate-pulse p-6 bg-white rounded-xl shadow-sm border border-gray-200">
    <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
    <div className="h-8 bg-gray-200 rounded w-2/3 mb-2"></div>
    <div className="h-3 bg-gray-100 rounded w-1/2"></div>
  </div>
);

const ChartSkeleton = () => (
  <div className="animate-pulse p-6 bg-white rounded-xl shadow-sm border border-gray-200 h-80">
    <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
    <div className="h-48 bg-gray-100 rounded w-full"></div>
  </div>
);

// Financial Stat Card Component - Updated with cleaner design
const FinancialStatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color = FINANCIAL_COLORS.primary.portfolio,
  trend,
  tooltip,
  loading = false 
}) => {
  if (loading) return <CardSkeleton />;
  
  return (
    <div 
      className="relative p-5 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 group hover:border-gray-200"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2.5 rounded-lg`} style={{ 
              backgroundColor: `${color}15`,
              border: `1px solid ${color}20`
            }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <span className="text-sm font-medium text-gray-600">{title}</span>
          </div>
          <div className="text-2xl font-bold mb-1" style={{ color }}>
            {formatCurrency(value)}
          </div>
          {subtitle && (
            <div className="text-sm text-gray-500">{subtitle}</div>
          )}
        </div>
        
        {trend !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${trend >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {trend >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span className="text-xs font-medium">{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      
      {tooltip && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-xs text-gray-400 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );
};

// Chart Card Wrapper - Updated with cleaner design
const ChartCard = ({ 
  title, 
  subtitle,
  icon: Icon, 
  children, 
  loading = false,
  className = "" 
}) => {
  if (loading) return <ChartSkeleton />;
  
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200 ${className}`}>
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-800 text-lg">{title}</h3>
                {subtitle && (
                  <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
};

// Profit Summary Card - Updated design
const ProfitSummaryCard = ({ metrics, loading = false }) => {
  if (loading) {
    return (
      <div className="animate-pulse bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex justify-between">
              <div className="h-3 bg-gray-100 rounded w-1/3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
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
          <p className="text-sm text-gray-500">Monthly performance overview</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <div>
            <span className="text-gray-600">Operational Costs</span>
            <p className="text-xs text-gray-400">Staff, utilities, etc.</p>
          </div>
          <span className="font-medium">{formatCurrency(operationalCosts)}</span>
        </div>
        
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <div>
            <span className="text-gray-600">Total Revenue</span>
            <p className="text-xs text-gray-400">Interest + Fees + Penalties</p>
          </div>
          <span className="font-medium text-green-600">{formatCurrency(totalRevenue)}</span>
        </div>
        
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <div>
            <span className="text-gray-600">Penalties Collected</span>
            <p className="text-xs text-gray-400">Late payment fees</p>
          </div>
          <span className="font-medium text-amber-600">{formatCurrency(penaltiesCollected)}</span>
        </div>
        
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <div>
            <span className="text-gray-600">Write-offs</span>
            <p className="text-xs text-gray-400">Unrecoverable loans</p>
          </div>
          <span className="font-medium text-red-600">{formatCurrency(writeOffs)}</span>
        </div>
        
        <div className="pt-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="font-semibold text-gray-800">Net Profit</span>
              <p className="text-xs text-gray-400">After all deductions</p>
            </div>
            <span 
              className={`text-2xl font-bold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}
            >
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

// Filter Bar Component - Made non-sticky
const GlobalFilterBar = ({ filters, onFilterChange }) => {
  const [isCustomRange, setIsCustomRange] = useState(false);
  
  const dateRanges = [
    { value: 'mtd', label: 'Month to Date' },
    { value: 'qtd', label: 'Quarter to Date' },
    { value: 'ytd', label: 'Year to Date' },
    { value: 'custom', label: 'Custom Range' }
  ];
  
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
          {/* Date Range Filter */}
          <div className="relative">
            <select
              value={filters.dateRange}
              onChange={(e) => {
                onFilterChange('dateRange', e.target.value);
                setIsCustomRange(e.target.value === 'custom');
              }}
              className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white hover:border-gray-400 transition-colors"
            >
              {dateRanges.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          </div>
          
          {/* Custom Date Range */}
          {isCustomRange && (
            <div className="flex gap-2">
              <DatePicker
                selected={filters.startDate}
                onChange={(date) => onFilterChange('startDate', date)}
                selectsStart
                startDate={filters.startDate}
                endDate={filters.endDate}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm w-36 hover:border-gray-400 transition-colors"
                placeholderText="Start Date"
              />
              <span className="flex items-center text-gray-400">to</span>
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
          
          {/* Region Filter */}
          <div className="relative">
            <select
              value={filters.region}
              onChange={(e) => onFilterChange('region', e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white hover:border-gray-400 transition-colors"
            >
              <option value="all">All Regions</option>
              {filters.regionOptions.map(region => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
            <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          </div>
          
          {/* Branch Filter */}
          <div className="relative">
            <select
              value={filters.branch}
              onChange={(e) => onFilterChange('branch', e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white hover:border-gray-400 transition-colors"
            >
              <option value="all">All Branches</option>
              {filters.branchOptions.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <Building className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={() => onFilterChange('refresh', true)}
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

// ========== MAIN FINANCIAL DASHBOARD COMPONENT ==========
const FinancialDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  // Filter states
  const [filters, setFilters] = useState({
    dateRange: 'mtd',
    startDate: getMonthStart(),
    endDate: new Date(),
    region: 'all',
    branch: 'all',
    loanProduct: 'all',
    regionOptions: [],
    branchOptions: [],
    productOptions: []
  });
  
  // Dashboard data states - Added penaltiesCollected
  const [financialKPIs, setFinancialKPIs] = useState({
    interestEarned: 0,
    processingFees: 0,
    penaltiesCollected: 0, // New field
    totalRevenue: 0,
    outstandingPrincipal: 0,
    writeOffs: 0
  });
  
  const [cashFlowData, setCashFlowData] = useState([]);
  const [revenueBreakdown, setRevenueBreakdown] = useState([]);
  const [portfolioTrend, setPortfolioTrend] = useState([]);
  const [profitability, setProfitability] = useState({
    operationalCosts: 0,
    totalRevenue: 0,
    writeOffs: 0,
    penaltiesCollected: 0,
    netProfit: 0
  });

  // Fetch filter options
  const fetchFilterOptions = async () => {
    try {
      const [regionsRes, branchesRes, productsRes] = await Promise.all([
        supabase.from('regions').select('id, name').order('name'),
        supabase.from('branches').select('id, name').order('name'),
        supabase.from('loan_products').select('id, name').order('name')
      ]);
      
      setFilters(prev => ({
        ...prev,
        regionOptions: regionsRes.data || [],
        branchOptions: branchesRes.data || [],
        productOptions: productsRes.data || []
      }));
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  // Calculate date range based on filter
  const getDateRange = useCallback(() => {
    const now = new Date();
    let startDate;
    
    switch (filters.dateRange) {
      case 'mtd':
        startDate = getMonthStart();
        break;
      case 'qtd':
        startDate = getQuarterStart();
        break;
      case 'ytd':
        startDate = getYearStart();
        break;
      case 'custom':
        startDate = filters.startDate;
        break;
      default:
        startDate = getMonthStart();
    }
    
    return {
      start: startDate,
      end: filters.dateRange === 'custom' ? filters.endDate : now
    };
  }, [filters]);

  // Fetch financial KPIs - Updated to separate penalties
  const fetchFinancialKPIs = async () => {
    try {
      const dateRange = getDateRange();
      const startDateStr = getLocalYYYYMMDD(dateRange.start);
      const endDateStr = getLocalYYYYMMDD(dateRange.end);
      
      // Fetch interest earned (from payments)
      const { data: paymentsData } = await supabase
        .from('loan_payments')
        .select('paid_amount, interest_paid')
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr);
      
      const interestEarned = paymentsData?.reduce((sum, payment) => 
        sum + (Number(payment.interest_paid) || 0), 0) || 0;
      
      // Fetch processing fees and penalties separately
      const { data: loansData } = await supabase
        .from('loans')
        .select('processing_fee, penalty_fee, disbursed_at')
        .gte('disbursed_at', startDateStr)
        .lte('disbursed_at', endDateStr);
      
      let processingFees = 0;
      let penaltiesCollected = 0;
      
      loansData?.forEach(loan => {
        processingFees += (Number(loan.processing_fee) || 0);
        penaltiesCollected += (Number(loan.penalty_fee) || 0);
      });
      
      // Fetch outstanding principal
      const { data: activeLoans } = await supabase
        .from('loans')
        .select('total_payable, disbursed_at')
        .eq('status', 'disbursed');
      
      const { data: allPayments } = await supabase
        .from('loan_payments')
        .select('paid_amount, loan_id');
      
      const loanPayments = {};
      allPayments?.forEach(payment => {
        loanPayments[payment.loan_id] = (loanPayments[payment.loan_id] || 0) + (Number(payment.paid_amount) || 0);
      });
      
      const outstandingPrincipal = activeLoans?.reduce((sum, loan) => {
        const paid = loanPayments[loan.id] || 0;
        const totalPayable = Number(loan.total_payable) || 0;
        return sum + Math.max(0, totalPayable - paid);
      }, 0) || 0;
      
      // Fetch write-offs
      const { data: writeOffsData } = await supabase
        .from('loans')
        .select('total_payable, defaulted_at')
        .eq('status', 'defaulted')
        .gte('defaulted_at', startDateStr)
        .lte('defaulted_at', endDateStr);
      
      const writeOffs = writeOffsData?.reduce((sum, loan) => 
        sum + (Number(loan.total_payable) || 0), 0) || 0;
      
      setFinancialKPIs({
        interestEarned,
        processingFees,
        penaltiesCollected,
        totalRevenue: interestEarned + processingFees + penaltiesCollected,
        outstandingPrincipal,
        writeOffs
      });
      
    } catch (error) {
      console.error('Error fetching financial KPIs:', error);
    }
  };

  // Fetch cash flow data
  const fetchCashFlowData = async () => {
    try {
      const dateRange = getDateRange();
      const startDateStr = getLocalYYYYMMDD(dateRange.start);
      const endDateStr = getLocalYYYYMMDD(dateRange.end);
      
      // Fetch disbursements by date
      const { data: disbursementsData } = await supabase
        .from('loans')
        .select('scored_amount, disbursed_at')
        .eq('status', 'disbursed')
        .gte('disbursed_at', startDateStr)
        .lte('disbursed_at', endDateStr);
      
      // Fetch repayments by date
      const { data: repaymentsData } = await supabase
        .from('loan_payments')
        .select('paid_amount, created_at')
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr);
      
      // Group by day
      const disbursementsByDay = {};
      const repaymentsByDay = {};
      
      disbursementsData?.forEach(loan => {
        const date = loan.disbursed_at?.split('T')[0];
        if (date) {
          disbursementsByDay[date] = (disbursementsByDay[date] || 0) + (Number(loan.scored_amount) || 0);
        }
      });
      
      repaymentsData?.forEach(payment => {
        const date = payment.created_at?.split('T')[0];
        if (date) {
          repaymentsByDay[date] = (repaymentsByDay[date] || 0) + (Number(payment.paid_amount) || 0);
        }
      });
      
      // Combine and format for chart
      const allDates = new Set([
        ...Object.keys(disbursementsByDay),
        ...Object.keys(repaymentsByDay)
      ]);
      
      const formattedData = Array.from(allDates)
        .sort()
        .map(date => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          disbursements: disbursementsByDay[date] || 0,
          repayments: repaymentsByDay[date] || 0
        }));
      
      setCashFlowData(formattedData);
      
    } catch (error) {
      console.error('Error fetching cash flow data:', error);
    }
  };

  // Fetch revenue breakdown - Updated to include penalties
  const fetchRevenueBreakdown = async () => {
    try {
      const dateRange = getDateRange();
      const startDateStr = getLocalYYYYMMDD(dateRange.start);
      const endDateStr = getLocalYYYYMMDD(dateRange.end);
      
      // Fetch interest payments
      const { data: paymentsData } = await supabase
        .from('loan_payments')
        .select('interest_paid')
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr);
      
      const interestIncome = paymentsData?.reduce((sum, payment) => 
        sum + (Number(payment.interest_paid) || 0), 0) || 0;
      
      // Fetch processing fees and penalties separately
      const { data: loansData } = await supabase
        .from('loans')
        .select('processing_fee, penalty_fee, disbursed_at')
        .gte('disbursed_at', startDateStr)
        .lte('disbursed_at', endDateStr);
      
      const processingFees = loansData?.reduce((sum, loan) => 
        sum + (Number(loan.processing_fee) || 0), 0) || 0;
      
      const penalties = loansData?.reduce((sum, loan) => 
        sum + (Number(loan.penalty_fee) || 0), 0) || 0;
      
      const breakdown = [
        { name: 'Interest Income', value: interestIncome, color: FINANCIAL_COLORS.charts.interest },
        { name: 'Processing Fees', value: processingFees, color: FINANCIAL_COLORS.charts.processingFees },
        { name: 'Penalties', value: penalties, color: FINANCIAL_COLORS.charts.penalties }
      ].filter(item => item.value > 0);
      
      setRevenueBreakdown(breakdown);
      
    } catch (error) {
      console.error('Error fetching revenue breakdown:', error);
    }
  };

  // Fetch portfolio trend
  const fetchPortfolioTrend = async () => {
    try {
      const { data: loansData } = await supabase
        .from('loans')
        .select('scored_amount, disbursed_at, status')
        .order('disbursed_at');
      
      const { data: paymentsData } = await supabase
        .from('loan_payments')
        .select('paid_amount, created_at, loan_id');
      
      const dailyBalances = {};
      let runningBalance = 0;
      
      loansData?.forEach(loan => {
        const date = loan.disbursed_at?.split('T')[0];
        if (date && loan.status === 'disbursed') {
          runningBalance += Number(loan.scored_amount) || 0;
          dailyBalances[date] = runningBalance;
        }
      });
      
      paymentsData?.forEach(payment => {
        const date = payment.created_at?.split('T')[0];
        if (date && dailyBalances[date] !== undefined) {
          dailyBalances[date] -= Number(payment.paid_amount) || 0;
        }
      });
      
      const formattedData = Object.entries(dailyBalances)
        .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
        .map(([date, value]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: Math.max(0, value)
        }));
      
      setPortfolioTrend(formattedData.slice(-30));
      
    } catch (error) {
      console.error('Error fetching portfolio trend:', error);
    }
  };

  // Calculate profitability - Updated to include penalties
  const calculateProfitability = useCallback(() => {
    const operationalCosts = financialKPIs.totalRevenue * 0.25;
    const netProfit = financialKPIs.totalRevenue - operationalCosts - financialKPIs.writeOffs;
    
    setProfitability({
      operationalCosts,
      totalRevenue: financialKPIs.totalRevenue,
      writeOffs: financialKPIs.writeOffs,
      penaltiesCollected: financialKPIs.penaltiesCollected,
      netProfit
    });
  }, [financialKPIs]);

  // Handle filter changes
  const handleFilterChange = (filterName, value) => {
    if (filterName === 'refresh') {
      fetchDashboardData();
      return;
    }
    
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchFinancialKPIs(),
        fetchCashFlowData(),
        fetchRevenueBreakdown(),
        fetchPortfolioTrend()
      ]);
      
      calculateProfitability();
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchFilterOptions();
    fetchDashboardData();
  }, []);

  // Refetch data when filters change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchDashboardData();
    }, 300);
    
    return () => clearTimeout(debounceTimer);
  }, [filters.dateRange, filters.startDate, filters.endDate, filters.region, filters.branch, filters.loanProduct]);

  // Empty states
  const renderEmptyState = (title, description) => (
    <div className="flex flex-col items-center justify-center h-64 text-center p-6">
      <div className="p-4 bg-gray-50 rounded-full mb-4 border border-gray-200">
        <BarChart3 className="w-10 h-10 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 max-w-md">{description}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <GlobalFilterBar 
        filters={filters} 
        onFilterChange={handleFilterChange} 
      />
      
      <div className="px-8 pb-8 max-w-7xl mx-auto">
        {/* Section 1: Top Financial KPI Cards - Updated with penalties */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="lg:col-span-2">
            <FinancialStatCard
              title="Total Revenue"
              value={financialKPIs.totalRevenue}
              subtitle="Interest + Fees + Penalties"
              icon={DollarSign}
              color={FINANCIAL_COLORS.primary.portfolio}
              trend={15.7}
              tooltip="Total revenue from all sources"
              loading={loading}
            />
          </div>
          
          <FinancialStatCard
            title="Interest Earned"
            value={financialKPIs.interestEarned}
            subtitle="From loan interest"
            icon={Percent}
            color={FINANCIAL_COLORS.primary.income}
            trend={12.5}
            tooltip="Interest income received during selected period"
            loading={loading}
          />
          
          <FinancialStatCard
            title="Processing Fees"
            value={financialKPIs.processingFees}
            subtitle="Loan origination fees"
            icon={Receipt}
            color={FINANCIAL_COLORS.primary.fees}
            trend={8.2}
            loading={loading}
          />
          
          <FinancialStatCard
            title="Penalties Collected"
            value={financialKPIs.penaltiesCollected}
            subtitle="Late payment fees"
            icon={ShieldAlert}
            color={FINANCIAL_COLORS.primary.penalties}
            trend={5.3}
            tooltip="Penalties from late payments"
            loading={loading}
          />
          
          <FinancialStatCard
            title="Outstanding Principal"
            value={financialKPIs.outstandingPrincipal}
            subtitle="Active loan portfolio"
            icon={CreditCard}
            color={FINANCIAL_COLORS.primary.assets}
            loading={loading}
          />
        </div>
        
        {/* Section 2: Cash Flow Chart */}
        <div className="mb-8">
          <ChartCard 
            title="Cash Flow Analysis" 
            subtitle="Disbursements vs Repayments"
            icon={LineChartIcon}
            loading={loading}
          >
            {cashFlowData.length === 0 ? (
              renderEmptyState(
                "No Cash Flow Data",
                "Cash flow data will appear here once you have disbursements and repayments in the selected period."
              )
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6B7280" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis 
                    stroke="#6B7280" 
                    fontSize={12}
                    tickFormatter={(value) => `$${(value/1000).toFixed(0)}K`}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <Tooltip 
                    formatter={(value) => [formatCurrency(value), 'Amount']}
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="disbursements" 
                    name="Disbursements" 
                    fill={FINANCIAL_COLORS.charts.disbursements}
                    radius={[4, 4, 0, 0]}
                    barSize={20}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="repayments" 
                    name="Repayments" 
                    stroke={FINANCIAL_COLORS.charts.repayments}
                    strokeWidth={3}
                    dot={{ strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Section 3: Revenue Breakdown */}
          <ChartCard 
            title="Revenue Breakdown" 
            subtitle="Distribution of income sources"
            icon={PieChartIcon}
            loading={loading}
          >
            {revenueBreakdown.length === 0 ? (
              renderEmptyState(
                "No Revenue Data",
                "Revenue breakdown will appear here once you have revenue in the selected period."
              )
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                      outerRadius={90}
                      innerRadius={40}
                      fill="#8884d8"
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {revenueBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend 
                      layout="vertical"
                      verticalAlign="middle"
                      align="right"
                      wrapperStyle={{ paddingLeft: '20px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
          
          {/* Section 4: Portfolio Value Trend */}
          <ChartCard 
            title="Portfolio Value Trend" 
            subtitle="30-day performance overview"
            icon={AreaChartIcon}
            loading={loading}
          >
            {portfolioTrend.length === 0 ? (
              renderEmptyState(
                "No Portfolio Data",
                "Portfolio trend will appear here once you have active loans."
              )
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={portfolioTrend}>
                    <defs>
                      <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={FINANCIAL_COLORS.charts.portfolioArea} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={FINANCIAL_COLORS.charts.portfolioArea} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6B7280" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={{ stroke: '#E5E7EB' }}
                    />
                    <YAxis 
                      stroke="#6B7280" 
                      fontSize={12}
                      tickFormatter={(value) => `$${(value/1000000).toFixed(1)}M`}
                      tickLine={false}
                      axisLine={{ stroke: '#E5E7EB' }}
                    />
                    <Tooltip 
                      formatter={(value) => [formatCurrency(value), 'Portfolio Value']}
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke={FINANCIAL_COLORS.charts.portfolioArea}
                      strokeWidth={3}
                      fill="url(#portfolioGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>
        
        {/* Section 5: Profitability Panel */}
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <ChartCard 
                title="Profitability Analysis" 
                subtitle="Revenue, Costs, and Write-offs"
                icon={BarChart3}
                loading={loading}
              >
                {financialKPIs.totalRevenue === 0 ? (
                  renderEmptyState(
                    "No Profitability Data",
                    "Profitability metrics will appear here once you have revenue and expense data."
                  )
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          {
                            name: 'Revenue',
                            value: profitability.totalRevenue,
                            fill: FINANCIAL_COLORS.charts.interest
                          },
                          {
                            name: 'Costs',
                            value: profitability.operationalCosts,
                            fill: FINANCIAL_COLORS.charts.penalties
                          },
                          {
                            name: 'Write-offs',
                            value: profitability.writeOffs,
                            fill: FINANCIAL_COLORS.primary.writeoffs
                          }
                        ]}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#6B7280"
                          tickLine={false}
                          axisLine={{ stroke: '#E5E7EB' }}
                        />
                        <YAxis 
                          stroke="#6B7280"
                          tickFormatter={(value) => `$${(value/1000).toFixed(0)}K`}
                          tickLine={false}
                          axisLine={{ stroke: '#E5E7EB' }}
                        />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Bar 
                          dataKey="value" 
                          radius={[6, 6, 0, 0]}
                          barSize={60}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>
            </div>
            
            <ProfitSummaryCard 
              metrics={profitability}
              loading={loading}
            />
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {loading ? 'Loading data...' : 'All systems operational'}
                </span>
              </div>
              <button
                onClick={fetchDashboardData}
                disabled={loading}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border ${loading ? 'text-gray-400 border-gray-200' : 'text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100'} transition-colors`}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
              Last updated: {lastUpdated.toLocaleDateString('en-KE', { 
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;