import { supabaseAdmin } from "./supabaseClient.js";

async function run() {
  try {
    const res = await supabaseAdmin.rpc("execute_sql", {
      sql_query: `
        SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
        FROM pg_policies 
        WHERE tablename IN ('workflow_instances', 'workflow_nodes', 'workflow_definitions', 'roles', 'customers');
      `
    });

    console.log("Policies in DB:", JSON.stringify(res.data, null, 2));
    console.log("Error:", res.error);

  } catch (err) {
    console.error(err);
  }
}
run();
