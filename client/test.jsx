import dayjs from "https://esm.sh/dayjs@1.11.10";
import utc from "https://esm.sh/dayjs@1.11.10/plugin/utc";
import timezone from "https://esm.sh/dayjs@1.11.10/plugin/timezone";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

dayjs.extend(utc);
dayjs.extend(timezone);

/* ================= ENV ================= */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYBILL = Deno.env.get("PAYBILL_NUMBER")!;
const CELCOM_API_KEY = Deno.env.get("CELCOM_API_KEY")!;
const CELCOM_PARTNER_ID = Deno.env.get("CELCOM_PARTNER_ID")!;
const CELCOM_SENDER_ID = Deno.env.get("CELCOM_SENDER_ID")!;
const SYSTEM_USER_ID = Deno.env.get("SYSTEM_USER_ID")!; // ✅ FIX

/* ================= SUPABASE ================= */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/* ================= PHONE ================= */
function formatPhone(phone: string): string | null {
  const cleaned = String(phone || "").replace(/\D/g, "");

  if (cleaned.startsWith("254") && cleaned.length === 12) return cleaned;
  if (cleaned.startsWith("0") && cleaned.length === 10) return "254" + cleaned.slice(1);
  if (cleaned.length === 9) return "254" + cleaned;

  return null;
}

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
  customerId: number; // ✅ FIX
}) {
  const formatted = formatPhone(phone);
  if (!formatted || !Number.isInteger(customerId)) return false;

  const url =
    `https://isms.celcomafrica.com/api/services/sendsms/` +
    `?apikey=${CELCOM_API_KEY}` +
    `&partnerID=${CELCOM_PARTNER_ID}` +
    `&shortcode=${CELCOM_SENDER_ID}` +
    `&mobile=${formatted}` +
    `&message=${encodeURIComponent(message)}`;

  try {
    const response = await fetch(url);
    const responseText = await response.text();

    await supabase.from("sms_logs").insert({
      recipient_phone: formatted,
      message,
      status: "sent",
      message_id: responseText || null,
      sender_id: CELCOM_SENDER_ID,
      sent_by: SYSTEM_USER_ID, // ✅ FIX
      tenant_id: tenantId,
      customer_id: customerId,
      cost: 1.0,
    });

    return true;
  } catch (e) {
    await supabase.from("sms_logs").insert({
      recipient_phone: formatted,
      message,
      status: "failed",
      error_message: String(e),
      sender_id: CELCOM_SENDER_ID,
      sent_by: SYSTEM_USER_ID, // ✅ FIX
      tenant_id: tenantId,
      customer_id: customerId,
    });

    return false;
  }
}
