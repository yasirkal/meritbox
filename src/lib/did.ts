/**
 * did:web helpers. An issuer at https://meritbox.com.au/issuers/<slug> gets the DID
 * did:web:meritbox.com.au:issuers:<slug>, resolvable at /issuers/<slug>/did.json.
 */
export function didForSlug(appUrl: string, slug: string): string {
  const u = new URL(appUrl);
  const host = encodeURIComponent(u.host); // encodes the port colon as %3A
  const basePath = u.pathname.split("/").filter(Boolean).map(encodeURIComponent);
  return ["did:web", host, ...basePath, "issuers", slug].join(":");
}

export interface ParsedDidWeb {
  host: string;
  path: string[];
  url: string;
}

export function parseDidWeb(did: string): ParsedDidWeb | null {
  const bare = did.split("#")[0]!;
  if (!bare.startsWith("did:web:")) return null;
  const parts = bare.slice("did:web:".length).split(":");
  const host = decodeURIComponent(parts[0] ?? "");
  if (!host) return null;
  const path = parts.slice(1).map(decodeURIComponent);
  const scheme = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const url = path.length ? `${scheme}://${host}/${path.join("/")}/did.json` : `${scheme}://${host}/.well-known/did.json`;
  return { host, path, url };
}

/** Returns the issuer slug if the DID belongs to this deployment, else null. */
export function localSlugFromDid(appUrl: string, did: string): string | null {
  const parsed = parseDidWeb(did);
  if (!parsed) return null;
  const u = new URL(appUrl);
  if (parsed.host !== u.host) return null;
  const base = u.pathname.split("/").filter(Boolean);
  const rest = parsed.path.slice(base.length);
  if (rest.length !== 2 || rest[0] !== "issuers") return null;
  return rest[1] ?? null;
}
