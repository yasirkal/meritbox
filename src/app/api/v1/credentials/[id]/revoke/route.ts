import { z } from "zod";
import { apiError, serializeCredential, withApiKey } from "@/lib/api";
import { revokeCredential } from "@/lib/issuance";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const key = await withApiKey(req, "credentials:revoke");
  if (key instanceof Response) return key;
  const { id } = await params;
  const p = z.object({ reason: z.string().min(3).max(500) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return apiError(422, "invalid_request", "Provide a 'reason' (3–500 characters).");
  try {
    const c = await revokeCredential({ organizationId: key.organizationId, credentialId: id, reason: p.data.reason, actorApiKeyId: key.id });
    return Response.json({ data: serializeCredential(c) });
  } catch {
    return apiError(404, "not_found", "Credential not found.");
  }
}
