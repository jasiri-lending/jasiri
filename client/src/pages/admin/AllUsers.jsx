import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  FunnelIcon,
  XMarkIcon,
  UserCircleIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  UserPlusIcon,
  ChevronUpDownIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { API_BASE_URL } from "../../../config.js";
import Spinner from "../../components/Spinner";

export default function AllUsers() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [currentUserTenantId, setCurrentUserTenantId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Filtered state for modal dropdowns
  const [filteredRegions, setFilteredRegions] = useState([]);
  const [filteredBranches, setFilteredBranches] = useState([]);

  const mountedRef = useRef(true);

  const [availableRoles, setAvailableRoles] = useState([]);

  // Updated default roles including operations and hr
  const defaultRoles = [
    { value: "superadmin", label: "Super Admin", color: "bg-purple-100 text-purple-800" },
    { value: "admin", label: "Admin", color: "bg-emerald-100 text-emerald-800" },
    { value: "branch_manager", label: "Branch Manager", color: "bg-cyan-100 text-cyan-800" },
    { value: "operations", label: "Operations", color: "bg-blue-100 text-blue-800" },
    { value: "hr", label: "HR", color: "bg-pink-100 text-pink-800" },
    { value: "operation_officer", label: "Operation Officer", color: "bg-amber-100 text-amber-800" },
  ];

  const isSuperAdmin = profile?.role === 'superadmin';

  // Filter regions based on tenant and current selection
  const filterRegionsByTenant = useCallback((tenantId) => {
    if (!tenantId) {
      setFilteredRegions(regions);
      return;
    }

    const filtered = regions.filter(region => region.tenant_id === tenantId);
    setFilteredRegions(filtered);
  }, [regions]);

  // Filter branches based on region and tenant
  const filterBranchesByRegionAndTenant = useCallback((regionId, tenantId) => {
    let filtered = branches;

    if (tenantId) {
      filtered = filtered.filter(branch => branch.tenant_id === tenantId);
    }

    if (regionId) {
      filtered = filtered.filter(branch => branch.region_id === regionId);
    }

    setFilteredBranches(filtered);
  }, [branches]);

  // Handle region change in the form
  const handleRegionChange = (e) => {
    const regionId = e.target.value;
    setFormData(prev => ({
      ...prev,
      region_id: regionId,
      branch_id: ''
    }));

    const tenantId = isSuperAdmin ? formData.tenant_id : currentUserTenantId;
    filterBranchesByRegionAndTenant(regionId, tenantId);
  };

  // Handle tenant change (for superadmin only)
  const handleTenantChange = (e) => {
    const tenantId = e.target.value;
    setFormData(prev => ({
      ...prev,
      tenant_id: tenantId,
      region_id: '',
      branch_id: ''
    }));

    filterRegionsByTenant(tenantId);
    filterBranchesByRegionAndTenant(null, tenantId);
  };

  // Memoized fetch functions
  const fetchData = useCallback(async (tenantId, userRole) => {
    if (!tenantId && userRole !== 'superadmin') return;

    setLoading(true);
    try {
      const cacheKey = `users_${tenantId || 'all'}`;

      const [usersData, branchesData, regionsData, tenantsData] = await Promise.all([
        fetchUsers(tenantId, userRole),
        fetchBranches(tenantId, userRole),
        fetchRegions(tenantId, userRole),
        userRole === 'superadmin' ? fetchTenants() : Promise.resolve([])
      ]);

      // Cache the result
      const cachePayload = {
        users: usersData || [],
        branches: branchesData || [],
        regions: regionsData || [],
        tenants: tenantsData || [],
        timestamp: Date.now()
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify(cachePayload));
      } catch (e) {
        console.warn('Cache write failed', e);
      }

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const fetchInitialData = async () => {
      if (profile) {
        const tenantId = profile.tenant_id;
        setCurrentUserTenantId(tenantId);

        // Fetch roles dynamically
        let rolesQuery = supabase.from("roles").select("name").order("name");
        if (tenantId) {
          rolesQuery = rolesQuery.eq("tenant_id", tenantId);
        }

        try {
          const { data: rolesData } = await rolesQuery;
          if (rolesData && rolesData.length > 0) {
            const formatted = rolesData.map(r => ({
              value: r.name,
              label: r.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              color: getRoleColorClass(r.name)
            }));
            setAvailableRoles(formatted);
          } else {
            // Use default roles if none in database
            setAvailableRoles(defaultRoles);
          }
        } catch (e) {
          console.error("Error fetching roles", e);
          setAvailableRoles(defaultRoles);
        }

        // Try to load from localStorage first
        const cacheKey = `users_${tenantId || 'all'}`;
        const cachedData = localStorage.getItem(cacheKey);
        let loadedFromCache = false;

        if (cachedData && refreshKey === 0) {
          try {
            const parsed = JSON.parse(cachedData);
            const cacheAge = Date.now() - parsed.timestamp;
            if (cacheAge < 60 * 60 * 1000) {
              setUsers(parsed.users || []);
              setBranches(parsed.branches || []);
              setRegions(parsed.regions || []);
              if (parsed.tenants) setTenants(parsed.tenants);
              setTotalCount((parsed.users || []).length);
              setLoading(false);
              loadedFromCache = true;
            }
          } catch (e) {
            console.error('Error parsing cache:', e);
          }
        }

        if (mountedRef.current && !loadedFromCache) {
          await fetchData(tenantId, profile.role);
        }
      }
    };

    fetchInitialData();

    return () => {
      mountedRef.current = false;
    };
  }, [profile, refreshKey, fetchData]);

  const fetchUsers = async (tenantId, userRole, page = 1) => {
    try {
      let query = supabase
        .from("users")
        .select(`
          id,
          email,
          full_name,
          role,
          phone,
          created_at,
          tenant_id,
          tenants!users_tenant_id_fkey (
            name,
            company_name
          ),
          profiles (
            branch_id,
            region_id,
            tenant_id,
            branches (id, name),
            regions (id, name)
          )
        `, { count: 'exact' });

      if (userRole !== 'superadmin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      query = query.order("created_at", { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      if (data && mountedRef.current) {
        const mapped = data.map((u) => ({
          ...u,
          branch_id: u.profiles?.branch_id,
          region_id: u.profiles?.region_id,
          branches: u.profiles?.branches,
          regions: u.profiles?.regions,
          tenant_name: u.tenants?.name || u.tenants?.company_name || 'N/A'
        }));
        setUsers(mapped);
        setTotalCount(count || 0);
        return mapped;
      }
      return [];
    } catch (err) {
      console.error("Error fetching users:", err);
      return [];
    }
  };

  const fetchBranches = async (tenantId, userRole, page = 1) => {
    try {
      let query = supabase
        .from("branches")
        .select(`
          *,
          tenants!branches_tenant_id_fkey (
            name,
            company_name
          ),
          regions!branches_region_id_fkey (
            name
          )
        `, { count: 'exact' });

      if (userRole !== 'superadmin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      query = query.order("created_at", { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      if (data && mountedRef.current) {
        const mapped = data.map(branch => ({
          ...branch,
          tenant_name: branch.tenants?.name || branch.tenants?.company_name || 'N/A',
          region_name: branch.regions?.name || 'N/A'
        }));
        setBranches(mapped);
        return mapped;
      }
      return [];
    } catch (err) {
      console.error("Error fetching branches:", err);
      return [];
    }
  };

  const fetchRegions = async (tenantId, userRole, page = 1) => {
    try {
      let query = supabase
        .from("regions")
        .select(`
          *,
          tenants!regions_tenant_id_fkey (
            name,
            company_name
          )
        `, { count: 'exact' });

      if (userRole !== 'superadmin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      query = query.order("created_at", { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      if (data && mountedRef.current) {
        const mapped = data.map(region => ({
          ...region,
          tenant_name: region.tenants?.name || region.tenants?.company_name || 'N/A'
        }));
        setRegions(mapped);
        return mapped;
      }
      return [];
    } catch (err) {
      console.error("Error fetching regions:", err);
      return [];
    }
  };

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, company_name")
        .order("name", { ascending: true });

      if (error) throw error;
      if (data && mountedRef.current) {
        setTenants(data);
        return data;
      }
      return [];
    } catch (err) {
      console.error("Error fetching tenants:", err);
      return [];
    }
  };

  const getRoleColorClass = (role) => {
    const roleConfig = defaultRoles.find(r => r.value === role) || defaultRoles.find(r => r.value === 'admin');
    return roleConfig?.color || "bg-gray-100 text-gray-800";
  };

  const roleRequiresBranchRegion = (role) => {
    return role && role !== 'admin' && role !== 'operation_officer' && role !== 'superadmin' && role !== 'operations' && role !== 'hr';
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);

    if (type === 'user' && !item) {
      setIsAddingUser(true);
      const initialFormData = {
        password: '',
        ...(currentUserTenantId && !isSuperAdmin ? { tenant_id: currentUserTenantId } : {})
      };

      if (currentUserTenantId && !isSuperAdmin) {
        filterRegionsByTenant(currentUserTenantId);
        filterBranchesByRegionAndTenant(null, currentUserTenantId);
      } else {
        setFilteredRegions(regions);
        setFilteredBranches(branches);
      }

      setFormData(initialFormData);
    } else if (item) {
      const { password, confirmPassword, ...itemData } = item;
      setFormData(itemData);

      const tenantId = isSuperAdmin ? (item.tenant_id || currentUserTenantId) : currentUserTenantId;
      filterRegionsByTenant(tenantId);

      if (item.region_id) {
        filterBranchesByRegionAndTenant(item.region_id, tenantId);
      } else {
        filterBranchesByRegionAndTenant(null, tenantId);
      }
    } else {
      const initialData = {
        ...(currentUserTenantId && !isSuperAdmin ? { tenant_id: currentUserTenantId } : {})
      };

      if (currentUserTenantId && !isSuperAdmin) {
        filterRegionsByTenant(currentUserTenantId);
        filterBranchesByRegionAndTenant(null, currentUserTenantId);
      } else {
        setFilteredRegions(regions);
        setFilteredBranches(branches);
      }

      setFormData(initialData);
    }

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setEditingItem(null);
    setIsAddingUser(false);
    setFormData({});
    setFilteredRegions([]);
    setFilteredBranches([]);
  };

  const handleManualRefresh = () => {
    setCurrentPage(1);
    setRefreshKey(prev => prev + 1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchPageData(page);
  };

  const fetchPageData = (page) => {
    if (!profile) return;

    const tenantId = profile.tenant_id;
    const userRole = profile.role;

    fetchUsers(tenantId, userRole, page);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (modalType === "user") {
        if (isAddingUser) {
          await handleCreateUser();
        } else {
          await handleUpdateUser();
        }
      } else if (modalType === "branch") {
        await handleBranchSubmit();
      } else if (modalType === "region") {
        await handleRegionSubmit();
      }

      fetchPageData(currentPage);
      closeModal();
      alert(`${modalType.charAt(0).toUpperCase() + modalType.slice(1)} ${editingItem ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error("Error submitting:", error);
      alert("Error: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateUser = async () => {
    if (formData.password && formData.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const requiresBranchRegion = roleRequiresBranchRegion(formData.role);

    const response = await fetch(`${API_BASE_URL}/create-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: formData.full_name?.trim(),
        email: formData.email?.trim(),
        password: formData.password?.trim(),
        role: formData.role,
        phone: formData.phone?.trim() || null,
        branch_id: requiresBranchRegion ? (formData.branch_id || null) : null,
        region_id: requiresBranchRegion ? (formData.region_id || null) : null,
        logged_in_tenant_id: currentUserTenantId,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Failed to create user");
    }
  };

  const handleUpdateUser = async () => {
    const requiresBranchRegion = roleRequiresBranchRegion(formData.role);

    const userData = {
      full_name: formData.full_name?.trim(),
      email: formData.email?.trim(),
      role: formData.role,
      phone: formData.phone?.trim() || null,
    };

    if (isSuperAdmin && formData.tenant_id) {
      userData.tenant_id = formData.tenant_id;
    }

    const { error: userError } = await supabase
      .from("users")
      .update(userData)
      .eq("id", editingItem.id);

    if (userError) throw userError;

    const profileData = {
      branch_id: requiresBranchRegion ? (formData.branch_id || null) : null,
      region_id: requiresBranchRegion ? (formData.region_id || null) : null,
    };

    if (isSuperAdmin && formData.tenant_id) {
      profileData.tenant_id = formData.tenant_id;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileData)
      .eq("id", editingItem.id);

    if (profileError) throw profileError;
  };

  const handleBranchSubmit = async () => {
    const branchData = {
      name: formData.name?.trim(),
      region_id: formData.region_id || null,
      code: formData.code?.trim(),
      address: formData.address?.trim() || null,
    };

    if (!isSuperAdmin && currentUserTenantId) {
      branchData.tenant_id = currentUserTenantId;
    } else if (isSuperAdmin && formData.tenant_id) {
      branchData.tenant_id = formData.tenant_id;
    }

    if (!branchData.name || !branchData.region_id) {
      throw new Error("Branch name and region are required");
    }

    const query = editingItem
      ? supabase.from("branches").update(branchData).eq("id", editingItem.id)
      : supabase.from("branches").insert(branchData);

    const { error } = await query;
    if (error) throw error;
  };

  const handleRegionSubmit = async () => {
    const regionData = {
      name: formData.name?.trim(),
      code: formData.code?.trim(),
    };

    if (!isSuperAdmin && currentUserTenantId) {
      regionData.tenant_id = currentUserTenantId;
    } else if (isSuperAdmin && formData.tenant_id) {
      regionData.tenant_id = formData.tenant_id;
    }

    if (!regionData.name || !regionData.code) {
      throw new Error("Region name and code are required");
    }

    const query = editingItem
      ? supabase.from("regions").update(regionData).eq("id", editingItem.id)
      : supabase.from("regions").insert(regionData);

    const { error } = await query;
    if (error) throw error;
  };

  const handleDelete = async (type, id) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      if (type === "user") {
        await supabase.from("profiles").delete().eq("id", id);
        const { error } = await supabase.from("users").delete().eq("id", id);
        if (error) throw error;
        setUsers(prev => prev.filter(user => user.id !== id));
      } else {
        const table = type === "branch" ? "branches" : "regions";
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) throw error;
        if (table === "branches") {
          setBranches(prev => prev.filter(branch => branch.id !== id));
        } else {
          setRegions(prev => prev.filter(region => region.id !== id));
        }
      }
      alert(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`);
      fetchPageData(currentPage);
    } catch (err) {
      alert(`Error deleting ${type}: ` + err.message);
    }
  };

  // Filter data for display
  const filteredData = useMemo(() => {
    return users.filter(user => {
      const matchesSearch =
        (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.phone || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = !filterRole || user.role === filterRole;
      const matchesRegion = !filterRegion || user.region_id === filterRegion;
      const matchesBranch = !filterBranch || user.branch_id === filterBranch;

      return matchesSearch && matchesRole && matchesRegion && matchesBranch;
    });
  }, [users, searchTerm, filterRole, filterRegion, filterBranch]);

  const clearFilters = () => {
    setFilterRole('');
    setFilterRegion('');
    setFilterBranch('');
  };

  // Calculate pagination values
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  // Get role display label
  const getRoleLabel = (roleValue) => {
    const role = availableRoles.find(r => r.value === roleValue) || defaultRoles.find(r => r.value === roleValue);
    return role?.label || roleValue.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-surface p-6 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-surface p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
              <p className="text-slate-600 mt-1">Manage all users and their permissions</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleManualRefresh}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-slate-700"
                title="Refresh"
              >
                <ArrowPathIcon className="h-5 w-5" />
                <span className="font-medium">Refresh</span>
              </button>

              <button
                onClick={() => openModal('user')}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-blue-800 transition-colors shadow-sm"
              >
                <UserPlusIcon className="h-5 w-5" />
                <span className="font-medium">Add User</span>
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mt-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="relative flex-1 max-w-xl w-full">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-4 py-3 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-3 border rounded-lg transition-colors ${showFilters || filterRole || filterRegion || filterBranch
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'border-gray-300 hover:bg-gray-50 text-slate-700'
                  }`}
              >
                <FunnelIcon className="h-5 w-5" />
                <span className="font-medium">Filters</span>
                {(filterRole || filterRegion || filterBranch) && (
                  <span className="bg-accent text-white text-xs px-2 py-1 rounded-full">
                    {[filterRole, filterRegion, filterBranch].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="mt-6 p-5 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <div className="relative">
                      <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary appearance-none bg-white"
                      >
                        <option value="">All Roles</option>
                        {availableRoles.map(role => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                      <ChevronUpDownIcon className="h-5 w-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
                    <div className="relative">
                      <select
                        value={filterRegion}
                        onChange={(e) => {
                          setFilterRegion(e.target.value);
                          if (e.target.value !== filterRegion) {
                            setFilterBranch('');
                          }
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary appearance-none bg-white"
                      >
                        <option value="">All Regions</option>
                        {regions
                          .filter(region => isSuperAdmin || region.tenant_id === currentUserTenantId)
                          .map(region => (
                            <option key={region.id} value={region.id}>{region.name}</option>
                          ))
                        }
                      </select>
                      <ChevronUpDownIcon className="h-5 w-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                    <div className="relative">
                      <select
                        value={filterBranch}
                        onChange={(e) => setFilterBranch(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary appearance-none bg-white"
                      >
                        <option value="">All Branches</option>
                        {branches
                          .filter(branch => {
                            if (!isSuperAdmin && branch.tenant_id !== currentUserTenantId) return false;
                            if (filterRegion && branch.region_id !== filterRegion) return false;
                            return true;
                          })
                          .map(branch => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                          ))
                        }
                      </select>
                      <ChevronUpDownIcon className="h-5 w-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="text-primary hover:text-blue-800 font-medium px-4 py-2"
                  >
                    Clear all filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total Users', value: totalCount, icon: UsersIcon, color: 'bg-blue-500' },
            { label: 'Admins', value: users.filter(u => u.role === 'admin' || u.role === 'superadmin').length, icon: UserCircleIcon, color: 'bg-emerald-500' },
            { label: 'Managers', value: users.filter(u => u.role?.includes('manager')).length, icon: BuildingOfficeIcon, color: 'bg-cyan-500' },
            { label: 'Operations & HR', value: users.filter(u => u.role === 'operations' || u.role === 'hr').length, icon: UsersIcon, color: 'bg-violet-500' },
          ].map((stat, index) => (
            <div key={stat.label} className="bg-white rounded-xl shadow p-6 border border-gray-100">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.color} bg-opacity-10`}>
                  <stat.icon className={`h-6 w-6 ${stat.color.replace('bg-', 'text-')}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Branch</th>
                  <th className="px6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Region</th>
                  {isSuperAdmin && (
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Tenant</th>
                  )}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((user) => {
                  const roleColorClass = getRoleColorClass(user.role);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary font-semibold text-sm">
                                {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-gray-900">{user.full_name || 'No Name'}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{user.phone || 'Not provided'}</div>
                        <div className="text-xs text-gray-500">
                          Joined {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1.5 inline-flex text-xs font-semibold rounded-full ${roleColorClass}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {roleRequiresBranchRegion(user.role)
                          ? (user.branches?.name || 'Not assigned')
                          : <span className="text-gray-400">All Branches</span>
                        }
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {roleRequiresBranchRegion(user.role)
                          ? (user.regions?.name || 'Not assigned')
                          : <span className="text-gray-400">All Regions</span>
                        }
                      </td>
                      {isSuperAdmin && (
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {user.tenant_name}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => openModal('user', user)}
                            className="text-primary hover:text-blue-800 transition-colors p-1.5 rounded hover:bg-blue-50"
                            title="Edit user"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete('user', user.id)}
                            className="text-rose-600 hover:text-rose-800 transition-colors p-1.5 rounded hover:bg-rose-50"
                            title="Delete user"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredData.length === 0 && (
              <div className="text-center py-16">
                <UserCircleIcon className="mx-auto h-14 w-14 text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No users found</h3>
                <p className="mt-2 text-gray-600 max-w-md mx-auto">
                  {searchTerm || filterRole || filterRegion || filterBranch
                    ? "Try adjusting your search or filter criteria"
                    : "No users have been added yet"}
                </p>
                {!searchTerm && !filterRole && !filterRegion && !filterBranch && (
                  <button
                    onClick={() => openModal('user')}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-blue-800 transition-colors"
                  >
                    <UserPlusIcon className="h-5 w-5" />
                    Add First User
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-4">
              <div className="flex flex-1 justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of{' '}
                    <span className="font-medium">{totalCount}</span> users
                  </p>
                </div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-3 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-30"
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  {pageNumbers.slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2)).map((number) => (
                    <button
                      key={number}
                      onClick={() => handlePageChange(number)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${currentPage === number
                          ? 'z-10 bg-primary text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
                          : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      {number}
                    </button>
                  ))}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-3 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-30"
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </nav>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-5 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editingItem ? 'Edit' : 'Add'} {modalType === 'user' ? 'User' : modalType === 'branch' ? 'Branch' : 'Region'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {editingItem ? 'Update user information' : 'Add a new user to the system'}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {modalType === 'user' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                      <input
                        type="text"
                        value={formData.full_name || ''}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        required
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        required
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  {isAddingUser && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                      <input
                        type="password"
                        value={formData.password || ''}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        required={isAddingUser}
                        minLength={6}
                        placeholder="••••••••"
                      />
                      <p className="text-xs text-gray-500 mt-2">Password must be at least 6 characters long</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                      <select
                        value={formData.role || ''}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
                        required
                      >
                        <option value="">Select Role</option>
                        {availableRoles.map(role => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>

                  {roleRequiresBranchRegion(formData.role) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
                        <select
                          value={formData.region_id || ''}
                          onChange={handleRegionChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
                        >
                          <option value="">Select Region</option>
                          {filteredRegions.map(region => (
                            <option key={region.id} value={region.id}>{region.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                        <select
                          value={formData.branch_id || ''}
                          onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
                          disabled={!formData.region_id}
                        >
                          <option value="">Select Branch</option>
                          {filteredBranches.map(branch => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {isSuperAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tenant</label>
                      <select
                        value={formData.tenant_id || ''}
                        onChange={handleTenantChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
                      >
                        <option value="">Select Tenant</option>
                        {tenants.map(tenant => (
                          <option key={tenant.id} value={tenant.id}>
                            {tenant.name || tenant.company_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors font-medium"
                    >
                      {submitting ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 inline animate-spin mr-2" />
                          {isAddingUser ? 'Creating...' : 'Updating...'}
                        </>
                      ) : (
                        editingItem ? 'Update User' : 'Create User'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}