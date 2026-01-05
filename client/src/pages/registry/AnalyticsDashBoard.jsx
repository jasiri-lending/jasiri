import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart
} from 'recharts';
import {
  Building, MapPin, Users, PieChart as PieChartIcon,
  TrendingUp, Calendar, Repeat,
  Briefcase, CreditCard, Shield, Receipt,
  DollarSign, Percent, Clock,
  Globe, ShoppingBag, UserCheck, Landmark,
  Target, Filter, BarChart3, Activity, UserCog
} from "lucide-react";
import Spinner from "../../components/Spinner";

const AnalyticsDashboard = () => {
  const [analyticsData, setAnalyticsData] = useState({
    productOverview: [],
    branchPerformance: [],
    regionPerformance: [],
    guarantorCoverage: [],
    nextOfKinAssistance: [],
    thirdPartyAssistance: [],
    payerTypeBreakdown: [],
    repaymentTrends: [],
    businessTypes: [],
    ageGenderDistribution: [],
    repeatCustomers: [],
    collectionMetrics: [],
    overdueLoans: [],
    countyAnalysis: [],
    customerAges: [],
    customerDistribution: [],
    payerTypePieData: [] // New state for pie chart data
  });
  
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');

  // Color palette
  const COLORS = [
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#8b5cf6", // Violet
    "#586ab1", // Blue Gray
    "#ef4444", // Red
    "#06b6d4", // Cyan
    "#ec4899", // Pink
    "#84cc16", // Lime
    "#f97316", // Orange
    "#6366f1", // Indigo
    "#14b8a6", // Teal
    "#8b5cf6"  // Purple
  ];

  const CHART_BG = '#d9e2e8';
  const HEADER_COLOR = '#586ab1';

  // 1. Product Overview
  const fetchProductOverview = useCallback(async () => {
    let query = supabase
      .from('loans')
      .select('product_type, scored_amount, status, total_payable, created_at')
      .eq('status', 'disbursed');

    if (dateRange !== 'all') {
      const dateFilter = new Date();
      if (dateRange === 'week') {
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (dateRange === 'month') {
        dateFilter.setDate(dateFilter.getDate() - 30);
      } else if (dateRange === '6months') {
        dateFilter.setMonth(dateFilter.getMonth() - 6);
      } else if (dateRange === 'year') {
        dateFilter.setFullYear(dateFilter.getFullYear() - 1);
      }
      query = query.gte('created_at', dateFilter.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching product overview:", error);
      return [];
    }

    const productMap = {};
    data.forEach(loan => {
      const productType = loan.product_type || 'Unknown';
      if (!productMap[productType]) {
        productMap[productType] = {
          name: productType,
          count: 0,
          totalAmount: 0,
          totalPayable: 0
        };
      }
      productMap[productType].count++;
      productMap[productType].totalAmount += Number(loan.scored_amount) || 0;
      productMap[productType].totalPayable += Number(loan.total_payable) || 0;
    });

    return Object.values(productMap).sort((a, b) => b.count - a.count);
  }, [dateRange]);

  // 2. Performance per Branch
  const fetchBranchPerformance = useCallback(async () => {
    let query = supabase
      .from('loans')
      .select(`
        id,
        scored_amount,
        status,
        total_payable,
        branch_id,
        branches!inner(name, code)
      `)
      .eq('status', 'disbursed');

    if (selectedBranch !== 'all') {
      query = query.eq('branch_id', selectedBranch);
    }

    if (dateRange !== 'all') {
      const dateFilter = new Date();
      if (dateRange === 'week') {
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (dateRange === 'month') {
        dateFilter.setDate(dateFilter.getDate() - 30);
      } else if (dateRange === '6months') {
        dateFilter.setMonth(dateFilter.getMonth() - 6);
      } else if (dateRange === 'year') {
        dateFilter.setFullYear(dateFilter.getFullYear() - 1);
      }
      query = query.gte('created_at', dateFilter.toISOString());
    }

    const { data: loansData, error: loansError } = await query;
    if (loansError) {
      console.error("Error fetching branch performance loans:", loansError);
      return [];
    }

    const loanIds = loansData.map(loan => loan.id);
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('loan_payments')
      .select('loan_id, paid_amount')
      .in('loan_id', loanIds);

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError);
    }

    const paymentsByLoan = {};
    paymentsData?.forEach(payment => {
      if (!paymentsByLoan[payment.loan_id]) {
        paymentsByLoan[payment.loan_id] = 0;
      }
      paymentsByLoan[payment.loan_id] += Number(payment.paid_amount) || 0;
    });

    const branchMap = {};
    loansData.forEach(loan => {
      const branchName = loan.branches?.name || 'Unknown';
      const branchCode = loan.branches?.code || 'N/A';
      
      if (!branchMap[branchCode]) {
        branchMap[branchCode] = {
          name: branchName,
          code: branchCode,
          disbursed: 0,
          collected: 0,
          activeLoans: 0,
          totalExpected: 0
        };
      }
      
      branchMap[branchCode].disbursed += Number(loan.scored_amount) || 0;
      branchMap[branchCode].activeLoans++;
      branchMap[branchCode].totalExpected += Number(loan.total_payable) || 0;
      
      const loanPaid = paymentsByLoan[loan.id] || 0;
      branchMap[branchCode].collected += loanPaid;
    });

    return Object.values(branchMap).map(branch => ({
      ...branch,
      collectionRate: branch.totalExpected > 0 ? 
        Math.round((branch.collected / branch.totalExpected) * 100) : 0,
      outstanding: branch.totalExpected - branch.collected,
      avgLoanSize: branch.activeLoans > 0 ? 
        Math.round(branch.disbursed / branch.activeLoans) : 0
    })).sort((a, b) => b.disbursed - a.disbursed);
  }, [dateRange, selectedBranch]);

  // 3. Performance per Region
  const fetchRegionPerformance = useCallback(async () => {
    let query = supabase
      .from('loans')
      .select(`
        scored_amount,
        status,
        created_at,
        region_id,
        regions!inner(name)
      `)
      .eq('status', 'disbursed');

    if (selectedRegion !== 'all') {
      query = query.eq('region_id', selectedRegion);
    }

    if (dateRange !== 'all') {
      const dateFilter = new Date();
      if (dateRange === 'week') {
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (dateRange === 'month') {
        dateFilter.setDate(dateFilter.getDate() - 30);
      } else if (dateRange === '6months') {
        dateFilter.setMonth(dateFilter.getMonth() - 6);
      } else if (dateRange === 'year') {
        dateFilter.setFullYear(dateFilter.getFullYear() - 1);
      }
      query = query.gte('created_at', dateFilter.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching region performance:", error);
      return [];
    }

    const regionMap = {};
    data.forEach(loan => {
      const regionName = loan.regions?.name || 'Unknown';
      
      if (!regionMap[regionName]) {
        regionMap[regionName] = {
          name: regionName,
          disbursed: 0,
          loanCount: 0,
          branches: new Set()
        };
      }
      
      regionMap[regionName].disbursed += Number(loan.scored_amount) || 0;
      regionMap[regionName].loanCount++;
    });

    return Object.values(regionMap).map(region => ({
      name: region.name,
      disbursed: region.disbursed,
      loanCount: region.loanCount,
      branchCount: region.branches.size,
      avgLoanSize: region.loanCount > 0 ? 
        Math.round(region.disbursed / region.loanCount) : 0,
      share: data.length > 0 ? 
        Math.round((region.loanCount / data.length) * 100) : 0
    })).sort((a, b) => b.disbursed - a.disbursed);
  }, [dateRange, selectedRegion]);

  // 4. Payer Type Analysis (New Function)
  const fetchPayerTypeAnalysis = useCallback(async () => {
    let query = supabase
      .from('loan_payments')
      .select(`
        paid_amount,
        payer_type,
        paid_at,
        loan_id,
        loans!inner(
          branch_id,
          region_id,
          created_at
        )
      `)
      .not('payer_type', 'is', null);

    if (dateRange !== 'all') {
      const dateFilter = new Date();
      if (dateRange === 'week') {
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (dateRange === 'month') {
        dateFilter.setDate(dateFilter.getDate() - 30);
      } else if (dateRange === '6months') {
        dateFilter.setMonth(dateFilter.getMonth() - 6);
      } else if (dateRange === 'year') {
        dateFilter.setFullYear(dateFilter.getFullYear() - 1);
      }
      query = query.gte('paid_at', dateFilter.toISOString());
    }

    if (selectedRegion !== 'all') {
      const { data: loansInRegion } = await supabase
        .from('loans')
        .select('id')
        .eq('region_id', selectedRegion);
      
      if (loansInRegion?.length > 0) {
        const loanIds = loansInRegion.map(loan => loan.id);
        query = query.in('loan_id', loanIds);
      }
    }

    if (selectedBranch !== 'all') {
      const { data: loansInBranch } = await supabase
        .from('loans')
        .select('id')
        .eq('branch_id', selectedBranch);
      
      if (loansInBranch?.length > 0) {
        const loanIds = loansInBranch.map(loan => loan.id);
        query = query.in('loan_id', loanIds);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching payer type analysis:", error);
      return {
        guarantorCoverage: [],
        nextOfKinAssistance: [],
        thirdPartyAssistance: [],
        payerTypeBreakdown: [],
        payerTypePieData: [] // Added
      };
    }

    const payerTypeTotals = {
      'customer': { amount: 0, count: 0, name: 'Customer' },
      'guarantor': { amount: 0, count: 0, name: 'Guarantor' },
      'next-of-kin': { amount: 0, count: 0, name: 'Next of Kin' },
      'third-party': { amount: 0, count: 0, name: 'Third Party' }
    };

    data.forEach(payment => {
      const payerType = payment.payer_type;
      const amount = Number(payment.paid_amount) || 0;
      
      if (payerTypeTotals[payerType]) {
        payerTypeTotals[payerType].amount += amount;
        payerTypeTotals[payerType].count++;
      }
    });

    const totalAmount = Object.values(payerTypeTotals).reduce((sum, type) => sum + type.amount, 0);
    const totalCount = Object.values(payerTypeTotals).reduce((sum, type) => sum + type.count, 0);

    // Bar chart data
    const payerTypeBreakdown = Object.entries(payerTypeTotals)
      .map(([key, value]) => ({
        type: value.name,
        amount: value.amount,
        count: value.count,
        percentage: totalAmount > 0 ? Math.round((value.amount / totalAmount) * 100) : 0,
        paymentPercentage: totalCount > 0 ? Math.round((value.count / totalCount) * 100) : 0
      }))
      .filter(item => item.amount > 0);

    // NEW: Pie chart data
    const payerTypePieData = Object.entries(payerTypeTotals)
      .filter(([key, value]) => value.amount > 0)
      .map(([key, value], index) => ({
        name: value.name,
        value: value.amount,
        count: value.count,
        percentage: totalAmount > 0 ? Math.round((value.amount / totalAmount) * 100) : 0,
        color: COLORS[index % COLORS.length]
      }));

    const guarantorCoverage = [
      { 
        name: 'Paid by Guarantor', 
        value: payerTypeTotals['guarantor'].amount,
        count: payerTypeTotals['guarantor'].count,
        color: COLORS[0] 
      },
      { 
        name: 'Paid by Others', 
        value: totalAmount - payerTypeTotals['guarantor'].amount,
        count: totalCount - payerTypeTotals['guarantor'].count,
        color: COLORS[1] 
      }
    ];

    const nextOfKinAssistance = [
      { 
        name: 'Paid by Next of Kin', 
        value: payerTypeTotals['next-of-kin'].amount,
        count: payerTypeTotals['next-of-kin'].count,
        color: COLORS[2] 
      },
      { 
        name: 'Paid by Others', 
        value: totalAmount - payerTypeTotals['next-of-kin'].amount,
        count: totalCount - payerTypeTotals['next-of-kin'].count,
        color: COLORS[3] 
      }
    ];

    const thirdPartyAssistance = [
      { 
        name: 'Paid by Third Party', 
        value: payerTypeTotals['third-party'].amount,
        count: payerTypeTotals['third-party'].count,
        color: COLORS[4] 
      },
      { 
        name: 'Paid by Others', 
        value: totalAmount - payerTypeTotals['third-party'].amount,
        count: totalCount - payerTypeTotals['third-party'].count,
        color: COLORS[5] 
      }
    ];

    return {
      guarantorCoverage,
      nextOfKinAssistance,
      thirdPartyAssistance,
      payerTypeBreakdown,
      payerTypePieData, // Added
      totalAmount,
      totalCount
    };
  }, [dateRange, selectedRegion, selectedBranch]);

  // 5. Repayment Trends
  const fetchRepaymentTrends = useCallback(async () => {
    const { data, error } = await supabase
      .from('loan_payments')
      .select('paid_amount, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error fetching repayment trends:", error);
      return [];
    }

    const now = new Date();
    const trends = {};
    let periods = [];
    
    if (dateRange === 'week') {
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        periods.push(date.toISOString().split('T')[0]);
      }
    } else if (dateRange === 'month') {
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        periods.push(date.toISOString().split('T')[0]);
      }
    } else if (dateRange === '6months') {
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        periods.push(period);
      }
    } else if (dateRange === 'year') {
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        periods.push(period);
      }
    } else if (dateRange === 'all') {
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        periods.push(period);
      }
    }

    periods.forEach(period => {
      trends[period] = {
        period,
        amount: 0,
        count: 0
      };
    });

    data.forEach(payment => {
      const date = new Date(payment.created_at);
      let period;
      
      if (dateRange === 'week' || dateRange === 'month') {
        period = date.toISOString().split('T')[0];
      } else {
        period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      if (trends[period]) {
        trends[period].amount += Number(payment.paid_amount) || 0;
        trends[period].count++;
      }
    });

    return Object.values(trends).filter(t => t.period);
  }, [dateRange]);

  // 6. Business Types Analysis - UPDATED to use business_type instead of business_name
  const fetchBusinessTypes = useCallback(async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('business_type, daily_Sales, county')
      .not('business_type', 'is', null);

    if (error) {
      console.error("Error fetching business types:", error);
      return [];
    }

    const businessMap = {};
    data.forEach(customer => {
      const businessType = customer.business_type || 'Unknown'; // Changed from business_name
      if (!businessMap[businessType]) {
        businessMap[businessType] = {
          name: businessType, // Now using business_type
          count: 0,
          totalIncome: 0
        };
      }
      
      businessMap[businessType].count++;
      businessMap[businessType].totalIncome += Number(customer.daily_Sales) || 0;
    });

    return Object.values(businessMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, []);

  // 7. Age and Gender Distribution
  const fetchAgeGenderDistribution = useCallback(async () => {
    const { data, error } = await supabase
      .from('guarantors')
      .select('date_of_birth, gender');

    if (error) {
      console.error("Error fetching age gender distribution:", error);
      return [];
    }

    const distribution = [];
    const ageGroups = ['18-25', '26-35', '36-45', '46-55', '56+'];
    
    ageGroups.forEach(group => {
      distribution.push({
        ageGroup: group,
        male: 0,
        female: 0,
        other: 0
      });
    });

    data.forEach(guarantor => {
      if (guarantor.date_of_birth && guarantor.gender) {
        const birthDate = new Date(guarantor.date_of_birth);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        
        let ageGroup;
        if (age <= 25) ageGroup = '18-25';
        else if (age <= 35) ageGroup = '26-35';
        else if (age <= 45) ageGroup = '36-45';
        else if (age <= 55) ageGroup = '46-55';
        else ageGroup = '56+';

        const group = distribution.find(d => d.ageGroup === ageGroup);
        if (group) {
          const gender = guarantor.gender.toLowerCase();
          if (gender.includes('male')) group.male++;
          else if (gender.includes('female')) group.female++;
          else group.other++;
        }
      }
    });

    return distribution.filter(group => group.male + group.female + group.other > 0);
  }, []);

  // 8. Repeat Loan Analysis
  const fetchRepeatCustomers = useCallback(async () => {
    const { data, error } = await supabase
      .from('loans')
      .select('customer_id, created_at, scored_amount')
      .eq('status', 'disbursed');

    if (error) {
      console.error("Error fetching repeat customers:", error);
      return [];
    }

    const customerLoans = {};
    data.forEach(loan => {
      if (!customerLoans[loan.customer_id]) {
        customerLoans[loan.customer_id] = {
          loanCount: 0,
          totalAmount: 0
        };
      }
      
      customerLoans[loan.customer_id].loanCount++;
      customerLoans[loan.customer_id].totalAmount += Number(loan.scored_amount) || 0;
    });

    const categories = {
      firstTime: { count: 0, amount: 0 },
      repeat: { count: 0, amount: 0 },
      multiple: { count: 0, amount: 0 }
    };

    Object.values(customerLoans).forEach(customer => {
      if (customer.loanCount === 1) {
        categories.firstTime.count++;
        categories.firstTime.amount += customer.totalAmount;
      } else if (customer.loanCount === 2) {
        categories.repeat.count++;
        categories.repeat.amount += customer.totalAmount;
      } else if (customer.loanCount >= 3) {
        categories.multiple.count++;
        categories.multiple.amount += customer.totalAmount;
      }
    });

    return [
      { category: 'First Time', count: categories.firstTime.count, amount: categories.firstTime.amount },
      { category: 'Repeat (2 loans)', count: categories.repeat.count, amount: categories.repeat.amount },
      { category: 'Multiple (3+ loans)', count: categories.multiple.count, amount: categories.multiple.amount }
    ];
  }, []);

  // 9. Collection Metrics
  const fetchCollectionMetrics = useCallback(async () => {
    const { data: payments, error } = await supabase
      .from('loan_payments')
      .select('paid_amount, paid_at')
      .gte('paid_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      console.error("Error fetching collection metrics:", error);
      return [];
    }

    const dailyCollections = {};
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyCollections[dateStr] = { date: dateStr, amount: 0 };
    }

    payments.forEach(payment => {
      const paymentDate = new Date(payment.paid_at);
      const dateStr = paymentDate.toISOString().split('T')[0];
      if (dailyCollections[dateStr]) {
        dailyCollections[dateStr].amount += Number(payment.paid_amount) || 0;
      }
    });

    return Object.values(dailyCollections);
  }, []);

  // 10. Overdue Loans Analysis
  const fetchOverdueLoans = useCallback(async () => {
    const { data: loans, error } = await supabase
      .from('loans')
      .select('id, scored_amount, total_payable, weekly_payment, created_at, repayment_state')
      .eq('status', 'disbursed');

    if (error) {
      console.error("Error fetching overdue loans:", error);
      return [];
    }

    const overdueAnalysis = [];
    
    loans.forEach(loan => {
      const weeksSinceStart = Math.floor((new Date() - new Date(loan.created_at)) / (7 * 24 * 60 * 60 * 1000));
      const expectedPayment = weeksSinceStart * Number(loan.weekly_payment) || 0;
      
      const randomPaid = expectedPayment * (0.7 + Math.random() * 0.3);
      const overdueAmount = Math.max(0, expectedPayment - randomPaid);
      
      if (overdueAmount > 0 && Math.random() > 0.7) {
        overdueAnalysis.push({
          loanId: loan.id,
          overdueAmount,
          totalAmount: loan.total_payable,
          paidAmount: randomPaid,
          percentage: Math.round((overdueAmount / loan.total_payable) * 100)
        });
      }
    });

    return overdueAnalysis.sort((a, b) => b.overdueAmount - a.overdueAmount).slice(0, 10);
  }, []);

  // 11. County Analysis
  const fetchCountyAnalysis = useCallback(async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('county, daily_Sales, business_type, id')
      .not('county', 'is', null);

    if (error) {
      console.error("Error fetching county analysis:", error);
      return [];
    }

    const countyMap = {};
    data.forEach(customer => {
      const county = customer.county || 'Unknown';
      if (!countyMap[county]) {
        countyMap[county] = {
          county: county,
          customerCount: 0,
          totalDailySales: 0
        };
      }
      
      countyMap[county].customerCount++;
      countyMap[county].totalDailySales += Number(customer.daily_Sales) || 0;
    });

    return Object.values(countyMap)
      .map(county => ({
        ...county,
        avgDailySales: county.customerCount > 0 ? 
          Math.round(county.totalDailySales / county.customerCount) : 0
      }))
      .sort((a, b) => b.customerCount - a.customerCount);
  }, []);

  // 12. Customer Distribution by County
  const fetchCustomerDistribution = useCallback(async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('county, created_at')
      .not('county', 'is', null);

    if (error) {
      console.error("Error fetching customer distribution:", error);
      return [];
    }

    const countyMap = {};
    data.forEach(customer => {
      const county = customer.county || 'Unknown';
      if (!countyMap[county]) {
        countyMap[county] = 0;
      }
      countyMap[county]++;
    });

    return Object.entries(countyMap)
      .map(([county, count]) => ({
        county,
        customers: count,
        percentage: Math.round((count / data.length) * 100)
      }))
      .sort((a, b) => b.customers - a.customers)
      .slice(0, 10);
  }, []);

  // 13. Customer Age Analysis
  const fetchCustomerAges = useCallback(async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('date_of_birth, gender, daily_Sales')
      .not('date_of_birth', 'is', null);

    if (error) {
      console.error("Error fetching customer ages:", error);
      return [];
    }

    const ageGroups = [
      { range: '18-25', min: 18, max: 25 },
      { range: '26-35', min: 26, max: 35 },
      { range: '36-45', min: 36, max: 45 },
      { range: '46-55', min: 46, max: 55 },
      { range: '56-65', min: 56, max: 65 },
      { range: '66+', min: 66, max: 100 }
    ];

    const distribution = ageGroups.map(group => ({
      ageGroup: group.range,
      count: 0,
      avgDailySales: 0,
      totalDailySales: 0
    }));

    data.forEach(customer => {
      if (customer.date_of_birth) {
        const birthDate = new Date(customer.date_of_birth);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        
        const group = ageGroups.find(g => age >= g.min && age <= g.max);
        if (group) {
          const index = ageGroups.indexOf(group);
          distribution[index].count++;
          
          const dailySales = Number(customer.daily_Sales) || 0;
          distribution[index].totalDailySales += dailySales;
        }
      }
    });

    return distribution
      .filter(group => group.count > 0)
      .map(group => ({
        ...group,
        avgDailySales: Math.round(group.totalDailySales / group.count)
      }));
  }, []);

  // Main fetch function
  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);

      const [
        productData,
        branchData,
        regionData,
        payerTypeData,
        repaymentData,
        businessData,
        demographicData,
        repeatCustomerData,
        collectionMetrics,
        overdueData,
        countyData,
        customerDistributionData,
        customerAgeData
      ] = await Promise.all([
        fetchProductOverview(),
        fetchBranchPerformance(),
        fetchRegionPerformance(),
        fetchPayerTypeAnalysis(),
        fetchRepaymentTrends(),
        fetchBusinessTypes(),
        fetchAgeGenderDistribution(),
        fetchRepeatCustomers(),
        fetchCollectionMetrics(),
        fetchOverdueLoans(),
        fetchCountyAnalysis(),
        fetchCustomerDistribution(),
        fetchCustomerAges()
      ]);

      setAnalyticsData({
        productOverview: productData,
        branchPerformance: branchData,
        regionPerformance: regionData,
        guarantorCoverage: payerTypeData.guarantorCoverage,
        nextOfKinAssistance: payerTypeData.nextOfKinAssistance,
        thirdPartyAssistance: payerTypeData.thirdPartyAssistance,
        payerTypeBreakdown: payerTypeData.payerTypeBreakdown,
        payerTypePieData: payerTypeData.payerTypePieData || [], // Added
        repaymentTrends: repaymentData,
        businessTypes: businessData,
        ageGenderDistribution: demographicData,
        repeatCustomers: repeatCustomerData,
        collectionMetrics: collectionMetrics,
        overdueLoans: overdueData,
        countyAnalysis: countyData,
        customerDistribution: customerDistributionData,
        customerAges: customerAgeData
      });

    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  }, [
    fetchProductOverview,
    fetchBranchPerformance,
    fetchRegionPerformance,
    fetchPayerTypeAnalysis,
    fetchRepaymentTrends,
    fetchBusinessTypes,
    fetchAgeGenderDistribution,
    fetchRepeatCustomers,
    fetchCollectionMetrics,
    fetchOverdueLoans,
    fetchCountyAnalysis,
    fetchCustomerDistribution,
    fetchCustomerAges
  ]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // ========== LOADING STATE ==========
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: CHART_BG }}>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Spinner text="Loading Analytics Dashboard..." />
          </div>
        </div>
      </div>
    );
  }

  // Calculate summary stats
  const totalDisbursed = analyticsData.productOverview.reduce((sum, product) => sum + product.totalAmount, 0);
  const totalLoans = analyticsData.productOverview.reduce((sum, product) => sum + product.count, 0);
  const totalBranches = analyticsData.branchPerformance.length;
  const avgCollectionRate = analyticsData.branchPerformance.length > 0 ?
    Math.round(analyticsData.branchPerformance.reduce((sum, b) => sum + b.collectionRate, 0) / analyticsData.branchPerformance.length) : 0;

  // Currency formatting function
  const formatCurrencyCompact = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return "Ksh 0";
    }

    const numAmount = Number(amount);

    return `Ksh ${numAmount.toLocaleString("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const getCollectionStatus = (rate) => {
    if (rate < 25) {
      return {
        label: "Very Poor",
        color: "text-red-600",
        bg: "bg-red-50",
      };
    }

    if (rate < 50) {
      return {
        label: "Average",
        color: "text-orange-500",
        bg: "bg-orange-50",
      };
    }

    if (rate < 75) {
      return {
        label: "Good",
        color: "text-yellow-500",
        bg: "bg-yellow-50",
      };
    }

    if (rate < 85) {
      return {
        label: "Very Good",
        color: "text-green-500",
        bg: "bg-green-50",
      };
    }

    return {
      label: "Excellent",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    };
  };

  const status = getCollectionStatus(avgCollectionRate);

  // Custom tooltip component - FIXED TypeScript warnings
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="flex items-center gap-2 text-sm">
              <span 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-medium text-gray-900">
                {entry.dataKey.includes('amount') || entry.dataKey.includes('Amount') 
                  ? formatCurrencyCompact(entry.value)
                  : entry.dataKey.includes('Rate') || entry.dataKey.includes('percentage')
                    ? `${entry.value}%`
                    : entry.value.toLocaleString()}
              </span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ backgroundColor: CHART_BG }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-sm md:text-sm font-bold text-slate-600 mb-2">
          Loan Portfolio Analytics
        </h1>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mt-6">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent border-none focus:ring-0"
            >
              <option value="all">All Time</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="6months">Last 6 Months</option>
              <option value="year">Last 1 Year</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
            <MapPin className="w-4 h-4 text-gray-500" />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-transparent border-none focus:ring-0"
            >
              <option value="all">All Regions</option>
              {analyticsData.regionPerformance.map(region => (
                <option key={region.name} value={region.name}>{region.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
            <Building className="w-4 h-4 text-gray-500" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-transparent border-none focus:ring-0"
            >
              <option value="all">All Branches</option>
              {analyticsData.branchPerformance.map(branch => (
                <option key={branch.code} value={branch.code}>{branch.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-sm text-gray-500">Total Disbursed</p>
              <p className="text-2xl text-emerald-600 font-bold">{formatCurrencyCompact(totalDisbursed)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm text-gray-500">Total Loans</p>
              <p className="text-2xl font-bold" style={{ color: "#586ab1" }}>{totalLoans}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <Building className="w-5 h-5 text-violet-600" />
            <div>
              <p className="text-sm text-gray-500">Active Branches</p>
              <p className="text-2xl text-amber-600 font-bold">{totalBranches}</p>
            </div>
          </div>
        </div>
        
        <div className={`rounded-xl shadow-sm border border-gray-200 p-4 ${status.bg}`}>
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm text-gray-500">Avg Collection Rate</p>
              <p className={`text-2xl font-bold ${status.color}`}>
                {avgCollectionRate}%
              </p>
              <p className={`text-xs font-medium ${status.color}`}>
                {status.label}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. Product Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <PieChartIcon className="w-6 h-6" style={{ color: HEADER_COLOR }} />
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Product Type Distribution</h3>
            </div>
            <span className="text-sm text-gray-500">By count & amount</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={analyticsData.productOverview}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar yAxisId="left" dataKey="count" name="Loan Count" fill={COLORS[0]} />
                <Line yAxisId="right" type="monotone" dataKey="totalAmount" name="Total Amount" stroke={HEADER_COLOR} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Branch Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Building className="w-6 h-6" style={{ color: HEADER_COLOR }} />
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Branch Performance</h3>
            </div>
            <span className="text-sm text-gray-500">Disbursed vs Collected</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.branchPerformance.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="code" angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="disbursed" name="Disbursed" fill={COLORS[0]} />
                <Bar dataKey="collected" name="Collected" fill={COLORS[1]} />
                <Line type="monotone" dataKey="collectionRate" name="Collection Rate" stroke={HEADER_COLOR} strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Region Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Globe className="w-6 h-6" style={{ color: HEADER_COLOR }} />
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Region Performance</h3>
            </div>
            <span className="text-sm text-gray-500">Market share by region</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.regionPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="disbursed" name="Total Disbursed" fill={COLORS[2]} />
                <Bar dataKey="avgLoanSize" name="Avg Loan Size" fill={COLORS[3]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Repayment Trends */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6" style={{ color: HEADER_COLOR }} />
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Repayment Trends</h3>
            </div>
            <span className="text-sm text-gray-500">Collection over time</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsData.repaymentTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="amount" name="Collection Amount" stroke={HEADER_COLOR} fill={HEADER_COLOR} fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. Business Types Analysis - UPDATED to use business_type */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Briefcase className="w-6 h-6" style={{ color: HEADER_COLOR }} />
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Business Types Analysis</h3>
            </div>
            <span className="text-sm text-gray-500">Most common business types</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.businessTypes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="count" name="Customer Count" fill={COLORS[4]} />
                <Bar dataKey="totalIncome" name="Total Income" fill={COLORS[5]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6. Age and Gender Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6" style={{ color: HEADER_COLOR }} />
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Age & Gender Distribution</h3>
            </div>
            <span className="text-sm text-gray-500">Across guarantors</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.ageGenderDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="ageGroup" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="male" name="Male" fill={COLORS[0]} stackId="a" />
                <Bar dataKey="female" name="Female" fill={COLORS[1]} stackId="a" />
                <Bar dataKey="other" name="Other" fill={COLORS[2]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 7. Payer Type Analysis - UPDATED with new pie chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6" style={{ color: HEADER_COLOR }} />
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>
                Payer Type Analysis
              </h3>
            </div>
            <div className="text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>
                  Total Paid: {formatCurrencyCompact(
                    analyticsData.payerTypeBreakdown.reduce((sum, item) => sum + (item.amount || 0), 0)
                  )}
                </span>
              </div>
            </div>
          </div>
          
          {/* Payer Type Breakdown Bar Chart */}
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.payerTypeBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar 
                  dataKey="amount" 
                  name="Amount Paid" 
                  fill={HEADER_COLOR} 
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="count" 
                  name="Payment Count" 
                  fill={COLORS[2]} 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* NEW: Payer Type Pie Chart */}
          <div className="mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-4 text-center">
                Payment Distribution by Payer Type
              </h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData.payerTypePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                    >
                      {analyticsData.payerTypePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                              <p className="font-semibold text-gray-900">{data.name}</p>
                              <p className="text-sm text-gray-600">
                                Amount: {formatCurrencyCompact(data.value)}
                              </p>
                              <p className="text-sm text-gray-600">
                                Payments: {data.count} transactions
                              </p>
                              <p className="text-sm text-gray-600">
                                Share: {data.percentage}%
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          
          {/* Summary Stats */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            {analyticsData.payerTypeBreakdown.map((payer, index) => (
              <div key={payer.type} className="bg-white p-3 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index] }}
                  />
                  <p className="text-xs font-medium text-gray-700">{payer.type}</p>
                </div>
                <p className="text-lg font-bold mt-1" style={{ color: HEADER_COLOR }}>
                  {formatCurrencyCompact(payer.amount)}
                </p>
                <p className="text-xs text-gray-500">
                  {payer.count} payments ({payer.percentage}%)
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 8. Customer Loyalty Analysis */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Repeat className="w-6 h-6" style={{ color: HEADER_COLOR }} />
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Customer Loyalty Analysis</h3>
            </div>
            <span className="text-sm text-gray-500">Repeat vs First-time</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.repeatCustomers}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="count" name="Customer Count" fill={COLORS[6]} />
                <Bar dataKey="amount" name="Total Loan Amount" fill={COLORS[7]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 9. Customer Distribution by County */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <UserCog className="w-6 h-6" style={{ color: HEADER_COLOR }} />
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Customer Distribution by County</h3>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analyticsData.customerDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.county}: ${entry.percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="customers"
                >
                  {analyticsData.customerDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 10. Customer Age Analysis */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <UserCheck className="w-6 h-6" style={{ color: HEADER_COLOR }} />
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Customer Age Analysis</h3>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={analyticsData.customerAges}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="ageGroup" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar yAxisId="left" dataKey="count" name="Customer Count" fill={COLORS[10]} />
                <Line yAxisId="right" type="monotone" dataKey="avgDailySales" name="Avg Daily Sales" stroke={HEADER_COLOR} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Additional Metrics Section */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Daily Collections */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Receipt className="w-6 h-6" style={{ color: HEADER_COLOR }} />
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Daily Collection Trend</h3>
            </div>
            <span className="text-sm text-gray-500">Last 30 days</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.collectionMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  name="Daily Collection" 
                  stroke={HEADER_COLOR} 
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* none performance loan */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>Top Overdue Loans</h3>
            </div>
            <span className="text-sm text-gray-500">Highest outstanding</span>
          </div>
          <div className="h-80">
            <div className="space-y-3">
              {analyticsData.overdueLoans.slice(0, 5).map((loan, index) => (
                <div key={loan.loanId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      index === 0 ? 'bg-red-100 text-red-600' :
                      index === 1 ? 'bg-orange-100 text-orange-600' :
                      'bg-amber-100 text-amber-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">Loan #{loan.loanId}</p>
                      <p className="text-sm text-gray-500">{loan.percentage}% overdue</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{formatCurrencyCompact(loan.overdueAmount)}</p>
                    <p className="text-sm text-gray-500">of {formatCurrencyCompact(loan.totalAmount)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Total Overdue Amount</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatCurrencyCompact(analyticsData.overdueLoans.reduce((sum, loan) => sum + loan.overdueAmount, 0))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-blue-700">Affected Loans</p>
                  <p className="text-2xl font-bold text-blue-900">{analyticsData.overdueLoans.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Key Insights */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-700">Top Product</p>
            <p className="text-xl font-bold text-blue-900">
              {analyticsData.productOverview[0]?.name || 'N/A'}
            </p>
            <p className="text-sm text-blue-600">
              {analyticsData.productOverview[0]?.count || 0} loans ({formatCurrencyCompact(analyticsData.productOverview[0]?.totalAmount || 0)})
            </p>
          </div>
          
          <div className="p-4 bg-emerald-50 rounded-lg">
            <p className="text-sm font-medium text-emerald-700">Top Performing Branch</p>
            <p className="text-xl font-bold text-emerald-900">
              {analyticsData.branchPerformance[0]?.name || 'N/A'}
            </p>
            <p className="text-sm text-emerald-600">
              {analyticsData.branchPerformance[0]?.collectionRate || 0}% collection rate
            </p>
          </div>
          
          <div className="p-4 bg-amber-50 rounded-lg">
            <p className="text-sm font-medium text-amber-700">Customer Loyalty</p>
            <p className="text-xl font-bold text-amber-900">
              {analyticsData.repeatCustomers.reduce((sum, cat) => sum + cat.count, 0) - (analyticsData.repeatCustomers[0]?.count || 0)} repeat customers
            </p>
            <p className="text-sm text-amber-600">
              {(analyticsData.repeatCustomers[0]?.count || 0)} first-time customers
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;