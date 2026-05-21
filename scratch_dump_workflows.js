import { supabaseAdmin } from "./server/supabaseClient.js";

async function dump() {
  try {
    const { data: defs, error: defsError } = await supabaseAdmin
      .from("workflow_definitions")
      .select("*");
    if (defsError) throw defsError;

    console.log("=== WORKFLOW DEFINITIONS ===");
    console.log(JSON.stringify(defs, null, 2));

    const { data: nodes, error: nodesError } = await supabaseAdmin
      .from("workflow_nodes")
      .select("*");
    if (nodesError) throw nodesError;

    console.log("\n=== WORKFLOW NODES ===");
    console.log(JSON.stringify(nodes, null, 2));

    const { data: edges, error: edgesError } = await supabaseAdmin
      .from("workflow_edges")
      .select("*");
    if (edgesError) throw edgesError;

    console.log("\n=== WORKFLOW EDGES ===");
    console.log(JSON.stringify(edges, null, 2));

  } catch (err) {
    console.error(err);
  }
}

dump();
