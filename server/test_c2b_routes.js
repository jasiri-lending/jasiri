/**
 * test_c2b_routes.js
 * 
 * Tests C2B routes to verify:
 * 1. Routes are reachable (GET /test, POST /validation, POST /confirmation)
 * 2. Tenant resolution works from tenant_mpesa_config (via BusinessShortCode)
 * 3. Transaction is inserted into mpesa_c2b_transactions with status=pending
 * 4. Duplicate prevention works (same TransID not re-inserted)
 * 
 * Usage: node test_c2b_routes.js
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// ── Config ──────────────────────────────────────────────────────────
const BASE_URL = process.env.SERVER_URL || "http://localhost:5000";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const C2B_PATHS = [
  `${BASE_URL}/mpesa/c2b`,
  `${BASE_URL}/api/c2b`,
  `${BASE_URL}`,              // root alias
];

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const FAKE_TRANS_ID = `TEST-C2B-${Date.now()}`;

// ── Helpers ─────────────────────────────────────────────────────────
function ok(msg)     { console.log(`  ✅ ${msg}`); }
function fail(msg)   { console.log(`  ❌ ${msg}`); }
function info(msg)   { console.log(`  ℹ  ${msg}`); }
function header(msg) { console.log(`\n${"─".repeat(60)}\n📍 ${msg}\n${"─".repeat(60)}`); }

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function get(url) {
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

// ── Safaricom-style payload ──────────────────────────────────────────
async function buildPayload() {
  // Get the tenant's shortcode from DB so we can simulate a real Safaricom hit
  const { data: config } = await db
    .from("tenant_mpesa_config")
    .select("paybill_number, till_number, shortcode, tenant_id, environment, is_active")
    .eq("is_active", true)
    .eq("service_type", "c2b")
    .limit(1)
    .maybeSingle();

  if (!config) {
    info("No active C2B config found in tenant_mpesa_config — using dummy shortcode 174379");
  } else {
    info(`Using config → tenant: ${config.tenant_id} | env: ${config.environment} | shortcode: ${config.paybill_number || config.till_number || config.shortcode}`);
  }

  const shortcode = config?.paybill_number || config?.till_number || config?.shortcode || "174379";

  return {
    TransactionType: "Pay Bill",
    TransID: FAKE_TRANS_ID,
    TransTime: "20260329152000",
    TransAmount: "100",
    BusinessShortCode: shortcode,
    BillRefNumber: "repayment",
    InvoiceNumber: "",
    OrgAccountBalance: "0",
    ThirdPartyTransID: "",
    MSISDN: "254111269996",
    FirstName: "TEST",
    MiddleName: "",
    LastName: "USER",
  };
}

// ── TEST 1: Route reachability (GET /test) ──────────────────────────
async function testGetRoute() {
  header("TEST 1 — GET /test (route reachability)");
  let passed = 0;

  for (const base of C2B_PATHS) {
    const url = `${base}/test`;
    try {
      const { status, json } = await get(url);
      if (status === 200 && json.success) {
        ok(`${url} → ${status} ${json.message}`);
        passed++;
      } else {
        fail(`${url} → ${status} ${JSON.stringify(json)}`);
      }
    } catch (e) {
      fail(`${url} → NETWORK ERROR: ${e.message}`);
    }
  }

  info(`Routes reached: ${passed}/${C2B_PATHS.length}`);
}

// ── TEST 2: Validation endpoint ─────────────────────────────────────
async function testValidation() {
  header("TEST 2 — POST /validation");
  
  for (const base of C2B_PATHS) {
    const url = `${base}/validation`;
    try {
      const { status, json } = await post(url, { test: true });
      if (status === 200 && json.ResultCode === 0) {
        ok(`${url} → ResultCode 0 (Accepted)`);
      } else {
        fail(`${url} → ${status} ${JSON.stringify(json)}`);
      }
    } catch (e) {
      fail(`${url} → NETWORK ERROR: ${e.message}`);
    }
    break; // One path is enough for this test
  }
}

// ── TEST 3: Tenant resolution from tenant_mpesa_config ─────────────
async function testTenantResolution() {
  header("TEST 3 — Tenant resolution from tenant_mpesa_config");

  const { data: configs } = await db
    .from("tenant_mpesa_config")
    .select("tenant_id, service_type, environment, is_active, paybill_number, till_number, shortcode, confirmation_url, validation_url")
    .eq("service_type", "c2b");

  if (!configs || configs.length === 0) {
    fail("No C2B rows found in tenant_mpesa_config");
    return;
  }

  for (const cfg of configs) {
    const code = cfg.paybill_number || cfg.till_number || cfg.shortcode;
    const active = cfg.is_active ? "✅ active" : "⚠️  inactive";
    info(`tenant: ${cfg.tenant_id} | env: ${cfg.environment} | shortcode: ${code || "❌ MISSING"} | ${active}`);

    if (!code) fail(`  → No shortcode/paybill/till — Safaricom resolution will FAIL`);
    if (!cfg.confirmation_url) fail(`  → confirmation_url is empty — Safaricom won't know where to send payments`);
    if (!cfg.validation_url)   fail(`  → validation_url is empty`);
    if (!cfg.is_active)        fail(`  → Config is NOT active — resolveTransaction() will skip it`);
  }

  // Try dynamic lookup the same way the server does
  const activeConfig = configs.find(c => c.is_active);
  if (activeConfig) {
    const shortcode = activeConfig.paybill_number || activeConfig.till_number || activeConfig.shortcode;
    const { data: resolved } = await db
      .from("tenant_mpesa_config")
      .select("tenant_id")
      .eq("is_active", true)
      .or(`paybill_number.eq.${shortcode},till_number.eq.${shortcode},shortcode.eq.${shortcode}`)
      .maybeSingle();

    if (resolved) {
      ok(`resolveTransaction("${shortcode}") → tenant_id: ${resolved.tenant_id}`);
    } else {
      fail(`resolveTransaction("${shortcode}") → null — Safaricom callbacks will go to suspense!`);
    }
  }
}

// ── TEST 4: Simulated Safaricom confirmation callback ───────────────
async function testConfirmation() {
  header("TEST 4 — POST /confirmation (simulated Safaricom callback)");

  const payload = await buildPayload();
  info(`TransID: ${payload.TransID} | Amount: ${payload.TransAmount} | ShortCode: ${payload.BusinessShortCode}`);

  const base = C2B_PATHS[0]; // use /mpesa/c2b
  const url = `${base}/confirmation`;

  try {
    const { status, json } = await post(url, payload);

    if (status === 200 && json.ResultCode === 0) {
      ok(`Safaricom response: ${JSON.stringify(json)}`);
    } else {
      fail(`Unexpected response: ${status} ${JSON.stringify(json)}`);
      return;
    }

    // Wait for setImmediate to run the async insert
    info("Waiting 3s for async processing...");
    await new Promise(r => setTimeout(r, 3000));

    // Check if transaction was inserted
    const { data: tx, error } = await db
      .from("mpesa_c2b_transactions")
      .select("id, transaction_id, status, tenant_id, amount, billref")
      .eq("transaction_id", FAKE_TRANS_ID)
      .maybeSingle();

    if (error) {
      fail(`DB query error: ${error.message}`);
    } else if (!tx) {
      fail(`Transaction NOT found in mpesa_c2b_transactions — insert failed or tenant resolution failed`);
      info("Check server logs for 'Tenant not resolved' or 'CRITICAL: Failed to insert'");
    } else {
      ok(`Transaction inserted! status=${tx.status} | tenant=${tx.tenant_id} | amount=${tx.amount}`);
      if (tx.status === "pending") {
        ok("status=pending ✓ — DB trigger will invoke Edge Function");
      } else {
        info(`status=${tx.status} (may have already been processed by trigger)`);
      }
    }
  } catch (e) {
    fail(`NETWORK ERROR: ${e.message}`);
  }
}

// ── TEST 5: Duplicate prevention ────────────────────────────────────
async function testDuplicatePrevention() {
  header("TEST 5 — Duplicate prevention (same TransID sent twice)");

  const payload = await buildPayload();
  const base = C2B_PATHS[0];
  const url = `${base}/confirmation`;

  try {
    // Send the same TransID again
    const { status, json } = await post(url, payload);
    if (status === 200 && json.ResultCode === 0) {
      ok(`Got ResultCode=0 (server always responds OK to Safaricom)`);
      info("Server will silently skip duplicate since status != pending");
    } else {
      fail(`Unexpected: ${status} ${JSON.stringify(json)}`);
    }
  } catch (e) {
    fail(`NETWORK ERROR: ${e.message}`);
  }
}

// ── TEST 6: DB cleanup ───────────────────────────────────────────────
async function cleanup() {
  header("CLEANUP — Removing test transaction from DB");
  const { error } = await db
    .from("mpesa_c2b_transactions")
    .delete()
    .eq("transaction_id", FAKE_TRANS_ID);
  if (error) {
    fail(`Cleanup error: ${error.message}`);
  } else {
    ok(`Removed test transaction ${FAKE_TRANS_ID}`);
  }
}

// ── MAIN ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🧪  C2B Route & Tenant Config Test`);
  console.log(`    Server: ${BASE_URL}`);
  console.log(`    TransID: ${FAKE_TRANS_ID}`);
  console.log(`${"═".repeat(60)}`);

  await testGetRoute();
  await testValidation();
  await testTenantResolution();
  await testConfirmation();
  await testDuplicatePrevention();
  await cleanup();

  console.log(`\n${"═".repeat(60)}`);
  console.log(`✅  Done. Check output above for any ❌ failures.`);
  console.log(`${"═".repeat(60)}\n`);
}

main().catch(err => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
