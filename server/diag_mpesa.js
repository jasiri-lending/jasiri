// server/diag_mpesa.js
import "dotenv/config";
import { supabaseAdmin } from "./supabaseClient.js";
import { getTenantConfig } from "./services/tenantResolver.js";
import { getTenantMpesaToken } from "./services/mpesa.js";
import { decrypt } from "./utils/encryption.js";

async function diag() {
  const tenantId = "96687e31-cde9-4822-94ed-e0207cf74283";
  console.log(`=== Diagnosing M-Pesa for Tenant: ${tenantId} ===`);

  try {
    const c2b = await getTenantConfig(tenantId, "c2b");
    const b2c = await getTenantConfig(tenantId, "b2c");

    const k_c2b = decrypt(c2b.consumer_key);
    const k_b2c = decrypt(b2c.consumer_key);
    const s_c2b = decrypt(c2b.consumer_secret);
    const s_b2c = decrypt(b2c.consumer_secret);

    console.log("C2B Config:", { env: c2b.environment, keyLen: k_c2b?.length, secretLen: s_c2b?.length });
    console.log("B2C Config:", { env: b2c.environment, keyLen: k_b2c?.length, secretLen: s_b2c?.length });

    console.log("\nComparison:");
    console.log("- Keys Match:", k_c2b === k_b2c);
    console.log("- Secrets Match:", s_c2b === s_b2c);
    
    if (k_b2c) {
      console.log("- B2C Key starts with space:", k_b2c.startsWith(" "));
      console.log("- B2C Key ends with space:", k_b2c.endsWith(" "));
      console.log("- B2C Key content (first 5):", k_b2c.substring(0, 5));
    }

    console.log("\nAttempting to get B2C token...");
    const token = await getTenantMpesaToken(b2c);
    console.log("✅ B2C Token successfully retrieved!");

  } catch (err) {
    console.error("\n❌ DIAGNOSTIC FAILED:");
    console.error(err.message);
    if (err.response) {
      console.error("Response:", JSON.stringify(err.response.data));
    }
  }
}

diag();
