# Meritbox on AWS (ap-southeast-2)

Reference infrastructure for a production deployment that keeps all data in Australia.
**Status: starting point. Not yet run through `terraform plan`. Review with your cloud team before applying.**

| Concern | Choice |
|---|---|
| Region | `ap-southeast-2` (Sydney); backups copied to `ap-southeast-4` (Melbourne) |
| Compute | ECS Fargate, private subnets, read-only root FS, non-root user |
| Database | RDS PostgreSQL 16, Multi-AZ, KMS-encrypted, TLS enforced, 35-day PITR |
| Secrets | Secrets Manager (master key, DB URL), KMS CMK with rotation |
| Edge | ALB with TLS 1.3/1.2-only policy, AWS WAF (managed rules + rate limiting), HTTP→HTTPS redirect |
| DNS | Route 53 with DNSSEC, CAA, SPF, DMARC `p=reject`, MTA-STS, TLS-RPT |
| Email | SES (Sydney) with Easy DKIM, custom MAIL FROM |
| Logging | CloudWatch (1-year retention), ALB access logs, GuardDuty and Security Hub recommended |

Apply order: `terraform init && terraform apply`, then run the migration task, then point `APP_URL` at the final domain **before issuing real credentials** (the URL becomes part of every issuer DID).
