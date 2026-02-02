import nodemailer from "nodemailer";
import "dotenv/config";

/**
 * Centralized email transporter configuration.
 * Uses variables from .env to ensure consistency across the application.
 */
const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false, // TLS
    auth: {
        user: "a14ef2001@smtp-brevo.com",
        pass: process.env.BREVO_SMTP_KEY,
    },
});

export default transporter;
