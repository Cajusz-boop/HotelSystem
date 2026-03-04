/**
 * Google Calendar – tworzenie wydarzeń z załącznikami (checklist, menu).
 * Wymaga: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_CALENDAR_ID
 */
import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google-auth";

export type EventOrderForCalendar = {
  clientName?: string | null;
  guestCount?: number | null;
  roomName?: string | null;
  eventType?: string | null;
  clientPhone?: string | null;
  timeStart?: string | null;
  timeEnd?: string | null;
  status?: string | null;
  dateFrom: Date;
  dateTo: Date;
};

function buildCalendarDescription(event: EventOrderForCalendar): string {
  return `[FORMULARZ v1.0]
TYP: ${event.eventType ?? ""}
KLIENT: ${event.clientName ?? ""}
TELEFON: ${event.clientPhone ?? ""}
GOŚCIE: ${event.guestCount ?? ""}
SALA: ${event.roomName ?? ""}
CZAS: ${event.timeStart ?? ""} – ${event.timeEnd ?? ""}
STATUS: ${event.status ?? ""}`;
}

export async function createEventWithDocs(
  event: EventOrderForCalendar,
  checklistDocId: string,
  menuDocId?: string | null
): Promise<string> {
  const auth = getGoogleAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const attachments: { fileUrl: string; title: string; mimeType: string }[] = [
    {
      fileUrl: `https://docs.google.com/document/d/${checklistDocId}/edit`,
      title: "Checklist operacyjny",
      mimeType: "application/vnd.google-apps.document",
    },
  ];
  if (menuDocId) {
    attachments.push({
      fileUrl: `https://docs.google.com/document/d/${menuDocId}/edit`,
      title: "Oferta menu",
      mimeType: "application/vnd.google-apps.document",
    });
  }

  const dateFromStr = event.dateFrom instanceof Date
    ? event.dateFrom.toISOString().split("T")[0]
    : new Date(event.dateFrom).toISOString().split("T")[0];
  const dateToStr = event.dateTo instanceof Date
    ? event.dateTo.toISOString().split("T")[0]
    : new Date(event.dateTo).toISOString().split("T")[0];

  const insertRes = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    supportsAttachments: true,
    requestBody: {
      summary: `${event.clientName ?? "Impreza"} | ${event.guestCount ?? 0} os | ${event.roomName ?? ""}`,
      start: { date: dateFromStr },
      end: { date: dateToStr },
      description: buildCalendarDescription(event),
      attachments,
    },
  });

  return insertRes.data.id ?? "";
}

export async function updateCalendarEvent(
  eventId: string,
  event: EventOrderForCalendar
): Promise<void> {
  const auth = getGoogleAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const dateFromStr = event.dateFrom instanceof Date
    ? event.dateFrom.toISOString().split("T")[0]
    : new Date(event.dateFrom).toISOString().split("T")[0];
  const dateToStr = event.dateTo instanceof Date
    ? event.dateTo.toISOString().split("T")[0]
    : new Date(event.dateTo).toISOString().split("T")[0];

  await calendar.events.patch({
    calendarId: process.env.GOOGLE_CALENDAR_ID!,
    eventId,
    requestBody: {
      summary: `${event.clientName ?? "Impreza"} | ${event.guestCount ?? 0} os | ${event.roomName ?? ""}`,
      start: { date: dateFromStr },
      end: { date: dateToStr },
      description: buildCalendarDescription(event),
    },
  });
}
