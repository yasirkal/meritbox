"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkTotp } from "@/lib/totp";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createSession, destroySession, getSession, hashPassword, passwordProblem, verifyPassword } from "@/lib/auth";
import { decrypt, randomToken, sha256 } from "@/lib/crypto";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";
import { sendEmail } from "@/lib/email";
import { audit } from "@/lib/audit";
import { generateSigningKey } from "@/lib/keys";
import { dispatchWebhook } from "@/lib/webhooks";
import type { ActionResult } from "@/components/ActionForm";

const safeNext = (n: unknown, fallback: string) =>
  typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : fallback;

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "issuer";
}

let dummy: Promise<string> | null = null;
const dummyHash = () => (dummy ??= hashPassword(randomToken(16)));

const SignupSchema = z.object({
  orgName: z.string().trim().min(2).max(120),
  orgType: z.enum(["UNIVERSITY", "TAFE", "RTO", "PROFESSIONAL_BODY", "EMPLOYER", "OTHER"]),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string(),
});

export async function signup(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const ip = await clientIp();
  if (!(await rateLimit(`signup:${ip}`, 5, 3600)).ok) return { error: "Too many sign-ups from your network. Try again later." };
  const p = SignupSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Please complete every field with valid details." };
  const { orgName, orgType, name, email, password } = p.data;
  const pwProblem = passwordProblem(password, email);
  if (pwProblem) return { error: pwProblem };
  if (await db.user.findUnique({ where: { email } })) return { error: "An account with that email already exists. Sign in instead." };

  let slug = slugify(orgName);
  if (await db.organization.findUnique({ where: { slug } })) slug = `${slug}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  const user = await db.user.create({ data: { email, name, passwordHash: await hashPassword(password) } });
  const org = await db.organization.create({
    data: { name: orgName, type: orgType, slug, email, memberships: { create: { userId: user.id, role: "OWNER" } } },
  });
  await generateSigningKey(org.id);
  await audit({ action: "organization.created", organizationId: org.id, actorUserId: user.id, targetType: "Organization", targetId: org.id });
  await sendVerifyEmail(email, name);
  await createSession(user.id, { mfaVerified: false, activeOrgId: org.id });
  redirect("/dashboard");
}

async function sendVerifyEmail(email: string, name: string) {
  const token = randomToken();
  await db.loginToken.create({ data: { email, tokenHash: sha256(token), purpose: "verify-email", expiresAt: new Date(Date.now() + 86400_000) } });
  await sendEmail(email, "Confirm your Meritbox email address", `Hi ${name},\n\nConfirm your email address:\n${env.appUrl}/login/link/${token}\n\nThis link expires in 24 hours.`);
}

export async function login(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([rateLimit(`login-ip:${ip}`, 30, 900), rateLimit(`login-email:${email}`, 10, 900)]);
  if (!byIp.ok || !byEmail.ok) return { error: "Too many sign-in attempts. Wait 15 minutes and try again." };

  const user = await db.user.findUnique({ where: { email } });
  const generic = { error: "Email or password is incorrect." };
  if (!user?.passwordHash) {
    await verifyPassword(await dummyHash(), password); // equalise timing for unknown accounts
    return generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { error: "This account is temporarily locked after repeated failed attempts. Try again in 15 minutes." };
  if (!(await verifyPassword(user.passwordHash, password))) {
    const failed = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: failed >= 5 ? 0 : failed, lockedUntil: failed >= 5 ? new Date(Date.now() + 15 * 60_000) : null },
    });
    await audit({ action: "auth.login_failed", actorUserId: user.id, meta: { locked: failed >= 5 } });
    return generic;
  }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  await createSession(user.id, { mfaVerified: !user.totpEnabled });
  await audit({ action: "auth.login", actorUserId: user.id });
  const next = safeNext(fd.get("next"), "/dashboard");
  if (user.totpEnabled) redirect(`/login/mfa?next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function verifyMfa(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await rateLimit(`mfa:${session.id}`, 8, 900)).ok) {
    await destroySession();
    return { error: "Too many incorrect codes. Sign in again." };
  }
  const code = String(fd.get("code") ?? "").replace(/\s/g, "");
  if (!session.user.totpSecretEnc || !checkTotp(decrypt(session.user.totpSecretEnc, `totp:${session.userId}`), code)) {
    return { error: "That code didn't work. Check your authenticator app's clock and try again." };
  }
  await db.session.update({ where: { id: session.id }, data: { mfaVerified: true } });
  await audit({ action: "auth.mfa_verified", actorUserId: session.userId });
  redirect(safeNext(fd.get("next"), "/dashboard"));
}

/** Passwordless sign-in for learners. Responds identically whether or not the email is known. */
export async function requestMagicLink(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email address." };
  const ip = await clientIp();
  if (!(await rateLimit(`magic:${ip}`, 10, 3600)).ok || !(await rateLimit(`magic-email:${email}`, 3, 900)).ok)
    return { error: "Too many requests. Try again shortly." };
  const known = (await db.user.findUnique({ where: { email } })) || (await db.credential.findFirst({ where: { recipientEmail: email } }));
  if (known) {
    const token = randomToken();
    await db.loginToken.create({ data: { email, tokenHash: sha256(token), purpose: "login", expiresAt: new Date(Date.now() + 15 * 60_000) } });
    await sendEmail(email, "Your Meritbox sign-in link", `Sign in to your Meritbox wallet (link valid for 15 minutes):\n${env.appUrl}/login/link/${token}\n\nIf you didn't ask for this, ignore this email.`);
  }
  return { ok: "If that email has a Meritbox wallet, a sign-in link is on its way." };
}

/**
 * Consumes a one-time emailed token (sign-in, email verification or credential claim).
 * Triggered by a button press, not GET, so email security scanners can't burn tokens.
 */
export async function consumeLink(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const token = String(fd.get("token") ?? "");
  const lt = await db.loginToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!lt || lt.usedAt || lt.expiresAt < new Date()) return { error: "This link has expired or has already been used. Request a new one." };
  await db.loginToken.update({ where: { id: lt.id }, data: { usedAt: new Date() } });

  let user = await db.user.findUnique({ where: { email: lt.email } });
  if (!user) {
    const anyCred = await db.credential.findFirst({ where: { recipientEmail: lt.email }, orderBy: { issuedAt: "desc" } });
    user = await db.user.create({ data: { email: lt.email, name: anyCred?.recipientName ?? lt.email.split("@")[0]!, emailVerifiedAt: new Date() } });
  } else if (!user.emailVerifiedAt) {
    user = await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  }
  // Possession of an emailed token proves control of the address: attach every credential issued to it.
  const attached = await db.credential.updateMany({
    where: { recipientEmail: lt.email, recipientUserId: null },
    data: { recipientUserId: user.id },
  });
  const newlyClaimed = await db.credential.findMany({ where: { recipientUserId: user.id, claimedAt: null }, select: { id: true, organizationId: true } });
  await db.credential.updateMany({ where: { id: { in: newlyClaimed.map((c) => c.id) } }, data: { claimedAt: new Date() } });
  for (const c of newlyClaimed) await dispatchWebhook(c.organizationId, "credential.claimed", { id: c.id });
  await audit({ action: `auth.link.${lt.purpose.split(":")[0]}`, actorUserId: user.id, meta: { attached: attached.count } });

  if (lt.purpose === "verify-email" && user.passwordHash) {
    const existing = await getSession();
    if (existing?.userId === user.id) redirect("/dashboard?verified=1");
    redirect("/login?verified=1");
  }
  // Staff accounts must still complete password + MFA; a link only ever grants wallet access.
  if (user.passwordHash) {
    redirect(`/login?next=/wallet&email=${encodeURIComponent(user.email)}&linked=1`);
  }
  await createSession(user.id, { mfaVerified: true });
  const claimId = lt.purpose.startsWith("claim:") ? lt.purpose.slice(6) : null;
  redirect(claimId ? `/wallet?claimed=${claimId}` : "/wallet");
}

export async function logout() {
  const s = await getSession();
  if (s) await audit({ action: "auth.logout", actorUserId: s.userId });
  await destroySession();
  redirect("/");
}
