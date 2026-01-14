import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import Spinner from "../components/Spinner";
import {
  Briefcase, Receipt, CreditCard, Shield, Users, Clock,
  Home, Building, UserCircle, Search, TrendingUp, TrendingDown,
  AlertTriangle, Calendar, FileCheck, PhoneCall,
  ChevronRight, Database, CheckCircle, AlertOctagon,
  User, Target, BarChart3, CalendarDays, CalendarCheck,
  RefreshCw, ThumbsUp, UserCog, AlertCircle
} from 'lucide-react';
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

// Color System
const COLORS = {
  background: '#E7F0FA',
  secondary: '#7BA4D0',
  primary: '#586ab1',
  authority: '#0D2440',
  surface: '#d9e2e8',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444'
};

// ========== UTILITY FUNCTIONS ==========
const getLocalYYYYMMDD = (d = new Date()) => {
  const date = new Date(d);
  const kenyaTime = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const year = kenyaTime.getUTCFullYear();
  const month = String(kenyaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kenyaTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Add this with the other date utility functions
const getYearStartDate = () => {
  const now = new Date();
  return getLocalYYYYMMDD(new Date(now.getFullYear(), 0, 1));
};

const getTodayDate = () => getLocalYYYYMMDD(new Date());
const getTomorrowDate = () => {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return getLocalYYYYMMDD(t);
};
const getMonthStartDate = () => {
  const now = new Date();
  return getLocalYYYYMMDD(new Date(now.getFullYear(), now.getMonth(), 1));
};
const getMonthEndDate = () => {
  const now = new Date();
  return getLocalYYYYMMDD(new Date(now.getFullYear(), now.getMonth() + 1, 0));
};

// FULL currency formatting (no K/M/B)
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return "0.00";
  const numAmount = Number(amount);
  const parts = numAmount.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimalPart = parts[1];
  return `${integerPart}.${decimalPart}`;
};

// ========== UI COMPONENTS ==========
const SectionHeader = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-3 mb-6">
    <div className="relative flex items-center">
      <div
        className="px-4 py-2 rounded-r-full flex items-center gap-2 shadow-sm"
        style={{ backgroundColor: COLORS.primary }}
      >
        <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
        <h2 className="text-white text-base whitespace-nowrap">
          {title}
        </h2>
      </div>
    </div>
  </div>
);

const CircularProgress = ({
  percentage,
  size = 120,
  strokeWidth = 14,
  activeStrokeWidth = 18,
  label,
  collected,
  expected,
  shortfall,
  isParMetric = false
}) => {
  const radius = (size - activeStrokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (isParMetric) {
      if (percentage <= 40) return COLORS.success;
      if (percentage <= 70) return COLORS.warning;
      return COLORS.danger;
    } else {
      if (percentage <= 40) return COLORS.danger;
      if (percentage <= 70) return COLORS.warning;
      return COLORS.success;
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth={activeStrokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="butt"
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: getColor() }}>
              {Math.round(percentage)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        </div>
      </div>

      {collected !== undefined && (
        <div className="mt-4 space-y-2 w-full">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Collected:</span>
            <span className="font-semibold" style={{ color: COLORS.success }}>
              {formatCurrency(collected)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Expected:</span>
            <span className="font-semibold" style={{ color: COLORS.authority }}>
              {formatCurrency(expected)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Shortfall:</span>
            <span className="font-semibold" style={{ color: COLORS.danger }}>
              {formatCurrency(shortfall)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Semi-Circle Progress with conditional coloring
const SemiCircleProgress = ({
  percentage,
  label,
  size = 140,
  strokeWidth = 12,
  activeStrokeWidth = 16,
}) => {
  const radius = 60;
  const circumference = Math.PI * radius;
  const progressLength = (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage <= 40) return COLORS.danger;
    if (percentage <= 70) return COLORS.warning;
    return COLORS.success;
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size / 2 }}>
        <svg
          width={size}
          height={size / 2}
          viewBox="0 0 140 70"
        >
          {/* Background track */}
          <path
            d="M 10,70 A 60,60 0 0,1 130,70"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
          />

          {/* Active progress */}
          <path
            d="M 10,70 A 60,60 0 0,1 130,70"
            fill="none"
            stroke={getColor()}
            strokeWidth={activeStrokeWidth}
            strokeLinecap="butt"
            strokeDasharray={`${progressLength} ${circumference}`}
            style={{
              transition: "stroke-dasharray 600ms ease, stroke-width 400ms ease",
            }}
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <div className="text-center">
            <div
              className="text-xl font-bold"
              style={{ color: getColor() }}
            >
              {Math.round(percentage)}%
            </div>
            <div className="text-xs text-gray-500">
              {label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FilterSelectCompact = ({ icon: Icon, value, onChange, options }) => (
  <div className="relative">
    <div className="absolute left-3 top-1/2 -translate-y-1/2">
      <Icon className="w-4 h-4" style={{ color: COLORS.primary }} strokeWidth={2.4} />
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full pl-9 pr-3 py-2 rounded-md text-sm font-normal appearance-none cursor-pointer outline-none"
      style={{
        backgroundColor: COLORS.background,
        color: COLORS.authority,
        border: `1px solid ${COLORS.surface}`,
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  subtext, 
  color = COLORS.primary, 
  bgColor = COLORS.background,
}) => (
  <div 
    className="p-4 sm:p-5 rounded-xl shadow-sm"
    style={{ 
      backgroundColor: bgColor,
      border: `1px solid #E5E7EB`
    }}
  >
    <div className="space-y-1">
        {subtext && (
        <div className="text-2xl font-semibold " style={{color:COLORS.primary}}>{subtext}</div>
      )}
            <div className="text-xs sm:text-sm font-medium text-gray-600">{label}</div>
      <div className="h-px bg-gray-200 my-2" />

      <div className="text-sm sm:text-sm font-bold" style={{ color }}>
        {value}
      </div>
    
    </div>
  </div>
);

const PortfolioStatCard = ({ 
  label, 
  amount, 
  details, 
  color = COLORS.authority,
  bgColor = COLORS.background,
}) => (
  <div className="p-5 sm:p-6 min-h-[190px] rounded-xl shadow-sm flex flex-col justify-between"
    style={{ 
      backgroundColor: bgColor,
      border: `1px solid #E5E7EB`
    }}
  >
   
    <div className="text-3xl sm:text-3xl font-extrabold" style={{ color }}>
      {amount}
    </div>
     <div>
      <div className="text-sm font-medium text-gray-600 mt-2">{label}</div>
    </div>
          <div className="h-px bg-gray-300 mt-5" />

    {details && (
      <div className="text-sm mt-2 text-gray-600 text-right w-full ">
        {details}
      </div>
    )}
  </div>
);

const CollectionCard = ({
  title,
  percentage,
  collected,
  expected,
  shortfall,
  label,
}) => (
  <div 
    className="p-6 rounded-xl flex flex-col items-center" 
    style={{
      backgroundColor: COLORS.background,
      border: `1px solid #E5E7EB`
    }}
  >
    <h3 className="text-sm mb-4 text-gray-600">
      {title}
    </h3>
    <CircularProgress
      percentage={percentage}
      label={label}
      collected={collected}
      expected={expected}
      shortfall={shortfall}
    />
  </div>
);

const RiskMetricCard = ({
  label,
  amount,
  details,
  color = COLORS.danger,
  bgColor = '#fee2e2',
}) => (
  <div 
    className="p-4 rounded-xl text-center" 
    style={{
      backgroundColor: bgColor,
      border: `1px solid #94a3b8`
    }}
  >
    <div className="text-xs mb-2 text-gray-600">{label}</div>
    <div className="text-xl font-bold" style={{ color }}>
      {amount}
    </div>
    <div className="text-xs mt-1 text-gray-600">
      {details}
    </div>
  </div>
);


const LeadConversionCard = ({
  title,
  percentage,
  label,
  leadsText,
  titleColor = COLORS.authority,
  bgColor = COLORS.background,
  borderColor = '#9ca3af',
  leadsTextColor = '#6B7280'
}) => (
  <div 
    className="p-4 rounded-xl" 
    style={{
      backgroundColor: bgColor,
      border: `1px solid ${borderColor}`
    }}
  >
    <h4 className="text-sm text-center mb-3" style={{ color: titleColor }}>
      {title}
    </h4>
    <div className="flex justify-center">
      <SemiCircleProgress
        percentage={percentage}
        label={label}
      />
    </div>
    <div className="mt-3 text-center text-sm" style={{ color: leadsTextColor }}>
      {leadsText}
    </div>
  </div>
);

const CustomerStatBox = ({
  value,
  label,
  color = COLORS.success,
  bgColor = `${COLORS.success}15`,
}) => (
  <div 
    className="text-center p-3 rounded-lg" 
    style={{ backgroundColor: bgColor }}
  >
    <div className="text-2xl font-bold" style={{ color }}>
      {value}
    </div>
    <div className="text-xs mt-1 text-gray-600">{label}</div>
  </div>
);

const PendingActionCard = ({
  icon: Icon,
  value,
  label,
  color = COLORS.primary,
  bgColor = COLORS.background,
  iconBgColor,
}) => (
  <div 
    className="p-5 rounded-xl cursor-pointer hover:shadow-lg transition-shadow"
    style={{
      backgroundColor: bgColor,
      border: `1px solid #9ca3af`
    }}
  >
    <div className="flex items-center justify-between mb-3">
      <div 
        className="p-2 rounded-lg"
        style={{ backgroundColor: iconBgColor || `${color}20` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </div>
    <div className="text-3xl font-bold mb-1" style={{ color }}>
      {value}
    </div>
    <div className="text-sm text-gray-600">{label}</div>
  </div>
);

// ========== MAIN DASHBOARD COMPONENT ==========
const Dashboard = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const navigate = useNavigate();

  // Filter states
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedRO, setSelectedRO] = useState("all");
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [availableROs, setAvailableROs] = useState([]);

  // Search state
  const [quickSearchTerm, setQuickSearchTerm] = useState("");
  const [quickSearchResults, setQuickSearchResults] = useState([]);
  const [allCustomersForSearch, setAllCustomersForSearch] = useState([]);
  const searchContainerRef = useRef(null);

  // Data states
  const [allLoans, setAllLoans] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [allInstallments, setAllInstallments] = useState([]);

  // Dashboard data
  const [dashboardData, setDashboardData] = useState({
    portfolio: {
      totalLoans: 0,
      outstandingBalance: 0,
      cleanBook: 0,
      cleanBookPercentage: 0,
      performingLoans: 0,
      performingAmount: 0,
      nplLoans: 0,
      nplAmount: 0,
      nplPercentage: 0,
      totalArrears: 0,
      arrearsLoans: 0,
    },
    disbursements: {
      total: 0,
      totalAmount: 0,
      today: 0,
      todayAmount: 0,
      thisMonth: 0,
      thisMonthAmount: 0,
        ytd: 0, 
    ytdAmount: 0, 
    },
    collections: {
      today: { collected: 0, expected: 0, rate: 0 },
      month: { collected: 0, expected: 0, rate: 0 },
      tomorrow: { expected: 0, prepaid: 0, rate: 0 },
    },
    customers: {
      total: 0,
      active: 0,
      inactive: 0,
      newToday: 0,
      newMonth: 0,
        newYTD: 0,
      leadsToday: 0,
      leadsMonth: 0,
      convertedToday: 0,
      convertedMonth: 0,
      conversionRateToday: 0,
      conversionRateMonth: 0,
    },
    risk: {
      par: 0,
      totalArrears: 0,
      arrearsLoans: 0,
      mtdArrears: 0,
      mtdArrearsLoans: 0,
      outstandingBalance: 0,
    },
    pending: {
      disbursement: 0,
      loanBM: 0,
      loanRM: 0,
      customerBM: 0,
      customerCallbacks: 0,
      customerHQ: 0,
    }
  });

  // ========== DATA FETCHING & CALCULATION FUNCTIONS ==========
  const fetchUserProfile = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!user) return null;

      const tenantId = user.app_metadata?.tenant_id;

      let userQuery = supabase
        .from("users")
        .select("role, full_name")
        .eq("id", user.id);

      if (tenantId) userQuery = userQuery.eq("tenant_id", tenantId);

      const { data: userData, error: userError } = await userQuery.single();
      if (userError) throw userError;

      let profileQuery = supabase
        .from("profiles")
        .select(`
          region_id,
          branch_id,
          branches!inner(name, code, region_id),
          regions!inner(name, code)
        `)
        .eq("id", user.id);

      if (tenantId) profileQuery = profileQuery.eq("tenant_id", tenantId);

      const { data: profileData, error: profileError } = await profileQuery.single();

      if (profileError) {
        const profile = {
          id: user.id,
          role: userData.role,
          fullName: userData.full_name,
          regionId: null,
          branchId: null,
          regionName: null,
          branchName: null,
          tenantId,
        };
        setUserProfile(profile);
        return profile;
      }

      const profile = {
        id: user.id,
        role: userData.role,
        fullName: userData.full_name,
        regionId: profileData.region_id,
        branchId: profileData.branch_id,
        regionName: profileData.regions?.name ?? null,
        branchName: profileData.branches?.name ?? null,
        tenantId,
      };

      setUserProfile(profile);
      return profile;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
  };

  const fetchRegions = async () => {
    if (!userProfile?.tenantId) return [];
    try {
      const { data, error } = await supabase
        .from("regions")
        .select("id, name, code")
        .eq("tenant_id", userProfile.tenantId)
        .order("name");
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching regions:", error);
      return [];
    }
  };

  const fetchBranches = async (regionId = "all") => {
    if (!userProfile?.tenantId) return [];
    try {
      let query = supabase
        .from("branches")
        .select("id, name, code, region_id")
        .eq("tenant_id", userProfile.tenantId)
        .order("name");
      if (regionId !== "all") query = query.eq("region_id", regionId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching branches:", error);
      return [];
    }
  };

  const fetchRelationshipOfficers = async (branchId = "all", regionId = "all") => {
    if (!userProfile?.tenantId) return [];
    try {
      let query = supabase
        .from("profiles")
        .select(`
          id,
          branch_id,
          users!inner(id, full_name, role),
          branches!inner(id, name, region_id)
        `)
        .eq("tenant_id", userProfile.tenantId)
        .eq("users.role", "relationship_officer");

      if (branchId !== "all") {
        query = query.eq("branch_id", branchId);
      } else if (regionId !== "all" && regionId !== null) {
        query = query.eq("branches.region_id", regionId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map(ro => ({
        id: ro.users.id,
        full_name: ro.users.full_name,
        branch_id: ro.branch_id,
      }));
    } catch (error) {
      console.error("Error fetching ROs:", error);
      return [];
    }
  };

  const initializeFilters = async (profile) => {
    setSelectedRegion("all");
    setSelectedBranch("all");
    setSelectedRO("all");
    setAvailableRegions([]);
    setAvailableBranches([]);
    setAvailableROs([]);
    
    const regions = await fetchRegions();
    const branches = await fetchBranches("all");
    const ros = await fetchRelationshipOfficers("all", "all");
    
    setAvailableRegions(regions);
    setAvailableBranches(branches);
    setAvailableROs([{ id: "all", full_name: "All ROs" }, ...ros]);
    
    if (profile.role === "regional_manager") {
      setSelectedRegion(profile.regionId);
      const regionBranches = await fetchBranches(profile.regionId);
      setAvailableBranches(regionBranches);
      const regionROs = await fetchRelationshipOfficers("all", profile.regionId);
      setAvailableROs([{ id: "all", full_name: "All ROs" }, ...regionROs]);
    } else if (profile.role === "branch_manager") {
      setSelectedBranch(profile.branchId);
      const branch = branches.find(b => b.id === profile.branchId);
      if (branch) setSelectedRegion(branch.region_id);
      const branchROs = await fetchRelationshipOfficers(profile.branchId, "all");
      setAvailableROs([{ id: "all", full_name: "All ROs" }, ...branchROs]);
    } else if (profile.role === "relationship_officer") {
      const selfRO = ros.find(ro => ro.id === profile.id);
      if (selfRO) {
        setAvailableROs([{ id: selfRO.id, full_name: selfRO.full_name }]);
        setSelectedRO(selfRO.id);
      }
    }
  };

  const applyFilters = useCallback((data, tableName = "loans") => {
    if (!userProfile || !Array.isArray(data)) return [];
    const { role, regionId: userRegionId, branchId: userBranchId, id: userId } = userProfile;
    
    let result = [...data];
    
    if (role === "relationship_officer") {
      const field = tableName === "loans" ? "booked_by" : "created_by";
      return result.filter(item => String(item[field]) === String(userId));
    }
    if (role === "branch_manager") {
      result = result.filter(item => item.branch_id === userBranchId);
    }
    if (role === "regional_manager") {
      result = result.filter(item => item.region_id === userRegionId);
    }

    if (selectedRegion !== "all") {
      result = result.filter(item => item.region_id === selectedRegion);
    }
    if (selectedBranch !== "all") {
      result = result.filter(item => item.branch_id === selectedBranch);
    }
    if (selectedRO !== "all" && tableName !== "leads") {
      const field = tableName === "loans" ? "booked_by" : "created_by";
      result = result.filter(item => String(item[field]) === String(selectedRO));
    }

    return result;
  }, [userProfile, selectedRegion, selectedBranch, selectedRO]);

  const calculatePortfolioMetrics = useCallback((filteredLoans) => {
    const disbursedLoans = filteredLoans.filter(loan => loan.status === "disbursed");
    const loanIds = disbursedLoans.map(loan => loan.id);
    
    const filteredPayments = allPayments.filter(payment => loanIds.includes(payment.loan_id));
    const filteredInstallments = allInstallments.filter(installment => loanIds.includes(installment.loan_id));

    let totalPayable = 0;
    let totalPaid = 0;
    let totalArrears = 0;
    let arrearsLoans = new Set();
    let mtdArrears = 0;
    let mtdArrearsLoans = new Set();

    if (disbursedLoans.length > 0) {
      totalPayable = disbursedLoans.reduce((sum, loan) => sum + (Number(loan.total_payable) || 0), 0);
      totalPaid = filteredPayments.reduce((sum, payment) => sum + (Number(payment.paid_amount) || 0), 0);

      const today = getTodayDate();
      const monthStart = getMonthStartDate();
      
      const overdueInstallments = filteredInstallments.filter(inst => 
        ["overdue", "partial"].includes(inst.status) && inst.due_date && inst.due_date <= today
      );

      overdueInstallments.forEach(inst => {
        const dueAmount = Number(inst.due_amount) || 0;
        const paidAmount = (Number(inst.interest_paid) || 0) + (Number(inst.principal_paid) || 0);
        const arrears = dueAmount - paidAmount;
        
        if (arrears > 0) {
          totalArrears += arrears;
          arrearsLoans.add(inst.loan_id);
          
          // MTD Arrears: installments due this month that are unpaid
          if (inst.due_date >= monthStart && inst.due_date <= today) {
            mtdArrears += arrears;
            mtdArrearsLoans.add(inst.loan_id);
          }
        }
      });
    }

    const outstandingBalance = Math.max(0, totalPayable - totalPaid);
    const cleanBook = Math.max(0, outstandingBalance - totalArrears);
    const cleanBookPercentage = outstandingBalance > 0 ? (cleanBook / outstandingBalance) * 100 : 100;

    const nplLoans = filteredLoans.filter(loan => loan.status === "defaulted");
    const nplAmount = nplLoans.reduce((sum, loan) => sum + (Number(loan.total_payable) || 0), 0);

    const performingLoans = disbursedLoans.filter(loan => loan.status !== "defaulted");
    const performingAmount = performingLoans.reduce((sum, loan) => sum + (Number(loan.total_payable) || 0), 0);

    return {
      totalLoans: disbursedLoans.length,
      outstandingBalance,
      cleanBook,
      cleanBookPercentage,
      performingLoans: performingLoans.length,
      performingAmount,
      nplLoans: nplLoans.length,
      nplAmount,
      nplPercentage: totalPayable > 0 ? (nplAmount / totalPayable) * 100 : 0,
      totalArrears,
      arrearsLoans: arrearsLoans.size,
      mtdArrears,
      mtdArrearsLoans: mtdArrearsLoans.size,
    };
  }, [allPayments, allInstallments]);

 const calculateDisbursementMetrics = useCallback((filteredLoans) => {
  const disbursedLoans = filteredLoans.filter(loan => loan.status === "disbursed");
  const today = getTodayDate();
  const monthStart = getMonthStartDate();
  const yearStart = getYearStartDate();

  const disbursedToday = disbursedLoans.filter(loan => {
    if (!loan.disbursed_at) return false;
    const disbursedDate = getLocalYYYYMMDD(new Date(loan.disbursed_at));
    return disbursedDate === today;
  });

  const disbursedThisMonth = disbursedLoans.filter(loan => {
    if (!loan.disbursed_at) return false;
    const disbursedDate = getLocalYYYYMMDD(new Date(loan.disbursed_at));
    return disbursedDate >= monthStart && disbursedDate <= today;
  });

  const disbursedYTD = disbursedLoans.filter(loan => {
    if (!loan.disbursed_at) return false;
    const disbursedDate = getLocalYYYYMMDD(new Date(loan.disbursed_at));
    return disbursedDate >= yearStart && disbursedDate <= today;
  });

  return {
    total: disbursedLoans.length,
    totalAmount: disbursedLoans.reduce((sum, loan) => sum + (Number(loan.scored_amount) || 0), 0),
    today: disbursedToday.length,
    todayAmount: disbursedToday.reduce((sum, loan) => sum + (Number(loan.scored_amount) || 0), 0),
    thisMonth: disbursedThisMonth.length,
    thisMonthAmount: disbursedThisMonth.reduce((sum, loan) => sum + (Number(loan.scored_amount) || 0), 0),
    ytd: disbursedYTD.length,
    ytdAmount: disbursedYTD.reduce((sum, loan) => sum + (Number(loan.scored_amount) || 0), 0),
  };
}, []);

  const calculateCollectionMetrics = useCallback((filteredLoans) => {
    const loanIds = filteredLoans
      .filter(loan => loan.status === "disbursed")
      .map(loan => loan.id);

    if (loanIds.length === 0) {
      return {
        today: { collected: 0, expected: 0, rate: 0 },
        month: { collected: 0, expected: 0, rate: 0 },
        tomorrow: { expected: 0, prepaid: 0, rate: 0 },
      };
    }

    const today = getTodayDate();
    const monthStart = getMonthStartDate();
    const monthEnd = getMonthEndDate();
    const tomorrow = getTomorrowDate();

    const filteredInstallments = allInstallments.filter(inst => loanIds.includes(inst.loan_id));
    const filteredPayments = allPayments.filter(payment => loanIds.includes(payment.loan_id));

    const todayInstallments = filteredInstallments.filter(inst => inst.due_date === today);
    const todayPayments = filteredPayments.filter(payment => {
      const paymentDate = getLocalYYYYMMDD(new Date(payment.created_at));
      return paymentDate === today;
    });

    const monthInstallments = filteredInstallments.filter(inst => 
      inst.due_date && inst.due_date >= monthStart && inst.due_date <= monthEnd
    );
    const monthPayments = filteredPayments.filter(payment => {
      const paymentDate = getLocalYYYYMMDD(new Date(payment.created_at));
      return paymentDate >= monthStart && paymentDate <= monthEnd;
    });

    const tomorrowInstallments = filteredInstallments.filter(inst => inst.due_date === tomorrow);

    const todayExpected = todayInstallments.reduce((sum, inst) => sum + (Number(inst.due_amount) || 0), 0);
    const todayCollected = todayPayments.reduce((sum, payment) => sum + (Number(payment.paid_amount) || 0), 0);
    // FIXED: If both are 0, rate should be 0%
    const todayRate = todayExpected > 0 ? (todayCollected / todayExpected) * 100 : 0;

    const monthExpected = monthInstallments.reduce((sum, inst) => sum + (Number(inst.due_amount) || 0), 0);
    const monthCollected = monthPayments.reduce((sum, payment) => sum + (Number(payment.paid_amount) || 0), 0);
    const monthRate = monthExpected > 0 ? (monthCollected / monthExpected) * 100 : 0;

    const tomorrowExpected = tomorrowInstallments.reduce((sum, inst) => sum + (Number(inst.due_amount) || 0), 0);

    const prepaidPayments = filteredPayments.filter(payment => {
      const paymentDate = getLocalYYYYMMDD(new Date(payment.created_at));
      return paymentDate === today;
    });
    const prepaidInstallmentIds = new Set(
      filteredInstallments
        .filter(inst => inst.due_date === tomorrow)
        .map(inst => inst.id)
    );
    const prepaidAmount = prepaidPayments
      .filter(payment => prepaidInstallmentIds.has(payment.installment_id))
      .reduce((sum, payment) => sum + (Number(payment.paid_amount) || 0), 0);

    const tomorrowRate = tomorrowExpected > 0 ? (prepaidAmount / tomorrowExpected) * 100 : 0;

    return {
      today: { collected: todayCollected, expected: todayExpected, rate: todayRate },
      month: { collected: monthCollected, expected: monthExpected, rate: monthRate },
      tomorrow: { expected: tomorrowExpected, prepaid: prepaidAmount, rate: tomorrowRate },
    };
  }, [allInstallments, allPayments]);

const calculateCustomerMetrics = useCallback((filteredCustomers) => {
  const today = getTodayDate();
  const monthStart = getMonthStartDate();
  
  // Add this function for year start
  const getYearStartDate = () => {
    const now = new Date();
    return getLocalYYYYMMDD(new Date(now.getFullYear(), 0, 1));
  };
  
  const yearStart = getYearStartDate();

  // FIXED: Active customer = has at least one disbursed loan with outstanding balance
  const filteredLoans = applyFilters(allLoans, "loans");
  const disbursedLoans = filteredLoans.filter(loan => loan.status === "disbursed");
  const loanIds = disbursedLoans.map(loan => loan.id);
  
  const filteredPayments = allPayments.filter(payment => loanIds.includes(payment.loan_id));
  
  const activeCustomerIds = new Set();
  disbursedLoans.forEach(loan => {
    const totalPayable = Number(loan.total_payable) || 0;
    const totalPaid = filteredPayments
      .filter(p => p.loan_id === loan.id)
      .reduce((sum, p) => sum + (Number(p.paid_amount) || 0), 0);
    
    if (totalPayable > totalPaid) {
      activeCustomerIds.add(loan.customer_id);
    }
  });

  const activeCustomers = filteredCustomers.filter(c => activeCustomerIds.has(c.id)).length;
  const inactiveCustomers = filteredCustomers.length - activeCustomers;
  
  const newToday = filteredCustomers.filter(c => 
    c.created_at && getLocalYYYYMMDD(new Date(c.created_at)) === today
  ).length;
  
  const newMonth = filteredCustomers.filter(c => 
    c.created_at && getLocalYYYYMMDD(new Date(c.created_at)) >= monthStart
  ).length;
  
  // NEW: YTD calculation
  const newYTD = filteredCustomers.filter(c => 
    c.created_at && getLocalYYYYMMDD(new Date(c.created_at)) >= yearStart
  ).length;

  const filteredLeads = applyFilters(allLeads, "leads");
  const leadsToday = filteredLeads.filter(lead => 
    lead.created_at && getLocalYYYYMMDD(new Date(lead.created_at)) === today
  ).length;
  
  const leadsMonth = filteredLeads.filter(lead => 
    lead.created_at && getLocalYYYYMMDD(new Date(lead.created_at)) >= monthStart
  ).length;

  const convertedToday = newToday;
  const convertedMonth = newMonth;

  const conversionRateToday = leadsToday > 0 ? (convertedToday / leadsToday) * 100 : 0;
  const conversionRateMonth = leadsMonth > 0 ? (convertedMonth / leadsMonth) * 100 : 0;

  return {
    total: filteredCustomers.length,
    active: activeCustomers,
    inactive: inactiveCustomers,
    newToday,
    newMonth,
    newYTD, // Add this field
    leadsToday,
    leadsMonth,
    convertedToday,
    convertedMonth,
    conversionRateToday,
    conversionRateMonth,
  };
}, [allLeads, applyFilters, allLoans, allPayments]);

  const calculateRiskMetrics = useCallback((portfolioMetrics) => {
    const par = portfolioMetrics.outstandingBalance > 0 
      ? (portfolioMetrics.totalArrears / portfolioMetrics.outstandingBalance) * 100 
      : 0;

    return {
      par,
      totalArrears: portfolioMetrics.totalArrears,
      arrearsLoans: portfolioMetrics.arrearsLoans,
      mtdArrears: portfolioMetrics.mtdArrears,
      mtdArrearsLoans: portfolioMetrics.mtdArrearsLoans,
      outstandingBalance: portfolioMetrics.outstandingBalance,
    };
  }, []);

  const calculatePendingActions = useCallback((filteredLoans, filteredCustomers) => {
    return {
      disbursement: filteredLoans.filter(l => l.status === "approved" && !l.disbursed_at).length,
      loanBM: filteredLoans.filter(l => l.status === "bm_review").length,
      loanRM: filteredLoans.filter(l => l.status === "rm_review").length,
      customerBM: filteredCustomers.filter(c => c.status === "bm_review").length,
      customerCallbacks: filteredCustomers.filter(c => c.callback_date && new Date(c.callback_date) > new Date()).length,
      customerHQ: filteredCustomers.filter(c => c.status === "hq_review").length,
    };
  }, []);

  const recalculateDashboardMetrics = useCallback(() => {
    if (!userProfile || allLoans.length === 0 || allCustomers.length === 0) return;

    const filteredLoans = applyFilters(allLoans, "loans");
    const filteredCustomers = applyFilters(allCustomers, "customers");

    const portfolioMetrics = calculatePortfolioMetrics(filteredLoans);
    const disbursementMetrics = calculateDisbursementMetrics(filteredLoans);
    const collectionMetrics = calculateCollectionMetrics(filteredLoans);
    const customerMetrics = calculateCustomerMetrics(filteredCustomers);
    const riskMetrics = calculateRiskMetrics(portfolioMetrics);
    const pendingActions = calculatePendingActions(filteredLoans, filteredCustomers);

    setDashboardData({
      portfolio: portfolioMetrics,
      disbursements: disbursementMetrics,
      collections: collectionMetrics,
      customers: customerMetrics,
      risk: riskMetrics,
      pending: pendingActions,
    });
  }, [
    userProfile,
    allLoans,
    allCustomers,
    applyFilters,
    calculatePortfolioMetrics,
    calculateDisbursementMetrics,
    calculateCollectionMetrics,
    calculateCustomerMetrics,
    calculateRiskMetrics,
    calculatePendingActions
  ]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const profile = await fetchUserProfile();
      if (!profile) {
        setLoading(false);
        return;
      }

      await initializeFilters(profile);

      const [
        { data: loansData },
        { data: customersData },
        { data: leadsData },
        { data: paymentsData },
        { data: installmentsData }
      ] = await Promise.all([
        supabase.from("loans").select("*"),
        supabase.from("customers").select("*").neq("form_status", "draft"),
        supabase.from("leads").select("*"),
        supabase.from("loan_payments").select("*"),
        supabase.from("loan_installments").select("*")
      ]);

      setAllLoans(loansData || []);
      setAllCustomers(customersData || []);
      setAllLeads(leadsData || []);
      setAllPayments(paymentsData || []);
      setAllInstallments(installmentsData || []);

      const enrichedCustomers = (customersData || []).map(customer => ({
        ...customer,
        displayName: `${customer.Firstname || ''} ${customer.Surname || ''}`.trim(),
      }));
      setAllCustomersForSearch(enrichedCustomers);

      recalculateDashboardMetrics();
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegionChange = async (regionId) => {
    setSelectedRegion(regionId);
    setSelectedBranch("all");
    setSelectedRO("all");

    const branches = await fetchBranches(regionId);
    setAvailableBranches(branches);

    const ros = await fetchRelationshipOfficers("all", regionId);
    setAvailableROs([{ id: "all", full_name: "All ROs" }, ...ros]);
  };

  const handleBranchChange = async (branchId) => {
    setSelectedBranch(branchId);
    setSelectedRO("all");

    const ros = await fetchRelationshipOfficers(branchId, selectedRegion);
    setAvailableROs([{ id: "all", full_name: "All ROs" }, ...ros]);
  };

  const handleROChange = (roId) => {
    setSelectedRO(roId);
  };

  const handleQuickSearch = useCallback((term) => {
    if (!term.trim()) {
      setQuickSearchResults([]);
      return;
    }
    const searchTerm = term.toLowerCase().trim();
    const roleFilteredCustomers = applyFilters(allCustomersForSearch, "customers");
    const results = roleFilteredCustomers.filter((customer) => {
      const searchFields = [
        customer.Firstname,
        customer.Surname,
        customer.mobile,
        customer.id_number,
      ];
      return searchFields.some(field =>
        field?.toString().toLowerCase().includes(searchTerm)
      );
    });
    const formattedResults = results.slice(0, 15).map(customer => ({
      ...customer,
      displayName: `${customer.Firstname || ""} ${customer.Surname || ""}`.trim(),
    }));
    setQuickSearchResults(formattedResults);
  }, [allCustomersForSearch, applyFilters]);

  const handleOpen360View = (customer) => {
    navigate(`/customer/${customer.id}/360`);
    setQuickSearchTerm("");
    setQuickSearchResults([]);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (userProfile && allLoans.length > 0 && allCustomers.length > 0) {
      recalculateDashboardMetrics();
    }
  }, [userProfile, allLoans, allCustomers, selectedRegion, selectedBranch, selectedRO, recalculateDashboardMetrics]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (quickSearchTerm.trim()) {
        handleQuickSearch(quickSearchTerm);
      } else {
        setQuickSearchResults([]);
      }
    }, 150);
    return () => clearTimeout(delayDebounceFn);
  }, [quickSearchTerm, handleQuickSearch]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setQuickSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedRegion === "all") {
      setSelectedBranch("all");
      setSelectedRO("all");
    }
  }, [selectedRegion]);

  useEffect(() => {
    if (selectedBranch === "all") {
      setSelectedRO("all");
    }
  }, [selectedBranch]);

  // if (loading) {
  //   return (
  //     <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
  //       <div className="flex items-center justify-center h-screen">
  //         <div className="text-center">
  //           <Spinner text="Loading Dashboard..." />
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

  const cleanBookPercentage = dashboardData.portfolio.outstandingBalance > 0
    ? (dashboardData.portfolio.cleanBook / dashboardData.portfolio.outstandingBalance) * 100
    : 0;

const cleanBookMeta = (percentage) => {
  if (percentage <= 25) return { label: "Very Poor", color: COLORS.danger };
  if (percentage <= 50) return { label: "Poor", color: "#f97316" };
  if (percentage <= 75) return { label: "Average", color: COLORS.warning };
  if (percentage < 85) return { label: "Good", color: "#22c55e" };
  return { label: "Excellent", color: "#16a34a" };
};

const cleanBookMetaInfo = cleanBookMeta(cleanBookPercentage);

  return (
    <div 
      className="min-h-screen p-3 sm:p-4 md:p-6"
      style={{ backgroundColor: COLORS.background }}
    >
      {/* Filters Bar */}
      <div className="mb-5 px-3 py-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-center">
          {/* Region Filter - for credit_analyst_officer, customer_service_officer, regional_manager */}
          {["credit_analyst_officer", "customer_service_officer", "regional_manager"].includes(userProfile?.role) && (
            <FilterSelectCompact
              icon={Home}
              value={selectedRegion}
              onChange={handleRegionChange}
              options={[
                { value: "all", label: "All Regions" },
                ...availableRegions.map(region => ({
                  value: region.id,
                  label: region.name
                }))
              ]}
            />
          )}

          {/* Branch Filter - for all except relationship_officer */}
          {["credit_analyst_officer", "customer_service_officer", "regional_manager", "branch_manager"].includes(userProfile?.role) && (
            <FilterSelectCompact
              icon={Building}
              value={selectedBranch}
              onChange={handleBranchChange}
              options={[
                { value: "all", label: "All Branches" },
                ...availableBranches.map(branch => ({
                  value: branch.id,
                  label: branch.name
                }))
              ]}
            />
          )}

          {/* RO Filter - for all except relationship_officer */}
          {["credit_analyst_officer", "customer_service_officer", "regional_manager", "branch_manager"].includes(userProfile?.role) && (
            <FilterSelectCompact
              icon={UserCircle}
              value={selectedRO}
              onChange={handleROChange}
              options={availableROs.map(ro => ({
                value: ro.id,
                label: ro.full_name
              }))}
            />
          )}

          {/* Search */}
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-2" ref={searchContainerRef}>
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Search className="w-4 h-4" style={{ color: COLORS.primary }} strokeWidth={2.4} />
            </div>
            <input
              type="text"
              placeholder="Search customer, phone, ID…"
              value={quickSearchTerm}
              onChange={(e) => setQuickSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-md text-sm font-normal outline-none"
              style={{
                backgroundColor: COLORS.background,
                color: COLORS.authority,
                border: `1px solid ${COLORS.surface}`,
              }}
            />
            
            {quickSearchTerm && quickSearchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                {quickSearchResults.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => handleOpen360View(customer)}
                    className="p-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-slate-100 transition-colors"
                  >
                    <p className="text-slate-600 truncate">
                      {customer.displayName || "Unnamed Customer"}
                    </p>
                    <p className="text-xs text-slate-600 opacity-80 truncate">
                      {customer.mobile} • ID: {customer.id_number || "N/A"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Section 1: Portfolio Overview */}
        <div 
          className="rounded-2xl p-6 shadow-md"
          style={{ backgroundColor: COLORS.surface }}
        >
          <SectionHeader icon={Briefcase} title="Portfolio Overview" />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <PortfolioStatCard
              label="Outstanding Loan Balance"
              amount={formatCurrency(dashboardData.portfolio.outstandingBalance)}
              details={`${dashboardData.portfolio.totalLoans.toLocaleString()} loans`}
              color={COLORS.primary}
              bgColor={COLORS.background}
            />
  <PortfolioStatCard
      label="Clean Book"
      amount={formatCurrency(dashboardData.portfolio.cleanBook)}
      details={
        <span style={{ color: cleanBookMetaInfo.color }}>
          {`${cleanBookPercentage.toFixed(1)}% • ${cleanBookMetaInfo.label}`}
        </span>
      }
      color={COLORS.success}
      bgColor={COLORS.background}
    />

            {/* <PortfolioStatCard
              label="Non-Performing Loans"
              amount={`${dashboardData.portfolio.nplPercentage.toFixed(1)}%`}
              details={`${formatCurrency(dashboardData.portfolio.nplAmount)} • ${dashboardData.portfolio.nplLoans} loans`}
              color={COLORS.danger}
              bgColor={COLORS.background}
            /> */}
        <PortfolioStatCard
  label="Total Customers"
  amount={dashboardData.customers.total.toLocaleString()}
  details={`(YTD) ${dashboardData.customers.newYTD}`}
  color={COLORS.secondary}
  bgColor={COLORS.background}
/>
          </div>
        </div>

        {/* Section 2: Collection Performance */}
        <div 
          className="rounded-2xl p-6 shadow-md"
          style={{ backgroundColor: COLORS.surface }}
        >
          <SectionHeader icon={Receipt} title="Collection Performance" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <CollectionCard
              title="Today's Collection"
              percentage={dashboardData.collections.today.rate}
              label="Rate"
              collected={dashboardData.collections.today.collected}
              expected={dashboardData.collections.today.expected}
              shortfall={dashboardData.collections.today.expected - dashboardData.collections.today.collected}
            />
            <CollectionCard
              title="Monthly Collection"
              percentage={dashboardData.collections.month.rate}
              label="Rate"
              collected={dashboardData.collections.month.collected}
              expected={dashboardData.collections.month.expected}
              shortfall={dashboardData.collections.month.expected - dashboardData.collections.month.collected}
            />
            <CollectionCard
              title="Tomorrow's Collection"
              percentage={dashboardData.collections.tomorrow.rate}
              label="Prepaid"
              collected={dashboardData.collections.tomorrow.prepaid}
              expected={dashboardData.collections.tomorrow.expected}
              shortfall={dashboardData.collections.tomorrow.expected - dashboardData.collections.tomorrow.prepaid}
            />
          </div>
        </div>

        {/* Section 3: Loan Disbursement */}
      {/* Section 3: Loan Disbursement */}
<div 
  className="rounded-2xl p-6 shadow-md"
  style={{ backgroundColor: COLORS.surface }}
>
  <SectionHeader icon={CreditCard} title="Loan Disbursement" />
  
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    <StatCard
      icon={Database}
      label="Total Loans"
      value={dashboardData.disbursements.total.toLocaleString()}
      subtext={formatCurrency(dashboardData.disbursements.totalAmount)}
      color={COLORS.authority}
      bgColor={COLORS.background}
    />
    <StatCard
      icon={Calendar}
      label="Today"
      value={dashboardData.disbursements.today.toLocaleString()}
      subtext={formatCurrency(dashboardData.disbursements.todayAmount)}
      color={COLORS.success}
      bgColor={COLORS.background}
    />
    <StatCard
      icon={Calendar}
      label="This Month"
      value={dashboardData.disbursements.thisMonth.toLocaleString()}
      subtext={formatCurrency(dashboardData.disbursements.thisMonthAmount)}
      color={COLORS.primary}
      bgColor={COLORS.background}
    />
    <StatCard
      icon={TrendingUp}
      label="MTD Disbursement"
      value={formatCurrency(dashboardData.disbursements.thisMonthAmount)}
      subtext={`${dashboardData.disbursements.thisMonth} `}
      color={COLORS.secondary}
      bgColor={COLORS.background}
    />
    <StatCard
      icon={TrendingUp}
      label="Avg. Loan Size"
      value={dashboardData.disbursements.total > 0 
        ? formatCurrency(dashboardData.disbursements.totalAmount / dashboardData.disbursements.total)
        : "0.00"
      }
      color={COLORS.primary}
      bgColor={COLORS.background}
    />
    <StatCard
      icon={CalendarCheck} // Changed from CheckCircle
      label="YTD Disbursement"
      value={dashboardData.disbursements.ytd.toLocaleString()}
      subtext={formatCurrency(dashboardData.disbursements.ytdAmount)}
      color={COLORS.secondary}
      bgColor={COLORS.background}
    />
  </div>
</div>

        {/* Sections 4 & 5: Risk Metrics and Customer Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Section 4: Risk Metrics */}
          <div 
            className="rounded-2xl p-6 shadow-md"
            style={{ backgroundColor: COLORS.surface }}
          >
            <SectionHeader icon={Shield} title="Risk Metrics" />
            
            <div className="space-y-6">
              <div className="flex justify-center">
                <CircularProgress
                  percentage={dashboardData.risk.par}
                  size={140}
                  strokeWidth={14}
                  label="PAR"
                  isParMetric={true}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <RiskMetricCard
                  label="Total Arrears"
                  amount={formatCurrency(dashboardData.risk.totalArrears)}
                  details={`${dashboardData.risk.arrearsLoans} loans affected`}
                  color={COLORS.danger}
                />
                <RiskMetricCard
                  label="MTD Arrears"
                  amount={formatCurrency(dashboardData.risk.mtdArrears)}
                  details={`${dashboardData.risk.mtdArrearsLoans} loans this month`}
                  color={COLORS.warning}
                  bgColor="#fef3c7"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Customer Analytics */}
          <div 
            className="rounded-2xl p-6 shadow-md"
            style={{ backgroundColor: COLORS.surface }}
          >
            <SectionHeader icon={Users} title="Customer Analytics" />
            
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-3">
                <CustomerStatBox
                  value={dashboardData.customers.active.toLocaleString()}
                  label="Active"
                  color={COLORS.success}
                  bgColor={`${COLORS.success}15`}
                />
                <CustomerStatBox
                  value={dashboardData.customers.inactive.toLocaleString()}
                  label="Inactive"
                  color={COLORS.danger}
                  bgColor={`${COLORS.danger}15`}
                />
                <CustomerStatBox
                  value={dashboardData.customers.newToday.toLocaleString()}
                  label="New Today"
                  color={COLORS.primary}
                  bgColor={`${COLORS.primary}15`}
                />
                <CustomerStatBox
                  value={dashboardData.customers.newMonth.toLocaleString()}
                  label="New This Month"
                  color={COLORS.secondary}
                  bgColor={`${COLORS.secondary}15`}
                />
              </div>

          





                <div className="grid grid-cols-2 gap-6">
                <LeadConversionCard
                  title="Leads Today"
                  percentage={Math.round(dashboardData.customers.conversionRateToday)}
                  label="Conversion"
                  leadsText={`${dashboardData.customers.leadsToday} leads generated`}
                  titleColor={COLORS.authority}
                  bgColor={COLORS.background}
                  borderColor="#9ca3af"
                  leadsTextColor="#6B7280"
                />

                  <LeadConversionCard
                  title="Leads This Month"
                  percentage={Math.round(dashboardData.customers.conversionRateMonth)}
                  label="Conversion"
                  leadsText={`${dashboardData.customers.leadsMonth} leads generated`}
                  titleColor={COLORS.authority}
                  bgColor={COLORS.background}
                  borderColor="#9ca3af"
                  leadsTextColor="#6B7280"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 6: Pending Actions */}
        <div 
          className="rounded-2xl p-6 shadow-md"
          style={{ backgroundColor: COLORS.surface }}
        >
          <SectionHeader icon={Clock} title="Pending Actions" />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <PendingActionCard
              icon={FileCheck}
              value={dashboardData.pending.disbursement}
              label="Pending Disbursement"
              color={COLORS.primary}
              bgColor={COLORS.background}
            />
            <PendingActionCard
              icon={ThumbsUp}
              value={dashboardData.pending.loanBM}
              label="Pending Loan BM"
              color={COLORS.warning}
              bgColor={COLORS.background}
            />
            <PendingActionCard
              icon={ThumbsUp}
              value={dashboardData.pending.loanRM}
              label="Pending Loan RM"
              color={COLORS.secondary}
              bgColor={COLORS.background}
            />
            <PendingActionCard
              icon={PhoneCall}
              value={dashboardData.pending.customerCallbacks}
              label="Customer Callbacks"
              color={COLORS.success}
              bgColor={COLORS.background}
            />
            <PendingActionCard
              icon={Building}
              value={dashboardData.pending.customerHQ}
              label="HQ Review"
              color={COLORS.authority}
              bgColor={COLORS.background}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">System Status: Operational</span>
            </div>
            <div className="h-4 w-px bg-gray-300"></div>
            <button
              onClick={fetchAllData}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              <RefreshCw size={14} />
              Refresh Data
            </button>
          </div>
          <div className="text-sm text-gray-500">
            Data as of {lastUpdated.toLocaleDateString('en-KE', { 
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Africa/Nairobi'
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;