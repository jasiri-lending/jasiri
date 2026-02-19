import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../hooks/userAuth";

const PermissionContext = createContext();

export const PermissionProvider = ({ children }) => {
    const { profile } = useAuth();
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchPermissions = useCallback(async () => {
        if (!profile?.role) {
            setPermissions([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            let query = supabase
                .from("roles")
                .select(`
                    id,
                    role_permissions (
                        permissions (
                            name,
                            description,
                            resource,
                            action
                        )
                    )
                `)
                .eq("name", profile.role);

            if (profile.tenant_id) {
                query = query.eq("tenant_id", profile.tenant_id);
            }

            const { data: roleData, error: roleError } = await query.maybeSingle();

            if (roleError) {
                console.warn("Role fetch error:", roleError.message);
                setPermissions([]);
            } else if (!roleData) {
                console.warn("Role not found in RBAC system:", profile.role);
                setPermissions([]);
            } else {
                const flattened_perms = roleData.role_permissions
                    .map((rp) => rp.permissions)
                    .filter(p => p !== null);
                setPermissions(flattened_perms);
            }
        } catch (err) {
            console.error("Error fetching permissions:", err.message);
            setPermissions([]);
        } finally {
            setLoading(false);
        }
    }, [profile?.role, profile?.tenant_id]);

    useEffect(() => {
        if (profile?.role) {
            fetchPermissions();
        } else {
            setLoading(false);
        }
    }, [profile?.role, fetchPermissions]);

    const hasPermission = useCallback((name) => {
        if (loading) return false;
        return permissions.some((p) => p.name === name);
    }, [permissions, loading]);

    const getPermissionsByResource = useCallback((resource) =>
        permissions.filter((p) => p.resource === resource), [permissions]);

    const value = {
        permissions,
        loading,
        hasPermission,
        getPermissionsByResource,
        refreshPermissions: fetchPermissions
    };

    return (
        <PermissionContext.Provider value={value}>
            {children}
        </PermissionContext.Provider>
    );
};

export const usePermissionContext = () => {
    const context = useContext(PermissionContext);
    if (!context) {
        throw new Error("usePermissionContext must be used within a PermissionProvider");
    }
    return context;
};
