/**
 * Import wydarzenia z kalendarza Google (wstępna rezerwacja) do EventOrder.
 * POST body: { eventId: string, calId: string }.
 * Jeśli w opisie jest [LABEDZ_EVENT_ID:id], zwraca { existingId }; w przeciwnym razie tworzy EventOrder i zwraca { id }.
 */
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuthClient } from "@/lib/googleAuth";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

function parseGCalDate(start: { date?: string | null; dateTime?: string | null } | null | undefined): Date | null {
  if (!start) return null;
  const raw = start.date ?? start.dateTime;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function extractLabedzEventId(description: string | null | undefined): string | null {
  if (!description) return null;
  const m = description.match(/\[LABEDZ_EVENT_ID:([a-z0-9_-]+)\]/i);
  return m ? m[1] : null;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json() as { eventId?: string; calId?: string };
    const eventId = body?.eventId;
    const calId = body?.calId;
    if (!eventId || !calId) {
      return NextResponse.json(
        { error: "Wymagane pola: eventId, calId" },
        { status: 400 }
      );
    }

    const wstepnaId = process.env.GOOGLE_CALENDAR_WSTEPNA_REZERWACJA?.trim();
    if (wstepnaId && calId !== wstepnaId) {
      return NextResponse.json(
        { error: "Import tylko z kalendarza wstępna rezerwacja" },
        { status: 400 }
      );
    }

    const auth = getGoogleAuthClient();
    const calendar = google.calendar({ version: "v3", auth });
    const res = await calendar.events.get({
      calendarId: calId,
      eventId,
    });
    const ev = res.data;
    if (!ev || ev.status === "cancelled") {
      return NextResponse.json({ error: "Wydarzenie nie istnieje lub jest anulowane" }, { status: 404 });
    }

    const description = ev.description ?? null;
    const existingLabedzId = extractLabedzEventId(description);
    if (existingLabedzId) {
      const exists = await prisma.eventOrder.findUnique({
        where: { id: existingLabedzId },
        select: { id: true },
      });
      if (exists) {
        return NextResponse.json({ existingId: exists.id });
      }
    }

    const start = ev.start;
    const end = ev.end;
    const dateFrom = parseGCalDate(start);
    const dateTo = parseGCalDate(end) ?? dateFrom;
    if (!dateFrom) {
      return NextResponse.json({ error: "Brak daty w wydarzeniu" }, { status: 400 });
    }
    const fromDate: Date = dateFrom;
    const toDate: Date = dateTo ?? fromDate;

    const summary = (ev.summary ?? "").trim() || "Zaimportowane z GCal";
    const name = summary.length > 200 ? `${summary.slice(0, 197)}...` : summary;

    const created = await prisma.eventOrder.create({
      data: {
        name,
        clientName: summary.length <= 200 ? summary : null,
        roomName: "Do ustalenia",
        eventDate: fromDate,
        dateFrom: fromDate,
        dateTo: toDate,
        status: "DRAFT",
        googleCalendarEventId: eventId,
        googleCalendarCalId: calId,
        googleCalendarSynced: true,
        googleCalendarSyncedAt: new Date(),
        googleCalendarError: null,
        eventType: "INNE",
      },
    });

    const year = new Date().getFullYear();
    const count = await prisma.eventOrder.count({
      where: { eventType: "INNE", createdAt: { gte: new Date(`${year}-01-01`) } },
    });
    await prisma.eventOrder.update({
      where: { id: created.id },
      data: { eventNumber: `I-${year}-${String(count).padStart(3, "0")}` },
    });

    try {
      await createAuditLog({
        actionType: "CREATE",
        entityType: "EventOrder",
        entityId: created.id,
        oldValue: null,
        newValue: { id: created.id, source: "import-from-gcal", gcalEventId: eventId, gcalCalId: calId } as Record<string, unknown>,
      });
    } catch (e) {
      console.error("AuditLog EventOrder import-from-gcal:", e);
    }

    return NextResponse.json({ id: created.id });
  } catch (e) {
    const err = e as { code?: number; status?: number; message?: string };
    if (err?.code === 404 || err?.status === 404) {
      return NextResponse.json({ error: "Wydarzenie nie znalezione w Google Calendar" }, { status: 404 });
    }
    console.error("POST /api/event-orders/import-from-gcal:", e);
    return NextResponse.json(
      { error: err?.message ?? "Błąd importu z Google Calendar" },
      { status: 500 }
    );
  }
}
