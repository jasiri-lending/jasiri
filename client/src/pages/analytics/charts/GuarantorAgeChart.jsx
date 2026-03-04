import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Users, Calendar, Globe, Building, Download, Filter } from 'lucide-react';
import { supabase } from "../../../supabaseClient";
import { HEADER_COLOR, COLORS } from '../shared/constants';
import { useTenant } from "../../../hooks/useTenant";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;

  return (
    <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-white/40 min-w-[300px] relative z-[9999]">
      <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Users className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Guarantor Age</p>
          <p className="font-black text-slate-800 text-base">{label}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
            <p className="text-[8px] font-black text-blue-400 uppercase tracking-tighter mb-0.5">Male</p>
            <p className="text-sm font-black text-blue-700">{data?.male?.toLocaleString() || 0}</p>
          </div>
          <div className="p-3 bg-pink-50/50 rounded-xl border border-pink-100">
            <p className="text-[8px] font-black text-pink-400 uppercase tracking-tighter mb-0.5">Female</p>
            <p className="text-sm font-black text-pink-700">{data?.female?.toLocaleString() || 0}</p>
          </div>
        </div>

        <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Total Count</p>
          <p className="text-2xl font-black text-slate-700 tracking-tight">
            {((data?.male || 0) + (data?.female || 0) + (data?.other || 0)).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

const getDateRangeStart = (dateRange) => {
  const now = new Date();
  const startDate = new Date();

  switch (dateRange) {
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

const fetchCustomerAgeGenderData = async (dateRange, selectedRegion, selectedBranch, customDateRange, tenantId) => {
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

const fetchGuarantorAgeGenderData = async (dateRange, selectedRegion, selectedBranch, customDateRange, tenantId) => {
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
      .eq('tenant_id', tenantId)
      .not('date_of_birth', 'is', null);

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
  const { tenant } = useTenant();
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
  const [loading, setLoading] = useState(false);

  const isCustomer = type === 'customer';

  const fetchDataWithFilters = useCallback(async (filterParams, customDateRange = null) => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const fetchFunction = isCustomer ? fetchCustomerAgeGenderData : fetchGuarantorAgeGenderData;
      const ageGenderData = await fetchFunction(
        filterParams.dateRange,
        filterParams.region,
        filterParams.branch,
        customDateRange,
        tenant.id
      );
      setData(ageGenderData);
    } catch (error) {
      console.error("Error fetching age gender data:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [isCustomer, tenant?.id]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!tenant?.id) return;
      try {
        const { data: regionsData, error: regionsError } = await supabase
          .from('regions')
          .select('id, name')
          .eq('tenant_id', tenant.id)
          .order('name');

        if (regionsError) throw regionsError;
        if (regionsData) {
          setAvailableRegions(regionsData);
        }

        const { data: branchesData, error: branchesError } = await supabase
          .from('branches')
          .select('id, name, code, region_id')
          .eq('tenant_id', tenant.id)
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
  }, [type, tenant?.id, fetchDataWithFilters]);

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
    <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 p-8 transition-all duration-300 hover:shadow-2xl h-full relative hover:z-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg text-stone-600 whitespace-nowrap">
          {isCustomer ? 'Customer Age' : 'Guarantor Age'} Analysis
        </h3>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 text-stone-500 hover:text-stone-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-stone-200 hover:bg-stone-50"
          disabled={!data || data.length === 0}
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
      </div>

      <div className="mb-4 mt-2">
        <div className="flex flex-nowrap items-center gap-2 relative z-20 w-full overflow-hidden">
          {[
            {
              label: "Timeframe",
              icon: <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />,
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
              label: "Region",
              icon: <Globe className="w-3.5 h-3.5 text-stone-400 shrink-0" />,
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
              label: "Branch",
              icon: <Building className="w-3.5 h-3.5 text-stone-400 shrink-0" />,
              value: filters.branch,
              onChange: (e) => handleFilterChange('branch', e.target.value),
              options: [
                { value: "all", label: "All Branches" },
                ...filteredBranches.map(branch => ({
                  value: branch.id,
                  label: branch.name
                }))
              ]
            }
          ].map((item, idx) => (
            <div key={idx} className="flex-1 min-w-0 flex items-center h-8 gap-1.5 px-2 rounded-lg border border-stone-200 bg-transparent hover:border-stone-300 transition focus-within:ring-1 focus-within:ring-stone-400/20">
              {item.icon}
              <select
                value={item.value}
                onChange={item.onChange}
                disabled={loading}
                className="w-full bg-transparent text-[10px] font-bold text-stone-600 focus:outline-none cursor-pointer py-1 truncate"
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
          <div className="mt-4 flex flex-wrap items-center gap-3 bg-stone-50/50 p-3 rounded-lg border border-stone-100">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <input
              type="date"
              value={filters.customStartDate}
              onChange={(e) => handleFilterChange('customStartDate', e.target.value)}
              className="h-8 px-2 text-xs font-bold rounded border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
            />
            <span className="text-stone-300">→</span>
            <input
              type="date"
              value={filters.customEndDate}
              onChange={(e) => handleLocalFilterChange('customEndDate', e.target.value)}
              className="h-8 px-2 text-xs font-bold rounded border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
            />
            <button
              onClick={applyCustomDateFilter}
              disabled={!filters.customStartDate || !filters.customEndDate}
              className="h-8 px-4 rounded text-xs font-bold text-white bg-stone-600 hover:bg-stone-700 transition-all disabled:opacity-50"
            >
              Update
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
              <YAxis
                fontSize={10}
                fontWeight="bold"
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="male" name="Male" fill="#6366f1" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="female" name="Female" fill="#ec4899" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="other" name="Other" fill="#94a3b8" stackId="a" radius={[4, 4, 0, 0]} />
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