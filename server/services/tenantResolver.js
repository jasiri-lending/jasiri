// ─────────────────────────────────────────────────────────────────
// BACKEND: backend/services/tenantResolver.js
// Resolves which tenant a payment belongs to.
// Uses supabaseAdmin to bypass RLS — this runs server-side only.
// ─────────────────────────────────────────────────────────────────
import { supabaseAdmin } from "../supabaseClient.js";
import { createLogger }  from "../utils/logger.js";

const log = createLogger({ service: "tenantResolver" });

// ── Resolve tenant by M-Pesa shortcode (most reliable) ────────────
// Safaricom's BusinessShortCode field is globally unique → best lookup key.
export async function resolveTenantByShortcode(shortcode) {
  if (!shortcode) return null;

  const { data, error } = await supabaseAdmin
    .from("tenant_mpesa_config")
    .select("tenant_id, paybill_number, till_number, environment, consumer_key, consumer_secret, passkey, callback_url, shortcode")
    .eq("is_active", true)
    .or(`paybill_number.eq.${shortcode},till_number.eq.${shortcode},shortcode.eq.${shortcode}`)
    .maybeSingle();

  if (error) {
    log.error({ error, shortcode }, "Shortcode tenant lookup error");
    return null;
  }

  return data;
}

// ── Resolve tenant by customer phone number (fallback) ────────────
export async function resolveTenantByPhone(phone) {
  if (!phone) return null;
  const formats = normalizePhone(phone);

  const { data: customer, error } = await supabaseAdmin
    .from("customers")
    .select("id, tenant_id")
    .in("mobile", formats)
    .maybeSingle();

  if (error || !customer) return null;

  const { data: mpesaConfig } = await supabaseAdmin
    .from("tenant_mpesa_config")
    .select("*")
    .eq("tenant_id", customer.tenant_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!mpesaConfig) return null;
  return { ...mpesaConfig, resolved_customer_id: customer.id };
}

// ── Full resolution: shortcode → phone → null ─────────────────────
export async function resolveTransaction(shortcode, phone) {
  let cfg = await resolveTenantByShortcode(shortcode);
  if (!cfg) {
    log.warn({ shortcode, phone }, "Shortcode not matched — trying phone fallback");
    cfg = await resolveTenantByPhone(phone);
  }
  if (!cfg) log.warn({ shortcode, phone }, "Could not resolve tenant");
  return cfg;
}

// ── Get a tenant's full M-Pesa config (throws if missing) ─────────
export async function getTenantConfig(tenantId) {
  const { data, error } = await supabaseAdmin
    .from("tenant_mpesa_config")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) throw new Error(`No active M-Pesa config for tenant ${tenantId}`);
  return data;
}

// ── Phone normalisation — produces all format variants ────────────
export function normalizePhone(phone) {
  if (!phone) return [];
  const clean = String(phone).replace(/[\s\-\(\)\+]/g, "");
  const out   = new Set();

  if (clean.startsWith("254") && clean.length === 12) {
    out.add(clean);                      // 254711000000
    out.add("0" + clean.slice(3));       // 0711000000
    out.add("+" + clean);               // +254711000000
  } else if (clean.startsWith("0") && clean.length === 10) {
    out.add(clean);                      // 0711000000
    out.add("254" + clean.slice(1));     // 254711000000
    out.add("+254" + clean.slice(1));    // +254711000000
  } else {
    out.add(clean);
  }
  return [...out];
}