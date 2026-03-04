import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { PieChart, Download, Calendar, Globe, Building } from 'lucide-react';
import { supabase } from "../../../supabaseClient";
import { useTenant } from "../../../hooks/useTenant";

// Constants
const HEADER_COLOR = "#586ab1";
const SUB_PRODUCT_COLORS = {
  0: "#10b981",
  1: "#f59e0b",
  2: "#8b5cf6",
  3: "#ef4444",
  4: "#06b6d4",
  5: "#ec4899",
  6: "#84cc16",
  7: "#f97316"
};

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const productData = payload[0]?.payload;

  return (
    <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-white/40 min-w-[340px] relative z-[9999]">
      <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
        <div className="p-2 bg-amber-50 rounded-lg">
          <PieChart className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Product Analysis</p>
          <p className="font-black text-slate-800 text-base">{productData?.productName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Total Loans</p>
          <p className="text-xl font-black text-slate-700">{productData?.totalCount}</p>
        </div>
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter mb-1">Total Amount</p>
          <p className="text-xl font-black text-emerald-700 tracking-tight">Ksh {productData?.totalAmount?.toLocaleString()}</p>
        </div>
      </div>

      {productData?.subProducts && productData.subProducts.length > 0 && (
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Product Types</p>
          {productData.subProducts.map((sub, idx) => (
            <div key={idx} className="p-3 bg-white rounded-xl border border-slate-50 shadow-sm hover:border-indigo-100 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: SUB_PRODUCT_COLORS[idx % 8] }} />
                  <span className="text-xs font-black text-slate-700">{sub.name}</span>
                </div>
                <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{sub.percentage}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase">Count</span>
                  <p className="text-xs font-bold text-slate-600">{sub.count}</p>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-black text-slate-400 uppercase">Amount</span>
                  <p className="text-xs font-black text-emerald-600 tracking-tight">Ksh {sub.amount?.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Helper function for date filtering
const getDateFilter = (dateRange, isThisPeriod = false) => {
  const now = new Date();
  const dateFilter = new Date();

  switch (dateRange) {
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

// Fetch function for product breakdown
const fetchProductBreakdown = async (dateRange, selectedRegion, selectedBranch, customDateRange, tenantId) => {
  try {
    let query = supabase
      .from('loans')
      .select('product_name, product_type, scored_amount, total_payable, created_at, branch_id, region_id')
      .eq('status', 'disbursed')
      .eq('tenant_id', tenantId);

    if (selectedBranch !== 'all') {
      query = query.eq('branch_id', selectedBranch);
    } else if (selectedRegion !== 'all') {
      const { data: regionData } = await supabase
        .from('regions')
        .select('id')
        .eq('name', selectedRegion)
        .eq('tenant_id', tenantId)
        .single();

      if (regionData) {
        const { data: branchesInRegion } = await supabase
          .from('branches')
          .select('id')
          .eq('region_id', regionData.id)
          .eq('tenant_id', tenantId);

        if (branchesInRegion?.length > 0) {
          query = query.in('branch_id', branchesInRegion.map(b => b.id));
        }
      }
    }

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

    if (!data || data.length === 0) return [];

    const productMap = {};

    data.forEach(loan => {
      const productName = loan.product_name || 'Unknown';
      const productType = loan.product_type || 'Unknown';

      if (!productMap[productName]) {
        productMap[productName] = { productName, types: {}, totalCount: 0, totalAmount: 0, totalPayable: 0 };
      }
      if (!productMap[productName].types[productType]) {
        productMap[productName].types[productType] = { name: productType, count: 0, amount: 0 };
      }

      const scoredAmount = Number(loan.scored_amount) || 0;
      const payableAmount = Number(loan.total_payable) || 0;

      productMap[productName].types[productType].count++;
      productMap[productName].types[productType].amount += scoredAmount;
      productMap[productName].totalCount++;
      productMap[productName].totalAmount += scoredAmount;
      productMap[productName].totalPayable += payableAmount;
    });

    const chartData = Object.values(productMap).map(product => {
      const subProducts = Object.values(product.types)
        .map(type => ({
          name: type.name,
          count: type.count,
          amount: type.amount,
          percentage: Math.round((type.count / product.totalCount) * 1000) / 10
        }))
        .sort((a, b) => b.amount - a.amount);

      const chartDataObj = {
        productName: product.productName,
        totalCount: product.totalCount,
        totalAmount: Math.round(product.totalAmount),
        totalPayable: Math.round(product.totalPayable),
        avgLoanSize: product.totalCount > 0 ? Math.round(product.totalAmount / product.totalCount) : 0,
        subProducts
      };

      subProducts.forEach((sub, idx) => {
        chartDataObj[`type_${idx}`] = sub.amount;
      });

      return chartDataObj;
    });

    return chartData.sort((a, b) => b.totalAmount - a.totalAmount);

  } catch (error) {
    console.error("Error in fetchProductBreakdown:", error);
    return [];
  }
};

// Main Component
const ProductBreakdownChart = () => {
  const { tenant } = useTenant();
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
  const [loading, setLoading] = useState(false);

  const fetchDataWithFilters = useCallback(async (filters, customDateRange = null) => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const productData = await fetchProductBreakdown(
        filters.dateRange,
        filters.region,
        filters.branch,
        customDateRange,
        tenant.id
      );
      setLocalData(productData);
    } catch (error) {
      console.error("Error fetching product data:", error);
      setLocalData([]);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: regionsData } = await supabase
          .from('regions')
          .select('id, name')
          .eq('tenant_id', tenant.id)
          .order('name');

        if (regionsData) setAvailableRegions(regionsData);

        const { data: branchesData } = await supabase
          .from('branches')
          .select('id, name, code, region_id')
          .eq('tenant_id', tenant.id)
          .order('name');

        if (branchesData) setAvailableBranches(branchesData);

        await fetchDataWithFilters({ dateRange: 'all', region: 'all', branch: 'all' });
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };

    if (tenant?.id) fetchInitialData();
  }, [tenant?.id, fetchDataWithFilters]);

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

  const handleLocalFilterChange = useCallback(async (key, value) => {
    const newFilters = { ...localFilters };

    if (key === 'region') {
      newFilters.region = value;
      newFilters.branch = 'all';
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
        setLocalFilters(newFilters);
        return;
      } else {
        setShowCustomDate(false);
      }
    } else {
      newFilters[key] = value;
    }

    setLocalFilters(newFilters);

    const customDateRange =
      newFilters.dateRange === 'custom' && newFilters.customStartDate && newFilters.customEndDate
        ? { startDate: newFilters.customStartDate, endDate: newFilters.customEndDate }
        : null;

    fetchDataWithFilters(newFilters, customDateRange);
  }, [localFilters, availableRegions, fetchDataWithFilters]);

  const applyCustomDateFilter = useCallback(async () => {
    if (localFilters.customStartDate && localFilters.customEndDate) {
      await fetchDataWithFilters(
        { ...localFilters, dateRange: 'custom' },
        { startDate: localFilters.customStartDate, endDate: localFilters.customEndDate }
      );
    }
  }, [localFilters, fetchDataWithFilters]);

  const handleExport = useCallback(() => {
    if (!localData || localData.length === 0) return;

    const csvRows = [['Product Name', 'Product Type', 'Count', 'Amount', 'Percentage']];

    localData.forEach(product => {
      product.subProducts?.forEach(sub => {
        csvRows.push([product.productName, sub.name, sub.count, sub.amount, sub.percentage]);
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

  const maxSubProducts = Math.max(...localData.map(p => p.subProducts?.length || 0), 0);

  const filterConfigs = [
    {
      icon: <Calendar className="w-4 h-4 text-slate-500 shrink-0" />,
      value: localFilters.dateRange,
      onChange: (e) => handleLocalFilterChange('dateRange', e.target.value),
      options: [
        { value: "all", label: "All Time" },
        { value: "week", label: "This Week" },
        { value: "month", label: "This Month" },
        { value: "quarter", label: "This Quarter" },
        { value: "6months", label: "Last 6 Months" },
        { value: "year", label: "This Year" },
        { value: "custom", label: "Custom Range" }
      ]
    },
    {
      icon: <Globe className="w-4 h-4 text-slate-500 shrink-0" />,
      value: localFilters.region,
      onChange: (e) => handleLocalFilterChange('region', e.target.value),
      options: [
        { value: "all", label: "All Regions" },
        ...availableRegions.map(r => ({ value: r.name, label: r.name }))
      ]
    },
    {
      icon: <Building className="w-4 h-4 text-slate-500 shrink-0" />,
      value: localFilters.branch,
      onChange: (e) => handleLocalFilterChange('branch', e.target.value),
      options: [
        { value: "all", label: "All Branches" },
        ...filteredBranches.map(b => ({ value: b.id, label: b.name }))
      ]
    }
  ];

  return (
    <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 p-8 transition-all duration-300 hover:shadow-2xl relative hover:z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg text-stone-600 whitespace-nowrap">Loan Product Overview</h3>

        <button
          onClick={handleExport}
          disabled={!localData || localData.length === 0}
          className="flex items-center gap-2 text-stone-500 hover:text-stone-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-stone-200 hover:bg-stone-50"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
      </div>

      <div className="mb-4 mt-2">
        <div className="flex flex-nowrap items-center gap-2 relative z-20 w-full overflow-hidden">
          {filterConfigs.map((item, idx) => (
            <div key={idx} className="flex-1 min-w-0 flex items-center h-8 gap-1.5 px-2 rounded-lg border border-stone-200 bg-transparent hover:border-stone-300 transition focus-within:ring-1 focus-within:ring-stone-400/20">
              {item.icon && React.cloneElement(item.icon, { className: "w-3.5 h-3.5 text-stone-400 shrink-0" })}
              <select
                value={item.value}
                onChange={item.onChange}
                disabled={loading}
                className="w-full bg-transparent text-[10px] font-bold text-stone-600 focus:outline-none cursor-pointer py-1 truncate"
              >
                {item.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {showCustomDate && (
          <div className="mt-4 flex flex-wrap items-center gap-3 bg-stone-50/50 p-3 rounded-lg border border-stone-100">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <input
              type="date"
              value={localFilters.customStartDate}
              onChange={(e) => handleLocalFilterChange('customStartDate', e.target.value)}
              className="h-8 px-2 text-xs font-bold rounded border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
            />
            <span className="text-stone-300">→</span>
            <input
              type="date"
              value={localFilters.customEndDate}
              onChange={(e) => handleLocalFilterChange('customEndDate', e.target.value)}
              className="h-8 px-2 text-xs font-bold rounded border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
            />
            <button
              onClick={applyCustomDateFilter}
              disabled={!localFilters.customStartDate || !localFilters.customEndDate}
              className="h-8 px-4 rounded text-xs font-bold text-white bg-stone-600 hover:bg-stone-700 transition-all disabled:opacity-50"
            >
              Update
            </button>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-96">
        {localData && localData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={localData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="productName"
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis
                fontSize={10}
                fontWeight="bold"
                tickFormatter={(value) => value.toLocaleString()}
                label={{ value: 'Loan Amount (Ksh)', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8', fontWeight: 'bold', fontSize: '10px' } }}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(88, 106, 177, 0.1)' }}
                wrapperStyle={{ zIndex: 10000, outline: 'none' }}
                position={{ y: 0 }}
                allowEscapeViewBox={{ x: true, y: true }}
              />
              <Legend
                verticalAlign="bottom"
                align="center"
                height={36}
                wrapperStyle={{ fontSize: 11 }}
                payload={
                  localData[0]?.subProducts?.map((sub, idx) => ({
                    value: sub.name,
                    type: 'rect',
                    color: SUB_PRODUCT_COLORS[idx % 8]
                  })) || []
                }
              />
              {Array.from({ length: maxSubProducts }).map((_, idx) => (
                <Bar
                  key={idx}
                  dataKey={`type_${idx}`}
                  stackId="a"
                  fill={SUB_PRODUCT_COLORS[idx % 8]}
                  radius={idx === maxSubProducts - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <PieChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No product data available</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or date range</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductBreakdownChart;