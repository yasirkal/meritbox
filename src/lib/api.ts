import "server-only";
import type { ApiKey, Credential, Organization } from "@prisma/client";
import { authenticateApiKey, type ApiScope } from "./apikeys";
import { rateLimit } from "./ratelimit";
import { env } from "./env";

export type ApiAuth = ApiKey & { organization: Organization };

export function apiError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

export async function withApiKey(req: Request, scope: ApiScope): Promise<ApiAuth | Response> {
  const key = await authenticateApiKey(req.headers.get("authorization"));
  if (!key) return apiError(401, "unauthorized", "Provide a valid API key as 'Authorization: Bearer mbx_live_…'.");
  if (!key.scopes.includes(scope)) return apiError(403, "insufficient_scope", `This key lacks the '${scope}' scope.`);
  if (!(await rateLimit(`api:${key.id}`, 600, 60)).ok) return apiError(429, "rate_limited", "Rate limit is 600 requests per minute per key.");
  return key;
}

export function serializeCredential(c: Credential & { achievement?: { name: string } }) {
  return {
    id: c.id,
    url: `${env.appUrl}/c/${c.id}`,
    achievement_id: c.achievementId,
    achievement_name: c.achievement?.name,
    recipient: { email: c.recipientEmail, name: c.recipientName, student_id: c.studentId },
    issued_at: c.issuedAt.toISOString(),
    expires_at: c.expiresAt?.toISOString() ?? null,
    claimed_at: c.claimedAt?.toISOString() ?? null,
    revoked_at: c.revokedAt?.toISOString() ?? null,
    revocation_reason: c.revocationReason,
    vc_jwt: c.jwt,
  };
}
