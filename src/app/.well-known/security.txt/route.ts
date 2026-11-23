import { env } from "@/lib/env";

/** RFC 9116 security.txt */
export function GET() {
  const expires = new Date(Date.now() + 180 * 86400_000).toISOString();
  const body = [
    `Contact: ${env.securityContact}`,
    `Expires: ${expires}`,
    `Preferred-Languages: en`,
    `Canonical: ${env.appUrl}/.well-known/security.txt`,
    `Policy: ${env.appUrl}/trust`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
