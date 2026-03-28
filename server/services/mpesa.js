import axios from "axios";
import { createLogger } from "../utils/logger.js";
import { decrypt } from "../utils/encryption.js";

const log = createLogger({ service: "mpesa" });

/**
 * Generate tenant-specific MPESA token
 */
export async function getTenantMpesaToken(tenantConfig) {
  const { environment, tenant_id } = tenantConfig;
  const consumer_key = (tenantConfig.consumer_key || "").trim();
  const consumer_secret = (tenantConfig.consumer_secret || "").trim();

  if (!consumer_key || !consumer_secret) {
    throw new Error("M-Pesa configuration error: Missing credentials");
  }

  console.log("ENV:", environment);
  console.log("KEY:", consumer_key);
  console.log("SECRET:", consumer_secret);

  try {
    const baseUrl = environment === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

    const auth_str = `${consumer_key}:${consumer_secret}`;
    const auth = Buffer.from(auth_str).toString("base64");
    
    const response = await axios.get(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`
        },
        timeout: 10_000
      }
    );

    const token = response.data.access_token;
    console.log("TOKEN:", token);

    return token;
  } catch (err) {
    if (err.response) {
      log.error({
        status: err.response.status,
        data: err.response.data,
        tenant_id,
        environment
      }, "Safaricom OAuth failure");
    } else {
      log.error({ err: err.message, tenant_id }, "Failed to get MPESA token (Network/Timeout)");
    }
    throw err;
  }
}

/**
 * Make an authenticated request to MPESA API
 */
export async function mpesaRequest(tenantConfig, method, path, payload) {
  const token = await getTenantMpesaToken(tenantConfig);
  const baseUrl = tenantConfig.environment === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
  const url = `${baseUrl}${path}`;

  console.log(`[mpesaRequest] URL: ${url}`);
  console.log(`[mpesaRequest] Payload:`, JSON.stringify(payload, null, 2));

  try {
    const response = await axios({
      method,
      url,
      data: payload,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    });
    return response.data;
  } catch (err) {
    if (err.response) {
      console.error(`[mpesaRequest] Response status: ${err.response.status}`);
      console.error(`[mpesaRequest] Response data:`, err.response.data);
    } else {
      console.error(`[mpesaRequest] Error:`, err.message);
    }
    throw err;
  }
}

/**
 * Generate timestamp in format YYYYMMDDHHmmss
 */
export function getMpesaTimestamp() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Build STK push password
 */
export function buildStkPassword(shortcode, passkey, timestamp) {
  const str = (shortcode || "").toString().trim() + (passkey || "").toString().trim() + (timestamp || "").toString().trim();
  return Buffer.from(str).toString('base64');
}