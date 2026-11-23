"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Papa from "papaparse";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { encrypt, decrypt, randomToken, sha256 } from "@/lib/crypto";
import { issueCredential, reinstateCredential, revokeCredential, USI_RE } from "@/lib/issuance";
import { createApiKey, API_SCOPES, type ApiScope } from "@/lib/apikeys";
import { WEBHOOK_EVENTS, webhookUrlProblem } from "@/lib/webhooks";
import { rotateKey } from "@/lib/keys";
import { sendEmail } from "@/lib/email";
import { checkTotp, newTotpSecret } from "@/lib/totp";
import { ASC_CORE_COMPETENCIES, TGA_SAMPLE } from "@/lib/catalog";
import { BADGE_ICONS, BADGE_SHAPES } from "@/lib/badge-svg";
import type { ActionResult } from "@/components/ActionForm";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optStr = (fd: FormData, k: string) => str(fd, k) || null;
const optInt = (fd: FormData, k: string) => (str(fd, k) ? Number.parseInt(str(fd, k), 10) : null);

// ---------------------------------------------------------------- achievements

const AchievementSchema = z.object({
  name: z.string().min(2).max(140),
  description: z.string().min(10).max(4000),
  criteria: z.string().min(5).max(4000),
  achievementType: z.string().min(2).max(40),
  volumeOfLearningHours: z.number().int().min(1).max(5000).nullable(),
  aqfLevel: z.number().int().min(1).max(10).nullable(),
  assessmentType: z.string().max(80).nullable(),
  deliveryMode: z.string().max(80).nullable(),
  creditRecognition: z.string().max(500).nullable(),
  industryEndorsement: z.string().max(500).nullable(),
  creditPoints: z.number().min(0).max(1000).nullable(),
  tgaCode: z.string().regex(/^[A-Z0-9]{4,16}$/).nullable(),
  fieldOfStudy: z.string().max(120).nullable(),
  badgeShape: z.enum(BADGE_SHAPES),
  badgeIcon: z.enum(BADGE_ICONS),
  badgeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  badgeAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  expiresAfterDays: z.number().int().min(1).max(36500).nullable(),
});

export async function saveAchievement(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { org, user } = await requireStaff("ISSUER");
  const id = optStr(fd, "id");
  const cp = str(fd, "creditPoints");
  const parsed = AchievementSchema.safeParse({
    name: str(fd, "name"),
    description: str(fd, "description"),
    criteria: str(fd, "criteria"),
    achievementType: str(fd, "achievementType"),
    volumeOfLearningHours: optInt(fd, "volumeOfLearningHours"),
    aqfLevel: optInt(fd, "aqfLevel"),
    assessmentType: optStr(fd, "assessmentType"),
    deliveryMode: optStr(fd, "deliveryMode"),
    creditRecognition: optStr(fd, "creditRecognition"),
    industryEndorsement: optStr(fd, "industryEndorsement"),
    creditPoints: cp ? Number(cp) : null,
    tgaCode: optStr(fd, "tgaCode")?.toUpperCase() ?? null,
    fieldOfStudy: optStr(fd, "fieldOfStudy"),
    badgeShape: str(fd, "badgeShape") || "hexagon",
    badgeIcon: str(fd, "badgeIcon") || "star",
    badgeColor: str(fd, "badgeColor") || "#0f4c81",
    badgeAccent: str(fd, "badgeAccent") || "#f2a900",
    expiresAfterDays: optInt(fd, "expiresAfterDays"),
  });
  if (!parsed.success) {
    const f = parsed.error.issues[0];
    return { error: `Check the "${String(f?.path[0])}" field: ${f?.message}` };
  }
  const data = parsed.data;
  let tgaTitle = optStr(fd, "tgaTitle");
  if (data.tgaCode && !tgaTitle) {
    tgaTitle = (await db.tgaComponent.findUnique({ where: { code: data.tgaCode } }))?.title ?? TGA_SAMPLE.find((t) => t.code === data.tgaCode)?.title ?? null;
  }
  const core = fd.getAll("ascSkill").map(String).filter((s) => ASC_CORE_COMPETENCIES.includes(s));
  const custom = str(fd, "customSkills").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
  const skills = [
    ...core.map((name) => ({ name, framework: "Australian Skills Classification" })),
    ...custom.map((name) => ({ name: name.slice(0, 80), framework: org.name })),
  ];
  const tags = str(fd, "tags").split(",").map((t) => t.trim().slice(0, 40)).filter(Boolean).slice(0, 20);
  const record = { ...data, tgaTitle, skills, tags };

  if (id) {
    const existing = await db.achievement.findFirst({ where: { id, organizationId: org.id } });
    if (!existing) return { error: "Not found." };
    await db.achievement.update({ where: { id }, data: record });
    await audit({ action: "achievement.updated", organizationId: org.id, actorUserId: user.id, targetType: "Achievement", targetId: id });
    revalidatePath(`/dashboard/achievements/${id}`);
    return { ok: "Saved. Changes apply to credentials issued from now on — already-issued credentials are signed and don't change." };
  }
  const created = await db.achievement.create({ data: { ...record, organizationId: org.id } });
  await audit({ action: "achievement.created", organizationId: org.id, actorUserId: user.id, targetType: "Achievement", targetId: created.id });
  redirect(`/dashboard/achievements/${created.id}?created=1`);
}

export async function setAchievementStatus(fd: FormData) {
  const { org, user } = await requireStaff("ADMIN");
  const id = str(fd, "id");
  const status = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).parse(str(fd, "status"));
  const r = await db.achievement.updateMany({ where: { id, organizationId: org.id }, data: { status } });
  if (r.count) await audit({ action: `achievement.${status.toLowerCase()}`, organizationId: org.id, actorUserId: user.id, targetType: "Achievement", targetId: id });
  revalidatePath(`/dashboard/achievements/${id}`);
}

// ---------------------------------------------------------------- issuance

const RecipientSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(160),
  usi: z.string().trim().toUpperCase().regex(USI_RE, "USI must be 10 characters").optional().or(z.literal("")),
  studentId: z.string().trim().max(40).optional(),
  evidenceUrl: z.string().trim().url().max(500).refine((u) => /^https?:\/\//.test(u), "http(s) only").optional().or(z.literal("")),
  narrative: z.string().trim().max(2000).optional(),
  issuedOn: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

async function loadIssuable(orgId: string, achievementId: string) {
  const a = await db.achievement.findFirst({ where: { id: achievementId, organizationId: orgId } });
  if (!a) throw new Error("Choose a credential to issue.");
  if (a.status !== "PUBLISHED") throw new Error(`"${a.name}" is a draft. Publish it before issuing.`);
  return a;
}

export async function issueSingle(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { org, user } = await requireStaff("ISSUER");
  const p = RecipientSchema.safeParse({
    email: str(fd, "email"),
    name: str(fd, "name"),
    usi: str(fd, "usi"),
    studentId: str(fd, "studentId"),
    evidenceUrl: str(fd, "evidenceUrl"),
    narrative: str(fd, "narrative"),
    issuedOn: str(fd, "issuedOn"),
  });
  if (!p.success) return { error: p.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`).join("; ") };
  try {
    const achievement = await loadIssuable(org.id, str(fd, "achievementId"));
    const c = await issueCredential(
      { org, achievement, actorUserId: user.id, notify: fd.get("notify") !== "off" },
      { ...p.data, issuedAt: p.data.issuedOn ? new Date(`${p.data.issuedOn}T00:00:00+10:00`) : null },
    );
    revalidatePath("/dashboard/credentials");
    return { ok: `Issued to ${c.recipientName}. Share link: ${env.appUrl}/c/${c.id}` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const MAX_BULK = 5000;

export async function issueBulk(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { org, user } = await requireStaff("ISSUER");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file." };
  if (file.size > 4_000_000) return { error: "CSV must be under 4 MB." };
  let achievement;
  try {
    achievement = await loadIssuable(org.id, str(fd, "achievementId"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const parsed = Papa.parse<Record<string, string>>(await file.text(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"),
  });
  const rows = parsed.data;
  if (!rows.length) return { error: "The CSV has no rows." };
  if (rows.length > MAX_BULK) return { error: `Up to ${MAX_BULK} rows per batch. Split the file.` };
  if (!parsed.meta.fields?.includes("email") || !parsed.meta.fields.includes("name"))
    return { error: "The CSV needs at least 'email' and 'name' columns." };

  const batch = await db.issuanceBatch.create({
    data: { organizationId: org.id, achievementId: achievement.id, createdById: user.id, source: "csv", total: rows.length },
  });
  const errors: { row: number; error: string }[] = [];
  let ok = 0;
  const seen = new Set<string>();
  for (const [i, row] of rows.entries()) {
    const rowNo = i + 2;
    const p = RecipientSchema.safeParse({
      email: row.email ?? "",
      name: row.name ?? "",
      usi: row.usi ?? "",
      studentId: row.student_id ?? "",
      evidenceUrl: row.evidence_url ?? "",
      narrative: row.narrative ?? "",
      issuedOn: row.issued_on ?? "",
    });
    if (!p.success) {
      errors.push({ row: rowNo, error: p.error.issues.map((x) => `${String(x.path[0])}: ${x.message}`).join("; ") });
      continue;
    }
    if (seen.has(p.data.email)) {
      errors.push({ row: rowNo, error: "Duplicate email in this file" });
      continue;
    }
    seen.add(p.data.email);
    try {
      await issueCredential(
        { org, achievement, actorUserId: user.id, batchId: batch.id, notify: fd.get("notify") !== "off" },
        { ...p.data, issuedAt: p.data.issuedOn ? new Date(`${p.data.issuedOn}T00:00:00+10:00`) : null },
      );
      ok++;
    } catch (e) {
      errors.push({ row: rowNo, error: (e as Error).message });
    }
  }
  await db.issuanceBatch.update({ where: { id: batch.id }, data: { succeeded: ok, failed: errors.length, errors } });
  await audit({ action: "batch.completed", organizationId: org.id, actorUserId: user.id, targetType: "IssuanceBatch", targetId: batch.id, meta: { ok, failed: errors.length } });
  revalidatePath("/dashboard/credentials");
  if (errors.length) {
    return {
      error: `Issued ${ok} of ${rows.length}. ${errors.length} row(s) failed: ` + errors.slice(0, 10).map((e) => `row ${e.row} (${e.error})`).join(", ") + (errors.length > 10 ? "…" : ""),
    };
  }
  return { ok: `Issued all ${ok} credentials.` };
}

export async function revoke(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { org, user } = await requireStaff("ADMIN");
  const reason = str(fd, "reason");
  if (reason.length < 3) return { error: "Give a reason. It is shown to anyone who verifies the credential." };
  try {
    await revokeCredential({ organizationId: org.id, credentialId: str(fd, "id"), reason, actorUserId: user.id });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/dashboard/credentials/${str(fd, "id")}`);
  return { ok: "Credential revoked. Verifiers will see this immediately." };
}

export async function reinstate(fd: FormData) {
  const { org, user } = await requireStaff("ADMIN");
  await reinstateCredential({ organizationId: org.id, credentialId: str(fd, "id"), actorUserId: user.id });
  revalidatePath(`/dashboard/credentials/${str(fd, "id")}`);
}

export async function resendClaim(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { org, user } = await requireStaff("ISSUER");
  const c = await db.credential.findFirst({ where: { id: str(fd, "id"), organizationId: org.id }, include: { achievement: true } });
  if (!c) return { error: "Not found." };
  const token = randomToken();
  await db.loginToken.create({ data: { email: c.recipientEmail, tokenHash: sha256(token), purpose: `claim:${c.id}`, expiresAt: new Date(Date.now() + 30 * 86400_000) } });
  await sendEmail(c.recipientEmail, `Reminder: claim your ${c.achievement.name} credential`, `Hi ${c.recipientName},\n\n${org.name} issued you "${c.achievement.name}". Add it to your wallet:\n${env.appUrl}/claim/${token}\n`);
  await audit({ action: "credential.claim_resent", organizationId: org.id, actorUserId: user.id, targetType: "Credential", targetId: c.id });
  return { ok: `Sent a new claim link to ${c.recipientEmail}.` };
}

// ---------------------------------------------------------------- pathways

export async function savePathway(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { org, user } = await requireStaff("ADMIN");
  const name = str(fd, "name");
  const description = str(fd, "description");
  const steps = [...new Set(fd.getAll("steps").map(String))];
  const reward = optStr(fd, "rewardAchievementId");
  if (name.length < 2) return { error: "Name the pathway." };
  if (steps.length < 2) return { error: "Choose at least two credentials as steps." };
  if (reward && steps.includes(reward)) return { error: "The reward can't also be a step." };
  const owned = await db.achievement.count({ where: { organizationId: org.id, id: { in: [...steps, ...(reward ? [reward] : [])] } } });
  if (owned !== steps.length + (reward ? 1 : 0)) return { error: "Unknown credential selected." };
  const p = await db.pathway.create({
    data: {
      organizationId: org.id,
      name,
      description,
      rewardAchievementId: reward,
      steps: { create: steps.map((achievementId, position) => ({ achievementId, position })) },
    },
  });
  await audit({ action: "pathway.created", organizationId: org.id, actorUserId: user.id, targetType: "Pathway", targetId: p.id });
  revalidatePath("/dashboard/pathways");
  return { ok: `Pathway "${name}" created. Learners who hold every step are awarded the reward automatically.` };
}

export async function deletePathway(fd: FormData) {
  const { org, user } = await requireStaff("ADMIN");
  const id = str(fd, "id");
  const r = await db.pathway.deleteMany({ where: { id, organizationId: org.id } });
  if (r.count) await audit({ action: "pathway.deleted", organizationId: org.id, actorUserId: user.id, targetType: "Pathway", targetId: id });
  revalidatePath("/dashboard/pathways");
}

// ---------------------------------------------------------------- team

const ROLES: Role[] = ["OWNER", "ADMIN", "ISSUER", "VIEWER"];

export async function inviteMember(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { org, user, membership } = await requireStaff("ADMIN");
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role") as Role;
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email." };
  if (!ROLES.includes(role) || (role === "OWNER" && membership.role !== "OWNER")) return { error: "You can't grant that role." };
  const token = randomToken();
  await db.invite.create({ data: { organizationId: org.id, email, role, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 86400_000) } });
  await sendEmail(email, `You've been invited to issue credentials for ${org.name}`, `${user.name} invited you to join ${org.name} on Meritbox as ${role.toLowerCase()}.\n\nAccept (valid 7 days): ${env.appUrl}/invite/${token}\n`);
  await audit({ action: "member.invited", organizationId: org.id, actorUserId: user.id, meta: { email, role } });
  revalidatePath("/dashboard/team");
  return { ok: `Invitation sent to ${email}.` };
}

export async function changeRole(fd: FormData) {
  const { org, user, membership } = await requireStaff("ADMIN");
  const id = str(fd, "membershipId");
  const role = str(fd, "role") as Role;
  const target = await db.membership.findFirst({ where: { id, organizationId: org.id } });
  if (!target || !ROLES.includes(role)) return;
  if ((target.role === "OWNER" || role === "OWNER") && membership.role !== "OWNER") return;
  if (target.role === "OWNER" && role !== "OWNER" && (await db.membership.count({ where: { organizationId: org.id, role: "OWNER" } })) < 2) return;
  await db.membership.update({ where: { id }, data: { role } });
  await audit({ action: "member.role_changed", organizationId: org.id, actorUserId: user.id, targetType: "Membership", targetId: id, meta: { from: target.role, to: role } });
  revalidatePath("/dashboard/team");
}

export async function removeMember(fd: FormData) {
  const { org, user, membership } = await requireStaff("ADMIN");
  const id = str(fd, "membershipId");
  const target = await db.membership.findFirst({ where: { id, organizationId: org.id } });
  if (!target || target.userId === user.id) return;
  if (target.role === "OWNER" && membership.role !== "OWNER") return;
  await db.membership.delete({ where: { id } });
  await db.session.updateMany({ where: { userId: target.userId, activeOrgId: org.id }, data: { activeOrgId: null } });
  await audit({ action: "member.removed", organizationId: org.id, actorUserId: user.id, targetType: "Membership", targetId: id });
  revalidatePath("/dashboard/team");
}

// ---------------------------------------------------------------- developers

export async function newApiKey(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { org, user } = await requireStaff("ADMIN");
  const name = str(fd, "name");
  const scopes = fd.getAll("scopes").map(String).filter((s): s is ApiScope => (API_SCOPES as readonly string[]).includes(s));
  if (!name) return { error: "Name the key (e.g. 'Moodle production')." };
  if (!scopes.length) return { error: "Choose at least one scope." };
  const { key, plaintext } = await createApiKey(org.id, name, scopes, user.id);
  await audit({ action: "apikey.created", organizationId: org.id, actorUserId: user.id, targetType: "ApiKey", targetId: key.id, meta: { scopes } });
  revalidatePath("/dashboard/developers");
  return { ok: `Created "${name}".`, secret: plaintext };
}

export async function revokeApiKey(fd: FormData) {
  const { org, user } = await requireStaff("ADMIN");
  const id = str(fd, "id");
  const r = await db.apiKey.updateMany({ where: { id, organizationId: org.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (r.count) await audit({ action: "apikey.revoked", organizationId: org.id, actorUserId: user.id, targetType: "ApiKey", targetId: id });
  revalidatePath("/dashboard/developers");
}

export async function newWebhook(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { org, user } = await requireStaff("ADMIN");
  const url = str(fd, "url");
  const problem = webhookUrlProblem(url);
  if (problem) return { error: problem };
  const events = fd.getAll("events").map(String).filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
  if (!events.length) return { error: "Choose at least one event." };
  const secret = `whsec_${randomToken(24)}`;
  const id = crypto.randomUUID();
  await db.webhook.create({ data: { id, organizationId: org.id, url, events, secretEnc: encrypt(secret, `webhook:${id}`) } });
  await audit({ action: "webhook.created", organizationId: org.id, actorUserId: user.id, targetType: "Webhook", targetId: id, meta: { url, events } });
  revalidatePath("/dashboard/developers");
  return { ok: "Webhook added. Use this signing secret to verify the Meritbox-Signature header.", secret };
}

export async function deleteWebhook(fd: FormData) {
  const { org, user } = await requireStaff("ADMIN");
  const id = str(fd, "id");
  const r = await db.webhook.deleteMany({ where: { id, organizationId: org.id } });
  if (r.count) await audit({ action: "webhook.deleted", organizationId: org.id, actorUserId: user.id, targetType: "Webhook", targetId: id });
  revalidatePath("/dashboard/developers");
}

// ---------------------------------------------------------------- settings

const OrgSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).nullable(),
  website: z.string().trim().url().refine((u) => u.startsWith("https://"), "Use an https:// address").nullable(),
  email: z.string().trim().email().nullable(),
  abn: z.string().trim().regex(/^\d{11}$/, "ABN is 11 digits").nullable(),
  rtoCode: z.string().trim().regex(/^\d{4,6}$/, "RTO codes are 4–6 digits").nullable(),
  cricosCode: z.string().trim().regex(/^[0-9]{5}[A-Z]$/, "CRICOS provider codes look like 00123A").nullable(),
  teqsaId: z.string().trim().regex(/^PRV\d{5}$/, "TEQSA IDs look like PRV12345").nullable(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function saveOrg(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { org, user, membership } = await requireStaff("ADMIN");
  const p = OrgSchema.safeParse({
    name: str(fd, "name"),
    description: optStr(fd, "description"),
    website: optStr(fd, "website"),
    email: optStr(fd, "email"),
    abn: optStr(fd, "abn")?.replace(/\s/g, "") ?? null,
    rtoCode: optStr(fd, "rtoCode"),
    cricosCode: optStr(fd, "cricosCode")?.toUpperCase() ?? null,
    teqsaId: optStr(fd, "teqsaId")?.toUpperCase() ?? null,
    brandColor: str(fd, "brandColor") || org.brandColor,
  });
  if (!p.success) return { error: p.error.issues.map((i) => i.message).join("; ") };
  const requireMfa = fd.get("requireMfa") === "on";
  if (!requireMfa && membership.role !== "OWNER") return { error: "Only owners can turn off enforced MFA." };
  await db.organization.update({ where: { id: org.id }, data: { ...p.data, requireMfa } });
  await audit({ action: "organization.updated", organizationId: org.id, actorUserId: user.id, meta: { requireMfa } });
  revalidatePath("/dashboard/settings");
  return { ok: "Saved. Issuer details appear in credentials issued from now on." };
}

export async function rotateKeyAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { org, user } = await requireStaff("OWNER");
  const alg = str(fd, "alg") === "EdDSA" ? "EdDSA" : "RS256";
  const k = await rotateKey(org.id, alg);
  await audit({ action: "key.rotated", organizationId: org.id, actorUserId: user.id, targetType: "SigningKey", targetId: k.id, meta: { kid: k.kid, alg } });
  revalidatePath("/dashboard/settings");
  return { ok: `New ${alg} signing key ${k.kid} is active. Earlier credentials remain verifiable with the retired key.` };
}

export async function switchOrg(fd: FormData) {
  const { session, memberships } = await requireStaff("VIEWER", { allowMfaSetup: true });
  const orgId = str(fd, "orgId");
  if (memberships.some((m) => m.organizationId === orgId)) await db.session.update({ where: { id: session.id }, data: { activeOrgId: orgId } });
  redirect("/dashboard");
}

// ---------------------------------------------------------------- MFA

export async function startMfa(): Promise<void> {
  const { user } = await requireStaff("VIEWER", { allowMfaSetup: true });
  if (user.totpEnabled) return;
  await db.user.update({ where: { id: user.id }, data: { totpSecretEnc: encrypt(newTotpSecret(), `totp:${user.id}`) } });
  revalidatePath("/dashboard/security");
}

export async function confirmMfa(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { user, session } = await requireStaff("VIEWER", { allowMfaSetup: true });
  if (!user.totpSecretEnc) return { error: "Start enrolment first." };
  if (!checkTotp(decrypt(user.totpSecretEnc, `totp:${user.id}`), str(fd, "code").replace(/\s/g, ""))) return { error: "That code didn't match. Try the next one." };
  await db.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
  await db.session.update({ where: { id: session.id }, data: { mfaVerified: true } });
  await db.session.deleteMany({ where: { userId: user.id, id: { not: session.id } } });
  await audit({ action: "auth.mfa_enabled", actorUserId: user.id });
  redirect("/dashboard?mfa=1");
}

export async function disableMfa(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const { user, memberships } = await requireStaff("VIEWER");
  if (memberships.some((m) => m.organization.requireMfa)) return { error: "Your institution requires two-factor authentication." };
  if (!user.totpSecretEnc || !checkTotp(decrypt(user.totpSecretEnc, `totp:${user.id}`), str(fd, "code"))) return { error: "Enter a current code to confirm." };
  await db.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecretEnc: null } });
  await audit({ action: "auth.mfa_disabled", actorUserId: user.id });
  return { ok: "Two-factor authentication turned off." };
}
