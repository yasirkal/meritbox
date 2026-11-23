# Everything here is what external rating tools (UpGuard, SecurityScorecard, Hardenize) inspect.
data "aws_route53_zone" "main" { name = var.domain }

resource "aws_route53_record" "apex" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain
  type    = "A"
  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = { for o in aws_acm_certificate.main.domain_validation_options : o.domain_name => o }
  zone_id  = data.aws_route53_zone.main.zone_id
  name     = each.value.resource_record_name
  type     = each.value.resource_record_type
  records  = [each.value.resource_record_value]
  ttl      = 300
}
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# CAA: only Amazon may issue certificates; report violations.
resource "aws_route53_record" "caa" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain
  type    = "CAA"
  ttl     = 3600
  records = ["0 issue \"amazon.com\"", "0 issuewild \";\"", "0 iodef \"mailto:${var.security_contact_email}\""]
}

# --- Email authentication -------------------------------------------------
resource "aws_sesv2_email_identity" "domain" { email_identity = var.domain }

resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain}"
  type    = "CNAME"
  ttl     = 3600
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  email_identity         = aws_sesv2_email_identity.domain.email_identity
  mail_from_domain       = "mail.${var.domain}"
  behavior_on_mx_failure = "REJECT_MESSAGE"
}
resource "aws_route53_record" "mail_from_mx" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "mail.${var.domain}"
  type    = "MX"
  ttl     = 3600
  records = ["10 feedback-smtp.ap-southeast-2.amazonses.com"]
}
resource "aws_route53_record" "mail_from_spf" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "mail.${var.domain}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=spf1 include:amazonses.com -all"]
}

# Apex SPF: add your corporate mail provider's include if staff mail is sent from this domain.
resource "aws_route53_record" "spf" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain
  type    = "TXT"
  ttl     = 3600
  records = ["v=spf1 include:amazonses.com -all"]
}

resource "aws_route53_record" "dmarc" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "_dmarc.${var.domain}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s; pct=100; rua=mailto:dmarc@${var.domain}; fo=1"]
}

resource "aws_route53_record" "mta_sts" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "_mta-sts.${var.domain}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=STSv1; id=20261123"]
}
resource "aws_route53_record" "tls_rpt" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "_smtp._tls.${var.domain}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=TLSRPTv1; rua=mailto:tls-reports@${var.domain}"]
}
# Serve https://mta-sts.<domain>/.well-known/mta-sts.txt (mode: enforce) — see docs/UPGUARD-READINESS.md.

# --- DNSSEC ---------------------------------------------------------------
resource "aws_kms_key" "dnssec" {
  provider                 = aws.us_east_1
  customer_master_key_spec = "ECC_NIST_P256"
  key_usage                = "SIGN_VERIFY"
  deletion_window_in_days  = 7
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Sid = "Root", Effect = "Allow", Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.me.account_id}:root" }, Action = "kms:*", Resource = "*" },
      { Sid = "Route53", Effect = "Allow", Principal = { Service = "dnssec-route53.amazonaws.com" }, Action = ["kms:DescribeKey", "kms:GetPublicKey", "kms:Sign"], Resource = "*" },
    ]
  })
}
resource "aws_route53_key_signing_key" "main" {
  hosted_zone_id             = data.aws_route53_zone.main.zone_id
  key_management_service_arn = aws_kms_key.dnssec.arn
  name                       = "meritbox-ksk"
}
resource "aws_route53_hosted_zone_dnssec" "main" {
  depends_on     = [aws_route53_key_signing_key.main]
  hosted_zone_id = data.aws_route53_zone.main.zone_id
}
# Then add the DS record at the .au registrar (auDA) from aws_route53_key_signing_key.main.ds_record.

output "ds_record" { value = aws_route53_key_signing_key.main.ds_record }
output "app_url" { value = local.app_url }
