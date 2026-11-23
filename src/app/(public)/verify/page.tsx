import { Verifier } from "@/components/Verifier";

export const metadata = { title: "Verify a credential" };

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold">Verify a credential</h1>
      <p className="muted mt-2 max-w-2xl">
        Employers and admissions teams can check any Meritbox credential for free. Nothing you paste here is stored, apart from an anonymous count of verifications.
      </p>
      <div className="mt-8"><Verifier /></div>
      <p className="text-sm muted mt-8">
        Verifying at scale? Use the free <a href="/docs/api#verify" className="link">verification API</a>.
      </p>
    </div>
  );
}
