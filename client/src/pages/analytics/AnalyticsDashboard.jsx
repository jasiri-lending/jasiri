// AnalyticsDashboard.jsx
import { useState, useEffect, useCallback } from "react";
import Spinner from "../../components/Spinner";
import { CHART_BG } from "./shared/constants";

// Chart components
import RegionChart from "./charts/RegionPerformanceChart";
import BranchChart from "./charts/BranchPerformanceChart";
import ProductChart from "./charts/ProductOverviewChart";
import CustomerLoyaltyChart from "./charts/CustomerLoyaltyChart";
import RepaymentChart from "./charts/RepaymentTrendsChart";
import CustomerAgeChart from "./charts/CustomerAgeChart";
import BusinessChart from "./charts/BusinessTypesChart";
import GuarantorAgeChart from "./charts/GuarantorAgeChat";
import PayerAnalysisChart from "./charts/PayerTypeChart";
import CountyChart from "./charts/Countchart";
import MaritalStatusChart from "./charts/MaritalStatusChart";
import NPLChart from "./charts/NPLChat";

// Import all fetch functions
import {
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
  fetchCustomerAges,
  fetchMaritalStatusData,
  fetchNPLData
} from "./analyticsDataFetchers";

// SummaryStats Component
const SummaryStats = ({ totalDisbursed, totalLoans, totalBranches, avgCollectionRate }) => (
  <div className="col-span-1 lg:col-span-2">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow-sm border border-blue-200">
        <p className="text-sm text-blue-700 mb-2">Total Disbursed</p>
        <p className="text-2xl font-bold text-blue-900">
          Ksh {totalDisbursed?.toLocaleString() || '0'}
        </p>
        <p className="text-xs text-blue-600 mt-2">All Regions</p>
      </div>
      
      <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow-sm border border-green-200">
        <p className="text-sm text-green-700 mb-2">Total Loans</p>
        <p className="text-2xl font-bold text-green-900">
          {totalLoans?.toLocaleString() || '0'}
        </p>
        <p className="text-xs text-green-600 mt-2">Active Portfolio</p>
      </div>
      
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl shadow-sm border border-purple-200">
        <p className="text-sm text-purple-700 mb-2">Collection Rate</p>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-bold text-purple-900">
            {avgCollectionRate?.toFixed(1) || '0'}%
          </p>
        </div>
        <p className="text-xs text-purple-600 mt-2">Average</p>
      </div>
      
      <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl shadow-sm border border-orange-200">
        <p className="text-sm text-orange-700 mb-2">Total Branches</p>
        <p className="text-2xl font-bold text-orange-900">
          {totalBranches?.toLocaleString() || '0'}
        </p>
        <p className="text-xs text-orange-600 mt-2">Nationwide</p>
      </div>
    </div>
  </div>
);

const AnalyticsDashboard = () => {
  const [analyticsData, setAnalyticsData] = useState({
    productOverview: [],
    branchPerformance: [],
    regionPerformance: [],
    payerTypeBreakdown: [],
    payerTypePieData: [],
    repaymentTrends: [],
    businessTypes: [],
    ageGenderDistribution: [],
    repeatCustomers: [],
    collectionMetrics: [],
    overdueLoans: [],
    customerDistribution: [],
    customerAges: [],
    maritalStatusData: [],
    nplData: []
  });
  
  const [globalFilters, setGlobalFilters] = useState({
    dateRange: 'all',
    region: 'all',
    branch: 'all'
  });

  // Calculate summary stats
  const calculateSummaryStats = () => {
    const totalDisbursed = analyticsData.regionPerformance.reduce(
      (sum, region) => sum + (region.totalDisbursed || 0), 0
    );
    
    const totalLoans = analyticsData.regionPerformance.reduce(
      (sum, region) => sum + (region.loanCount || 0), 0
    );
    
    const totalBranches = analyticsData.branchPerformance.length || 0;
    
    const avgCollectionRate = analyticsData.regionPerformance.length > 0
      ? analyticsData.regionPerformance.reduce(
          (sum, region) => sum + (region.collectionRate || 0), 0
        ) / analyticsData.regionPerformance.length
      : 0;

    return {
      totalDisbursed: Math.round(totalDisbursed),
      totalLoans,
      totalBranches,
      avgCollectionRate: Math.round(avgCollectionRate * 10) / 10
    };
  };

  const fetchAnalyticsData = useCallback(async () => {
    try {

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
        customerAgeData,
        maritalStatusData,
        nplData
      ] = await Promise.all([
        fetchProductOverview(globalFilters.dateRange),
        fetchBranchPerformance(globalFilters.dateRange, globalFilters.branch),
        fetchRegionPerformance(globalFilters.dateRange, globalFilters.region),
        fetchPayerTypeAnalysis(globalFilters.dateRange, globalFilters.region, globalFilters.branch),
        fetchRepaymentTrends(globalFilters.dateRange),
        fetchBusinessTypes(),
        fetchAgeGenderDistribution(),
        fetchRepeatCustomers(),
        fetchCollectionMetrics(),
        fetchOverdueLoans(),
        fetchCountyAnalysis(),
        fetchCustomerDistribution(),
        fetchCustomerAges(),
        fetchMaritalStatusData(),
        fetchNPLData()
      ]);

      setAnalyticsData({
        productOverview: productData,
        branchPerformance: branchData,
        regionPerformance: regionData,
        payerTypeBreakdown: payerTypeData.payerTypeBreakdown || [],
        payerTypePieData: payerTypeData.payerTypePieData || [],
        repaymentTrends: repaymentData,
        businessTypes: businessData,
        ageGenderDistribution: demographicData,
        repeatCustomers: repeatCustomerData,
        collectionMetrics: collectionMetrics,
        overdueLoans: overdueData,
        countyAnalysis: countyData,
        customerDistribution: customerDistributionData,
        customerAges: customerAgeData,
        maritalStatusData: maritalStatusData,
        nplData: nplData
      });

    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } 
  }, [globalFilters]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const handleGlobalFilterChange = (key, value) => {
    setGlobalFilters(prev => ({ ...prev, [key]: value }));
  };

  const summaryStats = calculateSummaryStats();

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ backgroundColor: CHART_BG }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-sm md:text-sm font-bold text-slate-600 mb-2">
          Loan Portfolio Analytics
        </h1>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Summary Stats */}
        <SummaryStats {...summaryStats} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Row 1: Region and Branch */}
        <RegionChart 
          data={analyticsData.regionPerformance}
          filters={globalFilters}
          onFilterChange={handleGlobalFilterChange}
        />
        <BranchChart 
          data={analyticsData.branchPerformance}
          filters={globalFilters}
          onFilterChange={handleGlobalFilterChange}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Row 2: Product and Customer Loyalty */}
        <ProductChart 
          data={analyticsData.productOverview}
          filters={globalFilters}
          onFilterChange={handleGlobalFilterChange}
        />
        <CustomerLoyaltyChart 
          data={analyticsData.repeatCustomers}
          filters={globalFilters}
          onFilterChange={handleGlobalFilterChange}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* Row 3: Repayment (3/4) and Customer Age (1/4) */}
        <div className="lg:col-span-3">
          <RepaymentChart 
            data={analyticsData.repaymentTrends}
            filters={globalFilters}
            onFilterChange={handleGlobalFilterChange}
          />
        </div>
        <div className="lg:col-span-1">
          <CustomerAgeChart 
            data={analyticsData.customerAges}
            filters={globalFilters}
            onFilterChange={handleGlobalFilterChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* Row 4: Business (3/4) and Guarantor Age (1/4) */}
        <div className="lg:col-span-3">
          <BusinessChart 
            data={analyticsData.businessTypes}
            filters={globalFilters}
            onFilterChange={handleGlobalFilterChange}
          />
        </div>
        <div className="lg:col-span-1">
          <GuarantorAgeChart 
            data={analyticsData.ageGenderDistribution}
            filters={globalFilters}
            onFilterChange={handleGlobalFilterChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Row 5: Payer Analysis and County */}
        <PayerAnalysisChart 
          barData={analyticsData.payerTypeBreakdown}
          pieData={analyticsData.payerTypePieData}
          filters={globalFilters}
          onFilterChange={handleGlobalFilterChange}
        />
        <CountyChart 
          data={analyticsData.customerDistribution}
          filters={globalFilters}
          onFilterChange={handleGlobalFilterChange}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Row 6: Marital Status and NPL */}
        <MaritalStatusChart 
          data={analyticsData.maritalStatusData}
          filters={globalFilters}
          onFilterChange={handleGlobalFilterChange}
        />
        <NPLChart 
          data={analyticsData.nplData || analyticsData.overdueLoans}
          filters={globalFilters}
          onFilterChange={handleGlobalFilterChange}
        />
      </div>
    </div>
  );
};

export default AnalyticsDashboard;