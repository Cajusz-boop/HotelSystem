/**
 * Przetwarzanie zdarzeń z webhooka Google Calendar → aktualizacja rezerwacji w bazie.
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

function extractLabedzId(description: string | null | undefined): string | null {
  if (!description) return null;
  const m = description.match(/\[LABEDZ_ID:([a-z0-9_-]+)\]/i);
  return m ? m[1] : null;
}

export async function processCalendarEvent(
  event: GCalEvent,
  calendarId: string
): Promise<void> {
  const labedzId = extractLabedzId(event.description);
  const guestName = (event.summary || "Gość z GCal").split("—")[0].trim() || "Gość z GCal";

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

  if (labedzId) {
    const res = await prisma.reservation.findUnique({
      where: { id: labedzId },
      select: { id: true, googleCalendarUpdatedAt: true },
    });

    if (!res) return;

    const gcalUpdated = eventUpdated ? eventUpdated.getTime() : 0;
    const dbUpdated = res.googleCalendarUpdatedAt
      ? res.googleCalendarUpdatedAt.getTime()
      : 0;

    if (event.status === "cancelled") {
      await prisma.reservation.update({
        where: { id: labedzId },
        data: {
          status: "CANCELLED",
          googleAttachments: attachments as object,
          googleCalendarUpdatedAt: eventUpdated ?? new Date(),
        },
      });
      return;
    }

    if (gcalUpdated <= dbUpdated) return;

    const updateData: {
      checkIn?: Date;
      checkOut?: Date;
      notes?: string | null;
      status?: "PENDING" | "CONFIRMED" | "CANCELLED" | "CHECKED_IN" | "CHECKED_OUT" | "NO_SHOW" | "GUARANTEED" | "WAITLIST";
      googleAttachments?: object;
      googleCalendarUpdatedAt?: Date;
    } = {};

    if (dateFrom) updateData.checkIn = dateFrom;
    if (dateTo) updateData.checkOut = dateTo;
    if (event.description) updateData.notes = event.description;
    updateData.googleAttachments = attachments as object;
    updateData.googleCalendarUpdatedAt = eventUpdated ?? new Date();

    await prisma.reservation.update({
      where: { id: labedzId },
      data: updateData,
    });
  } else {
    if (!dateFrom || !dateTo) return;

    const defaultRoom = await prisma.room.findFirst({
      where: { activeForSale: true, isDeleted: false },
      select: { id: true },
    });
    if (!defaultRoom) return;

    const guest = await prisma.guest.create({
      data: {
        name: guestName,
        guestType: "INDIVIDUAL",
      },
    });

    const confirmationNumber = `GC${Date.now().toString(36).toUpperCase().slice(-6)}`;
    await prisma.reservation.create({
      data: {
        guestId: guest.id,
        roomId: defaultRoom.id,
        checkIn: dateFrom,
        checkOut: dateTo,
        status: "PENDING",
        source: "WEBSITE",
        channel: "DIRECT",
        confirmationNumber,
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
