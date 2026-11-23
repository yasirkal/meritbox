import "server-only";
import type { Achievement, Organization } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { env } from "./env";
import { blindIndex, encrypt, randomToken, sha256 } from "./crypto";
import { activeKey, kidUrl, privateJwkOf } from "./keys";
import { issuerInput } from "./issuer";
import { allocateStatusIndex, setStatus, statusListUrl } from "./status";
import { buildCredential, signVc, type SkillInput } from "./vc";
import { sendEmail } from "./email";
import { audit } from "./audit";
import { dispatchWebhook } from "./webhooks";

export interface RecipientInput {
  email: string;
  name: string;
  usi?: string | null;
  studentId?: string | null;
  issuedAt?: Date | null;
  evidenceUrl?: string | null;
  narrative?: string | null;
}

export interface IssueContext {
  org: Organization;
  achievement: Achievement;
  actorUserId?: string | null;
  actorApiKeyId?: string | null;
  batchId?: string | null;
  notify?: boolean;
}

/** USI: 10 characters, uppercase letters (excluding I, O) and digits 2–9. */
export const USI_RE = /^[A-HJ-NP-Z2-9]{10}$/;

export function achievementImageUrl(id: string) {
  return `${env.appUrl}/api/badge/${id}`;
}

export async function issueCredential(ctx: IssueContext, r: RecipientInput) {
  const { org, achievement } = ctx;
  if (achievement.organizationId !== org.id) throw new Error("Achievement does not belong to this organisation");
  if (achievement.status !== "PUBLISHED") throw new Error("Achievement must be published before issuing");
  const email = r.email.trim().toLowerCase();
  const usi = r.usi?.trim().toUpperCase() || null;
  if (usi && !USI_RE.test(usi)) throw new Error("USI must be 10 characters (A–Z excluding I and O, digits 2–9)");

  const id = randomUUID();
  const issuedAt = r.issuedAt ?? new Date();
  const expiresAt = achievement.expiresAfterDays ? new Date(issuedAt.getTime() + achievement.expiresAfterDays * 86400_000) : null;
  const key = await activeKey(org.id);
  const existingUser = await db.user.findUnique({ where: { email } });

  const credential = await db.$transaction(async (tx) => {
    const status = await allocateStatusIndex(tx, org.id);
    const vc = buildCredential({
      appUrl: env.appUrl,
      credentialId: id,
      issuer: issuerInput(org),
      achievement: {
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        criteria: achievement.criteria,
        achievementType: achievement.achievementType,
        imageUrl: achievementImageUrl(achievement.id),
        tgaCode: achievement.tgaCode,
        tgaTitle: achievement.tgaTitle,
        fieldOfStudy: achievement.fieldOfStudy,
        creditPoints: achievement.creditPoints ? Number(achievement.creditPoints) : null,
        tags: achievement.tags,
        skills: achievement.skills as unknown as SkillInput[],
        microcredential: {
          volumeOfLearningHours: achievement.volumeOfLearningHours,
          aqfLevel: achievement.aqfLevel,
          assessmentType: achievement.assessmentType,
          deliveryMode: achievement.deliveryMode,
          creditRecognition: achievement.creditRecognition,
          industryEndorsement: achievement.industryEndorsement,
        },
      },
      recipient: { email, name: r.name.trim(), studentId: r.studentId },
      issuedAt,
      expiresAt,
      status: { listUrl: statusListUrl(status.listId), index: status.index },
      evidence: { url: r.evidenceUrl, narrative: r.narrative },
    });
    const jwt = await signVc(vc, privateJwkOf(key), key.alg, kidUrl(org, key));
    return tx.credential.create({
      data: {
        id,
        organizationId: org.id,
        achievementId: achievement.id,
        recipientEmail: email,
        recipientName: r.name.trim(),
        recipientUserId: existingUser?.id ?? null,
        usiEnc: usi ? encrypt(usi, `usi:${id}`) : null,
        usiIndex: usi ? blindIndex(usi, "usi") : null,
        studentId: r.studentId?.trim() || null,
        issuedAt,
        expiresAt,
        jwt,
        statusListId: status.listId,
        statusListIndex: status.index,
        batchId: ctx.batchId ?? null,
        issuedById: ctx.actorUserId ?? null,
        evidenceUrl: r.evidenceUrl || null,
        narrative: r.narrative || null,
      },
    });
  });

  await audit({
    action: "credential.issued",
    organizationId: org.id,
    actorUserId: ctx.actorUserId,
    actorApiKeyId: ctx.actorApiKeyId,
    targetType: "Credential",
    targetId: credential.id,
    meta: { achievementId: achievement.id, batchId: ctx.batchId ?? undefined },
  });

  if (ctx.notify !== false) await sendClaimEmail(org, achievement, credential.id, email, r.name);
  await dispatchWebhook(org.id, "credential.issued", { id: credential.id, achievementId: achievement.id, url: `${env.appUrl}/c/${credential.id}` });
  await checkPathways(org, email, r.name, ctx);
  return credential;
}

async function sendClaimEmail(org: Organization, achievement: Achievement, credentialId: string, email: string, name: string) {
  const token = randomToken();
  await db.loginToken.create({
    data: { email, tokenHash: sha256(token), purpose: `claim:${credentialId}`, expiresAt: new Date(Date.now() + 30 * 86400_000) },
  });
  await sendEmail(
    email,
    `${org.name} has issued you a credential: ${achievement.name}`,
    `Hi ${name},

${org.name} has issued you "${achievement.name}".

Add it to your Meritbox wallet (link valid for 30 days):
${env.appUrl}/claim/${token}

Anyone can check it is genuine at:
${env.appUrl}/c/${credentialId}

If you weren't expecting this, you can ignore this email.`,
  );
}

/** Stackable credentials: when a learner holds every step of a pathway, issue the pathway's reward. */
async function checkPathways(org: Organization, email: string, name: string, ctx: IssueContext) {
  const pathways = await db.pathway.findMany({
    where: { organizationId: org.id, rewardAchievementId: { not: null }, steps: { some: { achievementId: ctx.achievement.id } } },
    include: { steps: true, reward: true },
  });
  for (const p of pathways) {
    if (!p.reward || p.reward.status !== "PUBLISHED" || p.reward.id === ctx.achievement.id) continue;
    const held = await db.credential.findMany({
      where: { organizationId: org.id, recipientEmail: email, revokedAt: null, achievementId: { in: [...p.steps.map((s) => s.achievementId), p.reward.id] } },
      select: { achievementId: true },
    });
    const heldIds = new Set(held.map((h) => h.achievementId));
    if (heldIds.has(p.reward.id)) continue;
    if (p.steps.every((s) => heldIds.has(s.achievementId))) {
      await issueCredential({ ...ctx, achievement: p.reward, batchId: null }, { email, name, narrative: `Completed the "${p.name}" pathway.` });
      await dispatchWebhook(org.id, "pathway.completed", { pathwayId: p.id, recipientEmail: email });
    }
  }
}

export async function revokeCredential(opts: {
  organizationId: string;
  credentialId: string;
  reason: string;
  actorUserId?: string | null;
  actorApiKeyId?: string | null;
}) {
  const c = await db.credential.findFirst({ where: { id: opts.credentialId, organizationId: opts.organizationId } });
  if (!c) throw new Error("Credential not found");
  if (c.revokedAt) return c;
  await setStatus(c.statusListId, c.statusListIndex, true);
  const updated = await db.credential.update({
    where: { id: c.id },
    data: { revokedAt: new Date(), revocationReason: opts.reason.slice(0, 500) },
  });
  await audit({
    action: "credential.revoked",
    organizationId: opts.organizationId,
    actorUserId: opts.actorUserId,
    actorApiKeyId: opts.actorApiKeyId,
    targetType: "Credential",
    targetId: c.id,
    meta: { reason: opts.reason },
  });
  await dispatchWebhook(opts.organizationId, "credential.revoked", { id: c.id, reason: opts.reason });
  return updated;
}

export async function reinstateCredential(opts: { organizationId: string; credentialId: string; actorUserId: string }) {
  const c = await db.credential.findFirst({ where: { id: opts.credentialId, organizationId: opts.organizationId } });
  if (!c || !c.revokedAt) return c;
  await setStatus(c.statusListId, c.statusListIndex, false);
  await audit({ action: "credential.reinstated", organizationId: opts.organizationId, actorUserId: opts.actorUserId, targetType: "Credential", targetId: c.id });
  return db.credential.update({ where: { id: c.id }, data: { revokedAt: null, revocationReason: null } });
}
