import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);


serve(async (req) => {
  try {
    // 1️⃣ Get all active penalty settings
    const { data: settings, error: settingsErr } = await supabase
      .from("loan_penalty_settings")
      .select("*")
      .eq("penalties_enabled", true);

    if (settingsErr) throw settingsErr;

    for (const cfg of settings!) {
      // 2️⃣ Get overdue installments for this tenant
      const { data: installments, error: instErr } = await supabase
        .from("loan_installments")
        .select(
          `*, loan_id!inner(customer_id, total_penalties, net_penalties)`
        )
        .in("status", ["pending", "partial", "overdue"])
        .lt("due_date", new Date().toISOString())
        .eq("tenant_id", cfg.tenant_id);

      if (instErr) throw instErr;

      for (const inst of installments!) {
        const overdueDays =
          Math.floor(
            (new Date().getTime() - new Date(inst.due_date).getTime()) /
              (1000 * 60 * 60 * 24)
          ) - cfg.penalty_grace_days;

        if (overdueDays <= 0) continue;

        // Flat penalty applied only once
        if (cfg.penalty_type === "flat" && inst.penalty_amount > 0) continue;

        // Prevent double charge if already applied today
        if (inst.last_penalty_applied_at) {
          const lastDate = new Date(inst.last_penalty_applied_at);
          if (
            lastDate.getFullYear() === new Date().getFullYear() &&
            lastDate.getMonth() === new Date().getMonth() &&
            lastDate.getDate() === new Date().getDate()
          )
            continue;
        }

        // Base amount for percentage
        let baseAmount = inst.due_amount;
        let penalty = 0;

        if (cfg.penalty_rate_mode === "fixed") {
          penalty = cfg.penalty_rate;
        } else {
          penalty = Math.round((cfg.penalty_rate / 100) * baseAmount * 100) / 100;
        }

        if (penalty <= 0) continue;

        // Apply installment cap
        if (cfg.max_penalty_per_installment) {
          penalty = Math.min(
            penalty,
            cfg.max_penalty_per_installment - inst.penalty_amount
          );
        }
        if (penalty <= 0) continue;

        // Apply whole-loan cap
        if (cfg.penalty_scope === "whole_loan" && cfg.max_penalty_per_loan) {
          const remaining = cfg.max_penalty_per_loan - inst.loan.total_penalties;
          penalty = Math.min(penalty, remaining);
        }
        if (penalty <= 0) continue;

        // Update installment
        await supabase
          .from("loan_installments")
          .update({
            penalty_amount: inst.penalty_amount + penalty,
            total_due_with_penalty: inst.due_amount + inst.penalty_amount + penalty,
            last_penalty_applied_at: new Date().toISOString(),
            status: "overdue",
          })
          .eq("id", inst.id);

        // Update loan total if scope is whole loan
        if (cfg.penalty_scope === "whole_loan") {
          await supabase
            .from("loans")
            .update({
              total_penalties: inst.loan.total_penalties + penalty,
            })
            .eq("id", inst.loan_id);
        }

        // Send SMS if enabled
        if (cfg.send_penalty_sms) {
          await supabase.from("sms_logs").insert({
            recipient_phone: inst.phone_number,
            message: `Your loan installment is overdue. Penalty applied: KES ${penalty}`,
            status: "sent",
            customer_id: inst.loan.customer_id,
            tenant_id: inst.tenant_id,
          });
        }
      }
    }

    return new Response(JSON.stringify({ status: "success" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ status: "error", message: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
