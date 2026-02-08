import type { Room, Reservation } from "./tape-chart-types";

/** Dane z dummy-data.json + rozszerzone o Rezerwacje.csv (daty luty 2026) */
export const rooms: Room[] = [
  { number: "101", type: "Queen", status: "CLEAN", price: 300 },
  { number: "102", type: "Twin", status: "DIRTY", price: 280 },
  { number: "103", type: "Suite", status: "OOO", reason: "Broken AC", price: 550 },
  { number: "104", type: "Twin", status: "CLEAN", price: 280 },
  { number: "105", type: "Queen", status: "OOO", price: 300 },
  { number: "106", type: "Twin", status: "CLEAN", price: 280 },
  { number: "201", type: "Suite", status: "OOO", reason: "Renovation", price: 550 },
  { number: "202", type: "Queen", status: "CLEAN", price: 300 },
];

/** Rezerwacje – daty w okolicy "today" (np. 7–14 lutego) dla wizualizacji Tape Chart */
export const reservations: Reservation[] = [
  { id: "R1", guestName: "Smith, J.", room: "101", checkIn: "2026-02-07", checkOut: "2026-02-09", status: "CHECKED_IN", pax: 2 },
  { id: "R2", guestName: "Doe, A.", room: "102", checkIn: "2026-02-09", checkOut: "2026-02-11", status: "CONFIRMED", pax: 1 },
  { id: "R3", guestName: "Kowalski, P.", room: "104", checkIn: "2026-02-11", checkOut: "2026-02-14", status: "CONFIRMED", pax: 1 },
  { id: "R4", guestName: "Jan Kowalski", room: "101", checkIn: "2026-02-10", checkOut: "2026-02-13", status: "CONFIRMED", pax: 2 },
  { id: "R5", guestName: "Anna Nowak", room: "202", checkIn: "2026-02-08", checkOut: "2026-02-12", status: "CONFIRMED", pax: 2 },
  { id: "R6", guestName: "Thomas Smith", room: "201", checkIn: "2026-02-07", checkOut: "2026-02-10", status: "CHECKED_IN", pax: 1 },
];

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
