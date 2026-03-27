import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "jasiri_default_encryption_key_32ch";
const IV_LENGTH = 16;

function decrypt(text) {
  if (!text) return null;
  if (typeof text !== "string" || !text.includes(":")) return text;
  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    return `[DECRYPT-FAILED: ${err.message}]`;
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testKeys() {
  const tenantId = '96687e31-cde9-4822-94ed-e0207cf74283';
  const { data: config } = await supabase.from('tenant_mpesa_config').select('*').eq('tenant_id', tenantId).eq('service_type', 'c2b').single();
  
  if (!config) { console.log("No config found"); return; }
  
  const key = decrypt(config.consumer_key);
  const secret = decrypt(config.consumer_secret);
  
  console.log(`Environment: ${config.environment}`);
  console.log(`Key Start: ${key.substring(0, 4)}... (Length: ${key.length})`);
  console.log(`Secret Start: ${secret.substring(0, 4)}... (Length: ${secret.length})`);
  
  const baseUrl = config.environment === 'production' 
     ? "https://api.safaricom.co.ke" 
     : "https://sandbox.safaricom.co.ke";
     
  try {
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const res = await axios.get(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    console.log("SUCCESS! Token received.");
  } catch (err) {
    console.log(`FAILURE: Status ${err.response?.status} - ${JSON.stringify(err.response?.data || err.message)}`);
  }
}

testKeys();
