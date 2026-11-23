import { db } from "@/lib/db";
import { renderBadgeSvg } from "@/lib/badge-svg";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let opts = { name: "Meritbox", issuer: "Meritbox", shape: "hexagon", color: "#0f4c81", accent: "#f2a900", icon: "star" };
  if (id !== "demo") {
    if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
    const a = await db.achievement.findUnique({ where: { id }, include: { organization: true } });
    if (!a) return new Response("Not found", { status: 404 });
    opts = { name: a.name, issuer: a.organization.name, shape: a.badgeShape, color: a.badgeColor, accent: a.badgeAccent, icon: a.badgeIcon };
  }
  return new Response(renderBadgeSvg(opts), {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=300",
      // SVG served standalone: forbid script execution even if opened directly
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
