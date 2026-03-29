// diag_c2b_config.js — quickly print the full C2B config row from the DB
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const db = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data, error } = await db
  .from("tenant_mpesa_config")
  .select("tenant_id, service_type, environment, is_active, paybill_number, till_number, shortcode, confirmation_url, validation_url, consumer_key, passkey")
  .eq("service_type", "c2b");

if (error) { console.error("DB error:", error.message); process.exit(1); }

console.log("\n=== tenant_mpesa_config (c2b rows) ===\n");
(data || []).forEach(row => {
  console.log({
    tenant_id: row.tenant_id,
    environment: row.environment,
    is_active: row.is_active,
    paybill_number: row.paybill_number,
    till_number: row.till_number,
    shortcode: row.shortcode,
    has_consumer_key: !!row.consumer_key,
    has_passkey: !!row.passkey,
    confirmation_url: row.confirmation_url,
    validation_url: row.validation_url,
  });
});

// Test the OR query exactly as resolveTransaction does
const testShortcode = data?.[0]?.paybill_number || data?.[0]?.till_number || data?.[0]?.shortcode;
if (testShortcode) {
  console.log(`\n=== resolveTransaction("${testShortcode}") simulation ===`);
  const { data: resolved } = await db
    .from("tenant_mpesa_config")
    .select("tenant_id, paybill_number, till_number, shortcode")
    .eq("is_active", true)
    .or(`paybill_number.eq.${testShortcode},till_number.eq.${testShortcode},shortcode.eq.${testShortcode}`)
    .maybeSingle();
  console.log("Result:", resolved || "null — TENANT RESOLUTION WILL FAIL");
}
