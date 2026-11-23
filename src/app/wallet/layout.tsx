import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 py-10">{children}</main>
      <SiteFooter />
    </>
  );
}
