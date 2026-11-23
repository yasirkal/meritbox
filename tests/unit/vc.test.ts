import { describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair } from "jose";
import { buildCredential, identityMatches, peekJwt, signVc, verifyJwtSignature, type SigningAlg } from "@/lib/vc";

const input = {
  appUrl: "https://meritbox.com.au",
  credentialId: "6f1c1f4e-0000-4000-8000-000000000001",
  issuer: { did: "did:web:meritbox.com.au:issuers:demo", name: "Demo TAFE", url: "https://demo.edu.au", rtoCode: "12345" },
  achievement: {
    id: "a1",
    name: "Provide First Aid",
    description: "First aid response.",
    criteria: "Pass assessment.",
    achievementType: "Competency",
    imageUrl: "https://meritbox.com.au/api/badge/a1",
    tgaCode: "HLTAID011",
    tgaTitle: "Provide First Aid",
    skills: [{ name: "Problem solving", framework: "Australian Skills Classification" }],
    microcredential: { volumeOfLearningHours: 18, aqfLevel: null },
  },
  recipient: { email: "Jane@Example.com", name: "Jane Citizen" },
  issuedAt: new Date("2026-11-20T00:00:00Z"),
  expiresAt: new Date("2029-11-20T00:00:00Z"),
  status: { listUrl: "https://meritbox.com.au/status/l1", index: 7 },
};

describe("Open Badges 3.0 credential", () => {
  const vc = buildCredential(input);

  it("has the OB 3.0 / VC 2.0 shape", () => {
    expect(vc["@context"][0]).toBe("https://www.w3.org/ns/credentials/v2");
    expect(vc["@context"][1]).toContain("ob/v3p0");
    expect(vc.type).toEqual(["VerifiableCredential", "OpenBadgeCredential"]);
    expect(vc.credentialSubject.type).toEqual(["AchievementSubject"]);
    expect(vc.credentialStatus).toMatchObject({ type: "BitstringStatusListEntry", statusListIndex: "7", statusPurpose: "revocation" });
    expect(vc.validUntil).toBe("2029-11-20T00:00:00.000Z");
  });

  it("hashes the recipient email (case-insensitive) and never includes it in clear", () => {
    expect(JSON.stringify(vc)).not.toMatch(/jane@example\.com/i);
    const id = vc.credentialSubject.identifier[0]!;
    expect(identityMatches("jane@example.com", id)).toBe(true);
    expect(identityMatches("other@example.com", id)).toBe(false);
  });

  it("embeds AU alignment and NMF data", () => {
    const a = vc.credentialSubject.achievement as Record<string, unknown>;
    expect(a.humanCode).toBe("HLTAID011");
    expect(JSON.stringify(a.alignment)).toContain("training.gov.au");
    expect(a.microcredential).toMatchObject({ volumeOfLearningHours: 18 });
    expect(a.inLanguage).toBe("en-AU");
    expect(JSON.stringify(vc.issuer)).toContain("ext:RTOCode");
  });

  for (const alg of ["RS256", "EdDSA"] as SigningAlg[]) {
    it(`signs and verifies with ${alg}, and detects tampering`, async () => {
      const { privateKey, publicKey } = await generateKeyPair(alg, alg === "EdDSA" ? { crv: "Ed25519", extractable: true } : { extractable: true });
      const priv = await exportJWK(privateKey);
      const pub = await exportJWK(publicKey);
      const jwt = await signVc(vc, priv, alg, `${input.issuer.did}#k1`);
      const { header, payload } = peekJwt(jwt);
      expect(header).toMatchObject({ alg, kid: `${input.issuer.did}#k1`, typ: "JWT" });
      expect(payload).toMatchObject({ iss: input.issuer.did, jti: vc.id, nbf: 1795132800 });
      await expect(verifyJwtSignature(jwt, pub, alg)).resolves.toBeTruthy();

      const [h, p, s] = jwt.split(".");
      const forged = JSON.parse(Buffer.from(p!, "base64url").toString());
      forged.credentialSubject.name = "Mallory";
      const tampered = `${h}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${s}`;
      await expect(verifyJwtSignature(tampered, pub, alg)).rejects.toThrow();
    });
  }
});
