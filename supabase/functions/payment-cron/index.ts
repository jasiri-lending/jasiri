// supabase/functions/payment-cron/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const PROJECT_URL    = Deno.env.get("SUPABASE_URL")              ?? "";
  const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const FUNCTIONS_URL  = Deno.env.get("SUPABASE_FUNCTIONS_URL")    ?? `${PROJECT_URL}/functions/v1`;

  const db = createClient(PROJECT_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const results = [];

  // 1. Recover stuck jobs
  try {
    const recoverRes = await fetch(`${FUNCTIONS_URL}/process-payments`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
      body:    JSON.stringify({ action: "recover-stuck" }),
    });
    const recoverData = await recoverRes.json();
    if (recoverData.recovered > 0) console.log(`Cron: recovered ${recoverData.recovered} stuck jobs`);
    results.push({ step: "recover-stuck", ...recoverData });
  } catch (err) {
    console.error("Cron: recovery step failed:", err.message);
  }

  // 2. Process queue
  try {
    const queueRes = await fetch(`${FUNCTIONS_URL}/process-payments`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
      body:    JSON.stringify({ action: "process-queue" }),
    });
    const queueData = await queueRes.json();
    if (queueData.processed > 0 || queueData.failed > 0) {
      console.log(`Cron: queue → processed=${queueData.processed} failed=${queueData.failed}`);
    }
    results.push({ step: "process-queue", ...queueData });
  } catch (err) {
    console.error("Cron: process-queue step failed:", err.message);
    results.push({ step: "process-queue", error: err.message });
  }

  // 3. Safety net: any pending that bypassed the queue
  try {
    const { count } = await db
      .from("mpesa_c2b_transactions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if ((count ?? 0) > 0) {
      console.log(`Cron: safety net — found ${count} pending transactions not in queue`);
      const pendingRes = await fetch(`${FUNCTIONS_URL}/process-payments`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
        body:    JSON.stringify({ action: "process-pending", limit: 20 }),
      });
      const pendingData = await pendingRes.json();
      results.push({ step: "process-pending-safety-net", count, ...pendingData });
    }
  } catch (err) {
    console.error("Cron: safety net step failed:", err.message);
  }

  return new Response(JSON.stringify({ cron: true, timestamp: new Date(), results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});























