import { env } from "@/lib/env";

export const metadata = { title: "API reference" };

const Code = ({ children }: { children: string }) => (
  <pre className="card p-4 text-xs overflow-x-auto font-mono mt-2"><code>{children}</code></pre>
);

export default function ApiDocs() {
  const base = `${env.appUrl}/api/v1`;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Meritbox API</h1>
        <p className="muted mt-2">
          REST + JSON. Base URL <code>{base}</code>. Machine-readable spec: <a className="link" href="/api/v1/openapi.json">OpenAPI 3.1</a>.
        </p>
      </div>
      <section>
        <h2 className="text-xl font-semibold">Authentication</h2>
        <p className="mt-2">Create a key under <em>Dashboard → API &amp; webhooks</em> with only the scopes you need. Send it as a bearer token. Keys are shown once and stored hashed. Limit: 600 requests per minute per key.</p>
        <Code>{`curl ${base}/achievements \\\n  -H "Authorization: Bearer mbx_live_xxxxxxxx_…"`}</Code>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Issue a credential</h2>
        <Code>{`curl -X POST ${base}/credentials \\
  -H "Authorization: Bearer $MERITBOX_KEY" -H "Content-Type: application/json" \\
  -d '{
    "achievement_id": "…",
    "recipient": { "email": "jane@example.com", "name": "Jane Citizen", "usi": "ABCDE23456" },
    "issued_on": "2026-11-20",
    "notify": true
  }'`}</Code>
        <p className="mt-2 text-sm muted">Returns <code>201</code> with the credential, including its public URL and the signed <code>vc_jwt</code>.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Revoke</h2>
        <Code>{`curl -X POST ${base}/credentials/{id}/revoke \\
  -H "Authorization: Bearer $MERITBOX_KEY" -H "Content-Type: application/json" \\
  -d '{ "reason": "Issued in error" }'`}</Code>
      </section>
      <section id="verify">
        <h2 className="text-xl font-semibold">Verify (free, no key)</h2>
        <Code>{`curl -X POST ${base}/verify -H "Content-Type: application/json" \\
  -d '{ "credential": "eyJhbGciOi…" }'`}</Code>
        <Code>{`{ "verified": true, "status": "valid",
  "checks": [ { "id": "signature", "status": "pass", … }, … ],
  "issuer": { "id": "did:web:…", "name": "…" } }`}</Code>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Webhooks</h2>
        <p className="mt-2">Events: <code>credential.issued</code>, <code>credential.revoked</code>, <code>credential.claimed</code>, <code>pathway.completed</code>. Each POST has a <code>Meritbox-Signature: t=&lt;unix&gt;,v1=&lt;hex&gt;</code> header: an HMAC-SHA256 of <code>{"<t>.<raw body>"}</code> using your endpoint secret. Reject requests older than 5 minutes.</p>
        <Code>{`const [t, v1] = header.split(",").map(p => p.split("=")[1]);
const expected = crypto.createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
const ok = crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected)) && Date.now()/1000 - Number(t) < 300;`}</Code>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Standards endpoints</h2>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
          <li><code>/issuers/&#123;slug&#125;/did.json</code>: issuer DID document (did:web) with public signing keys</li>
          <li><code>/status/&#123;id&#125;</code>: W3C Bitstring Status List credential (VC-JWT; <code>?format=json</code> for unsigned)</li>
          <li><code>/c/&#123;id&#125;/credential</code>: the signed credential (<code>?format=json</code> for decoded)</li>
          <li><code>/achievements/&#123;id&#125;</code>: public achievement description</li>
        </ul>
      </section>
    </div>
  );
}
