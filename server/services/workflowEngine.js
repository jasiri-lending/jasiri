import { supabaseAdmin } from "../supabaseClient.js";

export const normalizeEntityId = (id) => {
    if (!id) return id;
    const strId = String(id);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(strId)) {
        return strId.toLowerCase();
    }
    if (/^\d+$/.test(strId)) {
        const hex = Number(strId).toString(16).padStart(12, '0');
        return `00000000-0000-4000-a000-${hex}`;
    }
    return strId;
};

export const denormalizeEntityId = (uuidStr) => {
    if (!uuidStr) return uuidStr;
    const str = String(uuidStr).toLowerCase();
    if (str.startsWith('00000000-0000-4000-a000-')) {
        const hex = str.split('-').pop();
        return parseInt(hex, 16);
    }
    return uuidStr;
};

/**
 * Action Registry
 * Register automated tasks that can be triggered on node entry.
 */
const ActionRegistry = {
    NOTIFY_USER: async (instance, node, context) => {
        console.log(`[Action] NOTIFY_USER triggered for instance ${instance.id}`);
        // Implementation for notification logic
    },
    TRIGGER_WEBHOOK: async (instance, node, context) => {
        console.log(`[Action] TRIGGER_WEBHOOK triggered for instance ${instance.id}`);
        // Implementation for webhook logic
    },
    PERFORM_CREDIT_CHECK: async (instance, node, context) => {
        console.log(`[Action] PERFORM_CREDIT_CHECK triggered for instance ${instance.id}`);
        // Integration with credit scoring service
    }
};

/**
 * Condition Evaluator
 * Evaluates whether a transition's conditions are met based on the instance context.
 */
const evaluateConditions = (conditions, context) => {
    if (!conditions || conditions.length === 0) return true;

    return conditions.every(condition => {
        const { field, operator, value } = condition;
        const contextValue = context ? context[field] : undefined;

        switch (operator) {
            case 'equals':
                return String(contextValue) === String(value);
            case 'not_equals':
                return String(contextValue) !== String(value);
            case 'greater_than':
                return Number(contextValue) > Number(value);
            case 'less_than':
                return Number(contextValue) < Number(value);
            case 'contains':
                return Array.isArray(contextValue) ? contextValue.includes(value) : String(contextValue).includes(value);
            default:
                return false;
        }
    });
};

/**
 * Workflow Engine Service
 * Handles starting workflows, checking states, and progressing actions.
 */

// Start a new workflow instance for an entity
export const startWorkflow = async (tenant_id, workflow_type, entity_id, entity_type, user_id, initial_context = {}) => {
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
        .select('*')
        .eq('workflow_id', workflowDef.id)
        .eq('type', 'START')
        .single();

    if (nodeError || !startNode) {
        throw new Error(`No START node found for workflow: ${workflowDef.name}`);
    }

    // 3. Find the edge from START to the first functional node
    const { data: edges, error: edgeError } = await supabaseAdmin
        .from('workflow_edges')
        .select(`
            *,
            workflow_conditions(*)
        `)
        .eq('workflow_id', workflowDef.id)
        .eq('source_node_id', startNode.node_client_id);

    if (edgeError || !edges || edges.length === 0) {
        throw new Error(`START node must have at least one outgoing edge`);
    }

    // Evaluate conditions for the first transition
    const validEdge = edges.find(edge => evaluateConditions(edge.workflow_conditions, initial_context));
    
    if (!validEdge) {
        throw new Error(`No valid transition found from START node based on initial context`);
    }

    // Find the target node of the valid edge
    const { data: nextNode, error: targetNodeError } = await supabaseAdmin
        .from('workflow_nodes')
        .select('*')
        .eq('workflow_id', workflowDef.id)
        .eq('node_client_id', validEdge.target_node_id)
        .single();

    if (targetNodeError || !nextNode) {
        throw new Error(`Target node not found for START transition`);
    }

    // 4. Create the workflow instance (upsert to handle draft→submit re-submission)
    const { data: instance, error: instanceError } = await supabaseAdmin
        .from('workflow_instances')
        .upsert({
            tenant_id,
            workflow_id: workflowDef.id,
            entity_id: normalizeEntityId(entity_id),
            entity_type,
            current_node_id: nextNode.id,
            status: 'in_progress',
            updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id,entity_type,entity_id' })
        .select()
        .single();

    if (instanceError) {
        throw new Error(`Failed to start workflow instance: ${instanceError.message}`);
    }

    // 5. Log the start action in history
    await supabaseAdmin
        .from('workflow_instance_history')
        .insert({
            instance_id: instance.id,
            node_id: nextNode.id,
            action_type: 'START',
            from_node_id: startNode.id,
            to_node_id: nextNode.id,
            event: 'START',
            acted_by: user_id,
            comments: `Workflow initiated for ${entity_type}`,
            context_snapshot: initial_context
        });

    // 6. Execute On-Entry Actions for the new node
    if (nextNode.on_entry_actions && Array.isArray(nextNode.on_entry_actions)) {
        for (const actionName of nextNode.on_entry_actions) {
            if (ActionRegistry[actionName]) {
                await ActionRegistry[actionName](instance, nextNode, initial_context);
            }
        }
    }

    if (instance) {
        instance.entity_id = denormalizeEntityId(instance.entity_id);
        instance.overall_status = instance.status;
    }

    return instance;
};

// Perform an action (transition) on an existing workflow instance
export const performAction = async (instance_id, user_id, user_roles, event, comments, updated_context = {}) => {
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
    const currentContext = { ...(instance.context || {}), ...updated_context };

    // 2. Find the edges matching the event from current node
    let { data: edges, error: edgeError } = await supabaseAdmin
        .from('workflow_edges')
        .select(`
            *,
            workflow_conditions(*)
        `)
        .eq('workflow_id', instance.workflow_id)
        .eq('source_node_id', currentNode.node_client_id)
        .eq('event', event);

    if (edgeError || !edges || edges.length === 0) {
        // Auto-resolution: if the frontend sent a hardcoded event (like 'SUBMIT') but it doesn't match the custom DB config,
        // we dynamically fetch all outgoing edges and pick a valid progression edge.
        const { data: allEdges } = await supabaseAdmin
            .from('workflow_edges')
            .select(`*, workflow_conditions(*)`)
            .eq('workflow_id', instance.workflow_id)
            .eq('source_node_id', currentNode.node_client_id);
            
        if (allEdges && allEdges.length > 0) {
            // Prioritize progression edges (not CANCEL/REJECT/SEND_BACK)
            const progressionEdges = allEdges.filter(e => !['CANCEL', 'REJECT', 'SEND_BACK'].includes(e.event?.toUpperCase()));
            edges = progressionEdges.length > 0 ? progressionEdges : allEdges;
        } else {
            throw new Error(`Invalid action '${event}' for current state`);
        }
    }

    // 3. Filter edges by roles_allowed, groups_allowed and evaluate conditions
    const validEdges = await Promise.all(edges.map(async (edge) => {
        // A. Check roles if defined (can be role name string or role UUID)
        let rolesAllowed = edge.roles_allowed || [];
        if (rolesAllowed.length === 0 && currentNode?.permissions) {
            let perms = currentNode.permissions;
            if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch (e) {}
            }
            if (perms && Array.isArray(perms.roles)) {
                rolesAllowed = perms.roles;
            }
        }

        if (rolesAllowed.length > 0) {
            const hasRole = user_roles.some(role => rolesAllowed.includes(role));
            if (!hasRole) return null;
        }

        // B. Check groups if defined (UUID array)
        if (edge.groups_allowed && Array.isArray(edge.groups_allowed) && edge.groups_allowed.length > 0) {
            const { data: membership } = await supabaseAdmin
                .from('user_group_members')
                .select('group_id')
                .eq('user_id', user_id)
                .in('group_id', edge.groups_allowed);
            
            if (!membership || membership.length === 0) return null;
        }
        
        // C. Check conditions
        const conditionsMet = evaluateConditions(edge.workflow_conditions, currentContext);
        return conditionsMet ? edge : null;
    }));

    const filteredEdges = validEdges.filter(e => e !== null);

    if (filteredEdges.length === 0) {
        throw new Error(`You do not have the required role/group or conditions are not met for this action`);
    }

    const selectedEdge = filteredEdges[0]; // Take the first valid transition
    const resolvedEvent = selectedEdge.event; // Use the actual event we matched against

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

    // 5. Determine status
    let status = 'in_progress';
    if (nextNode.type === 'END') {
        status = resolvedEvent === 'REJECT' ? 'rejected' : 'completed';
    } else if (resolvedEvent === 'CANCEL') {
        status = 'cancelled';
    }

    // 6. Update the instance
    const { data: updatedInstance, error: updateError } = await supabaseAdmin
        .from('workflow_instances')
        .update({
            current_node_id: nextNode.id,
            status,
            updated_at: new Date().toISOString()
        })
        .eq('id', instance_id)
        .select()
        .single();

    if (updateError) {
        throw new Error(`Failed to progress workflow instance`);
    }

    // 7. Log history
    await supabaseAdmin
        .from('workflow_instance_history')
        .insert({
            instance_id: instance.id,
            node_id: nextNode.id,
            action_type: resolvedEvent,
            from_node_id: currentNode.id,
            to_node_id: nextNode.id,
            event: resolvedEvent,
            acted_by: user_id,
            comments: comments || '',
            context_snapshot: currentContext
        });

    // 8. Execute On-Entry Actions for the new node
    if (nextNode.on_entry_actions && Array.isArray(nextNode.on_entry_actions)) {
        for (const actionName of nextNode.on_entry_actions) {
            if (ActionRegistry[actionName]) {
                try {
                    await ActionRegistry[actionName](updatedInstance, nextNode, currentContext);
                } catch (actionErr) {
                    console.error(`[Action Error] Failed to execute ${actionName}:`, actionErr);
                }
            }
        }
    }

    if (updatedInstance) {
        updatedInstance.entity_id = denormalizeEntityId(updatedInstance.entity_id);
        updatedInstance.overall_status = updatedInstance.status;
    }

    return updatedInstance;
};

