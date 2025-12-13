import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  FileText,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Coins,
  Building,
  Target,
  RefreshCw,
  TrendingDown,
  Search,
  Plus,
  Eye,
  MoreVertical,
  CreditCard,
  Banknote,
  Wallet,
  ChevronRight,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { format } from 'date-fns';

// Stat Card Component
const StatCard = ({ name, value, change, icon: Icon, color, changeType, description, loading }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-2">{name}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-gray-900">
              {loading ? (
                <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
              ) : (
                value
              )}
            </p>
            {change && (
              <span className={`text-sm font-medium flex items-center gap-1 ${changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
                {changeType === 'positive' ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {change}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">{description}</p>
        </div>
        <div className={`${color} p-3 rounded-lg ml-4 flex-shrink-0`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [filteredTenants, setFilteredTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [currentUserTenantId, setCurrentUserTenantId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [timeFilter, setTimeFilter] = useState('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Memoized time filters to prevent re-renders
  const timeFilters = useMemo(() => [
    { id: 'day', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'quarter', label: 'This Quarter' },
    { id: 'year', label: 'This Year' },
  ], []);

  // Load profile and initial data once
  useEffect(() => {
    if (profile && !currentUserTenantId) {
      const tenantId = profile.tenant_id;
      const role = profile.role;
      
      setCurrentUserTenantId(tenantId);
      setUserRole(role);
      
      if (role) {
        fetchDashboardData(tenantId, role);
        if (role === 'superadmin') {
          fetchTenants();
        }
      }
    }
  }, [profile]);

  // Update data when time filter changes
  useEffect(() => {
    if (currentUserTenantId && userRole) {
      fetchDashboardData(currentUserTenantId, userRole);
    }
  }, [timeFilter, lastRefresh]);

  // Filter tenants when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTenants(tenants.slice(0, 5)); // Only show first 5
    } else {
      const filtered = tenants.filter(tenant =>
        tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tenant.tenant_slug?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTenants(filtered);
    }
  }, [searchQuery, tenants]);

  // Helper function to get tenant user IDs (ROs)
  const getTenantUserIds = useCallback(async (tenantId, userRole) => {
    if (userRole === 'superadmin') {
      // Superadmin sees all users
      const { data } = await supabase
        .from('users')
        .select('id');
      return data?.map(u => u.id) || [];
    } else {
      // Get users (ROs) for this tenant
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('tenant_id', tenantId);
      return data?.map(u => u.id) || [];
    }
  }, []);

  const fetchDashboardData = useCallback(async (tenantId, userRole) => {
    try {
      setDashboardLoading(true);
      
      // Fetch basic stats
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
        userRole === 'superadmin' ? fetchTotalTenants() : 0,
        fetchTotalUsers(tenantId, userRole),
        fetchTotalCustomers(tenantId, userRole),
        fetchTotalLoans(tenantId, userRole),
        fetchDisbursedStats(tenantId, userRole),
        fetchOutstandingStats(tenantId, userRole),
        fetchRevenueStats(tenantId, userRole),
        fetchCollectionsAmount(tenantId, userRole),
      ]);

      // Build stats array based on user role
      const statsArray = [];

      // For superadmin, show tenant stats first
      if (userRole === 'superadmin') {
        statsArray.push({
          name: 'Total Tenants',
          value: totalTenants.toLocaleString(),
          change: await calculateTenantGrowth(),
          icon: Building,
          color: 'bg-violet-500',
          changeType: 'positive',
          description: 'Active SaaS tenants',
        });
      }

      // Add core stats
      statsArray.push(
        {
          name: 'Total Users',
          value: totalUsers.toLocaleString(),
          change: await calculateUserGrowth(tenantId, userRole),
          icon: Users,
          color: 'bg-blue-500',
          changeType: 'positive',
          description: 'System users',
        },
        {
          name: 'Total Customers',
          value: totalCustomers.toLocaleString(),
          change: await calculateCustomerGrowth(tenantId, userRole),
          icon: Users,
          color: 'bg-green-500',
          changeType: 'positive',
          description: 'Registered customers',
        },
        {
          name: 'Total Loans',
          value: totalLoans.toLocaleString(),
          change: await calculateLoanGrowth(tenantId, userRole),
          icon: FileText,
          color: 'bg-purple-500',
          changeType: 'positive',
          description: 'All loan applications',
        }
      );

      // Add financial stats
      const financialStats = [
        {
          name: 'Disbursed Loans',
          value: `KES ${formatLargeNumber(disbursedStats.amount)}`,
          secondaryValue: `${disbursedStats.count} loans`,
          change: await calculateDisbursementGrowth(tenantId, userRole),
          icon: DollarSign,
          color: 'bg-orange-500',
          changeType: 'positive',
          description: 'Total amount disbursed',
        },
        {
          name: 'Outstanding Amount',
          value: `KES ${formatLargeNumber(outstandingStats.amount)}`,
          change: await calculateOutstandingChange(tenantId, userRole),
          icon: AlertTriangle,
          color: 'bg-red-500',
          changeType: 'negative',
          description: 'Pending collection',
        },
        {
          name: 'Total Revenue',
          value: `KES ${formatLargeNumber(revenueStats.amount)}`,
          change: await calculateRevenueGrowth(tenantId, userRole),
          icon: Coins,
          color: 'bg-amber-500',
          changeType: 'positive',
          description: 'Fees & interest',
        },
        {
          name: 'Collections',
          value: `KES ${formatLargeNumber(collectionsAmount)}`,
          change: await calculateCollectionsGrowth(tenantId, userRole),
          icon: Banknote,
          color: 'bg-emerald-500',
          changeType: 'positive',
          description: 'Amount collected',
        },
      ];

      setStats([...statsArray, ...financialStats]);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

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

  // Helper function to format large numbers
  const formatLargeNumber = useCallback((num) => {
    if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(2)}B`;
    } else if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toFixed(0);
  }, []);

  // Helper function to get date range
  const getDateRange = useCallback(() => {
    const now = new Date();
    const ranges = {
      day: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
      week: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
      month: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
      quarter: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
      year: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
    };
    return ranges[timeFilter] || ranges.month;
  }, [timeFilter]);

  // ========== DATA FETCHING FUNCTIONS ==========

  const fetchTotalTenants = useCallback(async () => {
    const { count } = await supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true });
    
    return count || 0;
  }, []);

  const fetchTotalUsers = useCallback(async (tenantId, userRole) => {
    if (userRole === 'superadmin') {
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true });
      return count || 0;
    }

    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    
    return count || 0;
  }, []);

  const fetchTotalCustomers = useCallback(async (tenantId, userRole) => {
    // Get tenant user IDs (ROs)
    const userIds = await getTenantUserIds(tenantId, userRole);
    
    if (userIds.length === 0) return 0;

    // Fetch customers created by these ROs
    const { count } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .in('created_by', userIds);
    
    return count || 0;
  }, [getTenantUserIds]);

  const fetchTotalLoans = useCallback(async (tenantId, userRole) => {
    // Get tenant user IDs (ROs)
    const userIds = await getTenantUserIds(tenantId, userRole);
    
    if (userIds.length === 0) return 0;

    // Option A: Fetch loans booked by these ROs directly
    const { count } = await supabase
      .from('loans')
      .select('id', { count: 'exact', head: true })
      .in('booked_by', userIds);
    
    return count || 0;
  }, [getTenantUserIds]);

  const fetchDisbursedStats = useCallback(async (tenantId, userRole) => {
    const dateRange = getDateRange();
    const userIds = await getTenantUserIds(tenantId, userRole);
    
    if (userIds.length === 0) return { count: 0, amount: 0 };

    const { data } = await supabase
      .from('loans')
      .select('scored_amount, id')
      .eq('status', 'disbursed')
      .in('booked_by', userIds)
      .gte('disbursed_at', dateRange.toISOString());
    
    return {
      count: data?.length || 0,
      amount: data?.reduce((sum, loan) => sum + (loan.scored_amount || 0), 0) || 0,
    };
  }, [getDateRange, getTenantUserIds]);

  const fetchOutstandingStats = useCallback(async (tenantId, userRole) => {
    const userIds = await getTenantUserIds(tenantId, userRole);
    
    if (userIds.length === 0) return { count: 0, amount: 0 };

    // Get all disbursed loans for this tenant
    const { data: loans } = await supabase
      .from('loans')
      .select('id, scored_amount')
      .eq('status', 'disbursed')
      .in('booked_by', userIds);
    
    if (!loans || loans.length === 0) {
      return { count: 0, amount: 0 };
    }

    // Get loan IDs
    const loanIds = loans.map(loan => loan.id);

    // Get total payments for these loans
    const { data: payments } = await supabase
      .from('loan_payments')
      .select('loan_id, paid_amount')
      .in('loan_id', loanIds);

    // Calculate outstanding per loan
    const loanPayments = {};
    payments?.forEach(payment => {
      if (!loanPayments[payment.loan_id]) {
        loanPayments[payment.loan_id] = 0;
      }
      loanPayments[payment.loan_id] += payment.paid_amount || 0;
    });

    // Calculate total outstanding
    const totalOutstanding = loans.reduce((total, loan) => {
      const paid = loanPayments[loan.id] || 0;
      const outstanding = (loan.scored_amount || 0) - paid;
      return total + Math.max(0, outstanding);
    }, 0);

    return {
      count: loans.length,
      amount: totalOutstanding,
    };
  }, [getTenantUserIds]);

  const fetchRevenueStats = useCallback(async (tenantId, userRole) => {
    const dateRange = getDateRange();
    const userIds = await getTenantUserIds(tenantId, userRole);
    
    if (userIds.length === 0) return { amount: 0 };

    const { data } = await supabase
      .from('loans')
      .select('processing_fee, registration_fee, total_interest')
      .in('booked_by', userIds)
      .gte('created_at', dateRange.toISOString());
    
    if (!data) return { amount: 0 };

    const total = data.reduce((sum, loan) => {
      const fees = (loan.processing_fee || 0) + (loan.registration_fee || 0);
      const interest = loan.total_interest || 0;
      return sum + fees + interest;
    }, 0);

    return { amount: total };
  }, [getDateRange, getTenantUserIds]);

  const fetchCollectionsAmount = useCallback(async (tenantId, userRole) => {
    const dateRange = getDateRange();
    const userIds = await getTenantUserIds(tenantId, userRole);
    
    if (userIds.length === 0) return 0;

    // Get customers created by tenant ROs
    const { data: customers } = await supabase
      .from('customers')
      .select('id')
      .in('created_by', userIds);

    if (!customers || customers.length === 0) return 0;

    const customerIds = customers.map(c => c.id);

    // Get loans for these customers
    const { data: loans } = await supabase
      .from('loans')
      .select('id')
      .in('customer_id', customerIds);

    if (!loans || loans.length === 0) return 0;

    const loanIds = loans.map(l => l.id);

    // Get payments for these loans
    const { data } = await supabase
      .from('loan_payments')
      .select('paid_amount')
      .in('loan_id', loanIds)
      .gte('paid_at', dateRange.toISOString());
    
    return data?.reduce((sum, payment) => sum + (payment.paid_amount || 0), 0) || 0;
  }, [getDateRange, getTenantUserIds]);

  // ========== GROWTH CALCULATION FUNCTIONS ==========

  const calculateGrowthForTenantUsers = useCallback(async (table, tenantId, userRole, column = 'created_at', filterField = 'created_by') => {
    const currentPeriod = getDateRange();
    const previousPeriod = new Date(currentPeriod.getTime());
    previousPeriod.setMonth(previousPeriod.getMonth() - 1);

    const userIds = await getTenantUserIds(tenantId, userRole);
    
    if (userIds.length === 0) return '+0%';

    const { count: currentCount } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .in(filterField, userIds)
      .gte(column, currentPeriod.toISOString());

    const { count: previousCount } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .in(filterField, userIds)
      .gte(column, previousPeriod.toISOString())
      .lt(column, currentPeriod.toISOString());

    if (!previousCount || previousCount === 0) return '+0%';
    
    const growth = ((currentCount - previousCount) / previousCount) * 100;
    return `${growth >= 0 ? '+' : ''}${Math.abs(growth).toFixed(1)}%`;
  }, [getDateRange, getTenantUserIds]);

  const calculateTenantGrowth = useCallback(async () => {
    const currentPeriod = getDateRange();
    const previousPeriod = new Date(currentPeriod.getTime());
    previousPeriod.setMonth(previousPeriod.getMonth() - 1);

    const { count: currentCount } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', currentPeriod.toISOString());

    const { count: previousCount } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', previousPeriod.toISOString())
      .lt('created_at', currentPeriod.toISOString());

    if (!previousCount || previousCount === 0) return '+0%';
    
    const growth = ((currentCount - previousCount) / previousCount) * 100;
    return `${growth >= 0 ? '+' : ''}${Math.abs(growth).toFixed(1)}%`;
  }, [getDateRange]);

  const calculateUserGrowth = useCallback(async (tenantId, userRole) => {
    const currentPeriod = getDateRange();
    const previousPeriod = new Date(currentPeriod.getTime());
    previousPeriod.setMonth(previousPeriod.getMonth() - 1);

    let currentQuery = supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', currentPeriod.toISOString());

    let previousQuery = supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', previousPeriod.toISOString())
      .lt('created_at', currentPeriod.toISOString());

    if (userRole !== 'superadmin') {
      currentQuery = currentQuery.eq('tenant_id', tenantId);
      previousQuery = previousQuery.eq('tenant_id', tenantId);
    }

    const { count: currentCount } = await currentQuery;
    const { count: previousCount } = await previousQuery;

    if (!previousCount || previousCount === 0) return '+0%';
    
    const growth = ((currentCount - previousCount) / previousCount) * 100;
    return `${growth >= 0 ? '+' : ''}${Math.abs(growth).toFixed(1)}%`;
  }, [getDateRange]);

  const calculateCustomerGrowth = useCallback((tenantId, userRole) => 
    calculateGrowthForTenantUsers('customers', tenantId, userRole, 'created_at', 'created_by'), 
    [calculateGrowthForTenantUsers]
  );

  const calculateLoanGrowth = useCallback((tenantId, userRole) => 
    calculateGrowthForTenantUsers('loans', tenantId, userRole, 'created_at', 'booked_by'), 
    [calculateGrowthForTenantUsers]
  );

  const calculateDisbursementGrowth = useCallback(async (tenantId, userRole) => {
    const currentPeriod = getDateRange();
    const previousPeriod = new Date(currentPeriod.getTime());
    previousPeriod.setMonth(previousPeriod.getMonth() - 1);

    const userIds = await getTenantUserIds(tenantId, userRole);
    
    if (userIds.length === 0) return '+0%';

    const { data: currentData } = await supabase
      .from('loans')
      .select('scored_amount')
      .eq('status', 'disbursed')
      .in('booked_by', userIds)
      .gte('disbursed_at', currentPeriod.toISOString());

    const currentTotal = currentData?.reduce((sum, loan) => sum + (loan.scored_amount || 0), 0) || 0;

    const { data: previousData } = await supabase
      .from('loans')
      .select('scored_amount')
      .eq('status', 'disbursed')
      .in('booked_by', userIds)
      .gte('disbursed_at', previousPeriod.toISOString())
      .lt('disbursed_at', currentPeriod.toISOString());

    const previousTotal = previousData?.reduce((sum, loan) => sum + (loan.scored_amount || 0), 0) || 0;

    if (!previousTotal || previousTotal === 0) return '+0%';
    
    const growth = ((currentTotal - previousTotal) / previousTotal) * 100;
    return `${growth >= 0 ? '+' : ''}${Math.abs(growth).toFixed(1)}%`;
  }, [getDateRange, getTenantUserIds]);

  const calculateOutstandingChange = useCallback(async (tenantId, userRole) => {
    const currentOutstanding = (await fetchOutstandingStats(tenantId, userRole)).amount;

    // Calculate previous period outstanding
    const previousDateRange = new Date(getDateRange().getTime());
    previousDateRange.setMonth(previousDateRange.getMonth() - 2);

    const userIds = await getTenantUserIds(tenantId, userRole);
    
    if (userIds.length === 0) return '+0%';

    const { data: previousLoans } = await supabase
      .from('loans')
      .select('id, scored_amount')
      .eq('status', 'disbursed')
      .in('booked_by', userIds)
      .gte('disbursed_at', previousDateRange.toISOString())
      .lt('disbursed_at', getDateRange().toISOString());
    
    if (!previousLoans || previousLoans.length === 0) return '+0%';

    const previousLoanIds = previousLoans.map(loan => loan.id);

    const { data: previousPayments } = await supabase
      .from('loan_payments')
      .select('loan_id, paid_amount')
      .in('loan_id', previousLoanIds);

    const previousLoanPayments = {};
    previousPayments?.forEach(payment => {
      if (!previousLoanPayments[payment.loan_id]) {
        previousLoanPayments[payment.loan_id] = 0;
      }
      previousLoanPayments[payment.loan_id] += payment.paid_amount || 0;
    });

    const previousOutstanding = previousLoans.reduce((total, loan) => {
      const paid = previousLoanPayments[loan.id] || 0;
      const outstanding = (loan.scored_amount || 0) - paid;
      return total + Math.max(0, outstanding);
    }, 0);

    if (!previousOutstanding || previousOutstanding === 0) return '+0%';
    
    const change = ((currentOutstanding - previousOutstanding) / previousOutstanding) * 100;
    return `${change >= 0 ? '+' : ''}${Math.abs(change).toFixed(1)}%`;
  }, [getDateRange, getTenantUserIds, fetchOutstandingStats]);

  const calculateRevenueGrowth = useCallback(async (tenantId, userRole) => {
    const currentPeriod = getDateRange();
    const previousPeriod = new Date(currentPeriod.getTime());
    previousPeriod.setMonth(previousPeriod.getMonth() - 1);

    const currentRevenue = (await fetchRevenueStats(tenantId, userRole)).amount;

    const userIds = await getTenantUserIds(tenantId, userRole);
    
    if (userIds.length === 0) return '+0%';

    const { data: previousData } = await supabase
      .from('loans')
      .select('processing_fee, registration_fee, total_interest')
      .in('booked_by', userIds)
      .gte('created_at', previousPeriod.toISOString())
      .lt('created_at', currentPeriod.toISOString());
    
    const previousRevenue = previousData?.reduce((sum, loan) => {
      const fees = (loan.processing_fee || 0) + (loan.registration_fee || 0);
      const interest = loan.total_interest || 0;
      return sum + fees + interest;
    }, 0) || 0;

    if (!previousRevenue || previousRevenue === 0) return '+0%';
    
    const growth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
    return `${growth >= 0 ? '+' : ''}${Math.abs(growth).toFixed(1)}%`;
  }, [getDateRange, getTenantUserIds, fetchRevenueStats]);

  const calculateCollectionsGrowth = useCallback(async (tenantId, userRole) => {
    const currentPeriod = getDateRange();
    const previousPeriod = new Date(currentPeriod.getTime());
    previousPeriod.setMonth(previousPeriod.getMonth() - 1);

    const currentCollections = await fetchCollectionsAmount(tenantId, userRole);

    const userIds = await getTenantUserIds(tenantId, userRole);
    
    if (userIds.length === 0) return '+0%';

    const { data: customers } = await supabase
      .from('customers')
      .select('id')
      .in('created_by', userIds);

    if (!customers || customers.length === 0) return '+0%';

    const customerIds = customers.map(c => c.id);

    const { data: loans } = await supabase
      .from('loans')
      .select('id')
      .in('customer_id', customerIds);

    if (!loans || loans.length === 0) return '+0%';

    const loanIds = loans.map(l => l.id);

    const { data: previousData } = await supabase
      .from('loan_payments')
      .select('paid_amount')
      .in('loan_id', loanIds)
      .gte('paid_at', previousPeriod.toISOString())
      .lt('paid_at', currentPeriod.toISOString());
    
    const previousCollections = previousData?.reduce((sum, payment) => sum + (payment.paid_amount || 0), 0) || 0;

    if (!previousCollections || previousCollections === 0) return '+0%';
    
    const growth = ((currentCollections - previousCollections) / previousCollections) * 100;
    return `${growth >= 0 ? '+' : ''}${Math.abs(growth).toFixed(1)}%`;
  }, [getDateRange, getTenantUserIds, fetchCollectionsAmount]);




  const handleViewTenant = useCallback((tenant) => {
    window.location.href = `/tenants/${tenant.id}`;
  }, []);

  const handleAddTenant = useCallback(() => {
    window.location.href = '/users/create-tenant/admin';
  }, []);


  if (dashboardLoading) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header with Search for Superadmin */}
        <div className="mb-0">
       

          {/* Search Bar for Tenants (Superadmin only) */}
          {userRole === 'superadmin' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search tenants by name, company, or slug..."
                      className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddTenant}
                  className="ml-4 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">Add Tenant</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Statistics Grid */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} loading={dashboardLoading} />
            ))}
          </div>
        </div>

        {/* Tenant Management Table (Superadmin only) */}
        {userRole === 'superadmin' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Tenant Management</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {searchQuery ? `Search results for "${searchQuery}"` : 'Recently added tenants'}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="h-4 w-4" />
                  <span>Showing {filteredTenants.length} of {tenants.length} tenants</span>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 text-gray-400 animate-spin mx-auto" />
                <p className="mt-2 text-gray-500">Loading tenants...</p>
              </div>
            ) : filteredTenants.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tenant Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Company Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tenant Slug
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {tenant.logo_url ? (
                              <img src={tenant.logo_url} alt={tenant.name} className="h-8 w-8 rounded-lg object-cover mr-3" />
                            ) : (
                              <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-3">
                                <Building className="h-4 w-4 text-white" />
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                              <div className="text-xs text-gray-500">{tenant.tenant_slug}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{tenant.company_name || '—'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-mono">{tenant.tenant_slug}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {format(new Date(tenant.created_at), 'MMM d, yyyy')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(tenant.created_at), 'h:mm a')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewTenant(tenant)}
                              className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                            >
                              <Eye className="h-4 w-4" />
                              <span>View</span>
                            </button>
                            <button className="p-1 hover:bg-gray-100 rounded">
                              <MoreVertical className="h-4 w-4 text-gray-400" />
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
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500">No tenants found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {searchQuery ? 'Try a different search term' : 'Add your first tenant to get started'}
                </p>
              </div>
            )}

            {filteredTenants.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {searchQuery ? `Found ${filteredTenants.length} matching tenants` : `Showing ${Math.min(5, filteredTenants.length)} of ${tenants.length} tenants`}
                  </p>
                  <button
                    onClick={() => window.location.href = '/tenants'}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    View All Tenants
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Financial Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Financial Summary</h2>
              <p className="text-sm text-gray-600 mt-1">Key financial metrics for {timeFilter}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              <span>
                Last updated: {format(new Date(lastRefresh), 'MMM d, h:mm a')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.slice(userRole === 'superadmin' ? 4 : 3).map((stat, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`${stat.color.replace('bg-', 'bg-').replace('500', '100')} p-2 rounded`}>
                      <stat.icon className={`h-4 w-4 ${stat.color.replace('bg-', 'text-')}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{stat.name}</span>
                  </div>
                  <span className={`text-xs font-medium flex items-center gap-1 ${stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.change}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;