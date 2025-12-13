// mpesa.js
import axios from "axios";

/**
 * Get tenant-specific MPESA access token
 * @param {Object} tenantConfig
 */
export async function getMpesaToken(tenantConfig) {
  try {
    const { consumer_key, consumer_secret } = tenantConfig;

    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        auth: {
          username: consumer_key,
          password: consumer_secret,
        },
      }
    );

    return response.data.access_token;
  } catch (err) {
    console.error("Failed to get MPESA token:", err.message);
    throw new Error("Failed to get MPESA token");
  }
}
