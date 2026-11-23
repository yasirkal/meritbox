import "server-only";
import { db } from "./db";
import { clientIp } from "./request";

export async function audit(entry: {
  action: string;
  organizationId?: string | null;
  actorUserId?: string | null;
  actorApiKeyId?: string | null;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}) {
  let ip: string | undefined;
  try {
    ip = await clientIp();
  } catch {
    ip = undefined; // outside a request (seed scripts, jobs)
  }
  await db.auditLog.create({
    data: {
      action: entry.action,
      organizationId: entry.organizationId ?? null,
      actorUserId: entry.actorUserId ?? null,
      actorApiKeyId: entry.actorApiKeyId ?? null,
      targetType: entry.targetType,
      targetId: entry.targetId,
      ip,
      meta: (entry.meta ?? {}) as object,
    },
  });
}
