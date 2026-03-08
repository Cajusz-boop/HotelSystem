/**
 * Dwustronna synchronizacja rezerwacji hotelowych z Google Calendar.
 * Funkcje: create, update, cancel, delete — zawsze w try/catch, nie blokują zapisu do bazy.
 */
import { google } from "googleapis";
import { getGoogleAuthClient } from "@/lib/googleAuth";
import { getCalendarIdForEvent } from "@/lib/calendarMapping";

type ReservationForCalendar = {
  id: string;
  guest?: { name: string };
  room?: { number: string; type: string };
  checkIn: Date;
  checkOut: Date;
  pax?: number | null;
  adults?: number | null;
  children?: number | null;
  notes?: string | null;
  internalNotes?: string | null;
  status: string;
  tripPurpose?: string | null;
};

const TIMEZONE = "Europe/Warsaw";

function buildDescription(r: ReservationForCalendar): string {
  const lines: string[] = [];
  lines.push(`[LABEDZ_ID:${r.id}]`);
  lines.push(`Daty: ${(r.checkIn instanceof Date ? r.checkIn : new Date(r.checkIn)).toLocaleDateString("pl-PL")} – ${(r.checkOut instanceof Date ? r.checkOut : new Date(r.checkOut)).toLocaleDateString("pl-PL")}`);
  const pax = r.pax ?? (r.adults ?? 0) + (r.children ?? 0);
  if (pax > 0) lines.push(`Goście: ${pax}`);
  lines.push(`Status: ${r.status}`);
  if (r.notes) lines.push(`Uwagi: ${r.notes}`);
  if (r.internalNotes) lines.push(`Notatki wewnętrzne: ${r.internalNotes}`);
  lines.push(`Ostatnia aktualizacja (PMS): ${new Date().toISOString()}`);
  return lines.join("\n");
}

function statusToColor(status: string): string {
  switch (String(status).toUpperCase()) {
    case "CONFIRMED":
    case "CHECKED_IN":
    case "CHECKED_OUT":
      return "10"; // zielony
    case "PENDING":
    case "REQUEST":
      return "5"; // żółty
    case "CANCELLED":
    case "NO_SHOW":
      return "11"; // czerwony
    default:
      return "5";
  }
}

/**
 * Tworzy wydarzenie w Google Calendar. Zwraca googleCalendarEventId.
 */
export async function createCalendarEvent(
  reservation: ReservationForCalendar,
  eventType?: string | null
): Promise<string> {
  try {
    const auth = getGoogleAuthClient();
    const calendar = google.calendar({ version: "v3", auth });
    const calId = getCalendarIdForEvent(eventType ?? "CATERING");

    const guestName = reservation.guest?.name ?? "Gość";
    const roomNumber = reservation.room?.number ?? "?";
    const roomType = reservation.room?.type ?? "";

    const checkIn = reservation.checkIn instanceof Date ? reservation.checkIn : new Date(reservation.checkIn);
    const checkOut = reservation.checkOut instanceof Date ? reservation.checkOut : new Date(reservation.checkOut);
    const dateFromStr = checkIn.toISOString().split("T")[0];
    const dateToStr = checkOut.toISOString().split("T")[0];

    const summary = `${guestName} — Pokój ${roomNumber}${roomType ? ` (${roomType})` : ""}`;

    const res = await calendar.events.insert({
      calendarId: calId,
      supportsAttachments: true,
      requestBody: {
        summary,
        description: buildDescription(reservation),
        start: { date: dateFromStr, timeZone: TIMEZONE },
        end: { date: dateToStr, timeZone: TIMEZONE },
        colorId: statusToColor(reservation.status),
      },
    });

    const eventId = res.data.id;
    if (!eventId) throw new Error("Brak id w odpowiedzi Google Calendar");
    return eventId;
  } catch (e) {
    console.error("[googleCalendarReservations] createCalendarEvent:", e);
    throw e;
  }
}

/**
 * Aktualizuje wydarzenie w Google Calendar.
 */
export async function updateCalendarEvent(
  reservation: ReservationForCalendar,
  googleEventId: string,
  calendarId: string
): Promise<void> {
  try {
    const auth = getGoogleAuthClient();
    const calendar = google.calendar({ version: "v3", auth });

    const guestName = reservation.guest?.name ?? "Gość";
    const roomNumber = reservation.room?.number ?? "?";
    const roomType = reservation.room?.type ?? "";

    const checkIn = reservation.checkIn instanceof Date ? reservation.checkIn : new Date(reservation.checkIn);
    const checkOut = reservation.checkOut instanceof Date ? reservation.checkOut : new Date(reservation.checkOut);
    const dateFromStr = checkIn.toISOString().split("T")[0];
    const dateToStr = checkOut.toISOString().split("T")[0];

    const summary = `${guestName} — Pokój ${roomNumber}${roomType ? ` (${roomType})` : ""}`;

    await calendar.events.patch({
      calendarId,
      eventId: googleEventId,
      supportsAttachments: true,
      requestBody: {
        summary,
        description: buildDescription(reservation),
        start: { date: dateFromStr, timeZone: TIMEZONE },
        end: { date: dateToStr, timeZone: TIMEZONE },
        colorId: statusToColor(reservation.status),
      },
    });
  } catch (e) {
    console.error("[googleCalendarReservations] updateCalendarEvent:", e);
    throw e;
  }
}

/**
 * Anuluje wydarzenie (ustawia status cancelled).
 */
export async function cancelCalendarEvent(googleEventId: string, calId: string): Promise<void> {
  try {
    const auth = getGoogleAuthClient();
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.patch({
      calendarId: calId,
      eventId: googleEventId,
      requestBody: { status: "cancelled" },
    });
  } catch (e) {
    console.error("[googleCalendarReservations] cancelCalendarEvent:", e);
    throw e;
  }
}

/**
 * Usuwa wydarzenie z kalendarza.
 */
export async function deleteCalendarEvent(googleEventId: string, calId: string): Promise<void> {
  try {
    const auth = getGoogleAuthClient();
    const calendar = google.calendar({ version: "v3", auth });
    await calendar.events.delete({
      calendarId: calId,
      eventId: googleEventId,
    });
  } catch (e) {
    console.error("[googleCalendarReservations] deleteCalendarEvent:", e);
    throw e;
  }
}
