// diag_mpesa.js
import "dotenv/config";
import { supabaseAdmin } from "./server/supabaseClient.js";
import { getTenantConfig } from "./server/services/tenantResolver.js";
import { getTenantMpesaToken } from "./server/services/mpesa.js";
import { decrypt } from "./server/utils/encryption.js";

async function diag() {
  const tenantId = "96687e31-cde9-4822-94ed-e0207cf74283";
  console.log(`=== Diagnosing M-Pesa B2C for Tenant: ${tenantId} ===`);

  try {
    const config = await getTenantConfig(tenantId, "b2c");
    console.log("Found B2C Config:", {
      id: config.id,
      service_type: config.service_type,
      shortcode: config.shortcode,
      environment: config.environment,
      has_consumer_key: !!config.consumer_key,
      has_consumer_secret: !!config.consumer_secret,
      has_initiator_password: !!config.initiator_password,
      has_security_credential: !!config.security_credential
    });

    const decryptedKey = decrypt(config.consumer_key);
    const decryptedSecret = decrypt(config.consumer_secret);

    console.log("Decrypted Credentials Check:");
    console.log("- Consumer Key Length:", decryptedKey?.length);
    console.log("- Consumer Secret Length:", decryptedSecret?.length);
    console.log("- Is Key Encrypted (contains color):", config.consumer_key?.includes(":"));

    console.log("\nAttempting to get M-Pesa token...");
    const token = await getTenantMpesaToken(config);
    console.log("✅ Token successfully retrieved!");
    console.log("Token (first 10 chars):", token.substring(0, 10) + "...");

  } catch (err) {
    console.error("\n❌ DIAGNOSTIC FAILED:");
    console.error(err.message);
    if (err.response) {
      console.error("Response Data:", JSON.stringify(err.response.data));
    }
  }
}

diag();
