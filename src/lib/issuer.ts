import "server-only";
import type { Organization } from "@prisma/client";
import { env } from "./env";
import { issuerDid } from "./keys";
import type { IssuerInput } from "./vc";

export function issuerInput(org: Organization): IssuerInput {
  return {
    did: issuerDid(org),
    name: org.name,
    url: org.website ?? `${env.appUrl}/issuers/${org.slug}`,
    email: org.email,
    description: org.description,
    rtoCode: org.rtoCode,
    cricosCode: org.cricosCode,
    teqsaId: org.teqsaId,
    abn: org.abn,
  };
}
