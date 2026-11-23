import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageTitle } from "@/components/ui";

export default async function Audit({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { org } = await requireStaff("ADMIN");
  const page = Math.max(1, Number((await searchParams).page ?? 1) || 1);
  const rows = await db.auditLog.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "desc" }, take: 100, skip: (page - 1) * 100 });
  const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.actorUserId).filter((x): x is string => !!x) } }, select: { id: true, email: true } });
  const keys = await db.apiKey.findMany({ where: { id: { in: rows.map((r) => r.actorApiKeyId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  return (
    <>
      <PageTitle title="Audit log" subtitle="Append-only record of every security-relevant action. Retained for 7 years." />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>IP</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs">{r.createdAt.toLocaleString("en-AU")}</td>
                <td className="text-xs">{users.find((u) => u.id === r.actorUserId)?.email ?? (r.actorApiKeyId ? `API key: ${keys.find((k) => k.id === r.actorApiKeyId)?.name}` : "system")}</td>
                <td><code className="text-xs">{r.action}</code></td>
                <td className="text-xs">{r.targetType} {r.targetId?.slice(0, 8)}</td>
                <td className="text-xs font-mono">{r.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between mt-4 text-sm">
        {page > 1 ? <Link className="link" href={`?page=${page - 1}`}>← Newer</Link> : <span />}
        {rows.length === 100 && <Link className="link" href={`?page=${page + 1}`}>Older →</Link>}
      </div>
    </>
  );
}
