import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function migrate() {
  console.log("🚀 Starting migration: Adding report_password to tenants...");
  
  const { error } = await supabase.rpc('execute_sql', {
    sql_query: "ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS report_password TEXT;"
  });

  if (error) {
    console.error("❌ Migration failed:", error);
    if (error.message.includes("function execute_sql(text) does not exist")) {
      console.log("💡 Tip: You may need to create the 'execute_sql' RPC function in your Supabase dashboard first, or manually run the SQL:");
      console.log("   ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS report_password TEXT;");
    }
  } else {
    console.log("✅ Migration successful: report_password column added to tenants.");
  }
}

migrate();
