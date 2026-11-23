import { db } from "@/lib/db";
import { peekJwt } from "@/lib/vc";

/** Download the signed credential: ?format=jwt (default, application/vc+jwt) or ?format=json (decoded). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const c = await db.credential.findUnique({ where: { id }, select: { jwt: true, visibility: true } });
  if (!c || c.visibility === "PRIVATE") return new Response("Not found", { status: 404 });
  const format = new URL(req.url).searchParams.get("format");
  const download = new URL(req.url).searchParams.has("download");
  if (format === "json") {
    return Response.json(peekJwt(c.jwt).payload, {
      headers: download ? { "content-disposition": `attachment; filename="credential-${id}.json"` } : {},
    });
  }
  return new Response(c.jwt, {
    headers: {
      "content-type": "application/vc+jwt",
      ...(download ? { "content-disposition": `attachment; filename="credential-${id}.jwt"` } : {}),
    },
  });
}
