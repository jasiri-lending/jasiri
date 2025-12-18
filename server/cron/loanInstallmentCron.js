import cron from "node-cron";
import dayjs from "dayjs";
import supabase from "../supabaseClient.js";
import SMSService from "../services/smsService.js";

const PAYBILL = process.env.PAYBILL_NUMBER;

cron.schedule(
  "0 8 * * *",
  async () => {
    console.log("🔔 Loan installment cron started");

    const today = dayjs().startOf("day");

    const reminders = [
      { days: 3, field: "reminder_3day_sent", label: "in 3 days" },
      { days: 1, field: "reminder_1day_sent", label: "tomorrow" },
      { days: 0, field: "reminder_today_sent", label: "today" },
    ];

    try {
      // ================= REMINDERS =================
      for (const r of reminders) {
        const targetDate = today.add(r.days, "day");
        const startOfDay = targetDate.startOf("day").toISOString();
        const endOfDay = targetDate.endOf("day").toISOString();

        const { data: installments, error } = await supabase
          .from("loan_installments")
          .select(`
            id,
            installment_number,
            due_amount,
            paid_amount,
            tenant_id,
            loan_id,
            loans (
              id,
              total_payable,
              loan_installments (
                paid_amount
              ),
              customers (
                id,
                Firstname,
                mobile
              )
            )
          `)
          .gte("due_date", startOfDay)
          .lte("due_date", endOfDay)
          .eq(r.field, false)
          .in("status", ["pending", "partial"]);

        if (error) {
          console.error(`❌ Error fetching ${r.label} reminders:`, error);
          continue;
        }

        for (const inst of installments || []) {
          const customer = inst.loans?.customers;
          if (!customer) continue;

          const totalPaid =
            inst.loans?.loan_installments?.reduce(
              (sum, i) => sum + Number(i.paid_amount || 0),
              0
            ) || 0;

          const remainingInstallment =
            Number(inst.due_amount) - Number(inst.paid_amount || 0);
          const remainingLoanBalance = Number(inst.loans.total_payable) - totalPaid;

          // Correctly calculate "today/tomorrow/in X days"
          const dueDate = dayjs(inst.due_date).startOf("day");
          let dueText;
          if (dueDate.isSame(today, "day")) dueText = "today";
          else if (dueDate.isSame(today.add(1, "day"), "day")) dueText = "tomorrow";
          else dueText = `in ${dueDate.diff(today, "day")} days`;

   const message = `Dear ${customer.Firstname},
Your loan repayment is due ${dueText}. Please pay KES ${remainingInstallment.toLocaleString()} to Paybill No. ${PAYBILL}.
AccountNumber-Your ID. Pay on time to avoid penalties. 
`;


          const result = await SMSService.sendSMS({
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

            console.log(`📩 Reminder sent to ${customer.mobile} for installment #${inst.installment_number}`);
          } else {
            console.error(`❌ Failed to send reminder to ${customer.mobile}`, result);
          }
        }
      }

      // ================= OVERDUE =================
      const { data: overdueInstallments, error: overdueError } = await supabase
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
            loan_installments (
              paid_amount
            ),
            customers (
              id,
              Firstname,
              mobile
            )
          )
        `)
        .lt("due_date", today.toISOString())
        .in("status", ["pending", "partial", "overdue"]);

      if (overdueError) {
        console.error("❌ Error fetching overdue installments:", overdueError);
      }

      for (const inst of overdueInstallments || []) {
        const customer = inst.loans?.customers;
        if (!customer) continue;

        const totalPaid =
          inst.loans?.loan_installments?.reduce(
            (sum, i) => sum + Number(i.paid_amount || 0),
            0
          ) || 0;

        const remainingInstallment =
          Number(inst.due_amount) - Number(inst.paid_amount || 0);
        const remainingLoanBalance = Number(inst.loans.total_payable) - totalPaid;
        const daysOverdue = inst.days_overdue || 0;

const message = `Dear ${customer.Firstname},
Your loan repayment is overdue by ${daysOverdue} day(s). Please pay KES ${remainingInstallment.toLocaleString()} to Paybill No. ${PAYBILL}. AccountNumber-Your ID. Pay on time to avoid penalties.
`;



        const result = await SMSService.sendSMS({
          phone: customer.mobile,
          tenantId: inst.tenant_id,
          customerId: customer.id,
          message,
        });

        if (result.success) {
          console.log(`⚠️ Overdue SMS sent to ${customer.mobile} for installment #${inst.installment_number}`);
        } else {
          console.error(`❌ Failed to send overdue SMS to ${customer.mobile}`, result);
        }
      }
    } catch (err) {
      console.error("❌ Cron job failed:", err);
    }

    console.log("✅ Loan installment cron finished");
  },
  {
    timezone: "Africa/Nairobi"
  }
);
