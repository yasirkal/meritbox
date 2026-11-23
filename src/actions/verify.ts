"use server";
import { verifyCredentialJwt, type VerificationResult } from "@/lib/verify";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";
import { env } from "@/lib/env";
import { db } from "@/lib/db";

export type VerifyState = { result?: VerificationResult; error?: string } | null;

/** Accepts a VC-JWT, a Meritbox credential URL, or an uploaded .jwt/.json file. */
export async function verifyAction(_: VerifyState, fd: FormData): Promise<VerifyState> {
  if (!(await rateLimit(`verify-ui:${await clientIp()}`, 60, 600)).ok) return { error: "Too many verifications. Try again shortly." };
  let input = String(fd.get("input") ?? "").trim();
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 1_000_000) return { error: "File is too large." };
    input = (await file.text()).trim();
  }
  if (!input) return { error: "Paste a credential, a credential link, or upload a file." };

  const urlMatch = input.match(/\/c\/([0-9a-f-]{36})/);
  if (input.startsWith(env.appUrl) && urlMatch) {
    const c = await db.credential.findUnique({ where: { id: urlMatch[1] }, select: { jwt: true, visibility: true } });
    if (!c || c.visibility === "PRIVATE") return { error: "No credential found at that link." };
    input = c.jwt;
  } else if (input.startsWith("{")) {
    try {
      const obj = JSON.parse(input) as { proof?: { jwt?: string }; jwt?: string };
      input = obj.jwt ?? obj.proof?.jwt ?? "";
      if (!input) return { error: "That JSON has no embedded proof. Upload the .jwt file instead." };
    } catch {
      return { error: "That doesn't look like a valid credential file." };
    }
  }
  return { result: await verifyCredentialJwt(input, "upload") };
}
