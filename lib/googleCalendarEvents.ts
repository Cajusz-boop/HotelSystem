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
  depositAmount?: number | string | null;
  depositPaid?: boolean | null;
  isPoprawiny?: boolean | null;
};

const TIMEZONE = "Europe/Warsaw";

const EVENT_TYPE_PL: Record<string, string> = {
  WESELE: "Wesele",
  KOMUNIA: "Komunia",
  CHRZCINY: "Chrzciny",
  URODZINY: "Urodziny/Rocznica",
  STYPA: "Stypa",
  FIRMOWA: "Impreza firmowa",
  SYLWESTER: "Sylwester",
  INNE: "Impreza",
  POPRAWINY: "Poprawiny",
};

function eventTypeToPL(eventType?: string | null, isPoprawiny?: boolean): string {
  if (isPoprawiny) return "Poprawiny";
  return EVENT_TYPE_PL[String(eventType || "").toUpperCase()] ?? "Impreza";
}

function buildSummary(e: EventOrderForCalendar, roomName: string): string {
  const clientName = e.clientName ?? "Impreza";
  const guestCount = e.guestCount ?? "—";
  const eventTypePL = eventTypeToPL(e.eventType, Boolean(e.isPoprawiny));
  if (e.isPoprawiny) {
    return `Poprawiny ${clientName} ${guestCount} os — ${roomName}`;
  }
  return `${clientName} ${guestCount} os — ${eventTypePL} — ${roomName}`;
}

function buildDescription(e: EventOrderForCalendar, packageName?: string | null): string {
  const depAmount = e.depositAmount != null ? String(e.depositAmount) : "0";
  const depPaid = e.depositPaid ? "✅ zapłacony" : "❌ niezapłacony";
  const lines: string[] = [
    `[LABEDZ_EVENT_ID:${e.id}]`,
    `Tel: ${e.clientPhone ?? "—"}`,
    `Goście: ${e.guestCount ?? "—"}`,
    `Godziny: ${e.timeStart ?? "—"} - ${e.timeEnd ?? "—"}`,
    `Zadatek: ${depAmount} zł ${depPaid}`,
    ...(packageName ? [`Pakiet menu: ${packageName}`] : []),
    `Sala: ${e.roomName ?? "—"}`,
    `Notatki: ${e.notes ?? "—"}`,
    `Ostatnia aktualizacja (PMS): ${new Date().toISOString().split("T")[0]}`,
  ];
  return lines.join("\n");
}

function statusToColor(status: string): string | undefined {
  switch (String(status).toUpperCase()) {
    case "CONFIRMED":
    case "DONE":
      return undefined; // nie ustawiaj colorId → kafelek dziedziczy kolor kalendarza
    case "DRAFT":
    case "PENDING":
      return "5"; // żółty — wyróżnia szkice
    case "CANCELLED":
      return "11"; // czerwony — wyróżnia anulowane
    default:
      return undefined;
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
  const roomName = event.roomName ?? "";
  const calId = getCalendarIdForEventOrder(
    event.eventType ?? "INNE",
    roomName,
    event.isPoprawiny ?? false
  );

  const summary = buildSummary(event, roomName);

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

  const color = statusToColor(event.status ?? "DRAFT");

  const res = await calendar.events.insert({
    calendarId: calId,
    supportsAttachments: true,
    requestBody: {
      summary,
      description: buildDescription(event, packageName),
      start: { date: dateFromStr, timeZone: TIMEZONE },
      end: { date: dateToStr, timeZone: TIMEZONE },
      ...(color ? { colorId: color } : {}),
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

  const roomName = event.roomName ?? "";
  const summary = buildSummary(event, roomName);

  const dateFrom = event.dateFrom instanceof Date ? event.dateFrom : new Date(event.dateFrom);
  const dateTo = event.dateTo instanceof Date ? event.dateTo : new Date(event.dateTo);
  const dateFromStr = dateFrom.toISOString().split("T")[0];
  const dateToStr = dateTo.toISOString().split("T")[0];

  const color = statusToColor(event.status ?? "DRAFT");
  const requestBody: Record<string, unknown> = {
    summary,
    description: buildDescription(event, packageName),
    start: { date: dateFromStr, timeZone: TIMEZONE },
    end: { date: dateToStr, timeZone: TIMEZONE },
    // CONFIRMED/DONE: null usuwa nadpisanie → kafelek dziedziczy kolor kalendarza
    // DRAFT/CANCELLED: ustawiamy colorId, by wyróżnić szkice i anulowane
    colorId: color ?? null,
  };

  await calendar.events.patch({
    calendarId,
    eventId: googleEventId,
    supportsAttachments: true,
    requestBody,
  });
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
  } catch (error: unknown) {
    const err = error as { code?: number; status?: number };
    if (err?.code === 404 || err?.status === 404) {
      console.log(`GCal event ${googleEventId} already deleted`);
      return;
    }
    throw error;
  }
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
