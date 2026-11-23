import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request Content-Security-Policy with a nonce (strict-dynamic), plus cache controls for
 * authenticated areas. Static security headers live in next.config.ts.
 */
export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(process.env.APP_URL?.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);

  const p = req.nextUrl.pathname;
  if (p.startsWith("/dashboard") || p.startsWith("/wallet") || p.startsWith("/login") || p.startsWith("/api/v1")) {
    res.headers.set("Cache-Control", "no-store");
  }
  if (p.startsWith("/dashboard") || p.startsWith("/wallet") || p.startsWith("/claim") || p.startsWith("/login")) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }],
};
