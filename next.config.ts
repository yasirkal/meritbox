import type { NextConfig } from "next";

/**
 * Static security headers. The per-request Content-Security-Policy (with a nonce)
 * is set in src/middleware.ts. See docs/SECURITY-BASELINE.md for the rationale behind each.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
];

/** Public, machine-readable verification resources must be fetchable cross-origin. */
const openCors = [
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
  { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
];

const nextConfig: NextConfig = {
  // Docker builds set NEXT_OUTPUT=standalone; plain `next start` is used locally and in CI.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@node-rs/argon2"],
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/issuers/:slug/did.json", headers: openCors },
      { source: "/status/:id", headers: openCors },
      { source: "/contexts/:path*", headers: openCors },
      { source: "/api/badge/:path*", headers: openCors },
      { source: "/c/:id/credential", headers: openCors },
    ];
  },
};

export default nextConfig;
