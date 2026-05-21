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

// ─── Save or Update a workflow ─────────────────────────────────────────────────
router.post("/save", verifySupabaseToken, async (req, res) => {
    const { id, name, type, nodes, edges, config = {} } = req.body;
    const tenant_id = req.user.tenant_id;

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
            const { data: savedEdge, error: edgeError } = await supabaseAdmin
                .from("workflow_edges")
                .insert({
                    workflow_id: workflow_id,
                    edge_client_id: e.id,
                    source_node_id: e.source,
                    target_node_id: e.target,
                    event: e.data?.event || "APPROVE",
                    roles_allowed: e.data?.roles_allowed || [],
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
    const user_roles = req.user.roles || []; // Get roles from token/user object

    try {
        const updated = await performAction(
            instance_id,
            req.user.id,
            user_roles,
            event,
            comments,
            updated_context
        );
        res.json({ success: true, instance: updated });
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
        const { error } = await supabaseAdmin
            .from("workflow_definitions")
            .delete()
            .eq("id", id)
            .eq("tenant_id", req.user.tenant_id);

        if (error) throw error;
        res.json({ success: true, message: "Workflow deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;

