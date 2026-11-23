import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyCredentialJwt } from "@/lib/verify";
import { AQF_LEVELS } from "@/lib/catalog";
import { fmtDate, StatusPill, typeLabel } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return db.credential.findUnique({ where: { id }, include: { achievement: true, organization: true } });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const c = await load((await params).id);
  if (!c || c.visibility === "PRIVATE") return { title: "Credential not found", robots: { index: false } };
  return {
    title: `${c.achievement.name} — ${c.recipientName}`,
    description: `${c.recipientName} earned ${c.achievement.name} from ${c.organization.name}. Verified by Meritbox.`,
    robots: { index: false },
    openGraph: { images: [`/api/badge/${c.achievementId}`] },
  };
}

export default async function CredentialPage({ params }: Params) {
  const { id } = await params;
  const c = await load(id);
  if (!c) notFound();
  const session = await getSession();
  const isOwner = session?.userId && session.userId === c.recipientUserId;
  if (c.visibility === "PRIVATE" && !isOwner) notFound();

  if (!isOwner) await db.credential.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  const result = await verifyCredentialJwt(c.jwt, "page");
  const a = c.achievement;
  const skills = (a.skills as { name: string; framework?: string }[]) ?? [];
  const url = `${env.appUrl}/c/${c.id}`;
  const li = new URL("https://www.linkedin.com/profile/add");
  li.searchParams.set("startTask", "CERTIFICATION_NAME");
  li.searchParams.set("name", a.name);
  li.searchParams.set("organizationName", c.organization.name);
  li.searchParams.set("issueYear", String(c.issuedAt.getFullYear()));
  li.searchParams.set("issueMonth", String(c.issuedAt.getMonth() + 1));
  if (c.expiresAt) {
    li.searchParams.set("expirationYear", String(c.expiresAt.getFullYear()));
    li.searchParams.set("expirationMonth", String(c.expiresAt.getMonth() + 1));
  }
  li.searchParams.set("certUrl", url);
  li.searchParams.set("certId", c.id);

  const nmf: [string, string | number | null][] = [
    ["Volume of learning", a.volumeOfLearningHours ? `${a.volumeOfLearningHours} hours` : null],
    ["AQF alignment", a.aqfLevel ? `Level ${a.aqfLevel} — ${AQF_LEVELS[a.aqfLevel]}` : null],
    ["Assessment", a.assessmentType],
    ["Delivery mode", a.deliveryMode],
    ["Credit recognition", a.creditRecognition],
    ["Industry endorsement", a.industryEndorsement],
    ["Credit points", a.creditPoints ? a.creditPoints.toString() : null],
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className={`card p-4 mb-6 flex items-center gap-3 ${result.status === "valid" ? "border-emerald-300" : "border-red-300"}`}>
        <span aria-hidden className="text-2xl">{result.status === "valid" ? "✅" : result.status === "expired" ? "⏳" : "⛔"}</span>
        <div className="flex-1">
          <p className="font-semibold">
            {result.status === "valid" && "Verified credential"}
            {result.status === "revoked" && "This credential has been revoked by the issuer"}
            {result.status === "expired" && "This credential has expired"}
            {result.status === "invalid" && "This credential could not be verified"}
          </p>
          <p className="text-sm muted">Checked just now against {c.organization.name}&apos;s published keys and revocation list.</p>
        </div>
        <StatusPill status={result.status} />
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-8">
        <div className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/badge/${a.id}`} alt={`${a.name} badge`} width={280} height={280} className="w-full h-auto max-w-[200px] md:max-w-none mx-auto" />
          <div className="flex flex-col gap-2 no-print">
            <a href={li.toString()} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Add to LinkedIn</a>
            <CopyButton text={url} label="Copy share link" />
            <Link href={`/c/${c.id}/certificate`} className="btn btn-ghost">Printable certificate</Link>
            <a href={`/c/${c.id}/credential?download`} className="btn btn-ghost">Download (VC-JWT)</a>
            <a href={`/c/${c.id}/credential?format=json&download`} className="btn btn-ghost">Download (JSON)</a>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide muted">{typeLabel(a.achievementType)}</p>
          <h1 className="text-3xl font-bold mt-1">{a.name}</h1>
          <p className="mt-2">
            Awarded to <strong>{c.recipientName}</strong> by{" "}
            <Link href={`/issuers/${c.organization.slug}`} className="link">{c.organization.name}</Link> on {fmtDate(c.issuedAt)}
            {c.expiresAt && <> · valid until {fmtDate(c.expiresAt)}</>}
          </p>
          <section className="mt-6">
            <h2 className="font-semibold">Description</h2>
            <p className="mt-1 whitespace-pre-line">{a.description}</p>
          </section>
          <section className="mt-6">
            <h2 className="font-semibold">Criteria</h2>
            <p className="mt-1 whitespace-pre-line">{a.criteria}</p>
          </section>
          {(c.narrative || c.evidenceUrl) && (
            <section className="mt-6">
              <h2 className="font-semibold">Evidence</h2>
              {c.narrative && <p className="mt-1">{c.narrative}</p>}
              {c.evidenceUrl && /^https?:\/\//.test(c.evidenceUrl) && (
                <a href={c.evidenceUrl} className="link" rel="noopener noreferrer nofollow" target="_blank">View evidence</a>
              )}
            </section>
          )}
          {a.tgaCode && (
            <section className="mt-6">
              <h2 className="font-semibold">Nationally recognised training</h2>
              <p className="mt-1">
                {a.tgaCode} — {a.tgaTitle}{" "}
                <a className="link" target="_blank" rel="noopener noreferrer" href={`https://training.gov.au/Training/Details/${encodeURIComponent(a.tgaCode)}`}>
                  training.gov.au
                </a>
              </p>
              {c.organization.rtoCode && <p className="text-sm muted">RTO {c.organization.rtoCode}</p>}
            </section>
          )}
          {nmf.some(([, v]) => v) && (
            <section className="mt-6">
              <h2 className="font-semibold">Microcredential information</h2>
              <p className="hint">Per the National Microcredentials Framework.</p>
              <dl className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {nmf.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}>
                    <dt className="muted">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {skills.length > 0 && (
            <section className="mt-6">
              <h2 className="font-semibold">Skills</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {skills.map((s) => (
                  <li key={s.name} className="pill bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">{s.name}</li>
                ))}
              </ul>
            </section>
          )}
          <details className="mt-8 card p-4">
            <summary className="font-semibold cursor-pointer">Verification details</summary>
            <ul className="mt-3 space-y-2 text-sm">
              {result.checks.map((ch) => (
                <li key={ch.id} className="flex gap-2">
                  <span aria-hidden>{ch.status === "pass" ? "✔" : ch.status === "warn" ? "!" : "✖"}</span>
                  <span><strong>{ch.label}</strong>{ch.detail && <span className="muted"> — {ch.detail}</span>}</span>
                </li>
              ))}
            </ul>
            <p className="hint mt-3">Open Badges 3.0 · W3C Verifiable Credential · Issuer DID {result.issuer?.id}</p>
          </details>
        </div>
      </div>
    </div>
  );
}
