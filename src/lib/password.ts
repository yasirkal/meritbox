import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended argon2id parameters (m=19 MiB, t=2, p=1)
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashPassword = (pw: string) => hash(pw, ARGON);
export const verifyPassword = (hashed: string, pw: string) => verify(hashed, pw).catch(() => false);
