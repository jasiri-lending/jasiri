import "dotenv/config";
import { supabaseAdmin } from "./supabaseClient.js";

async function backfillUserRoleIds() {
  try {
    console.log("🔄 Fetching all users and roles from the database...");

    // 1. Fetch all users
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, full_name, email, role, tenant_id, role_id");

    if (usersError) throw usersError;

    // 2. Fetch all roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("roles")
      .select("id, name, tenant_id");

    if (rolesError) throw rolesError;

    console.log(`🔍 Found ${users.length} users and ${roles.length} roles.`);

    let updatedCount = 0;

    for (const user of users) {
      if (user.role_id) {
        console.log(`ℹ️ User "${user.full_name}" (${user.email}) already has role_id: ${user.role_id}`);
        continue;
      }

      if (!user.role) {
        console.warn(`⚠️ User "${user.full_name}" (${user.email}) has no role name specified.`);
        continue;
      }

      // Find matching role by name and tenant_id
      const matchingRole = roles.find(role => 
        role.name === user.role && 
        role.tenant_id === user.tenant_id
      );

      if (matchingRole) {
        console.log(`⚡ Updating user "${user.full_name}" (${user.role}) with matching role_id: ${matchingRole.id}`);
        
        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({ role_id: matchingRole.id })
          .eq("id", user.id);

        if (updateError) {
          console.error(`❌ Failed to update user ${user.id}:`, updateError.message);
        } else {
          updatedCount++;
        }
      } else {
        // Fallback: If tenant_id matches or is null, or look for matching system roles (like superadmin / admin in general)
        const systemRole = roles.find(role => role.name === user.role);
        if (systemRole) {
          console.log(`⚡ Updating user "${user.full_name}" (${user.role}) with system-wide matching role_id: ${systemRole.id}`);
          
          const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({ role_id: systemRole.id })
            .eq("id", user.id);

          if (updateError) {
            console.error(`❌ Failed to update user ${user.id}:`, updateError.message);
          } else {
            updatedCount++;
          }
        } else {
          console.warn(`⚠️ No matching role found in 'roles' table for user "${user.full_name}" (Role: ${user.role}, Tenant: ${user.tenant_id})`);
        }
      }
    }

    console.log(`\n✅ Completed backfill! Successfully updated ${updatedCount} users with correct role_id references in the database.`);

  } catch (err) {
    console.error("💥 Backfill failed with error:", err);
  }
}

backfillUserRoleIds();
