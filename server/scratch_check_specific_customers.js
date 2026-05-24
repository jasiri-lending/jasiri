import { supabaseAdmin } from "./supabaseClient.js";

async function run() {
  try {
    const ids = [217, 218];
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("*, branches(id, name), regions(id, name), created_by_user:created_by(full_name)")
      .in("id", ids);

    console.log("Customers fetch result:", JSON.stringify(data, null, 2));
    console.log("Error:", error);

  } catch (err) {
    console.error(err);
  }
}
run();
