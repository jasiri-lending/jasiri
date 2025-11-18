import fs from "fs";
import forge from "node-forge";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

// 1. Read certificate (Safaricom sandbox certificate)
const certPem = fs.readFileSync("SandboxCertificate.cer", "utf8");

// 2. Convert cert to public key
const cert = forge.pki.certificateFromPem(certPem);
const publicKeyPem = forge.pki.publicKeyToPem(cert.publicKey);

// 3. Get initiator password from .env
const password = process.env.MPESA_INITIATOR_PASSWORD;
if (!password) {
  console.error("❌ Please set MPESA_INITIATOR_PASSWORD in your .env");
  process.exit(1);
}

// 4. Encrypt using Node’s crypto with PEM public key
const encrypted = crypto.publicEncrypt(
  {
    key: publicKeyPem,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  },
  Buffer.from(password, "utf8")
);

console.log("✅ SecurityCredential:", encrypted.toString("base64"));
