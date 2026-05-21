import { supabaseAdmin } from "./supabaseClient.js";

async function debug() {
  const workflowId = "a692c952-9d2d-40ac-83e1-1d33f7361a1b";
  try {
    const { data: nodes } = await supabaseAdmin
      .from("workflow_nodes")
      .select("*")
      .eq("workflow_id", workflowId);

    const { data: edges } = await supabaseAdmin
      .from("workflow_edges")
      .select("*")
      .eq("workflow_id", workflowId);

    console.log("=== NODES ===");
    console.log(nodes.map(n => ({ id: n.id, client_id: n.node_client_id, type: n.type, name: n.name })));

    console.log("=== EDGES ===");
    console.log(edges.map(e => ({ id: e.id, source: e.source_node_id, target: e.target_node_id, event: e.event, action: e.action_type })));

  } catch (err) {
    console.error(err);
  }
}
debug();
