"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export type ActionResult = { error?: string; ok?: string; secret?: string } | null;
type Action = (prev: ActionResult, data: FormData) => Promise<ActionResult>;

export function ActionForm({
  action,
  children,
  className,
  resetOnOk,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnOk?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className} key={resetOnOk && state?.ok ? state.ok : undefined}>
      {children}
      {state?.error && (
        <p role="alert" className="mt-3 text-sm rounded-md bg-red-50 text-red-800 border border-red-200 px-3 py-2">{state.error}</p>
      )}
      {state?.ok && (
        <p role="status" className="mt-3 text-sm rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-2">{state.ok}</p>
      )}
      {state?.secret && (
        <div className="mt-3 text-sm rounded-md bg-amber-50 text-amber-900 border border-amber-200 px-3 py-2">
          <p className="font-semibold">Copy this now — it won&apos;t be shown again:</p>
          <code className="block mt-1 break-all select-all font-mono text-xs">{state.secret}</code>
        </div>
      )}
    </form>
  );
}

export function Submit({ children, className = "btn btn-primary", pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText ?? "Working…" : children}
    </button>
  );
}
