import { consumeLink } from "@/actions/auth";
import { ActionForm, Submit } from "@/components/ActionForm";

export const metadata = { title: "Continue", robots: { index: false } };

/** Landing page for emailed links. The token is only spent when the person presses the button. */
export default async function LinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <ActionForm action={consumeLink} className="card p-6 space-y-4 text-center">
        <h1 className="text-xl font-bold">Continue to Meritbox</h1>
        <p className="muted text-sm">Press continue to securely sign in from this device.</p>
        <input type="hidden" name="token" value={token} />
        <Submit pendingText="Signing in…">Continue</Submit>
      </ActionForm>
    </div>
  );
}
