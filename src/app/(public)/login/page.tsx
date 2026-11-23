import type { Metadata } from "next";
import Link from "next/link";
import { login, requestMagicLink } from "@/actions/auth";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Field } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {sp.verified && <p role="status" className="mb-6 card p-3 text-sm">Email confirmed. Sign in to continue.</p>}
      {sp.linked && <p role="status" className="mb-6 card p-3 text-sm">Your credentials have been added to your account. Sign in with your password to view them.</p>}
      <div className="grid md:grid-cols-2 gap-6">
        <section className="card p-6">
          <h1 className="text-xl font-bold">Issuer sign in</h1>
          <p className="muted text-sm mt-1">For institution staff.</p>
          <ActionForm action={login} className="mt-5 space-y-4">
            <input type="hidden" name="next" value={sp.next ?? "/dashboard"} />
            <Field label="Email" name="email" type="email" required autoComplete="username" defaultValue={sp.email} />
            <Field label="Password" name="password" type="password" required autoComplete="current-password" />
            <Submit pendingText="Signing in…">Sign in</Submit>
          </ActionForm>
          <p className="text-sm muted mt-4">
            New institution? <Link href="/signup" className="link">Create an account</Link>
          </p>
        </section>
        <section className="card p-6">
          <h2 className="text-xl font-bold">Learner wallet</h2>
          <p className="muted text-sm mt-1">No password needed. We&apos;ll email you a secure sign-in link.</p>
          <ActionForm action={requestMagicLink} className="mt-5 space-y-4">
            <Field label="Email the credential was sent to" name="email" type="email" required autoComplete="email" />
            <Submit className="btn btn-ghost" pendingText="Sending…">Email me a link</Submit>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
