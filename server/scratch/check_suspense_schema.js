import { supabaseAdmin } from "../supabaseClient.js";

async function checkSchema() {
  const { data, error } = await supabaseAdmin
    .from('suspense_transactions')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching suspense_transactions:', error);
    process.exit(1);
  }

  console.log('Sample record keys:', Object.keys(data[0] || {}));
  process.exit(0);
}

checkSchema();
