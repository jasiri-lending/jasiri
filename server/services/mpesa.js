// server/services/mpesa.js
import axios from "axios";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ service: "mpesa" });

/**
 * Generate tenant-specific MPESA token
 */
export async function getTenantMpesaToken(tenantConfig) {
  try {
    const { consumer_key, consumer_secret, environment } = tenantConfig;
    const baseUrl = environment === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

    const response = await axios.get(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        auth: {
          username: consumer_key,
          password: consumer_secret
        },
        timeout: 10_000
      }
    );

    return response.data.access_token;
  } catch (err) {
    log.error({ err: err.message }, "Failed to get MPESA token");
    throw new Error("Failed to get MPESA token");
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
  const str = shortcode + passkey + timestamp;
  return Buffer.from(str).toString('base64');
}