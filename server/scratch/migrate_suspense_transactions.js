import { supabaseAdmin } from "../supabaseClient.js";

async function runMigration() {
  console.log("Starting migration for suspense_transactions...");

  const columns = [
    { name: 'reconciled_by', type: 'uuid', references: 'users(id)' },
    { name: 'proposed_customer_id', type: 'int8', references: 'customers(id)' },
    { name: 'approved_by', type: 'uuid', references: 'users(id)' },
    { name: 'reconciliation_note', type: 'text' }
  ];

  for (const col of columns) {
    try {
      console.log(`Adding column ${col.name}...`);
      const { error } = await supabaseAdmin.rpc('execute_sql', {
        sql_query: `ALTER TABLE suspense_transactions ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} ${col.references ? `REFERENCES ${col.references}` : ''};`
      });

      if (error) {
        // If RPC fails, we might need another way or it might already exist
        console.warn(`Could not add column ${col.name} via RPC: ${error.message}`);
      } else {
        console.log(`Column ${col.name} added successfully.`);
      }
    } catch (err) {
      console.error(`Error adding column ${col.name}:`, err);
    }
  }

  // Also update status to include 'pending_approval' if it doesn't support it (though status is currently TEXT)
  console.log("Migration finished.");
}

runMigration();
