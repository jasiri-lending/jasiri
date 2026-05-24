import { supabaseAdmin } from "./server/supabaseClient.js";

async function backfill() {
  try {
    console.log("🔄 Fetching all workflow nodes and edges...");
    
    // 1. Fetch all nodes
    const { data: nodes, error: nodesError } = await supabaseAdmin
      .from("workflow_nodes")
      .select("id, workflow_id, node_client_id, permissions");
    
    if (nodesError) throw nodesError;

    // 2. Fetch all edges
    const { data: edges, error: edgesError } = await supabaseAdmin
      .from("workflow_edges")
      .select("id, workflow_id, edge_client_id, source_node_id, target_node_id, roles_allowed");
      
    if (edgesError) throw edgesError;

    console.log(`🔍 Found ${nodes.length} nodes and ${edges.length} edges.`);
    
    let backfillCount = 0;

    for (const edge of edges) {
      // Find the source node for this edge
      const sourceNode = nodes.find(n => 
        n.workflow_id === edge.workflow_id && 
        n.node_client_id === edge.source_node_id
      );

      if (!sourceNode) {
        console.warn(`⚠️ Could not find source node for edge ${edge.id} (source_node_id: ${edge.source_node_id})`);
        continue;
      }

      // Parse permissions/roles from the source node
      let perms = sourceNode.permissions;
      if (typeof perms === "string") {
        try { perms = JSON.parse(perms); } catch (e) {}
      }

      const sourceNodeRoles = perms?.roles || [];

      // If edge roles_allowed is empty but the source node has roles, update the edge!
      const edgeRoles = edge.roles_allowed || [];
      if (edgeRoles.length === 0 && sourceNodeRoles.length > 0) {
        console.log(`⚡ Backfilling edge ${edge.id} (${edge.source_node_id} -> ${edge.target_node_id}) with roles:`, sourceNodeRoles);
        
        const { error: updateError } = await supabaseAdmin
          .from("workflow_edges")
          .update({ roles_allowed: sourceNodeRoles })
          .eq("id", edge.id);

        if (updateError) {
          console.error(`❌ Failed to update edge ${edge.id}:`, updateError.message);
        } else {
          backfillCount++;
        }
      }
    }

    console.log(`✅ Completed backfill! Updated ${backfillCount} edges with correct roles in the database.`);

  } catch (err) {
    console.error("💥 Backfill failed with error:", err);
  }
}

backfill();
