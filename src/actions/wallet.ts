"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, hashPassword, passwordProblem, getSession, createSession } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/components/ActionForm";

export async function setVisibility(fd: FormData) {
  const s = await requireUser();
  const id = String(fd.get("id"));
  const visibility = fd.get("visibility") === "PRIVATE" ? "PRIVATE" : "LINK";
  const r = await db.credential.updateMany({ where: { id, recipientUserId: s.userId }, data: { visibility } });
  if (r.count) await audit({ action: `wallet.visibility.${visibility.toLowerCase()}`, actorUserId: s.userId, targetType: "Credential", targetId: id });
  revalidatePath("/wallet");
}

/** Accept a team invitation. New users set a password; existing users must be signed in as the invited email. */
export async function acceptInvite(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const token = String(fd.get("token") ?? "");
  const invite = await db.invite.findUnique({ where: { tokenHash: sha256(token) }, include: { organization: true } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return { error: "This invitation has expired or was already used." };
  const session = await getSession();
  let user = await db.user.findUnique({ where: { email: invite.email } });
  if (user?.passwordHash) {
    if (session?.userId !== user.id) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(invite.email)}`);
  } else {
    const name = String(fd.get("name") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (!name) return { error: "Enter your name." };
    const problem = passwordProblem(password, invite.email);
    if (problem) return { error: problem };
    user = user
      ? await db.user.update({ where: { id: user.id }, data: { name, passwordHash: await hashPassword(password), emailVerifiedAt: new Date() } })
      : await db.user.create({ data: { email: invite.email, name, passwordHash: await hashPassword(password), emailVerifiedAt: new Date() } });
    await createSession(user.id, { mfaVerified: false, activeOrgId: invite.organizationId });
  }
  await db.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: invite.organizationId } },
    create: { userId: user.id, organizationId: invite.organizationId, role: invite.role },
    update: { role: invite.role },
  });
  await db.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  if (session?.userId === user.id) await db.session.update({ where: { id: session.id }, data: { activeOrgId: invite.organizationId } });
  await audit({ action: "member.joined", organizationId: invite.organizationId, actorUserId: user.id, meta: { role: invite.role } });
  redirect("/dashboard");
}
