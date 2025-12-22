import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ================= ENV ================= */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CELCOM_API_KEY = Deno.env.get("CELCOM_API_KEY")!;
const CELCOM_PARTNER_ID = Deno.env.get("CELCOM_PARTNER_ID")!;
const CELCOM_SENDER_ID = Deno.env.get("CELCOM_SENDER_ID")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

/* ================= SMS ================= */
async function sendSMS(phone: string, message: string) {
  const encoded = encodeURIComponent(message.trim());
  const url = `https://isms.celcomafrica.com/api/services/sendsms/?apikey=${CELCOM_API_KEY}&partnerID=${CELCOM_PARTNER_ID}&message=${encoded}&shortcode=${CELCOM_SENDER_ID}&mobile=${phone}`;
  await fetch(url);
}

/* ================= EDGE ================= */
Deno.serve(async (req) => {
  const { transaction_id } = await req.json();

  /* ===== Fetch transaction + customer ===== */
  const { data: tx } = await supabase
    .from("mpesa_c2b_transactions")
    .select(`
      id,
      amount,
      loan_id,
      payment_sms_sent,
      loans (
        customers ( id, mobile )
      )
    `)
    .eq("transaction_id", transaction_id)
    .single();

  if (!tx || tx.payment_sms_sent) {
    return new Response("Skipped", { status: 200 });
  }

  const customer = tx.loans?.customers;
  if (!customer || !tx.loan_id) {
    return new Response("Missing customer or loan", { status: 200 });
  }

  /* ===== Calculate remaining loan balance ===== */
  const { data: installments } = await supabase
    .from("loan_installments")
    .select("due_amount, paid_amount")
    .eq("loan_id", tx.loan_id);

  const outstandingBalance =
    installments?.reduce((sum, inst) => {
      const due = Number(inst.due_amount || 0);
      const paid = Number(inst.paid_amount || 0);
      return sum + Math.max(due - paid, 0);
    }, 0) || 0;

  /* ===== Message (exact wording requested) ===== */
  const message = `Dear Customer,
We have received your payment of KES ${Number(tx.amount).toLocaleString()}.
Your outstanding loan balance is KES ${outstandingBalance.toLocaleString()}.
Thank you for being our valued client.`;

  await sendSMS(customer.mobile, message);

  /* ===== Mark SMS as sent ===== */
  await supabase
    .from("mpesa_c2b_transactions")
    .update({ payment_sms_sent: true })
    .eq("id", tx.id);

  return new Response("OK", { status: 200 });
});
