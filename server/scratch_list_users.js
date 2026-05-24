import { supabaseAdmin } from "./supabaseClient.js";

async function run() {
  try {
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, email, role, tenant_id, status");
    if (error) throw error;
    console.log("Users:", JSON.stringify(users, null, 2));
  } catch (err) {
    console.error(err);
  }
}
run();
