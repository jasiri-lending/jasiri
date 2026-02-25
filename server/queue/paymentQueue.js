// server/queue/paymentQueue.js
import { supabaseAdmin } from "../supabaseClient.js";
import { createLogger }  from "../utils/logger.js";

const log = createLogger({ service: "paymentQueue" });

/**
 * Enqueue a new job into the payment_queue table.
 * Workers (Edge Function) will later claim and process it.
 */
export async function enqueueJob({ tenantId, jobType, payload, priority = 5 }) {
  const { data, error } = await supabaseAdmin
    .from("payment_queue")
    .insert({
      tenant_id:    tenantId,
      job_type:     jobType,
      payload,
      priority,
      status:       "queued",
      scheduled_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to enqueue job: ${error.message}`);
  log.info({ jobId: data.id, tenantId, jobType }, "Job enqueued");
  return data.id;
}