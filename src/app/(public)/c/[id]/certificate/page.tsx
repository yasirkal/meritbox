import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fmtDate } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import QRCode from "qrcode";

export const metadata = { title: "Certificate", robots: { index: false } };

export default async function Certificate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await db.credential.findUnique({ where: { id }, include: { achievement: true, organization: true } });
  if (!c || c.visibility === "PRIVATE") notFound();
  const url = `${env.appUrl}/c/${c.id}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 240 });
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <article className="bg-white text-slate-900 border-8 border-double p-12 aspect-[1.414/1] flex flex-col" style={{ borderColor: c.organization.brandColor }}>
        <p className="text-center uppercase tracking-[0.3em] text-sm font-semibold" style={{ color: c.organization.brandColor }}>{c.organization.name}</p>
        <h1 className="text-center text-4xl font-serif mt-8">{c.achievement.name}</h1>
        <p className="text-center mt-8">This is to certify that</p>
        <p className="text-center text-3xl font-serif font-semibold mt-2">{c.recipientName}</p>
        <p className="text-center mt-4 max-w-2xl mx-auto text-sm">{c.achievement.description}</p>
        {c.achievement.tgaCode && <p className="text-center mt-3 text-sm">{c.achievement.tgaCode} {c.achievement.tgaTitle}</p>}
        <div className="mt-auto flex items-end justify-between text-sm">
          <div>
            <p>Issued {fmtDate(c.issuedAt)}</p>
            {c.organization.rtoCode && <p>RTO {c.organization.rtoCode}</p>}
            <p className="text-xs text-slate-500 mt-2">Credential ID {c.id}</p>
          </div>
          <div className="text-right">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code linking to the verification page" width={110} height={110} className="ml-auto" />
            <p className="text-xs text-slate-500">Verify at {url.replace(/^https?:\/\//, "")}</p>
          </div>
        </div>
      </article>
    </div>
  );
}
