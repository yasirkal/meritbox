import { describe, expect, it } from "vitest";
import { decodeList, encodeList, getBit, newBitstring, setBit, STATUS_LIST_SIZE } from "@/lib/status-list";

describe("Bitstring Status List", () => {
  it("is 16 KiB by default (herd privacy minimum)", () => {
    expect(newBitstring().length * 8).toBe(STATUS_LIST_SIZE);
    expect(STATUS_LIST_SIZE).toBe(131072);
  });
  it("sets bits left-most first, per the W3C spec", () => {
    const bits = setBit(newBitstring(16), 0, true);
    expect(bits[0]).toBe(0b1000_0000);
    expect(setBit(newBitstring(16), 9, true)[1]).toBe(0b0100_0000);
  });
  it("set/get/clear", () => {
    let bits = newBitstring();
    bits = setBit(bits, 131071, true);
    expect(getBit(bits, 131071)).toBe(true);
    expect(getBit(bits, 131070)).toBe(false);
    bits = setBit(bits, 131071, false);
    expect(getBit(bits, 131071)).toBe(false);
  });
  it("does not mutate the input", () => {
    const a = newBitstring(8);
    setBit(a, 3, true);
    expect(a[0]).toBe(0);
  });
  it("encodes as multibase base64url GZIP and round-trips", () => {
    const bits = setBit(newBitstring(), 42, true);
    const enc = encodeList(bits);
    expect(enc[0]).toBe("u");
    expect(enc).not.toMatch(/[+/=]/);
    expect(getBit(decodeList(enc), 42)).toBe(true);
  });
  it("rejects out-of-range indexes", () => {
    expect(() => getBit(newBitstring(8), 8)).toThrow(RangeError);
    expect(() => setBit(newBitstring(8), -1, true)).toThrow(RangeError);
  });
});
