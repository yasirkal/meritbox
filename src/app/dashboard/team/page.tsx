import { requireStaff, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { changeRole, inviteMember, removeMember } from "@/actions/dashboard";
import { ActionForm, Submit } from "@/components/ActionForm";
import { fmtDate, Field, PageTitle, Select } from "@/components/ui";

const ROLE_HELP = {
  OWNER: "Everything, including signing keys and billing",
  ADMIN: "Manage team, publish achievements, revoke, API keys",
  ISSUER: "Create achievements and issue credentials",
  VIEWER: "Read-only access to reports",
};

export default async function Team() {
  const { org, membership, user } = await requireStaff();
  const admin = hasRole(membership.role, "ADMIN");
  const [members, invites] = await Promise.all([
    db.membership.findMany({ where: { organizationId: org.id }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    db.invite.findMany({ where: { organizationId: org.id, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  const roles = (Object.keys(ROLE_HELP) as (keyof typeof ROLE_HELP)[]).filter((r) => r !== "OWNER" || membership.role === "OWNER");
  return (
    <>
      <PageTitle title="Team" subtitle="Role-based access. Everyone must use two-factor authentication when your institution enforces it." />
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Member</th><th>Role</th><th>MFA</th><th /></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.user.name}<div className="text-xs muted">{m.user.email}</div></td>
                  <td>
                    {admin && m.userId !== user.id ? (
                      <form action={changeRole} className="flex gap-1">
                        <input type="hidden" name="membershipId" value={m.id} />
                        <select name="role" defaultValue={m.role} className="input text-sm py-1" aria-label={`Role for ${m.user.name}`}>
                          {(Object.keys(ROLE_HELP) as string[]).map((r) => <option key={r} value={r} disabled={r === "OWNER" && membership.role !== "OWNER"}>{r.toLowerCase()}</option>)}
                        </select>
                        <button className="btn btn-ghost text-xs px-2">Save</button>
                      </form>
                    ) : (
                      m.role.toLowerCase()
                    )}
                  </td>
                  <td>{m.user.totpEnabled ? "✔ On" : <span className="text-amber-700">Off</span>}</td>
                  <td>
                    {admin && m.userId !== user.id && (
                      <form action={removeMember}>
                        <input type="hidden" name="membershipId" value={m.id} />
                        <button className="link text-sm">Remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.email}<div className="text-xs muted">Invited · expires {fmtDate(i.expiresAt)}</div></td>
                  <td>{i.role.toLowerCase()}</td>
                  <td>—</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {admin && (
          <ActionForm action={inviteMember} className="card p-5 space-y-4" resetOnOk>
            <h2 className="font-semibold">Invite a colleague</h2>
            <Field label="Email" name="email" type="email" required />
            <Select label="Role" name="role" defaultValue="ISSUER" options={roles.map((r) => ({ value: r, label: `${r.toLowerCase()} — ${ROLE_HELP[r]}` }))} />
            <Submit>Send invitation</Submit>
          </ActionForm>
        )}
      </div>
    </>
  );
}
