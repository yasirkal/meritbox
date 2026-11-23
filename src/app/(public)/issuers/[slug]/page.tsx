import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { issuerDid } from "@/lib/keys";
import { typeLabel as achievementTypeLabel } from "@/components/ui";

export default async function IssuerProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await db.organization.findUnique({
    where: { slug },
    include: { achievements: { where: { status: "PUBLISHED" }, orderBy: { name: "asc" } } },
  });
  if (!org) notFound();
  const typeLabel: Record<string, string> = { UNIVERSITY: "University", TAFE: "TAFE", RTO: "Registered Training Organisation", PROFESSIONAL_BODY: "Professional body", EMPLOYER: "Employer", OTHER: "Issuer" };
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <p className="text-sm font-semibold muted uppercase tracking-wide">{typeLabel[org.type]}</p>
      <h1 className="text-3xl font-bold">{org.name}</h1>
      {org.description && <p className="mt-2 max-w-2xl">{org.description}</p>}
      <dl className="mt-4 text-sm grid sm:grid-cols-2 gap-2">
        {org.rtoCode && <div><dt className="muted inline">RTO code: </dt><dd className="inline">{org.rtoCode}</dd></div>}
        {org.cricosCode && <div><dt className="muted inline">CRICOS: </dt><dd className="inline">{org.cricosCode}</dd></div>}
        {org.teqsaId && <div><dt className="muted inline">TEQSA PRV: </dt><dd className="inline">{org.teqsaId}</dd></div>}
        {org.abn && <div><dt className="muted inline">ABN: </dt><dd className="inline">{org.abn}</dd></div>}
        {org.website && <div><dt className="muted inline">Website: </dt><dd className="inline"><a className="link" href={org.website} rel="noopener noreferrer">{org.website}</a></dd></div>}
        <div className="sm:col-span-2"><dt className="muted inline">Issuer DID: </dt><dd className="inline font-mono text-xs break-all"><a className="link" href={`/issuers/${org.slug}/did.json`}>{issuerDid(org)}</a></dd></div>
      </dl>
      <h2 className="text-xl font-semibold mt-10">Credentials offered</h2>
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {org.achievements.map((a) => (
          <Link key={a.id} href={`/achievements/${a.id}`} className="card p-4 flex gap-3 items-center hover:border-[var(--color-brand-500)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/badge/${a.id}`} alt="" width={64} height={64} />
            <div>
              <p className="font-semibold">{a.name}</p>
              <p className="text-xs muted">{achievementTypeLabel(a.achievementType)}{a.volumeOfLearningHours ? ` · ${a.volumeOfLearningHours} h` : ""}</p>
            </div>
          </Link>
        ))}
        {org.achievements.length === 0 && <p className="muted">No published credentials yet.</p>}
      </div>
    </div>
  );
}
