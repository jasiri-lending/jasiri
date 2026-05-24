import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { startWorkflow, performAction, normalizeEntityId, denormalizeEntityId } from "../services/workflowEngine.js";
import { verifySupabaseToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// ─── Get all workflows for a tenant ───────────────────────────────────────────
router.get("/", verifySupabaseToken, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("workflow_definitions")
            .select(`
                *,
                workflow_nodes(count)
            `)
            .eq("tenant_id", req.user.tenant_id);

        if (error) throw error;

        const workflows = data.map(w => ({
            ...w,
            steps_count: w.workflow_nodes[0]?.count || 0
        }));

        res.json({ success: true, data: workflows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Get pending workflow approvals for a user/tenant ──────────────────────────
router.get("/pending", verifySupabaseToken, async (req, res) => {
    try {
        const tenant_id = req.user.tenant_id;
        const user_role = req.user.role;

        // 1. Fetch all roles for the tenant to resolve allowed roles
        const { data: roleData, error: roleError } = await supabaseAdmin
            .from("roles")
            .select("id, name, base_role")
            .eq("tenant_id", tenant_id);

        if (roleError) throw roleError;

        const userRoleIds = [];
        if (roleData) {
            const matchedRoles = roleData.filter(r => 
                r.name.toLowerCase() === user_role.toLowerCase() || 
                (r.base_role && r.base_role.toLowerCase() === user_role.toLowerCase())
            );
            userRoleIds.push(...matchedRoles.map(r => r.id));
        }

        // 2. Fetch all active in_progress workflow instances for this tenant, limited to customer_onboarding
        const { data: instanceData, error: instanceError } = await supabaseAdmin
            .from("workflow_instances")
            .select(`
                *,
                workflow_nodes!current_node_id (id, node_client_id, name, type, permissions),
                workflow_definitions!workflow_id (id, name, type)
            `)
            .eq("tenant_id", tenant_id)
            .eq("status", "in_progress")
            .eq("entity_type", "customer_onboarding");

        if (instanceError) throw instanceError;

        // 3. Group entity IDs by type so we can batch-fetch each entity table
        const grouped = {};
        for (const inst of (instanceData || [])) {
            inst.entity_id = denormalizeEntityId(inst.entity_id);
            const type = inst.entity_type;
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(inst.entity_id);
        }

        // 4. Fetch entities from each relevant table
        const entityMaps = {};

        // customer_onboarding → customers
        if (grouped.customer_onboarding?.length) {
            const { data, error } = await supabaseAdmin
                .from("customers")
                .select("*, branches(id, name), regions(id, name), created_by_user:created_by(full_name)")
                .in("id", grouped.customer_onboarding);
            if (error) console.error("Error fetching customers entity:", error);
            (data || []).forEach(r => { entityMaps[r.id] = r; });
        }

        // customer_edits → customer_phone_id_edit_requests
        if (grouped.customer_edits?.length) {
            const { data, error } = await supabaseAdmin
                .from("customer_phone_id_edit_requests")
                .select("*, customer:customers(Firstname, Middlename, Surname, mobile, branches(name)), created_by_user:users!created_by(full_name)")
                .in("id", grouped.customer_edits);
            if (error) console.error("Error fetching customer_edits entity:", error);
            (data || []).forEach(r => { entityMaps[r.id] = r; });
        }

        // customer_detail_edits → customer_detail_edit_requests
        if (grouped.customer_detail_edits?.length) {
            const { data, error } = await supabaseAdmin
                .from("customer_detail_edit_requests")
                .select("*, customer:customers(Firstname, Middlename, Surname, mobile, branches(name)), created_by_user:users!created_by(full_name)")
                .in("id", grouped.customer_detail_edits);
            if (error) console.error("Error fetching customer_detail_edits entity:", error);
            (data || []).forEach(r => { entityMaps[r.id] = r; });
        }

        // customer_transfer → customer_transfer_requests
        if (grouped.customer_transfer?.length) {
            const { data, error } = await supabaseAdmin
                .from("customer_transfer_requests")
                .select(`
                    *,
                    current_branch:current_branch_id(name),
                    new_branch:new_branch_id(name),
                    branch_manager:branch_manager_id(full_name),
                    transfer_items:customer_transfer_items(
                        customer:customer_id(*, branches(name))
                    )
                `)
                .in("id", grouped.customer_transfer);
            if (error) console.error("Error fetching customer_transfer entity:", error);
            (data || []).forEach(r => { entityMaps[r.id] = r; });
        }

        // 5. Enrich instances with entity data and authorization check
        const enriched = (instanceData || []).map(inst => {
            const allowedRoles = inst.workflow_nodes?.permissions?.roles || [];
            const isAuthorized = 
                user_role === "admin" || 
                user_role === "superadmin" || 
                allowedRoles.some(roleId => userRoleIds.includes(roleId));

            const entity = entityMaps[inst.entity_id] || null;
            return { 
                ...inst, 
                entity, 
                isAuthorized 
            };
        }).filter(i => i.entity);

        res.json({ success: true, data: enriched });
    } catch (err) {
        console.error("Error fetching pending approvals:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Save or Update a workflow ─────────────────────────────────────────────────
router.post("/save", verifySupabaseToken, async (req, res) => {
    const { id, name, type, nodes, edges, config = {} } = req.body;
    const tenant_id = req.user.tenant_id;

    // ─── Input Validation ────────────────────────────────────────────────────────
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ success: false, error: "Workflow name is required and must be a valid string" });
    }
    if (!type || typeof type !== 'string' || type.trim() === '') {
        return res.status(400).json({ success: false, error: "Workflow entity type is required" });
    }
    if (!Array.isArray(nodes) || nodes.length === 0) {
        return res.status(400).json({ success: false, error: "Workflow must contain at least one node" });
    }
    if (!Array.isArray(edges)) {
        return res.status(400).json({ success: false, error: "Workflow must contain an edges array (can be empty for single node)" });
    }

    // Validate nodes format to prevent database constraint or null pointer errors
    for (const n of nodes) {
        if (!n.id) {
            return res.status(400).json({ success: false, error: "All nodes must have a unique 'id'" });
        }
        if (!n.position || typeof n.position.x !== 'number' || typeof n.position.y !== 'number') {
            return res.status(400).json({ success: false, error: `Node "${n.data?.label || n.id}" has invalid or missing position coordinates` });
        }
    }

    // Validate edges format to prevent database constraint or null pointer errors
    for (const e of edges) {
        if (!e.id) {
            return res.status(400).json({ success: false, error: "All edges must have a unique 'id'" });
        }
        if (!e.source || !e.target) {
            return res.status(400).json({ success: false, error: "All edges must specify 'source' and 'target' nodes" });
        }
    }

    try {
        let workflow_id = id;

        // Use a transaction-like approach (manual rollback if needed or just sequential)
        if (workflow_id) {
            // Update existing definition
            const { error: defError } = await supabaseAdmin
                .from("workflow_definitions")
                .update({ name, type, config, updated_at: new Date() })
                .eq("id", workflow_id)
                .eq("tenant_id", tenant_id);

            if (defError) throw defError;

            // Delete old data (cascades handle most, but let's be explicit if needed)
            // workflow_conditions are child of edges, edges are child of definition
            // workflow_nodes are child of definition
            await supabaseAdmin.from("workflow_nodes").delete().eq("workflow_id", workflow_id);
        } else {
            // Create new definition
            const { data: def, error: defError } = await supabaseAdmin
                .from("workflow_definitions")
                .insert({ tenant_id, name, type, config, status: "active" })
                .select()
                .single();

            if (defError) throw defError;
            workflow_id = def.id;
        }

        // 1. Insert Nodes
        const nodesToInsert = nodes.map(n => ({
            workflow_id: workflow_id,
            node_client_id: n.id,
            type: n.type?.toUpperCase() || "APPROVAL",
            name: n.data?.label || n.id,
            description: n.data?.description || null,
            sla_timeout_minutes: n.data?.sla_timeout_minutes || null,
            escalation_node_id: n.data?.escalation_node_id || null,
            on_entry_actions: n.data?.on_entry_actions || [],
            permissions: n.data?.permissions || {},
            position_x: n.position.x,
            position_y: n.position.y,
        }));

        const { data: savedNodes, error: nodesError } = await supabaseAdmin
            .from("workflow_nodes")
            .insert(nodesToInsert)
            .select();

        if (nodesError) throw nodesError;

        // 2. Insert Edges & Conditions
        for (const e of edges) {
            // Fall back to source node roles if the edge doesn't specify roles explicitly
            const sourceNode = nodes.find(n => n.id === e.source);
            const sourceNodeRoles = sourceNode?.data?.permissions?.roles || [];
            
            let rolesAllowed = e.data?.roles_allowed || [];
            if (rolesAllowed.length === 0 && sourceNodeRoles.length > 0) {
                rolesAllowed = sourceNodeRoles;
            }

            const { data: savedEdge, error: edgeError } = await supabaseAdmin
                .from("workflow_edges")
                .insert({
                    workflow_id: workflow_id,
                    edge_client_id: e.id,
                    source_node_id: e.source,
                    target_node_id: e.target,
                    event: e.data?.event || "APPROVE",
                    roles_allowed: rolesAllowed,
                })
                .select()
                .single();

            if (edgeError) throw edgeError;

            // Insert conditions for this edge if they exist
            if (e.data?.conditions && Array.isArray(e.data.conditions) && e.data.conditions.length > 0) {
                const conditionsToInsert = e.data.conditions.map(c => ({
                    edge_id: savedEdge.id,
                    field: c.field,
                    operator: c.operator,
                    value: c.value
                }));

                const { error: condError } = await supabaseAdmin
                    .from("workflow_conditions")
                    .insert(conditionsToInsert);

                if (condError) throw condError;
            }
        }

        res.json({ success: true, message: "Workflow saved successfully", workflow_id });
    } catch (err) {
        console.error("❌ [Workflow Save Error]:", err);
        
        let friendlyMessage = err.message;
        
        // Handle unique constraint violations
        if (err.code === '23505') {
            if (err.constraint === 'workflow_definitions_tenant_id_name_type_version_key' || 
                err.message.includes('workflow_definitions_tenant_id_name_type_version_key')) {
                friendlyMessage = `A workflow named "${name}" already exists for this type (${type.replace(/_/g, ' ')}) in your organization. Please provide a unique name or update the version.`;
            } else {
                friendlyMessage = "A record with these details already exists in the system.";
            }
        } else if (err.code === 'PGRST204') {
            friendlyMessage = "Database schema mismatch: The system is missing the 'config' column. Please run the required database migrations.";
        }

        res.status(err.code === '23505' ? 409 : 500).json({
            success: false,
            error: friendlyMessage,
            details: process.env.NODE_ENV === 'development' ? err.details : null,
        });
    }
});

// ─── Load a workflow graph (for the builder) ──────────────────────────────────
router.get("/:id/graph", verifySupabaseToken, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: def, error: defError } = await supabaseAdmin
            .from("workflow_definitions")
            .select("*")
            .eq("id", id)
            .single();

        if (defError) throw defError;

        const { data: nodes, error: nodesError } = await supabaseAdmin
            .from("workflow_nodes")
            .select("*")
            .eq("workflow_id", id);

        if (nodesError) throw nodesError;

        const { data: edges, error: edgesError } = await supabaseAdmin
            .from("workflow_edges")
            .select(`
                *,
                workflow_conditions(*)
            `)
            .eq("workflow_id", id);

        if (edgesError) throw edgesError;

        res.json({ success: true, data: { def, nodes, edges } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Start a workflow instance ────────────────────────────────────────────────
router.post("/start", verifySupabaseToken, async (req, res) => {
    const { workflow_type, entity_id, entity_type, initial_context = {} } = req.body;
    try {
        const instance = await startWorkflow(
            req.user.tenant_id,
            workflow_type,
            entity_id,
            entity_type,
            req.user.id,
            initial_context
        );
        res.json({ success: true, instance });
    } catch (err) {
        console.error(`❌ [Workflow Start Error] Type: ${workflow_type}, Entity: ${entity_id}:`, err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// ─── Perform a workflow action ────────────────────────────────────────────────
router.post("/action", verifySupabaseToken, async (req, res) => {
    const { instance_id, event, comments, updated_context = {} } = req.body;
    
    // Construct user roles array from the authenticated user's single role details
    const user_roles = [];
    if (req.user.role_id) user_roles.push(req.user.role_id);
    if (req.user.role) user_roles.push(req.user.role);

    try {
        const updated = await performAction(
            instance_id,
            req.user.id,
            user_roles,
            event,
            comments,
            updated_context
        );

        // Fetch target node info to return to client (useful for UI transitions)
        const { data: node } = await supabaseAdmin
            .from("workflow_nodes")
            .select("*")
            .eq("id", updated.current_node_id)
            .single();

        res.json({ success: true, instance: updated, nextNode: node || null });
    } catch (err) {
        console.error(`❌ [Workflow Action Error] Instance: ${instance_id}, Event: ${event}:`, err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// ─── Get instance status, history, and available actions ─────────────────────
router.get("/status/:entity_type/:entity_id", verifySupabaseToken, async (req, res) => {
    const { entity_id, entity_type } = req.params;
    try {
        const normalizedEntityId = normalizeEntityId(entity_id);
        const { data: instance, error } = await supabaseAdmin
            .from("workflow_instances")
            .select(`
                *,
                workflow_nodes(*),
                workflow_instance_history(*)
            `)
            .eq("entity_id", normalizedEntityId)
            .eq("entity_type", entity_type)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== "PGRST116") throw error;

        if (!instance) {
            return res.json({ success: true, data: null });
        }

        instance.entity_id = denormalizeEntityId(instance.entity_id);
        instance.overall_status = instance.status;

        // Get available actions for the current node
        const { data: actions, error: actionsError } = await supabaseAdmin
            .from("workflow_edges")
            .select(`
                *,
                workflow_conditions(*)
            `)
            .eq("source_node_id", instance.workflow_nodes?.node_client_id)
            .eq("workflow_id", instance.workflow_id);

        if (actionsError) throw actionsError;

        // History with full node details
        const { data: history, error: historyError } = await supabaseAdmin
            .from("workflow_instance_history")
            .select(`
                *,
                from_node:workflow_nodes!workflow_instance_history_from_node_id_fkey(*),
                to_node:workflow_nodes!workflow_instance_history_to_node_id_fkey(*)
            `)
            .eq("instance_id", instance.id)
            .order("created_at", { ascending: true });

        res.json({
            success: true,
            data: {
                instance,
                currentNode: instance.workflow_nodes,
                actions,
                history: history || [],
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Delete a workflow ────────────────────────────────────────────────────────
router.delete("/:id", verifySupabaseToken, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Delete associated workflow instances first because of ON DELETE RESTRICT
        const { error: instError } = await supabaseAdmin
            .from("workflow_instances")
            .delete()
            .eq("workflow_id", id)
            .eq("tenant_id", req.user.tenant_id);

        if (instError) throw instError;

        // 2. Now delete the workflow definition
        const { error: defError } = await supabaseAdmin
            .from("workflow_definitions")
            .delete()
            .eq("id", id)
            .eq("tenant_id", req.user.tenant_id);

        if (defError) throw defError;
        res.json({ success: true, message: "Workflow deleted successfully" });
    } catch (err) {
        console.error("❌ [Workflow Delete Error]:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;

