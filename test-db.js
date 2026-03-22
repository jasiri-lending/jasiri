
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndCreateTable() {
  console.log("Checking for scoring_rules table...");
  try {
    const { data, error } = await supabaseAdmin.from('scoring_rules').select('id').limit(1);
    
    if (error) {
      if (error.code === 'PGRST204' || error.message.includes('does not exist')) {
        console.log("Table scoring_rules does not exist. This is likely the cause of the 500 error.");
      } else {
        console.error("Error checking table:", error.message);
      }
    } else {
      console.log("Table scoring_rules exists.");
    }
  } catch (err) {
    console.error("Unexpected error:", err.message);
  }
}

checkAndCreateTable();
