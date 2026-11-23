import { db } from "@/lib/db";

/** Liveness/readiness for the load balancer. Reveals nothing beyond up/down. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
