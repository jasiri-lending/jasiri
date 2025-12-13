// c2b.js
import express from "express";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import { getMpesaToken } from "./mpesa.js";

const c2b = express.Router();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Fetch tenant MPESA config helper
async function getTenantConfig(tenantId) {
  const { data, error } = await supabaseAdmin
    .from("tenant_mpesa_config")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  if (error) throw new Error("Tenant MPESA config not found");
  return data;
}

// Validation URL
c2b.post("/c2b/validation", (req, res) => {
  return res.json({ ResultCode: 0, ResultDesc: "Validation Passed" });
});

// C2B Confirmation
c2b.post("/c2b/confirmation", async (req, res) => {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { TransID, TransAmount, MSISDN, BillRefNumber, FirstName } = body;
    if (!TransID || !MSISDN || !TransAmount || !BillRefNumber)
      throw new Error("Missing required transaction fields");

    const localNumber = MSISDN.replace(/^254/, "0");

    // Find customer to identify tenant
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, tenant_id")
      .in("mobile", [MSISDN, localNumber])
      .maybeSingle();

    let tenantId = customer?.tenant_id;

    if (!tenantId) {
      console.log("Customer not found, moving to suspense");
      await supabaseAdmin.from("suspense_transactions").insert([
        {
          payer_name: FirstName?.trim() || "Unknown",
          phone_number: MSISDN,
          amount: TransAmount,
          transaction_id: TransID,
          status: "suspense",
          reason: "Customer not found",
        },
      ]);
      return res.json({ ResultCode: 0, ResultDesc: "Moved to suspense" });
    }

const token = await getMpesaToken(getTenantConfig(tenantId));

    // Log transaction
    await supabaseAdmin.from("mpesa_c2b_transactions").insert([
      {
        transaction_id: TransID,
        phone_number: MSISDN,
        amount: TransAmount,
        raw_payload: body,
        status: "pending",
        customer_id: customer?.id,
        tenant_id: tenantId,
        billref: BillRefNumber,
        firstname: FirstName?.trim(),
      },
    ]);

    // Here you can implement **repayment allocation logic** as per your B2C code
    // For simplicity, mark transaction applied
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
