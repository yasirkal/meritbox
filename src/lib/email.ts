import "server-only";
import { db } from "./db";
import { env } from "./env";

/**
 * Transactional email. Every message is recorded in the outbox; the "log" transport stops there
 * (development — view at /dev/outbox). "ses" sends through Amazon SES (ap-southeast-2) from a domain
 * with SPF, DKIM and DMARC p=reject (see infra/terraform/dns.tf).
 */
export async function sendEmail(to: string, subject: string, text: string) {
  const msg = await db.outboxEmail.create({ data: { to, subject, text } });
  if (env.emailTransport === "log") {
    if (!env.isProd) console.info(`[email] to=${to} subject="${subject}"\n${text}\n`);
    return msg;
  }
  await deliver(to, subject, text);
  return db.outboxEmail.update({ where: { id: msg.id }, data: { sentAt: new Date() } });
}

async function deliver(to: string, subject: string, text: string): Promise<void> {
  if (env.emailTransport !== "ses") throw new Error(`Unknown EMAIL_TRANSPORT=${env.emailTransport}`);
  // Amazon SES in Sydney; credentials come from the ECS task role.
  const { SESv2Client, SendEmailCommand } = await import("@aws-sdk/client-sesv2");
  const client = new SESv2Client({ region: process.env.AWS_REGION ?? "ap-southeast-2" });
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: env.emailFrom,
      Destination: { ToAddresses: [to] },
      Content: { Simple: { Subject: { Data: subject, Charset: "UTF-8" }, Body: { Text: { Data: text, Charset: "UTF-8" } } } },
    }),
  );
}
