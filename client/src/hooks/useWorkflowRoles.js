import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './userAuth';

/**
 * useWorkflowRoles hook
 * Fetches and manages the names of roles assigned to specific transfer permissions.
 * This allows the UI to dynamically show "Unit Head" instead of "Branch Manager" 
 * if the role is renamed or reassigned in the admin panel.
 */
export const useWorkflowRoles = () => {
    const { profile } = useAuth();
    const [workflowRoles, setWorkflowRoles] = useState({
        initiate: 'Branch Manager',
        confirm: 'Regional Manager',
        authorize: 'Credit Analyst',
        loading: true
    });

    const fetchWorkflowRoles = useCallback(async () => {
        if (!profile?.tenant_id) return;

        try {
            const permMap = {
                'transfers.initiate': 'initiate',
                'transfers.confirm': 'confirm',
                'transfers.authorize': 'authorize'
            };

            // Query roles (which has tenant_id) → role_permissions → permissions
            // This avoids filtering role_permissions by tenant_id (that column doesn't exist there)
            const { data, error } = await supabase
                .from('roles')
                .select(`
                    name,
                    role_permissions (
                        permissions (
                            name
                        )
                    )
                `)
                .eq('tenant_id', profile.tenant_id);

            if (error) throw error;

            const newRoles = {
                initiate: 'Branch Manager',
                confirm: 'Regional Manager',
                authorize: 'Credit Analyst',
                loading: false
            };

            if (data) {
                data.forEach(role => {
                    role.role_permissions?.forEach(rp => {
                        const permName = rp.permissions?.name;
                        const step = permMap[permName];
                        if (step) {
                            if (newRoles[step] === 'Branch Manager' || newRoles[step] === 'Regional Manager' || newRoles[step] === 'Credit Analyst') {
                                newRoles[step] = role.name;
                            } else if (!newRoles[step].includes(role.name)) {
                                newRoles[step] += ` / ${role.name}`;
                            }
                        }
                    });
                });
            }

            setWorkflowRoles(newRoles);
        } catch (error) {
            console.error('Error fetching workflow roles:', error);
            setWorkflowRoles(prev => ({ ...prev, loading: false }));
        }
    }, [profile?.tenant_id]);

    useEffect(() => {
        fetchWorkflowRoles();
    }, [fetchWorkflowRoles]);

    return {
        ...workflowRoles,
        refreshWorkflowRoles: fetchWorkflowRoles
    };
};
