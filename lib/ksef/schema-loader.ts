/**
 * Pobieranie i cache schematu XSD FA_2 z MF.
 * KSEF_FA2_XSD_URL – URL do pobrania (np. z podatki.gov.pl / CRWDE).
 * Cache: lib/ksef/schemas/FA_2.xsd
 */

import * as fs from "fs";
import * as path from "path";

const SCHEMA_DIR = path.join(__dirname, "schemas");
const FA2_FILENAME = "FA_2.xsd";
const _DEFAULT_XSD_URL = "https://www.gov.pl/web/kas/ksef-pliki-do-pobrania";

export function getFa2XsdPath(): string {
  return path.join(SCHEMA_DIR, FA2_FILENAME);
}

/**
 * Sprawdza, czy plik FA_2.xsd istnieje w cache.
 */
export function hasCachedFa2Xsd(): boolean {
  try {
    return fs.existsSync(getFa2XsdPath());
  } catch {
    return false;
  }
}

/**
 * Pobiera schemat XSD z podanego URL i zapisuje w lib/ksef/schemas/FA_2.xsd.
 * Wymaga KSEF_FA2_XSD_URL (bezpośredni link do pliku .xsd).
 */
export async function fetchAndCacheFa2Xsd(): Promise<
  { success: true; path: string } | { success: false; error: string }
> {
  const url = process.env.KSEF_FA2_XSD_URL;
  if (!url || !url.trim()) {
    return {
      success: false,
      error: "Ustaw KSEF_FA2_XSD_URL (bezpośredni link do pliku FA_2.xsd)",
    };
  }

  try {
    const res = await fetch(url.trim(), {
      headers: { Accept: "application/xml, text/xml, */*" },
    });
    if (!res.ok) {
      return {
        success: false,
        error: `HTTP ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`,
      };
    }
    const text = await res.text();
    if (!text.includes("<?xml") && !text.includes("<xs:")) {
      return { success: false, error: "Odpowiedź nie wygląda na plik XSD" };
    }

    if (!fs.existsSync(SCHEMA_DIR)) {
      fs.mkdirSync(SCHEMA_DIR, { recursive: true });
    }
    const filePath = getFa2XsdPath();
    fs.writeFileSync(filePath, text, "utf8");
    return { success: true, path: filePath };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania XSD",
    };
  }
}
