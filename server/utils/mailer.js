import SibApiV3Sdk from "sib-api-v3-sdk";
import "dotenv/config";

// --- Configuration ---
const defaultClient = SibApiV3Sdk.ApiClient.instance;

// Use BREVO_API_KEY from env
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

/**
 * Brevo HTTP API Transporter Wrapper
 * Mimics Nodemailer's sendMail interface to maintain compatibility.
 */
const transporter = {
    /**
     * Sends an email using Brevo's HTTP API.
     * @param {Object} mailOptions - The email options (from, to, subject, html, text).
     * @returns {Promise<Object>} - The API response.
     */
    sendMail: async (mailOptions) => {
        const { from, to, subject, html, text } = mailOptions;

        // Parse 'from' field (e.g., '"Name" <email@example.com>' vs 'email@example.com')
        let senderEmail = from;
        let senderName = "Jasiri App";

        if (from && from.includes("<")) {
            const match = from.match(/"?([^"]*)"?\s*<(.+)>/);
            if (match) {
                senderName = match[1].trim();
                senderEmail = match[2].trim();
            }
        }

        // Parse 'to' field (supports comma-separated string or array)
        let recipients = [];
        if (Array.isArray(to)) {
            recipients = to.map(email => ({ email }));
        } else if (typeof to === "string") {
            recipients = to.split(",").map(email => ({ email: email.trim() }));
        }

        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html || text; // Brevo requires htmlContent or textContent
        sendSmtpEmail.sender = { name: senderName, email: senderEmail };
        sendSmtpEmail.to = recipients;

        // Optional: Add plain text content if provided
        if (text) {
            sendSmtpEmail.textContent = text;
        }

        try {
            console.log(`📧 [Brevo API] Sending email to: ${JSON.stringify(recipients)}`);
            const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
            console.log("✅ [Brevo API] Email sent successfully. MessageId:", data.messageId);
            return data;
        } catch (error) {
            console.error("❌ [Brevo API] Email sending failed:", error);
            // Construct a familiar error object for existing error handlers
            const newError = new Error(error.message || "Email sending failed");
            newError.original = error;
            throw newError;
        }
    }
};

export default transporter;
