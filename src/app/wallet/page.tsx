import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { setVisibility } from "@/actions/wallet";
import { logout } from "@/actions/auth";
import { CopyButton } from "@/components/CopyButton";
import { credentialState, Empty, fmtDate, PageTitle, StatusPill } from "@/components/ui";

export const metadata = { title: "My wallet" };

export default async function Wallet({ searchParams }: { searchParams: Promise<{ claimed?: string }> }) {
  const session = await requireUser("/wallet");
  const { claimed } = await searchParams;
  const [creds, staff] = await Promise.all([
    db.credential.findMany({ where: { recipientUserId: session.userId }, include: { achievement: true, organization: true }, orderBy: { issuedAt: "desc" } }),
    db.membership.count({ where: { userId: session.userId } }),
  ]);
  return (
    <>
      {claimed && <p role="status" className="card p-3 mb-6 text-sm border-emerald-300">🎉 Added to your wallet.</p>}
      <PageTitle
        title="My wallet"
        subtitle={`${session.user.name} · ${session.user.email}`}
        actions={
          <>
            {staff > 0 && <Link href="/dashboard" className="btn btn-ghost">Issuer dashboard</Link>}
            <form action={logout}><button className="btn btn-ghost">Sign out</button></form>
          </>
        }
      />
      {creds.length === 0 ? (
        <Empty title="No credentials yet">When an institution issues you a credential, it will appear here.</Empty>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {creds.map((c) => (
            <article key={c.id} className={`card p-5 flex flex-col ${c.id === claimed ? "ring-2 ring-[var(--color-wattle)]" : ""}`}>
              <div className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/badge/${c.achievementId}`} alt="" width={72} height={72} />
                <div className="min-w-0">
                  <h2 className="font-semibold leading-tight">{c.achievement.name}</h2>
                  <p className="text-xs muted mt-1">{c.organization.name} · {fmtDate(c.issuedAt)}</p>
                  <div className="mt-2 flex gap-2"><StatusPill status={credentialState(c)} />{c.visibility === "PRIVATE" && <span className="pill bg-slate-200 text-slate-700">Private</span>}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Link href={`/c/${c.id}`} className="btn btn-ghost">Open</Link>
                {c.visibility !== "PRIVATE" && <CopyButton text={`${env.appUrl}/c/${c.id}`} label="Copy link" />}
                <form action={setVisibility}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="visibility" value={c.visibility === "PRIVATE" ? "LINK" : "PRIVATE"} />
                  <button className="btn btn-ghost">{c.visibility === "PRIVATE" ? "Make shareable" : "Make private"}</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="hint mt-8">
        Your credentials are Open Badges 3.0 Verifiable Credentials. Download them from each credential page to keep a copy or import into another wallet. Private credentials can&apos;t be viewed or verified by anyone else.
      </p>
    </>
  );
}
