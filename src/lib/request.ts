import "server-only";
import { headers } from "next/headers";

/** Client IP as seen by the trusted edge (ALB/CloudFront append to X-Forwarded-For). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown").slice(0, 64);
}

export async function userAgent(): Promise<string> {
  return ((await headers()).get("user-agent") ?? "").slice(0, 256);
}
