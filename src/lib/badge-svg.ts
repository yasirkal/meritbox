/** Server-rendered SVG badge artwork. All text is escaped; no external resources are referenced. */

export const BADGE_SHAPES = ["hexagon", "circle", "shield", "rosette"] as const;
export const BADGE_ICONS = ["star", "check", "book", "spark", "gear", "leaf", "heart", "flag"] as const;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const hex = (c: string, fallback: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback);

const ICONS: Record<string, string> = {
  star: "M100 52l13 27 30 4-22 21 5 30-26-14-26 14 5-30-22-21 30-4z",
  check: "M70 102l20 20 42-44 10 10-52 54-30-30z",
  book: "M62 64h34c6 0 4 4 4 4s-2-4 4-4h34v66h-34c-4 0-4 4-4 4s0-4-4-4H62z",
  spark: "M100 50l10 34 34 10-34 10-10 34-10-34-34-10 34-10z",
  gear: "M92 52h16l3 13 11 5 11-8 11 11-8 11 5 11 13 3v16l-13 3-5 11 8 11-11 11-11-8-11 5-3 13H92l-3-13-11-5-11 8-11-11 8-11-5-11-13-3V92l13-3 5-11-8-11 11-11 11 8 11-5zM100 84a16 16 0 100 32 16 16 0 000-32z",
  leaf: "M136 58c-50 0-76 26-76 64 0 6 1 12 3 16 10-24 30-40 52-48-20 12-34 28-42 52 6 4 14 6 22 6 38 0 50-40 41-90z",
  heart: "M100 136l-34-32c-18-18-6-46 16-46 8 0 14 4 18 10 4-6 10-10 18-10 22 0 34 28 16 46z",
  flag: "M70 52h8v96h-8zM82 56c20-8 34 8 58 0v46c-24 8-38-8-58 0z",
};

function shapePath(shape: string): string {
  switch (shape) {
    case "circle":
      return '<circle cx="100" cy="100" r="92"/>';
    case "shield":
      return '<path d="M100 6l84 26v58c0 52-36 88-84 104C52 178 16 142 16 90V32z"/>';
    case "rosette":
      return '<path d="M100 4l18 16 24-6 8 23 23 8-6 24 16 18-16 18 6 24-23 8-8 23-24-6-18 16-18-16-24 6-8-23-23-8 6-24L4 100l16-18-6-24 23-8 8-23 24 6z"/>';
    default:
      return '<path d="M100 4l83 48v96l-83 48-83-48V52z"/>';
  }
}

export function renderBadgeSvg(opts: { name: string; issuer: string; shape: string; color: string; accent: string; icon: string }) {
  const color = hex(opts.color, "#0f4c81");
  const accent = hex(opts.accent, "#f2a900");
  const icon = ICONS[opts.icon] ?? ICONS.star!;
  const title = esc(opts.name.slice(0, 120));
  const label = esc(opts.name.length > 26 ? opts.name.slice(0, 25) + "…" : opts.name);
  const fontSize = opts.name.length > 20 ? 10 : 12;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400" role="img" aria-label="${title}">
<title>${title} — ${esc(opts.issuer.slice(0, 120))}</title>
<g fill="${color}" stroke="${accent}" stroke-width="6">${shapePath(opts.shape)}</g>
<path d="${icon}" fill="${accent}" transform="translate(0,-14)"/>
<rect x="22" y="138" width="156" height="26" rx="13" fill="${accent}"/>
<text x="100" y="156" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" fill="${color}">${label}</text>
</svg>`;
}
