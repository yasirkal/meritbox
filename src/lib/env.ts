import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  get appUrl(): string {
    return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get masterKey(): Buffer {
    const key = Buffer.from(required("MERITBOX_MASTER_KEY"), "base64");
    if (key.length !== 32) throw new Error("MERITBOX_MASTER_KEY must be 32 bytes, base64 encoded");
    return key;
  },
  get isProd(): boolean {
    return process.env.NODE_ENV === "production";
  },
  get sessionTtlHours(): number {
    return Number(process.env.SESSION_TTL_HOURS ?? 12);
  },
  get emailTransport(): string {
    return process.env.EMAIL_TRANSPORT ?? "log";
  },
  get emailFrom(): string {
    return process.env.EMAIL_FROM ?? "Meritbox <no-reply@meritbox.com.au>";
  },
  get securityContact(): string {
    return process.env.SECURITY_CONTACT ?? "mailto:security@meritbox.com.au";
  },
};
