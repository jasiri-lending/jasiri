// OperationsDashboard.jsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from "../../supabaseClient";
import {
  Users, DollarSign, FileText, AlertTriangle, TrendingUp, BarChart2,
  Briefcase, Activity, Calendar, Phone, ShieldCheck, RefreshCw,
  Home, Building, UserCircle
} from 'lucide-react';

// Components
import MetricCard from '../../components/dashboard/MetricCard';
import PipelineWidget from '../../components/dashboard/PipelineWidget';
import TasksWidget from '../../components/dashboard/TasksWidget';
import RepaymentWidget from '../../components/dashboard/RepaymentWidget';
import DelinquencyWidget from '../../components/dashboard/DelinquencyWidget';
import PerformanceWidget from '../../components/dashboard/PerformanceWidget';
import DisbursementWidget from '../../components/dashboard/DisbursementWidget';
import PortfolioChartsWidget from '../../components/dashboard/PortfolioChartsWidget';
import SystemAlertsWidget from '../../components/dashboard/SystemAlertsWidget';
import DashboardCard from '../../components/dashboard/DashboardCard';

// Utility Functions
const getLocalYYYYMMDD = (d = new Date()) => {
  const date = new Date(d);
  // Kenya timezone offset (UTC+3)
  const kenyaTime = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const year = kenyaTime.getUTCFullYear();
  const month = String(kenyaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kenyaTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatCurrency = (amount) => {
  if (!amount) return "0.00";
  const numAmount = Number(amount);
  return numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Filter Select Component
const FilterSelectCompact = ({ icon: Icon, value, onChange, options }) => (
  <div className="relative">
    <div className="absolute left-3 top-1/2 -translate-y-1/2">
      <Icon className="w-4 h-4 text-brand-primary" strokeWidth={2.4} />
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 bg-white appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all shadow-sm"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
);

// Custom Date Range Filter Component
const CustomDateRangeFilter = ({ startDate, endDate, onStartChange, onEndChange, onApply }) => (
  <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
        />
      </div>
      <div className="flex-1">
        <label className="text-xs text-gray-500 mb-1 block">End Date</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
        />
      </div>
      <button
        onClick={onApply}
        className="mt-5 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors"
      >
        Apply
      </button>
    </div>
  </div>
);

// Collections Activity Widget
const CollectionsActivityWidget = ({ data }) => (
  <DashboardCard title="Collections Activity Monitor">
    <div className="grid grid-cols-2 gap-4 mt-2">
      <div className="p-3 bg-brand-surface rounded-lg">
        <p className="text-xs text-brand-primary font-medium uppercase">Calls Made</p>
        <div className="flex justify-between items-end mt-1">
          <h3 className="text-xl font-bold text-primary">{data.callsMade}</h3>
          <Phone className="w-4 h-4 text-brand-secondary" />
        </div>
      </div>
      <div className="p-3 bg-emerald-50 rounded-lg">
        <p className="text-xs text-accent font-medium uppercase">Success Rate</p>
        <div className="flex justify-between items-end mt-1">
          <h3 className="text-xl font-bold text-accent">{data.successRate}%</h3>
          <Activity className="w-4 h-4 text-accent" />
        </div>
      </div>
      <div className="p-3 bg-amber-50 rounded-lg">
        <p className="text-xs text-highlight font-medium uppercase">PTPs Created</p>
        <div className="flex justify-between items-end mt-1">
          <h3 className="text-xl font-bold text-amber-600">{data.ptpCreated}</h3>
          <FileText className="w-4 h-4 text-highlight" />
        </div>
      </div>
      <div className="p-3 bg-indigo-50 rounded-lg">
        <p className="text-xs text-indigo-600 font-medium uppercase">PTP Kept</p>
        <div className="flex justify-between items-end mt-1">
          <h3 className="text-xl font-bold text-indigo-900">{data.ptpKept}%</h3>
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
        </div>
      </div>
    </div>
  </DashboardCard>
);

// Revenue Widget
const RevenueWidget = ({ data }) => (
  <DashboardCard title="Fees & Revenue Tracking">
    <div className="space-y-4 mt-2">
      <div className="flex justify-between items-center border-b border-dashed border-gray-200 pb-2">
        <span className="text-sm text-gray-500">Interest Earned</span>
        <span className="font-bold text-gray-600">{formatCurrency(data.interest)}</span>
      </div>
      <div className="flex justify-between items-center border-b border-dashed border-gray-200 pb-2">
        <span className="text-sm text-gray-500">Penalties</span>
        <span className="font-bold text-gray-600">{formatCurrency(data.penalties)}</span>
      </div>
      <div className="flex justify-between items-center border-b border-dashed border-gray-200 pb-2">
        <span className="text-sm text-gray-500">Processing Fees</span>
        <span className="font-bold text-gray-600">{formatCurrency(data.processingFees)}</span>
      </div>
      <div className="flex justify-between items-center border-b border-dashed border-gray-200 pb-2">
        <span className="text-sm text-gray-500">Registration Fees</span>
        <span className="font-bold text-gray-600">{formatCurrency(data.registrationFees)}</span>
      </div>
      <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
        <span className="text-sm font-bold text-gray-700">Total Revenue</span>
        <span className="text-lg font-extrabold text-emerald-600">{formatCurrency(data.totalRevenue)}</span>
      </div>
    </div>
  </DashboardCard>
);

// Loading Skeleton
const DashboardSkeleton = () => (
  <div className="p-4 md:p-6 space-y-6 animate-pulse bg-brand-surface min-h-screen">
    <div className="flex justify-between items-center mb-6">
      <div className="h-8 bg-gray-200 rounded w-1/3"></div>
      <div className="h-8 bg-gray-200 rounded w-1/4"></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="space-y-5">
        <div className="h-64 bg-gray-200 rounded-xl"></div>
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
      <div className="space-y-5">
        <div className="h-96 bg-gray-200 rounded-xl"></div>
      </div>
      <div className="space-y-5">
        <div className="h-48 bg-gray-200 rounded-xl"></div>
        <div className="h-48 bg-gray-200 rounded-xl"></div>
        <div className="h-48 bg-gray-200 rounded-xl"></div>
      </div>
    </div>
  </div>
);

// Main Dashboard Component
const OperationsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  // Filter State
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedRO, setSelectedRO] = useState("all");
  const [dateFilter, setDateFilter] = useState("this_month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Options State
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [availableROs, setAvailableROs] = useState([]);

  const [dashboardData, setDashboardData] = useState({
    metrics: {
      activeLoans: 0,
      disbursedTodayCount: 0,
      disbursedTodayAmount: 0,
      repaymentsCollected: 0,
      pendingApps: 0,
      overdueLoansCount: 0,
      overdueLoansAmount: 0,
      portfolioOutstanding: 0,
      defaultRate: 0,
      parValue: 0,
    },
    pipeline: { new: 0, review: 0, docs: 0, approved: 0, rejected: 0 },
    tasks: {
      approvedNotDisbursed: 0,
      loansDueToday: 0,
      overdue: 0,
      kycPending: 0
    },
    repayment: {
      dueToday: 0,
      collectedToday: 0,
      collectionRate: 0,
      missedPayments: 0
    },
    delinquency: { buckets: [], writeOffs: 0 },
    par30: 0,
    agentPerformance: { processed: 0, approvalRate: 0, avgTime: 0, conversionRate: 0 },
    collectorPerformance: { calls: 0, collectedAmount: 0, recoveryRate: 0, ptpKept: 0 },
    disbursement: { failedCount: 0, failedAmount: 0, pendingCount: 0 },
    portfolio: { status: { labels: [], data: [] }, types: { labels: [], data: [] } },
    recentActivity: [],
    alerts: [],
    collectionsActivity: { callsMade: 0, successRate: 0, ptpCreated: 0, ptpKept: 0 },
    revenue: { interest: 0, penalties: 0, processingFees: 0, registrationFees: 0, totalRevenue: 0 }
  });

  const [chartData, setChartData] = useState([]);

  // Raw Data Store
  const [rawData, setRawData] = useState({
    loans: [],
    customers: [],
    payments: [],
    installments: [],
    interactions: [],
    ptps: []
  });

  // Filter Helpers
  const fetchBranches = async (regionId) => {
    try {
      let query = supabase.from("branches").select("id, name");
      if (regionId && regionId !== "all") {
        query = query.eq("region_id", regionId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching branches:", error);
      return [];
    }
  };

  const fetchRelationshipOfficers = async (branchId) => {
    try {
      let query = supabase
        .from("users")
        .select("id, full_name")
        .eq("role", "relationship_officer");

      if (branchId && branchId !== "all") {
        query = query.eq("branch_id", branchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(u => ({
        id: u.id,
        full_name: u.full_name
      }));
    } catch (error) {
      console.error("Error fetching ROs:", error);
      return [];
    }
  };

  const applyFilters = useCallback((data, type = 'loans') => {
    if (!Array.isArray(data)) return [];

    return data.filter(item => {
      if (selectedRegion !== "all" && item.region_id !== selectedRegion) return false;
      if (selectedBranch !== "all" && item.branch_id !== selectedBranch) return false;
      
      if (selectedRO !== "all") {
        const field = type === 'loans' ? 'booked_by' : 'created_by';
        if (String(item[field]) !== String(selectedRO)) return false;
      }

      return true;
    });
  }, [selectedRegion, selectedBranch, selectedRO]);

  // Handle Filter Changes
  const handleRegionChange = async (val) => {
    setSelectedRegion(val);
    setSelectedBranch("all");
    setSelectedRO("all");
    const branches = await fetchBranches(val);
    setAvailableBranches(branches);
  };

  const handleBranchChange = async (val) => {
    setSelectedBranch(val);
    setSelectedRO("all");
    const ros = await fetchRelationshipOfficers(val);
    setAvailableROs([{ id: "all", full_name: "All ROs" }, ...ros]);
  };

  const handleROChange = (val) => setSelectedRO(val);

  // Helper function to get date range based on filter
  const getDateRange = useCallback(() => {
    const today = getLocalYYYYMMDD();
    
    if (dateFilter === 'custom_range' && customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate };
    }
    
    if (dateFilter === 'today') {
      return { start: today, end: today };
    }
    
    if (dateFilter === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalYYYYMMDD(yesterday);
      return { start: yesterdayStr, end: yesterdayStr };
    }
    
    if (dateFilter === 'this_week') {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      return { start: getLocalYYYYMMDD(startOfWeek), end: today };
    }
    
    if (dateFilter === 'this_month') {
      const startOfMonth = today.substring(0, 7) + '-01';
      return { start: startOfMonth, end: today };
    }
    
    if (dateFilter === 'last_month') {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { 
        start: getLocalYYYYMMDD(lastMonth), 
        end: getLocalYYYYMMDD(lastMonthEnd) 
      };
    }
    
    // all_time
    return { start: '2000-01-01', end: today };
  }, [dateFilter, customStartDate, customEndDate]);

  // Fetch Real Data
  const fetchRealData = useCallback(async () => {
    setLoading(true);
    try {
      const today = getLocalYYYYMMDD();
      const startOfMonth = today.substring(0, 7) + '-01';

      // Get current user
      const storedUserId = localStorage.getItem("userId");
      const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      const userId = authData?.user?.id || storedUserId;

      if (!userId) {
        console.error("No authenticated user");
        setLoading(false);
        return;
      }

      // Get tenant_id
      const tenantIdFromStorage = (() => {
        try {
          const profile = JSON.parse(localStorage.getItem("profile") || "{}");
          return profile.tenant_id;
        } catch { return null; }
      })();

      let tenantId = authData?.user?.app_metadata?.tenant_id || tenantIdFromStorage;

      try {
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', userId)
          .single();

        if (!profileError && profile?.tenant_id) {
          tenantId = profile.tenant_id;
        }
      } catch (error) {
        console.warn("Could not fetch user profile:", error);
      }

      if (!tenantId) {
        console.error("No tenant_id available");
        setLoading(false);
        return;
      }

      // Fetch Loans
      const { data: loans, error: loansError } = await supabase
        .from('loans')
        .select('*')

      if (loansError) console.error("Error fetching loans:", loansError);
      const loansData = loans || [];

      // Fetch Customers
      const { data: customers } = await supabase
        .from('customers')
        .select('id, status, created_at')
        .eq('tenant_id', tenantId);
      const custData = customers || [];

      // Fetch Loan Payments
      let paymentsData = [];
      try {
        const { data: payments } = await supabase
          .from('loan_payments')
          .select('*')
        paymentsData = payments || [];
      } catch (error) {
        console.warn('loan_payments table not available:', error);
      }

      // Fetch Installments
      let installmentsData = [];
      try {
        const { data: installments } = await supabase
          .from('loan_installments')
          .select('*')
        installmentsData = installments || [];
      } catch (error) {
        console.warn('loan_installments table not available:', error);
      }

      // Fetch Collections Data
      let interactionsData = [];
      let ptpsData = [];

      try {
        const { data: interactions } = await supabase
          .from('customer_interactions')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('created_at', startOfMonth);
        interactionsData = interactions || [];
      } catch (error) {
        console.warn('customer_interactions table not available:', error);
      }

      try {
        const { data: ptps } = await supabase
          .from('promise_to_pay')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('created_at', startOfMonth);
        ptpsData = ptps || [];
      } catch (error) {
        console.warn('promise_to_pay table not available:', error);
      }

      // Store Raw Data
      setRawData({
        loans: loansData,
        customers: custData,
        payments: paymentsData,
        installments: installmentsData,
        interactions: interactionsData,
        ptps: ptpsData
      });

      // Fetch user profile and options
      if (!userProfile) {
        const { data: userP } = await supabase.from('users').select('*').eq('id', userId).single();
        if (userP) {
          setUserProfile(userP);
          
          if (userP.role === 'branch_manager') {
            setSelectedBranch(userP.branch_id);
            setAvailableBranches([{ id: userP.branch_id, name: 'My Branch' }]);
          }

          const branches = await fetchBranches("all");
          setAvailableBranches([{ id: "all", name: "All Branches" }, ...branches]);

          const ros = await fetchRelationshipOfficers("all");
          setAvailableROs([{ id: "all", full_name: "All ROs" }, ...ros]);

          const { data: regions } = await supabase.from('regions').select('id, name');
          setAvailableRegions(regions || []);
        }
      }

      setLoading(false);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setLoading(false);
    }
  }, [userProfile]);

  // Calculate Metrics
  const calculateMetrics = useCallback(() => {
    try {
      const { loans, customers, payments, installments, interactions, ptps } = rawData;

      // Apply Filters
      const loansData = applyFilters(loans, 'loans');
      const custData = applyFilters(customers, 'customers');

      // Get filtered loan IDs
      const filteredLoanIds = new Set(loansData.map(l => l.id));

      // Filter dependent data
      const filteredPayments = payments.filter(p => filteredLoanIds.has(p.loan_id));
      const filteredInstallments = installments.filter(i => filteredLoanIds.has(i.loan_id));

      const today = getLocalYYYYMMDD();
      const startOfMonth = today.substring(0, 7) + '-01';

      // ===== ACTIVE LOANS CALCULATION =====
      // Active loans: disbursed OR partially_disbursed, repayment_state = ongoing/partial/overdue (not completed/defaulted)
      const activeLoans = loansData.filter(l => {
        const isDisbursed = l.status === 'disbursed' || l.status === 'partially_disbursed';
        const isActive = ['ongoing', 'partial', 'overdue'].includes(l.repayment_state);
        return isDisbursed && isActive;
      });

      // Calculate total principal (scored_amount) for active loans
      const totalActivePrincipal = activeLoans.reduce((sum, l) => sum + (Number(l.scored_amount) || 0), 0);

      // ===== DISBURSED TODAY CALCULATION =====
      const disbursedToday = loansData.filter(l => {
        return l.status === 'disbursed' && l.disbursed_at && getLocalYYYYMMDD(l.disbursed_at) === today;
      });
      // scored_amount is the principal amount
      const disbursedTodayAmount = disbursedToday.reduce((sum, l) => sum + (Number(l.scored_amount) || 0), 0);

      // ===== COLLECTIONS TODAY (from loan_payments table - sum of paid_amount) =====
      const todayPayments = filteredPayments.filter(p => {
        return p.paid_at && getLocalYYYYMMDD(p.paid_at) === today;
      });
      const collectedToday = todayPayments.reduce((sum, p) => sum + (Number(p.paid_amount) || 0), 0);

      // ===== OLB CALCULATION (Outstanding Loan Balance) =====
      // OLB = Sum of (total_payable) for active loans - Sum of all paid_amount
      const totalPayable = activeLoans.reduce((sum, l) => sum + (Number(l.total_payable) || 0), 0);
      const totalPaid = filteredPayments.reduce((sum, p) => sum + (Number(p.paid_amount) || 0), 0);
      const olb = Math.max(0, totalPayable - totalPaid);

      // ===== PAR CALCULATION (Arrears / OLB) =====
      // Total Arrears = Sum of overdue/partial installments where (due_amount - (principal_paid + interest_paid)) > 0
      let totalArrears = 0;
      const overdueInstallments = filteredInstallments.filter(inst => {
        return ['overdue', 'partial'].includes(inst.status) && inst.due_date && inst.due_date <= today;
      });

      overdueInstallments.forEach(inst => {
        const dueAmount = Number(inst.due_amount) || 0;
        const paidAmount = (Number(inst.principal_paid) || 0) + (Number(inst.interest_paid) || 0);
        const arrears = Math.max(0, dueAmount - paidAmount);
        totalArrears += arrears;
      });

      // PAR = (Total Arrears / OLB) × 100
      const parValue = olb > 0 ? ((totalArrears / olb) * 100).toFixed(1) : 0;


      // ===== REVENUE CALCULATION (Date Range Based) =====
      // Get date range based on filter (supports custom range)
      const { start: revenueStartDate, end: revenueEndDate } = getDateRange();

      // Filter payments for the date range
      const dateRangePayments = filteredPayments.filter(p => {
        if (!p.paid_at) return false;
        const paidDate = getLocalYYYYMMDD(p.paid_at);
        return paidDate >= revenueStartDate && paidDate <= revenueEndDate;
      });
      
      // Interest Earned: Sum all interest_paid from loan_payments (regardless of payment_type)
      const interestEarned = dateRangePayments.reduce((sum, p) => sum + (Number(p.interest_paid) || 0), 0);
      
      // Penalties: from loans.net_penalties (for active loans with penalties)
      // net_penalties is a generated column: (total_penalties - penalty_waived)
      const netPenalties = activeLoans.reduce((sum, l) => sum + (Number(l.net_penalties) || 0), 0);

      // Processing Fees & Registration Fees: from loans table for disbursed loans in date range
      const dateRangeDisbursedLoans = loansData.filter(l => {
        if (l.status !== 'disbursed' || !l.disbursed_at) return false;
        const disbursedDate = getLocalYYYYMMDD(l.disbursed_at);
        return disbursedDate >= revenueStartDate && disbursedDate <= revenueEndDate;
      });

      const processingFees = dateRangeDisbursedLoans
        .filter(l => l.processing_fee_paid === true)
        .reduce((sum, l) => sum + (Number(l.processing_fee) || 0), 0);

      const registrationFees = dateRangeDisbursedLoans
        .filter(l => l.registration_fee_paid === true)
        .reduce((sum, l) => sum + (Number(l.registration_fee) || 0), 0);

      const totalRevenue = interestEarned + netPenalties + processingFees + registrationFees;


      // ===== OTHER METRICS =====
      const overdueLoans = loansData.filter(l => l.repayment_state === 'overdue');
      const overdueLoansCount = overdueLoans.length;

      const defaultedLoans = loansData.filter(l => l.repayment_state === 'defaulted');
      const defaultRate = activeLoans.length > 0 ? 
        ((defaultedLoans.length / activeLoans.length) * 100).toFixed(1) : 0;

      const pendingApps = loansData.filter(l => 
        ['booked', 'bm_review', 'rn_review', 'ca_review'].includes(l.status)
      ).length;

      // ===== PIPELINE =====
      const pipeline = {
        new: loansData.filter(l => l.status === 'booked' && l.is_new_loan).length,
        review: loansData.filter(l => ['bm_review', 'rn_review', 'ca_review'].includes(l.status)).length,
        docs: custData.filter(c => c.status === 'pending').length,
        approved: loansData.filter(l => ['approved', 'ready_for_disbursement'].includes(l.status)).length,
        rejected: loansData.filter(l => l.status === 'rejected').length
      };

      // ===== TASKS =====
      const todayInstallments = filteredInstallments.filter(inst => inst.due_date === today);
      
      const tasks = {
        approvedNotDisbursed: loansData.filter(l => l.status === 'ready_for_disbursement').length,
        loansDueToday: todayInstallments.length,
        overdue: overdueLoansCount,
        kycPending: custData.filter(c => ['pending_kyc', 'pending'].includes(c.status)).length
      };

      // ===== REPAYMENT =====
      const todayExpected = todayInstallments.reduce((sum, inst) => sum + (Number(inst.due_amount) || 0), 0);
      const todayCollectionRate = todayExpected > 0 ? ((collectedToday / todayExpected) * 100).toFixed(1) : 0;

      const repayment = {
        dueToday: todayExpected,
        collectedToday: collectedToday,
        collectionRate: todayCollectionRate,
        missedPayments: 0
      };

      // ===== COLLECTIONS ACTIVITY (from promise_to_pay) =====
      const callsMade = interactions.filter(i => i.type === 'call').length;
      const successfulCalls = interactions.filter(i => i.type === 'call' && i.outcome === 'successful').length;
      const successRate = callsMade > 0 ? Math.round((successfulCalls / callsMade) * 100) : 0;
      
      const ptpCreated = ptps.length;
      const ptpKeptCount = ptps.filter(p => p.status === 'kept').length;
      const ptpKeptRate = ptpCreated > 0 ? Math.round((ptpKeptCount / ptpCreated) * 100) : 0;

      // ===== PORTFOLIO CHARTS =====
      const statusCounts = {};
      loansData.forEach(l => {
        const status = l.repayment_state || l.status || 'Unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const typeCounts = {};
      loansData.forEach(l => {
        const type = l.product_type || l.product_name || 'General';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });

      // ===== REPAYMENT CHART DATA (Weekly Collections) =====
      // Get the last 7 days of payment data
      const last7Days = [];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = getLocalYYYYMMDD(date);
        const dayName = dayNames[date.getDay()];
        
        // Sum all payments for this day
        const dayPayments = filteredPayments.filter(p => 
          p.paid_at && getLocalYYYYMMDD(p.paid_at) === dateStr
        );
        
        const dayAmount = dayPayments.reduce((sum, p) => sum + (Number(p.paid_amount) || 0), 0);
        
        last7Days.push({
          name: dayName,
          amount: dayAmount,
          date: dateStr
        });
      }

      // ===== UPDATE DASHBOARD DATA =====
      setDashboardData({
        metrics: {
          activeLoans: activeLoans.length,
          disbursedTodayCount: disbursedToday.length,
          disbursedTodayAmount: disbursedTodayAmount,
          repaymentsCollected: collectedToday,
          pendingApps: pendingApps,
          overdueLoansCount: overdueLoansCount,
          overdueLoansAmount: totalArrears,
          portfolioOutstanding: olb, // Using OLB (Outstanding Loan Balance)
          defaultRate: defaultRate,
          parValue: parValue,
        },
        pipeline,
        tasks,
        repayment,
        delinquency: { buckets: [], writeOffs: 0 },
        par30: parValue,
        agentPerformance: { processed: 0, approvalRate: 0, avgTime: 0, conversionRate: 0 },
        collectorPerformance: { calls: 0, collectedAmount: 0, recoveryRate: 0, ptpKept: 0 },
        disbursement: { failedCount: 0, failedAmount: 0, pendingCount: 0 },
        portfolio: {
          status: { 
            labels: Object.keys(statusCounts), 
            data: Object.values(statusCounts) 
          },
          types: { 
            labels: Object.keys(typeCounts), 
            data: Object.values(typeCounts) 
          }
        },
        recentActivity: [],
        alerts: [],
        collectionsActivity: {
          callsMade,
          successRate,
          ptpCreated,
          ptpKept: ptpKeptRate
        },
        revenue: {
          interest: interestEarned,
          penalties: netPenalties,
          processingFees: processingFees,
          registrationFees: registrationFees,
          totalRevenue: totalRevenue
        }
      });

      // Set actual chart data from database
      setChartData(last7Days);

   

    } catch (error) {
      console.error("Error calculating metrics:", error);
    }
  }, [rawData, applyFilters, getDateRange]);

  useEffect(() => {
    fetchRealData();
  }, [fetchRealData]);

  useEffect(() => {
    calculateMetrics();
  }, [rawData, selectedRegion, selectedBranch, selectedRO, dateFilter, customStartDate, customEndDate, calculateMetrics]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="bg-brand-surface min-h-screen pb-6 font-sans">
      <div className="p-4 sm:p-6 max-w-[1920px] mx-auto space-y-5">

        {/* Header & Filters */}
        <div className="flex flex-col gap-4 border-b border-gray-200 pb-4">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-lg font-bold text-gray-600 tracking-tight">Operations Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Real-time overview of lending operations</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 shadow-sm mr-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live
              </div>
              <button 
                onClick={fetchRealData} 
                className="p-2 text-gray-500 hover:text-brand-primary hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
            <FilterSelectCompact
              icon={Home}
              value={selectedRegion}
              onChange={handleRegionChange}
              options={[
                { value: 'all', label: 'All Regions' }, 
                ...availableRegions.map(r => ({ value: r.id, label: r.name }))
              ]}
            />
            <FilterSelectCompact
              icon={Building}
              value={selectedBranch}
              onChange={handleBranchChange}
              options={availableBranches.map(b => ({ value: b.id, label: b.name }))}
            />
            <FilterSelectCompact
              icon={UserCircle}
              value={selectedRO}
              onChange={handleROChange}
              options={availableROs.map(ro => ({ value: ro.id, label: ro.full_name }))}
            />
            <FilterSelectCompact
              icon={Calendar}
              value={dateFilter}
              onChange={setDateFilter}
              options={[
                { value: 'today', label: 'Today' },
                { value: 'yesterday', label: 'Yesterday' },
                { value: 'this_week', label: 'This Week' },
                { value: 'this_month', label: 'This Month' },
                { value: 'last_month', label: 'Last Month' },
                { value: 'custom_range', label: 'Custom Range' },
                { value: 'all_time', label: 'All Time' }
              ]}
            />
          </div>

          {/* Custom Date Range Picker - Show only when custom_range is selected */}
          {dateFilter === 'custom_range' && (
            <CustomDateRangeFilter
              startDate={customStartDate}
              endDate={customEndDate}
              onStartChange={setCustomStartDate}
              onEndChange={setCustomEndDate}
              onApply={calculateMetrics}
            />
          )}
        </div>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Active Loans"
            value={dashboardData.metrics.activeLoans}
            subValue={formatCurrency(dashboardData.metrics.portfolioOutstanding)}
            icon={Users}
            color="brand"
            className="bg-gradient-to-br from-blue-50 to-white border-blue-100"
          />
          <MetricCard
            title="Disbursed Today"
            value={dashboardData.metrics.disbursedTodayCount}
            subValue={formatCurrency(dashboardData.metrics.disbursedTodayAmount)}
            icon={DollarSign}
            color="green"
            className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100"
          />
          <MetricCard
            title="Collected Today"
            value={formatCurrency(dashboardData.metrics.repaymentsCollected)}
            subValue={`${dashboardData.repayment.collectionRate}% Rate`}
            icon={Briefcase}
            color="indigo"
            className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100"
          />
          <MetricCard
            title="Portfolio At Risk"
            value={`${dashboardData.par30}%`}
            subValue={`PAR `}
            icon={AlertTriangle}
            color="red"
            className="bg-gradient-to-br from-red-50 to-white border-red-100"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left Column */}
          <div className="space-y-5">
            <PipelineWidget data={dashboardData.pipeline} />
            <DelinquencyWidget data={dashboardData.delinquency} par30={dashboardData.par30} />
            <CollectionsActivityWidget data={dashboardData.collectionsActivity} />
          </div>

          {/* Middle Column */}
          <div className="space-y-5">
            <TasksWidget data={dashboardData.tasks} />
            <PortfolioChartsWidget
              statusData={dashboardData.portfolio.status}
              typeData={dashboardData.portfolio.types}
            />
            <RevenueWidget data={dashboardData.revenue} />
          </div>

          {/* Right Column */}
          <div className="space-y-5">
            <RepaymentWidget data={dashboardData.repayment} chartData={chartData} />
            <DisbursementWidget data={dashboardData.disbursement} />
            <div className="bg-gradient-to-b from-blue-50/50 to-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
              <PerformanceWidget type="agent" data={dashboardData.agentPerformance} title="Officer Performance" />
            </div>
            <PerformanceWidget type="collector" data={dashboardData.collectorPerformance} />
            <SystemAlertsWidget alerts={dashboardData.alerts} />
          </div>

        </div>
      </div>
    </div>
  );
};

export default OperationsDashboard;