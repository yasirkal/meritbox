import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { API_SCOPES } from "@/lib/apikeys";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";
import { deleteWebhook, newApiKey, newWebhook, revokeApiKey } from "@/actions/dashboard";
import { ActionForm, Submit } from "@/components/ActionForm";
import { fmtDate, Field, PageTitle } from "@/components/ui";

export default async function Developers() {
  const { org } = await requireStaff("ADMIN");
  const [keys, hooks] = await Promise.all([
    db.apiKey.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "desc" } }),
    db.webhook.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <>
      <PageTitle title="API & webhooks" subtitle={<>Connect your student management system or LMS. See the <Link className="link" href="/docs/api">API reference</Link>.</>} />
      <section className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="card overflow-x-auto">
          <h2 className="font-semibold p-4 pb-0">API keys</h2>
          <table className="table mt-2">
            <thead><tr><th>Name</th><th>Key</th><th>Scopes</th><th>Last used</th><th /></tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className={k.revokedAt ? "opacity-50" : ""}>
                  <td>{k.name}</td>
                  <td className="font-mono text-xs">mbx_live_{k.prefix}_…</td>
                  <td className="text-xs">{k.scopes.join(", ")}</td>
                  <td className="text-xs">{k.lastUsedAt ? fmtDate(k.lastUsedAt) : "Never"}</td>
                  <td>
                    {k.revokedAt ? "Revoked" : (
                      <form action={revokeApiKey}><input type="hidden" name="id" value={k.id} /><button className="link text-sm">Revoke</button></form>
                    )}
                  </td>
                </tr>
              ))}
              {keys.length === 0 && <tr><td colSpan={5} className="muted">No keys yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <ActionForm action={newApiKey} className="card p-5 space-y-4">
          <h2 className="font-semibold">Create API key</h2>
          <Field label="Name" name="name" required placeholder="e.g. Moodle production" />
          <fieldset>
            <legend className="label">Scopes</legend>
            {API_SCOPES.map((s) => (
              <label key={s} className="flex gap-2 items-center text-sm"><input type="checkbox" name="scopes" value={s} defaultChecked={s !== "credentials:revoke"} /> <code>{s}</code></label>
            ))}
          </fieldset>
          <Submit>Create key</Submit>
        </ActionForm>
      </section>
      <section className="grid lg:grid-cols-[1fr_340px] gap-6 items-start mt-8">
        <div className="card overflow-x-auto">
          <h2 className="font-semibold p-4 pb-0">Webhooks</h2>
          <table className="table mt-2">
            <thead><tr><th>Endpoint</th><th>Events</th><th>Last delivery</th><th /></tr></thead>
            <tbody>
              {hooks.map((h) => (
                <tr key={h.id}>
                  <td className="font-mono text-xs break-all">{h.url}</td>
                  <td className="text-xs">{h.events.join(", ")}</td>
                  <td className="text-xs">{h.lastStatus == null ? "—" : h.lastStatus === 0 ? "Failed" : `HTTP ${h.lastStatus}`}</td>
                  <td><form action={deleteWebhook}><input type="hidden" name="id" value={h.id} /><button className="link text-sm">Delete</button></form></td>
                </tr>
              ))}
              {hooks.length === 0 && <tr><td colSpan={4} className="muted">No webhooks yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <ActionForm action={newWebhook} className="card p-5 space-y-4">
          <h2 className="font-semibold">Add webhook</h2>
          <Field label="HTTPS endpoint" name="url" type="url" required placeholder="https://sms.example.edu.au/hooks/meritbox" />
          <fieldset>
            <legend className="label">Events</legend>
            {WEBHOOK_EVENTS.map((e) => (
              <label key={e} className="flex gap-2 items-center text-sm"><input type="checkbox" name="events" value={e} defaultChecked /> <code>{e}</code></label>
            ))}
          </fieldset>
          <Submit>Add webhook</Submit>
        </ActionForm>
      </section>
    </>
  );
}
