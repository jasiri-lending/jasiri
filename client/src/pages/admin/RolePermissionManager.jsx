import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import {
    ShieldCheck,
    Save,
    AlertCircle,
    CheckCircle,
    Loader2,
    Plus
} from "lucide-react";
import { useToast } from "../../components/Toast";
import Modal from "../../components/Modal";
import SkeletonPage from "../../components/Skeleton";

export default function RolePermissionManager() {
    const { success, error: toastError, info } = useToast();
    const { profile } = useAuth();
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [rolePermissions, setRolePermissions] = useState({});
    const [selectedRole, setSelectedRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Add Role Modal State
    const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
    const [newRoleName, setNewRoleName] = useState("");
    const [addingRole, setAddingRole] = useState(false);
    const [selectedResource, setSelectedResource] = useState(null);

    const RESOURCE_TITLES = {
        'loan': 'Loan Operations',
        'user': 'User Management',
        'settings': 'System Settings',
        'report': 'Reports Access',
        'customers': 'Customer Management',
        'amendments': 'Customer Amendments',
        'penalty': 'Penalty Management',
        'transfers': 'Customer Transfers',
        'refunds': 'Refund Operations',
        'journal': 'Journal Operations',
        'reconciliation': 'Transaction Reconciliation',
        'loan_workflow': 'Workflow Configuration'
    };

    const mountedRef = useRef(true);

    const ALLOWED_PERMISSIONS = {
        'loan': [
            'loan.create',
            'loan.view',
            'loan.edit',
            'loan.delete',
            'loan.submit',
            'loan.review',
            'loan.approve',
            'loan.reject',
            'loan.send_back',
            'loan.disburse',
            'loan.cancel_disbursement',
            'loan_limit_adjustment',
            'loan.adjust_limit',
            'loan.override',
            'loan.reschedule',
            'loan.audit',
            'loan.escalate'
        ],
        'user': [
            'user.create',
            'user.view',
            'user.edit',
            'user.delete'
        ],
        'settings': [
            'settings.view',
            'settings.edit'
        ],
        'penalty': [
            'penalty_settings_manage'
        ],
        'report': [
            'report.view',
            'report.customer_account_statement',
            'report.loan_disbursement',
            'report.loan_due',
            'report.customer_listing',
            'report.mpesa_repayment',
            'report.loan_officer_performance',
            'report.non_performing_loans',
            'report.outstanding_balance',
            'report.pending_disbursement',
            'report.loan_listing',
            'report.installments',
            'report.outstanding_eom',
            'report.trace_mpesa',
            'report.inactive_customers',
            'report.loan_arrears',
            'report.suspense_payments'
        ],
        'customers': [
            'customers.view',
            'customers.create',
            'customers.edit',
            'customers.delete'
        ],
        'amendments': [
            'amendments.initiate',
            'amendments.confirm',
            'amendments.authorize'
        ],
        'transfers': [
            'transfers.initiate',
            'transfers.confirm',
            'transfers.authorize'
        ],
        'refunds': [
            'refund.initiate',
            'refund.approve'
        ],
        'journal': [
            'journal.create',
            'journal.approve'
        ],
        'reconciliation': [
            'transaction.reconcile',
            'transaction.approve'
        ],
        'loan_workflow': [
            'loan_workflow.configure'
        ]
    };

    const fetchRolesAndPermissions = useCallback(async (skipCache = false) => {
        if (!profile) return;

        try {
            setLoading(true);

            // Caching
            const cacheKey = `roles_perms_${profile.tenant_id || 'all'}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached && !skipCache) {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.timestamp < 300000) { // 5 min cache
                    setRoles(parsed.roles);
                    setPermissions(parsed.permissions);
                    setLoading(false);
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

            // Filter Permissions based on ALLOWED_PERMISSIONS
            const allAllowedNames = Object.values(ALLOWED_PERMISSIONS).flat();
            const filteredPerms = (permsData || []).filter(p => {
                return allAllowedNames.includes(p.name);
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
        fetchRolesAndPermissions(false);
        return () => { mountedRef.current = false; };
    }, [fetchRolesAndPermissions]);

    useEffect(() => {
        if (!selectedRole) {
            setRolePermissions({});
            setSelectedResource(null);
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
                
                // Auto-select first resource if none selected
                if (!selectedResource && permissions.length > 0) {
                    const firstRes = Object.keys(permissionsByResource).sort((a, b) => 
                        (RESOURCE_TITLES[a] || a).localeCompare(RESOURCE_TITLES[b] || b)
                    )[0];
                    setSelectedResource(firstRes);
                }
            } catch (err) {
                console.error("Error fetching role perms:", err);
                toastError("Failed to load role permissions.");
            }
        };

        fetchRolePerms();
    }, [selectedRole, permissions]);

    const syncPermissions = async () => {
        try {
            setLoading(true);
            info("Syncing permissions...");

            const reportPermissions = [
                // Reports
                { resource: 'report', name: 'report.view', description: 'Access Reports Dashboard' },
                { resource: 'report', name: 'report.customer_account_statement', description: 'View customer account statement report' },
                { resource: 'report', name: 'report.loan_disbursement', description: 'View loan disbursement report' },
                { resource: 'report', name: 'report.loan_due', description: 'View loan due report' },
                { resource: 'report', name: 'report.customer_listing', description: 'View customer listing report' },
                { resource: 'report', name: 'report.mpesa_repayment', description: 'View Mpesa repayment report' },
                { resource: 'report', name: 'report.loan_officer_performance', description: 'View loan officer performance report' },
                { resource: 'report', name: 'report.non_performing_loans', description: 'View non-performing loans report' },
                { resource: 'report', name: 'report.outstanding_balance', description: 'View outstanding loan balance report' },
                { resource: 'report', name: 'report.pending_disbursement', description: 'View pending disbursement report' },
                { resource: 'report', name: 'report.loan_listing', description: 'View loan listing report' },
                { resource: 'report', name: 'report.installments', description: 'View installments report' },
                { resource: 'report', name: 'report.outstanding_eom', description: 'View end-of-month outstanding balance report' },
                { resource: 'report', name: 'report.trace_mpesa', description: 'Trace Mpesa transaction report' },
                { resource: 'report', name: 'report.inactive_customers', description: 'View inactive customers report' },
                { resource: 'report', name: 'report.loan_arrears', description: 'View loan arrears report' },
                { resource: 'report', name: 'report.suspense_payments', description: 'View suspense payments report' },

                // Core Loans
                { resource: 'loan', name: 'loan.create', description: 'Create Loan' },
                { resource: 'loan', name: 'loan.view', description: 'View Loans' },
                { resource: 'loan', name: 'loan.approve', description: 'Approve Loan' },
                { resource: 'loan', name: 'loan.disburse', description: 'Disburse Loan' },
                { resource: 'loan', name: 'loan.reject', description: 'Reject Loan' },
                { resource: 'loan', name: 'loan_limit_adjustment', description: 'Adjust Loan Limit' },

                // Users
                { resource: 'user', name: 'user.create', description: 'Create User' },
                { resource: 'user', name: 'user.view', description: 'View Users' },
                { resource: 'user', name: 'user.edit', description: 'Edit User' },
                { resource: 'user', name: 'user.delete', description: 'Delete User' },

                // Settings
                { resource: 'settings', name: 'settings.view', description: 'View Settings' },
                { resource: 'settings', name: 'settings.edit', description: 'Edit Settings' },
                { resource: 'penalty', name: 'penalty_settings_manage', description: 'Allows creating and updating loan penalty rules and settings' },

                // Customers
                { resource: 'customers', name: 'customers.view', description: 'View Customers' },
                { resource: 'customers', name: 'customers.create', description: 'Create Customer' },
                { resource: 'customers', name: 'customers.edit', description: 'Edit Customer' },
                { resource: 'customers', name: 'customers.delete', description: 'Delete Customer' },

                // Amendments
                { resource: 'amendments', name: 'amendments.initiate', description: 'Initiate Customer Amendments' },
                { resource: 'amendments', name: 'amendments.confirm', description: 'Confirm Customer Amendments' },
                { resource: 'amendments', name: 'amendments.authorize', description: 'Authorize Customer Amendments' },

                // Transfers
                { resource: 'transfers', name: 'transfers.initiate', description: 'Initiate Customer Transfers' },
                { resource: 'transfers', name: 'transfers.confirm', description: 'Confirm Customer Transfers' },
                { resource: 'transfers', name: 'transfers.authorize', description: 'Authorize Customer Transfers' },

                // Refunds
                { resource: 'refunds', name: 'refund.initiate', description: 'Initiate Customer Refund' },
                { resource: 'refunds', name: 'refund.approve', description: 'Approve/Reject Customer Refund' },

                // Journals
                { resource: 'journal', name: 'journal.create', description: 'Create Journal Entries' },
                { resource: 'journal', name: 'journal.approve', description: 'Approve or Reject Journal Entries' },

                // Reconciliation
                { resource: 'reconciliation', name: 'transaction.reconcile', description: 'Propose Transaction Reconciliation' },
                { resource: 'reconciliation', name: 'transaction.approve', description: 'Approve Transaction Reconciliation' },
            ];

            const { data: existingPerms, error: fetchError } = await supabase
                .from("permissions")
                .select("name");

            if (fetchError) throw fetchError;

            const existingNames = new Set(existingPerms.map(p => p.name));
            const missingPerms = reportPermissions.filter(p => !existingNames.has(p.name));

            if (missingPerms.length > 0) {
                console.warn(`Attempted to sync ${missingPerms.length} new permissions. Please run the backend script to insert them gracefully bypassing RLS.`);
                success("Verified local permissions. (Some may need backend sync)");
            } else {
                success("Permissions are up to date in the UI.");
            }

            // --- AUTO GRANT TO ADMIN ROLES ---
            const { data: allPerms } = await supabase.from("permissions").select("id, name");
            const { data: adminRoles } = await supabase
                .from("roles")
                .select("id")
                .eq("tenant_id", profile.tenant_id)
                .in("name", ["admin", "super_admin"]);

            if (adminRoles?.length > 0 && allPerms?.length > 0) {
                const allAllowedNames = Object.values(ALLOWED_PERMISSIONS).flat();
                const allowedPermIds = allPerms
                    .filter(p => allAllowedNames.includes(p.name))
                    .map(p => p.id);

                for (const role of adminRoles) {
                    const { data: existing } = await supabase
                        .from("role_permissions")
                        .select("permission_id")
                        .eq("role_id", role.id);
                    
                    const existingIds = new Set(existing?.map(e => e.permission_id) || []);
                    const toAdd = allowedPermIds.filter(id => !existingIds.has(id));

                    if (toAdd.length > 0) {
                        await supabase.from("role_permissions").insert(
                            toAdd.map(permission_id => ({ role_id: role.id, permission_id }))
                        );
                    }
                }
                success("Verified admin role permissions.");
            }

            // Clear cache and refresh
            const cacheKey = `roles_perms_${profile.tenant_id || 'all'}`;
            localStorage.removeItem(cacheKey);
            await fetchRolesAndPermissions(true);
        } catch (err) {
            console.error("Error syncing permissions:", err);
            toastError(`Failed to sync permissions: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

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
                await syncPermissions();
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
            await syncPermissions();

        } catch (err) {
            console.error("Error syncing roles:", err);
            if (err?.message?.includes("Failed to fetch")) {
                toastError("Network error. Please make sure your server connection is active.");
            } else {
                toastError(`Failed to sync roles: ${err.message}`);
            }
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
        if (e) e.preventDefault();
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

            fetchRolesAndPermissions(true);

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
        return <SkeletonPage />;
    }

    return (
        <div className="min-h-screen bg-page p-5 md:p-8 animate-fade-in font-outfit w-full">
            <div className="w-full space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-heading flex items-center gap-2">
                            <ShieldCheck className="h-6 w-6 text-brand" />
                            Role Permission Manager
                        </h1>
                        <p className="text-sm text-muted mt-1">Configure access control levels and permissions for tenant user roles.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {selectedRole && (
                            <button
                                onClick={saveConfiguration}
                                disabled={saving}
                                className="f-btn flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Config
                            </button>
                        )}
                        <button
                            onClick={syncRoles}
                            className="flex items-center gap-1.5 px-4 py-2 bg-card border border-border text-muted hover:text-heading hover:bg-surface/50 rounded-lg transition-all text-sm font-semibold shadow-sm"
                        >
                            <ShieldCheck className="h-4 w-4 text-brand" />
                            Sync Roles & Perms
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
                    {/* 1. Roles Sidebar - Far Left */}
                    <div className="lg:col-span-3 bg-card rounded-xl border border-border shadow-card p-4 h-fit space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="font-bold text-xs uppercase tracking-wider text-heading">Select Role</h3>
                            <button
                                onClick={() => setIsAddRoleOpen(true)}
                                className="p-1 text-brand hover:bg-surface border border-transparent hover:border-border rounded-lg transition-all"
                                title="Add New Role"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-1">
                            {roles.map((role) => (
                                <button
                                    key={role.id}
                                    onClick={() => setSelectedRole(role)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                                        selectedRole?.id === role.id
                                            ? "bg-surface text-brand border border-border-light shadow-sm"
                                            : "text-muted hover:bg-surface/50 hover:text-heading"
                                    }`}
                                >
                                    {role.name.charAt(0).toUpperCase() + role.name.slice(1).replace(/_/g, ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Rest of the panel containing Categories and Permissions lists */}
                    {!selectedRole ? (
                        <div className="lg:col-span-9 bg-card rounded-xl border border-border shadow-card p-12 flex flex-col items-center justify-center text-center text-muted">
                            <ShieldCheck className="h-12 w-12 mb-3 opacity-30 text-brand" />
                            <p className="text-sm italic">Select a role from the sidebar to view and edit permissions.</p>
                        </div>
                    ) : (
                        <>
                            {/* 2. Vertical Permission Category Groups List */}
                            <div className="lg:col-span-4 bg-card rounded-xl border border-border shadow-card p-4 h-fit space-y-4">
                                <div className="px-1">
                                    <h3 className="font-bold text-xs uppercase tracking-wider text-heading">Permission Groups</h3>
                                </div>
                                <div className="space-y-1">
                                    {Object.keys(permissionsByResource)
                                        .sort((a, b) => (RESOURCE_TITLES[a] || a).localeCompare(RESOURCE_TITLES[b] || b))
                                        .map((resource) => (
                                            <button
                                                key={resource}
                                                onClick={() => setSelectedResource(resource)}
                                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                                                    selectedResource === resource
                                                        ? "bg-surface text-brand border border-border-light shadow-sm"
                                                        : "text-muted hover:bg-surface/50 hover:text-heading"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="truncate">{RESOURCE_TITLES[resource] || resource}</span>
                                                    <span className="text-xs font-bold bg-card px-1.5 py-0.5 rounded border border-border-light text-muted flex-shrink-0">
                                                        {permissionsByResource[resource].filter(p => rolePermissions[p.id]).length} / {permissionsByResource[resource].length}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                </div>
                            </div>

                            {/* 3. Checkbox Permissions Details List */}
                            <div className="lg:col-span-5 bg-card rounded-xl border border-border shadow-card overflow-hidden h-fit">
                                {selectedResource && permissionsByResource[selectedResource] ? (
                                    <>
                                        <div className="px-6 py-4 border-b border-border-light bg-surface/30 flex justify-between items-center">
                                            <h3 className="font-semibold text-heading text-sm truncate max-w-[70%]">
                                                {RESOURCE_TITLES[selectedResource] || selectedResource}
                                            </h3>
                                            <span className="text-[10px] font-bold text-muted bg-card px-2.5 py-1 border border-border rounded-md shadow-sm flex-shrink-0">
                                                {permissionsByResource[selectedResource].filter(p => rolePermissions[p.id]).length} active
                                            </span>
                                        </div>
                                        
                                        <div className="p-4 space-y-2.5 max-h-[550px] overflow-y-auto">
                                            {permissionsByResource[selectedResource]
                                                .sort((a, b) => a.description.localeCompare(b.description))
                                                .map((perm) => (
                                                    <label
                                                        key={perm.id}
                                                        className={`flex items-start gap-2.5 p-3 rounded-lg border transition-all cursor-pointer group ${
                                                            rolePermissions[perm.id]
                                                                ? "bg-surface/30 border-brand/35 shadow-sm"
                                                                : "bg-card border-border-light hover:border-border"
                                                        }`}
                                                    >
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 mt-0.5 ${
                                                            rolePermissions[perm.id]
                                                                ? "bg-brand border-brand"
                                                                : "bg-card border-border group-hover:border-brand/40"
                                                        }`}>
                                                            <input
                                                                type="checkbox"
                                                                checked={!!rolePermissions[perm.id]}
                                                                onChange={() => togglePermission(perm.id)}
                                                                className="hidden"
                                                            />
                                                            {rolePermissions[perm.id] && (
                                                                <CheckCircle className="h-3 w-3 text-white" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-xs font-semibold leading-snug whitespace-normal break-words ${
                                                                rolePermissions[perm.id] ? "text-brand font-bold" : "text-body"
                                                            }`}>
                                                                {perm.description}
                                                            </p>
                                                            <p className="text-[9px] text-muted/65 font-mono mt-0.5 select-all">
                                                                {perm.name}
                                                            </p>
                                                        </div>
                                                    </label>
                                                ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted text-center p-6">
                                        <AlertCircle className="h-8 w-8 mb-2 opacity-25 text-brand" />
                                        <p className="text-xs italic">Select a category from the vertical groups list on the left.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Add Role Modal */}
            <Modal
                open={isAddRoleOpen}
                title="Add New Role"
                onClose={() => setIsAddRoleOpen(false)}
                onSave={handleAddRole}
                saving={addingRole}
                saveLabel="Create Role"
            >
                <form onSubmit={handleAddRole} className="space-y-4 font-outfit text-xs">
                    <div>
                        <label className="block text-xs font-semibold text-heading mb-1.5">
                            Role Name <span className="text-danger-DEFAULT">*</span>
                        </label>
                        <input
                            type="text"
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            placeholder="e.g. Operations Officer"
                            className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-xs text-body shadow-sm"
                            autoFocus
                        />
                        <p className="text-[10px] text-muted mt-2 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Will be saved as <code className="bg-surface px-1.5 py-0.5 rounded text-heading font-semibold">{newRoleName.trim().toLowerCase().replace(/\s+/g, '_') || '...'}</code>
                        </p>
                    </div>
                    <button type="submit" className="hidden" />
                </form>
            </Modal>
        </div>
    );
}