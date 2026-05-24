import "dotenv/config";
import { supabaseAdmin } from "./supabaseClient.js";

async function inspectUser() {
  const userId = "c979f853-12cf-4e76-a856-4a17a2275388";
  try {
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) throw error;

    console.log("=== USER DETAILS ===");
    console.log(JSON.stringify(user, null, 2));

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("roles")
      .select("*");
    
    if (rolesError) throw rolesError;

    console.log("\n=== ALL ROLES ===");
    console.log(JSON.stringify(roles.map(r => ({ id: r.id, name: r.name, tenant_id: r.tenant_id })), null, 2));

  } catch (err) {
    console.error("Error inspecting user:", err);
  }
}

inspectUser();
