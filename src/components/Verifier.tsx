"use client";
import { useActionState } from "react";
import { verifyAction, type VerifyState } from "@/actions/verify";
import { Submit } from "./ActionForm";

export function Verifier() {
  const [state, action] = useActionState<VerifyState, FormData>(verifyAction, null);
  const r = state?.result;
  const subject = r?.credential?.credentialSubject as { name?: string; achievement?: { name?: string } } | undefined;
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <form action={action} className="card p-6 space-y-4">
        <div>
          <label htmlFor="input" className="label">Credential link or VC-JWT</label>
          <textarea id="input" name="input" className="input font-mono text-xs min-h-40" placeholder="https://…/c/…  or  eyJhbGciOi…" />
        </div>
        <div>
          <label htmlFor="file" className="label">…or upload a credential file</label>
          <input id="file" name="file" type="file" accept=".jwt,.json,.txt" className="text-sm" />
        </div>
        <Submit pendingText="Verifying…">Verify</Submit>
        {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      </form>
      <div aria-live="polite">
        {r ? (
          <div className={`card p-6 ${r.status === "valid" ? "border-emerald-400" : "border-red-400"}`}>
            <p className="text-xl font-bold">
              {r.status === "valid" ? "✅ Valid credential" : r.status === "revoked" ? "⛔ Revoked" : r.status === "expired" ? "⏳ Expired" : "✖ Not verified"}
            </p>
            {subject?.achievement?.name && (
              <p className="mt-2">
                <strong>{subject.achievement.name}</strong>
                {subject.name && <> awarded to {subject.name}</>}
                {r.issuer?.name && <> by {r.issuer.name}</>}
              </p>
            )}
            <ul className="mt-4 space-y-2 text-sm">
              {r.checks.map((c) => (
                <li key={c.id} className="flex gap-2">
                  <span aria-hidden>{c.status === "pass" ? "✔" : c.status === "warn" ? "!" : "✖"}</span>
                  <span><strong>{c.label}</strong>{c.detail && <span className="muted"> — {c.detail}</span>}</span>
                </li>
              ))}
            </ul>
            {r.credentialId && (r.status === "valid" || r.status === "expired" || r.status === "revoked") && (
              <a className="link text-sm mt-4 inline-block" href={`/c/${r.credentialId}`}>View credential page</a>
            )}
          </div>
        ) : (
          <div className="card p-6 muted text-sm">
            <p className="font-semibold text-[var(--fg)]">How verification works</p>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>We check the credential is a well-formed Open Badges 3.0 Verifiable Credential.</li>
              <li>We resolve the issuer&apos;s DID and confirm the signing key belongs to them.</li>
              <li>We check the cryptographic signature, so any edit is detected.</li>
              <li>We check validity dates and the issuer&apos;s revocation list.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
