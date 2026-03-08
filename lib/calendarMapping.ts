/**
 * Mapowanie EventOrder.eventType + roomName → ID kalendarza Google z .env
 */
export function getCalendarIdForEventOrder(eventType: string, roomName?: string | null): string {
  const et = String(eventType || "").trim().toUpperCase();
  const room = String(roomName || "").trim();

  if (et === "WESELE") {
    // Sala Złota: "Sala Złota", "Sala złota", "sala zlota", "Złota"
    if (/Z[łl]ota|zlota/i.test(room)) {
      const id = process.env.GOOGLE_CALENDAR_WESELA_ZLOTA;
      if (id) return id;
    }
    // Sala Diamentowa: "Sala Diamentowa", "Sala diamentowa", "Diamentowa"
    if (/Diamentowa|Diamentow/i.test(room)) {
      const id = process.env.GOOGLE_CALENDAR_WESELA_DIAMENTOWA;
      if (id) return id;
    }
    // Wszystkie inne sale przy WESELE → przyjęcia weselne
    const id = process.env.GOOGLE_CALENDAR_PRZYJECIA_WESELNE;
    if (id) return id;
  }
  if (et === "KOMUNIA") {
    const id = process.env.GOOGLE_CALENDAR_KOMUNIA;
    if (id) return id;
  }
  if (et === "CHRZCINY") {
    const id = process.env.GOOGLE_CALENDAR_CHRZCINY;
    if (id) return id;
  }
  if (et === "URODZINY") {
    const id = process.env.GOOGLE_CALENDAR_URODZINY;
    if (id) return id;
  }
  if (et === "STYPA") {
    const id = process.env.GOOGLE_CALENDAR_STYPY;
    if (id) return id;
    const fallback = process.env.GOOGLE_CALENDAR_IMPREZY_ZAPISOWE;
    if (fallback) return fallback;
  }
  if (et === "FIRMOWA") {
    const id = process.env.GOOGLE_CALENDAR_IMPREZY_FIRMOWE;
    if (id) return id;
  }
  if (et === "SYLWESTER") {
    const id = process.env.GOOGLE_CALENDAR_SYLWESTER;
    if (id) return id;
  }
  if (et === "INNE") {
    const id = process.env.GOOGLE_CALENDAR_IMPREZY_ZAPISOWE;
    if (id) return id;
  }

  const fallback =
    process.env.GOOGLE_CALENDAR_IMPREZY_ZAPISOWE ||
    process.env.GOOGLE_CALENDAR_CATERING ||
    process.env.GOOGLE_CALENDAR_CHRZCINY;
  if (fallback) return fallback;
  throw new Error("Brak skonfigurowanego kalendarza Google w .env");
}

/** Zwraca listę ID wszystkich skonfigurowanych kalendarzy (bez duplikatów). */
export function getAllCalendarIds(): string[] {
  const keys = [
    "GOOGLE_CALENDAR_WESELA_ZLOTA",
    "GOOGLE_CALENDAR_WESELA_DIAMENTOWA",
    "GOOGLE_CALENDAR_PRZYJECIA_WESELNE",
    "GOOGLE_CALENDAR_CHRZCINY",
    "GOOGLE_CALENDAR_KOMUNIA",
    "GOOGLE_CALENDAR_STYPY",
    "GOOGLE_CALENDAR_IMPREZY_ZAPISOWE",
    "GOOGLE_CALENDAR_IMPREZY_FIRMOWE",
    "GOOGLE_CALENDAR_SYLWESTER",
    "GOOGLE_CALENDAR_URODZINY",
    "GOOGLE_CALENDAR_CATERING",
  ];
  const ids = new Set<string>();
  for (const k of keys) {
    const v = process.env[k];
    if (v?.trim()) ids.add(v.trim());
  }
  return Array.from(ids);
}
