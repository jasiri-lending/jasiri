import fetch from "node-fetch";
import supabase from "../supabaseClient.js";

const CELCOM_AFRICA_CONFIG = {
  baseUrl: "https://isms.celcomafrica.com/api/services/sendsms",
  apiKey: process.env.CELCOM_API_KEY,
  partnerID: process.env.CELCOM_PARTNER_ID,
  defaultShortcode: process.env.SMS_SENDER_ID || "MularCredit",
};

const SMSService = {
  formatPhone(phone) {
    if (!phone) return "";

    const cleaned = String(phone).replace(/\D/g, "");

    if (cleaned.startsWith("254") && cleaned.length === 12) return cleaned;
    if (cleaned.startsWith("0") && cleaned.length === 10)
      return "254" + cleaned.substring(1);
    if (cleaned.length === 9 && /^[71]/.test(cleaned))
      return "254" + cleaned;

    return "";
  },

  async sendSMS({ phone, message, tenantId, customerId }) {
    const formattedPhone = this.formatPhone(phone);

    if (!formattedPhone) {
      await this.logSMS({
        phone,
        message,
        status: "failed",
        error: "Invalid phone format",
        tenantId,
        customerId,
      });
      return { success: false };
    }

    const encodedMessage = encodeURIComponent(message.trim());
    const url = `${CELCOM_AFRICA_CONFIG.baseUrl}/?apikey=${CELCOM_AFRICA_CONFIG.apiKey}&partnerID=${CELCOM_AFRICA_CONFIG.partnerID}&message=${encodedMessage}&shortcode=${CELCOM_AFRICA_CONFIG.defaultShortcode}&mobile=${formattedPhone}`;

    try {
      await fetch(url, { method: "GET" });

      const messageId = `sms-${Date.now()}`;

      await this.logSMS({
        phone: formattedPhone,
        message,
        status: "sent",
        messageId,
        tenantId,
        customerId,
      });

      return { success: true, messageId };
    } catch (err) {
      await this.logSMS({
        phone: formattedPhone,
        message,
        status: "failed",
        error: err.message,
        tenantId,
        customerId,
      });

      return { success: false };
    }
  },

  async logSMS({
    phone,
    message,
    status,
    error,
    messageId,
    tenantId,
    customerId,
  }) {
    await supabase.from("sms_logs").insert({
      recipient_phone: phone,
      message,
      status,
      error_message: error,
      message_id: messageId,
      sender_id: null,
      tenant_id: tenantId,
      customer_id: customerId,
    });
  },
};

export default SMSService;
