import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./userAuth";

export function usePermissions() {
    const { profile } = useAuth();
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPermissions = async () => {
            // If no profile or role, clear permissions (or default to public if needed)
            if (!profile?.role) {
                setPermissions([]);
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                // We look up the role by name since profile.role is a string
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

                // Scope by tenant if user belongs to one
                if (profile.tenant_id) {
                    query = query.eq("tenant_id", profile.tenant_id);
                }

                // We use maybeSingle() instead of single() to handle 0 or 1 safely.
                // If there are duplicates even within the same tenant, that's a data integrity issue,
                // but maybeSingle will return error if > 1.
                // Given the unique constraint is likely (tenant_id, name), this should work.
                const { data: roleData, error: roleError } = await query.maybeSingle();

                if (roleError) {
                    console.warn("Role fetch error:", roleError.message);
                    setPermissions([]);
                } else if (!roleData) {
                    console.warn("Role not found in RBAC system:", profile.role);
                    setPermissions([]);
                } else {
                    // flattening the structure
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
        };

        if (profile?.role) {
            fetchPermissions();
        } else {
            setLoading(false);
        }
    }, [profile?.role, profile?.tenant_id]); // only re-run if role or tenant changes

    const hasPermission = (name) => {
        if (loading) return false;
        return permissions.some((p) => p.name === name);
    };

    const getPermissionsByResource = (resource) =>
        permissions.filter((p) => p.resource === resource);

    return { permissions, loading, hasPermission, getPermissionsByResource };
}
