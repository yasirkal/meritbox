import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, serializeCredential, withApiKey } from "@/lib/api";
import { issueCredential, USI_RE } from "@/lib/issuance";

const Body = z.object({
  achievement_id: z.string().uuid(),
  recipient: z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    name: z.string().trim().min(1).max(160),
    usi: z.string().trim().toUpperCase().regex(USI_RE).optional(),
    student_id: z.string().trim().max(40).optional(),
  }),
  issued_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  evidence_url: z.string().url().max(500).refine((u) => /^https?:\/\//.test(u)).optional(),
  narrative: z.string().max(2000).optional(),
  notify: z.boolean().default(true),
});

export async function POST(req: Request) {
  const key = await withApiKey(req, "credentials:issue");
  if (key instanceof Response) return key;
  const json = await req.json().catch(() => null);
  const p = Body.safeParse(json);
  if (!p.success) return apiError(422, "invalid_request", p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const achievement = await db.achievement.findFirst({ where: { id: p.data.achievement_id, organizationId: key.organizationId } });
  if (!achievement) return apiError(404, "not_found", "Achievement not found.");
  try {
    const c = await issueCredential(
      { org: key.organization, achievement, actorApiKeyId: key.id, notify: p.data.notify },
      {
        email: p.data.recipient.email,
        name: p.data.recipient.name,
        usi: p.data.recipient.usi,
        studentId: p.data.recipient.student_id,
        issuedAt: p.data.issued_on ? new Date(`${p.data.issued_on}T00:00:00+10:00`) : null,
        evidenceUrl: p.data.evidence_url,
        narrative: p.data.narrative,
      },
    );
    return Response.json({ data: serializeCredential({ ...c, achievement }) }, { status: 201 });
  } catch (e) {
    return apiError(409, "cannot_issue", (e as Error).message);
  }
}

export async function GET(req: Request) {
  const key = await withApiKey(req, "credentials:read");
  if (key instanceof Response) return key;
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? 50) || 50));
  const cursor = sp.get("cursor");
  const rows = await db.credential.findMany({
    where: {
      organizationId: key.organizationId,
      ...(sp.get("email") && { recipientEmail: sp.get("email")!.toLowerCase() }),
      ...(sp.get("achievement_id") && { achievementId: sp.get("achievement_id")! }),
    },
    orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: { achievement: { select: { name: true } } },
  });
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  return Response.json({ data: page.map(serializeCredential), next_cursor: more ? page.at(-1)!.id : null });
}
