import type { Metadata } from "next";
import "./globals.css";

// Every page is rendered per request so the CSP nonce (src/middleware.ts) can be applied to scripts.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Meritbox — Australian digital credentials", template: "%s · Meritbox" },
  description:
    "Issue, manage and verify Open Badges 3.0 digital credentials and microcredentials. Built in Australia for universities, TAFEs and RTOs.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3 focus:bg-white">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
