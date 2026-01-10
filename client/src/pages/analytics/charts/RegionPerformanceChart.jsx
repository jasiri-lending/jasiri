// charts/RegionPerformanceChart.jsx
import  { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Download, Calendar, Globe } from 'lucide-react';
import { supabase } from "../../../supabaseClient";

// Define colors for each metric
const COLORS = {
  totalDisbursed: "#10b981",      // Green
  totalPayable: "#586ab1",        // Blue
  totalCollected: "#f59e0b",      // Amber
  totalOutstanding: "#8b5cf6",    // Purple
  nplAmount: "#f97316",           // Orange
  arrearsAmount: "#ef4444"        // Red
};

const METRIC_LABELS = {
  totalDisbursed: "Total Disbursed",
  totalPayable: "Total Payable",
  totalCollected: "Total Collected",
  totalOutstanding: "Outstanding",
  nplAmount: "NPL Amount",
  arrearsAmount: "Arrears"
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  
  const regionData = payload[0]?.payload;
  
  return (
    <div 
      className="bg-white p-4 rounded-lg shadow-xl border border-gray-200 min-w-80" 
      style={{ 
        zIndex: 10000,
        position: 'relative',
        pointerEvents: 'none'
      }}
    >
      <p className="font-bold text-slate-600 mb-3 text-sm">Region: {label}</p>
      <div className="space-y-2">
        {/* Total Disbursed - Green */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Total Disbursed:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS.totalDisbursed }}>
            Ksh {regionData?.totalDisbursed?.toLocaleString()}
          </span>
        </div>
        
        {/* Total Payable - Blue */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Total Payable:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS.totalPayable }}>
            Ksh {regionData?.totalPayable?.toLocaleString()}
          </span>
        </div>
        
        {/* Total Collected - Amber */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Total Collected:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS.totalCollected }}>
            Ksh {regionData?.totalCollected?.toLocaleString()}
          </span>
        </div>
        
        {/* Outstanding - Purple */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Outstanding:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS.totalOutstanding }}>
            Ksh {regionData?.totalOutstanding?.toLocaleString()}
          </span>
        </div>
        
        {/* Collection Rate - Conditional */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Collection Rate:</span>
          <span className={`font-semibold text-xs ${
            regionData?.collectionRate >= 80 ? 'text-green-600' :
            regionData?.collectionRate >= 60 ? 'text-orange-600' :
            'text-red-600'
          }`}>
            {regionData?.collectionRate}%
          </span>
        </div>
        
        {/* NPL Amount - Orange */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">NPL Amount:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS.nplAmount }}>
            Ksh {regionData?.nplAmount?.toLocaleString()}
          </span>
        </div>
        
        {/* Arrears - Red */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Arrears:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS.arrearsAmount }}>
            Ksh {regionData?.arrearsAmount?.toLocaleString()}
          </span>
        </div>
        
        {/* Loan Count - Default */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Loan Count:</span>
          <span className="text-slate-600 font-bold text-xs">{regionData?.loanCount}</span>
        </div>
        
        {/* Avg Loan Size - Default */}
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Avg Loan Size:</span>
          <span className="text-slate-600  font-bold text-xs">Ksh {regionData?.avgLoanSize?.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};


const getTodayDate = () => {
  const now = new Date();
  const kenyaTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const year = kenyaTime.getUTCFullYear();
  const month = String(kenyaTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kenyaTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

// Optimized fetch function with caching
const fetchRegionPerformance = async (dateRange, selectedRegion, customDateRange) => {
  try {
    let query = supabase
      .from('loans')
      .select(`
        id,
        scored_amount,
        total_payable,
        status,
        created_at,
        disbursed_at,
        region_id,
        regions!inner(name)
      `)
      .eq('status', 'disbursed');

    if (selectedRegion !== 'all') {
      const { data: regionData } = await supabase
        .from('regions')
        .select('id')
        .eq('name', selectedRegion)
        .single();
      
      if (regionData) {
        query = query.eq('region_id', regionData.id);
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

    const { data: loansData, error: loansError } = await query;
    if (loansError) {
      console.error("Error fetching region performance:", loansError);
      return [];
    }

    if (!loansData || loansData.length === 0) {
      return [];
    }

    const loanIds = loansData.map(loan => loan.id);
    
    // Fetch payments
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('loan_payments')
      .select('loan_id, paid_amount')
      .in('loan_id', loanIds);

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError);
    }

    // Fetch installments for arrears and NPL calculation
    const { data: installmentsData, error: installmentsError } = await supabase
      .from('loan_installments')
      .select('loan_id, due_date, due_amount, interest_paid, principal_paid, status')
      .in('loan_id', loanIds);

    if (installmentsError) {
      console.error("Error fetching installments:", installmentsError);
    }

    const paymentsByLoan = {};
    paymentsData?.forEach(payment => {
      if (!paymentsByLoan[payment.loan_id]) {
        paymentsByLoan[payment.loan_id] = 0;
      }
      paymentsByLoan[payment.loan_id] += Number(payment.paid_amount) || 0;
    });

    // Calculate arrears and NPL per loan
    const today = getTodayDate();
    const arrearsPerLoan = {};
    const nplLoans = new Set();

    installmentsData?.forEach(inst => {
      if (inst.due_date && inst.due_date <= today && ['overdue', 'partial'].includes(inst.status)) {
        const dueAmount = Number(inst.due_amount) || 0;
        const paidAmount = (Number(inst.interest_paid) || 0) + (Number(inst.principal_paid) || 0);
        const arrears = dueAmount - paidAmount;
        
        if (arrears > 0) {
          if (!arrearsPerLoan[inst.loan_id]) {
            arrearsPerLoan[inst.loan_id] = 0;
          }
          arrearsPerLoan[inst.loan_id] += arrears;
          
          // Check if loan is NPL (overdue for 90+ days)
          const dueDate = new Date(inst.due_date);
          const todayDate = new Date(today);
          const daysDiff = Math.floor((todayDate - dueDate) / (1000 * 60 * 60 * 24));
          
          if (daysDiff >= 90) {
            nplLoans.add(inst.loan_id);
          }
        }
      }
    });

    const regionMap = {};
    loansData.forEach(loan => {
      const regionName = loan.regions?.name || 'Unknown';
      
      if (!regionMap[regionName]) {
        regionMap[regionName] = {
          name: regionName,
          totalDisbursed: 0,
          totalPayable: 0,
          totalCollected: 0,
          totalArrears: 0,
          nplAmount: 0,
          nplCount: 0,
          loanCount: 0
        };
      }
      
      const loanAmount = Number(loan.scored_amount) || 0;
      const payableAmount = Number(loan.total_payable) || 0;
      const collectedAmount = paymentsByLoan[loan.id] || 0;
      const loanArrears = arrearsPerLoan[loan.id] || 0;
      
      regionMap[regionName].totalDisbursed += loanAmount;
      regionMap[regionName].totalPayable += payableAmount;
      regionMap[regionName].totalCollected += collectedAmount;
      regionMap[regionName].totalArrears += loanArrears;
      regionMap[regionName].loanCount++;
      
      // Add to NPL if loan is past 90 days
      if (nplLoans.has(loan.id)) {
        regionMap[regionName].nplAmount += (payableAmount - collectedAmount);
        regionMap[regionName].nplCount++;
      }
    });

    return Object.values(regionMap).map(region => {
      const totalOutstanding = region.totalPayable - region.totalCollected;
      const collectionRate = region.totalPayable > 0 
        ? (region.totalCollected / region.totalPayable) * 100 
        : 0;
      
      const nplRate = region.totalPayable > 0 
        ? (region.nplAmount / region.totalPayable) * 100 
        : 0;
      
      return {
        name: region.name,
        totalDisbursed: Math.round(region.totalDisbursed),
        totalPayable: Math.round(region.totalPayable),
        totalCollected: Math.round(region.totalCollected),
        totalOutstanding: Math.round(totalOutstanding),
        collectionRate: Math.round(collectionRate * 10) / 10,
        nplAmount: Math.round(region.nplAmount),
        nplRate: Math.round(nplRate * 10) / 10,
        nplCount: region.nplCount,
        arrearsAmount: Math.round(region.totalArrears),
        loanCount: region.loanCount,
        avgLoanSize: region.loanCount > 0 
          ? Math.round(region.totalDisbursed / region.loanCount) 
          : 0
      };
    }).sort((a, b) => b.totalDisbursed - a.totalDisbursed);
  } catch (error) {
    console.error("Error in fetchRegionPerformance:", error);
    return [];
  }
};

const RegionChart = () => {
  const [localData, setLocalData] = useState([]);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [localFilters, setLocalFilters] = useState({
    dateRange: 'all',
    region: 'all',
    customStartDate: '',
    customEndDate: ''
  });
  const [availableRegions, setAvailableRegions] = useState([]);

  // Fetch available regions on mount
  useEffect(() => {
    const fetchRegions = async () => {
      const { data: regionsData } = await supabase
        .from('regions')
        .select('name')
        .order('name');
      
      if (regionsData) {
        setAvailableRegions(regionsData.map(r => r.name));
      }
    };
    
    fetchRegions();
  }, []);

  // Fetch data with debouncing
  const fetchDataWithFilters = useCallback(async (filters, customDateRange = null) => {
    try {
      const regionData = await fetchRegionPerformance(
        filters.dateRange,
        filters.region,
        customDateRange
      );
      setLocalData(regionData);
    } catch (error) {
      console.error("Error fetching region data:", error);
      setLocalData([]);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchDataWithFilters(localFilters);
  }, [fetchDataWithFilters]);

  // Handle filter changes
  const handleLocalFilterChange = useCallback(async (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    
    if (key === 'dateRange') {
      if (value === 'custom') {
        setShowCustomDate(true);
        return;
      } else {
        setShowCustomDate(false);
      }
    }
    
    fetchDataWithFilters(newFilters);
  }, [localFilters, fetchDataWithFilters]);

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
    
    const csvData = localData.map(region => ({
      Region: region.name || 'Unknown',
      'Total Disbursed': region.totalDisbursed || 0,
      'Total Payable': region.totalPayable || 0,
      'Total Collected': region.totalCollected || 0,
      'Outstanding': region.totalOutstanding || 0,
      'Collection Rate (%)': region.collectionRate || 0,
      'NPL Amount': region.nplAmount || 0,
      'NPL Rate (%)': region.nplRate || 0,
      'Arrears': region.arrearsAmount || 0,
      'Loan Count': region.loanCount || 0,
      'Avg Loan Size': region.avgLoanSize || 0
    }));
    
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `region-performance-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [localData]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header with title and export */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6" style={{ color: "#586ab1" }} />
          <h3 className="text-lg font-semibold" style={{ color: "#586ab1" }}>
            Region Performance Analysis
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
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
          <Calendar className="w-4 h-4 text-gray-500" />
          <select
            value={localFilters.dateRange}
            onChange={(e) => handleLocalFilterChange('dateRange', e.target.value)}
            className="bg-transparent border-none text-sm focus:outline-none"
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

        {showCustomDate && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={localFilters.customStartDate}
              onChange={(e) => handleLocalFilterChange('customStartDate', e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={localFilters.customEndDate}
              onChange={(e) => handleLocalFilterChange('customEndDate', e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <button
              onClick={applyCustomDateFilter}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              disabled={!localFilters.customStartDate || !localFilters.customEndDate}
            >
              Apply
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
          <Globe className="w-4 h-4 text-gray-500" />
          <select
            value={localFilters.region}
            onChange={(e) => handleLocalFilterChange('region', e.target.value)}
            className="bg-transparent border-none text-sm focus:outline-none"
          >
            <option value="all">All Regions</option>
            {availableRegions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Graph */}
      <div className="h-96" style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={localData}
             margin={{ top: 20, right: 30, left: 20, bottom: 60 }} 
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="name" 
              angle={-45} 
              textAnchor="end" 
              height={60}
              fontSize={12}
            />
            <YAxis 
              fontSize={12}
              tickFormatter={(value) => `Ksh ${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(88, 106, 177, 0.1)' }}
              wrapperStyle={{ 
                zIndex: 10000,
                outline: 'none'
              }}
              allowEscapeViewBox={{ x: true, y: true }}
            />
          <Legend
  verticalAlign="bottom"
  align="center"
  height={36}
  wrapperStyle={{
    fontSize: 12,
  }}
/>

            <Bar 
              dataKey="totalDisbursed" 
              name="Disbursed" 
              fill={COLORS.totalDisbursed} 
              radius={[2, 2, 0, 0]}
            />
            <Bar 
              dataKey="totalCollected" 
              name="Collected" 
              fill={COLORS.totalCollected} 
              radius={[2, 2, 0, 0]}
            />
            <Bar 
              dataKey="totalOutstanding" 
              name="Outstanding" 
              fill={COLORS.totalOutstanding} 
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Empty state message */}
      {localData.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No data available for the selected filters</p>
        </div>
      )}
    </div>
  );
};

export default RegionChart;