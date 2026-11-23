import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-extrabold text-lg tracking-tight" aria-label="Meritbox home">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <path d="M16 2l12 7v14l-12 7-12-7V9z" fill="#0f4c81" />
        <path d="M10 13l6 3.5 6-3.5M16 16.5V24" stroke="#f2a900" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>merit<span className="text-[var(--color-wattle)]">box</span></span>
    </Link>
  );
}
