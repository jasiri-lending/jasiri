import { startWorkflow } from "./services/workflowEngine.js";

async function test() {
  const tenantId = "e06aef07-f29a-4dff-816f-948a5352050e";
  const customerId = "213"; // latest customer ID from previous check
  const userId = "a6a57564-9a88-4fa3-80b6-20cf56372579"; // we can use any active user ID or profile ID

  try {
    console.log(`Starting workflow for tenant ${tenantId}, customer ${customerId}...`);
    const instance = await startWorkflow(
      tenantId,
      "customer_onboarding",
      customerId,
      "customer_onboarding",
      userId,
      {}
    );
    console.log("Success! Instance created:", instance);
  } catch (err) {
    console.error("❌ Error starting workflow:", err.message);
    if (err.stack) console.error(err.stack);
  }
}

test();
