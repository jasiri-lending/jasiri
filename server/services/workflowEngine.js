import { supabaseAdmin } from "../supabaseClient.js";

/**
 * Workflow Engine Service
 * Handles starting workflows, checking states, and progressing actions.
 */

// Start a new workflow instance for an entity
export const startWorkflow = async (tenant_id, workflow_type, entity_id, entity_type, user_id, user_roles) => {
    // 1. Get the active workflow definition for the tenant and type
    const { data: workflowDef, error: wfError } = await supabaseAdmin
        .from('workflow_definitions')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('type', workflow_type)
        .eq('status', 'active')
        .order('version', { ascending: false })
        .limit(1)
        .single();

    if (wfError || !workflowDef) {
        throw new Error(`No active workflow definition found for type: ${workflow_type}`);
    }

    // 2. Find the START node
    const { data: startNode, error: nodeError } = await supabaseAdmin
        .from('workflow_nodes')
        .select('*, workflow_node_roles(role_id)')
        .eq('workflow_id', workflowDef.id)
        .eq('type', 'START')
        .single();

    if (nodeError || !startNode) {
        throw new Error(`No START node found for workflow: ${workflowDef.name}`);
    }

    // Check if the user is authorized to trigger this START node
    const allowedRoleIds = startNode.workflow_node_roles?.map(r => r.role_id) || [];
    if (allowedRoleIds.length > 0 && user_roles) {
        const hasRole = user_roles.some(role_id => allowedRoleIds.includes(role_id));
        if (!hasRole) {
            throw new Error(`User does not have the required role to initiate this workflow`);
        }
    }

    // Check System Permission if defined
    if (startNode.required_permission_id) {
        // We assume user_permissions is passed in or we fetch it. 
        // To keep it consistent with the existing auth middleware, we should check against the DB.
        const { data: hasPerm } = await supabaseAdmin
            .from('role_permissions')
            .select('id')
            .in('role_id', user_roles)
            .eq('permission_id', startNode.required_permission_id)
            .maybeSingle();
            
        if (!hasPerm) {
            throw new Error(`User lacks the specific system permission required to start this process`);
        }
    }

    // 3. Find the next node immediately after START
    const { data: initialEdge, error: edgeError } = await supabaseAdmin
        .from('workflow_edges')
        .select('*')
        .eq('workflow_id', workflowDef.id)
        .eq('source_node_id', startNode.node_client_id)
        .single();

    if (edgeError || !initialEdge) {
        throw new Error(`START node must have exactly one outgoing edge in workflow: ${workflowDef.name}`);
    }

    // Find the target node of the initial edge
    const { data: nextNode, error: targetNodeError } = await supabaseAdmin
        .from('workflow_nodes')
        .select('*')
        .eq('workflow_id', workflowDef.id)
        .eq('node_client_id', initialEdge.target_node_id)
        .single();

    if (targetNodeError || !nextNode) {
        throw new Error(`Target node not found for START edge`);
    }

    // 4. Create the workflow instance
    const { data: instance, error: instanceError } = await supabaseAdmin
        .from('workflow_instances')
        .insert({
            tenant_id,
            workflow_id: workflowDef.id,
            entity_id,
            entity_type,
            current_node_id: nextNode.id,
            status: nextNode.type === 'END' ? 'completed' : 'in_progress'
        })
        .select()
        .single();

    if (instanceError) {
        throw new Error(`Failed to start workflow instance: ${instanceError.message}`);
    }

    // 5. Log the start action
    await supabaseAdmin
        .from('workflow_instance_history')
        .insert({
            instance_id: instance.id,
            node_id: startNode.id,
            action_type: 'start',
            comments: `Workflow started automatically for ${entity_type} ${entity_id}`
        });

    return instance;
};

// Perform an action on an existing workflow instance
export const performAction = async (instance_id, user_id, user_roles, action_type, comments) => {
    // 1. Get the instance and its current node
    const { data: instance, error: instanceError } = await supabaseAdmin
        .from('workflow_instances')
        .select('*, workflow_nodes(*)')
        .eq('id', instance_id)
        .single();

    if (instanceError || !instance) {
        throw new Error(`Workflow instance not found`);
    }

    if (instance.status !== 'in_progress') {
        throw new Error(`Workflow instance is already ${instance.status}`);
    }

    const currentNode = instance.workflow_nodes;

    // 2. Validate Role (Check if user has a role allowed for this node)
    const { data: allowedRoles, error: rolesError } = await supabaseAdmin
        .from('workflow_node_roles')
        .select('role_id')
        .eq('node_id', currentNode.id);

    if (rolesError) {
        throw new Error(`Failed to verify node permissions`);
    }

    const allowedRoleIds = allowedRoles.map(r => r.role_id);
    const hasRole = user_roles.some(role_id => allowedRoleIds.includes(role_id));

    if (!hasRole && allowedRoleIds.length > 0) {
        throw new Error(`User does not have a role that owns this workflow step`);
    }

    // 3. Validate System Permission (Core security gate)
    if (currentNode.required_permission_id) {
        const { data: hasPerm } = await supabaseAdmin
            .from('role_permissions')
            .select('id')
            .in('role_id', user_roles)
            .eq('permission_id', currentNode.required_permission_id)
            .maybeSingle();

        if (!hasPerm) {
            throw new Error(`User lacks the authoritative system permission required for this action`);
        }
    }

    // 3. Find the edge matching the action_type
    const { data: edges, error: edgeError } = await supabaseAdmin
        .from('workflow_edges')
        .select('*')
        .eq('workflow_id', instance.workflow_id)
        .eq('source_node_id', currentNode.node_client_id)
        .eq('action_type', action_type);

    if (edgeError || !edges || edges.length === 0) {
        throw new Error(`Invalid action '${action_type}' for current state`);
    }

    // Evaluate conditions if there are multiple edges for the same action (e.g. conditional routing)
    let selectedEdge = edges[0];
    if (edges.length > 1) {
        // TODO: Implement complex condition evaluation (e.g., amount > 1000)
        // For now, just take the first one or require custom logic
    }

    // 4. Find the target node
    const { data: nextNode, error: nextNodeError } = await supabaseAdmin
        .from('workflow_nodes')
        .select('*')
        .eq('workflow_id', instance.workflow_id)
        .eq('node_client_id', selectedEdge.target_node_id)
        .single();

    if (nextNodeError || !nextNode) {
        throw new Error(`Target state not found`);
    }

    // 5. Update the instance
    const newStatus = nextNode.type === 'END' ? 'completed' : 
                      (action_type === 'cancel' || action_type === 'reject') && nextNode.type === 'END' ? 'rejected' : 'in_progress';

    const { data: updatedInstance, error: updateError } = await supabaseAdmin
        .from('workflow_instances')
        .update({
            current_node_id: nextNode.id,
            status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq('id', instance_id)
        .select()
        .single();

    if (updateError) {
        throw new Error(`Failed to progress workflow`);
    }

    // 6. Log the history
    await supabaseAdmin
        .from('workflow_instance_history')
        .insert({
            instance_id: instance.id,
            node_id: currentNode.id,
            action_type: action_type,
            acted_by: user_id,
            comments: comments || ''
        });

    return updatedInstance;
};
