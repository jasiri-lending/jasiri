import { supabase } from "./supabaseClient.js";

async function run() {
  try {
    const email = "tastmaloba@gmail.com";
    const password = "Password123";

    console.log(`Trying to sign in as ${email}...`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error("❌ Sign in failed:", authError.message);
      
      // Let's try password as "Password123!" just in case
      console.log("Trying with Password123!...");
      const { data: authData2, error: authError2 } = await supabase.auth.signInWithPassword({
        email,
        password: "Password123!"
      });
      if (authError2) {
        console.error("❌ Sign in with Password123! also failed:", authError2.message);
        return;
      }
      console.log("✅ Sign in successful with Password123!!", authData2.user.email);
    } else {
      console.log("✅ Sign in successful!", authData.user.email);
    }

    // Now query workflow_instances using this authenticated client
    const { data: instances, error: instError } = await supabase
      .from("workflow_instances")
      .select(`
        *,
        workflow_nodes!current_node_id (*),
        workflow_definitions!workflow_id (*)
      `)
      .eq("tenant_id", "e06aef07-f29a-4dff-816f-948a5352050e")
      .eq("status", "in_progress");

    console.log("Authenticated instances data:", JSON.stringify(instances, null, 2));
    console.log("Error:", instError);

  } catch (err) {
    console.error(err);
  }
}
run();
