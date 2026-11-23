import { describe, expect, it } from "vitest";
import { didForSlug, localSlugFromDid, parseDidWeb } from "@/lib/did";

describe("did:web", () => {
  it("builds DIDs with percent-encoded ports", () => {
    expect(didForSlug("https://meritbox.com.au", "tafe-nsw")).toBe("did:web:meritbox.com.au:issuers:tafe-nsw");
    expect(didForSlug("http://localhost:3000", "x")).toBe("did:web:localhost%3A3000:issuers:x");
  });
  it("resolves to did.json URLs", () => {
    expect(parseDidWeb("did:web:meritbox.com.au:issuers:abc#key-1")?.url).toBe("https://meritbox.com.au/issuers/abc/did.json");
    expect(parseDidWeb("did:web:example.com")?.url).toBe("https://example.com/.well-known/did.json");
    expect(parseDidWeb("did:key:z6Mk")).toBeNull();
  });
  it("only treats DIDs on this host as local", () => {
    expect(localSlugFromDid("https://meritbox.com.au", "did:web:meritbox.com.au:issuers:abc")).toBe("abc");
    expect(localSlugFromDid("https://meritbox.com.au", "did:web:evil.example:issuers:abc")).toBeNull();
    expect(localSlugFromDid("https://meritbox.com.au", "did:web:meritbox.com.au:other:abc")).toBeNull();
  });
});
