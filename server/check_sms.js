import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSms() {
  const tenantId = '96687e31-cde9-4822-94ed-e0207cf74283';
  
  console.log("--- SMS CONFIG ---");
  const { data: config, error: cfgErr } = await supabase
    .from('tenant_sms_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();
    
  if (cfgErr) console.log("Config Error:", cfgErr.message);
  else console.log(JSON.stringify(config, null, 2));
  
  console.log("\n--- RECENT SMS LOGS ---");
  const { data: logs, error: logErr } = await supabase
    .from('sms_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (logErr) console.log("Log Error:", logErr.message);
  else console.log(JSON.stringify(logs, null, 2));
}

checkSms();
