import { supabaseAdmin } from "./supabaseClient.js";

async function run() {
  const sql = `
    ALTER TABLE public.workflow_instances DROP CONSTRAINT IF EXISTS workflow_instances_tenant_entity_unique;
    ALTER TABLE public.workflow_instances ALTER COLUMN entity_id TYPE text;
    ALTER TABLE public.workflow_instances ADD CONSTRAINT workflow_instances_tenant_entity_unique UNIQUE (tenant_id, entity_type, entity_id);
  `;
  
  console.log("Running SQL migration via execute_sql RPC...");
  try {
    const { data, error } = await supabaseAdmin.rpc("execute_sql", {
      sql_query: sql
    });
    if (error) throw error;
    console.log("✅ Migration successful!", data);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  }
}

run();
