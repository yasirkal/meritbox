import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Empty, PageTitle, StatusPill } from "@/components/ui";

export default async function Achievements() {
  const { org } = await requireStaff();
  const list = await db.achievement.findMany({
    where: { organizationId: org.id },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: { _count: { select: { credentials: true } } },
  });
  return (
    <>
      <PageTitle title="Achievements" subtitle="The credentials your institution offers. Publish an achievement to start issuing it." actions={<Link href="/dashboard/achievements/new" className="btn btn-primary">New achievement</Link>} />
      {list.length === 0 ? (
        <Empty title="No achievements yet">Create your first microcredential, badge or certificate.</Empty>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((a) => (
            <Link key={a.id} href={`/dashboard/achievements/${a.id}`} className="card p-4 flex gap-3 hover:border-[var(--color-brand-500)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/badge/${a.id}?v=${a.updatedAt.getTime()}`} alt="" width={72} height={72} />
              <div className="min-w-0">
                <p className="font-semibold truncate">{a.name}</p>
                <p className="text-xs muted">{a.achievementType} · {a._count.credentials} issued</p>
                <div className="mt-2"><StatusPill status={a.status} /></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
