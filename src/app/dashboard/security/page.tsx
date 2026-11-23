import QRCode from "qrcode";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { totpUri } from "@/lib/totp";
import { confirmMfa, disableMfa, startMfa } from "@/actions/dashboard";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Field, PageTitle } from "@/components/ui";

export default async function Security({ searchParams }: { searchParams: Promise<{ enrol?: string }> }) {
  const { user, org, session } = await requireStaff("VIEWER", { allowMfaSetup: true });
  const { enrol } = await searchParams;
  const sessions = await db.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  let qr: string | null = null;
  let secret: string | null = null;
  if (!user.totpEnabled && user.totpSecretEnc) {
    secret = decrypt(user.totpSecretEnc, `totp:${user.id}`);
    qr = await QRCode.toDataURL(totpUri(secret, user.email), { margin: 1, width: 220 });
  }
  return (
    <>
      <PageTitle title="My security" />
      {enrol && !user.totpEnabled && (
        <p role="alert" className="card p-3 mb-4 text-sm border-amber-300">{org.name} requires two-factor authentication. Set it up to continue.</p>
      )}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">Two-factor authentication</h2>
          {user.totpEnabled ? (
            <>
              <p className="text-sm">✔ On. You&apos;ll be asked for a code from your authenticator app when you sign in.</p>
              {!org.requireMfa && (
                <ActionForm action={disableMfa} className="space-y-3">
                  <Field label="Current code to turn off" name="code" inputMode="numeric" autoComplete="one-time-code" />
                  <Submit className="btn btn-ghost">Turn off</Submit>
                </ActionForm>
              )}
            </>
          ) : qr ? (
            <ActionForm action={confirmMfa} className="space-y-3">
              <p className="text-sm">Scan this with Microsoft Authenticator, Google Authenticator, 1Password or similar, then enter the 6-digit code.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code for your authenticator app" width={220} height={220} />
              <details className="text-xs"><summary>Can&apos;t scan?</summary><code className="break-all select-all">{secret}</code></details>
              <Field label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" required />
              <Submit>Turn on</Submit>
            </ActionForm>
          ) : (
            <form action={startMfa}>
              <p className="text-sm mb-3">Protect your account with an authenticator app.</p>
              <button className="btn btn-primary">Set up two-factor authentication</button>
            </form>
          )}
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Active sessions</h2>
          <ul className="mt-3 text-sm space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                {s.id === session.id && <strong>This device · </strong>}
                <span className="muted">{s.userAgent?.slice(0, 80) || "Unknown device"}</span>
                <div className="text-xs muted">{s.ip} · signed in {s.createdAt.toLocaleString("en-AU")}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
