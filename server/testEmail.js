import SibApiV3Sdk from "sib-api-v3-sdk";
import "dotenv/config";

const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

const sendTest = async () => {
  try {
    const sendSmtpEmail = {
      to: [{ email: "derickmaloba19@gmail.com" }], // replace with your email
      sender: { email: "derickgreen18@gmail.com", name: "JasiriLendingSoftware" },
      subject: "Test Email via Brevo API",
      htmlContent: "<p>This is a test email sent via the Brevo API.</p>",
    };

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("✅ Email sent:", result);
  } catch (err) {
    console.error("❌ Email failed:", err);
  }
};

sendTest();
