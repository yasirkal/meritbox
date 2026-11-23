# Architecture

## Overview

One Next.js 15 application (App Router, server components, server actions) on PostgreSQL 16, deployed as a stateless container on ECS Fargate in `ap-southeast-2`. No customer data leaves Australia: AWS Sydney is primary, Melbourne holds DR backups.

```
 Learners / employers ──► ALB (TLS 1.3/1.2) + WAF ──► Next.js (ECS Fargate, private subnets) ──► RDS PostgreSQL (KMS)
                                                         │                                         ▲
 Institution SMS / LMS ──► REST API (scoped keys) ──────┤        Secrets Manager / KMS ────────────┘
                                                         └──► SES (claim + sign-in email), webhooks (HTTPS, HMAC-signed)
```

## Credential model

- **Format:** Open Badges 3.0 `OpenBadgeCredential` in the W3C VC 2.0 data model, secured as a **VC-JWT** (compact JWS) per OB 3.0 §8.2. JWT claims `iss`, `jti`, `nbf` and `exp` mirror `issuer.id`, `id`, `validFrom` and `validUntil`.
- **Algorithms:** RS256 (RSA-3072) by default because OB 3.0 verifiers must support it; EdDSA (Ed25519) optional per issuer.
- **Issuer identity:** `did:web:<host>:issuers:<slug>`, resolved at `/issuers/<slug>/did.json`. The DID document lists every key the issuer has ever used (`JsonWebKey`, `assertionMethod`), so rotated keys keep verifying old credentials.
- **Recipient privacy:** the email is a salted SHA-256 `IdentityObject`; the USI is never placed in the credential.
- **Revocation:** W3C Bitstring Status List, 131,072 entries per list (herd privacy), served as a signed `BitstringStatusListCredential` at `/status/<id>`. Index allocation uses `SELECT … FOR UPDATE`.
- **AU extensions:** National Microcredentials Framework fields live in `achievement.microcredential`, defined by the JSON-LD context at `/contexts/au-microcredential-v1.json`. TGA codes and ASC skills are standard OB 3.0 `alignment` entries, and RTO/CRICOS/TEQSA/ABN are issuer `otherIdentifier` entries.

## Key management

| Environment | Mechanism |
|---|---|
| Dev/test | Private JWKs encrypted with AES-256-GCM under `MERITBOX_MASTER_KEY` (HKDF-style sub-keys, per-record AAD) |
| Production (next step) | **AWS KMS asymmetric keys** (`RSA_3072` / `ECC_NIST_P256`, `SIGN_VERIFY`), one per issuer. `signVc()` becomes a `kms:Sign` call, so the private key never leaves the HSM (FIPS 140-3 L3). The `SigningKey` row stores the KMS key ARN instead of `encryptedPrivateJwk`. |

The master key encrypts TOTP seeds, USIs and webhook secrets. In production it lives in Secrets Manager under a KMS CMK with rotation. Moving to KMS envelope data keys is planned.

## Multi-tenancy

Every tenant-owned row carries `organizationId`, and every query filters on it, taking it from the authenticated context (`requireStaff()` or the API key), never from the request. Planned hardening: PostgreSQL row-level security with `SET app.org_id` per transaction as defence in depth.

## Authentication and authorisation

- **Staff:** email + argon2id password → TOTP MFA (enforced per org, on by default) → role check (`OWNER > ADMIN > ISSUER > VIEWER`) in every page and server action.
- **Learners:** passwordless. Single-use emailed tokens, spent by an explicit button press (POST), so email link scanners can't consume them.
- **Sessions:** 256-bit random token in a `__Host-` HttpOnly, Secure, SameSite=Lax cookie. Only the SHA-256 hash is stored. 12-hour TTL.
- **CSRF:** server actions are origin-checked by Next.js, and the API uses bearer keys, not cookies.
- **API keys:** `mbx_live_<prefix>_<secret>`. The secret is stored as SHA-256, compared in constant time, scoped, and rate limited.

## Audit

`AuditLog` covers issuance, revocation, exports, key rotation, membership and MFA changes, and sign-ins. A PostgreSQL trigger rejects `UPDATE` and `DELETE`, so the log stays append-only even under the application role. Planned: stream to CloudWatch Logs and S3 Object Lock (WORM) for 7-year retention.
