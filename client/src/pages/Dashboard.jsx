import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import {
  Briefcase, Receipt, CreditCard, Shield, Users, Clock,
  Home, Building, UserCircle, Search, TrendingUp, TrendingDown,
  AlertTriangle, Calendar, FileCheck, PhoneCall,
  ChevronRight, Database, CheckCircle, AlertOctagon,
  User, Target, BarChart3, CalendarDays, CalendarCheck,
  RefreshCw, ThumbsUp, UserCog, AlertCircle
} from 'lucide-react';
import { MagnifyingGlassIcon, XMarkIcon, IdentificationIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../hooks/userAuth";

// Color System
const COLORS = {
  background: '#E7F0FA', // Restored premium background
  secondary: '#7BA4D0',
  primary: '#586ab1',
  authority: '#1E3A8A',
  surface: '#FFFFFF',
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
// SVG Background Pattern (Topography)
const TopographyPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.05] pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
    <path d="M0,20 Q25,10 50,20 T100,20 V100 H0 Z" fill="currentColor" />
    <path d="M0,40 Q25,30 50,40 T100,40" fill="none" stroke="currentColor" strokeWidth="0.5" />
    <path d="M0,60 Q25,50 50,60 T100,60" fill="none" stroke="currentColor" strokeWidth="0.5" />
    <path d="M0,80 Q25,70 50,80 T100,80" fill="none" stroke="currentColor" strokeWidth="0.5" />
  </svg>
);

const GraphPattern = () => (
  <svg className="absolute bottom-0 right-0 w-32 h-24 opacity-[0.03] pointer-events-none transform -rotate-12 translate-x-4 translate-y-4" viewBox="0 0 100 100" preserveAspectRatio="none">
    <path d="M0,80 L20,70 L40,75 L60,50 L80,60 L100,30" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="20" cy="70" r="2" fill="currentColor" />
    <circle cx="40" cy="75" r="2" fill="currentColor" />
    <circle cx="60" cy="50" r="2" fill="currentColor" />
    <circle cx="80" cy="60" r="2" fill="currentColor" />
    <circle cx="100" cy="30" r="2" fill="currentColor" />
  </svg>
);

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
  <div className="flex items-center gap-0 mb-6 w-full group">
    <div className="flex items-center bg-[#2E5E99] text-white px-4 py-1.5 rounded-l-md shadow-sm whitespace-nowrap min-w-[120px] justify-center font-bold text-[11px] uppercase tracking-wider">
      {title}
    </div>
    <div className="flex-grow h-[1px] bg-[#2E5E99] opacity-20 ml-0 shadow-sm" />
  </div>
);

const SkeletonCard = () => (
  <div className="animate-pulse p-6 bg-white rounded-2xl border border-slate-200 min-h-[160px]">
    <div className="flex items-center gap-3 mb-5">
      <div className="w-10 h-10 rounded-xl bg-slate-100" />
      <div className="h-4 bg-slate-100 rounded w-24" />
    </div>
    <div className="h-8 bg-slate-100 rounded w-40 mb-3" />
    <div className="h-3 bg-slate-100 rounded w-20" />
  </div>
);

const CircularProgress = ({
  percentage,
  size = 140,
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
      if (percentage <= 5) return COLORS.success;
      if (percentage <= 15) return COLORS.warning;
      return COLORS.danger;
    } else {
      if (percentage <= 40) return COLORS.danger;
      if (percentage <= 70) return COLORS.warning;
      return COLORS.success;
    }
  };

  return (
    <div className="flex items-center gap-8 w-full">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#F1F5F9"
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
            style={{ transition: "stroke-dashoffset 800ms ease" }}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-xs font-black text-slate-400 uppercase tracking-tighter mb-1">{label}</div>
            <div className="text-2xl font-black tracking-tighter" style={{ color: getColor() }}>
              {percentage.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {collected !== undefined && (
        <div className="flex-grow space-y-4 py-2 border-l border-slate-200/50 pl-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">Collected</span>
            <span className="text-lg font-black leading-none" style={{ color: "#10B981" }}>{formatCurrency(collected)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">Expected</span>
            <span className="text-lg font-black leading-none" style={{ color: "#1E3A8A" }}>{formatCurrency(expected)}</span>
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

const FilterSelectCompact = ({ label, icon: Icon, value, onChange, options }) => (
  <div className="flex items-center bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden flex-1 min-w-[120px]">
    <div className="bg-[#2E5E99] text-white px-2 py-1.5 flex items-center gap-1.5 min-w-[70px] justify-center font-bold text-[11px] uppercase tracking-tight">
      <Icon className="w-3 h-3" />
      {label}
    </div>
    <div className="relative flex-grow">
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-2 pr-6 py-1.5 appearance-none cursor-pointer outline-none bg-transparent text-[11px] font-bold text-slate-700"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
        <ChevronRight className="w-3 h-3 rotate-90" />
      </div>
    </div>
  </div>
);

const StatCard = ({
  icon: Icon,
  label,
  value,
  subtext,
  color = COLORS.primary,
  bgColor = COLORS.surface,
}) => (
  <div
    className="p-5 rounded-xl shadow-sm relative overflow-hidden group bg-white border border-slate-200"
  >
    <GraphPattern />
    <div className="relative z-10 space-y-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 transition-transform group-hover:scale-110" style={{ color }}>
            <Icon size={20} />
          </div>
        )}
        <div className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">{label}</div>
      </div>

      <div className="h-px bg-slate-100 w-full" />

      <div className="flex flex-col">
        {subtext && (
          <div className="text-2xl font-black tracking-tight" style={{ color: COLORS.authority }}>{subtext}</div>
        )}
        <div className="text-sm font-bold opacity-60 mt-1" style={{ color }}>
          {value}
        </div>
      </div>
    </div>
  </div>
);

const PortfolioStatCard = ({
  label,
  amount,
  details,
  color = "#2E5E99",
  bgClassName = "bg-white",
  pattern: Pattern,
}) => (
  <div
    className={`p-8 rounded-[2.5rem] ${bgClassName} border border-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.03)] relative overflow-hidden group min-h-[220px] flex flex-col justify-center transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:-translate-y-1`}
  >
    {Pattern && (
      <div className="absolute inset-0 opacity-[0.05] group-hover:opacity-[0.08] transition-opacity">
        <Pattern />
      </div>
    )}
    <div className="relative z-10">
      <div
        className="text-[10px] font-black uppercase tracking-[0.25em] mb-4 opacity-70"
        style={{ color }}
      >
        {label}
      </div>
      <div
        className="text-4xl sm:text-5xl font-black mb-6 tracking-tighter leading-none"
        style={{ color }}
      >
        {amount}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-[2px] w-8 rounded-full" style={{ backgroundColor: color, opacity: 0.2 }} />
        <div className="text-sm font-bold tracking-tight" style={{ color, opacity: 0.8 }}>
          {details}
        </div>
      </div>
    </div>
    <div
      className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full -mr-16 -mt-16 opacity-10 group-hover:opacity-20 transition-opacity"
      style={{ backgroundColor: color }}
    />
  </div>
);


const CollectionCard = ({
  title,
  percentage,
  collected,
  expected,
  label,
  bgClassName = "bg-white",
  pattern: Pattern,
}) => (
  <div
    className={`p-6 rounded-3xl ${bgClassName} shadow-sm border border-slate-200 group transition-all hover:shadow-md h-full flex flex-col relative overflow-hidden`}
  >
    {Pattern && (
      <div className="absolute inset-0 opacity-[0.05] group-hover:opacity-[0.08] transition-opacity">
        <Pattern />
      </div>
    )}
    <div className="relative z-10 flex flex-col h-full">
      <div className="flex items-center justify-center bg-white/60 backdrop-blur-sm text-[#1E3A8A] px-4 py-1.5 rounded-lg mb-8 w-fit mx-auto font-black text-[10px] uppercase tracking-widest border border-slate-200/50">
        {title}
      </div>

      <div className="flex-grow flex items-center">
        <CircularProgress
          percentage={percentage}
          label={label}
          collected={collected}
          expected={expected}
        />
      </div>
    </div>
  </div>
);

const RiskMetricCard = ({
  label,
  amount,
  details,
  color = COLORS.danger,
  bgClassName = "bg-white",
}) => (
  <div
    className={`p-5 rounded-2xl ${bgClassName} transition-all duration-200 hover:shadow-md relative overflow-hidden border border-slate-200 group`}
  >
    <div className="absolute inset-0 opacity-[0.05]">
      <GraphPattern />
    </div>
    <div className="relative z-10">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 group-hover:text-slate-700">{label}</div>
      <div className="text-2xl font-black font-mono tracking-tight mb-2" style={{ color }}>
        {amount}
      </div>
      {details && (
        <div className="text-[11px] font-bold text-slate-500 bg-black/5 px-2 py-0.5 rounded-full inline-block">
          {details}
        </div>
      )}
    </div>
  </div>
);


const LeadConversionCard = ({
  title,
  percentage,
  label,
  leadsText,
}) => (
  <div
    className="p-6 rounded-3xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col items-center group transition-all hover:shadow-[0_15px_40px_rgba(0,0,0,0.04)]"
  >
    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 group-hover:text-slate-600 transition-colors">
      {title}
    </h4>
    <div className="mb-4">
      <SemiCircleProgress
        percentage={percentage}
        label={label}
      />
    </div>
    <div className="mt-2 text-[11px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full uppercase tracking-tight">
      {leadsText}
    </div>
  </div>
);

const CustomerStatBox = ({
  value,
  label,
  color = COLORS.success,
  bgClassName = "bg-white/80",
}) => (
  <div
    className={`p-5 rounded-2xl ${bgClassName} backdrop-blur-sm border border-slate-200 relative overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 group`}
  >
    <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
      <TopographyPattern />
    </div>
    <div className="pl-2 relative z-10">
      <div className="text-2xl font-black font-mono tracking-tight leading-none mb-2" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 group-hover:text-slate-700">{label}</div>
    </div>
  </div>
);

const PendingActionCard = ({
  icon: Icon,
  value,
  label,
  color = COLORS.primary,
  bgClassName = "bg-white",
  onClick,
}) => (
  <div
    onClick={onClick}
    className={`group p-6 rounded-3xl cursor-pointer ${bgClassName} border border-slate-200 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 flex items-center justify-between gap-4`}
  >
    <div className="relative z-10 flex-grow">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm"
          style={{ backgroundColor: `${color}20`, color }}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="text-5xl font-black font-mono tracking-tighter" style={{ color }}>
          {value}
        </div>
      </div>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-700 transition-colors">
        {label}
      </div>
    </div>
    <div className="relative z-10 flex-shrink-0">
      <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center shadow-inner group-hover:bg-white group-hover:translate-x-1 transition-all">
        <ChevronRight className="w-5 h-5 opacity-40 group-hover:opacity-100" style={{ color }} />
      </div>
    </div>
    <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full opacity-[0.03] blur-2xl group-hover:opacity-[0.08] transition-opacity" style={{ backgroundColor: color }} />
  </div>
);




// ========== MAIN DASHBOARD COMPONENT ==========
const Dashboard = () => {
  const { profile: userProfile, initializing: authInitializing } = useAuth();
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
  const fetchRegions = async (tenantId) => {
    try {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("regions")
        .select("id, name, code")
        .eq("tenant_id", tenantId)
        .order("name");

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching regions:", error);
      return [];
    }
  };

  const fetchBranches = async (tenantId, regionFilter = "all") => {
    try {
      if (!tenantId) return [];
      let query = supabase
        .from("branches")
        .select("id, name, code, address, region_id")
        .eq("tenant_id", tenantId)
        .order("name");

      if (regionFilter !== "all" && regionFilter) {
        query = query.eq("region_id", regionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching branches:", error);
      return [];
    }
  };

  const fetchRelationshipOfficers = async (
    tenantId,
    branchFilter = "all",
    regionFilter = "all",
    userRole = null,
    userBranchId = null,
    userRegionId = null
  ) => {
    try {
      if (!tenantId) return [];

      let query = supabase
        .from("profiles")
        .select(`
          id,
          region_id,
          branch_id,
          users!inner(id, full_name, role)
        `)
        .eq("tenant_id", tenantId)
        .eq("users.role", "relationship_officer")
        .order("users(full_name)");

      // Role and Filter Logic
      if (userRole === "branch_manager" && userBranchId) {
        query = query.eq("branch_id", userBranchId);
      } else if (userRole === "regional_manager" && userRegionId) {
        if (branchFilter !== "all" && branchFilter) {
          query = query.eq("branch_id", branchFilter);
        } else {
          query = query.eq("region_id", userRegionId);
        }
      } else {
        // Administrative or higher level filtering
        if (regionFilter !== "all" && regionFilter) {
          query = query.eq("region_id", regionFilter);
        }

        if (branchFilter !== "all" && branchFilter) {
          query = query.eq("branch_id", branchFilter);
        } else if (branchFilter === null) {
          // Explicitly handle null for UUID columns to avoid 400 error
          query = query.is("branch_id", null);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      return (
        data?.map((item) => ({
          id: item.users.id,
          full_name: item.users.full_name,
          branch_id: item.branch_id,
          region_id: item.region_id,
        })) || []
      );
    } catch (error) {
      console.error("Error fetching relationship officers:", error);
      return [];
    }
  };

  // ========== UPDATED INITIALIZATION ==========
  const initializeFilters = async (profile) => {
    if (!profile || !profile.tenant_id) return;

    setSelectedRegion("all");
    setSelectedBranch("all");
    setSelectedRO("all");
    setAvailableRegions([]);
    setAvailableBranches([]);
    setAvailableROs([]);

    const tId = profile.tenant_id;

    if (profile.role === "regional_manager") {
      // RM sees ONLY their region in the region filter list
      setAvailableRegions([{ id: profile.region_id, name: profile.region || "My Region" }]);

      const regionBranches = await fetchBranches(tId, profile.region_id);
      setAvailableBranches(regionBranches);

      const regionROs = await fetchRelationshipOfficers(tId, "all", profile.region_id, profile.role, null, profile.region_id);
      setAvailableROs([{ id: "all", full_name: "All ROs" }, ...regionROs]);

    } else if (profile.role === "branch_manager" || profile.role === "customer_service_officer") {
      // BM/CSO see ONLY their region and branch
      setSelectedRegion(profile.region_id);
      setSelectedBranch(profile.branch_id);

      setAvailableRegions([{ id: profile.region_id, name: profile.region || "My Region" }]);
      setAvailableBranches([{ id: profile.branch_id, name: profile.branch || "My Branch" }]);

      const branchROs = await fetchRelationshipOfficers(tId, profile.branch_id, "all", profile.role, profile.branch_id);
      setAvailableROs([{ id: "all", full_name: "All ROs" }, ...branchROs]);

    } else if (profile.role === "relationship_officer") {
      setSelectedRegion(profile.region_id);
      setSelectedBranch(profile.branch_id);
      const branches = await fetchBranches(tId, profile.region_id);
      setAvailableBranches(branches);
      const selfRO = await fetchRelationshipOfficers(tId, profile.branch_id, profile.region_id);
      const filteredSelf = selfRO.filter(ro => String(ro.id) === String(profile.id));
      setAvailableROs(filteredSelf.length > 0 ? filteredSelf : [{ id: profile.id, full_name: profile.full_name || "N/A" }]);
      setSelectedRO(profile.id);

    } else {
      // Admin, Superadmin, Credit Analyst, etc. - Full Access
      const regions = await fetchRegions(tId);
      setAvailableRegions(regions);
      const branches = await fetchBranches(tId, "all");
      setAvailableBranches(branches);
      const ros = await fetchRelationshipOfficers(tId, "all", "all");
      setAvailableROs([{ id: "all", full_name: "All ROs" }, ...ros]);
    }
  };

  const applyFilters = useCallback((data, tableName = "loans") => {
    if (!userProfile || !Array.isArray(data)) return [];
    const { role, region_id: userRegionId, branch_id: userBranchId, id: userId } = userProfile;

    const result = [...data];
    const initialCount = result.length;
    let filtered = result;

    if (role === "relationship_officer") {
      if (tableName === "loans") {
        filtered = filtered.filter(item => String(item.booked_by) === String(userId));
      } else if (tableName === "customers") {
        const myLoanCustomerIds = new Set(allLoans.filter(l => String(l.booked_by) === String(userId)).map(l => l.customer_id));
        filtered = filtered.filter(item => String(item.created_by) === String(userId) || myLoanCustomerIds.has(item.id));
      } else {
        filtered = filtered.filter(item => String(item.created_by) === String(userId));
      }
    } else if (role === "branch_manager" || role === "customer_service_officer") {
      // Strict: Branch managers ONLY see their branch data
      if (userBranchId) {
        filtered = filtered.filter(item => item.branch_id === userBranchId);
      } else {
        console.warn(`[applyFilters] ${role} has no assigned branch ID. Filter blocked.`);
        return []; // Block access if they should have a branch but don't
      }
    } else if (role === "regional_manager") {
      // Strict: Regional managers ONLY see their region data
      if (userRegionId) {
        filtered = filtered.filter(item => item.region_id === userRegionId);
      } else {
        console.warn(`[applyFilters] Regional Manager has no assigned region ID. Filter blocked.`);
        return []; // Block access if they should have a region but don't
      }
    }

    if (selectedRegion !== "all") {
      filtered = filtered.filter(item => item.region_id === selectedRegion);
    }
    if (selectedBranch !== "all") {
      filtered = filtered.filter(item => item.branch_id === selectedBranch);
    }
    if (selectedRO !== "all" && tableName !== "leads") {
      const field = tableName === "loans" ? "booked_by" : "created_by";
      filtered = filtered.filter(item => String(item[field]) === String(selectedRO));
    }

    if (initialCount > 0 && filtered.length === 0) {
      console.warn(`[applyFilters] Filter cleared all data for ${tableName}.`, {
        role,
        userBranchId,
        userRegionId,
        selectedRegion,
        selectedBranch,
        selectedRO,
        initialCount,
        sampleKeys: result[0] ? Object.keys(result[0]) : [],
        sampleFirstBranch: result[0]?.branch_id,
        sampleFirstRegion: result[0]?.region_id
      });
    }

    return filtered;
  }, [userProfile, selectedRegion, selectedBranch, selectedRO, allLoans]);


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
  const calculatePendingActions = useCallback(
    (filteredLoans = [], filteredCustomers = []) => {
      const now = new Date();

      return {
        /* =========================
           LOAN PENDING ACTIONS
        ========================== */

        // Loans awaiting BM decision
        loanBM: filteredLoans.filter(
          l => l.status === "bm_review"
        ).length,

        // Loans awaiting RM decision (DB uses rn_review)
        loanRM: filteredLoans.filter(
          l => l.status === "rn_review"
        ).length,

        // Loans approved & waiting for disbursement
        disbursement: filteredLoans.filter(
          l =>
            l.status === "ready_for_disbursement" &&
            !l.disbursed_at
        ).length,

        /* =========================
           CUSTOMER PENDING ACTIONS
        ========================== */

        // Customers awaiting BM approval
        customerBM: filteredCustomers.filter(
          c => c.status === "bm_review"
        ).length,

        // Customers with scheduled future callbacks
        customerCallbacks: filteredCustomers.filter(
          c =>
            c.callback_date &&
            new Date(c.callback_date) > now
        ).length,

        // Customers awaiting HQ review
        customerHQ: filteredCustomers.filter(
          c => c.status === "hq_review"
        ).length,
      };
    },
    []
  );


  const recalculateDashboardMetrics = useCallback(() => {
    if (!userProfile) return;

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
    if (!userProfile) return;
    try {
      setLoading(true);
      const profile = userProfile;

      await initializeFilters(profile);

      const [
        { data: loansData },
        { data: customersData },
        { data: leadsData },
        { data: paymentsData },
        { data: installmentsData },
        { data: branchesData }
      ] = await Promise.all([
        supabase.from("loans").select("*").eq("tenant_id", profile.tenant_id),
        supabase.from("customers").select("*").neq("form_status", "draft").eq("tenant_id", profile.tenant_id),
        supabase.from("leads").select("*").eq("tenant_id", profile.tenant_id),
        supabase.from("loan_payments").select("*").eq("tenant_id", profile.tenant_id),
        supabase.from("loan_installments").select("*").eq("tenant_id", profile.tenant_id),
        supabase.from("branches").select("id, region_id").eq("tenant_id", profile.tenant_id)
      ]);

      const branchRegionMap = {};
      branchesData?.forEach(b => {
        branchRegionMap[b.id] = b.region_id;
      });

      // Enrich data with region_id from branch
      const enrichedLoans = (loansData || []).map(loan => ({
        ...loan,
        region_id: loan.region_id || branchRegionMap[loan.branch_id]
      }));

      const enrichedCustomers = (customersData || []).map(customer => ({
        ...customer,
        region_id: customer.region_id || branchRegionMap[customer.branch_id],
        displayName: `${customer.Firstname || ''} ${customer.Surname || ''}`.trim(),
      }));

      const enrichedLeads = (leadsData || []).map(lead => ({
        ...lead,
        region_id: lead.region_id || branchRegionMap[lead.branch_id]
      }));

      setAllLoans(enrichedLoans);
      setAllCustomers(enrichedCustomers);
      setAllLeads(enrichedLeads);
      setAllPayments(paymentsData || []);
      setAllInstallments(installmentsData || []);
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
    const profile = userProfile;
    if (!profile || !profile.tenant_id) return;

    const tId = profile.tenant_id;
    setSelectedRegion(regionId);
    setSelectedBranch("all");
    setSelectedRO("all");

    // Cascading: Fetch branches for the selected region
    const branches = await fetchBranches(tId, regionId);
    setAvailableBranches(branches);

    // Cascading: Fetch ROs for the selected region
    const ros = await fetchRelationshipOfficers(tId, "all", regionId, profile.role, null, profile.region_id);
    setAvailableROs([{ id: "all", full_name: "All ROs" }, ...ros]);
  };

  const handleBranchChange = async (branchId) => {
    const profile = userProfile;
    if (!profile || !profile.tenant_id) return;

    const tId = profile.tenant_id;
    setSelectedBranch(branchId);
    setSelectedRO("all");

    // Cascading: Fetch ROs for the selected branch
    // Use selectedRegion as parent context
    const ros = await fetchRelationshipOfficers(tId, branchId, selectedRegion, profile.role, profile.branch_id, profile.region_id);
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
    if (!authInitializing && userProfile) {
      fetchAllData();
    }
  }, [authInitializing, userProfile]);

  useEffect(() => {
    if (userProfile) {
      console.log(`[Dashboard] Logged in as: ${userProfile.full_name || userProfile.fullName} | Role: ${userProfile.role} | Tenant: ${userProfile.tenant_id}`);
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


  const PENDING_COLORS = {
    disbursement: COLORS.primary,     // money action → primary
    loanBM: COLORS.warning,           // internal approval → warning
    loanRM: COLORS.secondary,         // higher-level approval → secondary
    customerCallbacks: COLORS.success,// customer engagement → success
    customerBM: COLORS.warning,       // customer approval → warning
    customerHQ: COLORS.authority,     // HQ / authority → authority
  };


  if (authInitializing) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: COLORS.background }}>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-pulse space-y-4">
            <div className="w-16 h-16 bg-slate-200 rounded-full mx-auto" />
            <div className="h-4 bg-slate-200 rounded w-32 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

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
      <div className="mb-8 px-4 py-4 bg-white/50 rounded-2xl border border-white/60 shadow-sm relative z-50 overflow-visible">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Region Filter */}
          {["superadmin", "admin", "credit_analyst_officer", "regional_manager"].includes(userProfile?.role) && (
            <FilterSelectCompact
              label="Region"
              icon={Home}
              value={selectedRegion}
              onChange={userProfile.role === "regional_manager" ? () => { } : handleRegionChange}
              options={
                userProfile.role === "regional_manager"
                  ? [{ value: userProfile.region_id, label: userProfile.region || "My Region" }]
                  : [
                    { value: "all", label: "All Regions" },
                    ...availableRegions.map(region => ({
                      value: region.id,
                      label: region.name
                    }))
                  ]
              }
            />
          )}

          {/* Branch Filter */}
          {["superadmin", "admin", "credit_analyst_officer", "regional_manager", "branch_manager", "customer_service_officer"].includes(userProfile?.role) && (
            <FilterSelectCompact
              label="Branches"
              icon={Building}
              value={selectedBranch}
              onChange={["branch_manager", "customer_service_officer"].includes(userProfile.role) ? () => { } : handleBranchChange}
              options={
                ["branch_manager", "customer_service_officer"].includes(userProfile.role)
                  ? [{ value: userProfile.branch_id, label: userProfile.branch || "My Branch" }]
                  : [
                    { value: "all", label: "All Branches" },
                    ...availableBranches.map(branch => ({
                      value: branch.id,
                      label: branch.name
                    }))
                  ]
              }
            />
          )}

          {/* RO Filter */}
          {["superadmin", "admin", "credit_analyst_officer", "customer_service_officer", "regional_manager", "branch_manager"].includes(userProfile?.role) && (
            <FilterSelectCompact
              label="RO"
              icon={UserCircle}
              value={selectedRO}
              onChange={handleROChange}
              options={availableROs.map(ro => ({
                value: ro.id,
                label: ro.full_name
              }))}
            />
          )}

          <button
            onClick={() => {
              setSelectedRegion("all");
              setSelectedBranch("all");
              setSelectedRO("all");
            }}
            className="px-3 py-1.5 bg-[#EF4444] hover:bg-[#DC2626] text-white font-black text-[9px] uppercase tracking-widest rounded-md shadow-md transition-all active:scale-95 whitespace-nowrap"
          >
            Clear
          </button>

          {/* Search Integrated into the same row */}
          <div className="flex-grow min-w-[250px]">
            <div className="relative group" ref={searchContainerRef}>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                <Search className="w-4 h-4 text-[#2E5E99]" strokeWidth={2.5} />
              </div>
              <input
                type="text"
                placeholder="Search name, phone, ID…"
                value={quickSearchTerm}
                onChange={(e) => setQuickSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2 rounded-lg text-[11px] font-bold outline-none border border-slate-200 group-hover:border-[#2E5E99]/50 focus:border-[#2E5E99] transition-all bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                style={{
                  color: COLORS.authority,
                }}
              />
              {quickSearchTerm && (
                <button
                  onClick={() => {
                    setQuickSearchTerm("");
                    setQuickSearchResults([]);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors z-10"
                >
                  <XMarkIcon className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                </button>
              )}

              {quickSearchTerm && quickSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-[9999] mt-2 bg-white border border-slate-200 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden">
                  <div className="max-h-72 overflow-y-auto">
                    {quickSearchResults.map((customer) => (
                      <div
                        key={customer.id}
                        onClick={() => handleOpen360View(customer)}
                        className="p-3 cursor-pointer border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors group/item flex items-center justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black text-slate-700 truncate group-hover/item:text-[#2E5E99]">
                            {customer.displayName || "Unnamed Customer"}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                            {customer.mobile} • <span className="text-slate-500">ID: {customer.id_number || "N/A"}</span>
                          </p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover/item:text-[#2E5E99] group-hover/item:translate-x-0.5 transition-all" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Section 1: Portfolio */}
        <section className="relative">
          <SectionHeader icon={Briefcase} title="Portfolio" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            {loading ? (
              <>
                <SkeletonCard /> <SkeletonCard /> <SkeletonCard />
              </>
            ) : (
              <>
                <PortfolioStatCard
                  label="Outstanding Loan Balance"
                  amount={formatCurrency(dashboardData.portfolio.outstandingBalance)}
                  details={`${dashboardData.portfolio.totalLoans.toLocaleString()} Active Loans`}
                  color="#1E3A8A"
                  bgClassName="bg-blue-50/50"
                  pattern={GraphPattern}
                />
                <PortfolioStatCard
                  label="Clean Book"
                  amount={formatCurrency(dashboardData.portfolio.cleanBook)}
                  details={`${cleanBookPercentage.toFixed(1)}% • ${cleanBookMetaInfo.label}`}
                  color="#10B981"
                  bgClassName="bg-emerald-50/50"
                  pattern={TopographyPattern}
                />
                <PortfolioStatCard
                  label="Total Customers"
                  amount={dashboardData.customers.total.toLocaleString()}
                  details={`${dashboardData.customers.newYTD.toLocaleString()} YTD New`}
                  color="#7C3AED"
                  bgClassName="bg-violet-50/50"
                  pattern={TopographyPattern}
                />
              </>
            )}
          </div>
        </section>

        {/* Section 2: Collection Performance */}
        {/* Section 2: Collection Overview */}
        <section className="relative">
          <SectionHeader icon={Receipt} title="Collections Overview" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            {loading ? (
              <>
                <SkeletonCard /> <SkeletonCard /> <SkeletonCard />
              </>
            ) : (
              <>
                <CollectionCard
                  title="Today's Collection"
                  percentage={dashboardData.collections.today.rate}
                  label="Rate"
                  collected={dashboardData.collections.today.collected}
                  expected={dashboardData.collections.today.expected}
                  bgClassName="bg-emerald-50/50"
                  pattern={TopographyPattern}
                />
                <CollectionCard
                  title="Monthly Collection"
                  percentage={dashboardData.collections.month.rate}
                  label="Rate"
                  collected={dashboardData.collections.month.collected}
                  expected={dashboardData.collections.month.expected}
                  bgClassName="bg-blue-50/50"
                  pattern={GraphPattern}
                />
                <CollectionCard
                  title="Tomorrow's Collection"
                  percentage={dashboardData.collections.tomorrow.rate}
                  label="Prepaid"
                  collected={dashboardData.collections.tomorrow.prepaid}
                  expected={dashboardData.collections.tomorrow.expected}
                  bgClassName="bg-violet-50/50"
                  pattern={TopographyPattern}
                />
              </>
            )}
          </div>
        </section>

        {/* Section 3: Loan Disbursement */}
        <section className="relative">
          <SectionHeader icon={CreditCard} title="Loan Disbursement" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
            {loading ? (
              <>
                {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
              </>
            ) : (
              <>
                <StatCard
                  icon={Database}
                  label="Total Loans"
                  value={dashboardData.disbursements.total.toLocaleString()}
                  subtext={formatCurrency(dashboardData.disbursements.totalAmount)}
                  color={COLORS.authority}
                />
                <StatCard
                  icon={Calendar}
                  label="Today"
                  value={dashboardData.disbursements.today.toLocaleString()}
                  subtext={formatCurrency(dashboardData.disbursements.todayAmount)}
                  color={COLORS.success}
                />
                <StatCard
                  icon={CalendarCheck}
                  label="This Month"
                  value={dashboardData.disbursements.thisMonth.toLocaleString()}
                  subtext={formatCurrency(dashboardData.disbursements.thisMonthAmount)}
                  color={COLORS.primary}
                />
                <StatCard
                  icon={TrendingUp}
                  label="MTD Disbursement"
                  value={formatCurrency(dashboardData.disbursements.thisMonthAmount)}
                  subtext={`${dashboardData.disbursements.thisMonth}`}
                  color={COLORS.secondary}
                />
                <StatCard
                  icon={Target}
                  label="Avg. Loan Size"
                  value={dashboardData.disbursements.total > 0
                    ? formatCurrency(dashboardData.disbursements.totalAmount / dashboardData.disbursements.total)
                    : "0.00"
                  }
                  color={COLORS.primary}
                />
                <StatCard
                  icon={Briefcase}
                  label="YTD Disbursement"
                  value={dashboardData.disbursements.ytd.toLocaleString()}
                  subtext={formatCurrency(dashboardData.disbursements.ytdAmount)}
                  color={COLORS.secondary}
                />
              </>
            )}
          </div>
        </section>

        <section className="relative">
          <SectionHeader icon={Shield} title="Risk Performance" />

          <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 relative z-10 overflow-hidden group">
            <div className="absolute inset-0 opacity-[0.08] group-hover:opacity-[0.12] transition-opacity">
              <GraphPattern />
            </div>
            <div className="flex flex-col lg:flex-row items-center gap-12 relative z-20">
              <div className="flex items-center gap-6 bg-white/40 backdrop-blur-sm p-6 rounded-2xl border border-white/50 shadow-sm">
                <CircularProgress
                  percentage={dashboardData.risk.par}
                  label="PAR Ratio"
                  isParMetric={true}
                  size={180}
                />
                <div className="hidden sm:flex flex-col border-l border-slate-200 pl-6 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">PAR Formula</div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500">Arrears</span>
                    <span className="text-sm font-black text-[#EF4444]">{formatCurrency(dashboardData.risk.totalArrears)}</span>
                  </div>
                  <div className="h-px bg-slate-200 w-12" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500">OLB</span>
                    <span className="text-sm font-black text-[#1E3A8A]">{formatCurrency(dashboardData.risk.outstandingBalance)}</span>
                  </div>
                </div>
              </div>

              <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                <RiskMetricCard
                  label="Total Arrears Amount"
                  amount={formatCurrency(dashboardData.risk.totalArrears)}
                  details={`${dashboardData.risk.arrearsLoans} Loans in Arrears`}
                  color="#B91C1C"
                  bgClassName="bg-red-50/80"
                />
                <RiskMetricCard
                  label="Monthly Arrears Amount"
                  amount={formatCurrency(dashboardData.risk.mtdArrears)}
                  details={`${dashboardData.risk.mtdArrearsLoans} Loans this month`}
                  color="#B45309"
                  bgClassName="bg-amber-50/80"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="relative">
          <SectionHeader icon={Users} title="Customer Analytics" />

          <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-200 relative z-10 overflow-hidden">
            <TopographyPattern />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-20">
              {/* Row 1: Active/Inactive (Left) & Leads Today (Right) */}
              <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="grid grid-cols-1 gap-4 w-full md:w-1/2">
                  <CustomerStatBox
                    value={dashboardData.customers.active.toLocaleString()}
                    label="Active Customers"
                    color="#047857"
                    bgClassName="bg-emerald-50/80"
                  />
                  <CustomerStatBox
                    value={dashboardData.customers.inactive.toLocaleString()}
                    label="Inactive Customers"
                    color="#B91C1C"
                    bgClassName="bg-rose-50/80"
                  />
                </div>
                <div className="w-full md:w-1/2">
                  <LeadConversionCard
                    title="Leads Conversion Today"
                    percentage={Math.round(dashboardData.customers.conversionRateToday)}
                    label="Conversion"
                    leadsText={`${dashboardData.customers.leadsToday} Leads generated today`}
                  />
                </div>
              </div>

              {/* Row 2: Leads Month (Left) & New Today/Month (Right) */}
              <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="w-full md:w-1/2">
                  <LeadConversionCard
                    title="Lead Conversion This Month"
                    percentage={Math.round(dashboardData.customers.conversionRateMonth)}
                    label="Conversion"
                    leadsText={`${dashboardData.customers.leadsMonth} Leads generated this month`}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 w-full md:w-1/2">
                  <CustomerStatBox
                    value={dashboardData.customers.newToday.toLocaleString()}
                    label="New Customers Today"
                    color="#1D4ED8"
                    bgClassName="bg-blue-50/80"
                  />
                  <CustomerStatBox
                    value={dashboardData.customers.newMonth.toLocaleString()}
                    label="New This Month"
                    color="#7C3AED"
                    bgClassName="bg-violet-50/80"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Section 6: Pending Actions */}
      <section className="relative">
        <SectionHeader icon={Clock} title="Critical Tasks & Alerts" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 relative z-10">
          {loading ? (
            <>
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </>
          ) : (
            <>
              <PendingActionCard
                icon={FileCheck}
                value={dashboardData.pending.disbursement}
                label="Pending Disbursement"
                color="#0D9488"
                bgClassName="bg-teal-50/50"
                onClick={() => navigate("/loaning/pending-disbursement")}
              />
              <PendingActionCard
                icon={ThumbsUp}
                value={dashboardData.pending.loanBM}
                label="BM Loan Approvals"
                color="#B45309"
                bgClassName="bg-amber-50/50"
                onClick={() => navigate("/loaning/pending-branch-manager")}
              />
              <PendingActionCard
                icon={ThumbsUp}
                value={dashboardData.pending.loanRM}
                label="RM Loan Approvals"
                color="#4338CA"
                bgClassName="bg-indigo-50/50"
                onClick={() => navigate("/loaning/pending-regional-manager")}
              />
              <PendingActionCard
                icon={PhoneCall}
                value={dashboardData.pending.customerCallbacks}
                label="Pending Callbacks"
                color="#15803D"
                bgClassName="bg-emerald-50/50"
                onClick={() => navigate("/registry/callbacks-pending")}
              />
              <PendingActionCard
                icon={UserCog}
                value={dashboardData.pending.customerBM}
                label="BM Reg. Approvals"
                color="#C2410C"
                bgClassName="bg-orange-50/50"
                onClick={() => navigate("/registry/bm-pending")}
              />
              <PendingActionCard
                icon={Building}
                value={dashboardData.pending.customerHQ}
                label="HQ Review Queue"
                color="#B91C1C"
                bgClassName="bg-rose-50/50"
                onClick={() => navigate("/registry/hq-pending")}
              />
            </>
          )}
        </div>
      </section>

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
