import { supabaseAdmin } from "./supabaseClient.js";

async function check() {
  try {
    const res1 = await supabaseAdmin.from("workflow_conditions").select("*").limit(1);
    console.log("workflow_conditions query:", res1.data, "Error:", res1.error);

    const res2 = await supabaseAdmin.from("workflow_edges").select("*").limit(1);
    console.log("workflow_edges query:", res2.data, "Error:", res2.error);

    const res3 = await supabaseAdmin.from("workflow_instance_history").select("*").limit(1);
    console.log("workflow_instance_history query:", res3.data, "Error:", res3.error);

  } catch (err) {
    console.error(err);
  }
}
check();
