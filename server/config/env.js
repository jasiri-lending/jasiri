// ─────────────────────────────────────────────────────────────────
// BACKEND: server/config/env.js
// All environment variables and system constants in one place.
// ─────────────────────────────────────────────────────────────────
import dotenv from "dotenv";
dotenv.config();

const required = (key) => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

export const config = {
  supabase: {
    url:            required("SUPABASE_URL"),
    anonKey:        required("SUPABASE_ANON_KEY"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  },

  mpesa: {
    initiator:          process.env.MPESA_INITIATOR || "",
    securityCredential: process.env.MPESA_SECURITY_CREDENTIAL || "",
    sandboxBase:        "https://sandbox.safaricom.co.ke",
    productionBase:     "https://api.safaricom.co.ke",
  },

  server: {
    port:    parseInt(process.env.PORT || "5000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    cors:    [
      "https://jasirilending.software",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
    ],
  },

  worker: {
    concurrency:     parseInt(process.env.WORKER_CONCURRENCY  || "5",    10),
    pollIntervalMs:  parseInt(process.env.WORKER_POLL_MS      || "1000", 10),
    maxRetries:      parseInt(process.env.MAX_RETRIES         || "3",    10),
    stuckJobMinutes: parseInt(process.env.STUCK_JOB_MINUTES   || "5",    10),
  },
};

// ── Payment job type identifiers ──────────────────────────────────
export const JOB_TYPES = {
  C2B_REPAYMENT:    "c2b_repayment",
  B2C_DISBURSEMENT: "b2c_disbursement",
  REGISTRATION:     "registration",
  PROCESSING_FEE:   "processing_fee",
  WALLET_CREDIT:    "wallet_credit",
    SEND_SMS:         "send_sms",
};

// ── Repayment allocation order (never change this order) ─────────
export const REPAYMENT_PRIORITY = ["penalty", "interest", "principal"];