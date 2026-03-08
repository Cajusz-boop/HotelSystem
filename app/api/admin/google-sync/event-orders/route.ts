import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import {
  createCalendarEvent,
  updateCalendarEvent,
} from "@/lib/googleCalendarEvents";
import { getCalendarIdForEventOrder } from "@/lib/calendarMapping";

/**
 * POST /api/admin/google-sync/event-orders?force=true
 * Masowa synchronizacja imprez (EventOrder) do Google Calendar.
 * force=true: sync wszystkich (w tym już zsynkowanych).
 * force=false: tylko imprezy bez googleCalendarEventId lub z googleCalendarSynced=false.
 * Wymaga: admin.settings
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  const where = force
    ? { status: { notIn: ["CANCELLED"] } }
    : {
        status: { notIn: ["CANCELLED"] },
        OR: [
          { googleCalendarEventId: null },
          { googleCalendarSynced: false },
        ],
      };

  const events = await prisma.eventOrder.findMany({
    where,
  });

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const e of events) {
    let packageName: string | null = null;
    if (e.packageId) {
      const pkg = await prisma.package.findUnique({
        where: { id: e.packageId },
        select: { name: true },
      });
      packageName = pkg?.name ?? null;
    }

    const payload = {
      id: e.id,
      clientName: e.clientName,
      clientPhone: e.clientPhone,
      eventType: e.eventType,
      roomName: e.roomName,
      timeStart: e.timeStart,
      timeEnd: e.timeEnd,
      guestCount: e.guestCount,
      packageId: e.packageId,
      status: e.status,
      notes: e.notes,
      dateFrom: e.dateFrom,
      dateTo: e.dateTo,
    };

    try {
      if (e.googleCalendarEventId && e.googleCalendarCalId) {
        await updateCalendarEvent(payload, e.googleCalendarEventId, e.googleCalendarCalId, packageName);
        await prisma.eventOrder.update({
          where: { id: e.id },
          data: {
            googleCalendarSynced: true,
            googleCalendarSyncedAt: new Date(),
            googleCalendarError: null,
          },
        });
        updated++;
      } else {
        const eventId = await createCalendarEvent(
          payload,
          packageName,
          e.checklistDocId,
          e.menuDocId
        );
        const calId = getCalendarIdForEventOrder(e.eventType, e.roomName);
        await prisma.eventOrder.update({
          where: { id: e.id },
          data: {
            googleCalendarEventId: eventId,
            googleCalendarCalId: calId,
            googleCalendarSynced: true,
            googleCalendarSyncedAt: new Date(),
            googleCalendarError: null,
          },
        });
        created++;
      }
    } catch (err) {
      await prisma.eventOrder
        .update({
          where: { id: e.id },
          data: {
            googleCalendarSynced: false,
            googleCalendarError: err instanceof Error ? err.message : String(err),
          },
        })
        .catch(() => {});
      errors++;
    }
  }

  return NextResponse.json({
    total: events.length,
    created,
    updated,
    errors,
  });
}
