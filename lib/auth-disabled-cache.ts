/**
 * Cache w pamięci procesu dla flagi AUTH_DISABLED.
 * Współdzielony między middleware a server actions (ten sam proces Node.js).
 * Dzięki temu zmiana ustawienia działa natychmiast bez restartu serwera.
 */

const g = globalThis as unknown as {
  __authDisabledCache?: { value: boolean; loadedAt: number };
};

/** Ustaw wartość w cache (wywoływane przez server action po zapisie do bazy) */
export function setAuthDisabledCache(disabled: boolean): void {
  g.__authDisabledCache = { value: disabled, loadedAt: Date.now() };
}

/**
 * Odczytaj wartość z cache.
 * - Jeśli cache istnieje — zwraca wartość natychmiast (zero latencji).
 * - Jeśli cache nie istnieje (np. po starcie serwera) — zwraca undefined.
 *   W takim przypadku middleware/auth powinny użyć fallbacku (process.env lub fetch do bazy).
 */
export function getAuthDisabledCache(): boolean | undefined {
  return g.__authDisabledCache?.value;
}

/** Sprawdź czy cache jest załadowany */
export function isAuthCacheLoaded(): boolean {
  return g.__authDisabledCache !== undefined;
}
