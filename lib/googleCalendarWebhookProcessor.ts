/**
 * Przetwarzanie zdarzeń z webhooka Google Calendar → aktualizacja EventOrder w bazie.
 */
import { prisma } from "@/lib/db";

type GCalEvent = {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  start?: { date?: string | null; dateTime?: string | null };
  end?: { date?: string | null; dateTime?: string | null };
  status?: string | null;
  updated?: string | null;
  attachments?: Array<{
    fileUrl?: string | null;
    title?: string | null;
    mimeType?: string | null;
  }>;
};

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function extractLabedzEventId(description: string | null | undefined): string | null {
  if (!description) return null;
  const m = description.match(/\[LABEDZ_EVENT_ID:([a-z0-9_-]+)\]/i);
  return m ? m[1] : null;
}

/** Mapowanie PL → kod eventType (odpowiednik EVENT_TYPE_PL z googleCalendarEvents) */
const EVENT_TYPE_PL_TO_CODE: Record<string, string> = {
  wesele: "WESELE",
  komunia: "KOMUNIA",
  chrzciny: "CHRZCINY",
  "urodziny/rocznica": "URODZINY",
  urodziny: "URODZINY",
  rocznica: "URODZINY",
  stypa: "STYPA",
  "impreza firmowa": "FIRMOWA",
  firmowa: "FIRMOWA",
  sylwester: "SYLWESTER",
  poprawiny: "WESELE",
  impreza: "INNE",
  inne: "INNE",
};

/** Słowa kluczowe do wykrywania typu w dowolnej części tytułu (regex \b = granica słowa) */
const EVENT_TYPE_KEYWORDS: { pattern: RegExp; eventType: string; isPoprawiny?: boolean }[] = [
  { pattern: /\bpoprawiny\b/i, eventType: "WESELE", isPoprawiny: true },
  { pattern: /\bwesele\b/i, eventType: "WESELE" },
  { pattern: /\bkomunia\b/i, eventType: "KOMUNIA" },
  { pattern: /\bchrzciny\b/i, eventType: "CHRZCINY" },
  { pattern: /\bstypa\b/i, eventType: "STYPA" },
  { pattern: /\burodziny\b/i, eventType: "URODZINY" },
  { pattern: /\brocznic[a-zęąół]*\b/i, eventType: "URODZINY" },
  { pattern: /\bfirmow[ayę]\b/i, eventType: "FIRMOWA" },
  { pattern: /\bsylwester\b/i, eventType: "SYLWESTER" },
];

function parseEventTypeFromSummary(summary: string | null | undefined): {
  eventType: string;
  isPoprawiny: boolean;
} {
  const s = (summary || "").trim();
  if (!s) return { eventType: "INNE", isPoprawiny: false };

  if (/^poprawiny\s/i.test(s)) return { eventType: "WESELE", isPoprawiny: true };

  const parts = s.split("—").map((p) => p.trim());
  const middle = parts[1];
  if (middle) {
    const key = middle.toLowerCase();
    const fromMiddle = EVENT_TYPE_PL_TO_CODE[key];
    if (fromMiddle && fromMiddle !== "INNE") {
      const isPoprawiny = /poprawiny/i.test(middle);
      return { eventType: isPoprawiny ? "WESELE" : fromMiddle, isPoprawiny };
    }
  }

  for (const { pattern, eventType, isPoprawiny } of EVENT_TYPE_KEYWORDS) {
    if (pattern.test(s)) return { eventType, isPoprawiny: Boolean(isPoprawiny) };
  }

  return { eventType: "INNE", isPoprawiny: false };
}

export async function processCalendarEvent(
  event: GCalEvent,
  calendarId: string
): Promise<void> {
  const labedzEventId = extractLabedzEventId(event.description);
  const firstPart = (event.summary || "Impreza z GCal").split("—")[0].trim() || "Impreza z GCal";
  const clientName = firstPart.replace(/\s*\d+\s*os\s*$/i, "").trim() || firstPart;

  const startDate = event.start?.date || event.start?.dateTime;
  const endDate = event.end?.date || event.end?.dateTime;
  const dateFrom = parseDate(startDate);
  const dateTo = parseDate(endDate);
  const eventUpdated = parseDate(event.updated);

  const attachments = (event.attachments || []).map((a) => ({
    fileUrl: a.fileUrl ?? undefined,
    title: a.title ?? undefined,
    mimeType: a.mimeType ?? undefined,
  }));

  if (labedzEventId) {
    const existing = await prisma.eventOrder.findUnique({
      where: { id: labedzEventId },
      select: { id: true, googleCalendarUpdatedAt: true },
    });

    if (!existing) return;

    const gcalUpdated = eventUpdated ? eventUpdated.getTime() : 0;
    const dbUpdated = existing.googleCalendarUpdatedAt
      ? existing.googleCalendarUpdatedAt.getTime()
      : 0;

    if (event.status === "cancelled") {
      await prisma.eventOrder.update({
        where: { id: labedzEventId },
        data: {
          status: "CANCELLED",
          googleAttachments: attachments.length > 0 ? (attachments as object) : undefined,
          googleCalendarUpdatedAt: eventUpdated ?? new Date(),
        },
      });
      return;
    }

    if (gcalUpdated <= dbUpdated) return;

    const updateData: {
      dateFrom?: Date;
      dateTo?: Date;
      notes?: string | null;
      status?: string;
      googleAttachments?: object;
      googleCalendarUpdatedAt?: Date;
    } = {};

    if (dateFrom) updateData.dateFrom = dateFrom;
    if (dateTo) updateData.dateTo = dateTo;
    if (event.description) updateData.notes = event.description;
    updateData.googleAttachments = attachments.length > 0 ? (attachments as object) : undefined;
    updateData.googleCalendarUpdatedAt = eventUpdated ?? new Date();

    await prisma.eventOrder.update({
      where: { id: labedzEventId },
      data: updateData,
    });
  } else {
    if (!dateFrom || !dateTo) return;

    const { eventType: parsedType, isPoprawiny } = parseEventTypeFromSummary(event.summary);
    const parts = (event.summary || "").split("—").map((p) => p.trim());
    const roomName = parts[2] ?? null;
    const guestMatch = (parts[0] || "").match(/(\d+)\s*os/);
    const guestCount = guestMatch ? parseInt(guestMatch[1], 10) : null;

    await prisma.eventOrder.create({
      data: {
        name: `${clientName} – ${dateFrom.toLocaleDateString("pl-PL")}`,
        eventType: parsedType,
        isPoprawiny,
        roomName: roomName || undefined,
        guestCount: guestCount ?? undefined,
        clientName,
        eventDate: dateFrom,
        dateFrom,
        dateTo,
        status: "DRAFT",
        notes: event.description ?? null,
        googleCalendarEventId: event.id ?? null,
        googleCalendarCalId: calendarId,
        googleCalendarSynced: true,
        googleCalendarSyncedAt: new Date(),
        googleAttachments: attachments.length > 0 ? (attachments as object) : undefined,
        googleCalendarUpdatedAt: eventUpdated ?? new Date(),
      },
    });
  }
}
