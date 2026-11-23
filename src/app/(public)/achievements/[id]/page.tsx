import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AQF_LEVELS } from "@/lib/catalog";

/** Public description of an achievement (the `achievement.id` URL inside each credential). */
export default async function AchievementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const a = await db.achievement.findUnique({ where: { id }, include: { organization: true } });
  if (!a || a.status === "DRAFT") notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 flex flex-col sm:flex-row gap-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/badge/${a.id}`} alt={`${a.name} badge`} width={200} height={200} className="shrink-0" />
      <div>
        <h1 className="text-3xl font-bold">{a.name}</h1>
        <p className="mt-1">Offered by <Link className="link" href={`/issuers/${a.organization.slug}`}>{a.organization.name}</Link></p>
        <p className="mt-4 whitespace-pre-line">{a.description}</p>
        <h2 className="font-semibold mt-6">Criteria</h2>
        <p className="mt-1 whitespace-pre-line">{a.criteria}</p>
        <ul className="mt-6 text-sm space-y-1">
          {a.volumeOfLearningHours && <li>Volume of learning: {a.volumeOfLearningHours} hours</li>}
          {a.aqfLevel && <li>AQF level {a.aqfLevel} ({AQF_LEVELS[a.aqfLevel]})</li>}
          {a.tgaCode && <li>{a.tgaCode} — {a.tgaTitle}</li>}
          {a.status === "ARCHIVED" && <li className="font-semibold">No longer offered</li>}
        </ul>
      </div>
    </div>
  );
}
