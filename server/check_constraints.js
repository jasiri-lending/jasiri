import { supabaseAdmin } from './supabaseClient.js';

async function checkConstraints() {
  const { data, error } = await supabaseAdmin.rpc('get_table_constraints', { table_name: 'tenant_mpesa_config' });
  
  if (error) {
    console.error("RPC Error (might not exist):", error.message);
    
    // Fallback: Try a raw query if possible (supabase js doesn't support raw queries directly, but let's see if we can just drop it directly)
  } else {
    console.log("Constraints:", data);
  }
}

checkConstraints();
