# Compliance roadmap

University and TAFE procurement (CAUDIT members, state TAFE networks) usually asks for: a security questionnaire (HECVAT or a CAUDIT-style vendor assessment), ISO/IEC 27001 or SOC 2 evidence, a privacy impact assessment, data sovereignty commitments, and penetration test results. Government-owned TAFEs may also ask about IRAP and Essential Eight.

## Already in the product

| Control | Evidence |
|---|---|
| Australian data residency | Terraform pins `ap-southeast-2`, DR in `ap-southeast-4`; no offshore sub-processors in the request path |
| MFA for privileged users (E8) | TOTP enforced per org by default; owners must opt out explicitly |
| Encryption at rest and in transit | RDS + KMS; AES-256-GCM for keys/USI/TOTP; TLS 1.2+ only; `rds.force_ssl` |
| Least privilege | 4-tier RBAC; scoped API keys; ECS task role limited to SES; non-root read-only containers |
| Audit logging | DB-enforced append-only audit log; ALB, VPC flow and CloudWatch logs |
| Secure SDLC | Typed code, zod validation, unit + e2e tests in CI, `npm audit` gate, Dependabot |
| Privacy by design (APP 1, 3, 11) | Hashed recipient identity in credentials; USI encrypted and excluded from exports; learner-controlled visibility; data minimisation |
| Vulnerability disclosure | `SECURITY.md`, `security.txt` |

## Plan (indicative)

| Quarter | Workstream |
|---|---|
| **Q1** | Information security policy set (ISMS scope, risk register, asset register, supplier policy). Privacy policy and APP-aligned collection notices. PIA template for customers. Incident response and NDB runbook ([INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md)). Compliance automation tool (Vanta, Drata or Secureframe). First independent penetration test (CREST ANZ-accredited). |
| **Q2** | **ISO/IEC 27001:2022** Stage 1 and 2 audits. Pre-filled HECVAT 3 and CAUDIT questionnaire. Essential Eight self-assessment to Maturity Level 2 for corporate IT (application control, patching, macros, hardening, admin privileges, MFA, backups). Move signing keys to AWS KMS HSM. |
| **Q3** | **SOC 2 Type I**, then start the Type II observation window. Row-level security in PostgreSQL. WORM audit-log archive (S3 Object Lock, 7 years). Annual DR test with restore from Melbourne. |
| **Q4** | **SOC 2 Type II** report. **IRAP** assessment (PROTECTED) if pursuing state or federal government TAFEs. Accessibility audit to WCAG 2.2 AA with VPAT/ACR. |

## Privacy Act 1988 (Cth) notes

- Universities and TAFEs are usually covered by **state** privacy law (e.g. NSW PPIP Act, Vic PDP Act, Qld IP Act) as well as or instead of the APPs. Meritbox acts as a contracted service provider: build data processing terms that flow those obligations down.
- USIs are government-related identifiers under the *Student Identifiers Act 2014*. Collect and use them only to support VET reporting, never as a Meritbox identifier, and don't disclose them. Meritbox encrypts them, excludes them from credentials and exports, and shows them masked.
- 2024 amendments: keep transparency on automated decisions in mind if adding AI skills-mapping; the statutory tort for serious invasions of privacy raises the stakes for misuse.
- Retention: credentials are long-lived by nature. Give learners deletion (with issuer-side revocation semantics) and document the retention schedule.
