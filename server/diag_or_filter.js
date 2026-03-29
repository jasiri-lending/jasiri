// diag_or_filter.js — test OR filter variations to find the correct syntax
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const db = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const shortcode = "4157991";

// 1. Direct equality — should always work
const { data: d1 } = await db.from("tenant_mpesa_config")
  .select("tenant_id").eq("paybill_number", shortcode).maybeSingle();
console.log("1. eq paybill_number:", d1 ? "FOUND" : "null");

// 2. is_active + eq
const { data: d2 } = await db.from("tenant_mpesa_config")
  .select("tenant_id").eq("paybill_number", shortcode).eq("is_active", true).maybeSingle();
console.log("2. is_active + eq:", d2 ? "FOUND" : "null");

// 3. Current OR filter (PostgREST syntax)
const { data: d3 } = await db.from("tenant_mpesa_config")
  .select("tenant_id")
  .eq("is_active", true)
  .or(`paybill_number.eq.${shortcode},till_number.eq.${shortcode},shortcode.eq.${shortcode}`)
  .maybeSingle();
console.log("3. OR with is_active:", d3 ? "FOUND" : "null");

// 4. OR without is_active
const { data: d4 } = await db.from("tenant_mpesa_config")
  .select("tenant_id")
  .or(`paybill_number.eq.${shortcode},till_number.eq.${shortcode},shortcode.eq.${shortcode}`)
  .maybeSingle();
console.log("4. OR without is_active:", d4 ? "FOUND" : "null");

// 5. Chain is_active as part of OR — maybe is_active is somehow a different type
const { data: d5, error: e5 } = await db.from("tenant_mpesa_config")
  .select("tenant_id")
  .or(`paybill_number.eq.${shortcode}`)
  .maybeSingle();
console.log("5. Single OR:", d5 ? "FOUND" : "null", e5 ? `ERR: ${e5.message}` : "");

// 6. Check if there is a till_number column vs shortcode naming confusion
const { data: d6 } = await db.from("tenant_mpesa_config")
  .select("*").eq("tenant_id", "96687e31-cde9-4822-94ed-e0207cf74283");
console.log("\n6. Full row keys:", d6?.map(r => Object.entries(r).filter(([k,v]) => v !== null).map(([k,v]) => `${k}=${v}`).join(", ")));
