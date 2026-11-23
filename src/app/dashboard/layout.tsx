import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { logout } from "@/actions/auth";
import { switchOrg } from "@/actions/dashboard";
import { Logo } from "@/components/Logo";

const nav = [
  ["/dashboard", "Overview"],
  ["/dashboard/issue", "Issue"],
  ["/dashboard/credentials", "Credentials"],
  ["/dashboard/achievements", "Achievements"],
  ["/dashboard/pathways", "Pathways"],
  ["/dashboard/team", "Team"],
  ["/dashboard/developers", "API & webhooks"],
  ["/dashboard/audit", "Audit log"],
  ["/dashboard/settings", "Settings"],
  ["/dashboard/security", "My security"],
] as const;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, org, membership, memberships } = await requireStaff("VIEWER", { allowMfaSetup: true });
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b md:border-b-0 md:border-r line bg-[var(--card)] p-4 md:min-h-screen">
        <Logo href="/dashboard" />
        <div className="mt-5">
          {memberships.length > 1 ? (
            <form action={switchOrg} className="flex gap-1">
              <label htmlFor="orgId" className="sr-only">Institution</label>
              <select id="orgId" name="orgId" defaultValue={org.id} className="input text-sm">
                {memberships.map((m) => (
                  <option key={m.organizationId} value={m.organizationId}>{m.organization.name}</option>
                ))}
              </select>
              <button className="btn btn-ghost text-xs px-2">Go</button>
            </form>
          ) : (
            <p className="font-semibold text-sm">{org.name}</p>
          )}
          <p className="text-xs muted mt-1">{user.name} · {membership.role.toLowerCase()}</p>
        </div>
        <nav className="mt-5 flex md:flex-col gap-1 overflow-x-auto text-sm" aria-label="Dashboard">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="px-3 py-2 rounded-md hover:bg-[var(--color-brand-50)] hover:text-[var(--color-brand-700)] whitespace-nowrap">
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 flex md:flex-col gap-2 text-sm">
          <Link href={`/issuers/${org.slug}`} className="link">Public profile</Link>
          <Link href="/wallet" className="link">My wallet</Link>
          <form action={logout}><button className="link text-left">Sign out</button></form>
        </div>
      </aside>
      <main id="main" className="p-4 sm:p-8 max-w-6xl w-full">{children}</main>
    </div>
  );
}
