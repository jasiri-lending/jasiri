import { supabaseAdmin } from "./supabaseClient.js";

async function check() {
  try {
    const res1 = await supabaseAdmin.rpc("execute_sql", {
      sql_query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
    });
    console.log("Tables result:", res1.data, "Error:", res1.error);

    const res2 = await supabaseAdmin.rpc("execute_sql", {
      sql_query: `
        SELECT
            tc.table_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('workflow_conditions', 'workflow_instance_history');
      `
    });
    console.log("Fks result:", res2.data, "Error:", res2.error);

    const res3 = await supabaseAdmin.rpc("execute_sql", {
      sql_query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'workflow_instance_history';"
    });
    console.log("Cols result:", res3.data, "Error:", res3.error);

  } catch (err) {
    console.error(err);
  }
}
check();
