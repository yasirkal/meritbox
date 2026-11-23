# Meritbox

**Australian digital credentialing for universities, TAFEs and RTOs.**
Issue, manage and verify Open Badges 3.0 / W3C Verifiable Credentials aligned to the AQF, training.gov.au, the Australian Skills Classification and the National Microcredentials Framework. Hosted in Australia, secure by default.

## What's in the box

| Area | Features |
|---|---|
| **Issuing** | Achievement designer (badge artwork generator, NMF fields, AQF level, TGA code, ASC skills, expiry) · draft → publish → archive workflow · single issue · bulk CSV (5,000 rows, per-row error report) · REST API · claim emails |
| **Standards** | Open Badges 3.0 `OpenBadgeCredential` as W3C VC 2.0, VC-JWT proof (RS256 or EdDSA) · issuer `did:web` DID documents · W3C Bitstring Status List revocation · hashed recipient identity · OB 3.0 JSON schema reference · AU JSON-LD extension context |
| **Australian fit** | USI capture (validated, AES-256-GCM encrypted, blind-indexed for search, never in the credential) · RTO / CRICOS / TEQSA / ABN identifiers in issuer profile · training.gov.au alignment · NMF info panel · `en-AU` everywhere |
| **Pathways** | Stackable microcredentials: when a learner holds every step, the reward credential is issued automatically |
| **Verification** | Public credential page with live checks · `/verify` (paste, link or file) · free `POST /api/v1/verify` · tamper, expiry and revocation detection · retired keys keep verifying |
| **Learner wallet** | Passwordless magic-link sign-in · claim links · private/shareable toggle · LinkedIn "Add to profile" · printable certificate with QR · download VC-JWT/JSON |
| **Admin** | Multi-tenant orgs · roles (owner/admin/issuer/viewer) · invitations · API keys (scoped, hashed) · signed webhooks · key rotation · CSV export · analytics · append-only audit log |
| **Security** | Enforced TOTP MFA for staff · argon2id · lockout + rate limiting · nonce CSP, HSTS preload and full header set · encrypted keys/secrets · SSRF-guarded webhooks · DB-enforced append-only audit trail · security.txt · MTA-STS |

## Quick start (local)

Requires Node 22+ and PostgreSQL 16.

```bash
cp .env.example .env
```

```bash
sed -i "s|^MERITBOX_MASTER_KEY=.*|MERITBOX_MASTER_KEY=$(npm run -s gen:master-key)|" .env
```

```bash
npm install && npx prisma migrate deploy && npm run db:seed
```

```bash
npm run dev
```

Open http://localhost:3000. The seed creates a fictional TAFE:

- **Staff:** `demo@meritbox.test` / `demo-password-123` (MFA isn't enforced for the demo org; new orgs enforce it)
- **Learner:** request a wallet link for `alex.nguyen@example.com` on `/login`, then open it from **/dev/outbox**. Alex has completed a stackable pathway.

Or with Docker:

```bash
MERITBOX_MASTER_KEY=$(openssl rand -base64 32) docker compose up --build
```

## Tests

```bash
npm run lint && npm test
```

```bash
MERITBOX_DEV_OUTBOX=1 npm start   # in another terminal: node tests/e2e/smoke.mjs
```

- **Unit tests (34):** crypto, status list bit order and encoding, did:web, OB 3.0 credential shape, RS256/EdDSA signing and tamper detection, SVG escaping, SSRF guard, USI format.
- **End-to-end (29 checks):** sign-up → enforced MFA → achievement → publish → issue (UI, CSV, API) → public page → verify → tamper detection → revoke and reinstate → learner claim → privacy toggle → single-use links → headers and access control → no CSP violations.

## Project layout

```
src/
  app/(public)/      landing, verify, credential pages, issuer profiles, auth, docs
  app/dashboard/     issuer console
  app/wallet/        learner wallet
  app/api/v1/        REST API (OpenAPI at /api/v1/openapi.json)
  app/issuers/…/did.json, app/status/[id], app/contexts/…   standards endpoints
  actions/           server actions (all inputs zod-validated, all staff actions role-checked)
  lib/               vc.ts (OB 3.0 + VC-JWT), verify.ts, issuance.ts, status*.ts, keys.ts, crypto.ts, auth.ts …
  middleware.ts      per-request CSP nonce
prisma/              schema, migrations (incl. append-only audit trigger), seed
infra/terraform/     AWS ap-southeast-2 reference deployment
docs/                architecture, UpGuard readiness, compliance roadmap, product roadmap, incident response
tests/               unit (vitest) + e2e (Playwright)
```

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [UpGuard / external security rating readiness](docs/UPGUARD-READINESS.md)
- [Compliance roadmap (ISO 27001, SOC 2, IRAP, Essential Eight, Privacy Act)](docs/COMPLIANCE-ROADMAP.md)
- [Product roadmap](docs/ROADMAP.md)
- [Incident response and Notifiable Data Breaches](docs/INCIDENT-RESPONSE.md)
- [Security policy](SECURITY.md)

> ⚠️ **Choose `APP_URL` before issuing real credentials.** It becomes part of every issuer DID and credential URL, so changing it later breaks verification of credentials already issued.
