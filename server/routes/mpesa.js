import axios from "axios";

/**
 * Generate tenant-specific MPESA token
 * @param {Object} tenantConfig
 */
export async function getTenantMpesaToken(tenantConfig) {
  try {
    const { consumer_key, consumer_secret } = tenantConfig;

    // Normally you'd decrypt these first if stored encrypted
    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        auth: {
          username: consumer_key,
          password: consumer_secret
        }
      }
    );

    return response.data.access_token;
  } catch (err) {
    console.error("Failed to get MPESA token:", err.message);
    throw new Error("Failed to get MPESA token");
  }
}
