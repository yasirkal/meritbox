# Product roadmap

Built so far: the core platform (see README). Next, roughly in priority order:

## Integrations (highest leverage for adoption)
1. **LTI 1.3 Advantage tool** for Canvas, Moodle, Brightspace and Blackboard: auto-issue on course or module completion, with deep linking to pick the achievement.
2. **Moodle plugin and Canvas Credentials import** for migration from Badgr or Canvas Credentials.
3. **SMS connectors:** TechnologyOne Student Management, Callista, PeopleSoft Campus Solutions, Ellucian Banner, and for VET aXcelerate, VETtrak and ReadyTech JR Plus. Start with scheduled CSV/SFTP, then APIs.
4. **SSO:** SAML/OIDC for staff via the Australian Access Federation (AAF), Entra ID and Okta. SCIM provisioning.
5. **training.gov.au full register sync:** nightly import of qualifications, units and skill sets, with superseded-code warnings.
6. **My eQuals:** link out from AHEGS/testamur records to Meritbox microcredentials (partnership conversation).
7. **MicroCred Seeker:** export of NMF-compliant metadata for listing.

## Standards
- OpenID4VCI issuance and OpenID4VP presentation to standards-based wallets (and readiness for the national Digital ID ecosystem)
- Data Integrity proofs (`eddsa-rdfc-2022`) alongside VC-JWT
- Verifying credentials from external `did:web` issuers (with an egress proxy for SSRF safety)
- CLR 2.0 transcripts (bundling a learner's credentials from one issuer)
- 1EdTech OB 3.0 issuer and displayer certification
- Baked PNG/SVG badges (OB 3.0 baking)

## Product
- Certificate template designer (PDF, brand fonts, signatures) and badge image uploads (sanitised SVG/PNG)
- Learner profile pages with skills summaries and portfolio links, plus import of credentials from other issuers
- Employer portal: bulk verification, saved candidates, verification receipts
- Analytics: cohorts, LinkedIn share tracking, employer verification trends, skills heatmaps
- Approval workflows (two-person rule for large batches or revocations)
- Expiry reminders and renewals (first aid, WHS)
- Multi-language credential display and accessibility audit (WCAG 2.2 AA)
- Billing (per-credential and enterprise tiers)

## Platform
- Background job queue (SQS) for large batches, webhook retries with exponential backoff, and email
- KMS-backed signing, PostgreSQL row-level security, WORM audit archive
- Idempotency keys on `POST /credentials`
