import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import {
  MagnifyingGlassIcon
  
} from "@heroicons/react/24/outline";

const Dashboard = () => {
  const [userRegion, setUserRegion] = useState(null);
  const [userBranch, setUserBranch] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userBranchId, setUserBranchId] = useState(null);
  const [userRegionId, setUserRegionId] = useState(null);
   const [quickSearchTerm, setQuickSearchTerm] = useState("");
  const [userId, setUserId] = useState(null); //  Added userId state
  const [recentActivity, setRecentActivity] = useState([]);
  const navigate = useNavigate();

  const [dashboardMetrics, setDashboardMetrics] = useState({
    totalLoanAmount: 0,
    totalLoanCount: 0,
    outstandingBalance: 0,
    outstandingLoansCount: 0,
    performingLoanAmount: 0,
    performingLoansCount: 0,
    totalCustomers: 0,
    customerOverview: {
      activeCustomers: 0,
      inactiveCustomers: 0,
      newCustomersToday: 0,
      leadConversionRateMonth: 0,
      leadConversionRateYear: 0,
      totalThisMonth: 0,
      customersThisMonth: 0,
      totalThisYear: 0,
      customersThisYear: 0,
      leadsThisMonth: 0,
      leadsToday: 0,
    },
    loanOverview: {
      disbursedLoansAmount: 0,
      disbursedLoansCount: 0,
      loansDueToday: 0,
      outstandingArrears: 0,
      monthToDateArrears: 0,
      totalLoanArrears: 0,
      disbursedLoansToday: 0,
      disbursedLoansThisMonth: 0,
    },
    collectionOverview: {
      todayCollectionAmount: 0,
      todayCollectionRate: 0,
      tomorrowCollection: 0,
      monthlyCollectionAmount: 0,
      monthlyCollectionRate: 0,
      prepaymentAmount: 0,
      prepaymentRate: 0,
      par: 0,
       todayCollectionDue: 0,
    monthlyCollectionDue: 0,
    prepaymentDue: 0,
    },
    pendingActions: {
      pendingCustomerApprovals: 0,
      pendingAmends: 0,
      pendingLimitApprovals: 0,
      pendingBMLoanApprovals: 0,
      pendingRMLoanApprovals: 0,
      pendingDisbursement: 0,
    },
    cleanBookAmount: 0,
    cleanBookPercentage: 0,
  });

  const [customers, setCustomers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedRO, setSelectedRO] = useState("all");
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [availableROs, setAvailableROs] = useState([]);

  const fetchUserProfile = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;

      if (user) {
        const { data: userData, error: userDataError } = await supabase
          .from("users")
          .select("role, full_name")
          .eq("id", user.id)
          .single();

        if (userDataError) throw userDataError;

        const { data: profileData, error } = await supabase
          .from("profiles")
          .select(
            `
            region_id,
            branch_id,
            branches!inner(name),
            regions!inner(name)
          `
          )
          .eq("id", user.id)
          .single();

        if (error) throw error;

        setUserRole(userData?.role);
        setUserRegion(profileData?.regions?.name || profileData?.region_id);
        setUserBranch(profileData?.branches?.name || profileData?.branch_id);
        setUserBranchId(profileData?.branch_id);
        setUserRegionId(profileData?.region_id);
        setUserId(user.id); //  Store userId

        return {
          role: userData?.role,
          regionId: profileData?.region_id,
          branchId: profileData?.branch_id,
          regionName: profileData?.regions?.name,
          branchName: profileData?.branches?.name,
          id: user.id,
        };
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
    return null;
  };

  const fetchRegions = async () => {
    try {
      const { data, error } = await supabase
        .from("regions")
        .select("id, name, code")
        .order("name");

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching regions:", error);
      return [];
    }
  };

  const fetchBranches = async (regionFilter = "all") => {
    try {
      let query = supabase
        .from("branches")
        .select("id, name, code, address, region_id")
        .order("name");

      if (regionFilter !== "all") {
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
    branchFilter = "all",
    userRole = null,
    userBranchId = null,
    userRegionId = null
  ) => {
    try {
      let query = supabase
        .from("profiles")
        .select(
          `
          id,
          region_id,
          branch_id,
          users!inner(
            id,
            full_name,
            role
          )
        `
        )
        .eq("users.role", "relationship_officer")
        .order("users(full_name)");

      if (userRole === "branch_manager" && userBranchId) {
        query = query.eq("branch_id", userBranchId);
      } else if (userRole === "regional_manager") {
        if (branchFilter !== "all") {
          query = query.eq("branch_id", branchFilter);
        } else {
          query = query.eq("region_id", userRegionId);
        }
      } else if (branchFilter !== "all") {
        query = query.eq("branch_id", branchFilter);
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

// ---------- Date helpers (consistent, local YYYY-MM-DD) ----------

// Convert DB timestamp to YYYY-MM-DD in Africa/Nairobi timezone
const getLocalDateString = (dateString) => {
  const date = new Date(dateString);

  return date.toLocaleDateString("en-CA", {
    timeZone: "Africa/Nairobi", // forces Kenya timezone
  }); // returns YYYY-MM-DD
};

// Safe local YYYY-MM-DD formatter (NO UTC conversion)
const getLocalYYYYMMDD = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTodayDate = () => getLocalYYYYMMDD(new Date());

const getTomorrowDate = () => {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return getLocalYYYYMMDD(t);
};


const toLocalDateObject = (ts) => {
  if (!ts) return null;
  // Return a Date adjusted to local timezone
  const d = new Date(ts);
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs);
};

// simple "time ago" — expects a Date or timestamp string
const getTimeAgo = (date) => {
  const dt = date instanceof Date ? date : new Date(date);
  const diff = Date.now() - dt.getTime();
  if (diff < 0) return "Just now";

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;

  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

  const days = Math.floor(diff / 86400000);
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

// ---------- Recent Activities ----------
const fetchRecentActivities = async (profile) => {
  try {
    const { role, regionId, branchId, id } = profile;

    let loansQuery = supabase
      .from("loans")
      .select(
        `id, scored_amount, status, created_at, disbursed_date, booked_by, region_id, branch_id, customers!inner(Firstname, Surname)`
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (role === "relationship_officer") loansQuery = loansQuery.eq("booked_by", id);
    else if (role === "branch_manager") loansQuery = loansQuery.eq("branch_id", branchId);
    else if (role === "regional_manager") loansQuery = loansQuery.eq("region_id", regionId);

    const { data: recentLoans, error } = await loansQuery;
    if (error) throw error;
    if (!recentLoans?.length) return [];

    return recentLoans.map((loan) => {
      const customerName = loan.customers ? `${loan.customers.Firstname} ${loan.customers.Surname}` : "Customer";
      const timeAgo = getTimeAgo(new Date(loan.created_at));

      let message = `New loan application from ${customerName}`;
      let iconBg = "bg-amber-100";
      let icon = (
        <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );

      if (loan.status === "disbursed") {
        message = `Loan disbursed to ${customerName}`;
        iconBg = "bg-green-100";
        icon = (
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      } else if (loan.status === "approved") {
        message = `Loan approved for ${customerName}`;
        iconBg = "bg-blue-100";
        icon = (
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      }

      return {
        id: loan.id,
        message,
        time: timeAgo,
        amount: `Ksh ${Number(loan.scored_amount || 0).toLocaleString()}`,
        icon,
        iconBg,
      };
    });
  } catch (error) {
    console.error("Error fetching recent activities:", error);
    return [];
  }
};

// ---------- Total paid amount (installments) ----------
const fetchTotalPaidAmount = async (loanIds) => {
  if (!Array.isArray(loanIds) || loanIds.length === 0) return 0;
  try {
    const { data, error } = await supabase
      .from("loan_installments")
      .select("interest_paid, principal_paid, loan_id")
      .in("loan_id", loanIds);

    if (error) throw error;
    if (!data?.length) return 0;

    return data.reduce((sum, inst) => {
      const interest = parseFloat(inst.interest_paid) || 0;
      const principal = parseFloat(inst.principal_paid) || 0;
      return sum + interest + principal;
    }, 0);
  } catch (err) {
    console.error("Error fetching paid amounts:", err);
    return 0;
  }
};





// ---------- Today's collection ----------
const fetchTodaysCollection = async (loanIds) => {
  if (!Array.isArray(loanIds) || loanIds.length === 0) {
    console.log("No loan IDs provided for today's collection");
    return { amount: 0, paid: 0, due: 0, rate: 0 };
  }

  try {
    const today = getLocalYYYYMMDD(new Date());
    console.log("Fetching today's collection for date:", today);

    const { data: paymentsData, error: paymentsError } = await supabase
      .from("loan_installments")
      .select("interest_paid, principal_paid, paid_date, status")
      .in("loan_id", loanIds)
      .in("status", ["paid", "partial"])
      .eq("paid_date", today);

    if (paymentsError) throw paymentsError;

    const { data: dueData, error: dueError } = await supabase
      .from("loan_installments")
      .select("due_amount, due_date, status")
      .in("loan_id", loanIds)
      .eq("due_date", today)
      .in("status", ["pending", "overdue", "partial"]);

    if (dueError) throw dueError;

    const paid = (paymentsData || []).reduce(
      (sum, r) => sum + (parseFloat(r.interest_paid) || 0) + (parseFloat(r.principal_paid) || 0),
      0
    );

    const due = (dueData || []).reduce(
      (sum, r) => sum + (parseFloat(r.due_amount) || 0),
      0
    );

    const rate = due > 0 ? Math.round((paid / due) * 100) : 0;

    console.log(`Today Collection - Paid: ${paid}, Due: ${due}, Rate: ${rate}%`);

    return { amount: paid, paid, due, rate };
  } catch (err) {
    console.error("Error fetching today's collection:", err);
    return { amount: 0, paid: 0, due: 0, rate: 0 };
  }
};


// ---------- Monthly collection ----------
const fetchMonthlyCollection = async (loanIds) => {
  if (!Array.isArray(loanIds) || loanIds.length === 0) {
    console.log("No loan IDs provided for monthly collection");
    return { amount: 0, paid: 0, due: 0, rate: 0 };
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

    console.log("Fetching monthly collection from", startOfMonth, "to", endOfMonth);

    // Get payments made this month (collected amount)
    const { data: paymentsData, error: paymentsError } = await supabase
      .from("loan_installments")
      .select("interest_paid, principal_paid, paid_date, status")
      .in("loan_id", loanIds)
      .in("status", ["paid", "partial"])
      .gte("paid_date", startOfMonth)
      .lte("paid_date", endOfMonth);

    if (paymentsError) throw paymentsError;

    // Get installments due this month (expected amount)
    const { data: dueData, error: dueError } = await supabase
      .from("loan_installments")
      .select("due_amount, due_date, status")
      .in("loan_id", loanIds)
      .gte("due_date", startOfMonth)
      .lte("due_date", endOfMonth)
      .in("status", ["pending", "overdue", "partial", "paid"]); // Include all statuses for total due amount

    if (dueError) throw dueError;

    const paid = (paymentsData || []).reduce(
      (sum, r) => sum + (parseFloat(r.interest_paid) || 0) + (parseFloat(r.principal_paid) || 0),
      0
    );

    const due = (dueData || []).reduce(
      (sum, r) => sum + (parseFloat(r.due_amount) || 0),
      0
    );

    const rate = due > 0 ? Math.round((paid / due) * 100) : 0;

    console.log(`Monthly Collection - Paid: ${paid}, Due: ${due}, Rate: ${rate}%`);

    return { amount: paid, paid, due, rate };
  } catch (err) {
    console.error("Error fetching monthly collection:", err);
    return { amount: 0, paid: 0, due: 0, rate: 0 };
  }
};

// ---------- Prepayment / tomorrow collection ----------
const fetchPrepaymentData = async (loanIds) => {
  if (!Array.isArray(loanIds) || loanIds.length === 0) {
    console.log("No loan IDs provided for prepayment data");
    return { prepaymentAmount: 0, prepaymentRate: 0, totalDueTomorrow: 0 };
  }

  try {
    const tomorrow = getTomorrowDate();
    const today = getTodayDate();

    console.log("Fetching tomorrow's collection for date:", tomorrow);

    // Get tomorrow's due installments
    const { data: tomorrowInstallments, error: instError } = await supabase
      .from("loan_installments")
      .select("due_amount, loan_id, due_date, status")
      .in("loan_id", loanIds)
      .eq("due_date", tomorrow);

    if (instError) throw instError;
    
    const tomorrowRows = tomorrowInstallments || [];
    const totalDueTomorrow = tomorrowRows.reduce((s, r) => s + (parseFloat(r.due_amount) || 0), 0);

    // Get payments made today for tomorrow's installments (prepayments)
    const { data: prepayments, error: prepayError } = await supabase
      .from("loan_installments")
      .select("interest_paid, principal_paid, due_date, paid_date")
      .in("loan_id", loanIds)
      .eq("paid_date", today)
      .eq("due_date", tomorrow);

    if (prepayError) throw prepayError;
    
    const prepayRows = prepayments || [];
    const prepaymentAmount = prepayRows.reduce(
      (s, r) => s + (parseFloat(r.interest_paid) || 0) + (parseFloat(r.principal_paid) || 0),
      0
    );

    const prepaymentRate = totalDueTomorrow > 0 ? Math.round((prepaymentAmount / totalDueTomorrow) * 100) : 0;

    console.log(`Prepayment - Tomorrow Due: ${totalDueTomorrow}, Prepaid Today: ${prepaymentAmount}, Rate: ${prepaymentRate}%`);

    return { prepaymentAmount, prepaymentRate, totalDueTomorrow };
  } catch (err) {
    console.error("Error in fetchPrepaymentData:", err);
    return { prepaymentAmount: 0, prepaymentRate: 0, totalDueTomorrow: 0 };
  }
};

const fetchLeadsConversionRate = async (
  regionId,
  branchId,
  role,
  userId,
  selectedRegion = "all",
  selectedBranch = "all",
  selectedRO = "all"
) => {
  try {
    const applyFilters = (query) => {
      if (role === "branch_manager") query = query.eq("branch_id", branchId);

      else if (role === "regional_manager") {
        if (selectedRegion !== "all") query = query.eq("region_id", selectedRegion);
        if (selectedBranch !== "all") query = query.eq("branch_id", selectedBranch);
      }

      else if (role === "relationship_officer") query = query.eq("created_by", userId);

      else if (["credit_analyst_officer", "customer_service_officer"].includes(role)) {
        if (selectedRegion !== "all") query = query.eq("region_id", selectedRegion);
        if (selectedBranch !== "all") query = query.eq("branch_id", selectedBranch);
        if (selectedRO !== "all") query = query.eq("created_by", selectedRO);
      }

      return query;
    };

    // --- Date boundaries ---
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // --- Fetch LEADS only ---
    const { data: leads = [], error: leadsError } = await applyFilters(
      supabase.from("leads").select("id, created_at")
    );
    if (leadsError) throw leadsError;

    // --- Fetch CUSTOMERS only ---
    let customersQuery = applyFilters(
      supabase.from("customers").select("id, created_at, lead_id, form_status")
    );

    customersQuery = customersQuery.neq("form_status", "draft");

    const { data: customers = [], error: customersError } = await customersQuery;
    if (customersError) throw customersError;

    const toLocal = (x) => (x ? toLocalDateObject(x) : null);

    const countSince = (items, cutoff) =>
      items.filter((i) => {
        const d = toLocal(i.created_at);
        return d && d >= cutoff;
      }).length;

    // 1️⃣ Raw leads (new leads)
    const leadsToday = countSince(leads, today);
    const leadsThisMonth = countSince(leads, startOfMonth);
    const leadsThisYear = countSince(leads, startOfYear);

    // 2️⃣ Converted customers (only those linked to a lead)
    const converted = customers.filter((c) => c.lead_id !== null);

    const convertedToday = countSince(converted, today);
    const convertedThisMonth = countSince(converted, startOfMonth);
    const convertedThisYear = countSince(converted, startOfYear);

    // 3️⃣ Direct customers (walk-ins)
    const directCustomers = customers.filter((c) => c.lead_id === null);

    const directToday = countSince(directCustomers, today);
    const directThisMonth = countSince(directCustomers, startOfMonth);

    // ---- REAL METRICS ----
    const totalLeads = leads.length;               // only leads
    const convertedLeads = converted.length;       // only leads that became customers

    const conversionRate =
      totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

    const conversionRateMonth =
      leadsThisMonth > 0
        ? Math.round((convertedThisMonth / leadsThisMonth) * 100)
        : 0;

    const conversionRateYear =
      leadsThisYear > 0
        ? Math.round((convertedThisYear / leadsThisYear) * 100)
        : 0;

    return {
      // Raw
      totalLeads,
      convertedLeads,

      // Conversion %
      conversionRate,
      conversionRateMonth,
      conversionRateYear,

      // Daily + Monthly granular
      leadsToday,
      leadsThisMonth,
      convertedToday,
      convertedThisMonth,

      // Direct customers (not counted in conversion)
      customersToday: directToday,
      customersThisMonth: directThisMonth,
    };
  } catch (err) {
    console.error("Error fetching leads conversion rate:", err);
    return {
      totalLeads: 0,
      convertedLeads: 0,
      conversionRate: 0,
      conversionRateMonth: 0,
      conversionRateYear: 0,
      leadsToday: 0,
      leadsThisMonth: 0,
      convertedToday: 0,
      convertedThisMonth: 0,
      customersToday: 0,
      customersThisMonth: 0,
    };
  }
};


// ---------- Performing loans helpers ----------
const fetchPerformingLoans = async (loansData) => {
  if (!Array.isArray(loansData) || loansData.length === 0) return [];

  try {
    const disbursedLoans = loansData.filter(
      (l) => l.status === "disbursed" && l.repayment_state !== "completed"
    );

    const loanIds = disbursedLoans.map((l) => l.id);
    if (loanIds.length === 0) return [];

    const { data: installments = [], error } = await supabase
      .from("loan_installments")
      .select("*")
      .in("loan_id", loanIds);

    if (error) throw error;

    const today = new Date().toISOString().split("T")[0]; // yyyy-mm-dd

    // Group by loan
    const grouped = installments.reduce((acc, inst) => {
      acc[inst.loan_id] = acc[inst.loan_id] || [];
      acc[inst.loan_id].push(inst);
      return acc;
    }, {});

    const performingLoans = disbursedLoans.filter((loan) => {
      const insts = grouped[loan.id] || [];

      // Loan with no installments yet = performing
      if (insts.length === 0) return true;

      return insts.every((inst) => {
        const dueDate = inst.due_date;

        // ➤ Ignore future installments
        if (!dueDate || dueDate > today) {
          return true;
        }

        // ➤ Installments due on or before today MUST be fully paid
        const isDue = dueDate <= today;

        // Automatic non-performing conditions
        if (inst.status === "overdue") return false;
        if (inst.status === "defaulted") return false;
        if (inst.days_overdue > 0) return false;

        const dueAmount = parseFloat(inst.due_amount) || 0;
        const paidAmount =
          (parseFloat(inst.principal_paid) || 0) +
          (parseFloat(inst.interest_paid) || 0);

        // ➤ RULE:
        // If installment is due:
        //   It is performing only if fully paid (paidAmount >= dueAmount)
        if (isDue) {
          return paidAmount >= dueAmount;
        }

        // ➤ If installment is not yet due, allow partial or pending
        return true;
      });
    });

    return performingLoans;
  } catch (err) {
    console.error("Error fetching performing loans:", err);
    return [];
  }
};



const fetchPerformingLoansPaidAmount = async (performingLoanIds) => {
  if (!Array.isArray(performingLoanIds) || performingLoanIds.length === 0) return 0;
  try {
    const { data = [], error } = await supabase
      .from("loan_installments")
      .select("interest_paid, principal_paid, loan_id")
      .in("loan_id", performingLoanIds);
    if (error) throw error;
    return data.reduce((sum, inst) => sum + (parseFloat(inst.interest_paid) || 0) + (parseFloat(inst.principal_paid) || 0), 0);
  } catch (err) {
    console.error("Error fetching performing loans paid amounts:", err);
    return 0;
  }
};


  /**
 * Calculate Month-to-Date Arrears
 * Definition: Total unpaid dues from installments that became overdue THIS MONTH
 */

  const fetchMonthToDateArrears = async (loanIds) => {
    if (!loanIds || loanIds.length === 0) return 0;

    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      const today = now.toISOString().split("T")[0];

      const { data: overdueInstallments, error } = await supabase
        .from("loan_installments")
        .select("due_amount, interest_paid, principal_paid, due_date, status")
        .in("loan_id", loanIds)
        .eq("status", "overdue")
        .gte("due_date", startOfMonth)
        .lte("due_date", today);

      if (error) throw error;

      const monthToDateArrears = overdueInstallments?.reduce((sum, inst) => {
        const dueAmount = parseFloat(inst.due_amount) || 0;
        const paidAmount = (parseFloat(inst.interest_paid) || 0) + (parseFloat(inst.principal_paid) || 0);
        const arrears = dueAmount - paidAmount;
        return sum + (arrears > 0 ? arrears : 0);
      }, 0) || 0;

      return monthToDateArrears;
    } catch (error) {
      console.error("Error fetching month-to-date arrears:", error);
      return 0;
    }
  };



/**
 * Calculate Total Arrears (All Time)
 * Definition: Total unpaid dues from ALL overdue installments (current + past months)
 */

  const calculatePAR = (totalArrears, outstandingBalance) => {
    if (!outstandingBalance || outstandingBalance === 0) return 0;
    return Math.round((totalArrears / outstandingBalance) * 100);
  };

  const fetchTotalArrears = async (loanIds) => {
    if (!loanIds || loanIds.length === 0) return 0;

    try {
      const today = new Date().toISOString().split("T")[0];

      const { data: overdueInstallments, error } = await supabase
        .from("loan_installments")
        .select("due_amount, interest_paid, principal_paid, status, due_date")
        .in("loan_id", loanIds)
        .in("status", ["overdue", "partial"])
        .lte("due_date", today);

      if (error) throw error;

      const totalArrears = overdueInstallments?.reduce((sum, inst) => {
        const dueAmount = parseFloat(inst.due_amount) || 0;
        const paidAmount = (parseFloat(inst.interest_paid) || 0) + (parseFloat(inst.principal_paid) || 0);
        const arrears = dueAmount - paidAmount;
        return sum + (arrears > 0 ? arrears : 0);
      }, 0) || 0;

      return totalArrears;
    } catch (error) {
      console.error("Error fetching total arrears:", error);
      return 0;
    }
  };

  const fetchOutstandingArrears = async (loanIds) => {
    return await fetchTotalArrears(loanIds);
  };


  

// Convert DB timestamp to a LOCAL Date object
const toLocalDate = (dateString) => {
  if (!dateString) return null;
  return new Date(dateString); // JS automatically adjusts timezone to local
};

// Extract YYYY-MM-DD in LOCAL timezone
const toLocalYYYYMMDD = (dateString) => {
  const d = new Date(dateString);
  if (!d) return null;

  // Extract LOCAL date parts, DO NOT use toISOString()
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};


const fetchDisbursedLoansData = async (filteredLoans) => {
  try {
    const now = new Date();

    // Local Kenya date
    const todayLocal = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
const todayString = toLocalYYYYMMDD(todayLocal);

    // Start of month local
    const startOfMonthLocal = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    // --- FILTER DISBURSED TODAY ---
    const disbursedLoansToday = filteredLoans.filter((loan) => {
      if (loan.status !== "disbursed" || !loan.disbursed_at) return false;

      const disbursedDateLocal = toLocalYYYYMMDD(loan.disbursed_at);
      return disbursedDateLocal === todayString;
    });

    // --- FILTER DISBURSED THIS MONTH ---
    const disbursedLoansThisMonth = filteredLoans.filter((loan) => {
      if (loan.status !== "disbursed" || !loan.disbursed_at) return false;

      const d = toLocalDate(loan.disbursed_at);
      return d >= startOfMonthLocal;
    });

    // SUM AMOUNTS
    const disbursedAmountToday = disbursedLoansToday.reduce(
      (sum, loan) => sum + (Number(loan.scored_amount) || 0),
      0
    );

    const disbursedAmountThisMonth = disbursedLoansThisMonth.reduce(
      (sum, loan) => sum + (Number(loan.scored_amount) || 0),
      0
    );

    console.log(
      "▶ FIXED Disbursement Metrics:",
      {
        today: disbursedLoansToday.length,
        month: disbursedLoansThisMonth.length,
        amountToday: disbursedAmountToday,
        amountMonth: disbursedAmountThisMonth,
      }
    );

    return {
      disbursedLoansToday: disbursedLoansToday.length,
      disbursedLoansThisMonth: disbursedLoansThisMonth.length,
      disbursedAmountToday,
      disbursedAmountThisMonth,
    };
  } catch (err) {
    console.error("Error computing disbursed loan metrics:", err);
    return {
      disbursedLoansToday: 0,
      disbursedLoansThisMonth: 0,
      disbursedAmountToday: 0,
      disbursedAmountThisMonth: 0,
    };
  }
};




 const calculateDashboardMetrics = async (
    loansData,
    customersData,
    profile
  ) => {
    const { role, branchId, regionId, id } = profile;

    let filteredLoans = loansData;
    let filteredCustomers = customersData;

    if (role === "relationship_officer") {
      filteredCustomers = customersData.filter(
        (customer) => customer.created_by === id
      );
      const customerIds = filteredCustomers.map((c) => c.id);
      filteredLoans = loansData.filter(
        (loan) => loan.booked_by === id || customerIds.includes(loan.customer_id)
      );
    } else if (role === "branch_manager") {
      filteredLoans = loansData.filter((loan) => loan.branch_id === branchId);
      filteredCustomers = customersData.filter(
        (customer) => customer.branch_id === branchId
      );

      if (selectedRO !== "all") {
        filteredCustomers = filteredCustomers.filter(
          (customer) => customer.created_by === selectedRO
        );
        const customerIds = filteredCustomers.map((c) => c.id);
        filteredLoans = filteredLoans.filter(
          (loan) =>
            loan.booked_by === selectedRO ||
            customerIds.includes(loan.customer_id)
        );
      }
    } else if (role === "regional_manager") {
      filteredLoans = loansData.filter((loan) => loan.region_id === regionId);
      filteredCustomers = customersData.filter(
        (customer) => customer.region_id === regionId
      );

      if (selectedBranch !== "all") {
        filteredLoans = filteredLoans.filter(
          (loan) => loan.branch_id === selectedBranch
        );
        filteredCustomers = filteredCustomers.filter(
          (customer) => customer.branch_id === selectedBranch
        );
      }

      if (selectedRO !== "all") {
        filteredCustomers = filteredCustomers.filter(
          (customer) => customer.created_by === selectedRO
        );
        const customerIds = filteredCustomers.map((c) => c.id);
        filteredLoans = filteredLoans.filter(
          (loan) =>
            loan.booked_by === selectedRO ||
            customerIds.includes(loan.customer_id)
        );
      }
    } else if (
      role === "credit_analyst_officer" ||
      role === "customer_service_officer"
    ) {
      if (selectedRegion !== "all") {
        filteredLoans = filteredLoans.filter(
          (loan) => loan.region_id === selectedRegion
        );
        filteredCustomers = filteredCustomers.filter(
          (customer) => customer.region_id === selectedRegion
        );
      }

      if (selectedBranch !== "all") {
        filteredLoans = filteredLoans.filter(
          (loan) => loan.branch_id === selectedBranch
        );
        filteredCustomers = filteredCustomers.filter(
          (customer) => customer.branch_id === selectedBranch
        );
      }

      if (selectedRO !== "all") {
        filteredCustomers = filteredCustomers.filter(
          (customer) => customer.created_by === selectedRO
        );
        const customerIds = filteredCustomers.map((c) => c.id);
        filteredLoans = filteredLoans.filter(
          (loan) =>
            loan.booked_by === selectedRO ||
            customerIds.includes(loan.customer_id)
        );
      }
    }

    const disbursedLoans = filteredLoans.filter(
      (loan) => loan.status === "disbursed"
    );

    const outstandingLoans = disbursedLoans.filter(
      (loan) => loan.repayment_state !== "completed"
    );

    const performingLoans = await fetchPerformingLoans(filteredLoans);

    const loanIds = disbursedLoans.map((loan) => loan.id);
    const totalPaidAmount = await fetchTotalPaidAmount(loanIds);
    const prepaymentData = await fetchPrepaymentData(loanIds);
    const todaysCollection = await fetchTodaysCollection(loanIds);
    const monthlyCollection = await fetchMonthlyCollection(loanIds);
    const disbursedLoansData = await fetchDisbursedLoansData(filteredLoans);

    const totalLoanAmount = disbursedLoans.reduce(
      (sum, loan) => sum + (loan.total_payable || loan.scored_amount || 0),
      0
    );

    const outstandingBalance = totalLoanAmount - totalPaidAmount;

    const performingLoanIds = performingLoans.map((loan) => loan.id);
    const performingLoanTotalPayable = performingLoans.reduce(
      (sum, loan) => sum + (loan.total_payable || loan.scored_amount || 0),
      0
    );
    const performingLoansPaid = await fetchPerformingLoansPaidAmount(
      performingLoanIds
    );
    const performingLoanBalance =
      performingLoanTotalPayable - performingLoansPaid;

    const monthToDateArrears = await fetchMonthToDateArrears(loanIds);
    const totalArrears = await fetchTotalArrears(loanIds);
    const outstandingArrears = await fetchOutstandingArrears(loanIds);
    const par = calculatePAR(totalArrears, outstandingBalance);

    const activeCustomerIds = new Set();
    disbursedLoans.forEach((loan) => {
      if (loan.repayment_state?.toLowerCase() !== "completed") {
        activeCustomerIds.add(loan.customer_id);
      }
    });

    const activeCustomers = activeCustomerIds.size;
    const inactiveCustomers = filteredCustomers.length - activeCustomers;

    const today = getTodayDate();
    const newCustomersToday = filteredCustomers.filter(
      (c) => c.created_at && getLocalDateString(new Date(c.created_at)) === today
    ).length;

    const leadConversionRate = await fetchLeadsConversionRate(
      regionId,
      branchId,
      role,
      profile?.id,
      selectedRegion,
      selectedBranch,
      selectedRO
    );

    const disbursedLoansAmount = disbursedLoans.reduce(
      (sum, loan) => sum + (loan.scored_amount || 0),
      0
    );

    const cleanBookAmount = performingLoanTotalPayable - performingLoansPaid;
    const cleanBookPercentage =
      outstandingBalance > 0
        ? Math.round((cleanBookAmount / outstandingBalance) * 100)
        : 0;

    const pendingCustomerApprovals = filteredCustomers.filter((c) =>
      ["pending", "bm_review", "ca_review", "cso_review"].includes(c.status)
    ).length;

    const pendingBMLoanApprovals = filteredLoans.filter(
      (l) => l.status === "bm_review"
    ).length;
    const pendingRMLoanApprovals = filteredLoans.filter(
      (l) => l.status === "rm_review"
    ).length;
    const pendingDisbursement = filteredLoans.filter(
      (l) => l.status === "approved" && !l.disbursed_date
    ).length;

    return {
      totalLoanAmount,
      totalLoanCount: disbursedLoans.length,
      outstandingBalance,
      outstandingLoansCount: outstandingLoans.length,
      performingLoanBalance,
      performingLoanAmount: performingLoanTotalPayable,
      performingLoansCount: performingLoans.length,
      totalCustomers: filteredCustomers.length,
      cleanBookAmount,
      cleanBookPercentage,
      customerOverview: {
        activeCustomers,
        inactiveCustomers,
        newCustomersToday,
        leadConversionRateMonth: leadConversionRate.conversionRateMonth,
        leadConversionRateYear: leadConversionRate.conversionRateYear,
        totalThisMonth: leadConversionRate.totalThisMonth,
        customersThisMonth: leadConversionRate.customersThisMonth,
        totalThisYear: leadConversionRate.totalThisYear,
        customersThisYear: leadConversionRate.customersThisYear,
        leadsThisMonth: leadConversionRate.leadsThisMonth,
        leadsToday: leadConversionRate.leadsToday,
      },
      loanOverview: {
        disbursedLoansAmount,
        disbursedLoansCount: disbursedLoans.length,
        loansDueToday: disbursedLoans.filter((l) => l.due_date === today).length,
        outstandingArrears,           
        monthToDateArrears,           
        totalLoanArrears: totalArrears,
        disbursedLoansToday: disbursedLoansData.disbursedLoansToday,
        disbursedLoansThisMonth: disbursedLoansData.disbursedLoansThisMonth,
        disbursedAmountToday: disbursedLoansData.disbursedAmountToday,
        disbursedAmountThisMonth: disbursedLoansData.disbursedAmountThisMonth,
      },
      collectionOverview: {
        todayCollectionDue: todaysCollection.due,
        monthlyCollectionDue: monthlyCollection.due,
        prepaymentDue: prepaymentData.totalDueTomorrow,
        tomorrowCollection: prepaymentData.prepaymentAmount,
        todayCollectionAmount: todaysCollection.amount,
        todayCollectionRate: todaysCollection.rate,
        monthlyCollectionAmount: monthlyCollection.amount,
        monthlyCollectionRate: monthlyCollection.rate,
        prepaymentAmount: prepaymentData.prepaymentAmount,
        prepaymentRate: prepaymentData.prepaymentRate,
        par,
      },
      pendingActions: {
        pendingCustomerApprovals,
        pendingAmends: filteredCustomers.filter((c) =>
          c.status?.includes("amend")
        ).length,
        pendingLimitApprovals: 0,
        pendingBMLoanApprovals,
        pendingRMLoanApprovals,
        pendingDisbursement,
      },
    };
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const profile = await fetchUserProfile();
      if (!profile) return setLoading(false);

      const { role, regionId, branchId, id } = profile;

      if (
        role === "credit_analyst_officer" ||
        role === "customer_service_officer"
      ) {
        const regionsData = await fetchRegions();
        setAvailableRegions(regionsData);
      }

      let branchesData = [];
      if (role !== "relationship_officer") {
        if (role === "regional_manager") {
          branchesData = await fetchBranches(regionId);
        } else {
          branchesData = await fetchBranches("all");
        }
        setAvailableBranches(branchesData);
      }

      if (role !== "relationship_officer") {
        const relationshipOfficers = await fetchRelationshipOfficers(
          "all",
          role,
          branchId,
          regionId
        );
        setAvailableROs([
          { id: "all", full_name: "All ROs" },
          ...relationshipOfficers,
        ]);
      }

      let customersQuery = supabase
        .from("customers")
        .select("*, form_status")
        .neq("form_status", "draft");

      let loansQuery = supabase.from("loans").select("*");

      if (role === "relationship_officer") {
        customersQuery = customersQuery.eq("created_by", id);
        loansQuery = loansQuery.eq("booked_by", id);
      } else if (role === "branch_manager") {
        customersQuery = customersQuery.eq("branch_id", branchId);
        loansQuery = loansQuery.eq("branch_id", branchId);
      } else if (role === "regional_manager") {
        customersQuery = customersQuery.eq("region_id", regionId);
        loansQuery = loansQuery.eq("region_id", regionId);
      }

      const [{ data: customersData }, { data: loansData }] = await Promise.all([
        customersQuery,
        loansQuery,
      ]);

      setCustomers(customersData || []);
      setLoans(loansData || []);

      const metrics = await calculateDashboardMetrics(
        loansData || [],
        customersData || [],
        profile
      );
      setDashboardMetrics(metrics);

      const activities = await fetchRecentActivities(profile);
      setRecentActivity(activities);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };


    // Quick search filter (separate from main search)
  const quickSearchResults = customers.filter((c) => {
    if (!quickSearchTerm) return false;
    return (
      (c.Firstname || "").toLowerCase().includes(quickSearchTerm.toLowerCase()) ||
      (c.Surname || "").toLowerCase().includes(quickSearchTerm.toLowerCase()) ||
      (c.mobile || "").toString().includes(quickSearchTerm) ||
      (c.id_number || "").toString().includes(quickSearchTerm)
    );
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (userRole && loans.length > 0 && customers.length > 0) {
      const profile = {
        role: userRole,
        regionId: userRegionId,
        branchId: userBranchId,
        id: userId, // ✅ Pass userId
      };
      calculateDashboardMetrics(loans, customers, profile).then(
        setDashboardMetrics
      );
    }
  }, [
    selectedRegion,
    selectedBranch,
    selectedRO,
    userRole,
    loans,
    customers,
    userRegionId,
    userBranchId,
    userId, //  Add userId dependency
  ]);

  useEffect(() => {
    if (
      selectedRegion !== "all" &&
      (userRole === "credit_analyst_officer" ||
        userRole === "customer_service_officer")
    ) {
      fetchBranches(selectedRegion).then((branches) => {
        setAvailableBranches(branches);
        setSelectedBranch("all");
        setSelectedRO("all");
      });
    }
  }, [selectedRegion, userRole]);

  useEffect(() => {
    if (
      selectedBranch &&
      (userRole === "credit_analyst_officer" ||
        userRole === "customer_service_officer" ||
        userRole === "regional_manager")
    ) {
      fetchRelationshipOfficers(
        selectedBranch,
        userRole,
        userBranchId,
        userRegionId
      ).then((ros) => {
        setAvailableROs([{ id: "all", full_name: "All ROs" }, ...ros]);
      });
      setSelectedRO("all");
    }
  }, [selectedBranch, userRole, userBranchId, userRegionId]);
  

  const handleViewCustomers = () => navigate("/registry/customers");
  const handleViewLoans = () => navigate("/loaning/all");
  const handlePendingBMLoans = () =>
    navigate("/loaning/pending-branch-manager");
  const handlePendingRMLoans = () =>
    navigate("/loaning/pending-regional-manager");
  const handlePendingDisbursement = () =>
    navigate("/loaning/pending-disbursement");
  const handleCustomerApprovals = () => navigate("/registry/approvals-pending");
  const handlePendingAmendments = () =>
    navigate("/registry/pending-amendments");

    const handleOpen360View = (customer) => {
    navigate(`/customer/${customer.id}/360`);
    setQuickSearchTerm(""); // Clear search when opening
  };

 
  const IconStatCard = ({
    icon,
    value,
    label,
    subtitle,
    trend,
     percentage,
    color = "#586ab1",
    backgroundImage = "",
    onClick,
  }) => {
    return (
      <div
        className="relative rounded-xl shadow-lg p-4 sm:p-6 text-white hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer border border-white/20 overflow-hidden min-h-[140px] sm:min-h-[160px] flex-1"
        onClick={onClick}
      >
        {/* Background Image with reduced opacity */}
        {backgroundImage && (
          <div
            className="absolute inset-0 bg-cover bg-center z-0 opacity-70"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          >
            {/* Overlay color tint */}
            <div
              className="absolute inset-0 mix-blend-multiply"
              style={{ backgroundColor: color, opacity: 0.8 }}
            ></div>
          </div>
        )}

        {/* Blur + Dark Layer (for readability) */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] z-0"></div>

          {/* Clean Book Percentage (Top Right Corner) */}
      {percentage !== undefined && (
        <div className="absolute top-3 right-4 z-20 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold text-white shadow-md border border-white/30">
          {percentage}% 
        </div>
      )}

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-center">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <div className="p-2 bg-white/20 rounded-lg mr-3">
                  {icon}
                </div>
                <p className="text-sm font-semibold text-white/90 uppercase tracking-wider">
                  {label}
                </p>
              </div>
              <p className="text-2xl sm:text-xl lg:text-3xl font-bold tracking-tight mb-1">
                {value}
              </p>
              {subtitle && (
                <p className="text-white/80 text-xs sm:text-sm font-medium">
                  {subtitle}
                </p>
              )}
              {trend && (
                <div className="flex items-center mt-2 sm:mt-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-bold ${
                      trend.direction === "up"
                        ? "bg-green-500/20 text-green-100"
                        : "bg-red-500/20 text-red-100"
                    }`}
                  >
                    {trend.direction === "up" ? "↗" : "↘"} {trend.value}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };



  const ConversionRateCard = ({ percentage, label, total, converted, period, backgroundImage = "" }) => {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
        {/* Background Image */}
        {backgroundImage && (
          <div 
            className="absolute inset-0 bg-cover bg-center z-0"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          >
            <div className="absolute inset-0 bg-white/90 backdrop-blur-[1px]"></div>
          </div>
        )}
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              {/* <div className="p-2 bg-amber-100 rounded-lg mr-3">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div> */}
              <span className="text-sm font-semibold text-gray-700">{label}</span>
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {period}
            </span>
          </div>
          
          <div className="text-center mt-2 ">
            <p className="text-lg font-semibold text-slate-600">{percentage}%</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 text-sm">Converted</span>
              <span className="font-semibold text-gray-800 text-sm">{converted}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 text-sm">Total Leads</span>
              <span className="font-semibold text-gray-800 text-sm">{total}</span>
            </div>
          </div>

          <div className="mt-4 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced OverviewSection with better typography
   const OverviewSection = ({ title, children, onViewAll, backgroundImage = "" }) => (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 hover:shadow-xl transition-shadow duration-300 relative overflow-hidden mb-6">
      {/* Background Image */}
      {backgroundImage && (
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        >
<div className="absolute inset-0 bg-white/80 backdrop-blur-[1px]"></div>

        </div>
      )}
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h3 className="text sm:text  text-slate-600 flex items-center">
            {title}
          </h3>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="flex items-center text-slate-600 hover:text-slate-700 font-semibold text-sm transition duration-200 group"
            >
              View All
              <svg
                className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );


const ProgressBar = ({
  label,
  value,
  type,
  numerator,
  denominator,
}) => {
  const percentage = denominator ? Math.round((numerator / denominator) * 100) : value;

  const getColor = () => {
    if (type === "collection") {
      if (percentage >= 80) return "green";
      if (percentage >= 60) return "blue";
      if (percentage >= 40) return "yellow";
      return "red";
    }
    if (type === "par") {
      if (percentage <= 20) return "green";
      if (percentage <= 40) return "yellow";
      return "red";
    }
    return "gray";
  };

  const color = getColor();

  const gradientMap = {
    green: "from-green-500 to-emerald-600",
    blue: "from-blue-500 to-cyan-600",
    yellow: "from-yellow-500 to-amber-500",
    red: "from-red-500 to-rose-600",
    gray: "from-gray-400 to-gray-500"
  };

  const getStatus = () => {
    if (type === "collection") {
      if (percentage >= 80) return "Excellent";
      if (percentage >= 60) return "Good";
      if (percentage >= 40) return "Fair";
      return "Poor";
    }
    if (type === "par") {
      if (percentage <= 20) return "Excellent";
      if (percentage <= 40) return "Good";
      if (percentage <= 60) return "Fair";
      return "Poor";
    }
    return "";
  };

  const formatNumber = (num, isCurrency = true) => {
    if (isCurrency) {
      return num?.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
    return num?.toLocaleString("en-US");
  };

  return (
    <div
      className="relative p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 flex flex-col gap-4"
      style={{
        backgroundImage: "url('/bg1.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      <div className="absolute inset-0 bg-black/10 rounded-2xl"></div>

      <div className="relative z-10 flex flex-col gap-4">

        {/* Numerator / Denominator */}
        <div className="flex items-end gap-1 leading-tight">
          <span className="text-lg font-extrabold text-slate-600">
            {formatNumber(numerator)}
          </span>
          <span className="text-xs text-gray-700 font-medium">
            /{formatNumber(denominator)}
          </span>
        </div>

        {/* Label */}
        <p className="text-gray-800 font-semibold text-sm tracking-tight">
          {label}
        </p>

        {/* Progress Bar */}
        <div className="relative bg-white rounded-full h-3 mt-6 overflow-hidden">
          <div
            className={`absolute top-0 left-0 h-full bg-gradient-to-r ${gradientMap[color]} rounded-full transition-all duration-700`}
            style={{ width: `${Math.max(Math.min(percentage, 100), 4)}px` }}
          ></div>
        </div>

        {/* Percentage + Status at bottom */}
        <div className="flex justify-between items-center mt-2">
          <span className="text-sm font-semibold text-gray-700">
            {percentage}%
          </span>

          <span
            className={`text-sm font-semibold px-3 py-1 rounded-full backdrop-blur-sm 
              ${
                color === "green"
                  ? "bg-green-100 text-green-700"
                  : color === "blue"
                  ? "bg-blue-100 text-blue-700"
                  : color === "yellow"
                  ? "bg-yellow-100 text-yellow-700"
                  : color === "red"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-700"
              }`}
          >
            {getStatus()}
          </span>
        </div>
      </div>
    </div>
  );
};






  // Icons for different sections
  const financialIcons = {
    loan: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </svg>
    ),
    customer: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    collection: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    approval: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };

  if (loading && !userRegion && !userBranch && !userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-12 w-12 bg-blue-100 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="mt-8 text-xl text-gray-700 font-semibold">
            Loading dashboard...
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Please wait while we fetch your data
          </p>
        </div>
      </div>
    );
  }

  return (
   <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 pt-0 px-6 pb-6">
{/* Unified Filter + Quick Search Row */}
<div className="flex justify-end w-full mb-6">
  <div className="flex flex-row items-end gap-3">

    {/* ONLY show filters if NOT RO */}
    {userRole !== "relationship_officer" && (
      <>
        {/* Region Filter */}
        {(userRole === "credit_analyst_officer" ||
          userRole === "customer_service_officer") && (
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="bg-white border border-gray-300 rounded-xl px-4 py-2 h-9 w-60 text-sm font-medium 
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
          >
            <option value="all">All Regions</option>
            {availableRegions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        )}

        {/* Branch Filter */}
        {(userRole === "regional_manager" ||
          userRole === "credit_analyst_officer" ||
          userRole === "customer_service_officer") && (
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="bg-white border border-gray-300 rounded-xl px-4 py-2 h-9 w-60 text-sm font-medium 
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
          >
            <option value="all">
              {userRole === "regional_manager"
                ? "All Branches in Region"
                : "All Branches"}
            </option>
            {availableBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        )}

        {/* RO Filter */}
        <select
          value={selectedRO}
          onChange={(e) => setSelectedRO(e.target.value)}
          className="bg-white border border-gray-300 rounded-xl px-4 py-2 h-9 w-60 text-sm font-medium
          focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm
          disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={
            (userRole === "regional_manager" && selectedBranch === "all") ||
            (userRole === "credit_analyst_officer" && selectedBranch === "all") ||
            (userRole === "customer_service_officer" && selectedBranch === "all")
          }
        >
          {availableROs.map((ro) => (
            <option key={ro.id} value={ro.id}>
              {ro.full_name}
            </option>
          ))}
        </select>
      </>
    )}

    {/* Quick Search (Always visible for ALL roles) */}
    <div className="relative w-60">
    


      <input
        type="text"
        placeholder="Quick search 360°  View
..."
        className="pl-9 pr-3 py-2 h-9 bg-white border border-gray-300 rounded-xl w-full 
        text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
        value={quickSearchTerm}
        onChange={(e) => setQuickSearchTerm(e.target.value)}
      />

      {/* Search Results Dropdown */}
      {quickSearchTerm && quickSearchResults.length > 0 && (
        <div className="absolute right-0 z-50 mt-1 w-full bg-white border border-gray-300 
        rounded-lg shadow-xl max-h-96 overflow-y-auto">
          {quickSearchResults.slice(0, 10).map((customer) => (
            <div
              key={customer.id}
              onClick={() => handleOpen360View(customer)}
              className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-900">
                    {customer.Firstname} {customer.Surname}
                  </p>
                  <p className="text-sm text-gray-600">{customer.mobile}</p>
                  <p className="text-xs text-gray-500">ID: {customer.id_number}</p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-medium text-indigo-600">
                    {customer.prequalifiedAmount
                      ? `KES ${customer.prequalifiedAmount.toLocaleString()}`
                      : "N/A"}
                  </p>

                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                      customer.status === "verified"
                        ? "bg-green-100 text-green-800"
                        : customer.status === "bm_review"
                        ? "bg-yellow-100 text-yellow-800"
                        : customer.status === "rejected"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {customer.status || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {quickSearchTerm && quickSearchResults.length === 0 && (
        <div className="absolute right-0 z-50 mt-1 w-full bg-white border border-gray-300 
        rounded-lg shadow-xl p-3 text-center text-sm text-gray-500">
          No customers found
        </div>
      )}

    </div>
  </div>
</div>





      
      {/* Key Metrics Grid */}
     <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6 sm:mb-8">
        <IconStatCard
          icon={financialIcons.loan}
          value={`Ksh ${(dashboardMetrics?.outstandingBalance ?? 0).toLocaleString()}`}
          label="Outstanding Balance"
          subtitle={`${(dashboardMetrics?.outstandingLoansCount ?? 0).toLocaleString()} Active Loans`}
          backgroundImage="/images/bg1.jpg"
          onClick={handleViewLoans}
        />
        <IconStatCard
          icon={financialIcons.collection}
          value={`Ksh ${(dashboardMetrics?.cleanBookAmount ?? 0).toLocaleString()}`}
          label="Clean Book"
              percentage={dashboardMetrics?.cleanBookPercentage ?? 0}
          subtitle={`${(dashboardMetrics?.performingLoansCount ?? 0).toLocaleString()} Performing`}
          backgroundImage="/images/bg2.jpg"
          onClick={handleViewLoans}
        />
        <IconStatCard
          icon={financialIcons.customer}
          value={(dashboardMetrics?.totalCustomers ?? 0).toLocaleString()}
          label="Total Customers"
          subtitle={`${dashboardMetrics.customerOverview.activeCustomers} Active`}
          backgroundImage="/images/customer.jpg"
          onClick={handleViewCustomers}
        />
      </div>



      {/* Main Content Grid */}
      <div className="space-y-6 sm:space-y-0 sm:grid sm:grid-cols-1 lg:grid-cols-2 sm:gap-6 mb-6 sm:mb-8">
        {/* Customers Overview with Unique Background */}
        <OverviewSection 
          title="Customers Overview" 
          onViewAll={handleViewCustomers}
          backgroundImage="/images/bg1.jpg"
        >
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="text-center p-3 sm:p-5 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200 hover:shadow-md transition-shadow">
              <p className="text-lg sm:text-lg font-bold text-green-700">
                {dashboardMetrics.customerOverview.activeCustomers.toLocaleString()}
              </p>
              <p className="text-xs text-green-600 mt-1 sm:mt-2 font-semibold uppercase tracking-wide">
                Active
              </p>
            </div>
            <div className="text-center p-3 sm:p-5 bg-gradient-to-br from-red-50 to-rose-100 rounded-xl border border-red-200 hover:shadow-md transition-shadow">
              <p className="text-lg sm:text-lg font-bold text-red-700">
                {dashboardMetrics.customerOverview.inactiveCustomers.toLocaleString()}
              </p>
              <p className="text-xs text-red-600 mt-1 sm:mt-2 font-semibold uppercase tracking-wide">
                Inactive
              </p>
            </div>
            <div className="text-center p-3 sm:p-5 bg-gradient-to-br from-blue-50 to-cyan-100 rounded-xl border border-blue-200 hover:shadow-md transition-shadow">
              <p className="text-lg sm:text-lg font-bold text-blue-700">
                {dashboardMetrics.customerOverview.newCustomersToday}
              </p>
              <p className="text-xs text-blue-600 mt-1 sm:mt-2 font-semibold uppercase tracking-wide">
                New Today
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl border border-amber-200">
              <p className="text-lg sm:text-lg font-bold text-amber-700">
                {dashboardMetrics.customerOverview.leadsThisMonth}
              </p>
              <p className="text-xs text-amber-600 mt-1 font-semibold">
                Leads This Month
              </p>
            </div>
            <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-violet-100 rounded-xl border border-purple-200">
              <p className="text-lg sm:text-lg font-bold text-purple-700">
                {dashboardMetrics.customerOverview.leadsToday}
              </p>
              <p className="text-xs text-purple-600 mt-1 font-semibold">
                Leads Today
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <ConversionRateCard
              percentage={dashboardMetrics.customerOverview.leadConversionRateMonth || 0}
              label="Lead Conversion"
              total={dashboardMetrics.customerOverview.totalThisMonth || 0}
              converted={dashboardMetrics.customerOverview.customersThisMonth || 0}
              period="This Month"
              backgroundImage="/images/conversion-bg.jpg"
            />
            <ConversionRateCard
              percentage={dashboardMetrics.customerOverview.leadConversionRateYear || 0}
              label="Lead Conversion"
              total={dashboardMetrics.customerOverview.totalThisYear || 0}
              converted={dashboardMetrics.customerOverview.customersThisYear || 0}
              period="This Year"
              backgroundImage="/images/conversion-bg2.jpg"
            />
          </div>
        </OverviewSection>

      {/* Loans Overview with Unique Background */}
<OverviewSection 
  title="Loans Overview" 
  onViewAll={handleViewLoans}
  backgroundImage="/images/bg2.jpg"
>
  <div className="space-y-3 sm:space-y-4">
    <div className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 hover:shadow-md transition-shadow">
      <div className="flex items-center">
        <div className="p-2 bg-blue-50 rounded-lg mr-3">
          {financialIcons.loan}
        </div>
        <span className="text-sm font-semibold text-gray-700">
          Disbursed Loans
        </span>
      </div>
      <div className="text-right">
        <p className="text-lg sm:text-xl font-bold text-blue-700">
          Ksh {dashboardMetrics.loanOverview.disbursedLoansAmount.toLocaleString()}
        </p>
        <p className="text-xs text-blue-600 font-medium">
          {dashboardMetrics.loanOverview.disbursedLoansCount.toLocaleString()} loans
        </p>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {/* Disbursed Today - Updated to show amount */}
      <div className="flex flex-col p-3 sm:p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs sm:text-sm font-semibold text-gray-700">
            Disbursed Today
          </span>
        </div>
        <div className="text-right">
          <p className="text-lg sm:text-lg font-bold text-green-700">
            {dashboardMetrics.loanOverview.disbursedLoansToday}
          </p>
          <p className="text-xs text-green-600 font-medium">
            Ksh {dashboardMetrics.loanOverview.disbursedAmountToday?.toLocaleString() || 0}
          </p>
        </div>
      </div>
      
      {/* This Month - Updated to show amount */}
      <div className="flex flex-col p-3 sm:p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border border-teal-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs sm:text-sm font-semibold text-gray-700">
            This Month
          </span>
        </div>
        <div className="text-right">
          <p className="text-lg sm:text-lg font-bold text-teal-700">
            {dashboardMetrics.loanOverview.disbursedLoansThisMonth}
          </p>
          <p className="text-xs text-teal-600 font-medium">
            Ksh {dashboardMetrics.loanOverview.disbursedAmountThisMonth?.toLocaleString() || 0}
          </p>
        </div>
      </div>
    </div>

    {/* Rest of your loans overview content remains the same */}
    <div className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-100 hover:shadow-md transition-shadow">
      <span className="text-sm font-semibold text-gray-700">
        Loans Due Today
      </span>
      <div className="text-right">
        <p className="text-lg sm:text-lg font-bold text-amber-700">
          {dashboardMetrics.loanOverview.loansDueToday.toLocaleString()}
        </p>
        <p className="text-xs text-amber-600 font-medium">due today</p>
      </div>
    </div>

    <div className="flex items-center justify-between p-5 bg-gradient-to-r from-red-50 to-rose-50 rounded-xl border-2 border-red-200 hover:shadow-md transition-shadow">
      <span className="text-sm font-semibold text-red-700">
        Month to Date Arrears
      </span>
      <div className="text-right">
        <p className="text-lg font-semibold text-red-700">
          Ksh {dashboardMetrics.loanOverview.monthToDateArrears.toLocaleString()}
        </p>
        <p className="text-xs text-red-600 font-medium">in arrears</p>
      </div>
    </div>

    <div className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-red-50 to-rose-50 rounded-xl border-2 border-red-200 hover:shadow-md transition-shadow">
      <span className="text-sm font-semibold text-red-700">
        Total Arrears
      </span>
      <div className="text-right">
        <p className="text-lg sm:text-lg font-semibold text-red-700">
          Ksh {dashboardMetrics.loanOverview.totalLoanArrears.toLocaleString()}
        </p>
        <p className="text-xs text-red-600 font-medium">outstanding</p>
      </div>
    </div>
  </div>
</OverviewSection>
      </div>

      {/* Bottom Grid */}
      <div className="space-y-6 sm:space-y-0 sm:grid sm:grid-cols-1 lg:grid-cols-2 sm:gap-6 mb-6 sm:mb-8">
        {/* Collections Performance with Background Image */}
  {/* Collections Performance with Background Image */}
       

       
<OverviewSection title="Collections Performance" backgroundImage="/images/bg1.jpg">
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {/* Today's Collection */}
    <ProgressBar
      label="Today's Collection"
      type="collection"
      numerator={dashboardMetrics.collectionOverview.todayCollectionAmount || 0}
      denominator={dashboardMetrics.collectionOverview.todayCollectionDue || 0}
    />

    {/* Monthly Collection */}
    <ProgressBar
      label="Monthly Collection"
      type="collection"
      numerator={dashboardMetrics.collectionOverview.monthlyCollectionAmount || 0}
      denominator={dashboardMetrics.collectionOverview.monthlyCollectionDue || 0}
    />

    {/* Prepayment Rate (Tomorrow's Collection) */}
    <ProgressBar
      label="Tomorrow's Collection"
      type="collection"
      numerator={dashboardMetrics.collectionOverview.tomorrowCollection || 0}
      denominator={dashboardMetrics.collectionOverview.prepaymentDue || 0}
    />

    {/* Portfolio at Risk */}
    <ProgressBar
      label="Portfolio at Risk (PAR)"
      type="par"
      numerator={dashboardMetrics.loanOverview.totalLoanArrears || 0}  
      denominator={dashboardMetrics.outstandingBalance || 0}            
    />
  </div>
</OverviewSection>


        {/* Pending Actions with Background Image */}
        <OverviewSection 
          title="Pending Actions"
          backgroundImage="/images/actions-bg.jpg"
        >
          <div className="space-y-2 sm:space-y-3">
            {[
              {
                label: "Customer Approvals",
                count: dashboardMetrics.pendingActions.pendingCustomerApprovals,
                color: "blue",
                action: handleCustomerApprovals
              },
              {
                label: "Customer Amendments",
                count: dashboardMetrics.pendingActions.pendingAmends,
                color: "purple",
                action: handlePendingAmendments
              },
              {
                label: "BM Loan Approvals",
                count: dashboardMetrics.pendingActions.pendingBMLoanApprovals,
                color: "green",
                action: handlePendingBMLoans
              },
              {
                label: "RM Loan Approvals",
                count: dashboardMetrics.pendingActions.pendingRMLoanApprovals,
                color: "amber",
                action: handlePendingRMLoans
              },
              {
                label: "Pending Disbursement",
                count: dashboardMetrics.pendingActions.pendingDisbursement,
                color: "red",
                action: handlePendingDisbursement
              }
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl cursor-pointer hover:shadow-md hover:scale-102 transition-all border border-gray-200"
                onClick={item.action}
              >
                <span className="text-sm font-semibold text-gray-700">
                  {item.label}
                </span>
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className={`text-lg sm:text-2xl font-bold text-${item.color}-600`}>
                    {item.count}
                  </span>
                  <svg className={`w-4 h-4 sm:w-5 sm:h-5 text-${item.color}-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </OverviewSection>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <OverviewSection 
            title="Recent Activity"
            backgroundImage="/images/activity-bg.jpg"
          >
            <div className="space-y-4">
              {recentActivity.slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-300 group cursor-pointer"
                >
                  <div className={`${activity.iconBg} rounded-full p-3 mr-4 group-hover:scale-110 transition-transform duration-300`}>
                    {activity.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                      {activity.message}
                    </p>
                    <div className="flex items-center mt-1">
                      <span className="text-sm text-gray-500">{activity.time}</span>
                      <span className="mx-2 text-gray-300">•</span>
                      <span className="text-sm font-medium text-green-600">
                        {activity.amount}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </OverviewSection>
        </div>

        <OverviewSection 
          title="Quick Actions"
          backgroundImage="/images/quick-actions-bg.jpg"
        >
          <div className="space-y-3">
            {[
              { label: "Manage Customers", icon: financialIcons.customer, action: handleViewCustomers, color: "blue" },
              { label: "View Loans", icon: financialIcons.loan, action: handleViewLoans, color: "green" },
              { label: "BM Approvals", icon: financialIcons.approval, action: handlePendingBMLoans, color: "amber" },
              { label: "RM Approvals", icon: financialIcons.approval, action: handlePendingRMLoans, color: "purple" },
              { label: "Disburse Loans", icon: financialIcons.collection, action: handlePendingDisbursement, color: "teal" },
              { label: "Customer Approvals", icon: financialIcons.approval, action: handleCustomerApprovals, color: "red" }
            ].map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className="w-full flex items-center p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 hover:shadow-md hover:scale-102 transition-all duration-300 group"
              >
                <div className={`p-2 bg-${action.color}-100 rounded-lg mr-3 group-hover:scale-110 transition-transform`}>
                  <div className={`text-${action.color}-600`}>
                    {action.icon}
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </OverviewSection>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center text-gray-600 mb-4 md:mb-0">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            <span className="text-sm font-medium">
              System Status: Operational • Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;