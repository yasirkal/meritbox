import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Application-layer encryption for secrets at rest (signing keys, TOTP seeds, USIs, webhook secrets).
 * Format: "v1.<iv>.<tag>.<ciphertext>" (base64url). AES-256-GCM with a 96-bit random IV.
 * The master key would come from AWS KMS (data key) in production; see docs/ARCHITECTURE.md.
 */
function masterKey(): Buffer {
  const raw = process.env.MERITBOX_MASTER_KEY;
  if (!raw) throw new Error("MERITBOX_MASTER_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("MERITBOX_MASTER_KEY must decode to 32 bytes");
  return key;
}

function subKey(purpose: string): Buffer {
  return createHmac("sha256", masterKey()).update(`meritbox:${purpose}`).digest();
}

export function encrypt(plaintext: string, aad = ""): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", subKey("enc"), iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decrypt(blob: string, aad = ""): string {
  const [v, iv, tag, ct] = blob.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unsupported ciphertext format");
  const decipher = createDecipheriv("aes-256-gcm", subKey("enc"), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

/** Deterministic keyed hash, used as a blind index (e.g. find credentials by USI without decrypting). */
export function blindIndex(value: string, purpose: string): string {
  return createHmac("sha256", subKey(`idx:${purpose}`)).update(value.trim().toUpperCase()).digest("base64url");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
