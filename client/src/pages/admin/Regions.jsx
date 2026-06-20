// src/pages/admin/Regions.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    MagnifyingGlassIcon,
    PencilIcon,
    TrashIcon,
    MapPinIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import Modal from "../../components/Modal";
import CustomSelect from "../../components/CustomSelect";
import SkeletonPage from "../../components/Skeleton";

export default function Regions() {
    const { profile } = useAuth();
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

                const cacheKey = `regions_${tenantId || 'all'}`;
                const cachedData = localStorage.getItem(cacheKey);

                if (cachedData && refreshKey === 0) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        const cacheAge = Date.now() - parsed.timestamp;
                        if (cacheAge < 5 * 60 * 1000) {
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
                fetchRegions(tenantId, userRole),
                userRole === 'superadmin' ? fetchTenants() : Promise.resolve()
            ]);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchRegions = async (tenantId, userRole) => {
        try {
            let query = supabase
                .from("regions")
                .select(`
          *,
          tenants!regions_tenant_id_fkey (
            name,
            company_name
          )
        `);

            if (userRole !== 'superadmin' && tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

            query = query.order("created_at", { ascending: false });

            const { data, error } = await query;

            if (error) throw error;
            if (data && mountedRef.current) {
                const mapped = data.map(region => ({
                    ...region,
                    tenant_name: region.tenants?.name || region.tenants?.company_name || 'N/A'
                }));
                setRegions(mapped);
                try {
                    const cacheKey = `regions_${tenantId || 'all'}`;
                    const existing = localStorage.getItem(cacheKey);
                    const cacheData = existing
                        ? { ...JSON.parse(existing), regions: mapped, timestamp: Date.now() }
                        : { regions: mapped, timestamp: Date.now() };
                    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                } catch (e) {
                    console.error('Error updating cache:', e);
                }
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
            if (data && mountedRef.current) setTenants(data);
        } catch (err) {
            console.error("Error fetching tenants:", err);
        }
    };

    const openModal = (item = null) => {
        setEditingItem(item);
        if (item) {
            setFormData(item);
        } else {
            const initialData = {
                ...(currentUserTenantId && !isSuperAdmin ? { tenant_id: currentUserTenantId } : {})
            };
            setFormData(initialData);
        }
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
            let tenantId = null;

            if (isSuperAdmin) {
                tenantId = formData.tenant_id;
            } else {
                tenantId = profile?.tenant_id || currentUserTenantId;
                if (!tenantId) {
                    throw new Error("Your account is not associated with a tenant. Please contact your administrator.");
                }
            }

            if (!tenantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
                throw new Error("Invalid tenant ID. Please select a valid tenant.");
            }

            const regionData = {
                name: formData.name?.trim(),
                code: formData.code?.trim(),
                tenant_id: tenantId,
            };

            if (!regionData.name || !regionData.code) {
                throw new Error("Region name and code are required");
            }

            const { error } = editingItem
                ? await supabase.from("regions").update(regionData).eq("id", editingItem.id)
                : await supabase.from("regions").insert(regionData).select();

            if (error) throw error;

            await fetchRegions(currentUserTenantId, profile?.role || 'user');
            closeModal();
            alert(`Region ${editingItem ? 'updated' : 'created'} successfully!`);
        } catch (error) {
            console.error("Error submitting:", error);
            alert("Error: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this region?')) return;
        try {
            const { error } = await supabase.from("regions").delete().eq("id", id);
            if (error) throw error;
            setRegions(prev => prev.filter(region => region.id !== id));
            alert('Region deleted successfully!');
        } catch (err) {
            alert('Error deleting region: ' + err.message);
        }
    };

    const filteredRegions = useMemo(() => {
        return regions.filter(r =>
            (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.code || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [regions, searchTerm]);

    if (loading) return <SkeletonPage />;

    const tenantOptions = tenants.map(t => ({ value: t.id, label: t.name || t.company_name }));

    return (
        <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-lg font-bold text-text-heading">Region Management</h1>
                    <p className="text-text-muted text-xs mt-0.5">{regions.length} region{regions.length !== 1 ? 's' : ''} total</p>
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
                        <MapPinIcon className="h-3.5 w-3.5" />
                        Add Region
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
                            placeholder="Search regions..."
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
                                <th className="px-5 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Region Name</th>
                                <th className="px-5 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Code</th>
                                {isSuperAdmin && (
                                    <th className="px-5 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Tenant</th>
                                )}
                                <th className="px-5 py-3 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border-light">
                            {filteredRegions.length === 0 ? (
                                <tr>
                                    <td colSpan={isSuperAdmin ? 4 : 3} className="px-5 py-14 text-center text-text-muted text-sm">
                                        No regions found
                                    </td>
                                </tr>
                            ) : (
                                filteredRegions.map((region) => (
                                    <tr key={region.id} className="hover:bg-surface/60 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                                                    <MapPinIcon className="h-4 w-4 text-brand-primary" />
                                                </div>
                                                <span className="text-xs font-semibold text-text-heading whitespace-nowrap">{region.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-xs text-text-muted font-mono">{region.code || '—'}</span>
                                        </td>
                                        {isSuperAdmin && (
                                            <td className="px-5 py-3.5">
                                                <span className="text-xs text-text-muted">{region.tenant_name}</span>
                                            </td>
                                        )}
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => openModal(region)}
                                                    className="p-1.5 rounded-lg text-brand-primary hover:bg-brand-primary/10 transition-colors"
                                                    title="Edit"
                                                >
                                                    <PencilIcon className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(region.id)}
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
                title={editingItem ? 'Edit Region' : 'Add Region'}
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
                        <label className="block text-xs font-semibold text-text-muted mb-1.5">Region Name *</label>
                        <input
                            type="text"
                            value={formData.name || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g. Nairobi"
                            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-xs text-text-body focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-text-muted mb-1.5">Code *</label>
                        <input
                            type="text"
                            value={formData.code || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                            placeholder="e.g. NRB"
                            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-xs text-text-body focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
                            required
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}
