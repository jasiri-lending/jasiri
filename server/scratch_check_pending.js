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

    console.log("\n--- CUSTOMERS COUNT ---");
    const { count, error: custError } = await supabaseAdmin
      .from("customers")
      .select("*", { count: "exact", head: true });
    console.log("Customers Count:", count);

  } catch (err) {
    console.error("Execution failed:", err);
  }
}

run();

