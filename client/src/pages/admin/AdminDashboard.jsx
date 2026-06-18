import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  FileText,
  DollarSign,
  AlertTriangle,
  Coins,
  Building,
  RefreshCw,
  Search,
  Plus,
  Eye,
  MoreVertical,
  Banknote,
  ChevronRight,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  TrendingUp,
  TrendingDown,
  Home,
  MapPin,
} from 'lucide-react';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfDay, startOfMonth, startOfQuarter, startOfYear, endOfMonth } from 'date-fns';
import CustomSelect from '../../components/CustomSelect';

// Full currency formatting (no abbreviations)
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return "0.00";
  const numAmount = Number(amount);
  const parts = numAmount.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, ",");
  return `${integerPart}.${parts[1]}`;
};

// Skeleton Loading Components
const SkeletonStatCard = () => (
  <div className="relative rounded-2xl shadow-lg p-6 overflow-hidden bg-gradient-to-br from-slate-100/60 to-gray-200/60 border border-white/20">
    <div className="space-y-3">
      <div className="h-4 w-32 bg-slate-200 rounded-md animate-pulse" />
      <div className="h-8 w-40 bg-slate-200 rounded-lg animate-pulse" />
      <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
      <div className="h-3 w-36 bg-slate-200 rounded animate-pulse" />
    </div>
    <div className="absolute top-6 right-6 p-3 rounded-xl bg-slate-200 animate-pulse">
      <div className="h-5 w-5" />
    </div>
  </div>
);

const SkeletonTableRow = () => (
  <tr>
    <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-slate-200 animate-pulse" /><div className="space-y-2"><div className="h-4 w-28 bg-slate-200 rounded animate-pulse" /><div className="h-3 w-16 bg-slate-200 rounded animate-pulse" /></div></div></td>
    <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-200 rounded animate-pulse" /></td>
    <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-200 rounded animate-pulse" /></td>
    <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-200 rounded animate-pulse" /></td>
    <td className="px-6 py-4"><div className="h-4 w-16 bg-slate-200 rounded animate-pulse" /></td>
  </tr>
);

// Stat Card Component with Gradient Design
const StatCard = ({
  name,
  value,
  change,
  icon: Icon,
  gradient,
  changeType,
  description,
  loading,
  secondaryValue
}) => {
  return (
    <div className={`relative rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 overflow-hidden group ${gradient} border border-white/20`}>
      {/* Animated background effect */}
      <div className="absolute inset-0 bg-brand-surface opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
              {name}
            </p>
            <div className="flex items-baseline gap-2 mb-1">
              <div className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--color-text-heading)" }}>
                {loading ? (
                  <div className="h-8 w-32 bg-white/40 rounded-lg animate-pulse"></div>
                ) : (
                  value
                )}
              </div>
              {change && (
                <span className={`text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur-sm ${changeType === 'positive'
                  ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-700 border border-rose-500/20'
                  }`}>
                  {changeType === 'positive' ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {change}
                </span>
              )}
            </div>
            {secondaryValue && (
              <p className="text-xs mb-2 font-medium" style={{ color: "var(--color-text-muted)" }}>
                {secondaryValue}
              </p>
            )}
            <p className="text-xs mt-3 font-medium" style={{ color: "var(--color-text-muted)" }}>
              {description}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0">
            <div className="p-3 rounded-xl bg-white/30 backdrop-blur-sm shadow-lg border border-white/20">
              <Icon className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Time Period Selector Component
const TimePeriodSelector = ({ value, onChange }) => {
  const periods = [
    { value: 'all_time', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div className="min-w-[150px]">
      <CustomSelect
        value={value}
        onChange={onChange}
        placeholder="Select Period"
        options={periods}
        compact
      />
    </div>
  );
};

const AdminDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState('all_time');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [hasFetched, setHasFetched] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Filter states
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [allBranches, setAllBranches] = useState([]);

  const userRole = profile?.role;
  const currentUserTenantId = profile?.tenant_id;

  // Kenya Date Utilities for synchronization
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

  // Get date range strings for Supabase queries
  const getDateRangeStrings = useCallback(() => {
    const now = new Date();
    let start;
    let end = now;

    switch (timePeriod) {
      case 'all_time':
        start = new Date(2000, 0, 1);
        break;
      case 'today':
        start = startOfDay(now);
        break;
      case 'week':
        start = subDays(now, 7);
        break;
      case 'month':
        start = getMonthStart();
        break;
      case 'quarter':
        start = getQuarterStart();
        break;
      case 'year':
        start = getYearStart();
        break;
      case 'custom':
        start = new Date(startDate);
        end = new Date(endDate);
        break;
      default:
        start = getMonthStart();
    }

    return {
      startStr: toKenyaDateStr(start),
      endStr: toKenyaDateStr(end),
      start: start,
      end: end
    };
  }, [timePeriod, startDate, endDate]);

  // Filter tenants when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTenants(tenants.slice(0, 5));
    } else {
      const filtered = tenants.filter(tenant =>
        tenant.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.tenant_slug?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTenants(filtered);
    }
  }, [searchQuery, tenants]);

  // Initialize data fetch
  useEffect(() => {
    const initializeDashboard = async () => {
      if (profile && !hasFetched) {
        setHasFetched(true);
        await fetchFiltersData();
        await fetchDashboardData();
        if (userRole === 'superadmin') {
          await fetchTenants();
        }
      }
    };

    initializeDashboard();
  }, [profile, hasFetched]);

  // Refresh data when time period or filters change
  useEffect(() => {
    if (profile && hasFetched) {
      fetchDashboardData();
    }
  }, [timePeriod, selectedRegion, selectedBranch, startDate, endDate]);

  // Helper function to get tenant user IDs
  const getTenantUserIds = useCallback(async () => {
    try {
      if (userRole === 'superadmin') {
        const { data } = await supabase.from('users').select('id');
        return data?.map(u => u.id) || [];
      } else {
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('tenant_id', currentUserTenantId);
        return data?.map(u => u.id) || [];
      }
    } catch (error) {
      console.error('Error fetching user IDs:', error);
      return [];
    }
  }, [userRole, currentUserTenantId]);

  // Fetch regions and branches for filter dropdowns
  const fetchFiltersData = useCallback(async () => {
    if (!currentUserTenantId || userRole === 'superadmin') return;
    try {
      const [{ data: regionsData }, { data: branchesData }] = await Promise.all([
        supabase.from('regions').select('id, name').eq('tenant_id', currentUserTenantId).order('name'),
        supabase.from('branches').select('id, name, region_id').eq('tenant_id', currentUserTenantId).order('name'),
      ]);
      setAvailableRegions(regionsData || []);
      setAllBranches(branchesData || []);
      setAvailableBranches(branchesData || []);
    } catch (err) {
      console.error('Error fetching filter data:', err);
    }
  }, [currentUserTenantId, userRole]);

  // Cascade branch filter based on region
  const handleRegionChange = useCallback((regionId) => {
    setSelectedRegion(regionId);
    setSelectedBranch('all');
    if (regionId === 'all') {
      setAvailableBranches(allBranches);
    } else {
      setAvailableBranches(allBranches.filter(b => b.region_id === regionId));
    }
  }, [allBranches]);

  const handleBranchChange = useCallback((branchId) => {
    setSelectedBranch(branchId);
  }, []);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setDashboardLoading(true);
      setFetchError(null);

      const { startStr, endStr } = getDateRangeStrings();
      const userIds = await getTenantUserIds();

      // Fetch all data in parallel
      const [
        totalTenants,
        totalUsers,
        totalCustomers,
        totalLoans,
        disbursedStats,
        outstandingStats,
        revenueStats,
        collectionsAmount,
      ] = await Promise.all([
        userRole === 'superadmin' ? fetchTotalTenants() : Promise.resolve(0),
        fetchTotalUsers(userIds),
        fetchTotalCustomers(userIds),
        fetchTotalLoans(userIds),
        fetchDisbursedStats(userIds, startStr, endStr),
        fetchOutstandingStats(userIds),
        fetchRevenueStats(userIds, startStr, endStr),
        fetchCollectionsAmount(userIds, startStr, endStr),
      ]);

      // Calculate changes (simplified - in production you would fetch historical data)
      const statsArray = [];

      if (userRole === 'superadmin') {
        statsArray.push({
          name: 'Total Tenants',
          value: totalTenants.toLocaleString(),

          icon: Building,
          gradient: 'bg-gradient-to-br from-violet-100/60 to-purple-200/60',

          description: 'Active SaaS tenants',
        });
      }

      // Core stats
      statsArray.push(
        {
          name: 'Total Users',
          value: totalUsers.toLocaleString(),

          icon: Users,
          gradient: 'bg-gradient-to-br from-blue-100/60 to-cyan-200/60',
          description: 'System users',
        },
        {
          name: 'Total Customers',
          value: totalCustomers.toLocaleString(),

          icon: Shield,
          gradient: 'bg-gradient-to-br from-emerald-100/60 to-green-200/60',
          description: 'Registered customers',
        },
        {
          name: 'Total Loans',
          value: totalLoans.toLocaleString(),

          icon: FileText,
          gradient: 'bg-gradient-to-br from-purple-100/60 to-pink-200/60',

          description: 'All loan applications',
        }
      );

      // Financial stats
      const financialStats = [
        {
          name: 'Disbursed Amount',
          value: formatCurrency(disbursedStats.amount),
          secondaryValue: `${disbursedStats.count.toLocaleString()} loans`,
          icon: DollarSign,
          gradient: 'bg-gradient-to-br from-amber-100/60 to-orange-200/60',
          changeType: 'positive',
          description: 'Total amount disbursed',
        },
        {
          name: 'Outstanding Balance',
          value: formatCurrency(outstandingStats.amount),
          icon: AlertTriangle,
          gradient: 'bg-gradient-to-br from-rose-100/60 to-red-200/60',
          description: 'Pending collection',
        },
        {
          name: 'Total Revenue',
          value: formatCurrency(revenueStats.amount),
          icon: Coins,
          gradient: 'bg-gradient-to-br from-yellow-100/60 to-amber-200/60',
          description: 'Fees & interest earned',
        },
        {
          name: 'Collections',
          value: formatCurrency(collectionsAmount),
          icon: Banknote,
          gradient: 'bg-gradient-to-br from-teal-100/60 to-emerald-200/60',
          description: 'Amount collected this period',
        },
      ];

      setStats([...statsArray, ...financialStats]);
      setLastRefresh(new Date());

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setFetchError('Failed to load dashboard data. Please try again.');
    } finally {
      setDashboardLoading(false);
    }
  }, [userRole, currentUserTenantId, getDateRangeStrings, getTenantUserIds, selectedRegion, selectedBranch]);

  // Individual data fetch functions
  const fetchTotalTenants = useCallback(async () => {
    const { count } = await supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true });
    return count || 0;
  }, []);

  const fetchTotalUsers = useCallback(async (userIds) => {
    if (userRole === 'superadmin') {
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true });
      return count || 0;
    }
    return userIds.length;
  }, [userRole]);

  const fetchTotalCustomers = useCallback(async (userIds) => {
    if (userIds.length === 0) return 0;
    let query = supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .in('created_by', userIds);
    if (selectedRegion !== 'all') query = query.eq('region_id', selectedRegion);
    if (selectedBranch !== 'all') query = query.eq('branch_id', selectedBranch);
    const { count } = await query;
    return count || 0;
  }, [selectedRegion, selectedBranch]);

  const fetchTotalLoans = useCallback(async (userIds) => {
    if (userIds.length === 0) return 0;
    let query = supabase
      .from('loans')
      .select('id', { count: 'exact', head: true })
      .in('booked_by', userIds);
    if (selectedRegion !== 'all') query = query.eq('region_id', selectedRegion);
    if (selectedBranch !== 'all') query = query.eq('branch_id', selectedBranch);
    const { count } = await query;
    return count || 0;
  }, [selectedRegion, selectedBranch]);

  const fetchDisbursedStats = useCallback(async (userIds, startStr, endStr) => {
    if (userIds.length === 0) return { count: 0, amount: 0 };

    let query = supabase
      .from('loans')
      .select('scored_amount')
      .eq('status', 'disbursed')
      .in('booked_by', userIds)
      .gte('disbursed_at', startStr)
      .lte('disbursed_at', endStr);
    if (selectedRegion !== 'all') query = query.eq('region_id', selectedRegion);
    if (selectedBranch !== 'all') query = query.eq('branch_id', selectedBranch);
    const { data } = await query;

    return {
      count: data?.length || 0,
      amount: data?.reduce((sum, loan) => sum + (loan.scored_amount || 0), 0) || 0,
    };
  }, [selectedRegion, selectedBranch]);

  const fetchOutstandingStats = useCallback(async (userIds) => {
    if (userIds.length === 0) return { amount: 0 };

    let query = supabase
      .from('loans')
      .select('id, total_payable')
      .eq('status', 'disbursed')
      .in('booked_by', userIds);
    if (selectedRegion !== 'all') query = query.eq('region_id', selectedRegion);
    if (selectedBranch !== 'all') query = query.eq('branch_id', selectedBranch);
    const { data: loans } = await query;

    if (!loans || loans.length === 0) return { amount: 0 };

    const loanIds = loans.map(loan => loan.id);
    const { data: payments } = await supabase
      .from('loan_payments')
      .select('loan_id, paid_amount')
      .in('loan_id', loanIds);

    const loanPayments = {};
    payments?.forEach(payment => {
      loanPayments[payment.loan_id] = (loanPayments[payment.loan_id] || 0) + (payment.paid_amount || 0);
    });

    const totalOutstanding = loans.reduce((total, loan) => {
      const paid = loanPayments[loan.id] || 0;
      return total + Math.max(0, (loan.total_payable || 0) - paid);
    }, 0);

    return { amount: totalOutstanding };
  }, [selectedRegion, selectedBranch]);

  const fetchRevenueStats = useCallback(async (userIds, startStr, endStr) => {
    if (userIds.length === 0) return { amount: 0 };

    // 1. Fetch fees from disbursed loans in period (Generated Revenue)
    let loanFeeQuery = supabase
      .from('loans')
      .select('processing_fee, registration_fee')
      .eq('status', 'disbursed')
      .in('booked_by', userIds)
      .gte('disbursed_at', startStr)
      .lte('disbursed_at', endStr);
    if (selectedRegion !== 'all') loanFeeQuery = loanFeeQuery.eq('region_id', selectedRegion);
    if (selectedBranch !== 'all') loanFeeQuery = loanFeeQuery.eq('branch_id', selectedBranch);

    // 2. Fetch actual interest and penalties paid (Collected Revenue)
    let loanIdQuery = supabase
      .from('loans')
      .select('id')
      .in('booked_by', userIds);
    if (selectedRegion !== 'all') loanIdQuery = loanIdQuery.eq('region_id', selectedRegion);
    if (selectedBranch !== 'all') loanIdQuery = loanIdQuery.eq('branch_id', selectedBranch);

    const [{ data: loanFees }, { data: filterLoans }] = await Promise.all([
      loanFeeQuery,
      loanIdQuery
    ]);

    const loanIds = filterLoans?.map(l => l.id) || [];
    let collectedTotal = 0;

    if (loanIds.length > 0) {
      const { data: payments } = await supabase
        .from('loan_payments')
        .select('paid_amount, payment_type, interest_paid, penalty_paid')
        .in('loan_id', loanIds)
        .gte('created_at', startStr + 'T00:00:00Z')
        .lte('created_at', endStr + 'T23:59:59Z');

      collectedTotal = payments?.reduce((sum, p) => {
        const paidAmt = Number(p.paid_amount) || 0;
        if (p.payment_type === 'interest') return sum + paidAmt;
        if (p.payment_type === 'penalty' || p.payment_type === 'penalties') return sum + paidAmt;
        return sum + (Number(p.interest_paid) || 0) + (Number(p.penalty_paid) || 0);
      }, 0) || 0;
    }

    const feesTotal = loanFees?.reduce((sum, loan) =>
      sum + (loan.processing_fee || 0) + (loan.registration_fee || 0), 0) || 0;

    return { amount: feesTotal + collectedTotal };
  }, [selectedRegion, selectedBranch]);

  const fetchCollectionsAmount = useCallback(async (userIds, startStr, endStr) => {
    if (userIds.length === 0) return 0;

    // Get relevant loan IDs first
    let loanIdQuery = supabase
      .from('loans')
      .select('id')
      .in('booked_by', userIds);
    if (selectedRegion !== 'all') loanIdQuery = loanIdQuery.eq('region_id', selectedRegion);
    if (selectedBranch !== 'all') loanIdQuery = loanIdQuery.eq('branch_id', selectedBranch);
    const { data: filterLoans } = await loanIdQuery;
    const loanIds = filterLoans?.map(l => l.id) || [];

    if (loanIds.length === 0) return 0;

    const { data } = await supabase
      .from('loan_payments')
      .select('paid_amount')
      .in('loan_id', loanIds)
      .gte('created_at', startStr + 'T00:00:00Z')
      .lte('created_at', endStr + 'T23:59:59Z');

    return data?.reduce((sum, payment) => sum + (payment.paid_amount || 0), 0) || 0;
  }, [selectedRegion, selectedBranch]);


  // Fetch tenants list
  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenants(data || []);
      setFilteredTenants(data?.slice(0, 5) || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Event handlers
  const handleViewTenant = useCallback((tenant) => {
    navigate(`/tenants_details/${tenant.id}`);
  }, [navigate]);

  const handleAddTenant = useCallback(() => {
    navigate('/users/create-tenant/admin');
  }, [navigate]);



  const handleTimePeriodChange = useCallback((period) => {
    setTimePeriod(period);
  }, []);

  // Loading state - now uses skeleton instead of spinner
  if (dashboardLoading && !stats.length) {
    return (
      <div className="min-h-screen bg-surface py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header skeleton */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/80 border border-gray-200"><div className="h-6 w-6 bg-slate-200 rounded animate-pulse" /></div>
              <div className="space-y-2"><div className="h-4 w-40 bg-slate-200 rounded animate-pulse" /><div className="h-3 w-28 bg-slate-200 rounded animate-pulse" /></div>
            </div>
            <div className="h-10 w-64 bg-slate-200 rounded-xl animate-pulse" />
          </div>
          {/* Stat cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => <SkeletonStatCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">


        {/* Filters Bar */}
        <div className="mb-6 px-4 py-3 mt-2 bg-card rounded-2xl border border-border shadow-sm">
          <div className="flex flex-wrap gap-3 items-center">
            <TimePeriodSelector value={timePeriod} onChange={handleTimePeriodChange} />

            {timePeriod === 'custom' && (
              <div className="flex items-center gap-2 bg-surface p-1.5 rounded-xl border border-border-light">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 text-xs border border-border-light rounded-lg outline-none focus:ring-1 focus:ring-brand bg-white"
                />
                <span className="text-muted text-xs">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1 text-xs border border-border-light rounded-lg outline-none focus:ring-1 focus:ring-brand bg-white"
                />
              </div>
            )}

            {userRole !== 'superadmin' && (
              <>
                <div className="h-6 w-px bg-slate-200" />
                <div className="min-w-[150px]">
                  <CustomSelect
                    value={selectedRegion}
                    onChange={handleRegionChange}
                    placeholder="All Regions"
                    compact
                    options={[
                      { value: 'all', label: 'All Regions' },
                      ...availableRegions.map(r => ({ value: r.id, label: r.name }))
                    ]}
                  />
                </div>
                <div className="min-w-[150px]">
                  <CustomSelect
                    value={selectedBranch}
                    onChange={handleBranchChange}
                    placeholder="All Branches"
                    compact
                    options={[
                      { value: 'all', label: 'All Branches' },
                      ...availableBranches.map(b => ({ value: b.id, label: b.name }))
                    ]}
                  />
                </div>
                {(selectedRegion !== 'all' || selectedBranch !== 'all') && (
                  <button
                    onClick={() => { setSelectedRegion('all'); setSelectedBranch('all'); setAvailableBranches(allBranches); }}
                    className="px-3 py-1.5 bg-danger hover:bg-danger/90 text-white font-semibold text-xs rounded-md shadow-sm transition-all active:scale-95 whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {fetchError && (
          <div className="mb-6 p-4 bg-danger-fill/20 border border-danger/30 rounded-xl"
            style={{ borderLeftColor: "var(--color-danger-text)", borderLeftWidth: '4px' }}>
            <p className="text-sm font-medium flex items-center gap-2" style={{ color: "var(--color-danger-text)" }}>
              <AlertTriangle className="h-4 w-4" />
              {fetchError}
            </p>
          </div>
        )}

        {/* Search Bar (Superadmin only) */}
        {userRole === 'superadmin' && (
          <div className="mb-8">
            <div className="bg-card rounded-2xl shadow-sm p-5 border border-border">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 max-w-2xl">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: "var(--color-brand)" }} />
                    <input
                      type="text"
                      placeholder="Search tenants by name, company, or slug..."
                      className="pl-12 pr-4 py-3 w-full border border-border bg-surface text-heading placeholder:text-muted/60 rounded-xl focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 shadow-sm transition-all font-outfit text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  onClick={() => navigate('/users/create-tenant/admin?openForm=true')}
                  className="px-5 py-3 text-white bg-brand hover:bg-brand/90 rounded-xl transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-2 shadow-lg"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">Add New Tenant</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Grid */}
        <div className="mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} loading={dashboardLoading} />
            ))}
          </div>
        </div>

        {/* Tenant Management (Superadmin only) */}
        {userRole === 'superadmin' && (
          <div className="mb-10">
            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-border bg-surface">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: "var(--color-text-heading)" }}>Tenant Management</h2>
                    <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                      {searchQuery ? `Search results for "${searchQuery}"` : 'Recently added tenants'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm px-3 py-2 bg-card rounded-lg border border-border">
                    <Calendar className="h-4 w-4" style={{ color: "var(--color-brand)" }} />
                    <span style={{ color: "var(--color-text-muted)" }}>
                      Showing {filteredTenants.length} of {tenants.length} tenants
                    </span>
                  </div>
                </div>
              </div>

              {/* Table */}
              {loading ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <tbody className="divide-y divide-border">
                      {[...Array(5)].map((_, i) => <SkeletonTableRow key={i} />)}
                    </tbody>
                  </table>
                </div>
              ) : filteredTenants.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead>
                      <tr className="bg-surface/50">
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                          Tenant Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                          Company
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                          Slug
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                          Created
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredTenants.map((tenant) => (
                        <tr key={tenant.id} className="hover:bg-surface/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {tenant.logo_url ? (
                                <img
                                  src={tenant.logo_url}
                                  alt={tenant.name}
                                  className="h-10 w-10 rounded-xl object-cover border border-border"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-brand/10 border border-border">
                                  <Building className="h-5 w-5" style={{ color: "var(--color-brand)" }} />
                                </div>
                              )}
                              <div>
                                <div className="font-semibold" style={{ color: "var(--color-text-heading)" }}>{tenant.name}</div>
                                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                  {tenant.status || 'Active'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div style={{ color: "var(--color-text-body)" }}>{tenant.company_name || '—'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <code className="text-xs px-2 py-1 bg-surface border border-border-light rounded font-medium" style={{ color: "var(--color-brand)" }}>
                              {tenant.tenant_slug}
                            </code>
                          </td>
                          <td className="px-6 py-4">
                            <div style={{ color: "var(--color-text-body)" }}>
                              {format(new Date(tenant.created_at), 'MMM d, yyyy')}
                            </div>
                            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                              {format(new Date(tenant.created_at), 'h:mm a')}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleViewTenant(tenant)}
                                className="px-3 py-2 rounded-lg text-brand hover:bg-surface transition-colors flex items-center gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                <span className="text-sm font-medium">View</span>
                              </button>
                              <button className="p-2 hover:bg-surface rounded-lg transition-colors">
                                <MoreVertical className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-20 h-20 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
                    <Building className="h-10 w-10" style={{ color: "var(--color-brand)" }} />
                  </div>
                  <p className="font-semibold" style={{ color: "var(--color-text-heading)" }}>No tenants found</p>
                  <p className="text-sm mt-2" style={{ color: "var(--color-text-muted)" }}>
                    {searchQuery ? 'Try a different search term' : 'Add your first tenant to get started'}
                  </p>
                </div>
              )}

              {/* Footer */}
              {filteredTenants.length > 0 && (
                <div className="px-6 py-4 border-t border-border bg-surface/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                      {searchQuery
                        ? `Found ${filteredTenants.length} matching tenants`
                        : `Showing ${Math.min(5, filteredTenants.length)} of ${tenants.length} tenants`
                      }
                    </p>
                    <button
                      onClick={() => navigate('/users/create-tenant/admin')}
                      className="text-sm font-medium flex items-center gap-2 px-4 py-2 rounded-lg text-brand hover:bg-surface transition-colors"
                    >
                      View All Tenants
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Last Updated Footer */}
        <div className="mt-8 pt-6 border-t border-border-light">
          <div className="flex items-center justify-center gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            <Calendar className="h-4 w-4" />
            <span>
              Dashboard updated: {format(lastRefresh, 'MMM d, yyyy • h:mm a')}
            </span>
            <span className="mx-2">•</span>
            <span>
              Time period: <span className="font-medium text-heading">{timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;