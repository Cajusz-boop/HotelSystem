/**
 * Parsowanie MRZ (Machine Readable Zone) – Gap 2.3.
 * TD1 (dowód osobisty): 3 linie × 30 znaków – nazwisko na linii 3.
 * TD3 (paszport): 2 linie × 44 znaki – nazwisko na linii 1, kolumny 6–44.
 */

export interface ParsedMrzName {
  surname: string;
  givenNames: string;
}

/** Wyciąga nazwisko i imię z fragmentu MRZ w formacie Surname<<Given<<... */
function parseNameField(raw: string): ParsedMrzName | null {
  const parts = raw.split("<").filter(Boolean);
  if (parts.length < 2) return null;
  const surname = (parts[0] ?? "").replace(/</g, "").trim();
  const givenNames = (parts
    .slice(1)
    .join(" ")
    .replace(/<+/g, " ")
    .trim() as string);
  if (!surname) return null;
  return { surname, givenNames: givenNames || "" };
}

/**
 * Parsuje MRZ i zwraca imię/nazwisko.
 * - 3 linie (TD1, dowód): linia 3 zawiera nazwisko i imię (Surname<<Given).
 * - 2 linie (TD3, paszport): linia 1, znaki 6–44 to pole nazwiska (Surname<<Given).
 * - 1 linia: traktowane jak pojedyncza linia z Surname<<Given (fallback).
 */
export function parseMRZ(mrz: string): ParsedMrzName | null {
  const raw = mrz.trim();
  if (!raw) return null;

  const lines = raw
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length >= 3) {
    const line3 = lines[2];
    if (line3.length >= 10) {
      const parsed = parseNameField(line3);
      if (parsed) return parsed;
    }
  }

  if (lines.length >= 2) {
    const line1 = lines[0];
    if (line1.length >= 44) {
      const nameField = line1.slice(5, 44).trim();
      const parsed = parseNameField(nameField);
      if (parsed) return parsed;
    }
  }

  if (lines.length >= 1) {
    const line = lines[0];
    const parsed = parseNameField(line);
    if (parsed) return parsed;
  }

  return null;
}
