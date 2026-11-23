import * as OTPAuth from "otpauth";

export function newTotpSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function totpUri(secret: string, account: string) {
  return new OTPAuth.TOTP({ issuer: "Meritbox", label: account, secret: OTPAuth.Secret.fromBase32(secret), algorithm: "SHA1", digits: 6, period: 30 }).toString();
}

export function checkTotp(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), algorithm: "SHA1", digits: 6, period: 30 });
  return totp.validate({ token: code, window: 1 }) !== null;
}
