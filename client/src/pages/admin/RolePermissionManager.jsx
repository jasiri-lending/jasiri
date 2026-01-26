import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import {
    ShieldCheck,
    Save,
    AlertCircle,
    CheckCircle,
    Loader2,
    Plus,
    X
} from "lucide-react";
import Spinner from "../../components/Spinner";
import { useToast } from "../../components/Toast";

export default function RolePermissionManager() {
    const { success, error: toastError, info } = useToast();
    const { profile } = useAuth();
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [rolePermissions, setRolePermissions] = useState({});
    const [selectedRole, setSelectedRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // const [message, setMessage] = useState({ type: "", text: "" }); // Replaced by global toast

    // Add Role Modal State
    const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
    const [newRoleName, setNewRoleName] = useState("");
    const [addingRole, setAddingRole] = useState(false);

    const mountedRef = useRef(true);

    const ALLOWED_PERMISSIONS = {
        'loans': ['create_loan', 'disburse_loan', 'adjust_loan_limit'],
        'reports': ['view_report'],
        'customers': ['create_customer', 'edit_customer'],
    };

    const fetchRolesAndPermissions = useCallback(async () => {
        if (!profile) return;

        try {
            setLoading(true);

            // Caching
            const cacheKey = `roles_perms_${profile.tenant_id || 'all'}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.timestamp < 300000) { // 5 min cache
                    setRoles(parsed.roles);
                    setPermissions(parsed.permissions);
                    setLoading(false);
                    // fetching in background could be added but let's trust cache for now to stop reloading
                    return;
                }
            }

            let rolesQuery = supabase.from("roles").select("*").order("name");

            if (profile?.tenant_id) {
                rolesQuery = rolesQuery.eq('tenant_id', profile.tenant_id);
            }

            const { data: rolesData, error: rolesError } = await rolesQuery;
            const { data: permsData, error: permsError } = await supabase.from("permissions").select("*").order("resource");

            if (rolesError) throw rolesError;
            if (permsError) throw permsError;

            // Filter Roles
            const uniqueRoles = [];
            const seenRoles = new Set();
            (rolesData || []).forEach(r => {
                if (!seenRoles.has(r.name)) {
                    seenRoles.add(r.name);
                    uniqueRoles.push(r);
                }
            });

            // Filter Permissions
            const filteredPerms = (permsData || []).filter(p => {
                const res = p.resource.toLowerCase();
                if (res === 'loans') {
                    return ['create_loan', 'disburse_loan', 'adjust_loan_limit'].includes(p.name);
                }
                if (res === 'reports') {
                    return ['view_report'].includes(p.name);
                }
                if (res === 'customers') {
                    return ['create_customer', 'edit_customer'].includes(p.name);
                }
                if (res === 'settings') {
                    return ['penalty_settings'].includes(p.name);
                }
                return true; // Keep other resources like 'users', 'configurations' etc.
            });

            setRoles(uniqueRoles);
            setPermissions(filteredPerms);

            // Update Cache
            localStorage.setItem(cacheKey, JSON.stringify({
                roles: uniqueRoles,
                permissions: filteredPerms,
                timestamp: Date.now()
            }));

        } catch (err) {
            console.error("Error loading data:", err);
            toastError("Failed to load roles and permissions.");
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [profile]);

    useEffect(() => {
        mountedRef.current = true;
        fetchRolesAndPermissions();
        return () => { mountedRef.current = false; };
    }, [fetchRolesAndPermissions]);

    useEffect(() => {
        if (!selectedRole) {
            setRolePermissions({});
            return;
        }

        const fetchRolePerms = async () => {
            try {
                const { data, error } = await supabase
                    .from("role_permissions")
                    .select("permission_id")
                    .eq("role_id", selectedRole.id);

                if (error) throw error;

                const permIds = data?.map((p) => p.permission_id) || [];
                setRolePermissions(Object.fromEntries(permIds.map((id) => [id, true])));
            } catch (err) {
                console.error("Error fetching role perms:", err);
                toastError("Failed to load role permissions.");
            }
        };

        fetchRolePerms();
    }, [selectedRole]);

    const syncRoles = async () => {
        try {
            if (!profile?.tenant_id) {
                toastError('No tenant ID found for sync.');
                return;
            }
            setLoading(true);
            info("Syncing roles...");

            const { data: usersData, error: usersError } = await supabase
                .from("users")
                .select("role")
                .eq("tenant_id", profile.tenant_id)
                .neq("role", "");

            if (usersError) throw usersError;

            const userRoles = [...new Set(usersData.map(u => u.role).filter(r => r))];

            const { data: existingRolesData, error: rolesError } = await supabase
                .from("roles")
                .select("name")
                .eq("tenant_id", profile.tenant_id);

            if (rolesError) throw rolesError;

            const existingRoleNames = new Set(existingRolesData.map(r => r.name));
            const missingRoles = userRoles.filter(role => !existingRoleNames.has(role));

            if (missingRoles.length === 0) {
                success("Roles are up to date.");
                setLoading(false);
                return;
            }

            const { error: insertError } = await supabase
                .from("roles")
                .insert(missingRoles.map(name => ({
                    name,
                    tenant_id: profile.tenant_id,
                    is_system: false
                })));

            if (insertError) throw insertError;

            success(`Added ${missingRoles.length} new roles.`);

            const { data: newRoles, error: refreshError } = await supabase
                .from("roles")
                .select("*")
                .eq("tenant_id", profile.tenant_id)
                .order("name");

            if (refreshError) throw refreshError;
            setRoles(newRoles);

        } catch (err) {
            console.error("Error syncing roles:", err);
            toastError(`Failed to sync roles: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = (permId) => {
        if (!selectedRole) return;
        setRolePermissions((prev) => ({ ...prev, [permId]: !prev[permId] }));
    };

    const saveConfiguration = async () => {
        if (!selectedRole) return;
        setSaving(true);

        try {
            const { data: currentPerms, error: fetchError } = await supabase
                .from("role_permissions")
                .select("permission_id")
                .eq("role_id", selectedRole.id);

            if (fetchError) throw fetchError;

            const dbPermIds = new Set(currentPerms.map(p => p.permission_id));
            const currentLocalIds = new Set(Object.keys(rolePermissions).filter(k => rolePermissions[k]));

            const toAdd = [...currentLocalIds].filter(id => !dbPermIds.has(id));
            const toRemove = [...dbPermIds].filter(id => !currentLocalIds.has(id));

            if (toRemove.length > 0) {
                const { error: deleteError } = await supabase
                    .from("role_permissions")
                    .delete()
                    .eq("role_id", selectedRole.id)
                    .in("permission_id", toRemove);
                if (deleteError) throw deleteError;
            }

            if (toAdd.length > 0) {
                const { error: insertError } = await supabase
                    .from("role_permissions")
                    .insert(toAdd.map(permission_id => ({
                        role_id: selectedRole.id,
                        permission_id
                    })));
                if (insertError) throw insertError;
            }

            success("Configuration saved successfully!");

        } catch (err) {
            console.error("Error saving permissions:", err);
            toastError("Failed to save configuration.");
        } finally {
            setSaving(false);
        }
    };

    const handleAddRole = async (e) => {
        e.preventDefault();
        if (!newRoleName.trim()) return;

        const formattedRoleName = newRoleName.trim().toLowerCase().replace(/\s+/g, '_');

        try {
            setAddingRole(true);

            if (!profile?.tenant_id) {
                throw new Error("No tenant ID found. Cannot create role.");
            }

            const { error } = await supabase.from('roles').insert({
                name: formattedRoleName,
                tenant_id: profile.tenant_id,
                is_system: false
            });

            if (error) throw error;

            success(`Role '${formattedRoleName}' added successfully.`);
            setNewRoleName("");
            setIsAddRoleOpen(false);

            fetchRolesAndPermissions();

        } catch (err) {
            console.error("Error adding role:", err);
            toastError(`Failed to add role: ${err.message}`);
        } finally {
            setAddingRole(false);
        }
    };

    // Group permissions by resource
    const permissionsByResource = permissions.reduce((acc, perm) => {
        if (!acc[perm.resource]) {
            acc[perm.resource] = [];
        }
        acc[perm.resource].push(perm);
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-brand-surface">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-brand-surface p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <h2 className="text-sm  text-slate-600 flex items-center gap-2">
                            <ShieldCheck className="h-6 w-6 text-brand-primary" />
                            Role Permission Manager
                        </h2>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2">
                            {selectedRole && (
                                <button
                                    onClick={saveConfiguration}
                                    disabled={saving}
                                    className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save Config
                                </button>
                            )}
                            <button
                                onClick={syncRoles}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
                            >
                                <ShieldCheck className="h-4 w-4" />
                                Sync Roles
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Role Selector Sidebar */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-fit">
                        <div className="flex justify-between items-center mb-4 px-2">
                            <h3 className="font-semibold text-slate-700">Select Role</h3>
                            <button
                                onClick={() => setIsAddRoleOpen(true)}
                                className="p-1.5 text-brand-primary hover:bg-brand-surface rounded-lg transition-colors"
                                title="Add New Role"
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="space-y-1">
                            {roles.map((role) => (
                                <button
                                    key={role.id}
                                    onClick={() => setSelectedRole(role)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedRole?.id === role.id
                                        ? "bg-brand-primary/10 text-brand-primary"
                                        : "text-slate-600 hover:bg-slate-50"
                                        }`}
                                >
                                    {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Permissions Table area */}
                    <div className="md:col-span-3">
                        {!selectedRole ? (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-400">
                                <ShieldCheck className="h-12 w-12 mb-4 opacity-50" />
                                <p>Select a role from the left to view and edit permissions.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                        <h3 className="font-semibold text-slate-800">
                                            Permissions for <span className="text-brand-primary">{selectedRole.name}</span>
                                        </h3>
                                        <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded border">
                                            {Object.keys(rolePermissions).length} permissions active
                                        </span>
                                    </div>

                                    <div className="divide-y divide-slate-100">
                                        {Object.entries(permissionsByResource).map(([resource, perms]) => (
                                            <div key={resource} className="p-6">
                                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b pb-2 border-slate-50">
                                                    {resource}
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {perms.map((perm) => (
                                                        <label
                                                            key={perm.id}
                                                            className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${rolePermissions[perm.id]
                                                                ? "bg-brand-primary/5 border-brand-primary/30"
                                                                : "bg-white border-slate-200 hover:border-slate-300"
                                                                }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={!!rolePermissions[perm.id]}
                                                                onChange={() => togglePermission(perm.id)}
                                                                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                                            />
                                                            <div>
                                                                <p className={`text-sm font-medium ${rolePermissions[perm.id] ? "text-brand-primary" : "text-slate-700"
                                                                    }`}>
                                                                    {perm.description}
                                                                </p>
                                                                <p className="text-xs text-slate-400 font-mono mt-1">{perm.name}</p>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Add Role Modal */}
                {isAddRoleOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 transform transition-all scale-100">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-800">Add New Role</h3>
                                <button
                                    onClick={() => setIsAddRoleOpen(false)}
                                    className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleAddRole}>
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Role Name <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newRoleName}
                                            onChange={(e) => setNewRoleName(e.target.value)}
                                            placeholder="e.g. Operations Officer"
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Will be saved as <code className="bg-slate-100 px-1 rounded text-slate-700">{newRoleName.trim().toLowerCase().replace(/\s+/g, '_') || '...'}</code>
                                    </p>
                                </div>

                                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddRoleOpen(false)}
                                        className="px-4 py-2 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={addingRole || !newRoleName.trim()}
                                        className="px-4 py-2 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                                    >
                                        {addingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                        Create Role
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}