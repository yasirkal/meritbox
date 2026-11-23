import type { Prisma } from "@prisma/client";
import Papa from "papaparse";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";

/** CSV export. USIs are deliberately excluded. Cells are neutralised against spreadsheet formula injection. */
export async function GET(req: Request) {
  const { org, user } = await requireStaff("ISSUER");
  const sp = new URL(req.url).searchParams;
  const where: Prisma.CredentialWhereInput = { organizationId: org.id };
  if (sp.get("achievement")) where.achievementId = sp.get("achievement")!;
  if (sp.get("status") === "revoked") where.revokedAt = { not: null };
  if (sp.get("status") === "unclaimed") where.claimedAt = null;
  const rows = await db.credential.findMany({ where, orderBy: { issuedAt: "desc" }, take: 50000, include: { achievement: { select: { name: true } } } });
  const safe = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  };
  const csv = Papa.unparse(
    rows.map((c) => ({
      credential_id: c.id,
      url: `${env.appUrl}/c/${c.id}`,
      achievement: safe(c.achievement.name),
      name: safe(c.recipientName),
      email: safe(c.recipientEmail),
      student_id: safe(c.studentId),
      issued_at: c.issuedAt.toISOString(),
      expires_at: c.expiresAt?.toISOString() ?? "",
      claimed_at: c.claimedAt?.toISOString() ?? "",
      revoked_at: c.revokedAt?.toISOString() ?? "",
      revocation_reason: safe(c.revocationReason),
      views: c.viewCount,
    })),
  );
  await audit({ action: "credential.exported", organizationId: org.id, actorUserId: user.id, meta: { rows: rows.length } });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="meritbox-credentials-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
