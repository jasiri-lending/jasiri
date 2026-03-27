import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSmsSettings() {
  const tenantId = '96687e31-cde9-4822-94ed-e0207cf74283';
  console.log(`--- Checking SMS Settings for Tenant ${tenantId} ---`);
  
  const { data, error } = await supabase
    .from('tenant_sms_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
    
  if (error) {
    console.error('Error fetching SMS settings:', error.message);
    return;
  }
  
  if (!data) {
    console.log('No SMS settings found for this tenant.');
    return;
  }
  
  // Mask sensitive info
  const masked = {
    ...data,
    api_key: data.api_key ? data.api_key.substring(0, 4) + '...' : null,
    partner_id: data.partner_id
  };
  
  console.log('SMS Config (Masked):', JSON.stringify(masked, null, 2));
}

checkSmsSettings();
