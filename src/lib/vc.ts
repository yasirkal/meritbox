import { createHash, randomBytes } from "node:crypto";
import { SignJWT, compactVerify, decodeProtectedHeader, importJWK, type JWK } from "jose";

/**
 * Open Badges 3.0 (1EdTech) credentials, expressed as W3C Verifiable Credentials 2.0
 * and secured with the OB 3.0 "VC-JWT" proof format (compact JWS).
 */

export const CONTEXTS = {
  vc2: "https://www.w3.org/ns/credentials/v2",
  ob3: "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
};
export const OB3_SCHEMA =
  "https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_achievementcredential_schema.json";

export function auContextUrl(appUrl: string) {
  return `${appUrl}/contexts/au-microcredential-v1.json`;
}

export interface IssuerInput {
  did: string;
  name: string;
  url: string;
  email?: string | null;
  description?: string | null;
  imageUrl?: string;
  rtoCode?: string | null;
  cricosCode?: string | null;
  abn?: string | null;
  teqsaId?: string | null;
}

export interface SkillInput {
  name: string;
  framework?: string;
  code?: string;
  url?: string;
}

export interface AchievementInput {
  id: string;
  name: string;
  description: string;
  criteria: string;
  achievementType: string;
  imageUrl: string;
  tgaCode?: string | null;
  tgaTitle?: string | null;
  fieldOfStudy?: string | null;
  creditPoints?: number | null;
  tags?: string[];
  skills?: SkillInput[];
  microcredential?: {
    volumeOfLearningHours?: number | null;
    aqfLevel?: number | null;
    assessmentType?: string | null;
    deliveryMode?: string | null;
    creditRecognition?: string | null;
    industryEndorsement?: string | null;
  };
}

export interface CredentialInput {
  appUrl: string;
  credentialId: string;
  issuer: IssuerInput;
  achievement: AchievementInput;
  recipient: { email: string; name: string; studentId?: string | null };
  issuedAt: Date;
  expiresAt?: Date | null;
  status: { listUrl: string; index: number };
  evidence?: { url?: string | null; narrative?: string | null };
}

export function credentialUrl(appUrl: string, id: string) {
  return `${appUrl}/c/${id}`;
}

/** OB 3.0 IdentityObject: salted SHA-256 of the recipient's email. */
export function hashedIdentity(email: string, salt = randomBytes(16).toString("hex")) {
  const hash = createHash("sha256").update(email.trim().toLowerCase() + salt).digest("hex");
  return {
    type: "IdentityObject",
    identityHash: `sha256$${hash}`,
    identityType: "emailAddress",
    hashed: true,
    salt,
  };
}

export function identityMatches(email: string, identity: { identityHash: string; salt?: string }) {
  const hash = createHash("sha256")
    .update(email.trim().toLowerCase() + (identity.salt ?? ""))
    .digest("hex");
  return identity.identityHash === `sha256$${hash}`;
}

function stripEmpty<T extends Record<string, unknown>>(o: T): T {
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) delete o[k];
  }
  return o;
}

export function buildIssuerProfile(issuer: IssuerInput) {
  const otherIdentifier = [
    issuer.rtoCode && { type: "IdentifierEntry", identifier: issuer.rtoCode, identifierType: "ext:RTOCode" },
    issuer.cricosCode && { type: "IdentifierEntry", identifier: issuer.cricosCode, identifierType: "ext:CRICOSProviderCode" },
    issuer.teqsaId && { type: "IdentifierEntry", identifier: issuer.teqsaId, identifierType: "ext:TEQSAProviderID" },
    issuer.abn && { type: "IdentifierEntry", identifier: issuer.abn, identifierType: "ext:ABN" },
  ].filter(Boolean);
  return stripEmpty({
    id: issuer.did,
    type: ["Profile"],
    name: issuer.name,
    url: issuer.url,
    email: issuer.email ?? undefined,
    description: issuer.description ?? undefined,
    image: issuer.imageUrl ? { id: issuer.imageUrl, type: "Image" } : undefined,
    otherIdentifier,
  });
}

export function buildAchievement(appUrl: string, a: AchievementInput, issuerProfile: object) {
  const alignment: object[] = [];
  if (a.tgaCode) {
    alignment.push({
      type: ["Alignment"],
      targetName: a.tgaTitle ?? a.tgaCode,
      targetCode: a.tgaCode,
      targetUrl: `https://training.gov.au/Training/Details/${encodeURIComponent(a.tgaCode)}`,
      targetFramework: "training.gov.au National Register of VET",
      targetType: "ext:TrainingPackageComponent",
    });
  }
  for (const s of a.skills ?? []) {
    alignment.push(
      stripEmpty({
        type: ["Alignment"],
        targetName: s.name,
        targetCode: s.code,
        targetUrl: s.url ?? `${appUrl}/skills/${encodeURIComponent(s.code ?? s.name)}`,
        targetFramework: s.framework ?? "Australian Skills Classification",
        targetType: "ext:Skill",
      }),
    );
  }
  const mc = a.microcredential ?? {};
  const microcredential = stripEmpty({
    type: "AustralianMicrocredential",
    framework: "National Microcredentials Framework (2022)",
    volumeOfLearningHours: mc.volumeOfLearningHours ?? undefined,
    aqfLevel: mc.aqfLevel ?? undefined,
    assessmentType: mc.assessmentType ?? undefined,
    deliveryMode: mc.deliveryMode ?? undefined,
    creditRecognition: mc.creditRecognition ?? undefined,
    industryEndorsement: mc.industryEndorsement ?? undefined,
  });
  return stripEmpty({
    id: `${appUrl}/achievements/${a.id}`,
    type: ["Achievement"],
    achievementType: a.achievementType,
    name: a.name,
    description: a.description,
    criteria: { narrative: a.criteria },
    image: { id: a.imageUrl, type: "Image", caption: a.name },
    creator: issuerProfile,
    humanCode: a.tgaCode ?? undefined,
    fieldOfStudy: a.fieldOfStudy ?? undefined,
    creditsAvailable: a.creditPoints ?? undefined,
    tag: a.tags,
    alignment,
    inLanguage: "en-AU",
    microcredential: Object.keys(microcredential).length > 2 ? microcredential : undefined,
  });
}

export function buildCredential(input: CredentialInput) {
  const { appUrl } = input;
  const issuer = buildIssuerProfile(input.issuer);
  const achievement = buildAchievement(appUrl, input.achievement, issuer);
  const id = credentialUrl(appUrl, input.credentialId);
  const evidence =
    input.evidence?.url || input.evidence?.narrative
      ? [stripEmpty({ id: input.evidence.url ?? undefined, type: ["Evidence"], narrative: input.evidence.narrative ?? undefined })]
      : undefined;
  return stripEmpty({
    "@context": [CONTEXTS.vc2, CONTEXTS.ob3, auContextUrl(appUrl)],
    id,
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    issuer,
    validFrom: input.issuedAt.toISOString(),
    validUntil: input.expiresAt?.toISOString(),
    name: input.achievement.name,
    credentialSubject: {
      type: ["AchievementSubject"],
      identifier: [hashedIdentity(input.recipient.email)],
      name: input.recipient.name,
      achievement,
    },
    credentialStatus: {
      id: `${input.status.listUrl}#${input.status.index}`,
      type: "BitstringStatusListEntry",
      statusPurpose: "revocation",
      statusListIndex: String(input.status.index),
      statusListCredential: input.status.listUrl,
    },
    credentialSchema: [{ id: OB3_SCHEMA, type: "1EdTechJsonSchemaValidator2019" }],
    evidence,
  });
}

export type SigningAlg = "RS256" | "EdDSA";

/** Signs any VC (credential or status list) as a VC-JWT. */
export async function signVc(
  vc: Record<string, unknown> & { id: string; issuer: unknown; validFrom: string; validUntil?: string },
  privateJwk: JWK,
  alg: SigningAlg,
  kidUrl: string,
) {
  const key = await importJWK(privateJwk, alg);
  const issuerId = typeof vc.issuer === "string" ? vc.issuer : (vc.issuer as { id: string }).id;
  const jwt = new SignJWT(vc as Record<string, unknown>)
    .setProtectedHeader({ alg, kid: kidUrl, typ: "JWT" })
    .setIssuer(issuerId)
    .setJti(vc.id)
    .setNotBefore(Math.floor(new Date(vc.validFrom).getTime() / 1000))
    .setIssuedAt();
  if (vc.validUntil) jwt.setExpirationTime(Math.floor(new Date(vc.validUntil).getTime() / 1000));
  return jwt.sign(key);
}

export function peekJwt(jwt: string) {
  const header = decodeProtectedHeader(jwt);
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Not a compact JWS");
  const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as Record<string, unknown>;
  return { header, payload };
}

/** Verifies the JWS signature only; temporal claims (nbf/exp) are evaluated by the caller. */
export async function verifyJwtSignature(jwt: string, publicJwk: JWK, alg: SigningAlg) {
  const key = await importJWK(publicJwk, alg);
  const { payload, protectedHeader } = await compactVerify(jwt, key, { algorithms: [alg] });
  return {
    protectedHeader,
    payload: JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>,
  };
}
