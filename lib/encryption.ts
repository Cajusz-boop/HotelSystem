import * as crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 32) return null;
  if (raw.length >= 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw.slice(0, 64), "hex");
  }
  return crypto.scryptSync(raw.slice(0, 64), "pms-salt", KEY_LENGTH);
}

/** Szyfruje tekst (np. MRZ, numery kart). Zwraca base64(iv+tag+cipher). Gdy brak ENCRYPTION_KEY, zwraca plaintext. */
export function encrypt(plainText: string): string {
  if (!plainText || plainText.trim() === "") return plainText;
  const key = getKey();
  if (!key) return plainText;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH });
  const enc = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Deszyfruje tekst. Jeśli input nie wygląda na zaszyfrowany (base64) lub brak klucza, zwraca go bez zmian (backward compat). */
export function decrypt(cipherText: string | null | undefined): string | null {
  if (cipherText == null || cipherText.trim() === "") return cipherText ?? null;
  const key = getKey();
  if (!key) return cipherText;
  const buf = Buffer.from(cipherText, "base64");
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) return cipherText;
  try {
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const enc = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);
    return decipher.update(enc).toString("utf8") + decipher.final("utf8");
  } catch {
    return cipherText;
  }
}
