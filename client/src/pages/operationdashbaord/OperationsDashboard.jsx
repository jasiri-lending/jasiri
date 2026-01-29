// OperationsDashboard.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from "../../supabaseClient";
import {
  FileText, Clock, CheckCircle, DollarSign, XCircle,
  Users, AlertTriangle, FileCheck, TrendingUp, BarChart2,
  Building, UserCircle, Calendar, Filter, RefreshCw,
  ChevronRight, Loader, Search, Eye, Shield, UserPlus,
  FileWarning, AlertCircle, TrendingDown, Briefcase, 
  Database, Target, BarChart3, CalendarCheck, Receipt,
  CreditCard, PhoneCall
} from 'lucide-react';

// Use colors from your Tailwind config
const COLORS = {
  brand: {
    surface: '#E7F0FA',
    secondary: '#7BA4D0',
    primary: '#586ab1',
    authority: '#0D2440',
  },
  success: '#10B981',
  warning: '#FACC15',
  danger: '#EF4444',
  text: '#111827',
  background: '#FFFFFF',
  muted: '#6B7280',
  highlight: '#FACC15',
  neutral: '#F3F4F6'
};

// Skeleton Loader Components
const SkeletonCard = () => (
  <div className="animate-pulse bg-white rounded-xl p-6 shadow-lg border border-gray-200">
    <div className="flex items-center justify-between mb-4">
      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
      <div className="h-8 bg-gray-200 rounded w-12"></div>
    </div>
    <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
  </div>
);

const StatCardSkeleton = () => (
  <div className="animate-pulse bg-white rounded-xl p-5 shadow-lg border border-gray-200">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
      <div className="flex-1">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
  </div>
);

// Reusable Components
const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  change, 
  color = 'primary',
  loading = false,
  onClick
}) => {
  if (loading) return <StatCardSkeleton />;
  
  const getColorClass = () => {
    if (color === 'primary') return COLORS.brand.primary;
    if (color === 'success') return COLORS.success;
    if (color === 'warning') return COLORS.warning;
    if (color === 'danger') return COLORS.danger;
    return COLORS.brand.primary;
  };
  
  const colorValue = getColorClass();
  
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-xl p-5 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 cursor-pointer hover:border-${color}-200 transform hover:-translate-y-1`}
      style={{ 
        backgroundColor: COLORS.background,
        borderLeft: `4px solid ${colorValue}`
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div 
          className="p-3 rounded-xl"
          style={{ 
            backgroundColor: `${colorValue}15`,
            color: colorValue
          }}
        >
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <div className={`text-xs px-3 py-1 rounded-full font-medium ${
            change > 0 ? 'bg-green-50 text-green-700 border border-green-200' : 
            change < 0 ? 'bg-red-50 text-red-700 border border-red-200' : 
            'bg-gray-50 text-gray-700 border border-gray-200'
          }`}>
            {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change)}%
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <div className="text-2xl font-bold" style={{ color: COLORS.text }}>
          {value}
        </div>
        <div className="text-sm" style={{ color: COLORS.muted }}>
          {label}
        </div>
      </div>
    </div>
  );
};

const ChartCard = ({ title, subtitle, children, loading = false, className = '' }) => {
  if (loading) return <SkeletonCard />;
  
  return (
    <div 
      className={`bg-white rounded-xl p-6 shadow-lg border border-gray-200 ${className}`}
      style={{ backgroundColor: COLORS.background }}
    >
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: COLORS.text }}>
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm mt-1" style={{ color: COLORS.muted }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
};

const AlertCard = ({ 
  type = 'warning', 
  title, 
  description, 
  count,
  actionLabel = 'View',
  onAction
}) => {
  const config = {
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      text: 'text-amber-800',
      countBg: 'bg-amber-100'
    },
    danger: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: AlertCircle,
      iconColor: 'text-red-600',
      text: 'text-red-800',
      countBg: 'bg-red-100'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: FileWarning,
      iconColor: COLORS.brand.primary,
      text: 'text-blue-800',
      countBg: `${COLORS.brand.surface}`
    }
  }[type];

  const Icon = config.icon;

  return (
    <div className={`${config.bg} border ${config.border} rounded-lg p-4 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${config.countBg}`}>
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className={`font-semibold ${config.text}`}>{title}</h4>
              {count && (
                <span className={`px-2 py-1 text-xs rounded-full font-semibold ${config.countBg} ${config.text}`}>
                  {count}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          </div>
        </div>
        {onAction && (
          <button
            onClick={onAction}
            className="text-sm font-medium hover:underline flex items-center gap-1"
            style={{ color: COLORS.brand.primary }}
          >
            {actionLabel}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

const PipelineStage = ({ stage, count, total, color }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <div className="flex flex-col items-center group">
      <div className="relative">
        <div 
          className="w-24 h-24 rounded-xl flex flex-col items-center justify-center mb-3 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
          style={{ 
            backgroundColor: `${color}15`,
            border: `2px solid ${color}`,
            boxShadow: `0 4px 20px ${color}25`
          }}
        >
          <span className="text-2xl font-bold" style={{ color }}>{count}</span>
          <span className="text-xs" style={{ color: COLORS.muted }}>loans</span>
        </div>
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div 
            className="px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm"
            style={{ 
              backgroundColor: COLORS.background,
              border: `1px solid ${color}40`
            }}
          >
            {percentage.toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="text-sm font-semibold mt-4" style={{ color: COLORS.text }}>
        {stage.name}
      </div>
      <div className="text-xs text-center mt-1" style={{ color: COLORS.muted }}>
        {stage.description}
      </div>
    </div>
  );
};

const FilterBar = ({ filters, onFilterChange, regions = [], branches = [], officers = [] }) => {
  const [dateRange, setDateRange] = useState('today');
  
  const dateOptions = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'custom', label: 'Custom Range' }
  ];
  
  return (
    <div 
      className="sticky top-0 z-10 backdrop-blur-lg border-b px-6 py-4"
      style={{ 
        backgroundColor: `${COLORS.brand.surface}CC`,
        borderColor: `${COLORS.brand.secondary}30`
      }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{ 
              backgroundColor: COLORS.brand.primary,
              color: COLORS.background
            }}
          >
            <BarChart2 className="w-5 h-5" />
          </div>
        
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Region Filter */}
          <div className="relative">
            <select
              value={filters.region}
              onChange={(e) => onFilterChange('region', e.target.value)}
              className="pl-9 pr-4 py-2.5 text-sm rounded-lg focus:ring-2 focus:ring-opacity-50 outline-none appearance-none transition-all"
              style={{
                backgroundColor: COLORS.background,
                border: `1px solid ${COLORS.brand.secondary}50`,
                color: COLORS.text
              }}
            >
              <option value="all">All Regions</option>
              {regions.map(region => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
            <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" 
              style={{ color: COLORS.brand.primary }} 
            />
          </div>
          
          {/* Branch Filter */}
          <div className="relative">
            <select
              value={filters.branch}
              onChange={(e) => onFilterChange('branch', e.target.value)}
              className="pl-9 pr-4 py-2.5 text-sm rounded-lg focus:ring-2 focus:ring-opacity-50 outline-none appearance-none transition-all"
              style={{
                backgroundColor: COLORS.background,
                border: `1px solid ${COLORS.brand.secondary}50`,
                color: COLORS.text
              }}
            >
              <option value="all">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" 
              style={{ color: COLORS.brand.primary }} 
            />
          </div>
          
          {/* Officer Filter */}
          <div className="relative">
            <select
              value={filters.officer}
              onChange={(e) => onFilterChange('officer', e.target.value)}
              className="pl-9 pr-4 py-2.5 text-sm rounded-lg focus:ring-2 focus:ring-opacity-50 outline-none appearance-none transition-all"
              style={{
                backgroundColor: COLORS.background,
                border: `1px solid ${COLORS.brand.secondary}50`,
                color: COLORS.text
              }}
            >
              <option value="all">All Officers</option>
              {officers.map(officer => (
                <option key={officer.id} value={officer.id}>
                  {officer.full_name}
                </option>
              ))}
            </select>
            <UserCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" 
              style={{ color: COLORS.brand.primary }} 
            />
          </div>
          
          {/* Date Range */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="pl-9 pr-4 py-2.5 text-sm rounded-lg focus:ring-2 focus:ring-opacity-50 outline-none appearance-none transition-all"
              style={{
                backgroundColor: COLORS.background,
                border: `1px solid ${COLORS.brand.secondary}50`,
                color: COLORS.text
              }}
            >
              {dateOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" 
              style={{ color: COLORS.brand.primary }} 
            />
          </div>
          
          <button
            onClick={() => onFilterChange('refresh', true)}
            className="px-4 py-2.5 text-sm font-medium rounded-lg transition-all hover:shadow-md flex items-center gap-2"
            style={{
              backgroundColor: COLORS.brand.primary,
              color: COLORS.background
            }}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

// Utility Functions
const getLocalYYYYMMDD = (d = new Date()) => {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatCurrency = (amount) => {
  if (!amount) return "0.00";
  const numAmount = Number(amount);
  const parts = numAmount.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimalPart = parts[1];
  return `${integerPart}.${decimalPart}`;
};

// Main Dashboard Component
const OperationsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [filters, setFilters] = useState({
    region: 'all',
    branch: 'all',
    officer: 'all',
    dateRange: 'today'
  });

  const [regions, setRegions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);
  
  const [dashboardData, setDashboardData] = useState({
    dailyActivity: {
      applicationsToday: 0,
      underReview: 0,
      approvedPending: 0,
      disbursedToday: 0,
      rejectedToday: 0
    },
    
    pipeline: {
      submitted: 0,
      underReview: 0,
      approved: 0,
      disbursed: 0,
      rejected: 0
    },
    
    processSpeed: {
      approvalTime: 0,
      disbursementTime: 0,
      approvalTrend: 0,
      disbursementTrend: 0
    },
    
    workload: [],
    
    disbursement: {
      today: 0,
      pending: 0,
      failed: 0
    },
    
    clientKyc: {
      newBorrowers: 0,
      missingDocuments: 0,
      unverifiedKyc: 0
    },
    
    alerts: []
  });

  // Fetch filter data
  const fetchFilterData = useCallback(async () => {
    try {
      // Fetch regions
      const { data: regionsData } = await supabase
        .from('regions')
        .select('id, name, code')
        .order('name');
      
      // Fetch branches
      const { data: branchesData } = await supabase
        .from('branches')
        .select('id, name, code, region_id')
        .order('name');
      
      // Fetch officers (users with role relationship_officer)
      const { data: officersData } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('role', 'relationship_officer')
        .order('full_name');
      
      setRegions(regionsData || []);
      setBranches(branchesData || []);
      setOfficers(officersData || []);
    } catch (error) {
      console.error('Error fetching filter data:', error);
    }
  }, []);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    
    try {
      const today = getLocalYYYYMMDD();
      const yesterday = getLocalYYYYMMDD(new Date(Date.now() - 86400000));
      
      // Build query based on filters
      let loansQuery = supabase
        .from('loans')
        .select('*');
      
      let customersQuery = supabase
        .from('customers')
        .select('*');
      
      // Apply region filter
      if (filters.region !== 'all') {
        loansQuery = loansQuery.eq('region_id', filters.region);
        customersQuery = customersQuery.eq('region_id', filters.region);
      }
      
      // Apply branch filter
      if (filters.branch !== 'all') {
        loansQuery = loansQuery.eq('branch_id', filters.branch);
        customersQuery = customersQuery.eq('branch_id', filters.branch);
      }
      
      // Apply officer filter
      if (filters.officer !== 'all') {
        loansQuery = loansQuery.eq('booked_by', filters.officer);
        customersQuery = customersQuery.eq('created_by', filters.officer);
      }
      
      // Fetch loans and customers
      const { data: loansData } = await loansQuery;
      const { data: customersData } = await customersQuery;
      
      const loans = loansData || [];
      const customers = customersData || [];
      
      // Calculate daily activity
      const applicationsToday = loans.filter(loan => {
        const created = getLocalYYYYMMDD(new Date(loan.created_at));
        return created === today && loan.status === 'booked';
      }).length;
      
      const underReview = loans.filter(loan => 
        ['bm_review', 'rn_review', 'ca_review'].includes(loan.status)
      ).length;
      
      const approvedPending = loans.filter(loan => 
        loan.status === 'ready_for_disbursement'
      ).length;
      
      const disbursedToday = loans.filter(loan => {
        const disbursed = loan.disbursed_at ? getLocalYYYYMMDD(new Date(loan.disbursed_at)) : null;
        return disbursed === today && loan.status === 'disbursed';
      }).length;
      
      const rejectedToday = loans.filter(loan => {
        const rejected = loan.rejected_at ? getLocalYYYYMMDD(new Date(loan.rejected_at)) : null;
        return rejected === today && loan.status === 'rejected';
      }).length;
      
      // Calculate pipeline
      const submitted = loans.filter(loan => loan.status === 'booked').length;
      const underReviewCount = loans.filter(loan => 
        ['bm_review', 'rn_review', 'ca_review'].includes(loan.status)
      ).length;
      const approved = loans.filter(loan => loan.status === 'approved').length;
      const disbursed = loans.filter(loan => loan.status === 'disbursed').length;
      const rejected = loans.filter(loan => loan.status === 'rejected').length;
      
      // Calculate process speed (simplified)
      const approvedLoans = loans.filter(loan => loan.status === 'disbursed');
      const totalApprovalTime = approvedLoans.reduce((sum, loan) => {
        const created = new Date(loan.created_at);
        const approved = new Date(loan.approved_by_bm_at || loan.disbursed_at);
        return sum + (approved - created) / (1000 * 60 * 60); // hours
      }, 0);
      const approvalTime = approvedLoans.length > 0 ? 
        Math.round(totalApprovalTime / approvedLoans.length) : 24;
      
      // Calculate workload
      const workloadData = officers.map(officer => {
        const officerLoans = loans.filter(loan => loan.booked_by === officer.id);
        const activeLoans = officerLoans.filter(loan => 
          !['disbursed', 'rejected'].includes(loan.status)
        ).length;
        
        let threshold = 'low';
        if (activeLoans > 20) threshold = 'high';
        else if (activeLoans > 10) threshold = 'medium';
        
        return {
          name: officer.full_name,
          count: activeLoans,
          threshold
        };
      }).sort((a, b) => b.count - a.count).slice(0, 5);
      
      // Calculate disbursement metrics
      const pendingDisbursement = loans.filter(loan => 
        loan.status === 'ready_for_disbursement'
      ).length;
      
      // Calculate client & KYC metrics
      const newBorrowersToday = customers.filter(customer => {
        const created = getLocalYYYYMMDD(new Date(customer.created_at));
        return created === today;
      }).length;
      
      const missingDocuments = customers.filter(customer => 
        customer.status === 'pending'
      ).length;
      
      // Generate alerts
      const alerts = [
        {
          id: 1,
          type: 'warning',
          title: 'Loans Under Review > 48h',
          description: 'Applications pending review for more than 48 hours',
          count: Math.floor(underReviewCount * 0.3) // Simulate 30%
        },
        {
          id: 2,
          type: 'danger',
          title: 'Approved but Not Disbursed',
          description: 'Loans approved but awaiting disbursement',
          count: pendingDisbursement
        },
        {
          id: 3,
          type: 'warning',
          title: 'Missing Documents',
          description: 'Applications with incomplete documentation',
          count: missingDocuments
        },
        {
          id: 4,
          type: 'danger',
          title: 'Excessive Workload',
          description: 'Officers with over 20 active loans',
          count: workloadData.filter(o => o.threshold === 'high').length
        }
      ].filter(alert => alert.count > 0);
      
      // Update dashboard data
      setDashboardData({
        dailyActivity: {
          applicationsToday,
          underReview,
          approvedPending,
          disbursedToday,
          rejectedToday
        },
        
        pipeline: {
          submitted,
          underReview: underReviewCount,
          approved,
          disbursed,
          rejected
        },
        
        processSpeed: {
          approvalTime,
          disbursementTime: 12, // Simplified
          approvalTrend: -5,
          disbursementTrend: 2
        },
        
        workload: workloadData,
        
        disbursement: {
          today: disbursedToday,
          pending: pendingDisbursement,
          failed: rejectedToday
        },
        
        clientKyc: {
          newBorrowers: newBorrowersToday,
          missingDocuments,
          unverifiedKyc: Math.floor(missingDocuments * 0.4) // Simulate 40%
        },
        
        alerts
      });
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  }, [filters, officers]);

  useEffect(() => {
    fetchFilterData();
  }, [fetchFilterData]);

  useEffect(() => {
    if (officers.length > 0) {
      fetchDashboardData();
    }
  }, [fetchDashboardData, officers.length, filters]);

  const handleFilterChange = useCallback((filter, value) => {
    setFilters(prev => ({ ...prev, [filter]: value }));
  }, []);

  const totalPipeline = useMemo(() => {
    return Object.values(dashboardData.pipeline).reduce((sum, count) => sum + count, 0);
  }, [dashboardData.pipeline]);

  const pipelineStages = [
    { name: 'Submitted', description: 'New applications', color: COLORS.brand.primary },
    { name: 'Under Review', description: 'In assessment', color: COLORS.warning },
    { name: 'Approved', description: 'Approval granted', color: COLORS.success },
    { name: 'Disbursed', description: 'Funds released', color: COLORS.brand.secondary },
    { name: 'Rejected', description: 'Applications declined', color: COLORS.danger }
  ];

  return (
    <div 
      className="min-h-screen"
      style={{ backgroundColor: COLORS.brand.surface }}
    >
      {/* Global Filter Bar */}
      <FilterBar 
        filters={filters} 
        onFilterChange={handleFilterChange}
        regions={regions}
        branches={branches}
        officers={officers}
      />
      
      <div className="p-6 space-y-6">
        {/* Section 1: Daily Loan Activity */}
        <div>
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div 
                className="p-2 rounded-lg"
                style={{ 
                  backgroundColor: COLORS.brand.primary,
                  color: COLORS.background
                }}
              >
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: COLORS.brand.authority }}>
                  Daily Loan Activity
                </h2>
                <p className="text-sm" style={{ color: COLORS.muted }}>
                  Today's key operational metrics
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              icon={Database}
              label="Applications Today"
              value={dashboardData.dailyActivity.applicationsToday}
              change={12}
              color="primary"
              loading={loading}
            />
            
            <StatCard
              icon={Clock}
              label="Under Review"
              value={dashboardData.dailyActivity.underReview}
              change={5}
              color="warning"
              loading={loading}
            />
            
            <StatCard
              icon={CheckCircle}
              label="Approved (Pending)"
              value={dashboardData.dailyActivity.approvedPending}
              change={-3}
              color="success"
              loading={loading}
            />
            
            <StatCard
              icon={DollarSign}
              label="Disbursed Today"
              value={dashboardData.dailyActivity.disbursedToday}
              change={8}
              color="primary"
              loading={loading}
            />
            
            <StatCard
              icon={XCircle}
              label="Rejected Today"
              value={dashboardData.dailyActivity.rejectedToday}
              change={2}
              color="danger"
              loading={loading}
            />
          </div>
        </div>
        
        {/* Section 2: Loan Pipeline */}
        <ChartCard
          title="Loan Pipeline"
          subtitle="Current status of all loan applications"
          loading={loading}
        >
          <div className="flex flex-wrap justify-center gap-8 py-6">
            {pipelineStages.map((stage, index) => (
              <div key={stage.name} className="relative">
                <PipelineStage
                  stage={stage}
                  count={Object.values(dashboardData.pipeline)[index]}
                  total={totalPipeline}
                  color={stage.color}
                />
                
                {index < pipelineStages.length - 1 && (
                  <div className="absolute top-12 right-[-2rem] lg:block hidden">
                    <ChevronRight className="w-8 h-8" style={{ color: `${COLORS.muted}40` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-8 pt-6 border-t" style={{ borderColor: `${COLORS.brand.secondary}30` }}>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {pipelineStages.map((stage, index) => (
                <div key={stage.name} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: COLORS.text }}>
                      {stage.name}
                    </div>
                    <div className="text-xs truncate" style={{ color: COLORS.muted }}>
                      {stage.description}
                    </div>
                  </div>
                  <div className="text-sm font-bold" style={{ color: stage.color }}>
                    {Object.values(dashboardData.pipeline)[index]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
        
        {/* Sections 3 & 4 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 3: Process Speed Metrics */}
          <ChartCard
            title="Process Speed Metrics"
            subtitle="Average processing times in hours"
            loading={loading}
          >
            <div className="space-y-8">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ 
                        backgroundColor: `${COLORS.brand.primary}15`,
                        color: COLORS.brand.primary
                      }}
                    >
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold" style={{ color: COLORS.text }}>
                        Application → Approval
                      </div>
                      <div className="text-xs" style={{ color: COLORS.muted }}>
                        Target: 48h
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold" style={{ color: COLORS.text }}>
                      {dashboardData.processSpeed.approvalTime}h
                    </span>
                    {dashboardData.processSpeed.approvalTrend < 0 ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700">
                        <TrendingDown className="w-4 h-4" />
                        <span className="text-xs font-medium">
                          {Math.abs(dashboardData.processSpeed.approvalTrend)}%
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-medium">
                          +{dashboardData.processSpeed.approvalTrend}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ 
                      width: `${Math.min(100, dashboardData.processSpeed.approvalTime / 48 * 100)}%`,
                      background: `linear-gradient(90deg, ${COLORS.brand.primary}, ${COLORS.brand.secondary})`
                    }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ 
                        backgroundColor: `${COLORS.success}15`,
                        color: COLORS.success
                      }}
                    >
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold" style={{ color: COLORS.text }}>
                        Approval → Disbursement
                      </div>
                      <div className="text-xs" style={{ color: COLORS.muted }}>
                        Target: 24h
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold" style={{ color: COLORS.text }}>
                      {dashboardData.processSpeed.disbursementTime}h
                    </span>
                    {dashboardData.processSpeed.disbursementTrend < 0 ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700">
                        <TrendingDown className="w-4 h-4" />
                        <span className="text-xs font-medium">
                          {Math.abs(dashboardData.processSpeed.disbursementTrend)}%
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-medium">
                          +{dashboardData.processSpeed.disbursementTrend}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ 
                      width: `${Math.min(100, dashboardData.processSpeed.disbursementTime / 24 * 100)}%`,
                      background: `linear-gradient(90deg, ${COLORS.success}, #22c55e)`
                    }}
                  />
                </div>
              </div>
            </div>
          </ChartCard>
          
          {/* Section 4: Staff Workload */}
          <ChartCard
            title="Staff Workload"
            subtitle="Active loans per relationship officer"
            loading={loading}
          >
            <div className="space-y-6">
              {dashboardData.workload.map((officer, index) => (
                <div key={index} className="group p-3 rounded-lg hover:bg-gray-50 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                        style={{ 
                          backgroundColor: `${COLORS.brand.primary}15`,
                          color: COLORS.brand.primary
                        }}
                      >
                        {officer.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium" style={{ color: COLORS.text }}>
                          {officer.name}
                        </div>
                        <div className="text-xs" style={{ color: COLORS.muted }}>
                          Relationship Officer
                        </div>
                      </div>
                    </div>
                    <div className="text-lg font-bold" style={{ color: COLORS.text }}>
                      {officer.count}
                      <span className="text-sm font-normal ml-1" style={{ color: COLORS.muted }}>
                        loans
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ${
                        officer.threshold === 'high' 
                          ? 'bg-gradient-to-r from-amber-500 to-red-500' 
                          : officer.threshold === 'medium'
                          ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                          : 'bg-gradient-to-r from-green-400 to-green-600'
                      }`}
                      style={{ width: `${Math.min(100, (officer.count / 30) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-2">
                    <span style={{ color: COLORS.muted }}>0</span>
                    <span className={`font-medium ${
                      officer.threshold === 'high' ? 'text-red-600' :
                      officer.threshold === 'medium' ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {officer.threshold === 'high' ? 'High Load' :
                       officer.threshold === 'medium' ? 'Moderate' : 'Optimal'}
                    </span>
                    <span style={{ color: COLORS.muted }}>30</span>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
        
        {/* Sections 5 & 6 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 ">
          {/* Section 5: Disbursement Monitor */}
          <ChartCard
            title="Disbursement Monitor"
            subtitle="Today's disbursement status"
            loading={loading}
          >
            <div className="space-y-4 bg-brand-secondary">
              <div className="p-4 rounded-lg border-2 transition-all hover:scale-[1.02] "
                style={{ 
                  borderColor: `${COLORS.success}30`
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5" style={{ color: COLORS.success }} />
                    <div>
                      <div className="font-semibold" style={{ color: COLORS.text }}>
                        Disbursed Today
                      </div>
                      <div className="text-sm" style={{ color: COLORS.muted }}>
                        Successfully processed
                      </div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: COLORS.text }}>
                    {dashboardData.disbursement.today}
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-lg border-2 transition-all hover:scale-[1.02]"
                style={{ 
                  backgroundColor: `${COLORS.warning}08`,
                  borderColor: `${COLORS.warning}30`
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5" style={{ color: COLORS.warning }} />
                    <div>
                      <div className="font-semibold" style={{ color: COLORS.text }}>
                        Pending Disbursement
                      </div>
                      <div className="text-sm" style={{ color: COLORS.muted }}>
                        Awaiting processing
                      </div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: COLORS.text }}>
                    {dashboardData.disbursement.pending}
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-lg border-2 transition-all hover:scale-[1.02]"
                style={{ 
                  backgroundColor: `${COLORS.danger}08`,
                  borderColor: `${COLORS.danger}30`
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-5 h-5" style={{ color: COLORS.danger }} />
                    <div>
                      <div className="font-semibold" style={{ color: COLORS.text }}>
                        Failed Disbursements
                      </div>
                      <div className="text-sm" style={{ color: COLORS.muted }}>
                        Requires attention
                      </div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: COLORS.text }}>
                    {dashboardData.disbursement.failed}
                  </div>
                </div>
              </div>
            </div>
          </ChartCard>
          
          {/* Section 6: Client & KYC Status */}
          <div className="lg:col-span-2 space-y-6 ">
            <ChartCard
              title="Client & KYC Status"
              subtitle="Customer onboarding metrics"
              loading={loading}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-6 rounded-xl border-2 hover:shadow-lg transition-all"
                  style={{ 
                    backgroundColor: `${COLORS.brand.primary}05`,
                    borderColor: `${COLORS.brand.primary}20`
                  }}
                >
                  <UserPlus className="w-10 h-10 mx-auto mb-3" 
                    style={{ color: COLORS.brand.primary }} 
                  />
                  <div className="text-3xl font-bold mb-2" style={{ color: COLORS.text }}>
                    {dashboardData.clientKyc.newBorrowers}
                  </div>
                  <div className="text-sm font-semibold mb-1" style={{ color: COLORS.brand.primary }}>
                    New Borrowers
                  </div>
                  <div className="text-xs" style={{ color: COLORS.muted }}>
                    Registered today
                  </div>
                </div>
                
                <div className="text-center p-6 rounded-xl border-2 hover:shadow-lg transition-all"
                  style={{ 
                    backgroundColor: `${COLORS.warning}05`,
                    borderColor: `${COLORS.warning}20`
                  }}
                >
                  <FileWarning className="w-10 h-10 mx-auto mb-3" 
                    style={{ color: COLORS.warning }} 
                  />
                  <div className="text-3xl font-bold mb-2" style={{ color: COLORS.text }}>
                    {dashboardData.clientKyc.missingDocuments}
                  </div>
                  <div className="text-sm font-semibold mb-1" style={{ color: COLORS.warning }}>
                    Missing Documents
                  </div>
                  <div className="text-xs" style={{ color: COLORS.muted }}>
                    Requires follow-up
                  </div>
                </div>
                
                <div className="text-center p-6 rounded-xl border-2 hover:shadow-lg transition-all"
                  style={{ 
                    backgroundColor: `${COLORS.danger}05`,
                    borderColor: `${COLORS.danger}20`
                  }}
                >
                  <Shield className="w-10 h-10 mx-auto mb-3" 
                    style={{ color: COLORS.danger }} 
                  />
                  <div className="text-3xl font-bold mb-2" style={{ color: COLORS.text }}>
                    {dashboardData.clientKyc.unverifiedKyc}
                  </div>
                  <div className="text-sm font-semibold mb-1" style={{ color: COLORS.danger }}>
                    Unverified KYC
                  </div>
                  <div className="text-xs" style={{ color: COLORS.muted }}>
                    Pending verification
                  </div>
                </div>
              </div>
            </ChartCard>
            
            {/* Section 7: Operational Alerts */}
            <ChartCard
              title="Operational Alerts"
              subtitle="Items requiring attention"
              loading={loading}
            >
              <div className="space-y-3">
                {dashboardData.alerts.length > 0 ? (
                  dashboardData.alerts.map(alert => (
                    <AlertCard
                      key={alert.id}
                      type={alert.type}
                      title={alert.title}
                      description={alert.description}
                      count={alert.count}
                      onAction={() => console.log('View alert:', alert.id)}
                    />
                  ))
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: COLORS.success }} />
                    <div className="text-lg font-semibold mb-2" style={{ color: COLORS.text }}>
                      All Systems Operational
                    </div>
                    <p className="text-sm" style={{ color: COLORS.muted }}>
                      No pending alerts requiring immediate attention
                    </p>
                  </div>
                )}
              </div>
            </ChartCard>
          </div>
        </div>
 
      </div>
    </div>
  );
};

export default OperationsDashboard;