import { supabaseAdmin } from "./supabaseClient.js";

async function run() {
  try {
    console.log("--- WORKFLOW INSTANCES ---");
    const { data: instances, error: instError } = await supabaseAdmin
      .from("workflow_instances")
      .select(`
        *,
        workflow_nodes!current_node_id (*),
        workflow_definitions!workflow_id (*)
      `);
    console.log("Instances:", JSON.stringify(instances, null, 2));

  } catch (err) {
    console.error("Execution failed:", err);
  }
}

run();
