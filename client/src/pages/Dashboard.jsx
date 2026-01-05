import { useState, useEffect, useCallback, useRef} from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import Spinner from "../components/Spinner";
import {
  Briefcase,
  BarChart3,
  Users,
  AlertTriangle,
  CreditCard,
  Calendar,
  CalendarDays,
  CalendarCheck,
  Receipt,
  Shield,
  AlertCircle,
  TrendingDown,
  RefreshCw,
  Clock,
  FileCheck,
  ThumbsUp,
  UserCog,
  PhoneCall,
  Building,
  ChevronRight,
  Database,
  CheckCircle,
  AlertOctagon,
  User,
  Target,
  TrendingUp
} from "lucide-react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useAuth } from "../hooks/userAuth"; // replace with your auth hook


// ========== UTILITY FUNCTIONS ==========
const getLocalYYYYMMDD = (d = new Date()) => {
  const date = new Date(d);
  const kenyaTime = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const year = kenyaTime.getUTCFullYear();
  const month = String(kenyaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kenyaTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

// Full currency display without truncation
const formatCurrencyFull = (amount) => {
  if (amount === null || amount === undefined) return "Ksh 0";
  
  const numAmount = Number(amount);
  
  const parts = numAmount.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimalPart = parts[1];
  
  return `Ksh ${integerPart}.${decimalPart}`;
};

// Compact display for other sections (keep existing)
const formatCurrencyCompact = (amount) => {
  if (amount === null || amount === undefined) return "Ksh 0";
  
  const numAmount = Number(amount);
  const absAmount = Math.abs(numAmount);
  
  if (absAmount >= 1.0e9) {
    return `Ksh ${(numAmount / 1.0e9).toFixed(2)}B`;
  } else if (absAmount >= 1.0e6) {
    return `Ksh ${(numAmount / 1.0e6).toFixed(2)}M`;
  } else if (absAmount >= 1.0e3) {
    return `Ksh ${(numAmount / 1.0e3).toFixed(2)}K`;
  } else {
    return `Ksh ${numAmount.toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
};

// ========== CHART COMPONENTS ==========
const ProgressDonut = ({ 
  percentage, 
  label, 
  size = 80, 
  strokeWidth = 8, 
  color = "#1f76ad" 
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <span className="text-lg font-bold" style={{ color }}>
          {Math.round(percentage)}%
        </span>
        <span className="text-xs text-gray-600 mt-1">{label}</span>
      </div>
    </div>
  );
};

// ========== FIXED: CollectionProgressCard with FULL amounts ==========
const CollectionProgressCard = ({ 
  title, 
  collected, 
  expected, 
  
  onClick 
}) => {
  const percentage = expected > 0 ? (collected / expected) * 100 : 0;
  const getColor = () => {
    if (percentage >= 90) return "#10b981";
    if (percentage >= 70) return "#3b82f6";
    if (percentage >= 50) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-50">
            <Receipt className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-600">{title}</h4>
          </div>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold" style={{ color: getColor() }}>
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Collected:</span>
          {/* FIXED: Use formatCurrencyFull for FULL amounts */}
          <span className=" text-green-600 text-lg">
            {formatCurrencyFull(collected)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Expected:</span>
          {/* FIXED: Use formatCurrencyFull for FULL amounts */}
          <span className=" text-slate-600 text-lg">
            {formatCurrencyFull(expected)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Shortfall:</span>
          {/* FIXED: Use formatCurrencyFull for FULL amounts */}
          <span className=" text-red-600">
            {formatCurrencyFull(expected - collected)}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div 
            className="h-2 rounded-full transition-all duration-500"
            style={{ 
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor: getColor()
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
};



const COLORS = {
  olb: '#586ab1',        // Outstanding Loan Balance
  cleanBook: '#22bf72',  // Clean book green
  npl: '#ff0000',        // Non-performing loans
};





const SectionHeader = ({ icon, title, count, onViewAll }) => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center gap-4">
      <div className="p-3 rounded-lg  text-white shadow-sm" style={{ color: "#586ab1" }}>

        {icon}
      </div>

      <div>
        <h3 className=" leading-tight text-xl" style={{ color: "#586ab1" }}>
          {title}
        </h3>

        {count !== undefined && (
          <p className="text-sm text-gray-500 mt-0.5">
            {count.toLocaleString()} total records
          </p>
        )}
      </div>
    </div>

   {/* {onViewAll && (
  <button
    onClick={onViewAll}
    className="
      inline-flex items-center gap-2
      px-4 py-2
      text-sm font-medium
      text-[#586ab1]
      hover:underline
      transition-colors
    "
  >
    View details
    <ChevronRight size={16} />
  </button>
)} */}

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
  const [isSearching, setIsSearching] = useState(false);
  const [allCustomersForSearch, setAllCustomersForSearch] = useState([]);
  const searchContainerRef = useRef(null);

  // Data states - store raw data like old component
  const [allLoans, setAllLoans] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [allInstallments, setAllInstallments] = useState([]);
  const { profile } = useAuth();
const tenantId = profile?.tenant_id;


  // Dashboard data states - calculated from raw data
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

  // ========== FILTER INITIALIZATION ==========
 const initializeFilters = async (profile) => {
    
    // Reset all filters first
    setSelectedRegion("all");
    setSelectedBranch("all");
    setSelectedRO("all");
    setAvailableRegions([]);
    setAvailableBranches([]);
    setAvailableROs([]);
    
    const regions = await fetchRegions();
    const branches = await fetchBranches("all");
    const ros = await fetchRelationshipOfficers("all", "all");
    
    // For all roles, set available options
    setAvailableRegions(regions);
    setAvailableBranches(branches);
    setAvailableROs([{ id: "all", full_name: "All ROs" }, ...ros]);
    
    // Set initial selections based on role
    if (profile.role === "regional_manager") {
      setSelectedRegion(profile.regionId);
      // Get branches for this region only
      const regionBranches = await fetchBranches(profile.regionId);
      setAvailableBranches(regionBranches);
      
      // Get ROs for this region
      const regionROs = await fetchRelationshipOfficers("all", profile.regionId);
      setAvailableROs([{ id: "all", full_name: "All ROs" }, ...regionROs]);
    }
    else if (profile.role === "branch_manager") {
      setSelectedBranch(profile.branchId);
      // Find region for this branch
      const branch = branches.find(b => b.id === profile.branchId);
      if (branch) {
        setSelectedRegion(branch.region_id);
      }
      
      // Get ROs for this branch
      const branchROs = await fetchRelationshipOfficers(profile.branchId, "all");
      setAvailableROs([{ id: "all", full_name: "All ROs" }, ...branchROs]);
    }
    else if (profile.role === "relationship_officer") {
      // Find RO in the list
      const selfRO = ros.find(ro => ro.id === profile.id);
      if (selfRO) {
        setAvailableROs([{ id: selfRO.id, full_name: selfRO.full_name }]);
        setSelectedRO(selfRO.id);
      }
    }
  };

  

  // ========== DATA FETCHING FUNCTIONS ==========
 const fetchUserProfile = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!user) return null;

    const tenantId = user.app_metadata?.tenant_id;

    // ----- USERS TABLE -----
    let userQuery = supabase
      .from("users")
      .select("role, full_name")
      .eq("id", user.id);

    if (tenantId) {
      userQuery = userQuery.eq("tenant_id", tenantId);
    }

    const { data: userData, error: userError } = await userQuery.single();
    if (userError) throw userError;

    // ----- PROFILES TABLE -----
    let profileQuery = supabase
      .from("profiles")
      .select(`
        region_id,
        branch_id,
        branches!inner(name, code, region_id),
        regions!inner(name, code)
      `)
      .eq("id", user.id);

    if (tenantId) {
      profileQuery = profileQuery.eq("tenant_id", tenantId);
    }

    const { data: profileData, error: profileError } =
      await profileQuery.single();

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
  if (!tenantId) return [];

  try {
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



const fetchBranches = async (regionId = "all") => {
  if (!tenantId) return [];

  try {
    let query = supabase
      .from("branches")
      .select("id, name, code, region_id")
      .eq("tenant_id", tenantId)
      .order("name");

    if (regionId !== "all") {
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


const fetchRelationshipOfficers = async (branchId = "all", regionId = "all") => {
  if (!tenantId) return [];

  try {
    let query = supabase
      .from("profiles")
      .select(`
        id,
        branch_id,
        users!inner(id, full_name, role),
        branches!inner(id, name, region_id)
      `)
      .eq("tenant_id", tenantId)
      .eq("users.role", "relationship_officer");

    // Branch filter always takes priority
    if (branchId !== "all") {
      query = query.eq("branch_id", branchId);
    }
    // Apply region filter only if branch is not selected AND regionId is valid
    else if (regionId !== "all" && regionId !== null) {
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


 const handleRegionChange = async (regionId) => {
    setSelectedRegion(regionId);
    setSelectedBranch("all");
    setSelectedRO("all");

    // Fetch branches for selected region
    const branches = await fetchBranches(regionId);
    setAvailableBranches(branches);

    // Fetch ROs for selected region
    const ros = await fetchRelationshipOfficers("all", regionId);
    setAvailableROs([{ id: "all", full_name: "All ROs" }, ...ros]);
  };

  const handleBranchChange = async (branchId) => {
    setSelectedBranch(branchId);
    setSelectedRO("all");

    // Fetch ROs for this branch
    const ros = await fetchRelationshipOfficers(branchId, selectedRegion);
    setAvailableROs([{ id: "all", full_name: "All ROs" }, ...ros]);
  };

  const handleROChange = (roId) => {
    setSelectedRO(roId);
  };



  const applyFilters = useCallback((data, tableName = "loans") => {
    if (!userProfile || !Array.isArray(data)) return [];

    const { role, regionId: userRegionId, branchId: userBranchId, id: userId } = userProfile;
    
    let result = [...data];

    // ROLE HARD LIMITS (base filtering)
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

    // APPLY USER-SELECTED FILTERS
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





  // ========== METRIC CALCULATION FUNCTIONS ==========
  const calculatePortfolioMetrics = useCallback((filteredLoans) => {
    const disbursedLoans = filteredLoans.filter(loan => loan.status === "disbursed");
    
    // Get loan IDs for payment calculations
    const loanIds = disbursedLoans.map(loan => loan.id);
    
    // Filter payments and installments for these loans
    const filteredPayments = allPayments.filter(payment => 
      loanIds.includes(payment.loan_id)
    );
    const filteredInstallments = allInstallments.filter(installment => 
      loanIds.includes(installment.loan_id)
    );

    let totalPayable = 0;
    let totalPaid = 0;
    let totalArrears = 0;
    let arrearsLoans = new Set();

    if (disbursedLoans.length > 0) {
      totalPayable = disbursedLoans.reduce((sum, loan) => 
        sum + (Number(loan.total_payable) || 0), 0
      );

      totalPaid = filteredPayments.reduce((sum, payment) => 
        sum + (Number(payment.paid_amount) || 0), 0
      );

      const today = getTodayDate();
      const overdueInstallments = filteredInstallments.filter(inst => 
        ["overdue", "partial"].includes(inst.status) && 
        inst.due_date && inst.due_date <= today
      );

      overdueInstallments.forEach(inst => {
        const dueAmount = Number(inst.due_amount) || 0;
        const paidAmount = (Number(inst.interest_paid) || 0) + (Number(inst.principal_paid) || 0);
        const arrears = dueAmount - paidAmount;
        
        if (arrears > 0) {
          totalArrears += arrears;
          arrearsLoans.add(inst.loan_id);
        }
      });
    }

    const outstandingBalance = Math.max(0, totalPayable - totalPaid);
    const cleanBook = Math.max(0, outstandingBalance - totalArrears);
    const cleanBookPercentage = outstandingBalance > 0 ? 
      (cleanBook / outstandingBalance) * 100 : 100;

    const nplLoans = filteredLoans.filter(loan => loan.status === "defaulted");
    const nplAmount = nplLoans.reduce((sum, loan) => 
      sum + (Number(loan.total_payable) || 0), 0
    );

    const performingLoans = disbursedLoans.filter(loan => loan.status !== "defaulted");
    const performingAmount = performingLoans.reduce((sum, loan) => 
      sum + (Number(loan.total_payable) || 0), 0
    );

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
    };
  }, [allPayments, allInstallments]);

  const calculateDisbursementMetrics = useCallback((filteredLoans) => {
    const disbursedLoans = filteredLoans.filter(loan => loan.status === "disbursed");
    const today = getTodayDate();
    const monthStart = getMonthStartDate();

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

    return {
      total: disbursedLoans.length,
      totalAmount: disbursedLoans.reduce((sum, loan) => 
        sum + (Number(loan.scored_amount) || 0), 0
      ),
      today: disbursedToday.length,
      todayAmount: disbursedToday.reduce((sum, loan) => 
        sum + (Number(loan.scored_amount) || 0), 0
      ),
      thisMonth: disbursedThisMonth.length,
      thisMonthAmount: disbursedThisMonth.reduce((sum, loan) => 
        sum + (Number(loan.scored_amount) || 0), 0
      ),
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

    // Filter relevant installments and payments
    const filteredInstallments = allInstallments.filter(inst => 
      loanIds.includes(inst.loan_id)
    );
    const filteredPayments = allPayments.filter(payment => 
      loanIds.includes(payment.loan_id)
    );

    // Today's collection
    const todayInstallments = filteredInstallments.filter(inst => 
      inst.due_date === today
    );
    const todayPayments = filteredPayments.filter(payment => {
      const paymentDate = getLocalYYYYMMDD(new Date(payment.created_at));
      return paymentDate === today;
    });

    // Monthly collection
    const monthInstallments = filteredInstallments.filter(inst => 
      inst.due_date && inst.due_date >= monthStart && inst.due_date <= monthEnd
    );
    const monthPayments = filteredPayments.filter(payment => {
      const paymentDate = getLocalYYYYMMDD(new Date(payment.created_at));
      return paymentDate >= monthStart && paymentDate <= monthEnd;
    });

    // Tomorrow's collection
    const tomorrowInstallments = filteredInstallments.filter(inst => 
      inst.due_date === tomorrow
    );

    const todayExpected = todayInstallments.reduce((sum, inst) => 
      sum + (Number(inst.due_amount) || 0), 0
    );
    
    const todayCollected = todayPayments.reduce((sum, payment) => 
      sum + (Number(payment.paid_amount) || 0), 0
    );
    
    const todayRate = todayExpected > 0 ? (todayCollected / todayExpected) * 100 : 100;

    const monthExpected = monthInstallments.reduce((sum, inst) => 
      sum + (Number(inst.due_amount) || 0), 0
    );
    
    const monthCollected = monthPayments.reduce((sum, payment) => 
      sum + (Number(payment.paid_amount) || 0), 0
    );
    
    const monthRate = monthExpected > 0 ? (monthCollected / monthExpected) * 100 : 100;

    const tomorrowExpected = tomorrowInstallments.reduce((sum, inst) => 
      sum + (Number(inst.due_amount) || 0), 0
    );

    // Calculate prepayments (payments made today for tomorrow's installments)
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
      today: {
        collected: todayCollected,
        expected: todayExpected,
        rate: todayRate,
      },
      month: {
        collected: monthCollected,
        expected: monthExpected,
        rate: monthRate,
      },
      tomorrow: {
        expected: tomorrowExpected,
        prepaid: prepaidAmount,
        rate: tomorrowRate,
      },
    };
  }, [allInstallments, allPayments]);

  const calculateCustomerMetrics = useCallback((filteredCustomers) => {
    const today = getTodayDate();
    const monthStart = getMonthStartDate();

    const activeCustomers = filteredCustomers.filter(c => c.status === "active").length;
    const inactiveCustomers = filteredCustomers.filter(c => c.status !== "active").length;
    
    const newToday = filteredCustomers.filter(c => 
      c.created_at && getLocalYYYYMMDD(new Date(c.created_at)) === today
    ).length;
    
    const newMonth = filteredCustomers.filter(c => 
      c.created_at && getLocalYYYYMMDD(new Date(c.created_at)) >= monthStart
    ).length;

    // Calculate leads conversion
    const filteredLeads = applyFilters(allLeads, "leads");
    const leadsToday = filteredLeads.filter(lead => 
      lead.created_at && getLocalYYYYMMDD(new Date(lead.created_at)) === today
    ).length;
    
    const leadsMonth = filteredLeads.filter(lead => 
      lead.created_at && getLocalYYYYMMDD(new Date(lead.created_at)) >= monthStart
    ).length;

    // Calculate conversion rates
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
      leadsToday,
      leadsMonth,
      convertedToday,
      convertedMonth,
      conversionRateToday,
      conversionRateMonth,
    };
  }, [allLeads, applyFilters]);

  const calculatePendingActions = useCallback((filteredLoans, filteredCustomers) => {
    return {
      disbursement: filteredLoans.filter(l => 
        l.status === "approved" && !l.disbursed_at
      ).length,
      loanBM: filteredLoans.filter(l => l.status === "bm_review").length,
      loanRM: filteredLoans.filter(l => l.status === "rm_review").length,
      customerBM: filteredCustomers.filter(c => c.status === "bm_review").length,
      customerCallbacks: filteredCustomers.filter(c => 
        c.callback_date && new Date(c.callback_date) > new Date()
      ).length,
      customerHQ: filteredCustomers.filter(c => c.status === "hq_review").length,
    };
  }, []);


  // ========== RECALCULATE DASHBOARD METRICS ==========
  const recalculateDashboardMetrics = useCallback(() => {
    if (!userProfile || allLoans.length === 0 || allCustomers.length === 0) return;

    const filteredLoans = applyFilters(allLoans, "loans");
    const filteredCustomers = applyFilters(allCustomers, "customers");

    // Use the calculation functions
    const portfolioMetrics = calculatePortfolioMetrics(filteredLoans);
    const disbursementMetrics = calculateDisbursementMetrics(filteredLoans);
    const collectionMetrics = calculateCollectionMetrics(filteredLoans);
    const customerMetrics = calculateCustomerMetrics(filteredCustomers);
    const pendingActions = calculatePendingActions(filteredLoans, filteredCustomers);

    setDashboardData({
      portfolio: portfolioMetrics,
      disbursements: disbursementMetrics,
      collections: collectionMetrics,
      customers: customerMetrics,
      pending: pendingActions,
      risk: {
        par: portfolioMetrics.outstandingBalance > 0 
          ? (portfolioMetrics.totalArrears / portfolioMetrics.outstandingBalance) * 100 
          : 0,
        totalArrears: portfolioMetrics.totalArrears,
        arrearsLoans: portfolioMetrics.arrearsLoans,
        mtdArrears: 0,
        mtdArrearsLoans: 0,
        outstandingBalance: portfolioMetrics.outstandingBalance,
      }
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
    calculatePendingActions
  ]);



  // ========== INITIAL DATA FETCH ==========
  const fetchAllData = async () => {
    try {
      setLoading(true);

      const profile = await fetchUserProfile();
      if (!profile) {
        setLoading(false);
        return;
      }

      // Initialize filters
      await initializeFilters(profile);

      // Fetch all data in parallel (like old component)
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

      // Set customers for search
      const enrichedCustomers = (customersData || []).map(customer => ({
        ...customer,
        displayName: `${customer.Firstname || ''} ${customer.Surname || ''}`.trim(),
      }));
      setAllCustomersForSearch(enrichedCustomers);

      // Initial calculation
      recalculateDashboardMetrics();

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  // ========== CLIENT-SIDE QUICK SEARCH HANDLER ==========
 const handleQuickSearch = useCallback((term) => {
  if (!term.trim()) {
    setQuickSearchResults([]);
    return;
  }

  setIsSearching(true);

  const searchTerm = term.toLowerCase().trim();

  // STEP 1: Apply role + region + branch + RO filters FIRST
  const roleFilteredCustomers = applyFilters(allCustomersForSearch, "customers");

  //  STEP 2: Apply text search ONLY on allowed customers
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
  setIsSearching(false);
}, [allCustomersForSearch, applyFilters]);


  // ========== NAVIGATION HANDLERS ==========
  const navigateToPortfolio = () => navigate("/portfolio");
  const navigateToCustomers = () => navigate("/customers");
  const navigateToCollections = () => navigate("/collections");
  const navigateToRisk = () => navigate("/risk");
  const navigateToPending = () => navigate("/registry/approvals-pending");
  const navigateToDisbursements = () => navigate("/loaning/disbursement-loans");
  const navigateToPendingDisbursement = () => navigate("/loaning/pending-disbursement");

  const handleOpen360View = (customer) => {
    navigate(`/customer/${customer.id}/360`);
    setQuickSearchTerm("");
    setQuickSearchResults([]);
  };

  // ========== EFFECTS ==========
  useEffect(() => {
    fetchAllData();
  }, []);

  // Recalculate metrics when data changes
 useEffect(() => {
    if (userProfile && allLoans.length > 0 && allCustomers.length > 0) {
      recalculateDashboardMetrics();
    }
  }, [
    userProfile,
    allLoans,
    allCustomers,
    selectedRegion,
    selectedBranch,
    selectedRO,
    recalculateDashboardMetrics
  ]);

  // Client-side search effect
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

  // Click outside handler for search
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setQuickSearchResults([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);




const getCleanBookMeta = (percentage) => {
  if (percentage < 25) {
    return { label: "Very Poor", color: "#ef4444" };
  }
  if (percentage < 50) {
    return { label: "Poor", color: "#f97316" };
  }
  if (percentage < 75) {
    return { label: "Average", color: "#f59e0b" };
  }
  if (percentage < 85) {
    return { label: "Good", color: "#22c55e" };
  }
  return { label: "Excellent", color: "#16a34a" };
};




const cleanBookPercentage =
  dashboardData.portfolio.outstandingBalance > 0
    ? (dashboardData.portfolio.cleanBook /
        dashboardData.portfolio.outstandingBalance) *
      100
    : 0;

const cleanBookMeta = getCleanBookMeta(cleanBookPercentage);


//   useEffect(() => {
//   if (allLoans.length > 0 && allCustomers.length > 0) {
//     recalculateDashboardMetrics();
//   }
// }, [allLoans, allCustomers, selectedRegion, selectedBranch, selectedRO]);






  // ========== LOADING STATE ==========
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#d9e2e8' }}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Spinner text="Loading Dashboard..." />
          </div>
        </div>
      </div>
    );
  }

  return (
<div className="min-h-screen p-4 md:p-6 border-b border-gray-200 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      {/* Header Section */}
      <div className="mb-8">
        {/* Unified Filter + Quick Search Row */}
      <div className="flex justify-end w-full mb-6">
  <div className="flex flex-row items-end gap-3">

    {/* Region Filter */}
    {["credit_analyst_officer", "customer_service_officer", "regional_manager"].includes(userProfile?.role) && (
      <select
        value={selectedRegion}
        onChange={(e) => handleRegionChange(e.target.value)}
        disabled={userProfile?.role === "regional_manager"}
        className="h-8 w-60 px-4 py-1.5 rounded-lg border border-gray-300 text-sm  shadow-sm
        focus:ring-2 focus:ring-[#586ab1] focus:border-[#586ab1]"
        style={{ backgroundColor: "#d9e2e8" }}
      >
        {userProfile?.role === "regional_manager" ? (
          <option value={userProfile.regionId}>
            {userProfile.regionName || "My Region"}
          </option>
        ) : (
          <>
            <option value="all">All Regions</option>
            {availableRegions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </>
        )}
      </select>
    )}

    {/* Branch Filter */}
    {["credit_analyst_officer", "customer_service_officer", "regional_manager", "branch_manager"].includes(userProfile?.role) && (
      <select
        value={selectedBranch}
        onChange={(e) => handleBranchChange(e.target.value)}
        disabled={userProfile?.role === "branch_manager"}
        className="h-8 w-60 px-4 py-1.5 rounded-lg border border-gray-300 text-sm  shadow-sm
        focus:ring-2 focus:ring-[#586ab1] focus:border-[#586ab1]"
        style={{ backgroundColor: "#d9e2e8" }}
      >
        {userProfile?.role === "branch_manager" ? (
          <option value={userProfile.branchId}>
            {userProfile.branchName || "My Branch"}
          </option>
        ) : (
          <>
            <option value="all">All Branches</option>
            {availableBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </>
        )}
      </select>
    )}

    {/* RO Filter */}
    {["credit_analyst_officer", "customer_service_officer", "regional_manager", "branch_manager"].includes(userProfile?.role) && (
      <select
        value={selectedRO}
        onChange={(e) => handleROChange(e.target.value)}
        disabled={availableROs.length <= 1}
        className="h-8 w-60 px-4 py-1.5 rounded-lg border border-gray-300 text-sm  shadow-sm
        focus:ring-2 focus:ring-[#586ab1] focus:border-[#586ab1]"
        style={{ backgroundColor: "#d9e2e8" }}
      >
        {availableROs.map((ro) => (
          <option key={ro.id} value={ro.id}>
            {ro.full_name}
          </option>
        ))}
      </select>
    )}

    {/* Quick Search */}
    <div className="relative w-60" ref={searchContainerRef}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <MagnifyingGlassIcon className="w-4 h-4" />
      </div>

      <input
        type="text"
        placeholder="Quick search 360° View..."
        value={quickSearchTerm}
        onChange={(e) => setQuickSearchTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && quickSearchResults.length > 0) {
            handleOpen360View(quickSearchResults[0]);
          }
        }}
        className="h-8 w-full pl-9 pr-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium shadow-sm
        focus:ring-2 focus:ring-[#586ab1] focus:border-[#586ab1]"
        style={{ backgroundColor: "#d9e2e8" }}
      />

      {/* Search Results */}
      {quickSearchTerm && (
        <div className="absolute right-0 z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-xl max-h-96 overflow-y-auto">
          {quickSearchResults.map((customer) => (
            <div
              key={customer.id}
              onClick={() => handleOpen360View(customer)}
              className="p-3 cursor-pointer border-b border-gray-100 last:border-b-0
              hover:bg-slate-100 hover:text-white transition-colors"
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

      </div>

  {/* Main Dashboard Grid */}
<div className="space-y-8">
  {/* Portfolio Section */}
<div
  className="
    relative rounded-2xl p-6 mt-0
    border border-gray-200
    shadow-sm
    bg-gradient-to-br from-[#d9e2e8] via-[#eef3f7] to-[#d9e2e8]
    overflow-hidden
  "
>
  <div className="relative">
    <SectionHeader
      icon={<Briefcase size={24} />}
      title="Portfolio Overview"
      onViewAll={navigateToPortfolio}
    />

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">

      {/* ================= OLB CARD ================= */}
    <div
  onClick={navigateToPortfolio}
  className="
    rounded-xl p-5 cursor-pointer
    border transition-all duration-300
    hover:-translate-y-1 hover:shadow-lg
  "
  style={{
    borderColor: "#e1e5f1",
    backgroundColor: "#f8f9fe",
    backgroundImage: `
      radial-gradient(#d9e2e8 1px, transparent 1px),
      radial-gradient(#d9e2e8 1px, transparent 1px)
    `,
    backgroundPosition: "0 0, 10px 10px",
    backgroundSize: "20px 20px",
  }}
>
  <div className="flex flex-col items-center text-center">
    <div
      className="mb-4 flex items-center justify-center rounded-full"
      style={{
        width: 64,
        height: 64,
        backgroundColor: "rgba(88,106,177,0.12)",
      }}
    >
      <Database className="w-7 h-7" style={{ color: "#586ab1" }} />
    </div>

    <p className="text-2xl font-bold" style={{ color: "#586ab1" }}>
      {formatCurrencyFull(dashboardData.portfolio.outstandingBalance)}
    </p>
    <p className="text-lg font-medium text-slate-600 mt-2">OLB</p>
    <p className="text-xs text-gray-500 mt-1">
      {dashboardData.portfolio.totalLoans.toLocaleString()} loans
    </p>
  </div>
</div>


      {/* ================= CLEAN BOOK CARD ================= */}
      <div
        onClick={navigateToPortfolio}
        className="
          rounded-xl p-5 cursor-pointer
          border transition-all duration-300
          hover:-translate-y-1 hover:shadow-lg
          bg-white
        "
        style={{
          borderColor: "#d1f0e0",
          backgroundImage: "repeating-linear-gradient(45deg, rgba(34,191,114,0.1), rgba(34,191,114,0.1) 4px, transparent 4px, transparent 8px)",
        }}
      >
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 flex items-center justify-center rounded-full"
            style={{
              width: 64,
              height: 64,
              backgroundColor: "rgba(34,191,114,0.12)",
            }}
          >
            <CheckCircle className="w-7 h-7" style={{ color: "#22bf72" }} />
          </div>

          <p className="text-2xl font-bold" style={{ color: "#22bf72" }}>
            {formatCurrencyFull(dashboardData.portfolio.cleanBook)}
          </p>

          <p className="text-lg font-medium text-slate-600 mt-2">
            Clean Book
          </p>

          <p className="text-xs mt-1" style={{ color: cleanBookMeta.color }}>
            {Math.round(cleanBookPercentage)}% • {cleanBookMeta.label}
          </p>
        </div>
      </div>

      {/* ================= NPL CARD ================= */}
      <div
        onClick={navigateToPortfolio}
        className="
          rounded-xl p-5 cursor-pointer
          border transition-all duration-300
          hover:-translate-y-1 hover:shadow-lg
          bg-white
        "
        style={{
          borderColor: "#fed7d7",
          backgroundImage: "repeating-radial-gradient(circle, rgba(239,68,68,0.1) 0px, rgba(239,68,68,0.1) 2px, transparent 2px, transparent 6px)",
        }}
      >
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 flex items-center justify-center rounded-full"
            style={{
              width: 64,
              height: 64,
              backgroundColor: "rgba(239,68,68,0.12)",
            }}
          >
            <AlertOctagon className="w-7 h-7" style={{ color: "#ef4444" }} />
          </div>

          <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>
            {Math.round(dashboardData.portfolio.nplPercentage)}%
          </p>

          <p className="text-lg font-medium text-slate-600 mt-2">NPL</p>

          <div className="mt-3 space-y-2 w-full text-sm">
            <div className="flex justify-between px-2">
              <span className="text-gray-600">Amount</span>
              <span style={{ color: "#ef4444" }}>
                {formatCurrencyCompact(dashboardData.portfolio.nplAmount)}
              </span>
            </div>
            <div className="flex justify-between px-2">
              <span className="text-gray-600">Loans</span>
              <span style={{ color: "#ef4444" }}>
                {dashboardData.portfolio.nplLoans.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= TOTAL CUSTOMERS CARD ================= */}
      <div
        onClick={navigateToCustomers}
        className="
          rounded-xl p-5 cursor-pointer
          border transition-all duration-300
          hover:-translate-y-1 hover:shadow-lg
          bg-white
        "
        style={{
          borderColor: "#e9d8fd",
          backgroundImage: "linear-gradient(135deg, rgba(139,92,246,0.08) 25%, transparent 25%, transparent 50%, rgba(139,92,246,0.08) 50%, rgba(139,92,246,0.08) 75%, transparent 75%, transparent 100%)",
          backgroundSize: "20px 20px",
        }}
      >
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 flex items-center justify-center rounded-full"
            style={{
              width: 64,
              height: 64,
              backgroundColor: "rgba(139,92,246,0.12)",
            }}
          >
            <User className="w-7 h-7" style={{ color: "#8b5cf6" }} />
          </div>

          <p className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>
            {dashboardData.customers.total.toLocaleString()}
          </p>

          <p className="text-lg font-medium text-slate-600 mt-2">
            Total Customers
          </p>

          <p className="text-xs text-gray-500 mt-1">
            {dashboardData.customers.active.toLocaleString()} active
          </p>
        </div>
      </div>

    </div>
  </div>
</div>



  {/* Collections Section */}
  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
    <SectionHeader
      icon={<Receipt size={24} />}
      title="Collections Performance"
      onViewAll={navigateToCollections}
    />
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 " >
      <CollectionProgressCard
        title="Today's Collection"
        collected={dashboardData.collections.today.collected}
        expected={dashboardData.collections.today.expected}
        period="Today"
        onClick={navigateToCollections}
      />
      
      <CollectionProgressCard
        title="Monthly Collection"
        collected={dashboardData.collections.month.collected}
        expected={dashboardData.collections.month.expected}
        period="This Month"
        onClick={navigateToCollections}
      />
      
      <div className="rounded-xl p-5 border border-gray-200" 
        style={{ 
          backgroundColor: '#f0f9ff',
          borderColor: '#e0f2fe'
        }}
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div 
            className="p-3 rounded-full mb-3 flex items-center justify-center"
            style={{ 
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              width: '56px',
              height: '56px'
            }}
          >
            <CalendarCheck className="w-6 h-6" style={{ color: '#3b82f6' }} />
          </div>
          <h4 className="text-slate-600">Tomorrow's Collection</h4>
          <p className="text-sm text-gray-500 mt-1">Expected vs Prepaid</p>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center p-3 rounded-lg"
            style={{ backgroundColor: '#eff6ff' }}
          >
            <span className="text-sm text-gray-700">Expected:</span>
            <span className="text-slate-600 break-words">
              {formatCurrencyFull(dashboardData.collections.tomorrow.expected)}
            </span>
          </div>
          
          <div className="flex justify-between items-center p-3 rounded-lg"
            style={{ backgroundColor: '#f0fdf4' }}
          >
            <span className="text-sm text-gray-700">Prepaid:</span>
            <span className="break-words" style={{ color: '#16a34a' }}>
              {formatCurrencyFull(dashboardData.collections.tomorrow.prepaid)}
            </span>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Prepayment Rate:</span>
              <span style={{ color: '#3b82f6' }}>
                {Math.round(dashboardData.collections.tomorrow.rate)}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div 
                className="h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(dashboardData.collections.tomorrow.rate, 100)}%`,
                  backgroundColor: '#3b82f6'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  {/* Disbursements & Risk Grid */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
    {/* Disbursements Section */}
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <SectionHeader
        icon={<CreditCard size={24} />}
        title="Loan Disbursements"
        onViewAll={navigateToDisbursements}
      />
      
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-xl"
            style={{ backgroundColor: '#f9fafb' }}
          >
            <p className="text-2xl text-slate-600 font-medium">
              {dashboardData.disbursements.total.toLocaleString()}
            </p>
            <p className="text-sm text-slate-500 mt-1">Total Loans</p>
          </div>
          <div className="text-center p-4 rounded-xl"
            style={{ backgroundColor: '#f0fdf4' }}
          >
            <p className="text-2xl font-medium" style={{ color: '#16a34a' }}>
              {dashboardData.disbursements.today.toLocaleString()}
            </p>
            <p className="text-sm" style={{ color: '#16a34a' }}>Today</p>
          </div>
          <div className="text-center p-4 rounded-xl"
            style={{ backgroundColor: '#f0f9ff' }}
          >
            <p className="text-2xl font-semibold" style={{ color: '#3b82f6' }}>
              {dashboardData.disbursements.thisMonth.toLocaleString()}
            </p>
            <p className="text-sm" style={{ color: '#3b82f6' }}>This Month</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center p-3 rounded-xl border"
            style={{ backgroundColor: '#f9fafb' }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg"
                style={{ backgroundColor: '#f3f4f6' }}
              >
                <BarChart3 className="w-5 h-5 text-gray-700" />
              </div>
              <span className="text-gray-700">Total Disbursed Amount</span>
            </div>
            <span className="text-xl font-semibold text-slate-600 break-words max-w-[50%] text-right">
              {formatCurrencyFull(dashboardData.disbursements.totalAmount)}
            </span>
          </div>
          
          <div className="flex justify-between items-center p-3 rounded-xl border"
            style={{ backgroundColor: '#f0fdf4' }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg"
                style={{ backgroundColor: '#dcfce7' }}
              >
                <Calendar className="w-5 h-5" style={{ color: '#16a34a' }} />
              </div>
              <span className="text-gray-700">Today's Disbursement</span>
            </div>
            <span className="text-xl break-words max-w-[50%] text-right"
              style={{ color: '#16a34a' }}
            >
              {formatCurrencyFull(dashboardData.disbursements.todayAmount)}
            </span>
          </div>
          
          <div className="flex justify-between items-center p-3 rounded-xl border"
            style={{ backgroundColor: '#f0f9ff' }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg"
                style={{ backgroundColor: '#dbeafe' }}
              >
                <CalendarDays className="w-5 h-5" style={{ color: '#3b82f6' }} />
              </div>
              <span className="text-gray-700">MTD Disbursement</span>
            </div>
            <span className="text-xl break-words max-w-[50%] text-right"
              style={{ color: '#3b82f6' }}
            >
              {formatCurrencyFull(dashboardData.disbursements.thisMonthAmount)}
            </span>
          </div>
        </div>
      </div>
    </div>

    {/* Risk Section */}
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <SectionHeader
        icon={<Shield size={24} />}
        title="Risk Metrics"
        onViewAll={navigateToRisk}
      />
      
      <div className="space-y-6">
        <div className="p-4 rounded-xl border"
          style={{ 
            backgroundColor: '#fef2f2',
            borderColor: '#fecaca'
          }}
        >
          <div className="flex flex-col items-center text-center mb-4">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5" style={{ color: '#ef4444' }} />
              <span className="text-slate-600">Portfolio at Risk (PAR)</span>
            </div>
            <span className={`text-xl ${
              dashboardData.risk.par > 40 ? 'text-red-600' :
              dashboardData.risk.par > 20 ? 'text-amber-600' : 'text-green-600'
            }`}>
            </span>
          </div>
          
          <div className="flex justify-center">
            <ProgressDonut 
              percentage={Math.min(dashboardData.risk.par, 100)}
              label="PAR "
              color={
                dashboardData.risk.par > 40 ? '#ef4444' :
                dashboardData.risk.par > 20 ? '#f59e0b' : '#10b981'
              }
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border"
            style={{ 
              backgroundColor: '#fffbeb',
              borderColor: '#fde68a'
            }}
          >
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4" style={{ color: '#d97706' }} />
                <span className="text-sm text-slate-600">Total Arrears</span>
              </div>
              <p className="text-xl text-red-600 font-medium break-words">
                {formatCurrencyFull(dashboardData.risk.totalArrears)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {dashboardData.risk.arrearsLoans.toLocaleString()} loans affected
              </p>
            </div>
          </div>
          
          <div className="p-4 rounded-xl border"
            style={{ 
              backgroundColor: '#fff7ed',
              borderColor: '#fed7aa'
            }}
          >
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4" style={{ color: '#ea580c' }} />
                <span className="text-sm text-slate-600">MTD Arrears</span>
              </div>
              <p className="text-xl font-medium text-red-600 break-words">
                {formatCurrencyFull(dashboardData.risk.mtdArrears)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {dashboardData.risk.mtdArrearsLoans.toLocaleString()} loans this month
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  {/* Customers & Pending Actions Grid */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
    {/* Customers Section */}
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <SectionHeader
        icon={<Users size={24} />}
        title="Customer Analytics"
        count={dashboardData.customers.total}
        onViewAll={navigateToCustomers}
      />
      
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-xl"
            style={{ 
              backgroundColor: '#f0fdf4',
              borderColor: '#bbf7d0'
            }}
          >
            <p className="text-2xl" style={{ color: '#16a34a' }}>
              {dashboardData.customers.active.toLocaleString()}
            </p>
            <p className="text-sm text-slate-500 mt-1">Active</p>
          </div>
          <div className="text-center p-4 rounded-xl"
            style={{ 
              backgroundColor: '#fef2f2',
              borderColor: '#fecaca'
            }}
          >
            <p className="text-2xl" style={{ color: '#dc2626' }}>
              {dashboardData.customers.inactive.toLocaleString()}
            </p>
            <p className="text-sm text-slate-500 mt-1">Inactive</p>
          </div>
          <div className="text-center p-4 rounded-xl"
            style={{ 
              backgroundColor: '#f0f9ff',
              borderColor: '#bae6fd'
            }}
          >
            <p className="text-2xl" style={{ color: '#0284c7' }}>
              {dashboardData.customers.newToday.toLocaleString()}
            </p>
            <p className="text-sm text-slate-500 mt-1">New Today</p>
          </div>
          <div className="text-center p-4 rounded-xl"
            style={{ 
              backgroundColor: '#faf5ff',
              borderColor: '#e9d5ff'
            }}
          >
            <p className="text-2xl" style={{ color: '#7c3aed' }}>
              {dashboardData.customers.newMonth.toLocaleString()}
            </p>
            <p className="text-sm text-slate-500 mt-1">New Month</p>
          </div>
        </div>
        
        {/* Lead Conversion Circles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl p-5 border"
            style={{ 
              backgroundColor: '#fffbeb',
              borderColor: '#fde68a'
            }}
          >
            <div className="flex flex-col items-center text-center mb-4">
              <div 
                className="p-2 rounded-full mb-3 flex items-center justify-center"
                style={{ 
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  width: '48px',
                  height: '48px'
                }}
              >
                <Target className="w-5 h-5" style={{ color: '#f59e0b' }} />
              </div>
              <h4 className="text-slate-600 text-sm">Leads Today</h4>
              <p className="text-sm text-slate-500">{dashboardData.customers.leadsToday.toLocaleString()} leads</p>
            </div>
            
            <div className="flex flex-col items-center">
              <ProgressDonut 
                percentage={dashboardData.customers.conversionRateToday}
                label="Rate"
                color="#f59e0b"
                size={100}
              />
              
              <div className="mt-4 text-center space-y-1 w-full">
                <div className="flex justify-between text-sm px-4">
                  <span className="text-slate-600">Leads:</span>
                  <span className="text-slate-600">{dashboardData.customers.leadsToday.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm px-4">
                  <span className="text-slate-600">Converted:</span>
                  <span style={{ color: '#16a34a' }}>{dashboardData.customers.convertedToday.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm px-4">
                  <span className="text-slate-600">Rate:</span>
                  <span style={{ color: '#f59e0b' }}>
                    {Math.round(dashboardData.customers.conversionRateToday)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl p-5 border"
            style={{ 
              backgroundColor: '#f0fdf4',
              borderColor: '#a7f3d0'
            }}
          >
            <div className="flex flex-col items-center text-center mb-4">
              <div 
                className="p-2 rounded-full mb-3 flex items-center justify-center"
                style={{ 
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  width: '48px',
                  height: '48px'
                }}
              >
                <TrendingUp className="w-5 h-5" style={{ color: '#22c55e' }} />
              </div>
              <h4 className="text-slate-600 text-sm">Leads This Month</h4>
              <p className="text-sm text-slate-500">{dashboardData.customers.leadsMonth.toLocaleString()} leads</p>
            </div>
            
            <div className="flex flex-col items-center">
              <ProgressDonut 
                percentage={dashboardData.customers.conversionRateMonth}
                label="Rate"
                color="#22c55e"
                size={100}
              />
              
              <div className="mt-4 text-center space-y-1 w-full">
                <div className="flex justify-between text-sm px-4">
                  <span className="text-slate-600">Leads:</span>
                  <span className="text-slate-600">{dashboardData.customers.leadsMonth.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm px-4">
                  <span className="text-slate-600">Converted:</span>
                  <span style={{ color: '#16a34a' }}>{dashboardData.customers.convertedMonth.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm px-4">
                  <span className="text-slate-600">Rate:</span>
                  <span style={{ color: '#22c55e' }}>
                    {Math.round(dashboardData.customers.conversionRateMonth)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Pending Actions Section */}
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <SectionHeader
        icon={<Clock size={24} />}
        title="Pending Actions"
        count={Object.values(dashboardData.pending).reduce((a, b) => a + b, 0)}
        onViewAll={navigateToPending}
      />
      
      <div className="space-y-4">
        {[
          {
            label: "Pending Disbursement",
            count: dashboardData.pending.disbursement,
            icon: <FileCheck className="w-5 h-5" style={{ color: '#3b82f6' }} />,
            color: "blue",
            action: navigateToPendingDisbursement,
            priority: dashboardData.pending.disbursement > 10 ? "high" : "medium"
          },
          {
            label: "Pending BM Loan Approvals",
            count: dashboardData.pending.loanBM,
            icon: <ThumbsUp className="w-5 h-5" style={{ color: '#f59e0b' }} />,
            color: "amber",
            action: () => navigate("/loaning/pending-branch-manager"),
            priority: "medium"
          },
          {
            label: "Pending RM Loan Approvals",
            count: dashboardData.pending.loanRM,
            icon: <ThumbsUp className="w-5 h-5" style={{ color: '#8b5cf6' }} />,
            color: "purple",
            action: () => navigate("/loaning/pending-regional-manager"),
            priority: "medium"
          },
          {
            label: "Pending BM Customer Approvals",
            count: dashboardData.pending.customerBM,
            icon: <UserCog className="w-5 h-5" style={{ color: '#22c55e' }} />,
            color: "green",
            action: () => navigate("/registry/bm-pending"),
            priority: "low"
          },
          {
            label: "Pending Customer Callbacks",
            count: dashboardData.pending.customerCallbacks,
            icon: <PhoneCall className="w-5 h-5" style={{ color: '#06b6d4' }} />,
            color: "cyan",
            action: () => navigate("/registry/callbacks-pending"),
            priority: "low"
          },
          {
            label: "Pending HQ Review",
            count: dashboardData.pending.customerHQ,
            icon: <Building className="w-5 h-5" style={{ color: '#6b7280' }} />,
            color: "gray",
            action: () => navigate("/registry/hq-pending"),
            priority: "medium"
          }
        ].map((item, index) => (
          <div
            key={index}
            onClick={item.action}
            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all duration-300 hover:shadow-md group ${
              item.priority === "high" ? "border-red-200" :
              item.priority === "medium" ? "border-amber-200" : "border-gray-200"
            }`}
            style={{ 
              backgroundColor: item.priority === "high" ? '#fef2f2' :
                item.priority === "medium" ? '#fffbeb' : '#f9fafb'
            }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg"
                style={{ 
                  backgroundColor: item.color === "blue" ? '#dbeafe' :
                    item.color === "amber" ? '#fef3c7' :
                    item.color === "purple" ? '#ede9fe' :
                    item.color === "green" ? '#d1fae5' :
                    item.color === "cyan" ? '#cffafe' : '#f3f4f6'
                }}
              >
                {item.icon}
              </div>
              <div>
                <p className="text-gray-900">{item.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-lg ${
                item.priority === "high" ? 'text-red-700' :
                item.priority === "medium" ? 'text-amber-700' : 'text-gray-700'
              }`}>
                {item.count.toLocaleString()}
              </span>
              {item.priority === "high" && item.count > 0 && (
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              )}
              <ChevronRight className="text-gray-400 group-hover:text-gray-600" size={18} />
            </div>
          </div>
        ))}
      </div>
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