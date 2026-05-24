import { supabaseAdmin } from "./supabaseClient.js";

async function inspect() {
    console.log("=== INSPECTING WORKFLOWS FOR TENANT e06aef07-f29a-4dff-816f-948a5352050e ===");
    
    const { data: wfs, error } = await supabaseAdmin
        .from("workflow_definitions")
        .select("*")
        .eq("tenant_id", "e06aef07-f29a-4dff-816f-948a5352050e");
        
    if (error) {
        console.error("Error fetching definitions:", error);
        return;
    }
    
    console.log(`Found ${wfs.length} workflows.`);
    for (const wf of wfs) {
        console.log(`\n--- Workflow: ${wf.name} (${wf.type}) [Status: ${wf.status}] ID: ${wf.id} ---`);
        
        const { data: nodes } = await supabaseAdmin
            .from("workflow_nodes")
            .select("*")
            .eq("workflow_id", wf.id);
            
        console.log("Nodes:");
        for (const n of (nodes || [])) {
            console.log(`  - Node: ${n.node_client_id} (${n.name}) Type: ${n.type} Roles Allowed:`, n.permissions?.roles || n.permissions);
        }
        
        const { data: edges } = await supabaseAdmin
            .from("workflow_edges")
            .select("*")
            .eq("workflow_id", wf.id);
            
        console.log("Edges:");
        for (const e of (edges || [])) {
            console.log(`  - Edge: ${e.edge_client_id}: ${e.source_node_id} -> ${e.target_node_id} [Event: ${e.event}] Roles Allowed:`, e.roles_allowed);
        }
    }
}

inspect().then(() => process.exit(0)).catch(console.error);
