import { supabaseAdmin } from "./supabaseClient.js";

async function checkTables() {
    const tables = ['roles', 'permissions', 'role_permissions', 'groups', 'user_groups', 'group_roles'];
    for (const table of tables) {
        const { error } = await supabaseAdmin.from(table).select('*').limit(1);
        if (error) {
            console.log(`❌ Table ${table} error or missing: ${error.message}`);
        } else {
            console.log(`✅ Table ${table} exists.`);
        }
    }
}

checkTables();
