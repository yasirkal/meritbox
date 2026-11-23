import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { blindIndex } from "@/lib/crypto";
import { USI_RE } from "@/lib/issuance";
import { credentialState, fmtDate, PageTitle, StatusPill } from "@/components/ui";

const PAGE = 50;

export default async function Credentials({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { org } = await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const where: Prisma.CredentialWhereInput = { organizationId: org.id };
  if (sp.achievement) where.achievementId = sp.achievement;
  if (sp.status === "revoked") where.revokedAt = { not: null };
  if (sp.status === "unclaimed") where.claimedAt = null;
  if (q) {
    where.OR = [
      { recipientEmail: { contains: q.toLowerCase() } },
      { recipientName: { contains: q, mode: "insensitive" } },
      { studentId: q },
      ...(USI_RE.test(q.toUpperCase()) ? [{ usiIndex: blindIndex(q, "usi") }] : []),
      ...(/^[0-9a-f-]{36}$/.test(q) ? [{ id: q }] : []),
    ];
  }
  const [rows, total, achievements] = await Promise.all([
    db.credential.findMany({ where, orderBy: { issuedAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE, include: { achievement: { select: { name: true } } } }),
    db.credential.count({ where }),
    db.achievement.findMany({ where: { organizationId: org.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const qs = (p: number) => `?${new URLSearchParams({ ...(q && { q }), ...(sp.achievement && { achievement: sp.achievement }), ...(sp.status && { status: sp.status }), page: String(p) })}`;
  return (
    <>
      <PageTitle
        title="Credentials"
        subtitle={`${total.toLocaleString("en-AU")} matching`}
        actions={<><Link className="btn btn-primary" href="/dashboard/issue">Issue</Link><a className="btn btn-ghost" href={`/dashboard/credentials/export${qs(1)}`}>Export CSV</a></>}
      />
      <form className="card p-3 mb-4 grid sm:grid-cols-[1fr_220px_160px_auto] gap-2">
        <label htmlFor="q" className="sr-only">Search</label>
        <input id="q" name="q" defaultValue={q} className="input" placeholder="Name, email, student ID, USI or credential ID" />
        <select name="achievement" defaultValue={sp.achievement ?? ""} className="input" aria-label="Achievement">
          <option value="">All achievements</option>
          {achievements.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="input" aria-label="Status">
          <option value="">Any status</option>
          <option value="revoked">Revoked</option>
          <option value="unclaimed">Not yet claimed</option>
        </select>
        <button className="btn btn-ghost">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Recipient</th><th>Achievement</th><th>Issued</th><th>Claimed</th><th>Views</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><Link className="link font-medium" href={`/dashboard/credentials/${c.id}`}>{c.recipientName}</Link><div className="text-xs muted">{c.recipientEmail}</div></td>
                <td>{c.achievement.name}</td>
                <td className="whitespace-nowrap">{fmtDate(c.issuedAt)}</td>
                <td>{c.claimedAt ? "Yes" : "—"}</td>
                <td className="tabular-nums">{c.viewCount}</td>
                <td><StatusPill status={credentialState(c)} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">No credentials match.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between mt-4 text-sm">
        {page > 1 ? <Link className="link" href={qs(page - 1)}>← Previous</Link> : <span />}
        {page * PAGE < total && <Link className="link" href={qs(page + 1)}>Next →</Link>}
      </div>
    </>
  );
}
