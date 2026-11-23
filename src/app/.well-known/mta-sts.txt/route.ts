/** RFC 8461 MTA-STS policy (served for the mta-sts.<domain> host). Enabled when MTA_STS_MX is set. */
export function GET() {
  const mx = process.env.MTA_STS_MX?.split(",").map((m) => m.trim()).filter(Boolean);
  if (!mx?.length) return new Response("Not found", { status: 404 });
  const body = ["version: STSv1", "mode: enforce", ...mx.map((m) => `mx: ${m}`), "max_age: 604800", ""].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
