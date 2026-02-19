import express from "express";
import { createClient } from "@supabase/supabase-js";
import { getTenantMpesaToken } from "./mpesa.js";

const c2b = express.Router();
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Validation endpoint
c2b.post("/c2b/validation", (req, res) => {
  return res.json({ ResultCode: 0, ResultDesc: "Validation Passed" });
});

// C2B Confirmation endpoint
c2b.post("/c2b/confirmation", async (req, res) => {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { TransID, TransAmount, MSISDN, BillRefNumber, FirstName } = body;

    if (!TransID || !MSISDN || !TransAmount || !BillRefNumber)
      throw new Error("Missing required transaction fields");

    // Normalize MSISDN
    const localNumber = MSISDN.replace(/^254/, "0");

    // Find customer & tenant
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, tenant_id")
      .in("mobile", [MSISDN, localNumber])
      .maybeSingle();

    if (!customer) {
      // Move to suspense if customer not found
      await supabaseAdmin.from("suspense_transactions").insert([
        {
          payer_name: FirstName || "Unknown",
          phone_number: MSISDN,
          amount: TransAmount,
          transaction_id: TransID,
          status: "suspense",
          reason: "Customer not found",
        }
      ]);
      return res.json({ ResultCode: 0, ResultDesc: "Moved to suspense" });
    }

    const tenantId = customer.tenant_id;

    // Get tenant token
    const tenantConfig = await supabaseAdmin
      .from("tenant_mpesa_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .single()
      .then(r => {
        if (r.error || !r.data) throw new Error("Tenant MPESA config not found");
        return r.data;
      });

    const token = await getTenantMpesaToken(tenantConfig);

    // Log transaction
    await supabaseAdmin.from("mpesa_c2b_transactions").insert([
      {
        tenant_id: tenantId,
        customer_id: customer.id,
        transaction_id: TransID,
        phone_number: MSISDN,
        amount: TransAmount,
        raw_payload: body,
        status: "pending",
        billref: BillRefNumber,
        firstname: FirstName
      }
    ]);

    // TODO: Apply repayment allocation logic here per tenant
    await supabaseAdmin
      .from("mpesa_c2b_transactions")
      .update({ status: "applied" })
      .eq("transaction_id", TransID);

    res.json({ ResultCode: 0, ResultDesc: "Transaction processed successfully" });
  } catch (err) {
    console.error("C2B Error:", err.message);
    res.json({ ResultCode: 1, ResultDesc: `Processing failed: ${err.message}` });
  }
});

export default c2b;
