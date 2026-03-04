/**
 * Walidacja NIP (polski) i numeru VAT UE.
 * Polski NIP: 10 cyfr (z sumą kontrolną).
 * Numer VAT UE: 2 litery (kod kraju) + 8–12 znaków alfanumerycznych.
 */

import { isValidNipChecksum } from "./nip-checksum";

/** Kody krajów UE używane w numerach VAT */
const EU_VAT_COUNTRY_CODES = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR",
  "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
  "SE", "SI", "SK", "XI", // XI = Irlandia Północna (post-Brexit)
];

/** Czy ciąg wygląda na numer VAT UE (2 litery + 8–12 znaków alfanumerycznych). */
export function isEuVat(value: string | null | undefined): boolean {
  const s = String(value ?? "").replace(/\s/g, "").toUpperCase();
  if (s.length < 10 || s.length > 14) return false;
  const prefix = s.slice(0, 2);
  const rest = s.slice(2);
  if (!EU_VAT_COUNTRY_CODES.includes(prefix)) return false;
  return /^[A-Z0-9]{8,12}$/i.test(rest);
}

/** Czy format to polski NIP (10 cyfr). */
export function isPolishNipFormat(value: string | null | undefined): boolean {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 10 && /^\d{10}$/.test(digits);
}

/** Czy NIP/VAT jest prawidłowy (polski lub UE). */
export function isValidNipOrVat(value: string | null | undefined): boolean {
  const s = String(value ?? "").trim();
  if (!s) return false;
  if (isPolishNipFormat(s)) return isValidNipChecksum(s);
  return isEuVat(s);
}

export type NipVatValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

/** Waliduje i normalizuje NIP lub numer VAT UE. */
export function validateNipOrVat(value: string | null | undefined): NipVatValidationResult {
  const s = String(value ?? "").trim().replace(/\s/g, "");
  if (!s) return { ok: false, error: "NIP lub numer VAT jest wymagany." };

  if (isPolishNipFormat(s)) {
    const digits = s.replace(/\D/g, "");
    if (!isValidNipChecksum(digits)) {
      return { ok: false, error: "NIP ma błędną sumę kontrolną." };
    }
    return { ok: true, normalized: digits };
  }

  if (isEuVat(s)) {
    const normalized = s.toUpperCase();
    return { ok: true, normalized };
  }

  if (/^[A-Za-z]{2}/.test(s) && s.length >= 10) {
    return { ok: false, error: "Nieprawidłowy format numeru VAT UE (np. DE123456789)." };
  }

  if (s.replace(/\D/g, "").length !== 10) {
    return { ok: false, error: "NIP musi mieć 10 cyfr lub podaj numer VAT UE (np. DE123456789)." };
  }

  return { ok: false, error: "NIP ma błędną sumę kontrolną." };
}

/** Normalizuje do postaci zapisywanej w bazie (polski: 10 cyfr, UE: prefix + numer). */
export function normalizeNipOrVat(value: string | null | undefined): string {
  const result = validateNipOrVat(value);
  return result.ok ? result.normalized : String(value ?? "").replace(/\s/g, "");
}
