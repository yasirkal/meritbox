import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { reinstate, resendClaim, revoke } from "@/actions/dashboard";
import { ActionForm, Submit } from "@/components/ActionForm";
import { credentialState, fmtDate, PageTitle, StatusPill } from "@/components/ui";

export default async function CredentialDetail({ params }: { params: Promise<{ id: string }> }) {
  const { org, membership } = await requireStaff();
  const { id } = await params;
  const c = await db.credential.findFirst({ where: { id, organizationId: org.id }, include: { achievement: true, events: { orderBy: { createdAt: "desc" }, take: 20 } } });
  if (!c) notFound();
  const admin = hasRole(membership.role, "ADMIN");
  const usi = c.usiEnc ? decrypt(c.usiEnc, `usi:${c.id}`) : null;
  const history = await db.auditLog.findMany({ where: { organizationId: org.id, targetId: c.id }, orderBy: { createdAt: "desc" } });
  const state = credentialState(c);
  return (
    <>
      <PageTitle
        title={c.recipientName}
        subtitle={<>{c.achievement.name} · <StatusPill status={state} /></>}
        actions={<Link href={`/c/${c.id}`} className="btn btn-ghost">Public page</Link>}
      />
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-6">
          <section className="card p-5">
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div><dt className="muted">Email</dt><dd>{c.recipientEmail}</dd></div>
              <div><dt className="muted">Student ID</dt><dd>{c.studentId ?? "—"}</dd></div>
              <div><dt className="muted">USI</dt><dd>{usi ? `${usi.slice(0, 2)}••••••${usi.slice(-2)}` : "—"}</dd></div>
              <div><dt className="muted">Issued</dt><dd>{fmtDate(c.issuedAt)}</dd></div>
              <div><dt className="muted">Expires</dt><dd>{c.expiresAt ? fmtDate(c.expiresAt) : "Never"}</dd></div>
              <div><dt className="muted">Claimed</dt><dd>{c.claimedAt ? fmtDate(c.claimedAt) : "Not yet"}</dd></div>
              <div><dt className="muted">Page views</dt><dd>{c.viewCount}</dd></div>
              <div><dt className="muted">Status list entry</dt><dd className="font-mono text-xs">{c.statusListIndex}</dd></div>
              {c.revokedAt && <div className="sm:col-span-2"><dt className="muted">Revoked</dt><dd>{fmtDate(c.revokedAt)} — {c.revocationReason}</dd></div>}
            </dl>
          </section>
          <section className="card p-5">
            <h2 className="font-semibold">History</h2>
            <ul className="mt-3 text-sm space-y-1">
              {history.map((h) => <li key={h.id}><span className="muted">{h.createdAt.toLocaleString("en-AU")}</span> — {h.action}</li>)}
              {c.events.map((e) => <li key={e.id}><span className="muted">{e.createdAt.toLocaleString("en-AU")}</span> — verified via {e.method}: {e.result}</li>)}
            </ul>
          </section>
          <details className="card p-5">
            <summary className="font-semibold cursor-pointer">Signed credential (VC-JWT)</summary>
            <code className="block mt-3 text-xs break-all font-mono">{c.jwt}</code>
          </details>
        </div>
        <div className="space-y-4">
          {!c.claimedAt && !c.revokedAt && (
            <ActionForm action={resendClaim} className="card p-4">
              <input type="hidden" name="id" value={c.id} />
              <p className="text-sm mb-3">Not claimed yet. Send the learner a fresh claim link.</p>
              <Submit className="btn btn-ghost">Resend claim email</Submit>
            </ActionForm>
          )}
          {admin && !c.revokedAt && (
            <ActionForm action={revoke} className="card p-4 space-y-3 border-red-200">
              <input type="hidden" name="id" value={c.id} />
              <h2 className="font-semibold">Revoke</h2>
              <p className="text-sm muted">Revocation is published to your status list straight away. The reason is visible to verifiers.</p>
              <label className="label" htmlFor="reason">Reason</label>
              <input id="reason" name="reason" className="input" required minLength={3} maxLength={500} placeholder="e.g. Issued in error" />
              <Submit className="btn btn-danger">Revoke credential</Submit>
            </ActionForm>
          )}
          {admin && c.revokedAt && (
            <form action={reinstate} className="card p-4">
              <input type="hidden" name="id" value={c.id} />
              <p className="text-sm mb-3">Revoked in error? Reinstating clears the status-list entry.</p>
              <button className="btn btn-ghost">Reinstate</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
