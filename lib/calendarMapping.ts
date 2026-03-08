/**
 * Mapowanie typ imprezy/rezerwacji → ID kalendarza Google z .env
 */
const EVENT_TYPE_TO_ENV: Record<string, string> = {
  WESELE_ZLOTA: "GOOGLE_CALENDAR_WESELA_ZLOTA",
  WESELE_DIAMENTOWA: "GOOGLE_CALENDAR_WESELA_DIAMENTOWA",
  CHRZCINY: "GOOGLE_CALENDAR_CHRZCINY",
  KOMUNIA: "GOOGLE_CALENDAR_KOMUNIA",
  POPRAWINY: "GOOGLE_CALENDAR_POPRAWINY",
  PRZYJECIA_WESELNE: "GOOGLE_CALENDAR_PRZYJECIA_WESELNE",
  IMPREZY_FIRMOWE: "GOOGLE_CALENDAR_IMPREZY_FIRMOWE",
  IMPREZY_ZAPISOWE: "GOOGLE_CALENDAR_IMPREZY_ZAPISOWE",
  CATERING: "GOOGLE_CALENDAR_CATERING",
  SPOTKANIA_FIRMOWE: "GOOGLE_CALENDAR_SPOTKANIA_FIRMOWE",
  SYLWESTER: "GOOGLE_CALENDAR_SYLWESTER",
  URODZINY: "GOOGLE_CALENDAR_URODZINY",
};

/**
 * Zwraca ID kalendarza Google dla danego typu imprezy.
 * Gdy brak mapowania – zwraca kalendarz CATERING jako domyślny.
 */
export function getCalendarIdForEvent(eventType: string): string {
  const normalized = String(eventType || "").trim().toUpperCase();
  if (normalized && EVENT_TYPE_TO_ENV[normalized]) {
    const calId = process.env[EVENT_TYPE_TO_ENV[normalized]];
    if (calId) return calId;
  }
  // Domyślnie: catering
  const defaultCal = process.env.GOOGLE_CALENDAR_CATERING;
  if (defaultCal) return defaultCal;
  // Fallback: pierwszy dostępny kalendarz
  const first = process.env.GOOGLE_CALENDAR_WESELA_ZLOTA
    || process.env.GOOGLE_CALENDAR_CATERING
    || process.env.GOOGLE_CALENDAR_CHRZCINY;
  if (first) return first;
  throw new Error("Brak skonfigurowanego kalendarza Google (np. GOOGLE_CALENDAR_CATERING) w .env");
}

/** Zwraca listę ID wszystkich skonfigurowanych kalendarzy (bez duplikatów). */
export function getAllCalendarIds(): string[] {
  const keys = Object.values(EVENT_TYPE_TO_ENV);
  const ids = new Set<string>();
  for (const k of keys) {
    const v = process.env[k];
    if (v?.trim()) ids.add(v.trim());
  }
  return Array.from(ids);
}
