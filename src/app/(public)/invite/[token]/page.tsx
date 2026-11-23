import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { acceptInvite } from "@/actions/wallet";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Field } from "@/components/ui";

export const metadata = { title: "Join your team", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await db.invite.findUnique({ where: { tokenHash: sha256(token) }, include: { organization: true } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) notFound();
  const existing = await db.user.findUnique({ where: { email: invite.email } });
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <ActionForm action={acceptInvite} className="card p-6 space-y-4">
        <h1 className="text-xl font-bold">Join {invite.organization.name}</h1>
        <p className="muted text-sm">You&apos;ve been invited as <strong>{invite.role.toLowerCase()}</strong> ({invite.email}).</p>
        <input type="hidden" name="token" value={token} />
        {!existing?.passwordHash && (
          <>
            <Field label="Your name" name="name" required autoComplete="name" defaultValue={existing?.name} />
            <Field label="Choose a password" name="password" type="password" required minLength={12} autoComplete="new-password" />
          </>
        )}
        <Submit>Accept invitation</Submit>
      </ActionForm>
    </div>
  );
}
