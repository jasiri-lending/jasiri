-- Migration to insert customer transfer permissions
-- Resource: transfers
-- Actions: initiate, confirm, authorize

DO $$ 
DECLARE
    v_permission_id uuid;
BEGIN
    -- 1. Insert Initiate Permission
    INSERT INTO public.permissions (resource, action, name, description)
    VALUES ('transfers', 'initiate', 'transfers.initiate', 'Ability to initiate customer transfer requests')
    ON CONFLICT (name) DO NOTHING;

    -- 2. Insert Confirm Permission
    INSERT INTO public.permissions (resource, action, name, description)
    VALUES ('transfers', 'confirm', 'transfers.confirm', 'Ability to confirm/approve customer transfer requests')
    ON CONFLICT (name) DO NOTHING;

    -- 3. Insert Authorize Permission
    INSERT INTO public.permissions (resource, action, name, description)
    VALUES ('transfers', 'authorize', 'transfers.authorize', 'Ability to authorize/execute customer transfer requests')
    ON CONFLICT (name) DO NOTHING;

    -- NOTE: Mapping to roles should be done via the RolePermissionManager UI 
    -- or manually in role_permissions table if needed.
END $$;
