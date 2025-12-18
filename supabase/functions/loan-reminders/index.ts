import dayjs from "https://esm.sh/dayjs@1.11.10";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ================= ENV ================= */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYBILL = Deno.env.get("PAYBILL_NUMBER")!;
const CELCOM_API_KEY = Deno.env.get("CELCOM_API_KEY")!;
const CELCOM_PARTNER_ID = Deno.env.get("CELCOM_PARTNER_ID")!;
const CELCOM_SENDER_ID = Deno.env.get("CELCOM_SENDER_ID")!;

/* ================= SUPABASE ================= */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

/* ================= SMS ================= */
async function sendSMS({
  phone,
  message,
  tenantId,
  customerId,
}: {
  phone: string;
  message: string;
  tenantId: string;
  customerId: string;
}) {
  try {
    const res = await fetch(
      "https://isms.celcomafrica.com/api/services/sendsms",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apiKey: CELCOM_API_KEY,
        },
        body: JSON.stringify({
          partnerID: CELCOM_PARTNER_ID,
          shortcode: CELCOM_SENDER_ID,
          mobile: phone,
          message,
        }),
      },
    );

    const data = await res.json();
    return { success: res.ok, data };
  } catch (err) {
    console.error("SMS error:", err);
    return { success: false };
  }
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
    /* ============ REMINDERS ============ */
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
          loans (
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
        console.error(`❌ Reminder error (${r.label})`, error);
        continue;
      }

      for (const inst of installments ?? []) {
        const customer = inst.loans?.customers;
        if (!customer) continue;

        const totalPaid =
          inst.loans?.loan_installments?.reduce(
            (sum: number, i: any) => sum + Number(i.paid_amount || 0),
            0,
          ) || 0;

        const remainingInstallment =
          Number(inst.due_amount) - Number(inst.paid_amount || 0);

        const dueDate = dayjs(inst.due_date).startOf("day");
        let dueText = "today";
        if (dueDate.isSame(today.add(1, "day"), "day")) dueText = "tomorrow";
        else if (!dueDate.isSame(today, "day"))
          dueText = `in ${dueDate.diff(today, "day")} days`;

        const message = `Dear ${customer.Firstname},
Your loan repayment is due ${dueText}. Please pay KES ${remainingInstallment.toLocaleString()} to Paybill No. ${PAYBILL}.
AccountNumber-Your ID. Pay on time to avoid penalties.`;

        const result = await sendSMS({
          phone: customer.mobile,
          message,
          tenantId: inst.tenant_id,
          customerId: customer.id,
        });

        if (result.success) {
          await supabase
            .from("loan_installments")
            .update({ [r.field]: true })
            .eq("id", inst.id);

          console.log(`📩 Reminder sent to ${customer.mobile}`);
        }
      }
    }

    /* ============ OVERDUE ============ */
    const { data: overdue } = await supabase
      .from("loan_installments")
      .select(`
        id,
        installment_number,
        due_amount,
        paid_amount,
        days_overdue,
        tenant_id,
        loans (
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

      const remainingInstallment =
        Number(inst.due_amount) - Number(inst.paid_amount || 0);

      const message = `Dear ${customer.Firstname},
Your loan repayment is overdue by ${inst.days_overdue ?? 0} day(s).
Please pay KES ${remainingInstallment.toLocaleString()} to Paybill No. ${PAYBILL}.
AccountNumber-Your ID. Avoid penalties.`;

      await sendSMS({
        phone: customer.mobile,
        message,
        tenantId: inst.tenant_id,
        customerId: customer.id,
      });
    }

    console.log("✅ Loan installment cron finished");
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("❌ Cron failed", err);
    return new Response("Error", { status: 500 });
  }
});
