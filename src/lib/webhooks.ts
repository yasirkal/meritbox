import "server-only";
import { createHmac } from "node:crypto";
import { db } from "./db";
import { decrypt } from "./crypto";

export const WEBHOOK_EVENTS = ["credential.issued", "credential.revoked", "credential.claimed", "pathway.completed"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Only public HTTPS endpoints; blocks obvious SSRF targets (also enforce egress rules at the VPC). */
export function webhookUrlProblem(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "Enter a valid URL.";
  }
  if (u.protocol !== "https:") return "Webhook URLs must use HTTPS.";
  const h = u.hostname;
  if (
    h === "localhost" ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.endsWith(".internal") ||
    h.endsWith(".local") ||
    h.includes("[")
  )
    return "Webhook URLs must be publicly routable.";
  return null;
}

export function signPayload(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** Fire-and-forget delivery with a short timeout. Receivers verify `Meritbox-Signature`. */
export async function dispatchWebhook(organizationId: string, event: WebhookEvent, data: unknown) {
  const hooks = await db.webhook.findMany({ where: { organizationId, active: true, events: { has: event } } });
  await Promise.all(
    hooks.map(async (h) => {
      const body = JSON.stringify({ event, createdAt: new Date().toISOString(), data });
      const ts = Math.floor(Date.now() / 1000).toString();
      const sig = signPayload(decrypt(h.secretEnc, `webhook:${h.id}`), ts, body);
      let status = 0;
      try {
        const res = await fetch(h.url, {
          method: "POST",
          headers: { "content-type": "application/json", "meritbox-signature": `t=${ts},v1=${sig}`, "user-agent": "Meritbox-Webhooks/1" },
          body,
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        });
        status = res.status;
      } catch {
        status = 0;
      }
      await db.webhook.update({ where: { id: h.id }, data: { lastStatus: status } });
    }),
  );
}
