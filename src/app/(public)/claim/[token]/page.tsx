import { consumeLink } from "@/actions/auth";
import { ActionForm, Submit } from "@/components/ActionForm";

export const metadata = { title: "Claim your credential", robots: { index: false } };

export default async function Claim({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <ActionForm action={consumeLink} className="card p-8 space-y-4 text-center">
        <h1 className="text-2xl font-bold">You&apos;ve earned a credential 🎉</h1>
        <p className="muted">Add it to your free Meritbox wallet to view, download and share it.</p>
        <input type="hidden" name="token" value={token} />
        <Submit pendingText="Adding…">Add to my wallet</Submit>
        <p className="hint">You control who sees your credentials. You can make any credential private at any time.</p>
      </ActionForm>
    </div>
  );
}
