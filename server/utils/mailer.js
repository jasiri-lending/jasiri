import nodemailer from "nodemailer";
import "dotenv/config";

/**
 * Centralized email transporter configuration.
 * Uses variables from .env to ensure consistency across the application.
 */
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "Gmail",
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
    },
});

export default transporter;
