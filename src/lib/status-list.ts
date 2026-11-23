import { gunzipSync, gzipSync } from "node:zlib";

/**
 * W3C Bitstring Status List v1.0 helpers.
 * Index 0 is the left-most (most significant) bit of the first byte.
 * encodedList = multibase base64url ("u" prefix, no padding) of the GZIP-compressed bitstring.
 */
export const STATUS_LIST_SIZE = 131072; // 16 KiB — the spec's minimum for herd privacy

export function newBitstring(size = STATUS_LIST_SIZE): Buffer {
  if (size % 8 !== 0) throw new Error("size must be a multiple of 8");
  return Buffer.alloc(size / 8);
}

export function setBit(bits: Buffer, index: number, value: boolean): Buffer {
  const out = Buffer.from(bits);
  const byte = index >> 3;
  if (byte >= out.length || index < 0) throw new RangeError("status index out of range");
  const mask = 0x80 >> (index & 7);
  out[byte] = value ? out[byte]! | mask : out[byte]! & ~mask;
  return out;
}

export function getBit(bits: Buffer, index: number): boolean {
  const byte = index >> 3;
  if (byte >= bits.length || index < 0) throw new RangeError("status index out of range");
  return (bits[byte]! & (0x80 >> (index & 7))) !== 0;
}

export function encodeList(bits: Buffer): string {
  return "u" + gzipSync(bits).toString("base64url");
}

export function decodeList(encoded: string): Buffer {
  if (!encoded.startsWith("u")) throw new Error("encodedList must be multibase base64url");
  return gunzipSync(Buffer.from(encoded.slice(1), "base64url"));
}
