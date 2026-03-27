import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkConfig() {
  const { data, error } = await supabase
    .from('tenant_mpesa_config')
    .select('*')
    .eq('is_active', true);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  data.forEach(row => {
    console.log(`Tenant: ${row.tenant_id}`);
    console.log(`Paybill: ${row.paybill_number}`);
    console.log(`Till: ${row.till_number}`);
    console.log(`Shortcode: ${row.shortcode}`);
    console.log(`Service: ${row.service_type}`);
    console.log(`Env: ${row.environment}`);
    console.log(`Conf URL: ${row.confirmation_url}`);
    console.log(`Val URL: ${row.validation_url}`);
    console.log('---');
  });
}

checkConfig();
