import "dotenv/config";
import router from "./routes/workflows.js";

async function run() {
  try {
    // Find the /pending route handler
    const layer = router.stack.find(l => l.route && l.route.path === "/pending");
    if (!layer) {
      console.error("❌ Route /pending not found in workflows router stack!");
      return;
    }
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;
    
    // Mock req and res
    const req = {
      user: {
        tenant_id: "e06aef07-f29a-4dff-816f-948a5352050e",
        role: "branch_manager",
        id: "2b291660-36c0-4eb7-8456-9d2e0c7816ba"
      }
    };

    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        console.log(`\n=== API RESPONSE (Status: ${this.statusCode}) ===`);
        console.log(JSON.stringify(data, null, 2));
      }
    };

    console.log("🚀 Executing /pending route handler with mock req...");
    await handler(req, res);

  } catch (err) {
    console.error("Execution error:", err);
  }
}

run();
