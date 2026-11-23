import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const metadata = { title: "Dev outbox", robots: { index: false } };

/** Development only: shows emails captured by EMAIL_TRANSPORT=log. */
export default async function Outbox() {
  if (process.env.NODE_ENV === "production" && process.env.MERITBOX_DEV_OUTBOX !== "1") notFound();
  const mails = await db.outboxEmail.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Dev outbox</h1>
      <p className="muted text-sm">Disabled in production unless MERITBOX_DEV_OUTBOX=1 (test environments only).</p>
      {mails.map((m) => (
        <article key={m.id} className="card p-4">
          <p className="text-xs muted">{m.createdAt.toLocaleString("en-AU")} · to {m.to}</p>
          <h2 className="font-semibold">{m.subject}</h2>
          <pre className="whitespace-pre-wrap text-sm mt-2 font-sans">{linkify(m.text)}</pre>
        </article>
      ))}
    </main>
  );
}

function linkify(text: string) {
  return text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? <a key={i} className="link break-all" href={part}>{part}</a> : part,
  );
}
