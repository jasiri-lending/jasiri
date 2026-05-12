import { supabaseAdmin } from "../supabaseClient.js";

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

    // 4. Create the workflow instance
    const { data: instance, error: instanceError } = await supabaseAdmin
        .from('workflow_instances')
        .insert({
            tenant_id,
            workflow_id: workflowDef.id,
            entity_id,
            entity_type,
            current_node_id: nextNode.id,
            context: initial_context,
            overall_status: 'in_progress'
        })
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

    if (instance.overall_status !== 'in_progress') {
        throw new Error(`Workflow instance is already ${instance.overall_status}`);
    }

    const currentNode = instance.workflow_nodes;
    const currentContext = { ...(instance.context || {}), ...updated_context };

    // 2. Find the edges matching the event from current node
    const { data: edges, error: edgeError } = await supabaseAdmin
        .from('workflow_edges')
        .select(`
            *,
            workflow_conditions(*)
        `)
        .eq('workflow_id', instance.workflow_id)
        .eq('source_node_id', currentNode.node_client_id)
        .eq('event', event);

    if (edgeError || !edges || edges.length === 0) {
        throw new Error(`Invalid action '${event}' for current state`);
    }

    // 3. Filter edges by roles_allowed and evaluate conditions
    const validEdges = edges.filter(edge => {
        // Check roles if defined
        if (edge.roles_allowed && Array.isArray(edge.roles_allowed) && edge.roles_allowed.length > 0) {
            const hasRole = user_roles.some(role_id => edge.roles_allowed.includes(role_id));
            if (!hasRole) return false;
        }
        
        // Check conditions
        return evaluateConditions(edge.workflow_conditions, currentContext);
    });

    if (validEdges.length === 0) {
        throw new Error(`You do not have the required role or conditions are not met for this action`);
    }

    const selectedEdge = validEdges[0]; // Take the first valid transition

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

    // 5. Determine overall status
    let overall_status = 'in_progress';
    if (nextNode.type === 'END') {
        overall_status = event === 'REJECT' ? 'rejected' : 'completed';
    } else if (event === 'CANCEL') {
        overall_status = 'cancelled';
    }

    // 6. Update the instance
    const { data: updatedInstance, error: updateError } = await supabaseAdmin
        .from('workflow_instances')
        .update({
            current_node_id: nextNode.id,
            context: currentContext,
            overall_status,
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
            from_node_id: currentNode.id,
            to_node_id: nextNode.id,
            event: event,
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

    return updatedInstance;
};

