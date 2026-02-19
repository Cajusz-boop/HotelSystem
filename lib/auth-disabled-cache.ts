/**
 * Cache w pamięci procesu dla flagi AUTH_DISABLED.
 * Współdzielony między middleware a server actions (ten sam proces Node.js).
 * TTL zapewnia, że zmiana przełącznika w UI działa w ciągu kilku sekund bez restartu.
 */

const CACHE_TTL_MS = 5_000;

const g = globalThis as unknown as {
  __authDisabledCache?: { value: boolean; loadedAt: number };
};

/** Ustaw wartość w cache (wywoływane przez server action po zapisie do bazy) */
export function setAuthDisabledCache(disabled: boolean): void {
  g.__authDisabledCache = { value: disabled, loadedAt: Date.now() };
}

/**
 * Odczytaj wartość z cache.
 * Zwraca undefined jeśli cache nie istnieje lub wygasł (TTL).
 */
export function getAuthDisabledCache(): boolean | undefined {
  if (!g.__authDisabledCache) return undefined;
  if (Date.now() - g.__authDisabledCache.loadedAt > CACHE_TTL_MS) return undefined;
  return g.__authDisabledCache.value;
}

/** Sprawdź czy cache jest załadowany i aktualny */
export function isAuthCacheLoaded(): boolean {
  if (!g.__authDisabledCache) return false;
  return Date.now() - g.__authDisabledCache.loadedAt <= CACHE_TTL_MS;
}

/** Wymuś odświeżenie cache przy następnym żądaniu */
export function invalidateAuthDisabledCache(): void {
  g.__authDisabledCache = undefined;
}
