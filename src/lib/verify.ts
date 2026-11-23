import "server-only";
import type { JWK } from "jose";
import { db } from "./db";
import { env } from "./env";
import { localSlugFromDid } from "./did";
import { getBit } from "./status-list";
import { peekJwt, verifyJwtSignature, type SigningAlg } from "./vc";

export type CheckStatus = "pass" | "fail" | "warn";
export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
}
export interface VerificationResult {
  verified: boolean;
  status: "valid" | "revoked" | "expired" | "invalid";
  checks: Check[];
  credential?: Record<string, unknown>;
  credentialId?: string;
  issuer?: { id: string; name?: string };
}

/**
 * Verifies a Meritbox-issued OB 3.0 VC-JWT: format → issuer DID → key → signature →
 * issuer/claim consistency → validity window → revocation status.
 * External did:web issuers are not resolved yet (no outbound fetches from the verifier — SSRF surface).
 */
export async function verifyCredentialJwt(jwt: string, method: string): Promise<VerificationResult> {
  const checks: Check[] = [];
  const done = async (r: Omit<VerificationResult, "checks">) => {
    const credentialId = r.credentialId;
    const exists = credentialId ? await db.credential.findUnique({ where: { id: credentialId }, select: { id: true } }) : null;
    await db.verificationEvent.create({ data: { credentialId: exists?.id ?? null, method, result: r.status } });
    return { ...r, checks };
  };

  let header, payload;
  try {
    ({ header, payload } = peekJwt(jwt.trim()));
    checks.push({ id: "format", label: "Credential format (VC-JWT)", status: "pass" });
  } catch {
    checks.push({ id: "format", label: "Credential format (VC-JWT)", status: "fail", detail: "This is not a compact JWS credential." });
    return done({ verified: false, status: "invalid" });
  }

  const types = (payload.type as string[] | undefined) ?? [];
  if (!types.includes("VerifiableCredential") || !types.includes("OpenBadgeCredential")) {
    checks.push({ id: "type", label: "Open Badges 3.0 credential", status: "fail", detail: "Missing OpenBadgeCredential type." });
    return done({ verified: false, status: "invalid" });
  }
  checks.push({ id: "type", label: "Open Badges 3.0 credential", status: "pass" });

  const issuer = payload.issuer as { id?: string; name?: string } | string | undefined;
  const issuerId = typeof issuer === "string" ? issuer : issuer?.id;
  const issuerName = typeof issuer === "string" ? undefined : issuer?.name;
  const kid = header.kid ?? "";
  const kidDid = kid.split("#")[0];
  const slug = issuerId ? localSlugFromDid(env.appUrl, issuerId) : null;
  const credentialUrl = typeof payload.id === "string" ? payload.id : "";
  const credentialId = credentialUrl.startsWith(`${env.appUrl}/c/`) ? credentialUrl.slice(`${env.appUrl}/c/`.length) : undefined;

  if (!issuerId || !slug || kidDid !== issuerId || payload.iss !== issuerId) {
    checks.push({
      id: "issuer",
      label: "Issuer identity",
      status: "fail",
      detail: !slug ? "Issuer is not registered on this Meritbox instance." : "The signing key does not belong to the stated issuer.",
    });
    return done({ verified: false, status: "invalid", credential: payload, credentialId });
  }
  const org = await db.organization.findUnique({ where: { slug } });
  const key = org ? await db.signingKey.findUnique({ where: { organizationId_kid: { organizationId: org.id, kid: kid.split("#")[1] ?? "" } } }) : null;
  if (!org || !key) {
    checks.push({ id: "issuer", label: "Issuer identity", status: "fail", detail: "Unknown issuer or signing key." });
    return done({ verified: false, status: "invalid", credential: payload, credentialId });
  }
  checks.push({ id: "issuer", label: "Issuer identity", status: "pass", detail: `${org.name} (${issuerId})` });

  try {
    const alg = key.alg as SigningAlg;
    if (header.alg !== alg) throw new Error("alg mismatch");
    await verifyJwtSignature(jwt.trim(), key.publicJwk as unknown as JWK, alg);
    checks.push({
      id: "signature",
      label: "Tamper-evident signature",
      status: "pass",
      detail: key.status === "RETIRED" ? `Signed with a retired key (${key.kid}), which was valid when issued.` : `Key ${key.kid} (${alg})`,
    });
  } catch {
    checks.push({ id: "signature", label: "Tamper-evident signature", status: "fail", detail: "The credential has been altered or was not signed by this issuer." });
    return done({ verified: false, status: "invalid", credential: payload, credentialId, issuer: { id: issuerId, name: issuerName } });
  }

  const now = Date.now();
  const validFrom = Date.parse(String(payload.validFrom ?? ""));
  const validUntil = payload.validUntil ? Date.parse(String(payload.validUntil)) : null;
  let expired = false;
  if (Number.isFinite(validFrom) && validFrom > now + 60_000) {
    checks.push({ id: "validity", label: "Validity period", status: "fail", detail: "Not yet valid." });
    return done({ verified: false, status: "invalid", credential: payload, credentialId, issuer: { id: issuerId, name: issuerName } });
  } else if (validUntil && validUntil < now) {
    expired = true;
    checks.push({ id: "validity", label: "Validity period", status: "warn", detail: `Expired on ${new Date(validUntil).toLocaleDateString("en-AU")}.` });
  } else {
    checks.push({ id: "validity", label: "Validity period", status: "pass", detail: validUntil ? `Valid until ${new Date(validUntil).toLocaleDateString("en-AU")}` : "Does not expire" });
  }

  const cs = payload.credentialStatus as { statusListCredential?: string; statusListIndex?: string } | undefined;
  const listId = cs?.statusListCredential?.startsWith(`${env.appUrl}/status/`) ? cs.statusListCredential.slice(`${env.appUrl}/status/`.length) : null;
  const list = listId ? await db.statusList.findFirst({ where: { id: listId, organizationId: org.id } }) : null;
  const index = Number(cs?.statusListIndex);
  if (!list || !Number.isInteger(index)) {
    checks.push({ id: "status", label: "Revocation status", status: "fail", detail: "Status list could not be checked." });
    return done({ verified: false, status: "invalid", credential: payload, credentialId, issuer: { id: issuerId, name: issuerName } });
  }
  if (getBit(Buffer.from(list.bits), index)) {
    const c = credentialId ? await db.credential.findUnique({ where: { id: credentialId }, select: { revocationReason: true, revokedAt: true } }) : null;
    checks.push({
      id: "status",
      label: "Revocation status",
      status: "fail",
      detail: `Revoked by the issuer${c?.revokedAt ? ` on ${c.revokedAt.toLocaleDateString("en-AU")}` : ""}${c?.revocationReason ? `: ${c.revocationReason}` : "."}`,
    });
    return done({ verified: false, status: "revoked", credential: payload, credentialId, issuer: { id: issuerId, name: issuerName } });
  }
  checks.push({ id: "status", label: "Revocation status", status: "pass", detail: "Not revoked" });

  return done({ verified: !expired, status: expired ? "expired" : "valid", credential: payload, credentialId, issuer: { id: issuerId, name: issuerName } });
}
