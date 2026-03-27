import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function forceUpdate() {
  const tenantId = '96687e31-cde9-4822-94ed-e0207cf74283';
  const renderBase = 'https://jasiri-backend.onrender.com';
  
  console.log(`Force updating C2B for tenant ${tenantId}...`);
  
  const { data, error } = await supabase
    .from('tenant_mpesa_config')
    .update({
       confirmation_url: `${renderBase}/mpesa/c2b/confirmation`,
       validation_url: `${renderBase}/mpesa/c2b/validation`,
       callback_url: renderBase
    })
    .eq('tenant_id', tenantId)
    .eq('service_type', 'c2b')
    .select();
    
  if (error) {
    console.error('Update failed:', error);
  } else {
    console.log('Update successful:', data);
  }
}

forceUpdate();
