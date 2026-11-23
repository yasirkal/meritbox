import { statusListCredential } from "@/lib/status";

/** BitstringStatusListCredential. Returns the VC-JWT by default; ?format=json for the unsigned body. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const result = await statusListCredential(id);
  if (!result) return new Response("Not found", { status: 404 });
  const headers = { "cache-control": "public, max-age=60" };
  if (new URL(req.url).searchParams.get("format") === "json") return Response.json(result.vc, { headers });
  return new Response(result.jwt, { headers: { ...headers, "content-type": "application/vc+jwt" } });
}
