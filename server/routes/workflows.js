import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { startWorkflow, performAction } from "../services/workflowEngine.js";
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
    const { id, name, type, nodes, edges, roles } = req.body;
    const tenant_id = req.user.tenant_id;

    try {
        let workflow_id = id;

        if (workflow_id) {
            // Update existing definition
            const { error: defError } = await supabaseAdmin
                .from("workflow_definitions")
                .update({ name, type })
                .eq("id", workflow_id)
                .eq("tenant_id", tenant_id);

            if (defError) throw defError;

            // Delete old nodes (cascades to edges and node_roles via DB constraints)
            await supabaseAdmin
                .from("workflow_nodes")
                .delete()
                .eq("workflow_id", workflow_id);
        } else {
            // Create new definition
            const { data: def, error: defError } = await supabaseAdmin
                .from("workflow_definitions")
                .insert({ tenant_id, name, type, status: "active" })
                .select()
                .single();

            if (defError) throw defError;
            workflow_id = def.id;
        }

        // Insert Nodes
        const nodesToInsert = nodes.map(n => ({
            workflow_id: workflow_id,
            node_client_id: n.id,
            type: n.data?.type || n.type?.toUpperCase() || "APPROVAL",
            name: n.data?.label || n.id,
            position_x: n.position.x,
            position_y: n.position.y,
            required_permission_id: n.data?.required_permission_id || n.required_permission_id || null,
        }));

        const { data: savedNodes, error: nodesError } = await supabaseAdmin
            .from("workflow_nodes")
            .insert(nodesToInsert)
            .select();

        if (nodesError) throw nodesError;

        // Map client IDs to DB IDs
        const nodeMap = {};
        savedNodes.forEach(n => (nodeMap[n.node_client_id] = n.id));

        // Insert Node Roles
        if (roles && roles.length > 0) {
            const rolesToInsert = [];
            roles.forEach(r => {
                if (nodeMap[r.node_id]) {
                    rolesToInsert.push({
                        node_id: nodeMap[r.node_id],
                        role_id: r.role_id,
                    });
                }
            });
            if (rolesToInsert.length > 0) {
                const { error: rolesError } = await supabaseAdmin
                    .from("workflow_node_roles")
                    .insert(rolesToInsert);
                if (rolesError) throw rolesError;
            }
        }

        // Insert Edges
        const edgesToInsert = edges.map(e => ({
            workflow_id: workflow_id,
            edge_client_id: e.id,
            source_node_id: e.source,
            target_node_id: e.target,
            action_type: e.data?.action || "approve",
        }));

        const { error: edgesError } = await supabaseAdmin
            .from("workflow_edges")
            .insert(edgesToInsert);

        if (edgesError) throw edgesError;

        res.json({ success: true, message: "Workflow saved successfully", workflow_id });
    } catch (err) {
        console.error("❌ [Workflow Save Error]:", err);
        res.status(500).json({
            success: false,
            error: err.message,
            details: err.details || err.hint || null,
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
            .select("*, workflow_node_roles(role_id)")
            .eq("workflow_id", id);

        if (nodesError) throw nodesError;

        const { data: edges, error: edgesError } = await supabaseAdmin
            .from("workflow_edges")
            .select("*")
            .eq("workflow_id", id);

        if (edgesError) throw edgesError;

        res.json({ success: true, data: { def, nodes, edges } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Start a workflow instance ────────────────────────────────────────────────
router.post("/start", verifySupabaseToken, async (req, res) => {
    const { workflow_type, entity_id, entity_type, user_roles = [] } = req.body;
    try {
        const instance = await startWorkflow(
            req.user.tenant_id,
            workflow_type,
            entity_id,
            entity_type,
            req.user.id,
            user_roles
        );
        res.json({ success: true, instance });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ─── Perform a workflow action ────────────────────────────────────────────────
router.post("/action", verifySupabaseToken, async (req, res) => {
    const { instance_id, action_type, comments } = req.body;
    const user_roles = req.body.user_roles || [];

    try {
        const updated = await performAction(
            instance_id,
            req.user.id,
            user_roles,
            action_type,
            comments
        );
        res.json({ success: true, instance: updated });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// ─── Get instance status, history, and available actions ─────────────────────
router.get("/status/:entity_type/:entity_id", verifySupabaseToken, async (req, res) => {
    const { entity_id, entity_type } = req.params;
    try {
        const { data: instance, error } = await supabaseAdmin
            .from("workflow_instances")
            .select(`
                *,
                workflow_nodes(*),
                workflow_instance_history(*)
            `)
            .eq("entity_id", entity_id)
            .eq("entity_type", entity_type)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== "PGRST116") throw error;

        if (!instance) {
            return res.json({ success: true, data: null });
        }

        // Get available actions for the current node
        const { data: actions, error: actionsError } = await supabaseAdmin
            .from("workflow_edges")
            .select("*")
            .eq("source_node_id", instance.workflow_nodes?.node_client_id)
            .eq("workflow_id", instance.workflow_id);

        if (actionsError) throw actionsError;

        // Get required roles for the current node
        const { data: nodeRoles, error: rolesError } = await supabaseAdmin
            .from("workflow_node_roles")
            .select(`
                *,
                roles(id, name)
            `)
            .eq("node_id", instance.current_node_id);

        if (rolesError) throw rolesError;

        // Get the specific permission required for this node
        let requiredPermission = null;
        if (instance.workflow_nodes?.required_permission_id) {
            const { data: permData } = await supabaseAdmin
                .from("permissions")
                .select("*")
                .eq("id", instance.workflow_nodes.required_permission_id)
                .single();
            requiredPermission = permData;
        }

        res.json({
            success: true,
            data: {
                instance,
                currentNode: instance.workflow_nodes,
                actions,
                nodeRoles,
                requiredPermission,
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
