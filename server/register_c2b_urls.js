/**
 * register_c2b_urls.js
 * Uses the server's own mpesaRequest service (proven to work for B2C)
 * to register C2B URLs with Safaricom.
 */
import "dotenv/config";
import { supabaseAdmin } from "./supabaseClient.js";
import { mpesaRequest } from "./services/mpesa.js";
import { getTenantConfig } from "./services/tenantResolver.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger({ service: "register_c2b" });

const TENANT_ID = "96687e31-cde9-4822-94ed-e0207cf74283";

console.log(`\n${"═".repeat(60)}`);
console.log("🔧  C2B URL Registration with Safaricom");
console.log(`    Tenant: ${TENANT_ID}`);
console.log(`${"═".repeat(60)}\n`);

try {
  // Load via the same getTenantConfig that the server uses everywhere
  const config = await getTenantConfig(TENANT_ID, "c2b");
  const shortcode = config.paybill_number || config.till_number || config.shortcode;

  console.log(`Config: shortcode=${shortcode} | env=${config.environment}`);
  console.log(`Confirmation: ${config.confirmation_url}`);
  console.log(`Validation:   ${config.validation_url}\n`);

  if (!config.confirmation_url || !config.validation_url) {
    throw new Error("confirmation_url or validation_url is empty in tenant_mpesa_config. Update them first.");
  }

  const payload = {
    ShortCode: shortcode,
    ResponseType: config.environment === "production" ? "Completed" : "Cancelled",
    ConfirmationURL: config.confirmation_url,
    ValidationURL: config.validation_url,
  };

  console.log("Registering with Safaricom...");
  const result = await mpesaRequest(config, "POST", "/mpesa/c2b/v1/registerurl", payload);
  
  console.log("\nSafaricom response:", JSON.stringify(result, null, 2));

  const success = result?.ResponseCode === "0"
    || result?.ResponseDescription?.toLowerCase().includes("success")
    || result?.OriginatorConversaionID;  // typo in Safaricom's own API

  if (success) {
    console.log("\n✅ Registration SUCCESSFUL!");
    console.log(`   Safaricom will now POST C2B callbacks to:`);
    console.log(`   ${config.confirmation_url}`);
    console.log("\n💡 Try sending money again — it should now arrive.");
  } else {
    console.log("\n⚠️  Registration returned but response is unclear. Check above JSON.");
  }

} catch (err) {
  if (err?.response) {
    console.error("❌ Registration failed:", err.response.status, JSON.stringify(err.response.data));
  } else {
    console.error("❌ Registration failed:", err.message);
  }
  process.exit(1);
}
