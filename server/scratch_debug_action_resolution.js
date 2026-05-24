import "dotenv/config";
import { supabaseAdmin } from "./supabaseClient.js";
import { performAction } from "./services/workflowEngine.js";

async function testAction() {
  const userId = "c979f853-12cf-4e76-a856-4a17a2275388";
  const instanceId = "06776b4a-e48e-45b1-a067-9a0045429ac2";
  const event = "SUBMIT";
  
  try {
    // 1. Fetch user to simulate what authMiddleware does
    const { data: userData, error: dbError } = await supabaseAdmin
        .from("users")
        .select("id, email, role, role_id, tenant_id")
        .eq("id", userId)
        .single();

    if (dbError) throw dbError;

    // Simulate authMiddleware role resolution
    let resolvedRoleId = userData.role_id;
    if (!resolvedRoleId && userData.role && userData.tenant_id) {
        const { data: rData } = await supabaseAdmin
            .from("roles")
            .select("id")
            .eq("tenant_id", userData.tenant_id)
            .eq("name", userData.role)
            .maybeSingle();
        if (rData) {
            resolvedRoleId = rData.id;
        }
    }

    const user = {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        role_id: resolvedRoleId,
        tenant_id: userData.tenant_id,
    };

    console.log("Simulated req.user:", user);

    // Construct user roles array as in workflows.js
    const user_roles = [];
    if (user.role_id) user_roles.push(user.role_id);
    if (user.role) user_roles.push(user.role);

    console.log("Constructed user_roles for action:", user_roles);

    // 2. Perform the action
    const updated = await performAction(
        instanceId,
        user.id,
        user_roles,
        event,
        "Submitting customer via debug test script",
        {}
    );

    console.log("Success! Updated workflow instance:", updated);

    // Verify history log
    const { data: history, error: historyError } = await supabaseAdmin
        .from("workflow_instance_history")
        .select("*")
        .eq("instance_id", instanceId)
        .order("created_at", { ascending: false })
        .limit(1);

    if (historyError) throw historyError;
    console.log("Latest history entry:", history[0]);

  } catch (err) {
    console.error("Test failed with error:", err);
  }
}

testAction();
