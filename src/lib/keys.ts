import "server-only";
import { exportJWK, generateKeyPair, calculateJwkThumbprint, type JWK } from "jose";
import type { KeyAlg, Organization, SigningKey } from "@prisma/client";
import { db } from "./db";
import { decrypt, encrypt } from "./crypto";
import { didForSlug } from "./did";
import { env } from "./env";

/**
 * Issuer signing keys. Each organisation has one ACTIVE key and any number of RETIRED keys.
 * Retired keys stay in the DID document so previously issued credentials keep verifying.
 * Private keys are encrypted at rest; in production replace with AWS KMS asymmetric keys
 * (KMS never releases the private key) — see docs/ARCHITECTURE.md#key-management.
 */
export async function generateSigningKey(organizationId: string, alg: KeyAlg = "RS256") {
  const { publicKey, privateKey } =
    alg === "EdDSA"
      ? await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true })
      : await generateKeyPair("RS256", { modulusLength: 3072, extractable: true });
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);
  const kid = (await calculateJwkThumbprint(publicJwk)).slice(0, 16);
  return db.signingKey.create({
    data: {
      organizationId,
      kid,
      alg,
      publicJwk: { ...publicJwk, kid, alg } as object,
      encryptedPrivateJwk: encrypt(JSON.stringify(privateJwk), `key:${organizationId}:${kid}`),
    },
  });
}

export async function activeKey(organizationId: string): Promise<SigningKey> {
  const existing = await db.signingKey.findFirst({
    where: { organizationId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  return existing ?? generateSigningKey(organizationId);
}

export function privateJwkOf(key: SigningKey): JWK {
  return JSON.parse(decrypt(key.encryptedPrivateJwk, `key:${key.organizationId}:${key.kid}`)) as JWK;
}

export async function rotateKey(organizationId: string, alg?: KeyAlg) {
  const current = await activeKey(organizationId);
  const next = await generateSigningKey(organizationId, alg ?? current.alg);
  await db.signingKey.update({
    where: { id: current.id },
    data: { status: "RETIRED", retiredAt: new Date() },
  });
  return next;
}

export function issuerDid(org: Pick<Organization, "slug">) {
  return didForSlug(env.appUrl, org.slug);
}

export function kidUrl(org: Pick<Organization, "slug">, key: Pick<SigningKey, "kid">) {
  return `${issuerDid(org)}#${key.kid}`;
}

export async function didDocument(org: Organization) {
  const keys = await db.signingKey.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "asc" } });
  const did = issuerDid(org);
  const vms = keys.map((k) => ({
    id: `${did}#${k.kid}`,
    type: "JsonWebKey",
    controller: did,
    publicKeyJwk: k.publicJwk,
  }));
  return {
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/jws-2020/v1"],
    id: did,
    alsoKnownAs: [`${env.appUrl}/issuers/${org.slug}`],
    verificationMethod: vms,
    assertionMethod: vms.map((v) => v.id),
    service: [
      { id: `${did}#profile`, type: "LinkedDomains", serviceEndpoint: org.website ?? `${env.appUrl}/issuers/${org.slug}` },
    ],
  };
}
