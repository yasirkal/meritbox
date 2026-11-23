# UpGuard (external security rating) readiness

UpGuard's score (0–950) is an **outside-in** assessment: it looks only at what anyone on the internet can see about your domains, plus breach and reputation signals. To score at the top, you have to build every exposed surface to pass these checks and keep it that way. The table maps each category to where Meritbox handles it.

| UpGuard area | What it checks | Meritbox status | Where |
|---|---|---|---|
| **HTTPS / TLS** | Valid cert, TLS 1.2+ only, no weak ciphers, HTTP→HTTPS redirect | ✅ ALB policy `ELBSecurityPolicy-TLS13-1-2-Res-2021-06`, 301 redirect | `infra/terraform/edge.tf` |
| **HSTS** | Present, long max-age, includeSubDomains, preload | ✅ `max-age=63072000; includeSubDomains; preload`. Submit to hstspreload.org once live | `next.config.ts` |
| **Content-Security-Policy** | Present, no `unsafe-inline` scripts | ✅ nonce + `strict-dynamic`, `object-src 'none'`, `frame-ancestors 'none'` | `src/middleware.ts` |
| **Other headers** | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy | ✅ all set, plus COOP | `next.config.ts` |
| **Server info leakage** | `X-Powered-By`, version banners | ✅ `poweredByHeader: false`; ALB hides the origin | `next.config.ts` |
| **Cookies** | Secure, HttpOnly, SameSite | ✅ `__Host-` prefix, Secure, HttpOnly, Lax | `src/lib/auth.ts` |
| **SPF** | Present, ends in `-all` | ✅ `v=spf1 include:amazonses.com -all` | `dns.tf` |
| **DKIM** | Present | ✅ SES Easy DKIM (3 × 2048-bit CNAMEs) | `dns.tf` |
| **DMARC** | Present, `p=reject` | ✅ `p=reject; sp=reject; adkim=s; aspf=s` | `dns.tf` |
| **MTA-STS / TLS-RPT** | Inbound mail TLS enforcement | ✅ records plus `/.well-known/mta-sts.txt` (set `MTA_STS_MX`) | `dns.tf`, `src/app/.well-known/mta-sts.txt` |
| **DNSSEC** | Zone signed | ✅ Route 53 KSK. Add the DS record at the .au registrar | `dns.tf` |
| **CAA** | Restricts certificate issuers | ✅ `amazon.com` only, no wildcards, iodef | `dns.tf` |
| **Open ports / services** | Only 80/443 exposed | ✅ ALB is the only public resource; RDS and ECS sit in private subnets | `edge.tf`, `data.tf` |
| **Vulnerable software / CVEs** | Known-vulnerable versions fingerprinted | ✅ `npm audit` = 0 at time of writing; Dependabot weekly; CI fails on high | `.github/` |
| **security.txt** | RFC 9116 file | ✅ auto-renewing `Expires` | `src/app/.well-known/security.txt` |
| **Typosquatting / brand** | Lookalike domains | ☐ Register `meritbox.au`, `meritbox.com`, `merit-box.com.au`; enable UpGuard typosquat monitoring | ops |
| **Email/IP reputation** | Blacklists | ☐ Dedicated SES configuration set, bounce/complaint handling, monitor SNDS | ops |
| **Data leaks / breaches** | Credentials on paste sites, exposed buckets | ✅ S3 public-access blocks; ☐ GitHub secret scanning + push protection | `edge.tf`, GitHub |

## Every domain counts

UpGuard scores **every** domain and subdomain it can attribute to you. Common score killers:

1. A marketing site on a different host (WordPress, Webflow) without the same headers. Put it behind CloudFront with a response-headers policy matching `next.config.ts`.
2. Parked or legacy domains with no SPF/DMARC. Publish `v=spf1 -all` and `v=DMARC1; p=reject` on every domain that doesn't send mail.
3. Forgotten staging hosts. Keep staging behind authentication (or Cognito/ALB OIDC) and remove DNS when it's torn down.
4. Third-party subdomains (status page, help desk, `email.` click tracking). Check that each vendor supports HSTS and modern TLS before CNAME-ing it.

## Launch checklist

- [ ] Final production domain chosen and `APP_URL` set (issuer DIDs depend on it)
- [ ] `terraform apply`; DS record lodged with registrar; DNSSEC validated (dnsviz.net)
- [ ] SSL Labs grade A+ · securityheaders.com grade A+ · hardenize.com all green
- [ ] HSTS preload submitted
- [ ] `MTA_STS_MX` set and `https://mta-sts.<domain>/.well-known/mta-sts.txt` reachable
- [ ] Claim your company on UpGuard, attach all domains, review findings weekly
- [ ] Vendor questionnaire answers pre-filled (UpGuard Vendor Risk, CAUDIT HECVAT)
