import { generateSecret, generateURI, verifySync } from "otplib";

const ISSUER = process.env.NEXT_PUBLIC_APP_NAME ?? "Hotel PMS";

/** Generuje nowy secret dla TOTP (32 znaki base32). */
export function generateTotpSecret(): string {
  return generateSecret();
}

/** Zwraca URI do wyświetlenia w aplikacji authenticator (np. Google Authenticator). */
export function getTotpUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

/** Weryfikuje kod TOTP (6 cyfr) dla danego secretu. */
export function verifyTotpToken(secret: string, token: string): boolean {
  try {
    const result = verifySync({ token: token.trim(), secret });
    return result.valid;
  } catch {
    return false;
  }
}
