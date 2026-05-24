import { supabaseAdmin } from "./supabaseClient.js";

async function run() {
  try {
    const res = await supabaseAdmin.rpc("execute_sql", {
      sql_query: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'users';"
    });
    console.log("=== USERS COLUMNS ===");
    console.log(res.data);
    if (res.error) console.error("Error:", res.error);
  } catch (err) {
    console.error(err);
  }
}
run();
