import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  FunnelIcon,
  UserPlusIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudArrowUpIcon,
  XCircleIcon,
  LockClosedIcon,
  LockOpenIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import { apiFetch } from "../../utils/api";
import Spinner from "../../components/Spinner";

export default function AllUsers() {
  const navigate = useNavigate();
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

  const defaultRoles = [
    { value: "superadmin", label: "Super Admin", color: "bg-purple-100 text-purple-800" },
    { value: "admin", label: "Admin", color: "bg-emerald-100 text-emerald-800" },
    { value: "branch_manager", label: "Branch Manager", color: "bg-cyan-100 text-cyan-800" },
    { value: "operations", label: "Operations", color: "bg-blue-100 text-blue-800" },
    { value: "hr", label: "HR", color: "bg-pink-100 text-pink-800" },
    { value: "operation_officer", label: "Operation Officer", color: "bg-amber-100 text-amber-800" },
  ];

  const isSuperAdmin = profile?.role === 'superadmin';

  const filterRegionsByTenant = useCallback((tenantId) => {
    if (!tenantId) {
      setFilteredRegions(regions);
      return;
    }
    const filtered = regions.filter(region => region.tenant_id === tenantId);
    setFilteredRegions(filtered);
  }, [regions]);

  const filterBranchesByRegionAndTenant = useCallback((regionId, tenantId) => {
    let filtered = branches;
    if (tenantId) filtered = filtered.filter(branch => branch.tenant_id === tenantId);
    if (regionId) filtered = filtered.filter(branch => branch.region_id === regionId);
    setFilteredBranches(filtered);
  }, [branches]);

  const handleRegionChange = (e) => {
    const regionId = e.target.value;
    setFormData(prev => ({ ...prev, region_id: regionId, branch_id: '' }));
    const tenantId = isSuperAdmin ? formData.tenant_id : currentUserTenantId;
    filterBranchesByRegionAndTenant(regionId, tenantId);
  };

  const handleTenantChange = (e) => {
    const tenantId = e.target.value;
    setFormData(prev => ({ ...prev, tenant_id: tenantId, region_id: '', branch_id: '' }));
    filterRegionsByTenant(tenantId);
    filterBranchesByRegionAndTenant(null, tenantId);
  };

  const fetchData = useCallback(async (tenantId, userRole) => {
    if (!tenantId && userRole !== 'superadmin') return;
    setLoading(true);
    try {
      const [usersData, branchesData, regionsData, tenantsData] = await Promise.all([
        fetchUsers(tenantId, userRole),
        fetchBranches(tenantId, userRole),
        fetchRegions(tenantId, userRole),
        userRole === 'superadmin' ? fetchTenants() : Promise.resolve([])
      ]);
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
        let rolesQuery = supabase.from("roles").select("name").order("name");
        if (tenantId) rolesQuery = rolesQuery.eq("tenant_id", tenantId);
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
            setAvailableRoles(defaultRoles);
          }
        } catch (e) {
          setAvailableRoles(defaultRoles);
        }
        await fetchData(tenantId, profile.role);
      }
    };
    fetchInitialData();
    return () => { mountedRef.current = false; };
  }, [profile, refreshKey, fetchData]);

  const fetchUsers = async (tenantId, userRole, page = 1) => {
    try {
      let query = supabase.from("users").select(`*, tenants!users_tenant_id_fkey (name, company_name), profiles (branch_id, region_id, branches (id, name), regions (id, name))`, { count: 'exact' });
      if (userRole !== 'superadmin' && tenantId) query = query.eq('tenant_id', tenantId);
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.order("created_at", { ascending: false }).range(from, to);
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
      return [];
    }
  };

  const fetchBranches = async (tenantId, userRole, page = 1) => {
    try {
      let query = supabase.from("branches").select(`*, tenants!branches_tenant_id_fkey (name, company_name), regions!branches_region_id_fkey (name)`, { count: 'exact' });
      if (userRole !== 'superadmin' && tenantId) query = query.eq('tenant_id', tenantId);
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.order("created_at", { ascending: false }).range(from, to);
      const { data, error } = await query;
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
      return [];
    }
  };

  const fetchRegions = async (tenantId, userRole, page = 1) => {
    try {
      let query = supabase.from("regions").select(`*, tenants!regions_tenant_id_fkey (name, company_name)`, { count: 'exact' });
      if (userRole !== 'superadmin' && tenantId) query = query.eq('tenant_id', tenantId);
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.order("created_at", { ascending: false }).range(from, to);
      const { data, error } = await query;
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
      return [];
    }
  };

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase.from("tenants").select("id, name, company_name").order("name", { ascending: true });
      if (error) throw error;
      if (data && mountedRef.current) {
        setTenants(data);
        return data;
      }
      return [];
    } catch (err) {
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
      const initialFormData = { password: '', ...(currentUserTenantId && !isSuperAdmin ? { tenant_id: currentUserTenantId } : {}) };
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
      if (item.region_id) filterBranchesByRegionAndTenant(item.region_id, tenantId);
      else filterBranchesByRegionAndTenant(null, tenantId);
    } else {
      const initialData = { ...(currentUserTenantId && !isSuperAdmin ? { tenant_id: currentUserTenantId } : {}) };
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
    fetchUsers(profile.tenant_id, profile.role, page);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (modalType === "user") {
        if (isAddingUser) await handleCreateUser();
        else await handleUpdateUser();
      } else if (modalType === "branch") await handleBranchSubmit();
      else if (modalType === "region") await handleRegionSubmit();
      fetchPageData(currentPage);
      closeModal();
      alert(`${modalType.charAt(0).toUpperCase() + modalType.slice(1)} ${editingItem ? 'updated' : 'created'} successfully!`);
    } catch (error) {
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
    if (!data.success) throw new Error(data.error || "Failed to create user");
  };

  const handleUpdateUser = async () => {
    const requiresBranchRegion = roleRequiresBranchRegion(formData.role);
    const userData = { full_name: formData.full_name?.trim(), email: formData.email?.trim(), role: formData.role, phone: formData.phone?.trim() || null, company_phone: formData.company_phone?.trim() || null };
    if (isSuperAdmin && formData.tenant_id) userData.tenant_id = formData.tenant_id;
    const { error: userError } = await supabase.from("users").update(userData).eq("id", editingItem.id);
    if (userError) throw userError;
    const profileData = { branch_id: requiresBranchRegion ? (formData.branch_id || null) : null, region_id: requiresBranchRegion ? (formData.region_id || null) : null };
    if (isSuperAdmin && formData.tenant_id) profileData.tenant_id = formData.tenant_id;
    const { error: profileError } = await supabase.from("profiles").update(profileData).eq("id", editingItem.id);
    if (profileError) throw profileError;
  };

  const handleBranchSubmit = async () => {
    const branchData = { name: formData.name?.trim(), region_id: formData.region_id || null, code: formData.code?.trim(), address: formData.address?.trim() || null };
    if (!isSuperAdmin && currentUserTenantId) branchData.tenant_id = currentUserTenantId;
    else if (isSuperAdmin && formData.tenant_id) branchData.tenant_id = formData.tenant_id;
    if (!branchData.name || !branchData.region_id) throw new Error("Branch name and region are required");
    const query = editingItem ? supabase.from("branches").update(branchData).eq("id", editingItem.id) : supabase.from("branches").insert(branchData);
    const { error } = await query;
    if (error) throw error;
  };

  const handleRegionSubmit = async () => {
    const regionData = { name: formData.name?.trim(), code: formData.code?.trim() };
    if (!isSuperAdmin && currentUserTenantId) regionData.tenant_id = currentUserTenantId;
    else if (isSuperAdmin && formData.tenant_id) regionData.tenant_id = formData.tenant_id;
    if (!regionData.name || !regionData.code) throw new Error("Region name and code are required");
    const query = editingItem ? supabase.from("regions").update(regionData).eq("id", editingItem.id) : supabase.from("regions").insert(regionData);
    const { error } = await query;
    if (error) throw error;
  };

  const handleDelete = async (type, id) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      if (type === "user") {
        const response = await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Failed to delete user");
        setUsers(prev => prev.filter(user => user.id !== id));
      } else {
        const table = type === "branch" ? "branches" : "regions";
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) throw error;
        if (table === "branches") setBranches(prev => prev.filter(branch => branch.id !== id));
        else setRegions(prev => prev.filter(region => region.id !== id));
      }
      alert(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`);
      fetchPageData(currentPage);
    } catch (err) {
      alert(`Error deleting ${type}: ` + err.message);
    }
  };

  const handleUnlock = async (user) => {
    if (!confirm(`Are you sure you want to unlock the account for ${user.full_name}?`)) return;
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/user-admin/unlock/${user.id}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Failed to unlock account");
      alert("Account unlocked successfully");
      fetchPageData(currentPage);
    } catch (error) {
      alert(error.message);
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
          return {
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
        }).filter(u => u.email && u.full_name);
        setBulkUsers(formatted);
        setBulkResults(null);
      } catch (err) {
        alert("Failed to parse Excel file. Please ensure it's a valid format.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const submitBulkUsers = async () => {
    if (bulkUsers.length === 0) return;
    setBulkProcessing(true);
    try {
      const response = await apiFetch("/bulk-create-users", {
        method: "POST",
        body: JSON.stringify({ users: bulkUsers, logged_in_tenant_id: currentUserTenantId })
      });
      const data = await response.json();
      if (data.success) {
        setBulkResults(data.results);
        fetchPageData(currentPage);
      } else {
        alert("Bulk creation failed: " + data.error);
      }
    } catch (err) {
      alert("An error occurred during bulk submission.");
    } finally {
      setBulkProcessing(false);
    }
  };

  const downloadTemplate = () => {
    try {
      const templateData = [{ full_name: "John Doe", email: "john.doe@company.com", role: "operation_officer", phone: "254700000000", company_phone: "254711111111", region: "Nairobi", branch: "CBD Branch" }];
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
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
      alert("Failed to download template. Please try again.");
    }
  };

  const filteredData = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || (user.phone || '').toLowerCase().includes(searchTerm.toLowerCase());
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

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);

  const getRoleLabel = (roleValue) => {
    const role = availableRoles.find(r => r.value === roleValue) || defaultRoles.find(r => r.value === roleValue);
    return role?.label || (roleValue || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // ── Export helpers ────────────────────────────────────────
  const [showExportMenu, setShowExportMenu] = useState(false);

  const getTenant = () => {
    try { return JSON.parse(localStorage.getItem('tenant')) || {}; } catch { return {}; }
  };

  // Converts company name to a URL-safe slug, e.g. "Fanikisha Ltd" → "fanikisha"
  const getTenantSlug = () => {
    const tenant = getTenant();
    const name = tenant.company_name || tenant.name || 'company';
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')  // replace non-alphanumeric runs with -
      .replace(/^-+|-+$/g, '');     // trim leading/trailing dashes
  };

  const buildExportRows = () =>
    filteredData.map(u => ({
      'Full Name':   u.full_name || '',
      'Email':       u.email || '',
      'Phone':       u.phone || '',
      'Role':        getRoleLabel(u.role),
      'Branch':      u.branches?.name || (roleRequiresBranchRegion(u.role) ? 'N/A' : 'All'),
      'Region':      u.regions?.name  || (roleRequiresBranchRegion(u.role) ? 'N/A' : 'All'),
      'Status':      u.status || 'ACTIVE',
      'Joined':      u.created_at ? new Date(u.created_at).toLocaleDateString() : '',
    }));

  const exportCSV = () => {
    const rows = buildExportRows();
    if (!rows.length) return alert('No data to export');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, `${getTenantSlug()}-users.csv`);
    setShowExportMenu(false);
  };

  const exportExcel = () => {
    const tenant = getTenant();
    const rows = buildExportRows();
    if (!rows.length) return alert('No data to export');
    const ws = XLSX.utils.json_to_sheet(rows);
    // Company header
    XLSX.utils.sheet_add_aoa(ws, [[tenant.company_name || 'User Report'], [`Generated: ${new Date().toLocaleString()}`]], { origin: 'A1' });
    XLSX.utils.sheet_add_json(ws, rows, { origin: 'A4', skipHeader: false });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, `${getTenantSlug()}-users.xlsx`);
    setShowExportMenu(false);
  };

  const exportPDF = () => {
    const tenant = getTenant();
    const rows = buildExportRows();
    if (!rows.length) return alert('No data to export');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(13);
    doc.text(`${tenant.company_name || 'Company'} — User Management Report`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}  |  Total: ${rows.length} users`, 14, 22);
    autoTable(doc, {
      startY: 27,
      head: [Object.keys(rows[0])],
      body: rows.map(r => Object.values(r)),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], fontSize: 7, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    doc.save(`${getTenantSlug()}-users.pdf`);
    setShowExportMenu(false);
  };

  const exportWord = async () => {
    const tenant = getTenant();
    const rows = buildExportRows();
    if (!rows.length) return alert('No data to export');
    const headers = Object.keys(rows[0]);
    const docx = new Document({
      sections: [{
        children: [
          new Paragraph({
            children: [new TextRun({ text: tenant.company_name || 'User Report', bold: true, size: 28 })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}  |  Total: ${rows.length} users`, size: 18, color: '666666' })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: headers.map(h => new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16 })] })],
                })),
              }),
              ...rows.map(row => new TableRow({
                children: headers.map(h => new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: String(row[h] ?? ''), size: 16 })] })],
                })),
              })),
            ],
          }),
        ],
      }],
    });
    const blob = await Packer.toBlob(docx);
    saveAs(blob, `${getTenantSlug()}-users.docx`);
    setShowExportMenu(false);
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
        <div className="bg-gray-50 rounded-lg shadow mb-6 p-6">
          <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
            <div><h1 className="text-sm font-medium text-slate-600">User Management</h1></div>
          </div>
          <div className="mt-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="relative flex-1 max-w-xl w-full">
                <MagnifyingGlassIcon className="h-3 w-3 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search users..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 pr-2 py-1.5 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-brand-primary focus:border-transparent" />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowBulkModal(true)} className="flex items-center gap-2 px-5 py-3 border border-gray-300 text-slate-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"><CloudArrowUpIcon className="h-3 w-3" /><span className="text-xs whitespace-nowrap">Bulk Create</span></button>
                <button onClick={() => openModal('user')} className="flex items-center gap-2 px-5 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors shadow-sm"><UserPlusIcon className="h-3 w-3" /><span className="text-xs whitespace-nowrap">Add User</span></button>
                <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-4 py-3 border rounded-lg transition-colors ${showFilters || filterRole || filterRegion || filterBranch ? 'bg-accent/10 border-accent text-accent' : 'border-gray-300 hover:bg-gray-50 text-slate-700'}`}><FunnelIcon className="h-3 w-3" /><span className="text-xs text-slate-600 font-semibold">Filters</span></button>
                {/* Export dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(v => !v)}
                    className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-slate-700 transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-3 w-3" />
                    <span className="text-xs font-semibold whitespace-nowrap">Export</span>
                    <ChevronDownIcon className="h-3 w-3" />
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-100 rounded-xl shadow-lg z-30 py-1">
                      {[['CSV', exportCSV], ['Excel (.xlsx)', exportExcel], ['PDF', exportPDF], ['Word (.docx)', exportWord]].map(([label, fn]) => (
                        <button key={label} onClick={fn} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">{label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {showFilters && (
              <div className="mt-6 p-5 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Role</label>
                    <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg bg-white">
                      <option value="">All Roles</option>
                      {availableRoles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Region</label>
                    <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg bg-white">
                      <option value="">All Regions</option>
                      {regions.filter(region => isSuperAdmin || region.tenant_id === currentUserTenantId).map(region => <option key={region.id} value={region.id}>{region.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Branch</label>
                    <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg bg-white">
                      <option value="">All Branches</option>
                      {branches.filter(branch => (!isSuperAdmin && branch.tenant_id !== currentUserTenantId ? false : filterRegion && branch.region_id !== filterRegion ? false : true)).map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-5 flex justify-end"><button onClick={clearFilters} className="text-primary hover:text-blue-800 px-2 py-1.5 text-sm font-medium">Clear all filters</button></div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50/50 rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Region</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredData.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-semibold text-xs">{user.full_name?.charAt(0)?.toUpperCase() || 'U'}</span>
                        </div>
                        <span className="text-xs font-medium text-gray-700 whitespace-nowrap">{user.full_name || '—'}</span>
                      </div>
                    </td>
                    {/* Email */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{user.email || '—'}</span>
                    </td>
                    {/* Phone */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 whitespace-nowrap">{user.phone || '—'}</span>
                    </td>
                    {/* Role */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 inline-flex text-[10px] font-semibold rounded-full whitespace-nowrap ${getRoleColorClass(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    {/* Branch */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {roleRequiresBranchRegion(user.role) ? (user.branches?.name || '—') : <span className="text-gray-300">All</span>}
                      </span>
                    </td>
                    {/* Region */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {roleRequiresBranchRegion(user.role) ? (user.regions?.name || '—') : <span className="text-gray-300">All</span>}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold uppercase tracking-wide rounded-md whitespace-nowrap ${
                        user.status === 'LOCKED'   ? 'bg-red-50 text-red-600 border border-red-100' :
                        user.status === 'DISABLED' ? 'bg-gray-100 text-gray-500 border border-gray-200' :
                        'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}>{user.status || 'ACTIVE'}</span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openModal('user', user)} className="text-primary hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors" title="Edit">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete('user', user.id)} className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors" title="Delete">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                        {user.status === 'LOCKED' ? (
                          <button onClick={() => handleUnlock(user)} className="text-emerald-600 hover:text-emerald-800 p-1 rounded hover:bg-emerald-50 transition-colors" title="Unlock account">
                            <LockOpenIcon className="h-4 w-4" />
                          </button>
                        ) : (
                          <button onClick={() => navigate(`/admin/users/${user.id}/lock`)} className="text-amber-500 hover:text-amber-700 p-1 rounded hover:bg-amber-50 transition-colors" title="Lock & Transfer">
                            <LockClosedIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredData.length === 0 && (
              <div className="text-center py-16 text-gray-400 text-sm">No users found</div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/20 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-600">{editingItem ? 'Edit' : 'Add'} {modalType}</h2>
              <button onClick={closeModal}><XCircleIcon className="h-7 w-7 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {modalType === 'user' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" value={formData.full_name || ''} onChange={(e) => setFormData({...formData, full_name: e.target.value})} placeholder="Full Name" className="w-full p-2 border rounded-lg" required />
                  <input type="email" value={formData.email || ''} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="Email" className="w-full p-2 border rounded-lg" required />
                  <select value={formData.role || ''} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full p-2 border rounded-lg" required>
                    <option value="">Select Role</option>
                    {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <input type="tel" value={formData.phone || ''} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="Phone" className="w-full p-2 border rounded-lg" />
                  {roleRequiresBranchRegion(formData.role) && (
                    <>
                      <select value={formData.region_id || ''} onChange={handleRegionChange} className="w-full p-2 border rounded-lg">
                        <option value="">Select Region</option>
                        {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <select value={formData.branch_id || ''} onChange={(e) => setFormData({...formData, branch_id: e.target.value})} className="w-full p-2 border rounded-lg" disabled={!formData.region_id}>
                        <option value="">Select Branch</option>
                        {filteredBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-600">Cancel</button>
                <button type="submit" disabled={submitting} className="px-6 py-2 bg-brand-primary text-white rounded-lg disabled:opacity-50">{submitting ? 'Processing...' : 'Submit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/20 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 text-center">
            <h2 className="text-lg font-bold mb-4">Bulk Create Users</h2>
            {!bulkResults ? (
              <div className="space-y-4">
                <input type="file" accept=".xlsx" onChange={handleFileParse} className="block w-full border p-4 rounded-xl" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowBulkModal(false)} className="px-4 py-2">Cancel</button>
                  <button onClick={submitBulkUsers} disabled={bulkUsers.length === 0 || bulkProcessing} className="px-6 py-2 bg-brand-primary text-white rounded-lg">{bulkProcessing ? 'Processing...' : `Create ${bulkUsers.length} Users`}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p>Created {bulkResults.success} users successfully.</p>
                <button onClick={() => { setShowBulkModal(false); setBulkResults(null); }} className="px-6 py-2 bg-slate-800 text-white rounded-lg">Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}