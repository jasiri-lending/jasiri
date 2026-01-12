import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Users, Calendar, Globe, Building, Download } from 'lucide-react';
import { supabase } from "../../../supabaseClient";
import { HEADER_COLOR, COLORS } from '../shared/constants';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0]?.payload;
  
  return (
    <div className="bg-[#E7F0FA] p-4 rounded-lg shadow-xl border border-gray-200">
      <p className="font-bold text-slate-600 mb-3 text-sm">{label}</p>
      <div className="space-y-2">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Male:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS[0] }}>
            {data?.male?.toLocaleString() || 0}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Female:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS[1] }}>
            {data?.female?.toLocaleString() || 0}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 text-xs">Other:</span>
          <span className="font-semibold text-xs" style={{ color: COLORS[2] }}>
            {data?.other?.toLocaleString() || 0}
          </span>
        </div>
        <div className="flex justify-between gap-4 pt-2 border-t border-gray-200">
          <span className="text-gray-600 text-xs">Total:</span>
          <span className="font-semibold text-xs" style={{ color: HEADER_COLOR }}>
            {((data?.male || 0) + (data?.female || 0) + (data?.other || 0)).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

const getDateRangeStart = (dateRange) => {
  const now = new Date();
  const startDate = new Date();
  
  switch(dateRange) {
    case 'week':
      startDate.setDate(now.getDate() - 6);
      break;
    case 'month':
      startDate.setDate(1);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate.setMonth(quarter * 3, 1);
      break;
    case '6months':
      startDate.setMonth(now.getMonth() - 5);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear(), 0, 1);
      break;
    default:
      return null;
  }
  
  startDate.setHours(0, 0, 0, 0);
  return startDate.toISOString();
};

const fetchCustomerAgeGenderData = async (dateRange, selectedRegion, selectedBranch, customDateRange) => {
  try {
    let query = supabase
      .from('loans')
      .select(`
        id,
        customer_id,
        created_at,
        branch_id,
        branches!inner(name, code, region_id),
        regions!inner(name),
        customers!inner(date_of_birth, gender)
      `)
      .eq('status', 'disbursed');

    if (selectedBranch !== 'all') {
      query = query.eq('branch_id', selectedBranch);
    } else if (selectedRegion !== 'all') {
      const { data: regionData } = await supabase
        .from('regions')
        .select('id')
        .eq('name', selectedRegion)
        .single();
      
      if (regionData) {
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

    if (customDateRange?.startDate && customDateRange?.endDate) {
      query = query
        .gte('created_at', customDateRange.startDate)
        .lte('created_at', customDateRange.endDate);
    } else if (dateRange !== 'all') {
      const startDate = getDateRangeStart(dateRange);
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
    }

    const { data: loansData, error: loansError } = await query;
    
    if (loansError) {
      console.error("Error fetching customer age data:", loansError);
      return [];
    }

    if (!loansData || loansData.length === 0) {
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
      male: 0,
      female: 0,
      other: 0
    }));

    const processedCustomers = new Set();

    loansData.forEach(loan => {
      const customer = loan.customers;
      if (customer && customer.date_of_birth && !processedCustomers.has(loan.customer_id)) {
        processedCustomers.add(loan.customer_id);
        
        const birthDate = new Date(customer.date_of_birth);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        
        const group = ageGroups.find(g => age >= g.min && age <= g.max);
        if (group) {
          const index = ageGroups.indexOf(group);
          const gender = (customer.gender || 'other').toLowerCase();
          
          if (gender === 'male' || gender === 'm') {
            distribution[index].male++;
          } else if (gender === 'female' || gender === 'f') {
            distribution[index].female++;
          } else {
            distribution[index].other++;
          }
        }
      }
    });

    return distribution
      .filter(group => (group.male + group.female + group.other) > 0)
      .sort((a, b) => {
        const aMin = parseInt(a.ageGroup.split('-')[0]) || parseInt(a.ageGroup);
        const bMin = parseInt(b.ageGroup.split('-')[0]) || parseInt(b.ageGroup);
        return aMin - bMin;
      });

  } catch (error) {
    console.error("Error in fetchCustomerAgeGenderData:", error);
    return [];
  }
};

const CustomerAgeChart = () => {
  const [data, setData] = useState([]);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: 'all',
    region: 'all',
    branch: 'all',
    customStartDate: '',
    customEndDate: '',
    gender: 'all'
  });
  const [availableRegions, setAvailableRegions] = useState([]);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: regionsData, error: regionsError } = await supabase
          .from('regions')
          .select('id, name')
          .order('name');
        
        if (regionsError) throw regionsError;
        if (regionsData) {
          setAvailableRegions(regionsData);
        }
        
        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('id, name, code, region_id')
          .order('name');
        
        if (branchesError) throw branchesError;
        if (branchesData) {
          setAvailableBranches(branchesData);
        }
        
        await fetchDataWithFilters({
          dateRange: 'all',
          region: 'all',
          branch: 'all',
          gender: 'all'
        });
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };
    
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (filters.region === 'all') {
      setSelectedRegionId(null);
    } else {
      const region = availableRegions.find(r => r.name === filters.region);
      setSelectedRegionId(region?.id || null);
    }
  }, [filters.region, availableRegions]);

  const filteredBranches = filters.region === 'all' 
    ? availableBranches 
    : availableBranches.filter(branch => branch.region_id === selectedRegionId);

  const fetchDataWithFilters = useCallback(async (filterParams, customDateRange = null) => {
    try {
      const ageGenderData = await fetchCustomerAgeGenderData(
        filterParams.dateRange,
        filterParams.region,
        filterParams.branch,
        customDateRange
      );
      setData(ageGenderData);
    } catch (error) {
      console.error("Error fetching customer age data:", error);
      setData([]);
    }
  }, []);

  useEffect(() => {
    fetchDataWithFilters(filters);
  }, [fetchDataWithFilters]);

  const handleFilterChange = useCallback(async (key, value) => {
    const newFilters = { ...filters };
    
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
        return;
      } else {
        setShowCustomDate(false);
      }
    } else {
      newFilters[key] = value;
    }
    
    setFilters(newFilters);
    
    let customDateRange = null;
    if (newFilters.dateRange === 'custom' && newFilters.customStartDate && newFilters.customEndDate) {
      customDateRange = {
        startDate: newFilters.customStartDate,
        endDate: newFilters.customEndDate
      };
    }
    
    fetchDataWithFilters(newFilters, customDateRange);
  }, [filters, availableRegions, fetchDataWithFilters]);

  const applyCustomDateFilter = useCallback(async () => {
    if (filters.customStartDate && filters.customEndDate) {
      const customDateRange = {
        startDate: filters.customStartDate,
        endDate: filters.customEndDate
      };
      await fetchDataWithFilters({ ...filters, dateRange: 'custom' }, customDateRange);
    }
  }, [filters, fetchDataWithFilters]);

  const getFilteredData = () => {
    if (filters.gender === 'all') {
      return data;
    }
    
    return data.map(group => {
      const filteredGroup = { ...group };
      if (filters.gender === 'male') {
        filteredGroup.female = 0;
        filteredGroup.other = 0;
      } else if (filters.gender === 'female') {
        filteredGroup.male = 0;
        filteredGroup.other = 0;
      } else {
        filteredGroup.male = 0;
        filteredGroup.female = 0;
      }
      return filteredGroup;
    });
  };

  const handleExport = useCallback(() => {
    if (!data || data.length === 0) return;
    
    const csvData = data.map(item => ({
      'Age Group': item.ageGroup,
      'Male': item.male || 0,
      'Female': item.female || 0,
      'Other': item.other || 0,
      'Total': (item.male || 0) + (item.female || 0) + (item.other || 0)
    }));
    
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-age-gender-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [data]);

  const filteredData = getFilteredData();

  return (
    <div className="bg-[#E7F0FA] rounded-xl shadow-sm border border-gray-200 p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6" style={{ color: HEADER_COLOR }} />
          <h3 className="text-lg font-semibold" style={{ color: HEADER_COLOR }}>Customer Age</h3>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 text-green-700 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            disabled={!data || data.length === 0}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              icon: <Calendar className="w-4 h-4 text-slate-500 shrink-0" />,
              value: filters.dateRange,
              onChange: (e) => handleFilterChange('dateRange', e.target.value),
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
              value: filters.region,
              onChange: (e) => handleFilterChange('region', e.target.value),
              options: [
                { value: "all", label: "All Regions" },
                ...availableRegions.map(region => ({
                  value: region.name,
                  label: region.name
                }))
              ]
            },
            {
              icon: <Building className="w-4 h-4 text-slate-500 shrink-0" />,
              value: filters.branch,
              onChange: (e) => handleFilterChange('branch', e.target.value),
              options: [
                { value: "all", label: "All Branches" },
                ...filteredBranches.map(branch => ({
                  value: branch.id,
                  label: `${branch.name} (${branch.code})`
                }))
              ]
            }
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center h-11 gap-3 px-3 rounded-lg border border-slate-200 bg-[#E7F0FA] hover:border-slate-300 transition"
            >
              {item.icon}
              <select
                value={item.value}
                onChange={item.onChange}
                className="w-full bg-transparent text-sm font-normal leading-tight text-slate-800 focus:outline-none cursor-pointer py-0.5"
              >
                {item.options.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {showCustomDate && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Calendar className="w-4 h-4 text-slate-500" />

            <input
              type="date"
              value={filters.customStartDate}
              onChange={(e) => handleFilterChange('customStartDate', e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border bg-[#E7F0FA] focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            <span className="text-slate-500 text-sm">to</span>

            <input
              type="date"
              value={filters.customEndDate}
              onChange={(e) => handleFilterChange('customEndDate', e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border bg-[#E7F0FA] focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            <button
              onClick={applyCustomDateFilter}
              disabled={!filters.customStartDate || !filters.customEndDate}
              className="h-8 px-3 rounded-md text-xs font-medium text-white bg-[#586ab1] hover:bg-[#4b5aa6] disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      <div className="h-80">
        {filteredData && filteredData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredData}>
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
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No customer age data available for the selected filters</p>
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

export default CustomerAgeChart;