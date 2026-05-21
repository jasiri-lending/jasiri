import { supabaseAdmin } from "./supabaseClient.js";

async function dump() {
  try {
    console.log("-----------------------------------------");
    console.log("1. FETCHING ACTIVE WORKFLOW DEFINITIONS");
    const { data: defs, error: defsErr } = await supabaseAdmin
      .from("workflow_definitions")
      .select("*");
    if (defsErr) throw defsErr;
    console.log(JSON.stringify(defs, null, 2));

    console.log("-----------------------------------------");
    console.log("2. FETCHING WORKFLOW NODES");
    const { data: nodes, error: nodesErr } = await supabaseAdmin
      .from("workflow_nodes")
      .select("*");
    if (nodesErr) throw nodesErr;
    console.log(JSON.stringify(nodes, null, 2));

    console.log("-----------------------------------------");
    console.log("3. FETCHING WORKFLOW EDGES");
    const { data: edges, error: edgesErr } = await supabaseAdmin
      .from("workflow_edges")
      .select("*");
    if (edgesErr) throw edgesErr;
    console.log(JSON.stringify(edges, null, 2));

    console.log("-----------------------------------------");
    console.log("4. FETCHING WORKFLOW INSTANCES");
    const { data: insts, error: instsErr } = await supabaseAdmin
      .from("workflow_instances")
      .select("*");
    if (instsErr) throw instsErr;
    console.log(JSON.stringify(insts, null, 2));

    console.log("-----------------------------------------");
    console.log("5. FETCHING ROLES");
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("roles")
      .select("*");
    if (rolesErr) throw rolesErr;
    console.log(JSON.stringify(roles, null, 2));

    console.log("-----------------------------------------");
    console.log("6. FETCHING LATEST CUSTOMERS");
    const { data: custs, error: custsErr } = await supabaseAdmin
      .from("customers")
      .select("id, Firstname, Surname, status, form_status, created_at")
      .order("created_at", { ascending: false })
      .limit(3);
    if (custsErr) throw custsErr;
    console.log(JSON.stringify(custs, null, 2));

  } catch (err) {
    console.error("Error in dump script:", err);
  }
}

dump();
