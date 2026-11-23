import { z } from "zod";
import { apiError } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { verifyCredentialJwt } from "@/lib/verify";

/** Free, unauthenticated verification for employers and other relying parties. */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
  if (!(await rateLimit(`verify-api:${ip}`, 120, 60)).ok) return apiError(429, "rate_limited", "Up to 120 verifications per minute.");
  const p = z.object({ credential: z.string().min(20).max(200_000) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return apiError(422, "invalid_request", "Send { \"credential\": \"<VC-JWT>\" }.");
  const r = await verifyCredentialJwt(p.data.credential, "api");
  return Response.json(
    { verified: r.verified, status: r.status, checks: r.checks, issuer: r.issuer ?? null, credential: r.credential ?? null },
    { headers: { "access-control-allow-origin": "*", "cache-control": "no-store" } },
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" },
  });
}
