import Link from "next/link";
import { Logo } from "./Logo";
import { getSession } from "@/lib/auth";

export async function SiteHeader() {
  const session = await getSession();
  return (
    <header className="border-b line bg-[var(--card)] no-print">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-4">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-3 text-sm font-medium whitespace-nowrap">
          <Link href="/verify" className="px-2 py-1 hover:underline">Verify</Link>
          <Link href="/docs/api" className="px-2 py-1 hover:underline hidden sm:inline">API</Link>
          <Link href="/trust" className="px-2 py-1 hover:underline hidden sm:inline">Trust</Link>
          {session ? (
            <Link href="/wallet" className="btn btn-ghost">My account</Link>
          ) : (
            <>
              <Link href="/login" className="px-2 py-1 hover:underline">Sign in</Link>
              <Link href="/signup" className="btn btn-primary hidden sm:inline-flex">Start issuing</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t line mt-16 no-print">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm muted flex flex-col sm:flex-row gap-3 justify-between">
        <p>© {new Date().getFullYear()} Meritbox. Data hosted in Australia. Open Badges 3.0 · W3C Verifiable Credentials 2.0.</p>
        <p className="flex gap-4">
          <Link href="/trust" className="hover:underline">Security &amp; privacy</Link>
          <Link href="/.well-known/security.txt" className="hover:underline">security.txt</Link>
          <Link href="/verify" className="hover:underline">Verify a credential</Link>
        </p>
      </div>
    </footer>
  );
}
