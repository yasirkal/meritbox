import type { ReactNode } from "react";

export function Field({ label, name, hint, ...rest }: { label: string; name: string; hint?: ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" {...rest} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function TextArea({ label, name, hint, ...rest }: { label: string; name: string; hint?: ReactNode } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <textarea id={name} name={name} className="input min-h-24" {...rest} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Select({ label, name, options, hint, ...rest }: { label: string; name: string; hint?: ReactNode; options: { value: string; label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} className="input" {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function StatusPill({ status }: { status: "valid" | "revoked" | "expired" | "invalid" | string }) {
  const map: Record<string, string> = {
    valid: "bg-emerald-100 text-emerald-800",
    PUBLISHED: "bg-emerald-100 text-emerald-800",
    revoked: "bg-red-100 text-red-800",
    invalid: "bg-red-100 text-red-800",
    expired: "bg-amber-100 text-amber-900",
    DRAFT: "bg-slate-200 text-slate-800",
    ARCHIVED: "bg-slate-200 text-slate-600",
  };
  const label: Record<string, string> = { valid: "Valid", revoked: "Revoked", expired: "Expired", invalid: "Invalid", PUBLISHED: "Published", DRAFT: "Draft", ARCHIVED: "Archived" };
  return <span className={`pill ${map[status] ?? "bg-slate-200 text-slate-800"}`}>{label[status] ?? status}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide muted font-semibold">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card p-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="muted mt-2 text-sm">{children}</div>}
    </div>
  );
}

export function credentialState(c: { revokedAt: Date | null; expiresAt: Date | null }) {
  if (c.revokedAt) return "revoked" as const;
  if (c.expiresAt && c.expiresAt < new Date()) return "expired" as const;
  return "valid" as const;
}

export const typeLabel = (t: string) => (t === "MicroCredential" ? "Microcredential" : t.replace(/([a-z])([A-Z])/g, "$1 $2"));

export const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
