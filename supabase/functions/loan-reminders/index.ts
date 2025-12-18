import dayjs from "https://esm.sh/dayjs@1.11.10";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ================= ENV ================= */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYBILL = Deno.env.get("PAYBILL_NUMBER")!;
const CELCOM_API_KEY = Deno.env.get("CELCOM_API_KEY")!;
const CELCOM_PARTNER_ID = Deno.env.get("CELCOM_PARTNER_ID")!;
const CELCOM_SENDER_ID = Deno.env.get("CELCOM_SENDER_ID")!;

/* ================= SUPABASE ================= */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* ================= SMS SERVICE ================= */
async function sendSMS({ phone, message, tenantId, customerId }: { phone: string, message: string, tenantId: string, customerId: string }) {
  // Format phone like SMSService
  const formattedPhone = formatPhone(phone);
  if (!formattedPhone) {
    await logSMS({ phone, message, status: "failed", error: "Invalid phone format", tenantId, customerId });
    return { success: false };
  }

  const encodedMessage = encodeURIComponent(message.trim());
  const url = `https://isms.celcomafrica.com/api/services/sendsms/?apikey=${CELCOM_API_KEY}&partnerID=${CELCOM_PARTNER_ID}&message=${encodedMessage}&shortcode=${CELCOM_SENDER_ID}&mobile=${formattedPhone}`;

  try {
    await fetch(url, { method: "GET" });
    const messageId = `sms-${Date.now()}`;
    await logSMS({ phone: formattedPhone, message, status: "sent", messageId, tenantId, customerId });
    return { success: true, messageId };
  } catch (err: any) {
    await logSMS({ phone: formattedPhone, message, status: "failed", error: err.message, tenantId, customerId });
    return { success: false };
  }
}

function formatPhone(phone: string) {
  if (!phone) return "";
  const cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.startsWith("254") && cleaned.length === 12) return cleaned;
  if (cleaned.startsWith("0") && cleaned.length === 10) return "254" + cleaned.substring(1);
  if (cleaned.length === 9 && /^[71]/.test(cleaned)) return "254" + cleaned;
  return "";
}

async function logSMS({ phone, message, status, error, messageId, tenantId, customerId }: { phone: string, message: string, status: string, error?: string, messageId?: string, tenantId: string, customerId: string }) {
  await supabase.from("sms_logs").insert({
    recipient_phone: phone,
    message,
    status,
    error_message: error,
    message_id: messageId,
    sender_id: null,
    tenant_id: tenantId,
    customer_id: customerId
  });
}

/* ================= EDGE FUNCTION ================= */
Deno.serve(async () => {
  console.log("🔔 Loan installment cron started");

  const today = dayjs().startOf("day");

  const reminders = [
    { days: 3, field: "reminder_3day_sent", label: "in 3 days" },
    { days: 1, field: "reminder_1day_sent", label: "tomorrow" },
    { days: 0, field: "reminder_today_sent", label: "today" },
  ];

  try {
    // ============ REMINDERS ============
    for (const r of reminders) {
      const targetDate = today.add(r.days, "day");
      const { data: installments, error } = await supabase
        .from("loan_installments")
        .select(`
          id,
          installment_number,
          due_amount,
          paid_amount,
          due_date,
          tenant_id,
          loan_id,
          loans (
            id,
            total_payable,
            loan_installments ( paid_amount ),
            customers ( id, Firstname, mobile )
          )
        `)
        .gte("due_date", targetDate.startOf("day").toISOString())
        .lte("due_date", targetDate.endOf("day").toISOString())
        .eq(r.field, false)
        .in("status", ["pending", "partial"]);

      if (error) {
        console.error(`❌ Reminder error (${r.label}):`, error);
        continue;
      }

      for (const inst of installments ?? []) {
        const customer = inst.loans?.customers;
        if (!customer) continue;

        const remainingInstallment = Number(inst.due_amount) - Number(inst.paid_amount || 0);
        const dueDate = dayjs(inst.due_date).startOf("day");
        let dueText = "today";
        if (dueDate.isSame(today.add(1, "day"), "day")) dueText = "tomorrow";
        else if (!dueDate.isSame(today, "day")) dueText = `in ${dueDate.diff(today, "day")} days`;

        const message = `Dear ${customer.Firstname},
Your loan repayment is due ${dueText}. Please pay KES ${remainingInstallment.toLocaleString()} to Paybill No. ${PAYBILL}.
AccountNumber-Your ID. Pay on time to avoid penalties.`;

        const result = await sendSMS({ phone: customer.mobile, message, tenantId: inst.tenant_id, customerId: customer.id });
        if (result.success) {
          await supabase.from("loan_installments").update({ [r.field]: true }).eq("id", inst.id);
          console.log(`📩 Reminder sent to ${customer.mobile}`);
        }
      }
    }

    // ============ OVERDUE ============
    const { data: overdue } = await supabase
      .from("loan_installments")
      .select(`
        id,
        installment_number,
        due_amount,
        paid_amount,
        days_overdue,
        tenant_id,
        loan_id,
        loans (
          id,
          total_payable,
          loan_installments ( paid_amount ),
          customers ( id, Firstname, mobile )
        )
      `)
      .lt("due_date", today.toISOString())
      .in("status", ["pending", "partial", "overdue"]);

    for (const inst of overdue ?? []) {
      const customer = inst.loans?.customers;
      if (!customer) continue;

      const remainingInstallment = Number(inst.due_amount) - Number(inst.paid_amount || 0);
      const daysOverdue = inst.days_overdue || 0;

      const message = `Dear ${customer.Firstname},
Your loan repayment is overdue by ${daysOverdue} day(s).
Please pay KES ${remainingInstallment.toLocaleString()} to Paybill No. ${PAYBILL}.
AccountNumber-Your ID. Avoid penalties.`;

      await sendSMS({ phone: customer.mobile, message, tenantId: inst.tenant_id, customerId: customer.id });
    }

    console.log("✅ Loan installment cron finished");
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("❌ Cron failed", err);
    return new Response("Error", { status: 500 });
  }
});
