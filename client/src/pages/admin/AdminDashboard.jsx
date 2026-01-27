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
  Loader2,
  Shield,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { useNavigate } from 'react-router-dom';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

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
            <p className="text-sm font-semibold mb-2 tracking-wide" style={{ color: "#586ab1" }}>
              {name}
            </p>
            <div className="flex items-baseline gap-2 mb-1">
              <p className="text-2xl font-bold tracking-tight" style={{ color: "#586ab1" }}>
                {loading ? (
                  <div className="h-8 w-32 bg-white/40 rounded-lg animate-pulse"></div>
                ) : (
                  value
                )}
              </p>
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
              <p className="text-xs mb-2" style={{ color: "#586ab1", opacity: 0.7 }}>
                {secondaryValue}
              </p>
            )}
            <p className="text-xs mt-3" style={{ color: "#586ab1", opacity: 0.8 }}>
              {description}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0">
            <div className="p-3 rounded-xl bg-white/30 backdrop-blur-sm shadow-lg border border-white/20">
              <Icon className="h-5 w-5" style={{ color: "#586ab1" }} />
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
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'quarter', label: 'This Quarter' },
    { id: 'year', label: 'This Year' },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200">
      {periods.map((period) => (
        <button
          key={period.id}
          onClick={() => onChange(period.id)}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${value === period.id
            ? 'text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          style={value === period.id ? { backgroundColor: "#586ab1" } : {}}
        >
          {period.label}
        </button>
      ))}
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
  const [timePeriod, setTimePeriod] = useState('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [hasFetched, setHasFetched] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const userRole = profile?.role;
  const currentUserTenantId = profile?.tenant_id;

  // Get date range based on selected time period
  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (timePeriod) {
      case 'today':
        return { start: subDays(now, 1), end: now };
      case 'week':
        return { start: subDays(now, 7), end: now };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'quarter':
        return { start: subDays(now, 90), end: now };
      case 'year':
        return { start: subDays(now, 365), end: now };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [timePeriod]);

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
        await fetchDashboardData();
        if (userRole === 'superadmin') {
          await fetchTenants();
        }
      }
    };

    initializeDashboard();
  }, [profile, hasFetched]);

  // Refresh data when time period changes
  useEffect(() => {
    if (profile) {
      fetchDashboardData();
    }
  }, [timePeriod]);

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

  // Format large numbers
  const formatLargeNumber = useCallback((num) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  }, []);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setDashboardLoading(true);
      setFetchError(null);

      const dateRange = getDateRange();
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
        fetchDisbursedStats(userIds, dateRange),
        fetchOutstandingStats(userIds),
        fetchRevenueStats(userIds, dateRange),
        fetchCollectionsAmount(userIds, dateRange),
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
          value: `KES ${formatLargeNumber(disbursedStats.amount)}`,
          secondaryValue: `${disbursedStats.count.toLocaleString()} loans`,

          icon: DollarSign,
          gradient: 'bg-gradient-to-br from-amber-100/60 to-orange-200/60',
          changeType: 'positive',
          description: 'Total amount disbursed',
        },
        {
          name: 'Outstanding Balance',
          value: `KES ${formatLargeNumber(outstandingStats.amount)}`,

          icon: AlertTriangle,
          gradient: 'bg-gradient-to-br from-rose-100/60 to-red-200/60',

          description: 'Pending collection',
        },
        {
          name: 'Total Revenue',
          value: `KES ${formatLargeNumber(revenueStats.amount)}`,

          icon: Coins,
          gradient: 'bg-gradient-to-br from-yellow-100/60 to-amber-200/60',

          description: 'Fees & interest earned',
        },
        {
          name: 'Collections',
          value: `KES ${formatLargeNumber(collectionsAmount)}`,

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
  }, [userRole, currentUserTenantId, getDateRange, getTenantUserIds, formatLargeNumber]);

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
    const { count } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .in('created_by', userIds);
    return count || 0;
  }, []);

  const fetchTotalLoans = useCallback(async (userIds) => {
    if (userIds.length === 0) return 0;
    const { count } = await supabase
      .from('loans')
      .select('id', { count: 'exact', head: true })
      .in('booked_by', userIds);
    return count || 0;
  }, []);

  const fetchDisbursedStats = useCallback(async (userIds, dateRange) => {
    if (userIds.length === 0) return { count: 0, amount: 0 };

    const { data } = await supabase
      .from('loans')
      .select('scored_amount')
      .eq('status', 'disbursed')
      .in('booked_by', userIds)
      .gte('disbursed_at', dateRange.start.toISOString())
      .lte('disbursed_at', dateRange.end.toISOString());

    return {
      count: data?.length || 0,
      amount: data?.reduce((sum, loan) => sum + (loan.scored_amount || 0), 0) || 0,
    };
  }, []);

  const fetchOutstandingStats = useCallback(async (userIds) => {
    if (userIds.length === 0) return { amount: 0 };

    const { data: loans } = await supabase
      .from('loans')
      .select('id, scored_amount')
      .eq('status', 'disbursed')
      .in('booked_by', userIds);

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
      return total + Math.max(0, (loan.scored_amount || 0) - paid);
    }, 0);

    return { amount: totalOutstanding };
  }, []);

  const fetchRevenueStats = useCallback(async (userIds, dateRange) => {
    if (userIds.length === 0) return { amount: 0 };

    const { data } = await supabase
      .from('loans')
      .select('processing_fee, registration_fee, total_interest')
      .in('booked_by', userIds)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString());

    const total = data?.reduce((sum, loan) => {
      const fees = (loan.processing_fee || 0) + (loan.registration_fee || 0);
      const interest = loan.total_interest || 0;
      return sum + fees + interest;
    }, 0) || 0;

    return { amount: total };
  }, []);

  const fetchCollectionsAmount = useCallback(async (userIds, dateRange) => {
    if (userIds.length === 0) return 0;

    const { data: customers } = await supabase
      .from('customers')
      .select('id')
      .in('created_by', userIds);

    if (!customers || customers.length === 0) return 0;

    const customerIds = customers.map(c => c.id);
    const { data: loans } = await supabase
      .from('loans')
      .select('id')
      .in('customer_id', customerIds);

    if (!loans || loans.length === 0) return 0;

    const loanIds = loans.map(l => l.id);
    const { data } = await supabase
      .from('loan_payments')
      .select('paid_amount')
      .in('loan_id', loanIds)
      .gte('paid_at', dateRange.start.toISOString())
      .lte('paid_at', dateRange.end.toISOString());

    return data?.reduce((sum, payment) => sum + (payment.paid_amount || 0), 0) || 0;
  }, []);

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
    navigate(`/tenants/${tenant.id}`);
  }, [navigate]);

  const handleAddTenant = useCallback(() => {
    navigate('/users/create-tenant/admin');
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    setHasFetched(false);
    setDashboardLoading(true);
    setLastRefresh(new Date());
  }, []);

  const handleTimePeriodChange = useCallback((period) => {
    setTimePeriod(period);
  }, []);

  // Loading state
  if (dashboardLoading && !stats.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin mx-auto" style={{ color: "#586ab1" }} />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-pulse" />
          </div>
          <p className="mt-4 text-lg font-medium" style={{ color: "#586ab1" }}>Loading your dashboard...</p>
          <p className="text-sm mt-2" style={{ color: "#586ab1", opacity: 0.7 }}>Preparing your financial insights</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200">
                  <Shield className="h-6 w-6" style={{ color: "#586ab1" }} />
                </div>
                <div>

                  <p className="text-sm mt-1" style={{ color: "#586ab1", opacity: 0.7 }}>
                    Welcome back, <span className="font-semibold">{profile?.full_name || 'Admin'}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <TimePeriodSelector value={timePeriod} onChange={handleTimePeriodChange} />
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
                style={{ color: "#586ab1" }}
              >
                <RefreshCw className="h-4 w-4" />
                <span className="text-sm font-medium">Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {fetchError && (
          <div className="mb-6 p-4 bg-gradient-to-r from-rose-50 to-red-50 border border-red-200 rounded-xl"
            style={{ borderLeftColor: "#586ab1", borderLeftWidth: '4px' }}>
            <p className="text-sm font-medium flex items-center gap-2" style={{ color: "#586ab1" }}>
              <AlertTriangle className="h-4 w-4" />
              {fetchError}
            </p>
          </div>
        )}

        {/* Search Bar (Superadmin only) */}
        {userRole === 'superadmin' && (
          <div className="mb-8">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-5 border border-gray-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 max-w-2xl">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: "#586ab1" }} />
                    <input
                      type="text"
                      placeholder="Search tenants by name, company, or slug..."
                      className="pl-12 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent text-sm focus:outline-none transition-all bg-white/50 backdrop-blur-sm"
                      style={{ "--tw-ring-color": "#586ab1" }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  onClick={() => navigate('/users/create-tenant/admin?openForm=true')}
                  className="px-5 py-3 text-white rounded-xl hover:opacity-90 transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-2 shadow-lg"
                  style={{ backgroundColor: "#586ab1" }}
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
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-slate-50/80 to-blue-50/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: "#586ab1" }}>Tenant Management</h2>
                    <p className="text-sm mt-1" style={{ color: "#586ab1", opacity: 0.7 }}>
                      {searchQuery ? `Search results for "${searchQuery}"` : 'Recently added tenants'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm px-3 py-2 bg-white rounded-lg border border-gray-200">
                    <Calendar className="h-4 w-4" style={{ color: "#586ab1", opacity: 0.7 }} />
                    <span style={{ color: "#586ab1", opacity: 0.7 }}>
                      Showing {filteredTenants.length} of {tenants.length} tenants
                    </span>
                  </div>
                </div>
              </div>

              {/* Table */}
              {loading ? (
                <div className="p-12 text-center">
                  <Loader2 className="h-10 w-10 animate-spin mx-auto" style={{ color: "#586ab1" }} />
                  <p className="mt-3 text-sm" style={{ color: "#586ab1", opacity: 0.7 }}>Loading tenants...</p>
                </div>
              ) : filteredTenants.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-50/80 to-blue-50/80">
                        <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider" style={{ color: "#586ab1" }}>
                          Tenant Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider" style={{ color: "#586ab1" }}>
                          Company
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider" style={{ color: "#586ab1" }}>
                          Slug
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider" style={{ color: "#586ab1" }}>
                          Created
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider" style={{ color: "#586ab1" }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredTenants.map((tenant) => (
                        <tr key={tenant.id} className="hover:bg-gradient-to-r hover:from-slate-50/50 hover:to-blue-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {tenant.logo_url ? (
                                <img
                                  src={tenant.logo_url}
                                  alt={tenant.name}
                                  className="h-10 w-10 rounded-xl object-cover border border-gray-200"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-100 to-cyan-100 border border-gray-200">
                                  <Building className="h-5 w-5" style={{ color: "#586ab1" }} />
                                </div>
                              )}
                              <div>
                                <div className="font-medium" style={{ color: "#586ab1" }}>{tenant.name}</div>
                                <div className="text-xs" style={{ color: "#586ab1", opacity: 0.6 }}>
                                  {tenant.status || 'Active'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div style={{ color: "#586ab1" }}>{tenant.company_name || '—'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <code className="text-xs px-2 py-1 bg-gray-100 rounded" style={{ color: "#586ab1" }}>
                              {tenant.tenant_slug}
                            </code>
                          </td>
                          <td className="px-6 py-4">
                            <div style={{ color: "#586ab1" }}>
                              {format(new Date(tenant.created_at), 'MMM d, yyyy')}
                            </div>
                            <div className="text-xs" style={{ color: "#586ab1", opacity: 0.6 }}>
                              {format(new Date(tenant.created_at), 'h:mm a')}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleViewTenant(tenant)}
                                className="px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
                                style={{ color: "#586ab1" }}
                              >
                                <Eye className="h-4 w-4" />
                                <span className="text-sm font-medium">View</span>
                              </button>
                              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <MoreVertical className="h-4 w-4" style={{ color: "#586ab1", opacity: 0.6 }} />
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
                  <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-200">
                    <Building className="h-10 w-10" style={{ color: "#586ab1" }} />
                  </div>
                  <p className="font-medium" style={{ color: "#586ab1", opacity: 0.7 }}>No tenants found</p>
                  <p className="text-sm mt-2" style={{ color: "#586ab1", opacity: 0.5 }}>
                    {searchQuery ? 'Try a different search term' : 'Add your first tenant to get started'}
                  </p>
                </div>
              )}

              {/* Footer */}
              {filteredTenants.length > 0 && (
                <div className="px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-slate-50/80 to-blue-50/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-sm" style={{ color: "#586ab1", opacity: 0.7 }}>
                      {searchQuery
                        ? `Found ${filteredTenants.length} matching tenants`
                        : `Showing ${Math.min(5, filteredTenants.length)} of ${tenants.length} tenants`
                      }
                    </p>
                    <button
                      onClick={() => navigate('/users/create-tenant/admin')}
                      className="text-sm font-medium flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white transition-colors"
                      style={{ color: "#586ab1" }}
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
        <div className="mt-8 pt-6 border-t border-gray-200/50">
          <div className="flex items-center justify-center gap-2 text-sm" style={{ color: "#586ab1", opacity: 0.7 }}>
            <Calendar className="h-4 w-4" />
            <span>
              Dashboard updated: {format(lastRefresh, 'MMM d, yyyy • h:mm a')}
            </span>
            <span className="mx-2">•</span>
            <span>
              Time period: <span className="font-medium">{timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;