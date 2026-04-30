import { useState, useEffect, useMemo } from "react";
import {
  ArrowPathIcon,
  ChartBarIcon,
  UsersIcon,
  CheckCircleIcon,
  ClockIcon,
  GlobeAltIcon,
  TrophyIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { useToast } from "../../components/Toast";
import { useNavigate } from "react-router-dom";
import Spinner from "../../components/Spinner.jsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#1E3A8A", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const LeadInsights = () => {
  const [allLeads, setAllLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterRegion, setFilterRegion] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterRO, setFilterRO] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filterDatePreset, setFilterDatePreset] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [regions, setRegions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);
  
  const { profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const role = profile?.role;
  const isOfficer = role === "relationship_officer";
  const isBranchManager = role === "branch_manager";
  const isCustomerService = role === "customer_service_officer";
  const isRegionalManager = role === "regional_manager";
  const isCreditAnalyst = role === "credit_analyst_officer";
  const isAdminOrSuper = role === "admin" || role === "superadmin";

  const canFilterRegion = isCreditAnalyst || isCustomerService || isAdminOrSuper;
  const canFilterBranch = isCreditAnalyst || isCustomerService || isRegionalManager || isAdminOrSuper;
  const canFilterRO = isCreditAnalyst || isCustomerService || isRegionalManager || isBranchManager || isAdminOrSuper;

  const fetchFilterOptions = async () => {
    try {
      if (canFilterRegion) {
        const { data } = await supabase.from("regions").select("id, name").eq("tenant_id", profile.tenant_id).order("name");
        setRegions(data || []);
      }
      let bQuery = supabase.from("branches").select("id, name, region_id").order("name");
      if (isRegionalManager && profile.region_id) bQuery = bQuery.eq("region_id", profile.region_id);
      else bQuery = bQuery.eq("tenant_id", profile.tenant_id);
      const { data: bData } = await bQuery;
      setBranches(bData || []);

      let uQuery = supabase.from("users").select("id, full_name, profiles!inner(branch_id)").eq("role", "relationship_officer").eq("tenant_id", profile.tenant_id).order("full_name");
      if (isBranchManager && profile.branch_id) uQuery = uQuery.eq("profiles.branch_id", profile.branch_id);
      const { data: uData } = await uQuery;
      setOfficers(uData || []);
    } catch {}
  };

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*, users!leads_created_by_fkey(full_name, profiles(branch_id, region_id))")
        .eq("tenant_id", profile.tenant_id);

      if (error) throw error;

      let roleFiltered = data || [];
      if (isOfficer) {
        roleFiltered = roleFiltered.filter(l => l.created_by === profile.id);
      } else if (isBranchManager && profile.branch_id) {
        roleFiltered = roleFiltered.filter(l => {
          const derivedBranch = l.branch_id || (Array.isArray(l.users?.profiles) ? l.users?.profiles[0]?.branch_id : l.users?.profiles?.branch_id);
          return derivedBranch === profile.branch_id;
        });
      } else if (isRegionalManager && profile.region_id) {
        roleFiltered = roleFiltered.filter(l => {
          const derivedRegion = l.region_id || (Array.isArray(l.users?.profiles) ? l.users?.profiles[0]?.region_id : l.users?.profiles?.region_id);
          return derivedRegion === profile.region_id;
        });
      }

      const { data: custs } = await supabase
        .from("customers")
        .select("lead_id, created_at")
        .not("lead_id", "is", null);

      const convMap = new Map((custs || []).map((c) => [c.lead_id, c.created_at]));

      setAllLeads(
        (roleFiltered || []).map((l) => ({
          ...l,
          is_converted: convMap.has(l.id),
          converted_at: convMap.get(l.id),
          created_by_name: l.users?.full_name || "—",
        }))
      );
    } catch {
      showToast("Failed to load analytics data", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchFilterOptions();
      fetchLeads();
    }
  }, [profile]);

  const visibleLeads = useMemo(() => {
    return allLeads.filter(l => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (filterRegion && !branches.filter(b => b.region_id?.toString() === filterRegion.toString()).some(b => b.id === l.branch_id)) return false;
      if (filterBranch && l.branch_id?.toString() !== filterBranch.toString()) return false;
      if (filterRO && l.created_by?.toString() !== filterRO.toString()) return false;

      // Date filtering
      if (filterDatePreset) {
        const leadDate = new Date(l.created_at);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (filterDatePreset === "today") {
          if (leadDate < today) return false;
        } else if (filterDatePreset === "week") {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          if (leadDate < startOfWeek) return false;
        } else if (filterDatePreset === "month") {
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          if (leadDate < startOfMonth) return false;
        } else if (filterDatePreset === "year") {
          const startOfYear = new Date(today.getFullYear(), 0, 1);
          if (leadDate < startOfYear) return false;
        } else if (filterDatePreset === "custom") {
          if (filterDateFrom && leadDate < new Date(filterDateFrom)) return false;
          let toDate = filterDateTo ? new Date(filterDateTo) : null;
          if (toDate) {
             toDate.setHours(23, 59, 59, 999);
             if (leadDate > toDate) return false;
          }
        }
      }

      return true;
    });
  }, [allLeads, statusFilter, filterRegion, filterBranch, filterRO, filterDatePreset, filterDateFrom, filterDateTo, branches]);

  // ── Metrics & Aggregations ────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = visibleLeads.length;
    const converted = visibleLeads.filter((l) => l.is_converted);
    const conversionRate = total > 0 ? ((converted.length / total) * 100).toFixed(1) : 0;

    // Conversion Velocity (Avg days)
    const velocityData = converted.filter(l => l.converted_at && l.created_at);
    const avgVelocity = velocityData.length > 0 
      ? (velocityData.reduce((acc, l) => {
          const diff = new Date(l.converted_at) - new Date(l.created_at);
          return acc + (diff / (1000 * 60 * 60 * 24));
        }, 0) / velocityData.length).toFixed(1)
      : "—";

    return { total, conversionRate, avgVelocity };
  }, [visibleLeads]);

  const funnelData = useMemo(() => {
    const counts = { Cold: 0, Warm: 0, Hot: 0, Converted: 0 };
    visibleLeads.forEach(l => {
      if (l.is_converted) counts.Converted++;
      else counts[l.status]++;
    });
    return [
      { name: "Cold", value: counts.Cold + counts.Warm + counts.Hot + counts.Converted, fill: "#1E3A8A" }, // brand-primary (Blue)
      { name: "Warm", value: counts.Warm + counts.Hot + counts.Converted, fill: "#FACC15" }, // highlight (Yellow/Gold)
      { name: "Hot", value: counts.Hot + counts.Converted, fill: "#F97316" }, // Orange
      { name: "Converted", value: counts.Converted, fill: "#10B981" }, // accent (Green)
    ];
  }, [visibleLeads]);

  const sourceData = useMemo(() => {
    const map = {};
    visibleLeads.forEach(l => {
      const s = l.source || "Walk-in";
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [visibleLeads]);

  const industryData = useMemo(() => {
    const map = {};
    visibleLeads.forEach(l => {
      const i = l.industry || "Uncategorized";
      map[i] = (map[i] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [visibleLeads]);

  const roRanking = useMemo(() => {
    const map = {};
    visibleLeads.forEach(l => {
      const ro = l.created_by_name;
      if (!map[ro]) map[ro] = { name: ro, total: 0, converted: 0 };
      map[ro].total++;
      if (l.is_converted) map[ro].converted++;
    });
    return Object.values(map)
      .map(d => ({ ...d, rate: Number(((d.converted / d.total) * 100).toFixed(1)) }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);
  }, [visibleLeads]);

  const activeFilterCount = [filterRegion, filterBranch, filterRO, filterDatePreset, statusFilter !== "all" ? "status" : ""].filter(Boolean).length;
  const clearFilters = () => { setFilterRegion(""); setFilterBranch(""); setFilterRO(""); setStatusFilter("all"); setFilterDatePreset(""); setFilterDateFrom(""); setFilterDateTo(""); };

  if (isLoading) return <div className="h-64 flex items-center justify-center"><Spinner /></div>;

  return (
    <div className="bg-muted p-6 min-h-screen font-body">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-sm text-slate-600">Leads Insights / Analytics</h1>
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-1.5 border border-gray-300 bg-white"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Clear Filters
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-all duration-200 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 hover:text-gray-900"
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-gray-700 text-white rounded-full text-xs">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {canFilterRegion && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Region</label>
                <div className="relative">
                  <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white">
                    <option value="" className="text-gray-400">All Regions</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><ChevronDownIcon className="h-3 w-3" /></div>
                </div>
              </div>
            )}
            {canFilterBranch && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Branch</label>
                <div className="relative">
                  <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white">
                    <option value="" className="text-gray-400">All Branches</option>
                    {branches.filter(b => !filterRegion || b.region_id?.toString() === filterRegion.toString()).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><ChevronDownIcon className="h-3 w-3" /></div>
                </div>
              </div>
            )}
            {canFilterRO && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Officer</label>
                <div className="relative">
                  <select value={filterRO} onChange={e => setFilterRO(e.target.value)} className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white">
                    <option value="" className="text-gray-400">All Officers</option>
                    {officers.filter(o => {
                      if (!filterBranch) return true;
                      const branchId = Array.isArray(o.profiles) ? o.profiles[0]?.branch_id : o.profiles?.branch_id;
                      return branchId?.toString() === filterBranch.toString();
                    }).map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><ChevronDownIcon className="h-3 w-3" /></div>
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-600 mb-1">Status</label>
              <div className="relative">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white">
                  <option value="all" className="text-gray-400">All Statuses</option>
                  <option value="Hot">Hot</option>
                  <option value="Warm">Warm</option>
                  <option value="Cold">Cold</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><ChevronDownIcon className="h-3 w-3" /></div>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Date Segment</label>
              <div className="relative">
                <select value={filterDatePreset} onChange={e => setFilterDatePreset(e.target.value)} className="w-full pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 appearance-none bg-white">
                  <option value="" className="text-gray-400">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="year">This Year</option>
                  <option value="custom">Custom Range</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"><ChevronDownIcon className="h-3 w-3" /></div>
              </div>
            </div>
            {filterDatePreset === "custom" && (
              <div className="col-span-1 lg:col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">From</label>
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-full pl-3 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">To</label>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-full pl-3 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white" />
                </div>
              </div>
            )}
          </div>

          {/* Active Filters Pill Display */}
          {activeFilterCount > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs text-gray-500 mr-2">Active filters:</span>
                {filterRegion && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                    Region: {regions.find((r) => r.id.toString() === filterRegion.toString())?.name}
                    <button onClick={() => setFilterRegion("")} className="ml-1 text-gray-500 hover:text-gray-700"><XMarkIcon className="h-2.5 w-2.5" /></button>
                  </span>
                )}
                {filterBranch && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                    Branch: {branches.find((b) => b.id.toString() === filterBranch.toString())?.name}
                    <button onClick={() => setFilterBranch("")} className="ml-1 text-gray-500 hover:text-gray-700"><XMarkIcon className="h-2.5 w-2.5" /></button>
                  </span>
                )}
                {filterRO && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                    RO: {officers.find((ro) => ro.id.toString() === filterRO.toString())?.full_name}
                    <button onClick={() => setFilterRO("")} className="ml-1 text-gray-500 hover:text-gray-700"><XMarkIcon className="h-2.5 w-2.5" /></button>
                  </span>
                )}
                {filterDatePreset && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                    Date: {filterDatePreset === 'custom' ? 'Custom Range' : filterDatePreset}
                    <button onClick={() => { setFilterDatePreset(""); setFilterDateFrom(""); setFilterDateTo(""); }} className="ml-1 text-gray-500 hover:text-gray-700"><XMarkIcon className="h-2.5 w-2.5" /></button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <InsightCard label="Total Leads" value={metrics.total} icon={UsersIcon} color="primary" />
        <InsightCard label="Conv. Rate" value={`${metrics.conversionRate}%`} icon={CheckCircleIcon} color="accent" />
        <InsightCard label="Avg. Conv. Time" value={`${metrics.avgVelocity} Days`} icon={ClockIcon} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ── Conversion Funnel ── */}
        <div className="bg-gray-50/80 p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <FunnelIcon className="h-5 w-5 text-brand-primary" />
            <h3 className=" text-gray-600  text-sm ">Pipeline Funnel</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "transparent" }} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={40}>
                   {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── RO Leaderboard ── */}
        <div className="bg-gray-50/80 p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrophyIcon className="h-5 w-5 text-brand-primary" />
            <h3 className=" text-gray-600  text-sm ">Top Officers (Conv. Rate)</h3>
          </div>
          <div className="space-y-4">
            {roRanking.map((ro, i) => (
              <div key={ro.name} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-brand-surface flex items-center justify-center font-bold text-brand-primary text-xs">
                  #{i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-bold text-text">{ro.name}</span>
                    <span className="text-sm font-black text-brand-primary">{ro.rate}%</span>
                  </div>
                  <div className="w-full h-2 bg-brand-surface rounded-full overflow-hidden">
                    <div className="bg-brand-primary h-full rounded-full transition-all duration-1000" style={{ width: `${ro.rate}%` }} />
                  </div>
                  <div className="text-xs text-slate-600 mt-1   font-semibold">{ro.converted} converted / {ro.total} total</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Lead Sources ── */}
        <div className="bg-gray-50/80 p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <GlobeAltIcon className="h-5 w-5 text-brand-primary" />
            <h3 className=" text-gray-600  text-sm">Source Distribution</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {sourceData.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", fontWeight: "600" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Industry Distribution ── */}
        <div className="bg-gray-50/80 p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <GlobeAltIcon className="h-5 w-5 text-brand-primary" />
            <h3 className=" text-gray-600  text-sm ">Industry Distribution</h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={industryData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} />
                <Tooltip cursor={{ fill: "transparent" }} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={25}>
                  {industryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Status Aging Heatmap (Simplified) ── */}
        <div className="bg-gray-50/80 p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <ClockIcon className="h-5 w-5 text-brand-primary" />
            <h3 className="font-semibold text-gray-600  text-sm ">Aging Tiers (Counts)</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "0-7 Days", color: "bg-accent" },
              { label: "8-14 Days", color: "bg-brand-secondary" },
              { label: "15-30 Days", color: "bg-highlight" },
              { label: "30+ Days", color: "bg-red-500" }
            ].map(tier => (
              <div key={tier.label} className="p-4 rounded-2xl bg-brand-surface border border-indigo-50">
                <div className={`w-2 h-2 rounded-full ${tier.color} mb-2`}></div>
                <div className="text-xs  text-slate-600  ">{tier.label}</div>
                <div className="text-xl font-semibold text-slate-600 ">
                  {visibleLeads.filter(l => {
                    if (l.is_converted) return false;
                    const days = (new Date() - new Date(l.created_at)) / (1000 * 60 * 60 * 24);
                    if (tier.label === "0-7 Days") return days <= 7;
                    if (tier.label === "8-14 Days") return days > 7 && days <= 14;
                    if (tier.label === "15-30 Days") return days > 14 && days <= 30;
                    return days > 30;
                  }).length}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

const InsightCard = ({ label, value, icon: Icon, color }) => {
  const colors = {
    primary: "bg-brand-surface text-brand-primary",
    accent: "bg-emerald-50 text-accent",
    brand: "bg-indigo-50 text-brand-btn",
  };
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`p-4 rounded-2xl ${colors[color]}`}>
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <p className="text-sm text-slate-600 mb-1 font-body">{label}</p>
        <h3 className="text-2xl  text-slate-600 font-semibold">{value}</h3>
      </div>
    </div>
  );
};

export default LeadInsights;
