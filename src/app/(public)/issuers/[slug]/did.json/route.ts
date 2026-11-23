import { db } from "@/lib/db";
import { didDocument } from "@/lib/keys";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await db.organization.findUnique({ where: { slug } });
  if (!org) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(await didDocument(org), {
    headers: { "content-type": "application/did+json", "cache-control": "public, max-age=300" },
  });
}
