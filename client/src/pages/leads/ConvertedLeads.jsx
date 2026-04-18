import { useState, useEffect, useMemo } from "react";
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  UsersIcon,
  ChartBarIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronDownIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/userAuth";
import { supabase } from "../../supabaseClient";
import { useToast } from "../../components/Toast";
import Spinner from "../../components/Spinner.jsx";

const STATUS_COLORS = { Hot: "#ef4444", Warm: "#f59e0b", Cold: "#3b82f6" };

const ConvertedLeads = () => {
  const [allLeads, setAllLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "created_at", direction: "desc" });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterRegion, setFilterRegion] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterRO, setFilterRO] = useState("");

  const [regions, setRegions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);

  const { profile } = useAuth();
  const { showToast } = useToast();

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


  useEffect(() => { if (profile) { fetchFilterOptions(); fetchLeads(); } }, [profile]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, filterRegion, filterBranch, filterRO]);

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
      let q = supabase.from("leads").select("*, users!leads_created_by_fkey(full_name, profiles(branch_id, region_id))").eq("tenant_id", profile.tenant_id);

      const { data, error } = await q;
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

      const { data: custs } = await supabase.from("customers").select("lead_id").not("lead_id", "is", null);
      const convIds = new Set((custs || []).map(c => c.lead_id));
      
      setAllLeads(roleFiltered.map(l => ({
        ...l,
        is_converted: convIds.has(l.id) || l.status === "converted",
        created_by_name: l.users?.full_name || "—"
      })));
    } catch { showToast("Error loading converted leads", "error"); }
    finally { setIsLoading(false); }
  };

  const convertedList = useMemo(() => {
    return allLeads.filter(l => l.is_converted);
  }, [allLeads]);

  const stats = useMemo(() => {
    const totalPipeline = allLeads.length;
    const count = convertedList.length;
    const rate = totalPipeline > 0 ? ((count / totalPipeline) * 100).toFixed(1) : 0;
    return {
      total: count,
      hot: convertedList.filter(l => l.status === "Hot").length,
      warm: convertedList.filter(l => l.status === "Warm").length,
      rate: `${rate}%`,
    };
  }, [allLeads, convertedList]);

  const visibleLeads = useMemo(() => {
    return convertedList.filter(l => {
      const q = searchTerm.toLowerCase();
      if (q && !([l.Firstname, l.Surname, l.mobile, l.business_name, l.created_by_name].some(v => (v || "").toLowerCase().includes(q)))) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (filterRegion && !branches.filter(b => b.region_id === filterRegion).some(b => b.id === l.branch_id)) return false;
      if (filterBranch && l.branch_id !== filterBranch) return false;
      if (filterRO && l.created_by !== filterRO) return false;
      return true;
    }).sort((a, b) => {
      const av = a[sortConfig.key] ?? "", bv = b[sortConfig.key] ?? "";
      return sortConfig.direction === "asc" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
  }, [convertedList, searchTerm, statusFilter, filterRegion, filterBranch, filterRO, sortConfig, branches]);

  const pagedLeads = useMemo(() => {
    const s = (currentPage - 1) * itemsPerPage;
    return visibleLeads.slice(s, s + itemsPerPage);
  }, [visibleLeads, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(visibleLeads.length / itemsPerPage);


  const activeFilterCount = [filterRegion, filterBranch, filterRO].filter(Boolean).length;
  const clearFilters = () => { setFilterRegion(""); setFilterBranch(""); setFilterRO(""); setStatusFilter("all"); setSearchTerm(""); };

  if (isLoading) return <div className="h-64 flex items-center justify-center"><Spinner /></div>;

  return (
    <div className="bg-muted p-6 min-h-screen font-sans">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-sm text-gray-600">Leads / Converted Leads</h1>
        </div>

      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Converted" value={stats.total} icon={CheckCircleIcon} color="emerald" />
        <StatCard label="Hot → Converted" value={stats.hot} icon={UsersIcon} color="red" />
        <StatCard label="Warm → Converted" value={stats.warm} icon={UsersIcon} color="amber" />
        <StatCard label="Conversion Rate" value={stats.rate} icon={ChartBarIcon} color="purple" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-5">
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {/* Search Bar */}
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search converted leads..."
                  className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all duration-200 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Filter Buttons */}
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="px-3 py-2 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-1.5 border border-gray-300"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-3 py-2 rounded-md flex items-center gap-2 text-sm transition-all duration-200 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 hover:text-gray-900"
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
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
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
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#E7F0FA] border-b">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-600  whitespace-nowrap">Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap ">Officer</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600  whitespace-nowrap">Branch</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap">Contact</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap ">Business Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap ">Location</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap cursor-pointer" onClick={() => setSortConfig(s => ({ key: "created_at", direction: s.direction === "asc" ? "desc" : "asc" }))}>Created ↕</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600  whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap ">Industry</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap ">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagedLeads.map(l => (
                <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-800 whitespace-nowrap">{l.Firstname} {l.Surname}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{l.created_by_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{branches.find(b => b.id === (l.branch_id || (Array.isArray(l.users?.profiles) ? l.users?.profiles[0]?.branch_id : l.users?.profiles?.branch_id)))?.name || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{l.mobile}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{l.business_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{l.business_location}</td>
                  <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white uppercase whitespace-nowrap" style={{ backgroundColor: STATUS_COLORS[l.status] }}>{l.status}</span></td>
                  <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{l.industry || "General"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{l.source || "Walk-in"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleLeads.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">Showing <b>{(currentPage-1)*itemsPerPage+1}-{Math.min(currentPage*itemsPerPage, visibleLeads.length)}</b> of <b>{visibleLeads.length}</b></div>
            <div className="flex gap-1">
              <button disabled={currentPage===1} onClick={()=>setCurrentPage(p=>p-1)} className="px-3 py-1 bg-white border rounded-lg text-xs disabled:opacity-50 transition-all">Prev</button>
              <button disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>p+1)} className="px-3 py-1 bg-white border rounded-lg text-xs disabled:opacity-50 transition-all">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color }) => {
  const colors = { emerald: "bg-emerald-50 text-emerald-600", purple: "bg-purple-50 text-purple-600", red: "bg-red-50 text-red-600", amber: "bg-amber-50 text-amber-600" };
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colors[color]}`}><Icon className="h-6 w-6" /></div>
      <div><p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{label}</p><h3 className="text-2xl font-bold text-slate-700">{value}</h3></div>
    </div>
  );
};

const FilterSelect = ({ label, value, options, onChange }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</label>
    <select value={value} onChange={onChange} className="w-full bg-gray-50 border-none rounded-xl px-3 py-2.5 text-sm outline-none cursor-pointer">
      <option value="">All {label}s</option>
      {options.map(o => <option key={o.id} value={o.id}>{o.name || o.full_name}</option>)}
    </select>
  </div>
);

export default ConvertedLeads;
