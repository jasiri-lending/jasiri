// src/pages/admin/Branches.jsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    MagnifyingGlassIcon,
    PencilIcon,
    TrashIcon,
    BuildingOfficeIcon,
    ArrowPathIcon,
    ChevronUpDownIcon,
} from '@heroicons/react/24/outline';
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import Spinner from "../../components/Spinner";

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

                // Try to load from localStorage first
                const cacheKey = `branches_${tenantId || 'all'}`;
                const cachedData = localStorage.getItem(cacheKey);

                if (cachedData && refreshKey === 0) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        const cacheAge = Date.now() - parsed.timestamp;
                        // Use cache if less than 5 minutes old
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

                // Update localStorage cache
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

    // Helper function to update localStorage cache
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

    const handleSubmit = async (e) => {
        e.preventDefault();
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
                <div className="mb-8">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-sm text-slate-600">Branch Management</h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleManualRefresh}
                                className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-white transition-colors"
                            >
                                <ArrowPathIcon className="h-5 w-5 mr-2" />
                                <h3 className='text-sm text-slate-600'>Refresh</h3>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow mb-6">
                    <div className="p-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <div className="relative flex-1 max-w-md">
                            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search branches..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                            />
                        </div>
                        <button
                            onClick={() => openModal()}
                            className="flex items-center px-4 py-2 bg-brand-btn text-white rounded-lg hover:bg-brand-primary transition-colors"
                        >
                            <BuildingOfficeIcon className="h-5 w-5 mr-2" />
                            Add Branch
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Branch Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Code
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Region
                                    </th>
                                    {isSuperAdmin && (
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Tenant
                                        </th>
                                    )}
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Address
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredBranches.map((branch) => (
                                    <tr key={branch.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {branch.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {branch.code || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {branch.region_name}
                                        </td>
                                        {isSuperAdmin && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {branch.tenant_name}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {branch.address || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => openModal(branch)}
                                                    className="text-brand-primary hover:text-brand-primary/80"
                                                >
                                                    <PencilIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(branch.id)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-xl font-semibold mb-4">
                            {editingItem ? 'Edit Branch' : 'Add Branch'}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            {isSuperAdmin && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Tenant *
                                    </label>
                                    <select
                                        value={formData.tenant_id || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, tenant_id: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                                        required
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

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Branch Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                                    required
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Code
                                </label>
                                <input
                                    type="text"
                                    value={formData.code || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Region *
                                </label>
                                <select
                                    value={formData.region_id || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, region_id: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                                    required
                                >
                                    <option value="">Select Region</option>
                                    {regions.map(region => (
                                        <option key={region.id} value={region.id}>
                                            {region.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Address
                                </label>
                                <textarea
                                    value={formData.address || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                                    rows="3"
                                />
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-brand-btn text-white rounded-lg hover:bg-brand-primary disabled:opacity-50"
                                    disabled={submitting}
                                >
                                    {submitting ? 'Saving...' : (editingItem ? 'Update' : 'Create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
