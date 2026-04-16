import { useState, useEffect, useMemo } from "react";
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  UsersIcon,
  ChartBarIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/userAuth";
import { supabase } from "../../supabaseClient";
import { useToast } from "../../components/Toast";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  const role = profile?.role;
  const isOfficer = role === "relationship_officer";
  const isBranchManager = role === "branch_manager";
  const isCustomerService = role === "customer_service_officer";
  const isRegionalManager = role === "regional_manager";
  const isAdminOrSuper = role === "admin" || role === "superadmin";

  useEffect(() => { if (profile) { fetchFilterOptions(); fetchLeads(); } }, [profile]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, filterRegion, filterBranch, filterRO]);

  const fetchFilterOptions = async () => {
    try {
      if (isAdminOrSuper) {
        const { data } = await supabase.from("regions").select("id, name").eq("tenant_id", profile.tenant_id).order("name");
        setRegions(data || []);
      }
      let bQuery = supabase.from("branches").select("id, name, region_id").order("name");
      if ((isBranchManager || isCustomerService) && profile.region_id) bQuery = bQuery.eq("region_id", profile.region_id);
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
      } else if ((isRegionalManager || isCustomerService) && profile.region_id) {
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

  if (isLoading) return <div className="h-64 flex items-center justify-center"><Spinner /></div>;

  return (
    <div className="bg-muted p-6 min-h-screen font-sans">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Leads / Converted Leads</h1>
          <p className="text-sm text-gray-500">Successfully converted leads within your pipeline</p>
        </div>

      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Converted" value={stats.total} icon={CheckCircleIcon} color="emerald" />
        <StatCard label="Hot → Converted" value={stats.hot} icon={UsersIcon} color="red" />
        <StatCard label="Warm → Converted" value={stats.warm} icon={UsersIcon} color="amber" />
        <StatCard label="Conversion Rate" value={stats.rate} icon={ChartBarIcon} color="purple" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search converted leads..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all duration-200 bg-white" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${showFilters ? "bg-brand-primary/10 border-brand-primary text-brand-primary" : "bg-gray-50 border-transparent text-gray-600"}`}>
            <FunnelIcon className="h-4 w-4" /> Filters
          </button>
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-2">
            {isAdminOrSuper && <FilterSelect label="Region" value={filterRegion} options={regions} onChange={e => setFilterRegion(e.target.value)} />}
            <FilterSelect label="Branch" value={filterBranch} options={branches.filter(b => !filterRegion || b.region_id === filterRegion)} onChange={e => setFilterBranch(e.target.value)} />
            <FilterSelect label="Officer" value={filterRO} options={officers.filter(o => !filterBranch || o.profiles?.branch_id === filterBranch)} onChange={e => setFilterRO(e.target.value)} />
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none cursor-pointer">
                <option value="all">All Statuses</option><option value="Hot">Hot</option><option value="Warm">Warm</option><option value="Cold">Cold</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#E7F0FA] border-b">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">Officer</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">Branch</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">Contact</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">Business Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">Location</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase cursor-pointer" onClick={() => setSortConfig(s => ({ key: "created_at", direction: s.direction === "asc" ? "desc" : "asc" }))}>Created ↕</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">Industry</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">Source</th>
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
