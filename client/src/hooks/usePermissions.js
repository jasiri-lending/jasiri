import { usePermissionContext } from "../context/PermissionContext";

/**
 * usePermissions hook
 * Now refactored to consume PermissionContext for global state.
 * This ensures that permissions are fetched once and shared across the app.
 */
export function usePermissions() {
    const { permissions, loading, hasPermission, getPermissionsByResource, refreshPermissions } = usePermissionContext();

    return {
        permissions,
        loading,
        hasPermission,
        getPermissionsByResource,
        refreshPermissions // Expose refresh in case some components need to force a reload
    };
}
