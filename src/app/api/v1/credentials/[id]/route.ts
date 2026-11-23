import { db } from "@/lib/db";
import { apiError, serializeCredential, withApiKey } from "@/lib/api";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const key = await withApiKey(req, "credentials:read");
  if (key instanceof Response) return key;
  const { id } = await params;
  const c = await db.credential.findFirst({ where: { id, organizationId: key.organizationId }, include: { achievement: { select: { name: true } } } });
  if (!c) return apiError(404, "not_found", "Credential not found.");
  return Response.json({ data: serializeCredential(c) });
}
