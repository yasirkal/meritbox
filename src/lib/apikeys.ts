import "server-only";
import { db } from "./db";
import { randomToken, safeEqual, sha256 } from "./crypto";

export const API_SCOPES = ["achievements:read", "credentials:read", "credentials:issue", "credentials:revoke"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

/** Keys look like mbx_live_<prefix>_<secret>. Only a SHA-256 of the secret is stored. */
export async function createApiKey(organizationId: string, name: string, scopes: ApiScope[], createdById: string) {
  const prefix = randomToken(6);
  const secret = randomToken(32);
  const key = await db.apiKey.create({ data: { organizationId, name, prefix, hash: sha256(secret), scopes, createdById } });
  return { key, plaintext: `mbx_live_${prefix}_${secret}` };
}

export async function authenticateApiKey(authorization: string | null) {
  const m = /^Bearer mbx_live_([A-Za-z0-9_-]{8})_([A-Za-z0-9_-]{43})$/.exec(authorization ?? "");
  if (!m) return null;
  const key = await db.apiKey.findUnique({ where: { prefix: m[1]! }, include: { organization: true } });
  if (!key || key.revokedAt || !safeEqual(key.hash, sha256(m[2]!))) return null;
  await db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return key;
}
