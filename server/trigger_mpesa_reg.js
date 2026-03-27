import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { decrypt } from './utils/encryption.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Mocking mpesa logic locally for the script
async function getMpesaToken(consumerKey, consumerSecret, env) {
  const baseUrl = env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const res = await axios.get(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }
  });
  return res.data.access_token;
}

async function registerUrls() {
  const tenantId = '96687e31-cde9-4822-94ed-e0207cf74283';
  
  const { data: config, error } = await supabase
    .from('tenant_mpesa_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('service_type', 'c2b')
    .single();
    
  if (error || !config) {
    console.error('Config not found:', error);
    return;
  }

  const consumerKey = decrypt(config.consumer_key);
  const consumerSecret = decrypt(config.consumer_secret);
  
  console.log(`Getting token for ${config.environment}...`);
  const token = await getMpesaToken(consumerKey, consumerSecret, config.environment);
  
  const baseUrl = config.environment === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  
  console.log(`Registering URLs for shortcode ${config.paybill_number}...`);
  const regRes = await axios.post(`${baseUrl}/mpesa/c2b/v1/registerurl`, {
    ShortCode: config.paybill_number,
    ResponseType: 'Completed',
    ConfirmationURL: config.confirmation_url,
    ValidationURL: config.validation_url
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  console.log('Registration Response:', regRes.data);
}

registerUrls().catch(err => console.error(err.response?.data || err.message));
