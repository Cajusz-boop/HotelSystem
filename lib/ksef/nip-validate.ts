/**
 * Walidacja NIP nabywcy przed wysyłką do KSeF – API Wykazu podatników VAT (WL).
 * Sprawdzenie czy NIP jest aktywny (Czynny/Zwolniony); ostrzeżenie jeśli Niezarejestrowany lub brak w wykazie.
 */

import { getEffectiveKsefEnv } from "./env";

const WL_API_PROD = "https://wl-api.mf.gov.pl";
const WL_API_TEST = "https://wl-test.mf.gov.pl";

export type NipValidationResult =
  | { active: true }
  | { active: false; error: string };

function normalizeNip(nip: string | null | undefined): string {
  return String(nip ?? "").replace(/\D/g, "");
}

/** Czy NIP wygląda na polski (10 cyfr). */
export function isPolishNip(nip: string | null | undefined): boolean {
  return normalizeNip(nip).length === 10;
}

/**
 * Sprawdza w API WL (Wykaz podatników VAT), czy NIP nabywcy jest aktywny.
 * Aktywny = statusVat "Czynny" lub "Zwolniony".
 * Nieaktywny = brak w wykazie, 404, lub statusVat "Niezarejestrowany".
 * Dla niepolskiego NIP (nie 10 cyfr) lub pustego – pomija walidację (zwraca active: true).
 * Przy błędzie sieci/API – zwraca active: true, żeby nie blokować wysyłki gdy WL jest niedostępne.
 */
export async function checkBuyerNipActive(
  nip: string | null | undefined
): Promise<NipValidationResult> {
  const raw = normalizeNip(nip);
  if (raw.length === 0) return { active: true };
  if (raw.length !== 10) return { active: true }; // niepolski NIP – bez walidacji WL

  const baseUrl = getEffectiveKsefEnv() === "test" ? WL_API_TEST : WL_API_PROD;
  const date = new Date().toISOString().slice(0, 10);
  const url = `${baseUrl}/api/search/nip/${encodeURIComponent(raw)}?date=${date}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 404) {
      return {
        active: false,
        error:
          "NIP nabywcy nie figuruje w wykazie podatników VAT (nieaktywny). Sprawdź NIP lub zweryfikuj w wyszukiwarce MF.",
      };
    }

    if (!res.ok) {
      return { active: true }; // nie blokuj przy błędzie API
    }

    const data = (await res.json()) as {
      result?: { subject?: { statusVat?: string } };
    };
    const subject = data?.result?.subject;
    const statusVat = subject?.statusVat;

    if (!subject) {
      return {
        active: false,
        error:
          "NIP nabywcy nie figuruje w wykazie podatników VAT (nieaktywny). Sprawdź NIP lub zweryfikuj w wyszukiwarce MF.",
      };
    }

    if (statusVat === "Niezarejestrowany") {
      return {
        active: false,
        error:
          "NIP nabywcy ma status „Niezarejestrowany” w wykazie podatników VAT. Sprawdź NIP lub zweryfikuj w wyszukiwarce MF.",
      };
    }

    if (statusVat === "Czynny" || statusVat === "Zwolniony") {
      return { active: true };
    }

    return { active: true };
  } catch {
    return { active: true }; // przy błędzie sieci nie blokuj wysyłki
  }
}
