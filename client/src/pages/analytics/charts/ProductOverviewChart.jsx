import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { PieChart, Download, Filter, Calendar, Globe, Building } from 'lucide-react';
import { supabase } from "../../../supabaseClient";

// Constants
const HEADER_COLOR = "#586ab1";
const SUB_PRODUCT_COLORS = {
  0: "#10b981", // Green
  1: "#f59e0b", // Amber
  2: "#8b5cf6", // Purple
  3: "#ef4444", // Red
  4: "#06b6d4", // Cyan
  5: "#ec4899", // Pink
  6: "#84cc16", // Lime
  7: "#f97316"  // Orange
};

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  
  const productData = payload[0]?.payload;
  
  return (
    <div 
      className="bg-white p-4 rounded-lg shadow-xl border border-gray-200"
      style={{ 
        zIndex: 10000,
        pointerEvents: 'none',
        minWidth: '280px',
        maxWidth: '320px'
      }}
    >
      <p className="font-bold text-slate-600 mb-3 text-sm border-b pb-2">
        {productData?.productName}
      </p>
      
      <div className="space-y-2 mb-3">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Total Loans:</span>
          <span className="text-slate-600 font-bold text-xs">{productData?.totalCount}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Total Amount:</span>
          <span className="text-green-600 font-semibold text-xs">
            Ksh {productData?.totalAmount?.toLocaleString()}
          </span>
        </div>
      
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Avg Loan Size:</span>
          <span className="text-slate-600 font-bold text-xs">
            Ksh {productData?.avgLoanSize?.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Sub-products breakdown */}
      {productData?.subProducts && productData.subProducts.length > 0 && (
        <div className="border-t pt-2">
          <p className="text-xs font-semibold text-gray-700 mb-2">Product Types </p>
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {productData.subProducts.map((sub, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                {/* Product Type Name */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: SUB_PRODUCT_COLORS[idx % 8] }}
                    />
                    <span className="text-xs font-medium text-gray-700 truncate">{sub.name}</span>
                  </div>
                  <span className="text-xs text-gray-500 font-medium">
                    {sub.percentage}%
                  </span>
                </div>
                
                {/* Count and Amount */}
                <div className="flex justify-between items-center pl-4">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-600">Count:</span>
                    <span className="text-xs font-semibold text-slate-700">{sub.count}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-gray-600">Amount:</span>
                    <span className="text-xs font-semibold text-green-600">
                      Ksh {sub.amount?.toLocaleString()}
                    </span>
                  </div>
                </div>
                
                {/* Divider except for last item */}
                {idx < productData.subProducts.length - 1 && (
                  <div className="border-t border-gray-100 pt-1"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function for date filtering
const getDateFilter = (dateRange, isThisPeriod = false) => {
  const now = new Date();
  const dateFilter = new Date();
  
  switch(dateRange) {
    case 'week':
      if (isThisPeriod) {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        dateFilter.setDate(diff);
        dateFilter.setHours(0, 0, 0, 0);
      } else {
        dateFilter.setDate(dateFilter.getDate() - 7);
      }
      break;
    case 'month':
      if (isThisPeriod) {
        dateFilter.setDate(1);
        dateFilter.setHours(0, 0, 0, 0);
      } else {
        dateFilter.setMonth(dateFilter.getMonth() - 1);
      }
      break;
    case 'quarter':
      if (isThisPeriod) {
        const quarter = Math.floor(now.getMonth() / 3);
        dateFilter.setMonth(quarter * 3, 1);
        dateFilter.setHours(0, 0, 0, 0);
      } else {
        dateFilter.setMonth(now.getMonth() - 3);
      }
      break;
    case '6months':
      dateFilter.setMonth(now.getMonth() - 6);
      break;
    case 'year':
      if (isThisPeriod) {
        dateFilter.setFullYear(now.getFullYear(), 0, 1);
        dateFilter.setHours(0, 0, 0, 0);
      } else {
        dateFilter.setFullYear(now.getFullYear() - 1);
      }
      break;
    default:
      return null;
  }
  
  return dateFilter.toISOString();
};

// Fetch function for product breakdown with region and branch filters
const fetchProductBreakdown = async (dateRange, selectedRegion, selectedBranch, customDateRange) => {
  try {
    let query = supabase
      .from('loans')
      .select('product_name, product_type, scored_amount, total_payable, created_at, branch_id, region_id')
      .eq('status', 'disbursed');

    // Filter by branch if specified
    if (selectedBranch !== 'all') {
      query = query.eq('branch_id', selectedBranch);
    } else if (selectedRegion !== 'all') {
      // Filter by region if specified
      const { data: regionData } = await supabase
        .from('regions')
        .select('id')
        .eq('name', selectedRegion)
        .single();
      
      if (regionData) {
        // Get all branches in this region
        const { data: branchesInRegion } = await supabase
          .from('branches')
          .select('id')
          .eq('region_id', regionData.id);
        
        if (branchesInRegion?.length > 0) {
          const branchIds = branchesInRegion.map(b => b.id);
          query = query.in('branch_id', branchIds);
        }
      }
    }

    // Handle date filtering
    if (customDateRange?.startDate && customDateRange?.endDate) {
      query = query
        .gte('created_at', customDateRange.startDate)
        .lte('created_at', customDateRange.endDate);
    } else if (dateRange !== 'all') {
      const dateFilter = getDateFilter(dateRange, true);
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching product breakdown:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Group by product_name and product_type
    const productMap = {};
    
    data.forEach(loan => {
      const productName = loan.product_name || 'Unknown';
      const productType = loan.product_type || 'Unknown';
      
      // Initialize product if not exists
      if (!productMap[productName]) {
        productMap[productName] = {
          productName,
          types: {},
          totalCount: 0,
          totalAmount: 0,
          totalPayable: 0
        };
      }
      
      // Initialize product type if not exists
      if (!productMap[productName].types[productType]) {
        productMap[productName].types[productType] = {
          name: productType,
          count: 0,
          amount: 0
        };
      }
      
      // Aggregate data
      const scoredAmount = Number(loan.scored_amount) || 0;
      const payableAmount = Number(loan.total_payable) || 0;
      
      productMap[productName].types[productType].count++;
      productMap[productName].types[productType].amount += scoredAmount;
      productMap[productName].totalCount++;
      productMap[productName].totalAmount += scoredAmount;
      productMap[productName].totalPayable += payableAmount;
    });

    // Transform to chart format
    const chartData = Object.values(productMap).map(product => {
      const subProducts = Object.values(product.types).map(type => ({
        name: type.name,
        count: type.count,
        amount: type.amount,
        percentage: Math.round((type.count / product.totalCount) * 100 * 10) / 10
      }));

      // Sort sub-products by amount descending
      subProducts.sort((a, b) => b.amount - a.amount);

      // Create dynamic properties for stacked bars
      const chartDataObj = {
        productName: product.productName,
        totalCount: product.totalCount,
        totalAmount: Math.round(product.totalAmount),
        totalPayable: Math.round(product.totalPayable),
        avgLoanSize: product.totalCount > 0 
          ? Math.round(product.totalAmount / product.totalCount) 
          : 0,
        subProducts
      };

      // Add each sub-product as a separate property for stacking using AMOUNT
      subProducts.forEach((sub, idx) => {
        chartDataObj[`type_${idx}`] = sub.amount;
      });

      return chartDataObj;
    });

    // Sort by total amount descending
    return chartData.sort((a, b) => b.totalAmount - a.totalAmount);

  } catch (error) {
    console.error("Error in fetchProductBreakdown:", error);
    return [];
  }
};

const ProductBreakdownChart = () => {
  const [localData, setLocalData] = useState([]);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [localFilters, setLocalFilters] = useState({
    dateRange: 'all',
    region: 'all',
    branch: 'all',
    customStartDate: '',
    customEndDate: ''
  });
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState(null);

  // Fetch available regions and branches on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      // Fetch all regions
      const { data: regionsData } = await supabase
        .from('regions')
        .select('id, name')
        .order('name');
      
      if (regionsData) {
        setAvailableRegions(regionsData);
      }
      
      // Fetch all branches
      const { data: branchesData } = await supabase
        .from('branches')
        .select('id, name, code, region_id')
        .order('name');
      
      if (branchesData) {
        setAvailableBranches(branchesData);
      }
      
      // Fetch initial product data
      const productData = await fetchProductBreakdown('all', 'all', 'all', null);
      setLocalData(productData);
    };
    
    fetchInitialData();
  }, []);

  // Filter branches by selected region
  useEffect(() => {
    if (localFilters.region === 'all') {
      setSelectedRegionId(null);
    } else {
      const region = availableRegions.find(r => r.name === localFilters.region);
      setSelectedRegionId(region?.id || null);
    }
  }, [localFilters.region, availableRegions]);

  const filteredBranches = localFilters.region === 'all' 
    ? availableBranches 
    : availableBranches.filter(branch => branch.region_id === selectedRegionId);

  // Fetch data with filters
  const fetchDataWithFilters = useCallback(async (filters, customDateRange = null) => {
    try {
      const productData = await fetchProductBreakdown(
        filters.dateRange,
        filters.region,
        filters.branch,
        customDateRange
      );
      setLocalData(productData);
    } catch (error) {
      console.error("Error fetching product data:", error);
      setLocalData([]);
    }
  }, []);

  // Handle filter changes
  const handleLocalFilterChange = useCallback(async (key, value) => {
    const newFilters = { ...localFilters };
    
    // Reset branch when region changes
    if (key === 'region') {
      newFilters.region = value;
      newFilters.branch = 'all';
      
      // Update selected region ID
      if (value === 'all') {
        setSelectedRegionId(null);
      } else {
        const region = availableRegions.find(r => r.name === value);
        setSelectedRegionId(region?.id || null);
      }
    } else if (key === 'dateRange') {
      newFilters.dateRange = value;
      if (value === 'custom') {
        setShowCustomDate(true);
        return;
      } else {
        setShowCustomDate(false);
      }
    } else {
      newFilters[key] = value;
    }
    
    setLocalFilters(newFilters);
    
    // Prepare custom date range if applicable
    let customDateRange = null;
    if (newFilters.dateRange === 'custom' && newFilters.customStartDate && newFilters.customEndDate) {
      customDateRange = {
        startDate: newFilters.customStartDate,
        endDate: newFilters.customEndDate
      };
    }
    
    fetchDataWithFilters(newFilters, customDateRange);
  }, [localFilters, availableRegions, fetchDataWithFilters]);

  // Apply custom date filter
  const applyCustomDateFilter = useCallback(async () => {
    if (localFilters.customStartDate && localFilters.customEndDate) {
      const customDateRange = {
        startDate: localFilters.customStartDate,
        endDate: localFilters.customEndDate
      };
      await fetchDataWithFilters({ ...localFilters, dateRange: 'custom' }, customDateRange);
    }
  }, [localFilters, fetchDataWithFilters]);

  // Export function
  const handleExport = useCallback(() => {
    if (!localData || localData.length === 0) return;
    
    const csvRows = [];
    csvRows.push(['Product Name', 'Product Type', 'Count', 'Amount', 'Percentage']);
    
    localData.forEach(product => {
      product.subProducts?.forEach(sub => {
        csvRows.push([
          product.productName,
          sub.name,
          sub.count,
          sub.amount,
          sub.percentage
        ]);
      });
    });
    
    const csv = csvRows.map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-breakdown-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [localData]);

  // Get max number of sub-products for rendering bars
  const maxSubProducts = Math.max(...localData.map(p => p.subProducts?.length || 0), 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PieChart className="w-6 h-6" style={{ color: HEADER_COLOR }} />
          <h3 className="text-lg font-semibold" style={{ color: HEADER_COLOR }}>
            Product  Distribution
          </h3>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          disabled={!localData || localData.length === 0}
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="grid grid-cols-4 gap-3 items-center">
          {/* Date Range */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={localFilters.dateRange}
              onChange={(e) => handleLocalFilterChange('dateRange', e.target.value)}
              className="bg-transparent border-none text-sm focus:outline-none w-full"
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="6months">Last 6 Months</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Region */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
            <Globe className="w-4 h-4 text-gray-500" />
            <select
              value={localFilters.region}
              onChange={(e) => handleLocalFilterChange('region', e.target.value)}
              className="bg-transparent border-none text-sm focus:outline-none w-full"
            >
              <option value="all">All Regions</option>
              {availableRegions.map(region => (
                <option key={region.id} value={region.name}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
            <Building className="w-4 h-4 text-gray-500" />
            <select
              value={localFilters.branch}
              onChange={(e) => handleLocalFilterChange('branch', e.target.value)}
              className="bg-transparent border-none text-sm focus:outline-none w-full"
            >
              <option value="all">All Branches</option>
              {filteredBranches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {showCustomDate && (
          <div className="mt-4 flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <input
                type="date"
                value={localFilters.customStartDate}
                onChange={(e) => handleLocalFilterChange('customStartDate', e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                value={localFilters.customEndDate}
                onChange={(e) => handleLocalFilterChange('customEndDate', e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
            <button
              onClick={applyCustomDateFilter}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              disabled={!localFilters.customStartDate || !localFilters.customEndDate}
            >
              Apply
            </button>
          </div>
        )}
      </div>
      
      {/* Chart */}
      <div className="h-96">
        {localData && localData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={localData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="productName" 
                angle={-45} 
                textAnchor="end" 
                height={80}
                fontSize={12}
              />
              <YAxis 
                fontSize={12}
                tickFormatter={(value) => `Ksh ${(value / 1000).toFixed(0)}k`}
                label={{ value: 'Loan Amount (Ksh)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(88, 106, 177, 0.1)' }}
                wrapperStyle={{ 
                  zIndex: 10000,
                  outline: 'none'
                }}
                position={{ y: 0 }}
                allowEscapeViewBox={{ x: true, y: true }}
              />
              <Legend
                verticalAlign="bottom"
                align="center"
                height={36}
                wrapperStyle={{ fontSize: 11 }}
                payload={localData[0]?.subProducts?.map((sub, idx) => ({
                  value: sub.name,
                  type: 'rect',
                  color: SUB_PRODUCT_COLORS[idx % 8]
                })) || []}
              />
              {Array.from({ length: maxSubProducts }).map((_, idx) => (
                <Bar 
                  key={idx}
                  dataKey={`type_${idx}`} 
                  stackId="a"
                  fill={SUB_PRODUCT_COLORS[idx % 8]}
                  radius={idx === (maxSubProducts - 1) ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <PieChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No product data available</p>
              <p className="text-gray-400 text-sm mt-1">
                Try adjusting your filters or date range
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default ProductBreakdownChart;