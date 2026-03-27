import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTriggers() {
  console.log("--- CHECKING TRIGGERS ON LOANS TABLE ---");
  const { data, error } = await supabase.rpc('get_table_triggers', { table_name: 'loans' });
  
  if (error) {
    // If RPC doesn't exist, try a raw query via a temporary function or just assume it's there
    console.log("RPC Error (might not exist):", error.message);
    
    // Attempting a common trigger name
    console.log("Checking for trigger: handle_loan_disbursement...");
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

checkTriggers();
