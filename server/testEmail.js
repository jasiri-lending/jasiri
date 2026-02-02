import nodemailer from "nodemailer";
import "dotenv/config";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: "a14ef2001@smtp-brevo.com",
    pass: process.env.BREVO_SMTP_KEY
  }
});

const sendTest = async () => {
  try {
    const info = await transporter.sendMail({
      from: '"Jasirilendingsoftware" <a14ef2001@smtp-brevo.com>',
      to: "derickmaloba19@gmail.com", // replace with your email
      subject: "Test Email from Brevo SMTP",
      text: "This is a test email.",
      html: "<p>This is a test email.</p>"
    });

    console.log("✅ Email sent:", info.response);
  } catch (err) {
    console.error("❌ Email failed:", err);
  }
};

sendTest();
