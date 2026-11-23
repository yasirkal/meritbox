import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { setAchievementStatus } from "@/actions/dashboard";
import { AchievementForm } from "@/components/AchievementForm";
import { PageTitle, StatusPill } from "@/components/ui";

export default async function EditAchievement({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { org, membership } = await requireStaff();
  const { id } = await params;
  const { created } = await searchParams;
  const a = await db.achievement.findFirst({ where: { id, organizationId: org.id } });
  if (!a) notFound();
  const admin = hasRole(membership.role, "ADMIN");
  const statusBtn = (status: string, label: string, cls = "btn btn-ghost") => (
    <form action={setAchievementStatus}>
      <input type="hidden" name="id" value={a.id} />
      <input type="hidden" name="status" value={status} />
      <button className={cls}>{label}</button>
    </form>
  );
  return (
    <>
      {created && <p role="status" className="card p-3 mb-4 text-sm">Draft created. Check the details, then publish to start issuing.</p>}
      <PageTitle
        title={a.name}
        subtitle={<span className="inline-flex gap-2 items-center"><StatusPill status={a.status} /> {a.achievementType}</span>}
        actions={
          <>
            {a.status === "PUBLISHED" && <Link className="btn btn-primary" href={`/dashboard/issue?achievement=${a.id}`}>Issue</Link>}
            {admin && a.status !== "PUBLISHED" && statusBtn("PUBLISHED", "Publish", "btn btn-primary")}
            {admin && a.status === "PUBLISHED" && statusBtn("ARCHIVED", "Archive")}
            {a.status !== "DRAFT" && <Link className="btn btn-ghost" href={`/achievements/${a.id}`}>Public page</Link>}
          </>
        }
      />
      <div className="grid lg:grid-cols-[1fr_220px] gap-6 items-start">
        <AchievementForm a={a} />
        <div className="card p-4 text-center lg:sticky lg:top-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/badge/${a.id}?v=${a.updatedAt.getTime()}`} alt="Badge preview" width={180} height={180} className="mx-auto" />
          <p className="hint">Preview updates when you save.</p>
        </div>
      </div>
    </>
  );
}
