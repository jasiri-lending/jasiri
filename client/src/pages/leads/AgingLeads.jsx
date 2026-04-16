import { useState, useEffect, useMemo } from "react";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon,
  UsersIcon,
  ClockIcon,
  PencilSquareIcon,
  TrashIcon,
  FunnelIcon,
  UserPlusIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/userAuth";
import { supabase } from "../../supabaseClient";
import { useToast } from "../../components/Toast";
import { useNavigate } from "react-router-dom";
import Spinner from "../../components/Spinner.jsx";

const emptyForm = {
  Firstname: "",
  Surname: "",
  mobile: "",
  business_name: "",
  business_location: "",
  business_type: "",
  industry: "",
  status: "Cold",
  source: "Field Agent",
};

const INDUSTRIES = {
  Retail: ["Clothing Shop", "Second-hand Clothes (Mtumba)", "Electronics Shop", "Grocery Shop", "Supermarket", "Cosmetics Shop", "Hardware Shop", "Furniture Shop", "Mobile Phone Shop", "General Shop (Kiosk)"],
  "Hospitality & Entertainment": ["Bar", "Restaurant", "Hotel", "Club", "Café", "Lounge", "Fast Food Outlet"],
  Agriculture: ["Crop Farming", "Dairy Farming", "Poultry Farming", "Fish Farming", "Agro-processing", "Agrovet Shop"],
  Education: ["Primary School", "Secondary School", "College", "Training Institute", "Driving School", "Daycare / Kindergarten"],
  "Transport & Logistics": ["Matatu Business", "Taxi / Ride-hailing", "Courier Service", "Logistics Company", "Truck Transport", "Delivery Services"],
  Technology: ["Software Development", "SaaS Business", "Cyber Café", "IT Services", "Online Business (E-commerce)"],
  "Financial Services": ["Lending Business", "SACCO", "Microfinance", "Insurance Agency", "Forex Bureau"],
  Healthcare: ["Clinic", "Pharmacy", "Hospital", "Laboratory", "Medical Supplies Shop"],
  "Real Estate": ["Property Management", "Real Estate Agency", "Rental Business", "Property Development"],
  "Creative & Media": ["Photography", "Videography", "Graphic Design", "Printing Services", "Music Production", "Content Creation"],
  Services: ["Salon / Barber Shop", "Laundry Business", "Cleaning Services", "Repair Shop (Phones/Electronics)", "Auto Garage", "Car Wash"],
  Manufacturing: ["Furniture Production", "Clothing Production", "Food Processing", "Metal Fabrication", "Plastic Production"],
  Wholesale: ["General Wholesale", "Food Wholesale", "Clothing Wholesale", "Electronics Wholesale", "Hardware Wholesale"]
};

const KENYA_COUNTIES = ["Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"];

const STATUS_COLORS = { Hot: "#ef4444", Warm: "#f59e0b", Cold: "#3b82f6" };
const LEAD_SOURCES = ["Walk-in", "Referral", "Field Agent", "Social Media", "Ads", "Event/Campaign"];

const AgingLeads = () => {
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

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Lead Form
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [isCustomIndustry, setIsCustomIndustry] = useState(false);
  const [isCustomType, setIsCustomType] = useState(false);

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
    } catch { showToast("Error loading aging leads", "error"); }
    finally { setIsLoading(false); }
  };

  const agingList = useMemo(() => {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    return allLeads.filter(l => !l.is_converted && new Date(l.created_at) < fourteenDaysAgo);
  }, [allLeads]);

  const stats = useMemo(() => {
    return {
      total: agingList.length,
      hot: agingList.filter(l => l.status === "Hot").length,
      warm: agingList.filter(l => l.status === "Warm").length,
      cold: agingList.filter(l => l.status === "Cold").length,
    };
  }, [agingList]);

  const visibleLeads = useMemo(() => {
    return agingList.filter(l => {
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
  }, [agingList, searchTerm, statusFilter, filterRegion, filterBranch, filterRO, sortConfig, branches]);

  const pagedLeads = useMemo(() => {
    const s = (currentPage - 1) * itemsPerPage;
    return visibleLeads.slice(s, s + itemsPerPage);
  }, [visibleLeads, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(visibleLeads.length / itemsPerPage);

  const activeFilterCount = [filterRegion, filterBranch, filterRO].filter(Boolean).length;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openEdit = (lead) => {
    setEditingLead(lead);
    setFormData({
      Firstname: lead.Firstname,
      Surname: lead.Surname,
      mobile: lead.mobile,
      business_name: lead.business_name,
      business_location: lead.business_location,
      business_type: lead.business_type,
      status: lead.status,
      industry: lead.industry || "General",
      source: lead.source || "Walk-in"
    });
    setIsCustomIndustry(!Object.keys(INDUSTRIES).includes(lead.industry));
    setIsCustomType(lead.industry && INDUSTRIES[lead.industry] && !INDUSTRIES[lead.industry].includes(lead.business_type));
    setShowLeadForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data, error } = await supabase.from("leads").update(formData).eq("id", editingLead.id).select();
      if (error) throw error;
      setAllLeads(prev => prev.map(l => l.id === editingLead.id ? { ...l, ...data[0] } : l));
      showToast("Lead updated successfully", "success");
      setShowLeadForm(false);
    } catch (err) {
      showToast("Failed to update lead", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await supabase.from("leads").delete().eq("id", deleteTarget.id);
      setAllLeads(prev => prev.filter(l => l.id !== deleteTarget.id));
      showToast("Lead deleted", "success");
    } finally { setIsDeleting(false); setDeleteTarget(null); }
  };

  if (isLoading) return <div className="h-64 flex items-center justify-center"><Spinner /></div>;

  return (
    <div className="bg-muted p-6 min-h-screen font-sans">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-sm  text-gray-600">Leads / Aging Leads</h1>
        </div>

      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Aging" value={stats.total} icon={ClockIcon} color="amber" />
        <StatCard label="Hot Aging" value={stats.hot} icon={UsersIcon} color="red" />
        <StatCard label="Warm Aging" value={stats.warm} icon={UsersIcon} color="yellow" />
        <StatCard label="Cold Aging" value={stats.cold} icon={UsersIcon} color="blue" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search aging leads..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all duration-200 bg-white" />
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
                <th className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap">Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap">Officer</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap">Branch</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap">Contact</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap">Business Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap">Location</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600  whitespace-nowrap cursor-pointer" onClick={() => setSortConfig(s => ({ key: "created_at", direction: s.direction === "asc" ? "desc" : "asc" }))}>Created ↕</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600  whitespace-nowrap">Age / Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600  whitespace-nowrap">Industry</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600  whitespace-nowrap">Source</th>
                {isOfficer && <th className="px-6 py-4 text-xs font-bold text-slate-600  whitespace-nowrap text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagedLeads.map(l => (
                <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm  text-gray-600 whitespace-nowrap">{l.Firstname} {l.Surname}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{l.created_by_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{branches.find(b => b.id === (l.branch_id || (Array.isArray(l.users?.profiles) ? l.users?.profiles[0]?.branch_id : l.users?.profiles?.branch_id)))?.name || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{l.mobile}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{l.business_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{l.business_location}</td>
                  <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col items-start gap-1">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white uppercase" style={{ backgroundColor: STATUS_COLORS[l.status] }}>{l.status}</span>
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                        {Math.floor((new Date() - new Date(l.created_at)) / (1000 * 60 * 60 * 24))} Days Old
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{l.industry || "General"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{l.source || "Walk-in"}</td>
                  {isOfficer && (
                    <td className="px-6 py-4 flex items-center justify-center gap-2">
                       <button onClick={() => navigate("/officer/customer-form", { state: { leadData: l, fromLeads: true } })} className="bg-brand-primary text-white px-2 py-1 rounded-md text-[10px] font-bold hover:bg-brand-primary/90">Convert</button>
                       <button onClick={() => openEdit(l)} className="p-1 text-gray-400 hover:text-brand-primary transition-all"><PencilSquareIcon className="h-4 w-4" /></button>
                       <button onClick={() => setDeleteTarget(l)} className="p-1 text-gray-400 hover:text-red-500 transition-all"><TrashIcon className="h-4 w-4" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleLeads.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">Showing <b>{(currentPage-1)*itemsPerPage+1}-{Math.min(currentPage*itemsPerPage, visibleLeads.length)}</b> of <b>{visibleLeads.length}</b></div>
            <div className="flex gap-1">
              <button disabled={currentPage===1} onClick={()=>setCurrentPage(p=>p-1)} className="px-3 py-1 bg-white border rounded-lg text-xs disabled:opacity-50">Prev</button>
              <button disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>p+1)} className="px-3 py-1 bg-white border rounded-lg text-xs disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 text-center">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><TrashIcon className="h-7 w-7" /></div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Lead?</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete <b>{deleteTarget.Firstname}</b>?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 font-bold text-gray-500 bg-gray-50 rounded-xl">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-2.5 font-bold text-white bg-red-50 rounded-xl bg-red-500 disabled:opacity-50">{isDeleting ? "..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {showLeadForm && (
        <div className="fixed inset-0 bg-black/35 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-[520px] rounded-2xl shadow-lg flex flex-col overflow-hidden border border-gray-100">
            <div className="flex justify-between items-center px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <UserPlusIcon className="h-5 w-5 font-semibold text-brand-primary" />
                <span className="text-lg text-brand-primary">{editingLead ? "Edit lead" : "Add new lead"}</span>
              </div>
              <button onClick={() => setShowLeadForm(false)} className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
                <XMarkIcon className="h-3 w-3 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5">
              <form onSubmit={handleSave} className="flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-600">First name <span className="text-brand-primary">*</span></label>
                    <input type="text" name="Firstname" value={formData.Firstname} onChange={handleInputChange} placeholder="Jane" required className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10 transition-all" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-600">Surname <span className="text-brand-primary">*</span></label>
                    <input type="text" name="Surname" value={formData.Surname} onChange={handleInputChange} placeholder="Doe" required className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10 transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-600">Mobile <span className="text-brand-primary">*</span></label>
                    <input type="text" name="mobile" value={formData.mobile} onChange={handleInputChange} placeholder="+254 700 000 000" required className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10 transition-all" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-600">Status</label>
                    <select name="status" value={formData.status} onChange={handleInputChange} className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10 transition-all appearance-none cursor-pointer">
                      <option value="Cold">Cold</option>
                      <option value="Warm">Warm</option>
                      <option value="Hot">Hot</option>
                    </select>
                  </div>
                </div>
                <hr className="border-gray-100 my-0.5" />
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-600">Business name <span className="text-brand-primary">*</span></label>
                  <input type="text" name="business_name" value={formData.business_name} onChange={handleInputChange} placeholder="Acme Ltd." required className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-600">Industry</label>
                    <select name="industry" value={isCustomIndustry ? "Other" : formData.industry} onChange={(e) => {
                      const val = e.target.value;
                      if (val === "Other") {
                        setIsCustomIndustry(true);
                        setFormData(prev => ({ ...prev, industry: "", business_type: "" }));
                      } else {
                        setIsCustomIndustry(false);
                        setFormData(prev => ({ ...prev, industry: val, business_type: "" }));
                      }
                      setIsCustomType(false);
                    }} className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10 transition-all appearance-none cursor-pointer">
                      <option value="">Select industry</option>
                      {Object.keys(INDUSTRIES).map(ind => <option key={ind} value={ind}>{ind}</option>)}
                      <option value="Other">Other (custom)</option>
                    </select>
                    {isCustomIndustry && (
                      <input type="text" name="industry" placeholder="Specify industry..." value={formData.industry} onChange={handleInputChange} className="mt-1.5 bg-white border border-brand-primary/25 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-brand-primary/50 transition-all animate-in fade-in slide-in-from-top-1 duration-150" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-600">Business type</label>
                    {!isCustomIndustry && Object.keys(INDUSTRIES).includes(formData.industry) ? (
                      <>
                        <select name="business_type" value={isCustomType ? "Other" : formData.business_type} onChange={(e) => {
                          const val = e.target.value;
                          if (val === "Other") {
                            setIsCustomType(true);
                            setFormData(prev => ({ ...prev, business_type: "" }));
                          } else {
                            setIsCustomType(false);
                            setFormData(prev => ({ ...prev, business_type: val }));
                          }
                        }} className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10 transition-all appearance-none cursor-pointer">
                          <option value="">Select type</option>
                          {INDUSTRIES[formData.industry].map(type => <option key={type} value={type}>{type}</option>)}
                          <option value="Other">Other (custom)</option>
                        </select>
                        {isCustomType && (
                          <input type="text" name="business_type" placeholder="Specify type..." value={formData.business_type} onChange={handleInputChange} className="mt-1.5 bg-white border border-brand-primary/25 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-brand-primary/50 transition-all animate-in fade-in slide-in-from-top-1 duration-150" />
                        )}
                      </>
                    ) : (
                      <input type="text" name="business_type" placeholder="Enter business type..." value={formData.business_type} onChange={handleInputChange} className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10 transition-all" />
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-gray-600">Business location (County)</label>
                  <select name="business_location" value={formData.business_location} onChange={handleInputChange} className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10 transition-all appearance-none cursor-pointer">
                    <option value="">Select county</option>
                    {KENYA_COUNTIES.map(county => <option key={county} value={county}>{county}</option>)}
                  </select>
                </div>
                <hr className="border-gray-100 my-0.5" />
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-gray-600">Lead source</label>
                    <select name="source" value={formData.source} onChange={handleInputChange} className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10 transition-all appearance-none cursor-pointer">
                      {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end items-center gap-2 pt-4 mt-1 border-t border-gray-100">
                  <button type="button" onClick={() => setShowLeadForm(false)} className="px-4 py-1.5 text-[11px] font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                  <button type="submit" disabled={isSaving} className="px-5 py-1.5 text-[11px] font-medium text-white bg-brand-primary rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">{isSaving ? "Saving..." : "Save lead"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color }) => {
  const colors = { blue: "bg-blue-50 text-blue-600", amber: "bg-amber-50 text-amber-600", red: "bg-red-50 text-red-600", yellow: "bg-yellow-50 text-yellow-600" };
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

export default AgingLeads;
