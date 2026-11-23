import type { Metadata } from "next";

export const metadata: Metadata = { title: "Trust centre" };

const sections: { h: string; items: string[] }[] = [
  {
    h: "Data sovereignty",
    items: [
      "All customer data is stored and processed in Australian data centres (AWS ap-southeast-2 Sydney, with ap-southeast-4 Melbourne for backups).",
      "We comply with the Privacy Act 1988 (Cth) and the Australian Privacy Principles, and support customers' obligations under state privacy laws.",
      "Notifiable Data Breaches scheme procedures are documented (see our incident response runbook).",
    ],
  },
  {
    h: "Credential integrity",
    items: [
      "Credentials are Open Badges 3.0 / W3C Verifiable Credentials signed with issuer-specific keys published via did:web.",
      "Revocation uses the W3C Bitstring Status List: 131,072 entries per list, so checking one credential reveals nothing about which one.",
      "Recipient emails inside credentials are salted SHA-256 hashes, not plain text.",
    ],
  },
  {
    h: "Application security",
    items: [
      "MFA (TOTP) enforced for issuer staff by default; argon2id password hashing; account lockout and rate limiting.",
      "Signing keys, MFA secrets and USIs are encrypted at rest with AES-256-GCM (keys held in AWS KMS in production).",
      "Strict Content-Security-Policy with nonces, HSTS preload, and frame, referrer and permissions policies on every response.",
      "Append-only audit log of every issuance, revocation, key rotation and administrative change.",
    ],
  },
  {
    h: "Assurance roadmap",
    items: [
      "ISO/IEC 27001 certification, then SOC 2 Type II.",
      "IRAP assessment for government customers. Essential Eight Maturity Level 2+ internally.",
      "Annual independent penetration testing. Reports are available under NDA.",
      "A coordinated vulnerability disclosure policy is published at /.well-known/security.txt.",
    ],
  },
];

export default function Trust() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Trust centre</h1>
      <p className="muted mt-2">How Meritbox protects institutions, learners and the credentials they rely on.</p>
      {sections.map((s) => (
        <section key={s.h} className="mt-8">
          <h2 className="text-xl font-semibold">{s.h}</h2>
          <ul className="mt-3 space-y-2 list-disc pl-5">
            {s.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
