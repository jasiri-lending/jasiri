import { useState, useEffect, useCallback } from 'react';
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
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";

export default function AllUsers() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
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
  const [activeTab, setActiveTab] = useState('users');
  const [currentUserTenantId, setCurrentUserTenantId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddingUser, setIsAddingUser] = useState(false);

  const roles = [
    { value: "admin", label: "Admin", color: "emerald" },
    { value: "operation_officer", label: "Operation Officer", color: "amber" },
    { value: "regional_manager", label: "Regional Manager", color: "blue" },
    { value: "relationship_officer", label: "Relationship Officer", color: "indigo" },
    { value: "customer_service_officer", label: "Customer Service Officer", color: "violet" },
    { value: "credit_analyst_officer", label: "Credit Analyst Officer", color: "rose" },
    { value: "branch_manager", label: "Branch Manager", color: "cyan" },
  ];

  const isSuperAdmin = profile?.role === 'superadmin';
  const isAdmin = profile?.role === 'admin';

  // Memoized fetch functions to prevent unnecessary reloads
  const fetchData = useCallback(async (tenantId, userRole) => {
    if (!tenantId && userRole !== 'superadmin') return;
    
    setLoading(true);
    try {
      await Promise.all([
        fetchUsers(tenantId, userRole),
        fetchBranches(tenantId, userRole),
        fetchRegions(tenantId, userRole)
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    
    if (profile) {
      console.log('Profile loaded:', {
        role: profile.role,
        tenant_id: profile.tenant_id
      });
      
      const tenantId = profile.tenant_id;
      setCurrentUserTenantId(tenantId);
      
      if (mounted) {
        fetchData(tenantId, profile.role);
      }
    }

    return () => {
      mounted = false;
    };
  }, [profile, fetchData, refreshKey]); // Added refreshKey as dependency

  const fetchUsers = async (tenantId, userRole) => {
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
          profiles (
            branch_id,
            region_id,
            tenant_id,
            branches (id, name),
            regions (id, name)
          )
        `);

      if (userRole !== 'superadmin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const mapped = data.map((u) => ({
          ...u,
          branch_id: u.profiles?.branch_id,
          region_id: u.profiles?.region_id,
          branches: u.profiles?.branches,
          regions: u.profiles?.regions,
        }));
        setUsers(mapped);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const fetchBranches = async (tenantId, userRole) => {
    try {
      let query = supabase.from("branches").select("*");
      
      if (userRole !== 'superadmin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      if (data) setBranches(data);
    } catch (err) {
      console.error("Error fetching branches:", err);
    }
  };

  const fetchRegions = async (tenantId, userRole) => {
    try {
      let query = supabase.from("regions").select("*");
      
      if (userRole !== 'superadmin' && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      if (data) setRegions(data);
    } catch (err) {
      console.error("Error fetching regions:", err);
    }
  };

  const roleRequiresBranchRegion = (role) => {
    return role && role !== 'admin' && role !== 'operation_officer' && role !== 'superadmin';
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    
    if (type === 'user' && !item) {
      // New user form
      setIsAddingUser(true);
      setFormData({
        password: '',
        confirmPassword: '',
        ...(currentUserTenantId && !isSuperAdmin ? { tenant_id: currentUserTenantId } : {})
      });
    } else if (item) {
      // Edit mode
      setFormData(item);
    } else {
      // New branch/region
      setFormData({
        ...(currentUserTenantId && !isSuperAdmin ? { tenant_id: currentUserTenantId } : {})
      });
    }
    
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setEditingItem(null);
    setIsAddingUser(false);
    setFormData({});
  };

  const handleManualRefresh = () => {
    setRefreshKey(prev => prev + 1);
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

      await fetchData(currentUserTenantId, profile?.role);
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
    if (formData.password !== formData.confirmPassword) {
      throw new Error("Passwords do not match");
    }

    if (formData.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const requiresBranchRegion = roleRequiresBranchRegion(formData.role);

    const response = await fetch("http://localhost:5000/create-user", {
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
        logged_in_tenant_id: currentUserTenantId
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
    } catch (err) {
      alert(`Error deleting ${type}: ` + err.message);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.phone || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = !filterRole || user.role === filterRole;
    const matchesRegion = !filterRegion || user.region_id === filterRegion;
    const matchesBranch = !filterBranch || user.branch_id === filterBranch;

    return matchesSearch && matchesRole && matchesRegion && matchesBranch;
  });

  const filteredBranches = branches.filter(b =>
    (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRegions = regions.filter(r =>
    (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const clearFilters = () => {
    setFilterRole('');
    setFilterRegion('');
    setFilterBranch('');
  };

  const getRoleColor = (roleValue) => {
    const role = roles.find(r => r.value === roleValue);
    return role ? role.color : 'gray';
  };

  const getStatsColor = (index) => {
    const colors = [
      { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
      { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
      { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
      { bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#586ab1] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-sm  text-slate-600">User Management</h1>
         
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleManualRefresh}
                className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                <h3 className='text-sm text-slate-600'> Refresh</h3>
               
              </button>
              {/* {isAdmin && currentUserTenantId && (
                <div className="text-sm bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg font-medium">
                  Admin - Tenant View
                </div>
              )}
              {isSuperAdmin && (
                <div className="text-sm bg-amber-100 text-amber-800 px-3 py-1 rounded-lg font-medium">
                  Super Admin Mode
                </div>
              )} */}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-[#586ab1] text-[#586ab1]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <UserCircleIcon className="h-5 w-5 inline-block mr-2" />
                Users
                <span className="ml-2 bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded-full">
                  {users.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('branches')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'branches'
                    ? 'border-[#586ab1] text-[#586ab1]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BuildingOfficeIcon className="h-5 w-5 inline-block mr-2" />
                Branches
                <span className="ml-2 bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded-full">
                  {branches.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('regions')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'regions'
                    ? 'border-[#586ab1] text-[#586ab1]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <MapPinIcon className="h-5 w-5 inline-block mr-2" />
                Regions
                <span className="ml-2 bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded-full">
                  {regions.length}
                </span>
              </button>
            </nav>
          </div>

          <div className="p-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-[#586ab1] focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              {activeTab === 'users' && (
                <>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <FunnelIcon className="h-5 w-5 mr-2" />
                    Filters
                    {(filterRole || filterRegion || filterBranch) && (
                      <span className="ml-2 bg-[#586ab1] text-white text-xs font-semibold px-2 py-1 rounded-full">
                        Active
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => openModal('user')}
                    className="flex items-center px-4 py-2 bg-[#586ab1] text-white rounded-lg hover:bg-[#4a5a9a] transition-colors"
                  >
                    <UserPlusIcon className="h-5 w-5 mr-2" />
                    Add User
                  </button>
                </>
              )}
              {activeTab === 'branches' && (
                <button
                  onClick={() => openModal('branch')}
                  className="flex items-center px-4 py-2 bg-[#586ab1] text-white rounded-lg hover:bg-[#4a5a9a] transition-colors"
                >
                  <UserPlusIcon className="h-5 w-5 mr-2" />
                  Add Branch
                </button>
              )}
              {activeTab === 'regions' && (
                <button
                  onClick={() => openModal('region')}
                  className="flex items-center px-4 py-2 bg-[#586ab1] text-white rounded-lg hover:bg-[#4a5a9a] transition-colors"
                >
                  <UserPlusIcon className="h-5 w-5 mr-2" />
                  Add Region
                </button>
              )}
            </div>
          </div>

          {showFilters && activeTab === 'users' && (
            <div className="px-6 pb-6 pt-0 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <div className="relative">
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] appearance-none"
                    >
                      <option value="">All Roles</option>
                      {roles.map(role => (
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
                      onChange={(e) => setFilterRegion(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] appearance-none"
                    >
                      <option value="">All Regions</option>
                      {regions.map(region => (
                        <option key={region.id} value={region.id}>{region.name}</option>
                      ))}
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] appearance-none"
                    >
                      <option value="">All Branches</option>
                      {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                    <ChevronUpDownIcon className="h-5 w-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-sm text-[#586ab1] hover:text-[#4a5a9a] font-medium"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'users' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              {[
                { label: 'Total Users', value: users.length, icon: UserCircleIcon },
                { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: null },
                { label: 'Managers', value: users.filter(u => u.role?.includes('manager')).length, icon: null },
                { label: 'Officers', value: users.filter(u => u.role?.includes('officer')).length, icon: null },
              ].map((stat, index) => {
                const color = getStatsColor(index);
                return (
                  <div key={stat.label} className={`bg-white rounded-lg shadow p-6 border ${color.border}`}>
                    <div className="flex items-center">
                      {stat.icon ? (
                        <stat.icon className={`h-8 w-8 ${color.text}`} />
                      ) : (
                        <div className={`h-8 w-8 ${color.bg} rounded-lg flex items-center justify-center`}>
                          <span className={`${color.text} font-bold`}>
                            {stat.label.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                        <p className={`text-2xl font-bold ${color.text}`}>{stat.value}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
                      {isSuperAdmin && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant ID</th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => {
                      const roleColor = getRoleColor(user.role);
                      return (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                  <span className="text-emerald-600 font-medium text-sm">
                                    {user.full_name?.charAt(0)?.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{user.phone || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-${roleColor}-100 text-${roleColor}-800`}>
                              {roles.find(r => r.value === user.role)?.label || user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {roleRequiresBranchRegion(user.role) 
                              ? (user.branches?.name || 'N/A')
                              : <span className="italic text-gray-400">All Branches</span>
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {roleRequiresBranchRegion(user.role)
                              ? (user.regions?.name || 'N/A')
                              : <span className="italic text-gray-400">All Regions</span>
                            }
                          </td>
                          {isSuperAdmin && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                              {user.tenant_id ? user.tenant_id.substring(0, 8) + '...' : 'N/A'}
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => openModal('user', user)}
                              className="text-[#586ab1] hover:text-[#4a5a9a] mr-4 transition-colors"
                              title="Edit user"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete('user', user.id)}
                              className="text-rose-600 hover:text-rose-800 transition-colors"
                              title="Delete user"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredUsers.length === 0 && (
                <div className="text-center py-12">
                  <UserCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
                  <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'branches' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                    {isSuperAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant ID</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBranches.map((branch) => (
                    <tr key={branch.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{branch.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                          {branch.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {regions.find(r => r.id === branch.region_id)?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{branch.address || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full">
                          {users.filter(u => u.branch_id === branch.id).length}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {branch.tenant_id ? branch.tenant_id.substring(0, 8) + '...' : 'N/A'}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => openModal('branch', branch)}
                          className="text-[#586ab1] hover:text-[#4a5a9a] mr-3 transition-colors"
                          title="Edit branch"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete('branch', branch.id)}
                          className="text-rose-600 hover:text-rose-800 transition-colors"
                          title="Delete branch"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredBranches.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  No branches found
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'regions' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branches</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                    {isSuperAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant ID</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRegions.map((region) => {
                    const regionBranches = branches.filter(b => b.region_id === region.id);
                    const regionUsers = users.filter(u => u.region_id === region.id);
                    return (
                      <tr key={region.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{region.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                            {region.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            {regionBranches.length}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full">
                            {regionUsers.length}
                          </span>
                        </td>
                        {isSuperAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                            {region.tenant_id ? region.tenant_id.substring(0, 8) + '...' : 'N/A'}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => openModal('region', region)}
                            className="text-[#586ab1] hover:text-[#4a5a9a] mr-3 transition-colors"
                            title="Edit region"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete('region', region.id)}
                            className="text-rose-600 hover:text-rose-800 transition-colors"
                            title="Delete region"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredRegions.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  No regions found
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                {editingItem ? 'Edit' : 'Add'} {modalType === 'user' ? 'User' : modalType === 'branch' ? 'Branch' : 'Region'}
              </h2>
              <button 
                onClick={closeModal} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {modalType === 'user' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                      <input
                        type="text"
                        value={formData.full_name || ''}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                        required
                      />
                    </div>
                  </div>

                  {isAddingUser && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                        <input
                          type="password"
                          value={formData.password || ''}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                          required={isAddingUser}
                          minLength={6}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                        <input
                          type="password"
                          value={formData.confirmPassword || ''}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                          required={isAddingUser}
                          minLength={6}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                      <select
                        value={formData.role || ''}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                        required
                      >
                        <option value="">Select Role</option>
                        {roles.map(role => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                      />
                    </div>
                  </div>

                  {roleRequiresBranchRegion(formData.role) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                        <select
                          value={formData.region_id || ''}
                          onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                        >
                          <option value="">Select Region</option>
                          {regions.map(region => (
                            <option key={region.id} value={region.id}>{region.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                        <select
                          value={formData.branch_id || ''}
                          onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                        >
                          <option value="">Select Branch</option>
                          {branches.map(branch => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {isSuperAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
                      <input
                        type="text"
                        value={formData.tenant_id || ''}
                        onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                        placeholder="Leave empty for current tenant"
                      />
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-6">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-[#586ab1] text-white rounded-lg hover:bg-[#4a5a9a] disabled:opacity-50 transition-colors"
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

              {modalType === 'branch' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Branch Code *</label>
                      <input
                        type="text"
                        required
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Region *</label>
                    <select
                      required
                      value={formData.region_id || ''}
                      onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                    >
                      <option value="">Select Region</option>
                      {regions.map(region => (
                        <option key={region.id} value={region.id}>{region.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                    />
                  </div>

                  {isSuperAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
                      <input
                        type="text"
                        value={formData.tenant_id || ''}
                        onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                        placeholder="Leave empty for current tenant"
                      />
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-6">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-[#586ab1] text-white rounded-lg hover:bg-[#4a5a9a] disabled:opacity-50 transition-colors"
                    >
                      {submitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </button>
                  </div>
                </div>
              )}

              {modalType === 'region' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Region Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Region Code *</label>
                      <input
                        type="text"
                        required
                        value={formData.code || ''}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                      />
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
                      <input
                        type="text"
                        value={formData.tenant_id || ''}
                        onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1]"
                        placeholder="Leave empty for current tenant"
                      />
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-6">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-[#586ab1] text-white rounded-lg hover:bg-[#4a5a9a] disabled:opacity-50 transition-colors"
                    >
                      {submitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
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