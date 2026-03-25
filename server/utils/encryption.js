import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "jasiri_default_encryption_key_32ch";
const IV_LENGTH = 16;

/**
 * Encrypt text using AES-256-CBC
 */
export function encrypt(text) {
  if (!text) return null;
  // If already encrypted (heuristic: contains ':'), return as is to avoid double encryption
  if (typeof text === "string" && text.includes(":") && text.length > 32) return text;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      "aes-256-cbc", 
      Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32)), 
      iv
    );
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  } catch (err) {
    console.error("Encryption error:", err);
    return text;
  }
}

/**
 * Decrypt text using AES-256-CBC
 */
export function decrypt(text) {
  if (!text) return null;
  if (typeof text !== "string" || !text.includes(":")) return text; // Probably plain text

  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc", 
      Buffer.from(ENCRYPTION_KEY.padEnd(32).substring(0, 32)), 
      iv
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    console.error("Decryption error:", err);
    return text; // Return as is if decryption fails
  }
}
