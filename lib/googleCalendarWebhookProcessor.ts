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

export async function processCalendarEvent(
  event: GCalEvent,
  calendarId: string
): Promise<void> {
  const labedzEventId = extractLabedzEventId(event.description);
  const clientName = (event.summary || "Impreza z GCal").split("—")[0].trim() || "Impreza z GCal";

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

    await prisma.eventOrder.create({
      data: {
        name: `${clientName} – ${dateFrom.toLocaleDateString("pl-PL")}`,
        eventType: "INNE",
        clientName,
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
