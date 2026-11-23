import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { activeKey, kidUrl, privateJwkOf } from "./keys";
import { issuerInput } from "./issuer";
import { encodeList, newBitstring, setBit, getBit, STATUS_LIST_SIZE } from "./status-list";
import { buildIssuerProfile, CONTEXTS, signVc } from "./vc";

export function statusListUrl(id: string) {
  return `${env.appUrl}/status/${id}`;
}

/**
 * Allocates the next free index in the organisation's revocation list.
 * Indexes are allocated sequentially within a row lock; a fresh list is opened when one fills.
 */
export async function allocateStatusIndex(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<{ listId: string; index: number }> {
  const rows = await tx.$queryRaw<{ id: string; nextIndex: number; size: number }[]>`
    SELECT id, "nextIndex", size FROM "StatusList"
    WHERE "organizationId" = ${organizationId} AND "nextIndex" < size
    ORDER BY "createdAt" ASC LIMIT 1 FOR UPDATE`;
  let list = rows[0];
  if (!list) {
    const created = await tx.statusList.create({
      data: { organizationId, size: STATUS_LIST_SIZE, bits: new Uint8Array(newBitstring(STATUS_LIST_SIZE)) },
    });
    list = { id: created.id, nextIndex: 0, size: created.size };
  }
  await tx.statusList.update({ where: { id: list.id }, data: { nextIndex: list.nextIndex + 1 } });
  return { listId: list.id, index: list.nextIndex };
}

export async function setStatus(listId: string, index: number, revoked: boolean) {
  await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ bits: Buffer }[]>`
      SELECT bits FROM "StatusList" WHERE id = ${listId} FOR UPDATE`;
    if (!rows[0]) throw new Error("status list not found");
    const bits = setBit(Buffer.from(rows[0].bits), index, revoked);
    await tx.statusList.update({ where: { id: listId }, data: { bits: new Uint8Array(bits) } });
  });
}

export async function isRevoked(listId: string, index: number) {
  const list = await db.statusList.findUnique({ where: { id: listId }, select: { bits: true } });
  if (!list) throw new Error("status list not found");
  return getBit(Buffer.from(list.bits), index);
}

/** Builds and signs the BitstringStatusListCredential served at /status/:id. */
export async function statusListCredential(listId: string) {
  const list = await db.statusList.findUnique({ where: { id: listId }, include: { organization: true } });
  if (!list) return null;
  const url = statusListUrl(list.id);
  const vc = {
    "@context": [CONTEXTS.vc2],
    id: url,
    type: ["VerifiableCredential", "BitstringStatusListCredential"],
    issuer: buildIssuerProfile(issuerInput(list.organization)),
    validFrom: list.updatedAt.toISOString(),
    validUntil: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    credentialSubject: {
      id: `${url}#list`,
      type: "BitstringStatusList",
      statusPurpose: list.purpose,
      encodedList: encodeList(Buffer.from(list.bits)),
    },
  };
  const key = await activeKey(list.organizationId);
  const jwt = await signVc(vc, privateJwkOf(key), key.alg, kidUrl(list.organization, key));
  return { vc, jwt };
}
