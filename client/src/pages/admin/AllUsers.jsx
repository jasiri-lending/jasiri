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
  UsersIcon,
  CloudArrowUpIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { apiFetch } from "../../utils/api";
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
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkUsers, setBulkUsers] = useState([]);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);

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
          company_phone,
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
    const requiresBranchRegion = roleRequiresBranchRegion(formData.role);

    const response = await apiFetch("/create-user", {
      method: "POST",
      body: JSON.stringify({
        full_name: formData.full_name?.trim(),
        email: formData.email?.trim(),
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
      company_phone: formData.company_phone?.trim() || null,
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
        // Use the new permanent delete endpoint
        const response = await apiFetch(`/api/admin/users/${id}`, {
          method: "DELETE",
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to delete user");
        }

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

  const handleFileParse = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Basic validation and mapping
        const formatted = data.map(row => {
          const regionName = row.region || row.Region || '';
          const branchName = row.branch || row.Branch || '';
          
          let region_id = null;
          let branch_id = null;
          
          if (regionName) {
            const foundRegion = regions.find(r => r.name.toLowerCase() === regionName.toLowerCase());
            if (foundRegion) region_id = foundRegion.id;
          }
          
          if (branchName) {
            const foundBranch = branches.find(b => b.name.toLowerCase() === branchName.toLowerCase());
            if (foundBranch) branch_id = foundBranch.id;
          }

          // Flexible header mapping
          const mapped = {
            full_name: row.full_name || row.FullName || row.Name || row.name || '',
            email: row.email || row.Email || '',
            role: (row.role || row.Role || 'operation_officer').toLowerCase().replace(' ', '_'),
            phone: row.phone || row.Phone || row.mobile || '',
            company_phone: row.company_phone || row.CompanyPhone || '',
            region_id,
            branch_id,
            region_name: regionName,
            branch_name: branchName
          };
          return mapped;
        }).filter(u => u.email && u.full_name); // Only include rows with name and email

        setBulkUsers(formatted);
        setBulkResults(null);
      } catch (err) {
        console.error("Parse error:", err);
        alert("Failed to parse Excel file. Please ensure it's a valid format.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const submitBulkUsers = async () => {
    if (bulkUsers.length === 0) return;
    setBulkProcessing(true);
    setBulkResults(null);
    
    try {
      const response = await apiFetch("/bulk-create-users", {
        method: "POST",
        body: JSON.stringify({
          users: bulkUsers,
          logged_in_tenant_id: currentUserTenantId
        })
      });

      const data = await response.json();
      if (data.success) {
        setBulkResults(data.results);
        fetchPageData(currentPage);
      } else {
        alert("Bulk creation failed: " + data.error);
      }
    } catch (err) {
      console.error("Bulk submission error:", err);
      alert("An error occurred during bulk submission.");
    } finally {
      setBulkProcessing(false);
    }
  };

  const downloadTemplate = () => {
    try {
      const templateData = [
        {
          full_name: "John Doe",
          email: "john.doe@company.com",
          role: "operation_officer",
          phone: "254700000000",
          company_phone: "254711111111",
          region: "Nairobi",
          branch: "CBD Branch"
        }
      ];
      
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      
      // Native Blob approach for maximum reliability
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Jasiri_User_Template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download template. Please try again.");
    }
  };

  // Filter data for display
  const filteredData = useMemo(() => {
    return users.filter(user => {
      const matchesSearch =
        (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.company_phone || '').toLowerCase().includes(searchTerm.toLowerCase());

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
      <div className="min-h-screen bg-muted p-6 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-gray-50 rounded-lg shadow mb-6 p-6">
          <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
            <div>
              <h1 className="text-sm font-medium text-slate-600">User Management</h1>
            </div>


          </div>

          {/* Search and Filters */}
          <div className="mt-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="relative flex-1 max-w-xl w-full">
                <MagnifyingGlassIcon className="h-3 w-3 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-2 py-1.5 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="flex items-center gap-2 px-5 py-3 border border-gray-300 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <CloudArrowUpIcon className="h-3 w-3" />
                  <span className="text-xs whitespace-nowrap">Bulk Create</span>
                </button>

                <button
                  onClick={() => openModal('user')}
                  className="flex items-center gap-2 px-5 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors shadow-sm"
                >
                  <UserPlusIcon className="h-3 w-3" />
                  <span className="text-xs whitespace-nowrap">Add User</span>
                </button>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-3 border rounded-lg transition-colors ${showFilters || filterRole || filterRegion || filterBranch
                    ? 'bg-accent/10 border-accent text-accent'
                    : 'border-gray-300 hover:bg-gray-50 text-slate-700'
                    }`}
                >
                  <FunnelIcon className="h-3 w-3" />
                  <span className="text-xs text-slate-600 font-semibold">Filters</span>
                  {(filterRole || filterRegion || filterBranch) && (
                    <span className="bg-accent text-white text-xs px-2 py-1 rounded-full">
                      {[filterRole, filterRegion, filterBranch].filter(Boolean).length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="mt-6 p-5 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Role</label>
                    <div className="relative">
                      <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary appearance-none bg-white"
                      >
                        <option  className='text-xs' value="">All Roles</option>
                        {availableRoles.map(role => (
                          <option  className='text-xs' key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                      <ChevronUpDownIcon className="h-5 w-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Region</label>
                    <div className="relative">
                      <select
                        value={filterRegion}
                        onChange={(e) => {
                          setFilterRegion(e.target.value);
                          if (e.target.value !== filterRegion) {
                            setFilterBranch('');
                          }
                        }}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary appearance-none bg-white"
                      >
                        <option  className='text-xs' value="">All Regions</option>
                        {regions
                          .filter(region => isSuperAdmin || region.tenant_id === currentUserTenantId)
                          .map(region => (
                            <option  className='text-xs' key={region.id} value={region.id}>{region.name}</option>
                          ))
                        }
                      </select>
                      <ChevronUpDownIcon className="h-5 w-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Branch</label>
                    <div className="relative">
                      <select
                        value={filterBranch}
                        onChange={(e) => setFilterBranch(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary appearance-none bg-white"
                      >
                        <option   className='text-xs' value="">All Branches</option>
                        {branches
                          .filter(branch => {
                            if (!isSuperAdmin && branch.tenant_id !== currentUserTenantId) return false;
                            if (filterRegion && branch.region_id !== filterRegion) return false;
                            return true;
                          })
                          .map(branch => (
                            <option className='text-xs' key={branch.id} value={branch.id}>{branch.name}</option>
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
                    className="text-primary hover:text-blue-800  px-2 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
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
            <div key={stat.label} className="bg-gray-100/50 rounded-xl shadow p-6 border border-gray-100">
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
        <div className="bg-gray-50/50 rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600  whitespace-nowrap">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600  whitespace-nowrap">Contact</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600  whitespace-nowrap">Company Phone</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600  whitespace-nowrap">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600  whitespace-nowrap">Branch</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600  whitespace-nowrap">Region</th>
                  {isSuperAdmin && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600  whitespace-nowrap">Tenant</th>
                  )}
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600  whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-gray-50/50 divide-y divide-gray-200">
                {filteredData.map((user) => {
                  const roleColorClass = getRoleColorClass(user.role);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary font-semibold text-sm whitespace-nowrap">
                                {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm  text-gray-600">{user.full_name || 'No Name'}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className=" whitespace-nowrap text-sm text-gray-600">{user.phone || 'Not provided'}</div>
                        <div className="text-xs text-gray-500">
                          Joined {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className=" whitespace-nowrap text-sm text-gray-600">{user.company_phone || 'Not provided'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`  whitespace-nowrap px-3 py-1.5 inline-flex text-xs font-semibold rounded-full ${roleColorClass}`}>
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
                <h3 className="mt-4 text-lg font-medium text-gray-600">No users found</h3>
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
        <div className="fixed inset-0 bg-slate-900/20 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              {/* Unified Header & Body - Scrollable */}
              <div className="p-8 overflow-y-auto space-y-8 flex-1 min-h-0">
                {/* Header Info */}
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg  text-slate-600">
                      {editingItem ? 'Edit' : 'Add'} {modalType === 'user' ? 'User' : modalType === 'branch' ? 'Branch' : 'Region'}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {editingItem ? 'Update existing records ' : 'Create a new entry in the system'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <XCircleIcon className="h-7 w-7" />
                  </button>
                </div>

                {modalType === 'user' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name *</label>
                        <input
                          type="text"
                          value={formData.full_name || ''}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all outline-none text-slate-700"
                          required
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email *</label>
                        <input
                          type="email"
                          value={formData.email || ''}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all outline-none text-slate-700"
                          required
                          placeholder="john@example.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Role *</label>
                        <select
                          value={formData.role || ''}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary appearance-none outline-none text-slate-700"
                          required
                        >
                          <option value="">Select Role</option>
                          {availableRoles.map(role => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Personal Phone</label>
                        <input
                          type="tel"
                          value={formData.phone || ''}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none text-slate-700"
                          placeholder="Phone Number"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Company Phone</label>
                        <input
                          type="tel"
                          value={formData.company_phone || ''}
                          onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none text-slate-700"
                          placeholder="Company Phone"
                        />
                      </div>

                      {isSuperAdmin && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Tenant</label>
                          <select
                            value={formData.tenant_id || ''}
                            onChange={handleTenantChange}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary appearance-none outline-none text-slate-700"
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

                      {roleRequiresBranchRegion(formData.role) && (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Region</label>
                            <select
                              value={formData.region_id || ''}
                              onChange={handleRegionChange}
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary appearance-none outline-none text-slate-700"
                            >
                              <option value="">Select Region</option>
                              {filteredRegions.map(region => (
                                <option key={region.id} value={region.id}>{region.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Branch</label>
                            <select
                              value={formData.branch_id || ''}
                              onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary appearance-none outline-none text-slate-700 disabled:opacity-50"
                              disabled={!formData.region_id}
                            >
                              <option value="">Select Branch</option>
                              {filteredBranches.map(branch => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                    </div>

                    {isAddingUser && (
                      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <ArrowPathIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <p className="text-xs text-blue-700 font-medium leading-relaxed">
                          <span className="font-bold">Password Alert:</span> A secure password will be automatically generated and sent to the user's email address.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {modalType !== 'user' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Name *</label>
                        <input
                          type="text"
                          value={formData.name || ''}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none text-slate-700"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Code *</label>
                        <input
                          type="text"
                          value={formData.code || ''}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none text-slate-700"
                          required
                        />
                      </div>
                    </div>
                    {modalType === 'branch' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Region *</label>
                          <select
                            value={formData.region_id || ''}
                            onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none text-slate-700"
                            required
                          >
                            <option value="">Select Region</option>
                            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Address</label>
                          <input
                            type="text"
                            value={formData.address || ''}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary outline-none text-slate-700"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons - Small & Well Aligned */}
              <div className="px-8 py-5 flex flex-row justify-end items-center gap-4 flex-shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-all whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 text-sm font-bold bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-50 shadow-md shadow-brand-primary/20 transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  {submitting ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>{editingItem ? 'Update Changes' : 'Create Record'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/20 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-8 flex justify-between items-start pb-0">
              <div>
                <h2 className="text-lg  text-slate-600">Bulk User Creation</h2>
                <p className="text-sm text-slate-500 mt-1">Upload an Excel file to create multiple users at once.</p>
              </div>
              <button
                onClick={() => { setShowBulkModal(false); setBulkUsers([]); setBulkResults(null); }}
                className="text-slate-400 hover:text-rose-500 transition-colors"
              >
                <XCircleIcon className="h-7 w-7" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 min-h-0 space-y-6">
              {!bulkResults ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:border-brand-primary transition-colors flex flex-col items-center justify-center text-center space-y-4">
                      <div className="bg-brand-primary/10 p-3 rounded-full">
                        <CloudArrowUpIcon className="h-8 w-8 text-brand-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">Upload Excel File</p>
                        <p className="text-xs text-slate-500 mt-1">Drag and drop or click to browse</p>
                      </div>
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileParse}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        style={{ display: bulkUsers.length > 0 ? 'none' : 'block' }}
                      />
                      {bulkUsers.length > 0 && (
                        <button 
                          onClick={() => setBulkUsers([])}
                          className="text-xs text-rose-600 font-bold hover:underline"
                        >
                          Clear selection
                        </button>
                      )}
                    </div>

                    <div className="p-6 bg-slate-50 rounded-2xl space-y-4">
                      <h3 className="text-sm font-bold text-slate-800">Instructions</h3>
                      <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
                        <li>Ensure the file has headers: <b>full_name, email, role, phone</b></li>
                        <li>Optional columns: <b>region, branch</b> (use the exact names as they appear in the system)</li>
                        <li>Roles must be one of: admin, operation_officer, branch_manager, operations, hr</li>
                        <li>Emails must be unique and valid.</li>
                        <li>Duplicate emails will be skipped or updated.</li>
                      </ul>
                      <button
                        type="button"
                        onClick={downloadTemplate}
                        className="flex items-center gap-2 text-xs font-bold text-brand-primary hover:underline mt-4"
                      >
                        <ArrowPathIcon className="h-4 w-4" />
                        Download Template
                      </button>
                    </div>
                  </div>

                  {bulkUsers.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-800">Preview ({bulkUsers.length} users)</h3>
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Name</th>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Email</th>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Role</th>
                              <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Region/Branch</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-100">
                            {bulkUsers.slice(0, 10).map((user, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 text-xs text-slate-700">{user.full_name}</td>
                                <td className="px-4 py-2 text-xs text-slate-600">{user.email}</td>
                                <td className="px-4 py-2 text-xs text-slate-600">{user.role}</td>
                                <td className="px-4 py-2 text-xs text-slate-500">
                                  {user.region_name || '-'} {user.branch_name ? `/ ${user.branch_name}` : ''}
                                  {(user.region_name && !user.region_id) && <span className="text-rose-500 ml-1" title="Region not found">⚠️</span>}
                                  {(user.branch_name && !user.branch_id) && <span className="text-rose-500 ml-1" title="Branch not found">⚠️</span>}
                                </td>
                              </tr>
                            ))}
                            {bulkUsers.length > 10 && (
                              <tr>
                                <td colSpan="3" className="px-4 py-2 text-xs text-slate-400 text-center bg-slate-50">
                                  ... and {bulkUsers.length - 10} more users
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-6 text-center py-10">
                  <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center ${bulkResults.failed === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {bulkResults.failed === 0 ? <UserPlusIcon className="h-8 w-8" /> : <XMarkIcon className="h-8 w-8" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Processing Complete</h3>
                    <p className="text-slate-500 mt-2">
                      Successfully created <b>{bulkResults.success}</b> users.
                      {bulkResults.failed > 0 && <span> <b>{bulkResults.failed}</b> failed to process.</span>}
                    </p>
                  </div>

                  {bulkResults.failed > 0 && (
                    <div className="max-w-md mx-auto bg-rose-50 border border-rose-100 rounded-xl p-4 text-left">
                      <p className="text-xs font-bold text-rose-800 mb-2">Error Details:</p>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {bulkResults.details.filter(d => d.status === 'failed').map((d, i) => (
                          <div key={i} className="text-xs text-rose-700 flex justify-between">
                            <span>{d.email}</span>
                            <span className="italic">{d.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => { setShowBulkModal(false); setBulkUsers([]); setBulkResults(null); }}
                    className="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-colors"
                  >
                    Close & Refresh
                  </button>
                </div>
              )}
            </div>

            {!bulkResults && (
              <div className="px-8 py-5 flex justify-end items-center gap-4">
                <button
                  type="button"
                  onClick={() => { setShowBulkModal(false); setBulkUsers([]); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={submitBulkUsers}
                  disabled={bulkUsers.length === 0 || bulkProcessing}
                  className="px-8 py-2 text-sm font-bold bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-50 shadow-md transition-all flex items-center gap-2"
                >
                  {bulkProcessing ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      <span>Creating {bulkUsers.length} Users...</span>
                    </>
                  ) : (
                    <span>Create {bulkUsers.length} Users</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}