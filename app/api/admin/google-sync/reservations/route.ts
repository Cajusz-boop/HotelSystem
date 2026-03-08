import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import {
  createCalendarEvent,
  updateCalendarEvent,
} from "@/lib/googleCalendarReservations";
import { getCalendarIdForEvent } from "@/lib/calendarMapping";

/**
 * POST /api/admin/google-sync/reservations?force=true
 * Masowa synchronizacja rezerwacji do Google Calendar.
 * force=true: sync wszystkich (w tym już zsynkowanych).
 * force=false: tylko rezerwacje bez googleCalendarEventId lub z googleCalendarSynced=false.
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
    ? { status: { notIn: ["CANCELLED", "NO_SHOW"] } }
    : {
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        OR: [
          { googleCalendarEventId: null },
          { googleCalendarSynced: false },
        ],
      };

  const reservations = await prisma.reservation.findMany({
    where,
    include: { guest: true, room: true },
  });

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const r of reservations) {
    const payload = {
      id: r.id,
      guest: r.guest,
      room: r.room,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      pax: r.pax,
      adults: r.adults,
      children: r.children,
      notes: r.notes,
      internalNotes: r.internalNotes,
      status: r.status,
      tripPurpose: r.tripPurpose,
    };
    const eventType = (r.tripPurpose ?? "CATERING") as string;

    try {
      if (r.googleCalendarEventId && r.googleCalendarCalId) {
        await updateCalendarEvent(payload, r.googleCalendarEventId, r.googleCalendarCalId);
        await prisma.reservation.update({
          where: { id: r.id },
          data: {
            googleCalendarSynced: true,
            googleCalendarSyncedAt: new Date(),
            googleCalendarError: null,
          },
        });
        updated++;
      } else {
        const eventId = await createCalendarEvent(payload, eventType);
        const calId = getCalendarIdForEvent(eventType);
        await prisma.reservation.update({
          where: { id: r.id },
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
    } catch (e) {
      await prisma.reservation
        .update({
          where: { id: r.id },
          data: {
            googleCalendarSynced: false,
            googleCalendarError: e instanceof Error ? e.message : String(e),
          },
        })
        .catch(() => {});
      errors++;
    }
  }

  return NextResponse.json({
    total: reservations.length,
    created,
    updated,
    errors,
  });
}
