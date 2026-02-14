/** Format daty YYYY-MM-DD w UTC – spójnie z serwerem/MySQL */
function toDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Generuje listę dat od start do end (włącznie), każda jako YYYY-MM-DD */
export function getDateRange(start: Date, end: Date): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
  const e = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));
  while (d <= e) {
    out.push(toDateString(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Dla podanego "today" zwraca zakres dat do wyświetlenia (np. 7 dni wstecz, 14 w przód) */
export function getDefaultDateRange(today: Date, daysBack = 0, daysForward = 14): string[] {
  const start = new Date(today);
  start.setDate(start.getDate() - daysBack);
  const end = new Date(today);
  end.setDate(end.getDate() + daysForward);
  return getDateRange(start, end);
}
