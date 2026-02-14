/**
 * Pobieranie danych firmy po NIP.
 * Główne źródło: API Wykazu podatników VAT (WL) – https://wl-api.mf.gov.pl
 * Opcjonalnie: pełna nazwa (np. z CEIDG / biznes.gov.pl) z NIP_FULL_NAME_URL.
 */

const WL_API_BASE = process.env.WL_API_BASE ?? "https://wl-api.mf.gov.pl";
/** Opcjonalny URL do pobrania pełnej nazwy firmy (CEIDG / proxy). Szablon: {nip} zostanie zastąpiony NIP-em. Np. https://example.com/nip/{nip} */
const NIP_FULL_NAME_URL = process.env.NIP_FULL_NAME_URL;

export interface CompanyFromNip {
  nip: string;
  name: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
}

/** Zwraca tylko cyfry z NIP. Nie obcina do 10 – walidacja „dokładnie 10” jest w lookup. */
function normalizeNip(nip: string): string {
  return nip.replace(/\D/g, "");
}

/** Parsuje adres typu "ULICA NR, 00-000 MIASTO" na address, postalCode, city */
function parseWorkingAddress(full: string | null): {
  address: string | null;
  postalCode: string | null;
  city: string | null;
} {
  if (!full || !full.trim()) {
    return { address: null, postalCode: null, city: null };
  }
  const parts = full.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const match = last.match(/^(\d{2}-\d{3})\s+(.+)$/);
    if (match) {
      return {
        address: parts.slice(0, -1).join(", ").trim() || full,
        postalCode: match[1],
        city: match[2].trim(),
      };
    }
  }
  return { address: full, postalCode: null, city: null };
}

export interface LookupResult {
  success: true;
  data: CompanyFromNip;
}

export interface LookupError {
  success: false;
  error: string;
}

export type NipLookupResult = LookupResult | LookupError;

/**
 * Opcjonalnie pobiera pełną nazwę firmy z zewnętrznego URL (np. CEIDG / biznes.gov.pl przez proxy).
 * Oczekiwany JSON: pole "name", "nazwa", "nazwaPelna" lub "companyName".
 */
async function fetchFullNameFromUrl(nip10: string): Promise<string | null> {
  if (!NIP_FULL_NAME_URL || !NIP_FULL_NAME_URL.includes("{nip}")) {
    return null;
  }
  const url = NIP_FULL_NAME_URL.replace("{nip}", nip10);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    const name =
      typeof json.name === "string"
        ? json.name
        : typeof json.nazwa === "string"
          ? json.nazwa
          : typeof json.nazwaPelna === "string"
            ? json.nazwaPelna
            : typeof json.companyName === "string"
              ? json.companyName
              : null;
    return name?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Pobiera dane podmiotu po NIP.
 * Nazwa: z NIP_FULL_NAME_URL (pełna nazwa, np. z CEIDG), a jeśli brak – z WL (nazwa z rejestru VAT).
 * Adres: zawsze z WL.
 */
export async function lookupCompanyByNip(nip: string): Promise<NipLookupResult> {
  const digits = normalizeNip(nip);
  if (digits.length !== 10) {
    return { success: false, error: "NIP musi mieć 10 cyfr" };
  }
  const raw = digits;

  const fullName = await fetchFullNameFromUrl(raw);

  const date = new Date().toISOString().slice(0, 10);
  const url = `${WL_API_BASE}/api/search/nip/${raw}?date=${date}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { success: false, error: "Brak podmiotu o podanym NIP w wykazie VAT" };
      }
      return {
        success: false,
        error: `API WL: ${res.status} ${res.statusText}`,
      };
    }

    const json = (await res.json()) as {
      result?: {
        subject?: {
          name?: string;
          nip?: string;
          workingAddress?: string | null;
          residenceAddress?: string | null;
        };
      };
    };

    const subject = json.result?.subject;
    if (!subject?.name) {
      return { success: false, error: "Brak danych podmiotu w odpowiedzi API" };
    }

    const fullAddress =
      subject.workingAddress ?? subject.residenceAddress ?? null;
    const { address, postalCode, city } = parseWorkingAddress(fullAddress);

    const name = fullName ?? subject.name;

    return {
      success: true,
      data: {
        nip: subject.nip ?? raw,
        name,
        address,
        postalCode,
        city,
        country: "POL",
      },
    };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Błąd połączenia z API Wykazu podatników VAT";
    return { success: false, error: msg };
  }
}
