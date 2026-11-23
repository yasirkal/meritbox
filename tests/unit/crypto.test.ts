import { describe, expect, it } from "vitest";
import { blindIndex, decrypt, encrypt, safeEqual } from "@/lib/crypto";

describe("encryption at rest", () => {
  it("round-trips and binds to associated data", () => {
    const ct = encrypt("ABCDE23456", "usi:1");
    expect(ct.startsWith("v1.")).toBe(true);
    expect(decrypt(ct, "usi:1")).toBe("ABCDE23456");
    expect(() => decrypt(ct, "usi:2")).toThrow();
  });
  it("uses a fresh IV per encryption", () => {
    expect(encrypt("x")).not.toBe(encrypt("x"));
  });
  it("detects tampering", () => {
    const [v, iv, tag, ct] = encrypt("secret").split(".");
    const flipped = Buffer.from(ct!, "base64url");
    flipped[0] = flipped[0]! ^ 1;
    expect(() => decrypt([v, iv, tag, flipped.toString("base64url")].join("."))).toThrow();
  });
  it("blind index is deterministic, case-insensitive and purpose-separated", () => {
    expect(blindIndex("abcde23456", "usi")).toBe(blindIndex("ABCDE23456 ", "usi"));
    expect(blindIndex("ABCDE23456", "usi")).not.toBe(blindIndex("ABCDE23456", "other"));
  });
  it("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
