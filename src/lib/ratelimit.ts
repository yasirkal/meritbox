import "server-only";
import { db } from "./db";

/**
 * Fixed-window rate limiter backed by Postgres (no extra infrastructure needed).
 * Put AWS WAF rate-based rules in front of this in production for volumetric protection.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" (key, count, "windowStart") VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds})
                   THEN 1 ELSE "RateLimit".count + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds})
                   THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING count`;
  const count = rows[0]?.count ?? 1;
  return { ok: count <= limit, remaining: Math.max(0, limit - count) };
}
