import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runSQL() {
  const permissions = [
    { resource: 'journal', name: 'journal.create', description: 'Create Journal Entries', action: 'journal.create' },
    { resource: 'journal', name: 'journal.approve', description: 'Approve or Reject Journal Entries', action: 'journal.approve' }
  ];

  for (const perm of permissions) {
    const { error } = await supabaseAdmin
      .from('permissions')
      .upsert(perm, { onConflict: 'name' });
    
    if (error) {
      console.error(`Error upserting ${perm.name}:`, error);
    } else {
      console.log(`Successfully upserted ${perm.name}`);
    }
  }
}

runSQL();
