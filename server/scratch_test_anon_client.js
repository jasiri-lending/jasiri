import { supabase } from "./supabaseClient.js";

async function run() {
  try {
    console.log("--- TESTING ANON CLIENT QUERY ---");
    
    // Query workflow_instances
    const { data: instances, error: instError } = await supabase
      .from("workflow_instances")
      .select("*")
      .eq("tenant_id", "e06aef07-f29a-4dff-816f-948a5352050e")
      .eq("status", "in_progress");
      
    console.log("Anon instances data length:", instances?.length);
    console.log("Anon instances error:", instError);

    // Query roles
    const { data: roles, error: rolesError } = await supabase
      .from("roles")
      .select("*")
      .eq("tenant_id", "e06aef07-f29a-4dff-816f-948a5352050e");

    console.log("Anon roles data length:", roles?.length);
    console.log("Anon roles error:", rolesError);

    // Query customers
    const { data: customers, error: custError } = await supabase
      .from("customers")
      .select("*")
      .in("id", [217, 218]);

    console.log("Anon customers data length:", customers?.length);
    console.log("Anon customers error:", custError);

  } catch (err) {
    console.error(err);
  }
}
run();
