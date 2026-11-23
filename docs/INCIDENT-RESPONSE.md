# Incident response and Notifiable Data Breaches (NDB) runbook

## Severity
| Sev | Example | Response |
|---|---|---|
| 1 | Signing key or database compromise, mass data exposure | Immediate; incident commander paged 24/7 |
| 2 | Single-tenant data exposure, account takeover, MFA bypass | Within 1 hour |
| 3 | Vulnerability with no evidence of exploitation | Next business day |

## Steps
1. **Contain:** revoke sessions (`DELETE FROM "Session"`), revoke affected API keys, block at WAF, rotate secrets in Secrets Manager.
2. **Signing key compromise:** rotate the issuer key (Settings → Rotate). Credentials signed by the compromised key need assessment. If forgery is possible, mark the key compromised in the DID document, revoke and reissue the affected credentials, and notify the issuer.
3. **Preserve evidence:** snapshot RDS, export the audit log, ALB and CloudWatch logs.
4. **Assess under the NDB scheme (Privacy Act Part IIIC):** is there unauthorised access to, disclosure of, or loss of personal information that is likely to result in **serious harm**? Complete the assessment within **30 days** (aim for 72 hours).
5. **Notify** if it is an eligible data breach: the OAIC (Notifiable Data Breach form) and affected individuals, as soon as practicable. As a service provider, notify the customer institution **immediately**, since they may have their own state-law obligations. USI exposure must also be reported to the Student Identifiers Registrar.
6. **Review:** blameless post-incident review within 10 business days; track actions to closure.

## Contacts
Keep current in the on-call tool: incident commander, CTO, privacy officer, legal counsel, AWS Support (Enterprise), cyber insurer, ACSC (cyber.gov.au, 1300 CYBER1).
