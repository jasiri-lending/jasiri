/**
 * test_production_c2b.js
 *
 * Hits the LIVE Render server to:
 * 1. Check routes are reachable
 * 2. Verify Safaricom confirmation/validation URLs are registered in DB
 * 3. Detect whether the old OR-filter bug is still active (resolveTransaction returns null)
 * 4. Send a safe test confirmation — check if it goes to suspense (old bug) or inserts (fixed)
 *
 * Usage: node test_production_c2b.js
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const PROD_URL   = "https://jasiri-backend.onrender.com";
const SUPABASE_URL      = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAKE_TRANS_ID     = `PROD-BUGTEST-${Date.now()}`;

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function ok(msg)      { console.log(`  ✅ ${msg}`); }
function fail(msg)    { console.log(`  ❌ ${msg}`); }
function warn(msg)    { console.log(`  ⚠️  ${msg}`); }
function info(msg)    { console.log(`  ℹ  ${msg}`); }
function header(msg)  { console.log(`\n${"─".repeat(64)}\n📍 ${msg}\n${"─".repeat(64)}`); }

async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  let json; try { json = await r.json(); } catch { json = {}; }
  return { status: r.status, json };
}
async function post(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  let json; try { json = await r.json(); } catch { json = {}; }
  return { status: r.status, json };
}

// ── TEST 1: Route reachability ───────────────────────────────────────
async function testRoutes() {
  header("TEST 1 — Production route reachability");

  // Health check
  try {
    const { status, json } = await get(`${PROD_URL}/health`);
    if (status === 200) ok(`/health → server is UP (${json.message})`);
    else fail(`/health → ${status}`);
  } catch (e) { fail(`/health → TIMEOUT/ERROR: ${e.message}`); }

  // C2B test route
  try {
    const { status, json } = await get(`${PROD_URL}/mpesa/c2b/test`);
    if (status === 200 && json.success) ok(`/mpesa/c2b/test → reachable`);
    else fail(`/mpesa/c2b/test → ${status} ${JSON.stringify(json)}`);
  } catch (e) { fail(`/mpesa/c2b/test → ${e.message}`); }

  // Validation
  try {
    const { status, json } = await post(`${PROD_URL}/mpesa/c2b/validation`, {});
    if (json.ResultCode === 0) ok(`/mpesa/c2b/validation → ResultCode 0 ✓`);
    else fail(`/mpesa/c2b/validation → ${JSON.stringify(json)}`);
  } catch (e) { fail(`/mpesa/c2b/validation → ${e.message}`); }
}

// ── TEST 2: Safaricom URL Registration in DB ─────────────────────────
async function testSafaricomUrls() {
  header("TEST 2 — Safaricom URL registration in tenant_mpesa_config");

  const { data, error } = await db
    .from("tenant_mpesa_config")
    .select("tenant_id, service_type, environment, is_active, paybill_number, shortcode, confirmation_url, validation_url")
    .eq("service_type", "c2b");

  if (error || !data?.length) { fail("No C2B config rows found"); return; }

  for (const cfg of data) {
    const code = cfg.paybill_number || cfg.shortcode;
    info(`tenant: ${cfg.tenant_id} | shortcode: ${code} | env: ${cfg.environment} | active: ${cfg.is_active}`);

    if (!cfg.is_active) warn("Config is NOT active — Safaricom callbacks will NOT resolve tenant");

    if (cfg.confirmation_url) {
      ok(`confirmation_url: ${cfg.confirmation_url}`);
      if (!cfg.confirmation_url.includes(PROD_URL.replace("https://", "")))
        warn("confirmation_url domain doesn't match Render URL — Safaricom might be sending to a different server");
    } else {
      fail("confirmation_url is EMPTY — Safaricom doesn't know where to send C2B callbacks!");
    }

    if (cfg.validation_url) {
      ok(`validation_url:   ${cfg.validation_url}`);
    } else {
      fail("validation_url is EMPTY");
    }
  }
}

// ── TEST 3: Bug detection — does production resolveTransaction work? ──
async function testBugDetection() {
  header("TEST 3 — Bug detection: does production resolveTransaction work?");
  info("Explanation of the bug:");
  info("  OLD CODE used: .eq('is_active', true).or('paybill_number.eq.4157991,...')");
  info("  PostgREST translates this to SQL:");
  info("    WHERE is_active = true AND paybill_number = '4157991'");
  info("    OR till_number = '4157991' OR shortcode = '4157991'   ← no parentheses!");
  info("  The is_active=true only applies to the first OR branch.");
  info("  In practice Supabase returns NULL → all real Safaricom callbacks go to suspense.");
  info("  FIX: removed is_active from the .or() query, filter in JS instead.");
  console.log();

  // Check if there are any suspense_transactions with recent entries
  const { data: suspense } = await db
    .from("suspense_transactions")
    .select("id, transaction_id, amount, phone_number, billref, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (suspense?.length) {
    warn(`Found ${suspense.length} recent suspense transactions (may indicate the bug was active):`);
    for (const s of suspense) {
      info(`  [${s.created_at?.slice(0,19)}] ${s.transaction_id} – KES ${s.amount} – Reason: ${s.reason}`);
    }
  } else {
    ok("No suspense transactions found");
  }
}

// ── TEST 4: Send test callback to production, detect old vs new code ──
async function testProductionConfirmation() {
  header("TEST 4 — Send test confirmation to production server");
  warn("This sends a fake Safaricom callback to PRODUCTION to check if the code is fixed.");

  // First get the real shortcode from DB
  const { data: cfg } = await db
    .from("tenant_mpesa_config")
    .select("paybill_number, shortcode, tenant_id")
    .eq("service_type", "c2b")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const shortcode = cfg?.paybill_number || cfg?.shortcode || "4157991";
  info(`Using shortcode: ${shortcode} | tenant: ${cfg?.tenant_id}`);

  const payload = {
    TransactionType: "Pay Bill",
    TransID: FAKE_TRANS_ID,
    TransTime: "20260329224000",
    TransAmount: "1",
    BusinessShortCode: shortcode,
    BillRefNumber: "repayment",
    InvoiceNumber: "",
    OrgAccountBalance: "0",
    ThirdPartyTransID: "",
    MSISDN: "254000000000",
    FirstName: "BUGTEST",
    MiddleName: "",
    LastName: "DO-NOT-PROCESS",
  };

  try {
    const { status, json } = await post(`${PROD_URL}/mpesa/c2b/confirmation`, payload);
    if (status === 200 && json.ResultCode === 0) {
      ok(`Production server responded: ResultCode=0 (always expected)`);
    } else {
      fail(`Unexpected: ${status} ${JSON.stringify(json)}`);
    }
  } catch (e) {
    fail(`Network error hitting production: ${e.message}`);
    return;
  }

  info("Waiting 5s for async processing on production server...");
  await new Promise(r => setTimeout(r, 5000));

  // Now check DB: did it land in mpesa_c2b_transactions or suspense_transactions?
  const { data: tx } = await db
    .from("mpesa_c2b_transactions")
    .select("id, transaction_id, status, tenant_id, amount")
    .eq("transaction_id", FAKE_TRANS_ID)
    .maybeSingle();

  const { data: sus } = await db
    .from("suspense_transactions")
    .select("id, transaction_id, reason")
    .eq("transaction_id", FAKE_TRANS_ID)
    .maybeSingle();

  if (tx) {
    ok(`🎉 NEW CODE ACTIVE on production! Transaction in mpesa_c2b_transactions: status=${tx.status}`);
    ok("Tenant resolution is working — real Safaricom payments will be processed correctly.");
  } else if (sus) {
    fail(`OLD BUG STILL ACTIVE on production! Transaction went to suspense_transactions.`);
    fail(`Reason: "${sus.reason}"`);
    fail("The tenantResolver.js fix has NOT been deployed to Render yet.");
    info("Fix: git commit + git push → Render will auto-deploy.");
  } else {
    warn("Transaction not found in either table yet (server may be cold-starting on Render).");
    warn("Re-run this test in 30 seconds if Render is starting up.");
  }

  // Cleanup
  await db.from("mpesa_c2b_transactions").delete().eq("transaction_id", FAKE_TRANS_ID);
  await db.from("suspense_transactions").delete().eq("transaction_id", FAKE_TRANS_ID);
  info(`Cleaned up test transaction: ${FAKE_TRANS_ID}`);
}

// ── MAIN ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${"═".repeat(64)}`);
  console.log(`🚀  Production C2B Verification Test`);
  console.log(`    Target: ${PROD_URL}`);
  console.log(`    Test ID: ${FAKE_TRANS_ID}`);
  console.log(`${"═".repeat(64)}`);

  await testRoutes();
  await testSafaricomUrls();
  await testBugDetection();
  await testProductionConfirmation();

  console.log(`\n${"═".repeat(64)}`);
  console.log(`Done. If TEST 4 shows OLD BUG → deploy the fix before sending real money.`);
  console.log(`${"═".repeat(64)}\n`);
}

main().catch(err => { console.error("Test crashed:", err); process.exit(1); });
