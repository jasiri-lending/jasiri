import { supabase } from "../../supabaseClient";


// const getDateFilter = (dateRange) => {
//   const now = new Date();
//   const dateFilter = new Date();
  
//   switch(dateRange) {
//     case 'week':
//       dateFilter.setDate(now.getDate() - 7);
//       break;
//     case 'month':
//       dateFilter.setMonth(now.getMonth() - 1);
//       break;
//     case 'quarter':
//       dateFilter.setMonth(now.getMonth() - 3);
//       break;
//     case '6months':
//       dateFilter.setMonth(now.getMonth() - 6);
//       break;
//     case 'year':
//       dateFilter.setFullYear(now.getFullYear() - 1);
//       break;
//     default:
//       return null;
//   }
  
//   return dateFilter.toISOString();
// };

// 1. Product Overview
export const fetchProductOverview = async (dateRange) => {
  let query = supabase
    .from('loans')
    .select('product_type, scored_amount, status, total_payable, created_at')
    .eq('status', 'disbursed');

  if (dateRange !== 'all') {
    const dateFilter = getDateFilter(dateRange);
    query = query.gte('created_at', dateFilter);
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
};

// 2. Branch Performance
export const fetchBranchPerformance = async (dateRange, selectedBranch) => {
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
    const dateFilter = getDateFilter(dateRange);
    query = query.gte('created_at', dateFilter);
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
};

// 3. Region Performance

// Enhanced Region Performance with all metrics
export const fetchRegionPerformance = async (dateRange, selectedRegion, customDateRange) => {
  let query = supabase
    .from('loans')
    .select(`
      id,
      scored_amount,
      total_payable,
      status,
      created_at,
      region_id,
      regions!inner(name)
    `)
    .eq('status', 'disbursed');

  if (selectedRegion !== 'all') {
    query = query.eq('region_id', selectedRegion);
  }

  // Handle date filtering
  if (customDateRange?.startDate && customDateRange?.endDate) {
    query = query
      .gte('created_at', customDateRange.startDate)
      .lte('created_at', customDateRange.endDate);
  } else if (dateRange !== 'all') {
    const dateFilter = getDateFilter(dateRange);
    query = query.gte('created_at', dateFilter);
  }

  const { data: loansData, error: loansError } = await query;
  if (loansError) {
    console.error("Error fetching region performance:", loansError);
    return [];
  }

  // Fetch payments for all loans
  const loanIds = loansData.map(loan => loan.id);
  const { data: paymentsData, error: paymentsError } = await supabase
    .from('loan_payments')
    .select('loan_id, paid_amount')
    .in('loan_id', loanIds);

  if (paymentsError) {
    console.error("Error fetching payments:", paymentsError);
  }

  // Group payments by loan
  const paymentsByLoan = {};
  paymentsData?.forEach(payment => {
    if (!paymentsByLoan[payment.loan_id]) {
      paymentsByLoan[payment.loan_id] = 0;
    }
    paymentsByLoan[payment.loan_id] += Number(payment.paid_amount) || 0;
  });

  // Calculate region metrics
  const regionMap = {};
  loansData.forEach(loan => {
    const regionName = loan.regions?.name || 'Unknown';
    
    if (!regionMap[regionName]) {
      regionMap[regionName] = {
        name: regionName,
        totalDisbursed: 0,
        totalPayable: 0,
        totalCollected: 0,
        loanCount: 0,
        loans: []
      };
    }
    
    const loanAmount = Number(loan.scored_amount) || 0;
    const payableAmount = Number(loan.total_payable) || 0;
    const collectedAmount = paymentsByLoan[loan.id] || 0;
    
    regionMap[regionName].totalDisbursed += loanAmount;
    regionMap[regionName].totalPayable += payableAmount;
    regionMap[regionName].totalCollected += collectedAmount;
    regionMap[regionName].loanCount++;
    regionMap[regionName].loans.push({
      id: loan.id,
      disbursed: loanAmount,
      payable: payableAmount,
      collected: collectedAmount
    });
  });

  // Calculate derived metrics for each region
  return Object.values(regionMap).map(region => {
    const totalOutstanding = region.totalPayable - region.totalCollected;
    const collectionRate = region.totalPayable > 0 
      ? (region.totalCollected / region.totalPayable) * 100 
      : 0;
    
    // Calculate NPL (loans with < 70% collection rate)
    const nplLoans = region.loans.filter(loan => {
      const loanCollectionRate = loan.payable > 0 ? (loan.collected / loan.payable) : 0;
      return loanCollectionRate < 0.7;
    });
    
    const nplAmount = nplLoans.reduce((sum, loan) => sum + (loan.payable - loan.collected), 0);
    const nplRate = region.totalPayable > 0 ? (nplAmount / region.totalPayable) * 100 : 0;
    
    // Calculate arrears (overdue amounts)
    const arrearsAmount = Math.max(0, totalOutstanding * 0.6); // Simplified calculation
    
    return {
      name: region.name,
      totalDisbursed: Math.round(region.totalDisbursed),
      totalPayable: Math.round(region.totalPayable),
      totalCollected: Math.round(region.totalCollected),
      totalOutstanding: Math.round(totalOutstanding),
      collectionRate: Math.round(collectionRate * 10) / 10,
      nplAmount: Math.round(nplAmount),
      nplRate: Math.round(nplRate * 10) / 10,
      arrearsAmount: Math.round(arrearsAmount),
      loanCount: region.loanCount,
      avgLoanSize: region.loanCount > 0 
        ? Math.round(region.totalDisbursed / region.loanCount) 
        : 0
    };
  }).sort((a, b) => b.totalDisbursed - a.totalDisbursed);
};

// Helper function for date filtering



// 4. Payer Type Analysis
export const fetchPayerTypeAnalysis = async (dateRange, selectedRegion, selectedBranch) => {
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
    const dateFilter = getDateFilter(dateRange);
    query = query.gte('paid_at', dateFilter);
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
      payerTypeBreakdown: [],
      payerTypePieData: []
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

  // Pie chart data
  const COLORS = [
    "#10b981", "#f59e0b", "#8b5cf6", "#586ab1", 
    "#ef4444", "#06b6d4", "#ec4899", "#84cc16"
  ];
  
  const payerTypePieData = Object.entries(payerTypeTotals)
    .filter(([key, value]) => value.amount > 0)
    .map(([key, value], index) => ({
      name: value.name,
      value: value.amount,
      count: value.count,
      percentage: totalAmount > 0 ? Math.round((value.amount / totalAmount) * 100) : 0,
      color: COLORS[index % COLORS.length]
    }));

  return {
    payerTypeBreakdown,
    payerTypePieData
  };
};

// 5. Repayment Trends
export const fetchRepaymentTrends = async (dateRange) => {
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
};

// 6. Business Types Analysis
export const fetchBusinessTypes = async () => {
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
    const businessType = customer.business_type || 'Unknown';
    if (!businessMap[businessType]) {
      businessMap[businessType] = {
        name: businessType,
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
};

// 7. Age and Gender Distribution
export const fetchAgeGenderDistribution = async () => {
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
};

// 8. Repeat Loan Analysis
export const fetchRepeatCustomers = async () => {
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
};

// 9. Collection Metrics
export const fetchCollectionMetrics = async () => {
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
};

// 10. Overdue Loans Analysis
export const fetchOverdueLoans = async () => {
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
};

// 11. County Analysis
export const fetchCountyAnalysis = async () => {
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
};

// 12. Customer Distribution by County
export const fetchCustomerDistribution = async () => {
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
};

// 13. Customer Age Analysis
export const fetchCustomerAges = async () => {
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
};



// 14. Marital Status Data
export const fetchMaritalStatusData = async () => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('marital_status')
      .not('marital_status', 'is', null);

    if (error) {
      console.error("Error fetching marital status:", error);
      return [];
    }

    const maritalStatusCounts = {};
    data.forEach(customer => {
      const status = customer.marital_status || 'Unknown';
      maritalStatusCounts[status] = (maritalStatusCounts[status] || 0) + 1;
    });

    return Object.entries(maritalStatusCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  } catch (error) {
    console.error("Error in fetchMaritalStatusData:", error);
    return [];
  }
};

// 15. NPL (Non-Performing Loans) Data
export const fetchNPLData = async () => {
  try {
    const { data: loans, error } = await supabase
      .from('loans')
      .select('id, scored_amount, total_payable, weekly_payment, created_at, branch_id, branches(name)')
      .eq('status', 'disbursed')
      .not('repayment_state', 'eq', 'current');

    if (error) {
      console.error("Error fetching NPL data:", error);
      return [];
    }

    const nplAnalysis = [];
    
    loans.forEach(loan => {
      const weeksSinceStart = Math.floor((new Date() - new Date(loan.created_at)) / (7 * 24 * 60 * 60 * 1000));
      const expectedPayment = weeksSinceStart * Number(loan.weekly_payment) || 0;
      
      // Simulate payment data (in real app, fetch actual payments)
      const randomPaid = expectedPayment * (0.5 + Math.random() * 0.3); // 50-80% paid
      const overdueAmount = Math.max(0, expectedPayment - randomPaid);
      
      if (overdueAmount > 0) {
        nplAnalysis.push({
          loanId: loan.id,
          branch: loan.branches?.name || 'Unknown',
          overdueAmount,
          totalAmount: loan.total_payable,
          paidAmount: randomPaid,
          percentage: Math.round((overdueAmount / loan.total_payable) * 100),
          daysOverdue: Math.floor(Math.random() * 90) + 30 // Random 30-120 days
        });
      }
    });

    return nplAnalysis
      .sort((a, b) => b.overdueAmount - a.overdueAmount)
      .slice(0, 15);
  } catch (error) {
    console.error("Error in fetchNPLData:", error);
    return [];
  }
};

// Helper function for date filtering
const getDateFilter = (dateRange) => {
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
  return dateFilter.toISOString();
};

