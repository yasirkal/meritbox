import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "./password";
import type { Membership, Organization, Role, Session, User } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { randomToken, sha256 } from "./crypto";
import { clientIp, userAgent } from "./request";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-mb_session" : "mb_session";

export { hashPassword, verifyPassword };

export const MIN_PASSWORD = 12;
const COMMON = new Set(["password1234", "123456789012", "qwertyuiop12", "letmein12345", "welcome12345", "password123!"]);
export function passwordProblem(pw: string, email?: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (pw.length > 256) return "Password is too long.";
  if (COMMON.has(pw.toLowerCase())) return "That password is too common.";
  if (email && pw.toLowerCase().includes(email.split("@")[0]!.toLowerCase())) return "Don't include your email in your password.";
  return null;
}

export async function createSession(userId: string, opts: { mfaVerified: boolean; activeOrgId?: string | null }) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + env.sessionTtlHours * 3600_000);
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      mfaVerified: opts.mfaVerified,
      activeOrgId: opts.activeOrgId ?? null,
      ip: await clientIp(),
      userAgent: await userAgent(),
      expiresAt,
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export type SessionWithUser = Session & { user: User };

export const getSession = cache(async (): Promise<SessionWithUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session;
});

export async function requireUser(next = "/wallet") {
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(next)}`);
  return s;
}

const RANK: Record<Role, number> = { VIEWER: 1, ISSUER: 2, ADMIN: 3, OWNER: 4 };
export const hasRole = (have: Role, need: Role) => RANK[have] >= RANK[need];

export interface StaffContext {
  session: SessionWithUser;
  user: User;
  org: Organization;
  membership: Membership;
  memberships: (Membership & { organization: Organization })[];
}

/**
 * Gate for every /dashboard page and staff server action.
 * Enforces: signed in → MFA verified (if enrolled) → MFA enrolled (if org requires) → role.
 */
export const requireStaff = cache(async (minRole: Role = "VIEWER", opts?: { allowMfaSetup?: boolean }): Promise<StaffContext> => {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");
  if (session.user.totpEnabled && !session.mfaVerified) redirect("/login/mfa");
  const memberships = await db.membership.findMany({
    where: { userId: session.userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) redirect("/wallet");
  const membership = memberships.find((m) => m.organizationId === session.activeOrgId) ?? memberships[0]!;
  const org = membership.organization;
  if (org.requireMfa && !session.user.totpEnabled && !opts?.allowMfaSetup) redirect("/dashboard/security?enrol=1");
  if (!hasRole(membership.role, minRole)) redirect("/dashboard?denied=1");
  return { session, user: session.user, org, membership, memberships };
});
