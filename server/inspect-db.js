
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function inspectTable() {
  console.log("Inspecting tenant_mpesa_config table...");
  
  // Try to select one row to see columns
  const { data, error } = await supabaseAdmin
    .from("tenant_mpesa_config")
    .select("*")
    .limit(1);
  
  if (error) {
    console.error("Error fetching data from tenant_mpesa_config:", error.message);
  } else {
    console.log("Table structure (sample row keys):", data.length > 0 ? Object.keys(data[0]) : "No data in table.");
    
    // Check if service_type exists
    if (data.length > 0 && !Object.keys(data[0]).includes("service_type")) {
        console.log("service_type column is MISSING.");
        
        // Try to add it via SQL if exec_sql exists
        console.log("Attempting to add service_type column...");
        const { error: alterError } = await supabaseAdmin.rpc('exec_sql', {
            sql_query: `
                ALTER TABLE public.tenant_mpesa_config ADD COLUMN IF NOT EXISTS service_type text DEFAULT 'c2b';
                -- Optionally, add a constraint for uniqueness
                -- ALTER TABLE public.tenant_mpesa_config DROP CONSTRAINT IF EXISTS tenant_mpesa_config_tenant_id_key;
                -- ALTER TABLE public.tenant_mpesa_config ADD CONSTRAINT tenant_mpesa_config_tenant_id_service_type_key UNIQUE (tenant_id, service_type);
            `
        });
        
        if (alterError) {
          console.error("Error adding column via exec_sql:", alterError.message);
        } else {
          console.log("Successfully added service_type column (if exec_sql is supported).");
        }
    } else if (data.length > 0) {
        console.log("service_type column already EXISTS.");
    }
  }
}

inspectTable();
