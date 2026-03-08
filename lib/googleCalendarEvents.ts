/**
 * Dwustronna synchronizacja imprez (EventOrder) z Google Calendar.
 */
import { google } from "googleapis";
import { getGoogleAuthClient } from "@/lib/googleAuth";
import { getCalendarIdForEventOrder } from "@/lib/calendarMapping";

export type EventOrderForCalendar = {
  id: string;
  clientName?: string | null;
  clientPhone?: string | null;
  eventType?: string | null;
  roomName?: string | null;
  timeStart?: string | null;
  timeEnd?: string | null;
  guestCount?: number | null;
  packageId?: string | null;
  status?: string | null;
  notes?: string | null;
  dateFrom: Date;
  dateTo: Date;
};

const TIMEZONE = "Europe/Warsaw";

function buildDescription(e: EventOrderForCalendar, packageName?: string | null): string {
  const lines: string[] = [];
  lines.push(`[LABEDZ_EVENT_ID:${e.id}]`);
  const df = e.dateFrom instanceof Date ? e.dateFrom : new Date(e.dateFrom);
  const dt = e.dateTo instanceof Date ? e.dateTo : new Date(e.dateTo);
  lines.push(`Data: ${df.toLocaleDateString("pl-PL")} – ${dt.toLocaleDateString("pl-PL")}`);
  if (e.timeStart || e.timeEnd) lines.push(`Godziny: ${e.timeStart ?? "?"} – ${e.timeEnd ?? "?"}`);
  if (e.guestCount != null) lines.push(`Liczba gości: ${e.guestCount}`);
  if (e.clientPhone) lines.push(`Telefon: ${e.clientPhone}`);
  if (packageName) lines.push(`Pakiet menu: ${packageName}`);
  lines.push(`Status: ${e.status ?? ""}`);
  if (e.notes) lines.push(`Notatki: ${e.notes}`);
  lines.push(`Ostatnia aktualizacja (PMS): ${new Date().toISOString()}`);
  return lines.join("\n");
}

function statusToColor(status: string): string {
  switch (String(status).toUpperCase()) {
    case "CONFIRMED":
    case "DONE":
      return "10";
    case "DRAFT":
    case "PENDING":
      return "5";
    case "CANCELLED":
      return "11";
    default:
      return "5";
  }
}

/**
 * Tworzy wydarzenie w Google Calendar. Zwraca googleCalendarEventId.
 */
export async function createCalendarEvent(
  event: EventOrderForCalendar,
  packageName?: string | null,
  checklistDocId?: string | null,
  menuDocId?: string | null
): Promise<string> {
  const auth = getGoogleAuthClient();
  const calendar = google.calendar({ version: "v3", auth });
  const calId = getCalendarIdForEventOrder(event.eventType ?? "INNE", event.roomName);

  const clientName = event.clientName ?? "Impreza";
  const eventType = event.eventType ?? "Impreza";
  const roomName = event.roomName ?? "";

  const summary = `${clientName} — ${eventType} — ${roomName}`;

  const dateFrom = event.dateFrom instanceof Date ? event.dateFrom : new Date(event.dateFrom);
  const dateTo = event.dateTo instanceof Date ? event.dateTo : new Date(event.dateTo);
  const dateFromStr = dateFrom.toISOString().split("T")[0];
  const dateToStr = dateTo.toISOString().split("T")[0];

  const attachments: { fileUrl: string; title: string; mimeType: string }[] = [];
  if (checklistDocId) {
    attachments.push({
      fileUrl: `https://docs.google.com/document/d/${checklistDocId}/edit`,
      title: "Checklist operacyjny",
      mimeType: "application/vnd.google-apps.document",
    });
  }
  if (menuDocId) {
    attachments.push({
      fileUrl: `https://docs.google.com/document/d/${menuDocId}/edit`,
      title: "Oferta menu",
      mimeType: "application/vnd.google-apps.document",
    });
  }

  const res = await calendar.events.insert({
    calendarId: calId,
    supportsAttachments: true,
    requestBody: {
      summary,
      description: buildDescription(event, packageName),
      start: { date: dateFromStr, timeZone: TIMEZONE },
      end: { date: dateToStr, timeZone: TIMEZONE },
      colorId: statusToColor(event.status ?? "DRAFT"),
      ...(attachments.length > 0 ? { attachments } : {}),
    },
  });

  const eventId = res.data.id;
  if (!eventId) throw new Error("Brak id w odpowiedzi Google Calendar");
  return eventId;
}

/**
 * Aktualizuje wydarzenie w Google Calendar.
 */
export async function updateCalendarEvent(
  event: EventOrderForCalendar,
  googleEventId: string,
  calendarId: string,
  packageName?: string | null
): Promise<void> {
  const auth = getGoogleAuthClient();
  const calendar = google.calendar({ version: "v3", auth });

  const clientName = event.clientName ?? "Impreza";
  const eventType = event.eventType ?? "Impreza";
  const roomName = event.roomName ?? "";
  const summary = `${clientName} — ${eventType} — ${roomName}`;

  const dateFrom = event.dateFrom instanceof Date ? event.dateFrom : new Date(event.dateFrom);
  const dateTo = event.dateTo instanceof Date ? event.dateTo : new Date(event.dateTo);
  const dateFromStr = dateFrom.toISOString().split("T")[0];
  const dateToStr = dateTo.toISOString().split("T")[0];

  await calendar.events.patch({
    calendarId,
    eventId: googleEventId,
    supportsAttachments: true,
    requestBody: {
      summary,
      description: buildDescription(event, packageName),
      start: { date: dateFromStr, timeZone: TIMEZONE },
      end: { date: dateToStr, timeZone: TIMEZONE },
      colorId: statusToColor(event.status ?? "DRAFT"),
    },
  });
}

/**
 * Anuluje wydarzenie (ustawia status cancelled).
 */
export async function cancelCalendarEvent(googleEventId: string, calId: string): Promise<void> {
  const auth = getGoogleAuthClient();
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.patch({
    calendarId: calId,
    eventId: googleEventId,
    requestBody: { status: "cancelled" },
  });
}

/**
 * Usuwa wydarzenie z kalendarza.
 */
export async function deleteCalendarEvent(googleEventId: string, calId: string): Promise<void> {
  const auth = getGoogleAuthClient();
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.delete({
    calendarId: calId,
    eventId: googleEventId,
  });
}
