import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkConfig() {
  const { data, error } = await supabase
    .from('tenant_mpesa_config')
    .select('*');
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('No M-Pesa configs found.');
    return;
  }

  console.log(`Found ${data.length} records.`);
  data.forEach(row => {
    console.log(`ID: ${row.id}`);
    console.log(`Tenant: ${row.tenant_id}`);
    console.log(`Active: ${row.is_active}`);
    console.log(`Service: ${row.service_type}`);
    console.log(`Paybill: ${row.paybill_number}`);
    console.log(`Conf URL: |${row.confirmation_url}|`);
    console.log(`Val URL: |${row.validation_url}|`);
    console.log(`Callback URL: |${row.callback_url}|`);
    console.log('---');
  });
}

checkConfig();
