import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Users, Calendar, Globe, Building, Download, Filter } from 'lucide-react';
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

const fetchGuarantorAgeGenderData = async (dateRange, selectedRegion, selectedBranch, customDateRange) => {
  try {
    let query = supabase
      .from('guarantors')
      .select(`
        date_of_birth,
        gender,
        created_at,
        branch_id,
        region_id,
        branches(name, code, region_id),
        regions(name)
      `)
      .eq('is_guarantor', true)
      .not('date_of_birth', 'is', null);

    if (selectedBranch !== 'all') {
      query = query.eq('branch_id', selectedBranch);
    } else if (selectedRegion !== 'all') {
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
      const startDate = getDateRangeStart(dateRange);
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
    }

    const { data: guarantorsData, error: guarantorsError } = await query;
    
    if (guarantorsError) {
      console.error("Error fetching guarantor age data:", guarantorsError);
      return [];
    }

    if (!guarantorsData || guarantorsData.length === 0) {
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

    guarantorsData.forEach(guarantor => {
      if (guarantor && guarantor.date_of_birth) {
        const birthDate = new Date(guarantor.date_of_birth);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        
        const group = ageGroups.find(g => age >= g.min && age <= g.max);
        if (group) {
          const index = ageGroups.indexOf(group);
          const gender = (guarantor.gender || 'other').toLowerCase();
          
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
    console.error("Error in fetchGuarantorAgeGenderData:", error);
    return [];
  }
};

const AgeGenderChart = ({ type = 'customer' }) => {
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

  const isCustomer = type === 'customer';
  const title = isCustomer ? 'Customer Age & Gender Analysis' : 'Guarantor Age & Gender Analysis';

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
  }, [type]);

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
      const fetchFunction = isCustomer ? fetchCustomerAgeGenderData : fetchGuarantorAgeGenderData;
      const ageGenderData = await fetchFunction(
        filterParams.dateRange,
        filterParams.region,
        filterParams.branch,
        customDateRange
      );
      setData(ageGenderData);
    } catch (error) {
      console.error("Error fetching age gender data:", error);
      setData([]);
    }
  }, [isCustomer]);

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
    const filename = `${isCustomer ? 'customer' : 'guarantor'}-age-gender-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [data, isCustomer]);

  const filteredData = getFilteredData();

  return (
    <div className="bg-[#E7F0FA] rounded-xl shadow-sm border border-gray-200 p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6" style={{ color: HEADER_COLOR }} />
          <h3 className="text-lg font-semibold" style={{ color: HEADER_COLOR }}>Guarantor Age</h3>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-gray-50 text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            disabled={!data || data.length === 0}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-3 gap-3 items-center">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
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

          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
            <Globe className="w-4 h-4 text-gray-500" />
            <select
              value={filters.region}
              onChange={(e) => handleFilterChange('region', e.target.value)}
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

          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
            <Building className="w-4 h-4 text-gray-500" />
            <select
              value={filters.branch}
              onChange={(e) => handleFilterChange('branch', e.target.value)}
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

        {showCustomDate && (
          <div className="mt-4 flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <input
                type="date"
                value={filters.customStartDate}
                onChange={(e) => handleFilterChange('customStartDate', e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                value={filters.customEndDate}
                onChange={(e) => handleFilterChange('customEndDate', e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
            <button
              onClick={applyCustomDateFilter}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              disabled={!filters.customStartDate || !filters.customEndDate}
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
              <p className="text-gray-500">No {isCustomer ? 'customer' : 'guarantor'} age data available</p>
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

export default AgeGenderChart;