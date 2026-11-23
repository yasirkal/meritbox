import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, PageTitle, Stat, StatusPill, credentialState } from "@/components/ui";

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { org, user } = await requireStaff();
  const sp = await searchParams;
  const since = new Date(Date.now() - 30 * 86400_000);
  const where = { organizationId: org.id };
  const [issued, issued30, claimed, revoked, views, verifications, achievements, recent, top] = await Promise.all([
    db.credential.count({ where }),
    db.credential.count({ where: { ...where, issuedAt: { gte: since } } }),
    db.credential.count({ where: { ...where, claimedAt: { not: null } } }),
    db.credential.count({ where: { ...where, revokedAt: { not: null } } }),
    db.credential.aggregate({ where, _sum: { viewCount: true } }),
    db.verificationEvent.count({ where: { credential: { organizationId: org.id }, createdAt: { gte: since } } }),
    db.achievement.count({ where: { ...where, status: "PUBLISHED" } }),
    db.credential.findMany({ where, orderBy: { issuedAt: "desc" }, take: 8, include: { achievement: { select: { name: true } } } }),
    db.credential.groupBy({ by: ["achievementId"], where, _count: true, orderBy: { _count: { achievementId: "desc" } }, take: 5 }),
  ]);
  const topNames = await db.achievement.findMany({ where: { id: { in: top.map((t) => t.achievementId) } }, select: { id: true, name: true } });
  const claimRate = issued ? Math.round((claimed / issued) * 100) : 0;
  return (
    <>
      {sp.mfa && <p role="status" className="card p-3 mb-4 text-sm">Two-factor authentication is on. 🔒</p>}
      {sp.denied && <p role="alert" className="card p-3 mb-4 text-sm">You don&apos;t have permission for that page. Ask an admin to change your role.</p>}
      {!user.emailVerifiedAt && <p className="card p-3 mb-4 text-sm">Please confirm your email address. We sent a link when you signed up.</p>}
      <PageTitle
        title={`G'day, ${user.name.split(" ")[0]}`}
        subtitle={`${org.name} at a glance`}
        actions={<><Link href="/dashboard/issue" className="btn btn-primary">Issue credentials</Link><Link href="/dashboard/achievements/new" className="btn btn-ghost">New achievement</Link></>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Credentials issued" value={issued.toLocaleString("en-AU")} hint={`${issued30.toLocaleString("en-AU")} in the last 30 days`} />
        <Stat label="Claimed by learners" value={`${claimRate}%`} hint={`${claimed.toLocaleString("en-AU")} claimed`} />
        <Stat label="Page views" value={(views._sum.viewCount ?? 0).toLocaleString("en-AU")} hint={`${verifications.toLocaleString("en-AU")} verification${verifications === 1 ? "" : "s"} (30 days)`} />
        <Stat label="Published achievements" value={achievements} hint={`${revoked} revoked credentials`} />
      </div>
      <div className="grid lg:grid-cols-[2fr_1fr] gap-6 mt-8">
        <section className="card overflow-x-auto">
          <h2 className="font-semibold p-4 pb-0">Recently issued</h2>
          <table className="table mt-2">
            <thead><tr><th>Recipient</th><th>Achievement</th><th>Issued</th><th>Status</th></tr></thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id}>
                  <td><Link className="link" href={`/dashboard/credentials/${c.id}`}>{c.recipientName}</Link></td>
                  <td>{c.achievement.name}</td>
                  <td>{fmtDate(c.issuedAt)}</td>
                  <td><StatusPill status={credentialState(c)} /></td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={4} className="muted">Nothing issued yet. Create an achievement, publish it, then issue.</td></tr>}
            </tbody>
          </table>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold">Most issued</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {top.map((t) => (
              <li key={t.achievementId} className="flex justify-between gap-2">
                <span>{topNames.find((n) => n.id === t.achievementId)?.name}</span>
                <span className="tabular-nums font-semibold">{t._count.toLocaleString("en-AU")}</span>
              </li>
            ))}
            {top.length === 0 && <li className="muted">No data yet.</li>}
          </ol>
        </section>
      </div>
    </>
  );
}
