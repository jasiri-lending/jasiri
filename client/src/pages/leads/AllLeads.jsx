import { useState, useEffect, useMemo } from "react";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowPathIcon,
  XMarkIcon,
  CheckCircleIcon,
  UsersIcon,
  ClockIcon,
  ChartBarIcon,
  PencilSquareIcon,
  TrashIcon,
  UserPlusIcon,
  FunnelIcon,
  ChevronDownIcon,
  AdjustmentsHorizontalIcon,
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
  Retail: [
    "Clothing Shop",
    "Second-hand Clothes (Mtumba)",
    "Electronics Shop",
    "Grocery Shop",
    "Supermarket",
    "Cosmetics Shop",
    "Hardware Shop",
    "Furniture Shop",
    "Mobile Phone Shop",
    "General Shop (Kiosk)"
  ],
  "Hospitality & Entertainment": [
    "Bar",
    "Restaurant",
    "Hotel",
    "Club",
    "Café",
    "Lounge",
    "Fast Food Outlet"
  ],
  Agriculture: [
    "Crop Farming",
    "Dairy Farming",
    "Poultry Farming",
    "Fish Farming",
    "Agro-processing",
    "Agrovet Shop"
  ],
  Education: [
    "Primary School",
    "Secondary School",
    "College",
    "Training Institute",
    "Driving School",
    "Daycare / Kindergarten"
  ],
  "Transport & Logistics": [
    "Matatu Business",
    "Taxi / Ride-hailing",
    "Courier Service",
    "Logistics Company",
    "Truck Transport",
    "Delivery Services"
  ],
  Technology: [
    "Software Development",
    "SaaS Business",
    "Cyber Café",
    "IT Services",
    "Online Business (E-commerce)"
  ],
  "Financial Services": [
    "Lending Business",
    "SACCO",
    "Microfinance",
    "Insurance Agency",
    "Forex Bureau"
  ],
  Healthcare: [
    "Clinic",
    "Pharmacy",
    "Hospital",
    "Laboratory",
    "Medical Supplies Shop"
  ],
  "Real Estate": [
    "Property Management",
    "Real Estate Agency",
    "Rental Business",
    "Property Development"
  ],
  "Creative & Media": [
    "Photography",
    "Videography",
    "Graphic Design",
    "Printing Services",
    "Music Production",
    "Content Creation"
  ],
  Services: [
    "Salon / Barber Shop",
    "Laundry Business",
    "Cleaning Services",
    "Repair Shop (Phones/Electronics)",
    "Auto Garage",
    "Car Wash"
  ],
  Manufacturing: [
    "Furniture Production",
    "Clothing Production",
    "Food Processing",
    "Metal Fabrication",
    "Plastic Production"
  ],
  Wholesale: [
    "General Wholesale",
    "Food Wholesale",
    "Clothing Wholesale",
    "Electronics Wholesale",
    "Hardware Wholesale"
  ]
};

const STATUS_COLORS = { Hot: "#ef4444", Warm: "#f59e0b", Cold: "#3b82f6" };
const LEAD_SOURCES = ["Walk-in", "Referral", "Field Agent", "Social Media", "Ads", "Event/Campaign"];

const KENYA_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", 
  "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado", 
  "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", 
  "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", 
  "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit", 
  "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi", 
  "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", 
  "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River", 
  "Tharaka-Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", 
  "Wajir", "West Pokot"
];

const getDateRange = (preset) => {
  const now = new Date();
  const start = new Date();
  switch (preset) {
    case "today":
      start.setHours(0, 0, 0, 0);
      return { from: start, to: now };
    case "week":
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      return { from: start, to: now };
    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: now };
    case "year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: now };
    default:
      return null;
  }
};

const AllLeads = () => {
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
  const [filterDatePreset, setFilterDatePreset] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Data options
  const [regions, setRegions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [officers, setOfficers] = useState([]);

  // Modals / Save state
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [phoneError, setPhoneError] = useState("");
  const [isValidatingPhone, setIsValidatingPhone] = useState(false);

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
  const isCreditAnalyst = role === "credit_analyst_officer";
  const isAdminOrSuper = role === "admin" || role === "superadmin";

  const canFilterRegion = isCreditAnalyst || isCustomerService || isAdminOrSuper;
  const canFilterBranch = isCreditAnalyst || isCustomerService || isRegionalManager || isAdminOrSuper;
  const canFilterRO = isCreditAnalyst || isCustomerService || isRegionalManager || isBranchManager || isAdminOrSuper;


  // Effects
  useEffect(() => { if (profile) fetchFilterOptions(); }, [profile]);
  useEffect(() => { if (profile) fetchLeads(); }, [profile]);
  
  // Reset page on filter
  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, filterRegion, filterBranch, filterRO, filterDatePreset]);

  // Real-time phone validation with debounce
  useEffect(() => {
    const checkPhone = async () => {
      const clean = formData.mobile.replace(/\D/g, "");
      if (clean.length < 10) {
        setPhoneError("");
        return;
      }

      setIsValidatingPhone(true);
      try {
        let q = supabase.from("leads").select("id, Firstname, Surname").eq("mobile", clean);
        if (editingLead) q = q.neq("id", editingLead.id);
        
        const { data, error } = await q.maybeSingle();
        if (error) throw error;
        
        if (data) {
          setPhoneError("phone number already exists");
        } else {
          setPhoneError("");
        }
      } catch (err) {
        console.error("Phone validation error:", err);
      } finally {
        setIsValidatingPhone(false);
      }
    };

    if (!showLeadForm) {
      setPhoneError("");
      return;
    }

    const timer = setTimeout(checkPhone, 600);
    return () => clearTimeout(timer);
  }, [formData.mobile, showLeadForm, editingLead]);

  const fetchFilterOptions = async () => {
    try {
      if (canFilterRegion) {
        const { data } = await supabase.from("regions").select("id, name").eq("tenant_id", profile.tenant_id).order("name");
        setRegions(data || []);
      }
      // Fetch branches for name resolution and filtering
      let bQuery = supabase.from("branches").select("id, name, region_id").order("name");
      if (isRegionalManager && profile.region_id) bQuery = bQuery.eq("region_id", profile.region_id);
      else bQuery = bQuery.eq("tenant_id", profile.tenant_id);
      const { data: bData } = await bQuery;
      setBranches(bData || []);
      if (canFilterRO) {
        let q = supabase.from("users").select("id, full_name, profiles!inner(branch_id)").eq("role", "relationship_officer").eq("tenant_id", profile.tenant_id).order("full_name");
        if (isBranchManager && profile.branch_id) q = q.eq("profiles.branch_id", profile.branch_id);
        const { data } = await q;
        setOfficers(data || []);
      }
    } catch (err) { 
      console.error("fetchFilterOptions error:", err);
    }
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
        created_by_name: l.users?.full_name || "—",
        ro_branch_id: Array.isArray(l.users?.profiles) ? l.users?.profiles[0]?.branch_id : l.users?.profiles?.branch_id,
        ro_region_id: Array.isArray(l.users?.profiles) ? l.users?.profiles[0]?.region_id : l.users?.profiles?.region_id
      })));
    } catch { showToast("Failed to fetch leads", "error"); }
    finally { setIsLoading(false); }
  };

  const stats = useMemo(() => {
    const fourteenAgo = new Date(); fourteenAgo.setDate(fourteenAgo.getDate() - 14);
    const total = allLeads.length;
    const converted = allLeads.filter(l => l.is_converted).length;
    const aging = allLeads.filter(l => !l.is_converted && new Date(l.created_at) < fourteenAgo).length;
    const rate = total > 0 ? ((converted / total) * 100).toFixed(1) : 0;
    return { total, converted, aging, rate };
  }, [allLeads]);

  const visibleLeads = useMemo(() => {
    let list = allLeads;
    let dateRange = filterDatePreset === "custom" ? { from: new Date(filterDateFrom), to: new Date(filterDateTo + "T23:59:59") } : getDateRange(filterDatePreset);
    const activeBranchSet = filterRegion ? new Set(branches.filter(b => b.region_id === filterRegion).map(b => b.id)) : null;

    return list.filter(l => {
      const q = searchTerm.toLowerCase();
      if (q && !([l.Firstname, l.Surname, l.mobile, l.business_name, l.created_by_name].some(v => (v || "").toLowerCase().includes(q)))) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (filterRegion && activeBranchSet && !activeBranchSet.has(l.branch_id)) return false;
      if (filterBranch && l.branch_id !== filterBranch) return false;
      if (filterRO && l.created_by !== filterRO) return false;
      if (dateRange) {
        const d = new Date(l.created_at);
        if (d < dateRange.from || d > dateRange.to) return false;
      }
      return true;
    }).sort((a, b) => {
      const av = a[sortConfig.key] ?? "", bv = b[sortConfig.key] ?? "";
      return sortConfig.direction === "asc" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
  }, [allLeads, searchTerm, statusFilter, filterRegion, filterBranch, filterRO, filterDatePreset, filterDateFrom, filterDateTo, sortConfig, branches]);

  const pagedLeads = useMemo(() => {
    const s = (currentPage - 1) * itemsPerPage;
    return visibleLeads.slice(s, s + itemsPerPage);
  }, [visibleLeads, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(visibleLeads.length / itemsPerPage);

  const activeFilterCount = [filterRegion, filterBranch, filterRO, filterDatePreset].filter(Boolean).length;

  const clearFilters = () => { setFilterRegion(""); setFilterBranch(""); setFilterRO(""); setFilterDatePreset(""); setStatusFilter("all"); setSearchTerm(""); };
  const openAdd = () => { 
    setEditingLead(null); 
    setFormData(emptyForm); 
    setIsCustomIndustry(false); 
    setIsCustomType(false); 
    setShowLeadForm(true); 
  };
  const openEdit = (l) => { 
    setEditingLead(l); 
    const indExists = l.industry && Object.keys(INDUSTRIES).includes(l.industry);
    const typeExists = indExists && l.business_type && INDUSTRIES[l.industry].includes(l.business_type);
    
    setFormData({ 
      Firstname: l.Firstname, 
      Surname: l.Surname, 
      mobile: l.mobile, 
      business_name: l.business_name, 
      business_location: l.business_location, 
      business_type: l.business_type, 
      status: l.status, 
      source: l.source || "Walk-in", 
      industry: l.industry || "" 
    }); 
    
    setIsCustomIndustry(l.industry && !indExists);
    setIsCustomType(l.business_type && !typeExists);
    setShowLeadForm(true); 
  };
  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  const saveLead = async (e) => {
    e.preventDefault(); 
    if (phoneError) return;
    setIsSaving(true);
    try {
      const clean = formData.mobile.replace(/\D/g, "");
      if (clean.length < 10) throw new Error("Invalid mobile");
      if (editingLead) {
        const { error } = await supabase.from("leads").update({ ...formData, mobile: clean, estimated_amount: Number(formData.estimated_amount) }).eq("id", editingLead.id);
        if (error) throw error;
        setAllLeads(prev => prev.map(l => l.id === editingLead.id ? { ...l, ...formData, mobile: clean, estimated_amount: Number(formData.estimated_amount) } : l));
        showToast("Updated", "success");
      } else {
        const { data, error } = await supabase.from("leads").insert([{ ...formData, mobile: clean, estimated_amount: Number(formData.estimated_amount), created_by: profile.id, tenant_id: profile.tenant_id, branch_id: profile.branch_id, region_id: profile.region_id, created_at: new Date().toISOString() }]).select();
        if (error) throw error;
        if (data && data[0]) {
          setAllLeads(prev => [{ ...data[0], is_converted: false, created_by_name: profile.full_name }, ...prev]);
          showToast("Added", "success");
        }
      }
      setShowLeadForm(false);
    } catch (err) { 
      let msg = err.message || "Operation failed";
      if (err.code === "23505" || msg.includes("unique constraint") || msg.includes("already exists")) {
        msg = "phone number already exists";
      }
      showToast(msg, "error"); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await supabase.from("leads").delete().eq("id", deleteTarget.id);
      setAllLeads(prev => prev.filter(l => l.id !== deleteTarget.id));
      showToast("Deleted", "success");
    } catch { showToast("Failed", "error"); } finally { setIsDeleting(false); setDeleteTarget(null); }
  };

  if (isLoading) return <div className="h-64 flex items-center justify-center"><Spinner /></div>;

  return (
    <div className="bg-muted p-6 min-h-screen font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-sm  text-gray-600">Leads / All Leads</h1>
        </div>
        <div className="flex gap-2">
          {isOfficer && <button onClick={openAdd} className="px-3 py-1.5 bg-brand-primary text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-md hover:bg-brand-primary/90"><PlusIcon className="h-4 w-4" /> Add Lead</button>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Pipeline" value={stats.total} icon={UsersIcon} color="blue" />
        <StatCard label="Converted" value={stats.converted} icon={CheckCircleIcon} color="emerald" />
        <StatCard label="Aging (>14d)" value={stats.aging} icon={ClockIcon} color="amber" />
        <StatCard label="Conversion Rate" value={`${stats.rate}%`} icon={ChartBarIcon} color="purple" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-5">
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {/* Search Bar */}
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, mobile, or business..."
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
        </div>
      </div>


      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#E7F0FA] border-b">
              <tr>
                <th className="px-6 py-4 text-xs whitespace-nowrap text-slate-600 ">Name</th>
                <th className="px-6 py-4 text-xs whitespace-nowrap text-slate-600 ">Officer</th>
                <th className="px-6 py-4 text-xs whitespace-nowrap text-slate-600 ">Branch</th>
                <th className="px-6 py-4 text-xs whitespace-nowrap text-slate-600 ">Contact</th>
                <th className="px-6 py-4 text-xs whitespace-nowrap text-slate-600 ">Business Name</th>
                <th className="px-6 py-4 text-xs whitespace-nowrap text-slate-600 ">Location</th>
                <th className="px-6 py-4 text-xs whitespace-nowrap text-slate-600 ">Type</th>
                <th className="px-6 py-4 text-xs whitespace-nowrap text-slate-600  cursor-pointer" onClick={() => setSortConfig(s => ({ key: "created_at", direction: s.direction === "asc" ? "desc" : "asc" }))}>Created ↕</th>
                <th className="px-6 py-4 text-xs whitespace-nowrap text-slate-600 ">Status</th>
                <th className="px-6 py-4 text-xs whitespace-nowrap text-slate-600 ">Industry</th>
                <th className="px-6 py-4 text-xs whitespace-nowrap text-slate-600 ">Source</th>
                {isOfficer && <th className="px-6 py-4 text-xs font-bold text-slate-600  text-center">Actions</th>}
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
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{l.business_type}</td>
                  <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white uppercase whitespace-nowrap" style={{ backgroundColor: STATUS_COLORS[l.status] }}>{l.status}</span></td>
                  <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{l.industry || "General"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{l.source || "Walk-in"}</td>
                  {isOfficer && (
                    <td className="px-6 py-4 flex items-center justify-center gap-2">
                      <button onClick={() => navigate("/officer/customer-form", { state: { leadData: l, fromLeads: true } })} disabled={l.is_converted} className={`px-2 py-1 rounded-md text-[10px] font-bold ${l.is_converted ? "bg-emerald-50 text-emerald-600" : "bg-brand-primary text-white hover:bg-brand-primary/90"}`}>{l.is_converted ? "Converted" : "Convert"}</button>
                      <button onClick={() => openEdit(l)} className="p-1 text-gray-400 hover:text-brand-primary"><PencilSquareIcon className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteTarget(l)} className="p-1 text-gray-400 hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {visibleLeads.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">Showing <b>{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, visibleLeads.length)}</b> of <b>{visibleLeads.length}</b></div>
            <div className="flex gap-1">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50">Prev</button>
              {Array.from({ length: totalPages }).map((_, i) => (i + 1 === 1 || i + 1 === totalPages || (i + 1 >= currentPage - 1 && i + 1 <= currentPage + 1)) ? (
                <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-8 h-8 rounded-lg text-xs font-bold ${currentPage === i + 1 ? "bg-brand-primary text-white" : "bg-white border text-gray-600 hover:bg-gray-50"}`}>{i + 1}</button>
              ) : (i + 1 === currentPage - 2 || i + 1 === currentPage + 2) ? <span key={i} className="text-gray-400">...</span> : null)}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Improved Compact Lead Form Modal */}
      {showLeadForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Transparent Backdrop (No Blur) */}
          <div 
            className="absolute inset-0 bg-gray-900/40 transition-opacity duration-300" 
            onClick={() => setShowLeadForm(false)}
          />
          
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Professional Clean Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-primary/10 rounded-xl">
                  <UserPlusIcon className="h-5 w-5 text-brand-primary" />
                </div>
                <h2 className="text-lg  text-gray-600">
                  {editingLead ? "Edit Lead Details" : "Create New Lead"}
                </h2>
              </div>
              <button
                onClick={() => setShowLeadForm(false)}
                className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Compact Form Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
              <form onSubmit={saveLead} className="space-y-5">
                
                {/* Contact Section */}
                <div className="space-y-3">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    Contact Identity
                    <div className="h-px flex-1 bg-gray-100"></div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">First Name *</label>
                      <input
                        type="text" name="Firstname" value={formData.Firstname} onChange={handleChange}
                        placeholder="Jane" required
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Surname *</label>
                      <input
                        type="text" name="Surname" value={formData.Surname} onChange={handleChange}
                        placeholder="Doe" required
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Mobile *</label>
                      <div className="relative">
                        <input
                          type="text" name="mobile" value={formData.mobile} onChange={handleChange}
                          placeholder="0700 000 000" required
                          className={`w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 transition-all ${
                            phoneError 
                              ? "border-red-400 focus:ring-red-100 focus:border-red-500 text-red-700" 
                              : "border-gray-200 focus:ring-brand-primary/10 focus:border-brand-primary text-gray-700"
                          }`}
                        />
                        {isValidatingPhone && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <ArrowPathIcon className="h-3.5 w-3.5 animate-spin text-gray-400" />
                          </div>
                        )}
                      </div>
                      {phoneError && (
                        <p className="text-[11px] font-medium text-red-500 mt-1 animate-in fade-in slide-in-from-top-1">
                          {phoneError}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Lead Status</label>
                      <select
                        name="status" value={formData.status} onChange={handleChange}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all cursor-pointer"
                      >
                        <option value="Cold">Cold</option>
                        <option value="Warm">Warm</option>
                        <option value="Hot">Hot</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Business Section */}
                <div className="space-y-3 pt-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    Business Enterprise
                    <div className="h-px flex-1 bg-gray-100"></div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Business Name *</label>
                    <input
                      type="text" name="business_name" value={formData.business_name} onChange={handleChange}
                      placeholder="Acme Ltd." required
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Industry</label>
                      <select
                        name="industry" value={isCustomIndustry ? "Other" : formData.industry}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "Other") { setIsCustomIndustry(true); setFormData(p => ({ ...p, industry: "", business_type: "" })); }
                          else { setIsCustomIndustry(false); setFormData(p => ({ ...p, industry: val, business_type: "" })); }
                          setIsCustomType(false);
                        }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                      >
                        <option value="">Select industry</option>
                        {Object.keys(INDUSTRIES).map(ind => <option key={ind} value={ind}>{ind}</option>)}
                        <option value="Other">Other...</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Business Type</label>
                      {!isCustomIndustry && INDUSTRIES[formData.industry] ? (
                        <select
                          name="business_type" value={isCustomType ? "Other" : formData.business_type}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "Other") { setIsCustomType(true); setFormData(p => ({ ...p, business_type: "" })); }
                            else { setIsCustomType(false); setFormData(p => ({ ...p, business_type: val })); }
                          }}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                        >
                          <option value="">Select type</option>
                          {INDUSTRIES[formData.industry].map(type => <option key={type} value={type}>{type}</option>)}
                          <option value="Other">Other...</option>
                        </select>
                      ) : (
                        <input
                          type="text" name="business_type" value={formData.business_type} onChange={handleChange}
                          placeholder="e.g. Retail"
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                        />
                      )}
                    </div>
                  </div>

                  {/* Custom inputs moved to new row to keep vertical space controlled */}
                  {(isCustomIndustry || isCustomType) && (
                    <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-1">
                      <div>{isCustomIndustry && <input type="text" name="industry" placeholder="Specify industry..." value={formData.industry} onChange={handleChange} className="w-full bg-brand-primary/[0.03] border border-brand-primary/20 rounded-lg px-3 py-1.5 text-xs text-gray-700 italic border-dashed" />}</div>
                      <div>{isCustomType && <input type="text" name="business_type" placeholder="Specify type..." value={formData.business_type} onChange={handleChange} className="w-full bg-brand-primary/[0.03] border border-brand-primary/20 rounded-lg px-3 py-1.5 text-xs text-gray-700 italic border-dashed" />}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Location</label>
                      <select
                        name="business_location" value={formData.business_location} onChange={handleChange}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                      >
                        <option value="">Select county</option>
                        {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Lead Source</label>
                      <select
                        name="source" value={formData.source} onChange={handleChange}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary transition-all"
                      >
                        {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end items-center gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button" onClick={() => setShowLeadForm(false)}
                    className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit" disabled={isSaving || !!phoneError || isValidatingPhone}
                    className="px-6 py-2 text-sm font-bold text-white bg-brand-primary rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    {isSaving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PlusIcon className="h-4 w-4" />}
                    {isSaving ? "Saving..." : editingLead ? "Update Lead" : "Save Lead"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 text-center shadow-xl">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><TrashIcon className="h-7 w-7" /></div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Lead?</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete <b>{deleteTarget.Firstname}</b>? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 font-bold text-gray-500 bg-gray-50 rounded-xl">Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-2.5 font-bold text-white bg-red-500 rounded-xl disabled:opacity-50">{isDeleting ? "..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color }) => {
  const colors = { blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", purple: "bg-purple-50 text-purple-600" };
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
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

const FormField = ({ label, name, value, onChange, required = false, type = "text" }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</label>
    <input type={type} name={name} value={value} onChange={onChange} required={required} className="bg-gray-50 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all" />
  </div>
);

export default AllLeads;
