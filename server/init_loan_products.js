import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
create table if not exists loan_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,

  product_name text not null,      -- Inuka
  product_code text not null,      -- INUKA (optional internal code)

  min_amount numeric(12,2) not null,
  max_amount numeric(12,2),

  created_at timestamp default now(),

  unique(tenant_id, product_name)
); 

create table if not exists loan_product_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  loan_product_id uuid references loan_products(id) on delete cascade,

  product_type text not null,         -- "Inuka - 5 Weeks"
  duration_weeks int not null,

  interest_rate numeric(5,2) not null,
  processing_fee_rate numeric(5,2) default 0,
  registration_fee numeric(5,2) default 0,
  penalty_rate numeric(5,2) default 0,

  created_at timestamp default now(),

  unique(loan_product_id, duration_weeks)
);
`;

async function run() {
    console.log("Running SQL...");
    const { error } = await supabase.rpc("exec_sql", { sql_query: sql });

    // If exec_sql RPC doesn't exist (common in some setups), we might need to rely on direct query if the client supports it, 
    // or just inform the user.
    // However, standard supabase-js doesn't run raw SQL without an RPC wrapper.
    // Let's try to simulate it or use a standardized way if this fails.
    // Since I don't know if 'exec_sql' exists, I'll log the error. 
    // Often direct SQL execution is restricted. 
    // As a fallback for this environment, I will print the SQL and ask the user or just assume I need to guide them 
    // but wait, I can try to use the 'postgres' library if available or just check if I can insert directly.

    if (error) {
        console.error("RPC Error:", error);
        console.log("---------------------------------------------------");
        console.log("If 'exec_sql' function is missing, please run this SQL in Supabase SQL Editor:");
        console.log(sql);
    } else {
        console.log("Tables created successfully (via RPC)!");
    }
}

// Since we cannot easily verify if RPC exists without running, and we want to be helpful:
// I'll actually just try to create a test record or something, but 'create table' involves DDL.
// Supabase-js data client cannot do DDL.
// So I will output the SQL instruction for the user to run in their dashboard if I can't do it.
// BUT, I'll try to use the pg driver if node_modules has it. 
// Let's stick to the RPC attempt, and if it fails, I'll display the SQL.

run();
