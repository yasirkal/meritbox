import Link from "next/link";

const features = [
  { t: "Open Badges 3.0 native", d: "Every credential is a signed W3C Verifiable Credential that any OB 3.0 verifier can check, with or without Meritbox." },
  { t: "Built for the AQF and VET", d: "Align to training.gov.au units and qualifications, AQF levels and the Australian Skills Classification. USI capture with encryption at rest." },
  { t: "National Microcredentials Framework", d: "Volume of learning, assessment, delivery mode, credit recognition and industry endorsement are part of the credential itself." },
  { t: "Instant, tamper-evident verification", d: "Public verification pages, a free verification API for employers and W3C Bitstring Status List revocation." },
  { t: "Stackable pathways", d: "Combine microcredentials into pathways that automatically award a higher credential when every step is achieved." },
  { t: "Learner-owned wallet", d: "Learners claim credentials into a wallet, control who sees them and share to LinkedIn in one click." },
  { t: "Bulk issuance and API", d: "CSV issuance for whole cohorts, a REST API with scoped keys and signed webhooks for your SMS and LMS." },
  { t: "Secure by default", d: "Data hosted in Australia, MFA enforced for staff, encrypted signing keys, immutable audit log, strict security headers." },
];

export default function Home() {
  return (
    <>
      <section className="bg-gradient-to-b from-[var(--color-brand-900)] to-[var(--color-brand-600)] text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28 grid md:grid-cols-[1.3fr_1fr] gap-10 items-center">
          <div>
            <p className="pill bg-white/15 text-white mb-5">Made in Australia · Hosted in Australia</p>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Digital credentials Australian learners and employers can trust.
            </h1>
            <p className="mt-5 text-lg text-white/85 max-w-xl">
              Meritbox helps universities, TAFEs and RTOs issue verifiable microcredentials, badges and certificates aligned to the AQF, training.gov.au and the National Microcredentials Framework.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn bg-[var(--color-wattle)] text-[var(--color-brand-900)] hover:opacity-90">Start issuing</Link>
              <Link href="/verify" className="btn border border-white/40 hover:bg-white/10">Verify a credential</Link>
            </div>
          </div>
          <div className="hidden md:flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/badge/demo" alt="" width={300} height={300} className="drop-shadow-2xl" />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold">Everything a provider needs, in one platform</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.t} className="card p-5">
              <h3 className="font-semibold">{f.t}</h3>
              <p className="muted text-sm mt-2">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-8">
        <div className="card p-8 grid md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-semibold">For universities</h3>
            <p className="muted text-sm mt-2">Microcredentials, short courses, co-curricular awards and CPD — complementing official testamurs and AHEGS.</p>
          </div>
          <div>
            <h3 className="font-semibold">For TAFEs and RTOs</h3>
            <p className="muted text-sm mt-2">Statements of attainment and units of competency as verifiable credentials, with RTO codes and USI built in.</p>
          </div>
          <div>
            <h3 className="font-semibold">For employers</h3>
            <p className="muted text-sm mt-2">Check any Meritbox credential instantly, free, through the web or the verification API.</p>
          </div>
        </div>
      </section>
    </>
  );
}
