import "dotenv/config";
import { supabaseAdmin } from "./supabaseClient.js";

// Simulates what processUserCreation now does before inserting a user.
async function testRoleResolution() {
  try {
    // Fetch a sample of tenants
    const { data: tenants, error: tErr } = await supabaseAdmin
      .from("tenants")
      .select("id, company_name")
      .limit(5);
    if (tErr) throw tErr;

    console.log(`\n🔍 Testing role resolution for ${tenants.length} tenants...\n`);

    const testRoles = ["relationship_officer", "admin", "credit_analyst_officer", "branch_manager"];

    for (const tenant of tenants) {
      console.log(`\n📌 Tenant: ${tenant.company_name} (${tenant.id})`);
      for (const roleName of testRoles) {
        const { data: roleData } = await supabaseAdmin
          .from("roles")
          .select("id, name")
          .eq("tenant_id", tenant.id)
          .eq("name", roleName)
          .maybeSingle();

        if (roleData) {
          console.log(`  ✅ role="${roleName}" → role_id=${roleData.id}`);
        } else {
          console.log(`  ⚠️  role="${roleName}" → NO MATCH (role_id will be null)`);
        }
      }
    }

    console.log("\n✅ Test complete. Any ⚠️ entries mean that role doesn't exist in the roles table for that tenant.");
    console.log("   If a tenant lacks roles, they need to be created via POST /api/roles before creating users with those roles.\n");

  } catch (err) {
    console.error("💥 Test failed:", err);
  }
}

testRoleResolution();
