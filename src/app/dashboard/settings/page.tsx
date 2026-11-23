import { requireStaff, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { issuerDid } from "@/lib/keys";
import { rotateKeyAction, saveOrg } from "@/actions/dashboard";
import { ActionForm, Submit } from "@/components/ActionForm";
import { fmtDate, Field, PageTitle, Select, TextArea } from "@/components/ui";

export default async function Settings() {
  const { org, membership } = await requireStaff("ADMIN");
  const keys = await db.signingKey.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageTitle title="Settings" subtitle="Issuer profile, security policy and signing keys." />
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <ActionForm action={saveOrg} className="card p-5 space-y-4">
          <h2 className="font-semibold">Issuer profile</h2>
          <p className="hint -mt-2">Included in every credential you issue from now on.</p>
          <Field label="Name" name="name" required defaultValue={org.name} />
          <TextArea label="Description" name="description" defaultValue={org.description ?? ""} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Website" name="website" type="url" defaultValue={org.website ?? ""} placeholder="https://" />
            <Field label="Contact email" name="email" type="email" defaultValue={org.email ?? ""} />
            <Field label="ABN" name="abn" defaultValue={org.abn ?? ""} inputMode="numeric" />
            <Field label="RTO code" name="rtoCode" defaultValue={org.rtoCode ?? ""} inputMode="numeric" />
            <Field label="CRICOS provider code" name="cricosCode" defaultValue={org.cricosCode ?? ""} />
            <Field label="TEQSA provider ID" name="teqsaId" defaultValue={org.teqsaId ?? ""} placeholder="PRV12345" />
            <Field label="Brand colour" name="brandColor" type="color" defaultValue={org.brandColor} className="input h-10 p-1" />
          </div>
          <label className="flex gap-2 items-start text-sm">
            <input type="checkbox" name="requireMfa" defaultChecked={org.requireMfa} className="mt-1" />
            <span><strong>Require two-factor authentication</strong> for every staff member (recommended; required for Essential Eight alignment).</span>
          </label>
          <Submit>Save</Submit>
        </ActionForm>
        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">Signing keys</h2>
          <p className="text-sm">Issuer DID: <code className="text-xs break-all">{issuerDid(org)}</code></p>
          <table className="table">
            <thead><tr><th>Key ID</th><th>Algorithm</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="font-mono text-xs">{k.kid}</td>
                  <td>{k.alg}</td>
                  <td>{k.status === "ACTIVE" ? "Active" : `Retired ${k.retiredAt ? fmtDate(k.retiredAt) : ""}`}</td>
                  <td>{fmtDate(k.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasRole(membership.role, "OWNER") ? (
            <ActionForm action={rotateKeyAction} className="space-y-3">
              <Select label="New key algorithm" name="alg" options={[{ value: "RS256", label: "RS256 (RSA 3072) — widest OB 3.0 verifier support" }, { value: "EdDSA", label: "EdDSA (Ed25519) — modern, compact" }]} />
              <Submit className="btn btn-ghost">Rotate signing key</Submit>
              <p className="hint">Rotate yearly, or straight away if you suspect compromise. Retired keys stay published so existing credentials keep verifying.</p>
            </ActionForm>
          ) : (
            <p className="hint">Only owners can rotate keys.</p>
          )}
        </section>
      </div>
    </>
  );
}
