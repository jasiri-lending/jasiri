import dayjs from "https://esm.sh/dayjs@1.11.10";
import utc from "https://esm.sh/dayjs@1.11.10/plugin/utc";
import timezone from "https://esm.sh/dayjs@1.11.10/plugin/timezone";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Enable timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

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
  const formattedPhone = formatPhone(phone);
  
  console.log(`📞 Attempting to send SMS to: ${phone} → ${formattedPhone}`);
  
  if (!formattedPhone) {
    console.error(`❌ Invalid phone format: ${phone}`);
    await logSMS({ phone, message, status: "failed", error: "Invalid phone format", tenantId, customerId });
    return { success: false };
  }

  const encodedMessage = encodeURIComponent(message.trim());
  const url = `https://isms.celcomafrica.com/api/services/sendsms/?apikey=${CELCOM_API_KEY}&partnerID=${CELCOM_PARTNER_ID}&message=${encodedMessage}&shortcode=${CELCOM_SENDER_ID}&mobile=${formattedPhone}`;

  try {
    const response = await fetch(url, { method: "GET" });
    const responseText = await response.text();
    
    console.log(`📡 SMS API Response: ${response.status} - ${responseText}`);
    
    const messageId = `sms-${Date.now()}`;
    await logSMS({ phone: formattedPhone, message, status: "sent", messageId, tenantId, customerId });
    
    console.log(`✅ SMS logged as sent with ID: ${messageId}`);
    return { success: true, messageId };
  } catch (err: any) {
    console.error(`❌ SMS send error: ${err.message}`);
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
  const logResult = await supabase.from("sms_logs").insert({
    recipient_phone: phone,
    message,
    status,
    error_message: error,
    message_id: messageId,
    sender_id: null,
    tenant_id: tenantId,
    customer_id: customerId
  });
  
  if (logResult.error) {
    console.error(`❌ Failed to log SMS: ${logResult.error.message}`);
  } else {
    console.log(`📝 SMS log saved successfully`);
  }
}

/* ================= EDGE FUNCTION ================= */
Deno.serve(async () => {
  console.log("🔔 Loan installment cron started");
  console.log(`⏰ Current time (UTC): ${new Date().toISOString()}`);
  
  // Use Africa/Nairobi timezone for consistency with the old cron
  const today = dayjs().tz("Africa/Nairobi").startOf("day");
  console.log(`📅 Today in Nairobi (start of day): ${today.format('YYYY-MM-DD HH:mm:ss')} (${today.toISOString()})`);
  
  // Check environment variables
  console.log("🔧 Environment check:", {
    hasSupabaseUrl: !!SUPABASE_URL,
    hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
    hasPaybill: !!PAYBILL,
    hasCelcomKey: !!CELCOM_API_KEY,
    hasCelcomPartner: !!CELCOM_PARTNER_ID,
    hasCelcomSender: !!CELCOM_SENDER_ID
  });

  const reminders = [
    { days: 3, field: "reminder_3day_sent", label: "in 3 days" },
    { days: 1, field: "reminder_1day_sent", label: "tomorrow" },
    { days: 0, field: "reminder_today_sent", label: "today" },
  ];

  try {
    // ============ REMINDERS ============
    console.log("\n📋 Checking reminders...");
    
    for (const r of reminders) {
      const targetDate = today.add(r.days, "day");
      const startOfDay = targetDate.startOf("day").toISOString();
      const endOfDay = targetDate.endOf("day").toISOString();
      
      console.log(`\n🔍 Checking ${r.label} (${targetDate.format('YYYY-MM-DD')})`);
      console.log(`   Date range: ${startOfDay} to ${endOfDay}`);
      console.log(`   Field: ${r.field}`);
      
      const { data: installments, error } = await supabase
        .from("loan_installments")
        .select(`
          id,
          installment_number,
          due_amount,
          paid_amount,
          due_date,
          status,
          tenant_id,
          loan_id,
          ${r.field},
          loans (
            id,
            total_payable,
            loan_installments ( paid_amount ),
            customers ( id, Firstname, mobile )
          )
        `)
        .gte("due_date", startOfDay)
        .lte("due_date", endOfDay)
        .eq(r.field, false)
        .in("status", ["pending", "partial"]);

      if (error) {
        console.error(`❌ Reminder error (${r.label}):`, error);
        continue;
      }

      console.log(`   Found ${installments?.length || 0} installments`);

      if (installments && installments.length > 0) {
        console.log(`   Installments:`, installments.map(i => ({
          id: i.id,
          installment: i.installment_number,
          due_date: i.due_date,
          status: i.status,
          reminder_sent: i[r.field],
          customer: i.loans?.customers?.Firstname
        })));
      }

      for (const inst of installments ?? []) {
        const customer = inst.loans?.customers;
        
        if (!customer) {
          console.warn(`⚠️ Installment ${inst.id} has no customer data`);
          continue;
        }

        console.log(`\n👤 Processing customer: ${customer.Firstname} (${customer.mobile})`);

        const remainingInstallment = Number(inst.due_amount) - Number(inst.paid_amount || 0);
        const dueDate = dayjs(inst.due_date).tz("Africa/Nairobi").startOf("day");
        
        // Calculate due text correctly
        let dueText;
        if (dueDate.isSame(today, "day")) {
          dueText = "today";
        } else if (dueDate.isSame(today.add(1, "day"), "day")) {
          dueText = "tomorrow";
        } else {
          const daysDiff = dueDate.diff(today, "day");
          dueText = `in ${daysDiff} days`;
        }

        console.log(`   Due date: ${dueDate.format('YYYY-MM-DD')}, Due text: "${dueText}"`);

        const message = `Dear ${customer.Firstname},
Your loan repayment is due ${dueText}. Please pay KES ${remainingInstallment.toLocaleString()} to Paybill No. ${PAYBILL}.
AccountNumber-Your ID. Pay on time to avoid penalties.`;

        console.log(`📝 Message: ${message}`);

        const result = await sendSMS({ 
          phone: customer.mobile, 
          message, 
          tenantId: inst.tenant_id, 
          customerId: customer.id 
        });
        
        if (result.success) {
          const updateResult = await supabase
            .from("loan_installments")
            .update({ [r.field]: true })
            .eq("id", inst.id);
            
          if (updateResult.error) {
            console.error(`❌ Failed to update ${r.field}:`, updateResult.error);
          } else {
            console.log(`✅ Updated ${r.field} = true for installment ${inst.id}`);
          }
          
          console.log(`📩 Reminder sent to ${customer.mobile}`);
        } else {
          console.error(`❌ Failed to send SMS to ${customer.mobile}`);
        }
      }
    }

    // ============ OVERDUE ============
    console.log("\n⚠️ Checking overdue installments...");
    
    const { data: overdue, error: overdueError } = await supabase
      .from("loan_installments")
      .select(`
        id,
        installment_number,
        due_amount,
        paid_amount,
        due_date,
        days_overdue,
        status,
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

    if (overdueError) {
      console.error("❌ Overdue query error:", overdueError);
    } else {
      console.log(`   Found ${overdue?.length || 0} overdue installments`);
      
      if (overdue && overdue.length > 0) {
        console.log(`   Overdue installments:`, overdue.map(i => ({
          id: i.id,
          installment: i.installment_number,
          due_date: i.due_date,
          days_overdue: i.days_overdue,
          status: i.status,
          customer: i.loans?.customers?.Firstname
        })));
      }
    }

    for (const inst of overdue ?? []) {
      const customer = inst.loans?.customers;
      
      if (!customer) {
        console.warn(`⚠️ Overdue installment ${inst.id} has no customer data`);
        continue;
      }

      console.log(`\n👤 Processing overdue customer: ${customer.Firstname} (${customer.mobile})`);

      const remainingInstallment = Number(inst.due_amount) - Number(inst.paid_amount || 0);
      const daysOverdue = inst.days_overdue || 0;

      const message = `Dear ${customer.Firstname},
Your loan repayment is overdue by ${daysOverdue} day(s). Please pay KES ${remainingInstallment.toLocaleString()} to Paybill No. ${PAYBILL}. AccountNumber-Your ID. Pay on time to avoid penalties.`;

      console.log(`📝 Message: ${message}`);

      await sendSMS({ 
        phone: customer.mobile, 
        message, 
        tenantId: inst.tenant_id, 
        customerId: customer.id 
      });
    }

    console.log("\n✅ Loan installment cron finished");
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("❌ Cron failed", err);
    return new Response("Error", { status: 500 });
  }
});