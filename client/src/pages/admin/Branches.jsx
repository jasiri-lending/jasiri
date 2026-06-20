// src/pages/admin/Branches.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    MagnifyingGlassIcon,
    PencilIcon,
    TrashIcon,
    BuildingOfficeIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import Modal from "../../components/Modal";
import CustomSelect from "../../components/CustomSelect";
import SkeletonPage from "../../components/Skeleton";

export default function Branches() {
    const { profile } = useAuth();
    const [branches, setBranches] = useState([]);
    const [regions, setRegions] = useState([]);
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingItem, setEditingItem] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [currentUserTenantId, setCurrentUserTenantId] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const mountedRef = useRef(true);
    const isSuperAdmin = profile?.role === 'superadmin';

    useEffect(() => {
        mountedRef.current = true;

        const fetchInitialData = async () => {
            if (profile) {
                const tenantId = profile.tenant_id;
                setCurrentUserTenantId(tenantId);

                const cacheKey = `branches_${tenantId || 'all'}`;
                const cachedData = localStorage.getItem(cacheKey);

                if (cachedData && refreshKey === 0) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        const cacheAge = Date.now() - parsed.timestamp;
                        if (cacheAge < 5 * 60 * 1000) {
                            setBranches(parsed.branches || []);
                            setRegions(parsed.regions || []);
                            if (parsed.tenants) setTenants(parsed.tenants);
                            setLoading(false);
                            return;
                        }
                    } catch (e) {
                        console.error('Error parsing cache:', e);
                    }
                }

                if (mountedRef.current) {
                    await fetchData(tenantId, profile.role);
                }
            }
        };

        fetchInitialData();

        return () => {
            mountedRef.current = false;
        };
    }, [profile, refreshKey]);

    const fetchData = useCallback(async (tenantId, userRole) => {
        if (!tenantId && userRole !== 'superadmin') return;

        setLoading(true);
        try {
            await Promise.all([
                fetchBranches(tenantId, userRole),
                fetchRegions(tenantId, userRole),
                userRole === 'superadmin' ? fetchTenants() : Promise.resolve()
            ]);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchBranches = async (tenantId, userRole) => {
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
        `);

            if (userRole !== 'superadmin' && tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

            query = query.order("created_at", { ascending: false });

            const { data, error } = await query;

            if (error) throw error;
            if (data && mountedRef.current) {
                const mapped = data.map(branch => ({
                    ...branch,
                    tenant_name: branch.tenants?.name || branch.tenants?.company_name || 'N/A',
                    region_name: branch.regions?.name || 'N/A'
                }));
                setBranches(mapped);
                updateCache(tenantId, { branches: mapped });
            }
        } catch (err) {
            console.error("Error fetching branches:", err);
        }
    };

    const fetchRegions = async (tenantId, userRole) => {
        try {
            let query = supabase
                .from("regions")
                .select("*");

            if (userRole !== 'superadmin' && tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

            query = query.order("name", { ascending: true });

            const { data, error } = await query;

            if (error) throw error;
            if (data && mountedRef.current) {
                setRegions(data);
                updateCache(tenantId, { regions: data });
            }
        } catch (err) {
            console.error("Error fetching regions:", err);
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
                updateCache(null, { tenants: data });
            }
        } catch (err) {
            console.error("Error fetching tenants:", err);
        }
    };

    const updateCache = (tenantId, newData) => {
        try {
            const cacheKey = `branches_${tenantId || 'all'}`;
            const existing = localStorage.getItem(cacheKey);
            let cacheData = { timestamp: Date.now() };

            if (existing) {
                try {
                    cacheData = { ...JSON.parse(existing), ...newData, timestamp: Date.now() };
                } catch (e) {
                    cacheData = { ...newData, timestamp: Date.now() };
                }
            } else {
                cacheData = { ...newData, timestamp: Date.now() };
            }

            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
            console.error('Error updating cache:', e);
        }
    };

    const openModal = async (item = null) => {
        setEditingItem(item);

        if (item) {
            setFormData(item);
        } else {
            const initialData = {
                ...(currentUserTenantId && !isSuperAdmin ? { tenant_id: currentUserTenantId } : {})
            };
            setFormData(initialData);
        }

        await fetchRegions(currentUserTenantId, profile?.role);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingItem(null);
        setFormData({});
    };

    const handleManualRefresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    const handleSubmit = async () => {
        setSubmitting(true);

        try {
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

            await fetchBranches(currentUserTenantId, profile.role);
            closeModal();
            alert(`Branch ${editingItem ? 'updated' : 'created'} successfully!`);
        } catch (error) {
            console.error("Error submitting:", error);
            alert("Error: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this branch?')) return;

        try {
            const { error } = await supabase.from("branches").delete().eq("id", id);
            if (error) throw error;
            setBranches(prev => prev.filter(branch => branch.id !== id));
            alert('Branch deleted successfully!');
        } catch (err) {
            alert('Error deleting branch: ' + err.message);
        }
    };

    const filteredBranches = useMemo(() => {
        return branches.filter(b =>
            (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.address || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [branches, searchTerm]);

    if (loading) return <SkeletonPage />;

    const regionOptions = regions.map(r => ({ value: r.id, label: r.name }));
    const tenantOptions = tenants.map(t => ({ value: t.id, label: t.name || t.company_name }));

    return (
        <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-heading text-lg font-bold text-text-heading">Branch Management</h1>
                    <p className="text-text-muted text-xs mt-0.5">{branches.length} branch{branches.length !== 1 ? 'es' : ''} total</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleManualRefresh}
                        className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg hover:bg-surface transition-colors text-xs text-text-muted"
                    >
                        <ArrowPathIcon className="h-3.5 w-3.5" />
                        Refresh
                    </button>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors text-xs font-semibold shadow-sm"
                    >
                        <BuildingOfficeIcon className="h-3.5 w-3.5" />
                        Add Branch
                    </button>
                </div>
            </div>

            {/* Card */}
            <div className="bg-card rounded-xl border border-border shadow-card">
                {/* Search bar */}
                <div className="p-5 border-b border-border-light">
                    <div className="relative max-w-md">
                        <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            type="text"
                            placeholder="Search branches..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-border rounded-lg bg-surface text-xs text-text-body placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border-light">
                        <thead className="bg-surface">
                            <tr>
                                <th className="px-5 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Branch Name</th>
                                <th className="px-5 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Code</th>
                                <th className="px-5 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Region</th>
                                {isSuperAdmin && (
                                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Tenant</th>
                                )}
                                <th className="px-5 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Address</th>
                                <th className="px-5 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border-light">
                            {filteredBranches.length === 0 ? (
                                <tr>
                                    <td colSpan={isSuperAdmin ? 6 : 5} className="px-5 py-14 text-center text-text-muted text-sm">
                                        No branches found
                                    </td>
                                </tr>
                            ) : (
                                filteredBranches.map((branch) => (
                                    <tr key={branch.id} className="hover:bg-surface/60 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                                                    <BuildingOfficeIcon className="h-4 w-4 text-brand-primary" />
                                                </div>
                                                <span className="text-xs font-semibold text-text-heading whitespace-nowrap">{branch.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-xs text-text-muted font-mono">{branch.code || '—'}</span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-xs text-text-body">{branch.region_name}</span>
                                        </td>
                                        {isSuperAdmin && (
                                            <td className="px-5 py-3.5">
                                                <span className="text-xs text-text-muted">{branch.tenant_name}</span>
                                            </td>
                                        )}
                                        <td className="px-5 py-3.5">
                                            <span className="text-xs text-text-muted">{branch.address || '—'}</span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => openModal(branch)}
                                                    className="p-1.5 rounded-lg text-brand-primary hover:bg-brand-primary/10 transition-colors"
                                                    title="Edit"
                                                >
                                                    <PencilIcon className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(branch.id)}
                                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                                                    title="Delete"
                                                >
                                                    <TrashIcon className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <Modal
                open={showModal}
                title={editingItem ? 'Edit Branch' : 'Add Branch'}
                onClose={closeModal}
                onSave={handleSubmit}
                saving={submitting}
                saveLabel={editingItem ? 'Update' : 'Create'}
            >
                <div className="space-y-4">
                    {isSuperAdmin && (
                        <div>
                            <label className="block text-xs font-semibold text-text-muted mb-1.5">Tenant *</label>
                            <CustomSelect
                                value={formData.tenant_id || ''}
                                onChange={(val) => setFormData(prev => ({ ...prev, tenant_id: val }))}
                                options={tenantOptions}
                                placeholder="Select Tenant"
                                fullWidth
                                searchable
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1.5">Branch Name *</label>
                        <input
                            type="text"
                            value={formData.name || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g. Nairobi CBD"
                            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-xs text-text-body focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1.5">Branch Code</label>
                        <input
                            type="text"
                            value={formData.code || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                            placeholder="e.g. NRB-CBD"
                            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-xs text-text-body focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1.5">Region *</label>
                        <CustomSelect
                            value={formData.region_id || ''}
                            onChange={(val) => setFormData(prev => ({ ...prev, region_id: val }))}
                            options={regionOptions}
                            placeholder="Select Region"
                            fullWidth
                            searchable
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1.5">Address</label>
                        <textarea
                            value={formData.address || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="Physical address..."
                            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-xs text-text-body focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors resize-none"
                            rows={3}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
