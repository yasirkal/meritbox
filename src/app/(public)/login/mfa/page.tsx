import { redirect } from "next/navigation";
import { verifyMfa } from "@/actions/auth";
import { ActionForm, Submit } from "@/components/ActionForm";
import { Field } from "@/components/ui";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Two-factor authentication" };

export default async function Mfa({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mfaVerified) redirect("/dashboard");
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <ActionForm action={verifyMfa} className="card p-6 space-y-4">
        <h1 className="text-xl font-bold">Enter your 6-digit code</h1>
        <p className="muted text-sm">Open your authenticator app for the code for Meritbox ({session.user.email}).</p>
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        <Field label="Authentication code" name="code" inputMode="numeric" pattern="[0-9 ]{6,7}" autoComplete="one-time-code" required autoFocus />
        <Submit pendingText="Checking…">Verify</Submit>
      </ActionForm>
    </div>
  );
}
