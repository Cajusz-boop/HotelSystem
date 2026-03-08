import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateChecklistDoc } from "@/lib/googleDocs";
import {
  updateCalendarEvent,
  cancelCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/googleCalendarEvents";

const EVENT_TYPES = ["WESELE", "KOMUNIA", "CHRZCINY", "URODZINY", "STYPA", "FIRMOWA", "SYLWESTER", "INNE"];

function sanitizeEventData(body: Record<string, unknown>) {
  const b = body as Record<string, unknown>;
  const toDate = (v: unknown): Date | null => {
    if (v instanceof Date) return v;
    if (typeof v === "string") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };
  const dateFrom = toDate(b.dateFrom);
  const dateTo = toDate(b.dateTo);
  const eventDate = b.eventDate ? toDate(b.eventDate) : dateFrom;

  const base: Record<string, unknown> = {};
  if (b.name != null) base.name = String(b.name);
  if (b.eventType != null && EVENT_TYPES.includes(String(b.eventType))) base.eventType = b.eventType;
  if (b.clientName !== undefined) base.clientName = b.clientName != null ? String(b.clientName) : null;
  if (b.clientPhone !== undefined) base.clientPhone = b.clientPhone != null ? String(b.clientPhone) : null;
  if (b.eventDate !== undefined) base.eventDate = eventDate;
  if (b.timeStart !== undefined) base.timeStart = b.timeStart != null ? String(b.timeStart) : null;
  if (b.timeEnd !== undefined) base.timeEnd = b.timeEnd != null ? String(b.timeEnd) : null;
  if (b.roomName !== undefined) base.roomName = b.roomName != null ? String(b.roomName) : null;
  if (b.guestCount !== undefined) base.guestCount = typeof b.guestCount === "number" ? b.guestCount : (b.guestCount != null ? parseInt(String(b.guestCount), 10) : null);
  if (b.adultsCount !== undefined) base.adultsCount = typeof b.adultsCount === "number" ? b.adultsCount : (b.adultsCount != null ? parseInt(String(b.adultsCount), 10) : null);
  if (b.children03 !== undefined) base.children03 = typeof b.children03 === "number" ? b.children03 : (b.children03 != null ? parseInt(String(b.children03), 10) : null);
  if (b.children47 !== undefined) base.children47 = typeof b.children47 === "number" ? b.children47 : (b.children47 != null ? parseInt(String(b.children47), 10) : null);
  if (b.orchestraCount !== undefined) base.orchestraCount = typeof b.orchestraCount === "number" ? b.orchestraCount : (b.orchestraCount != null ? parseInt(String(b.orchestraCount), 10) : null);
  if (b.cameramanCount !== undefined) base.cameramanCount = typeof b.cameramanCount === "number" ? b.cameramanCount : (b.cameramanCount != null ? parseInt(String(b.cameramanCount), 10) : null);
  if (b.photographerCount !== undefined) base.photographerCount = typeof b.photographerCount === "number" ? b.photographerCount : (b.photographerCount != null ? parseInt(String(b.photographerCount), 10) : null);
  if (b.churchTime !== undefined) base.churchTime = b.churchTime != null ? String(b.churchTime) : null;
  if (b.brideGroomTable !== undefined) base.brideGroomTable = b.brideGroomTable != null ? String(b.brideGroomTable) : null;
  if (b.orchestraTable !== undefined) base.orchestraTable = b.orchestraTable != null ? String(b.orchestraTable) : null;
  if (b.packageId !== undefined) base.packageId = b.packageId != null ? String(b.packageId) : null;
  if (b.cakesAndDesserts !== undefined) base.cakesAndDesserts = b.cakesAndDesserts != null ? String(b.cakesAndDesserts) : null;
  if (b.cakeOrderedAt !== undefined) base.cakeOrderedAt = b.cakeOrderedAt != null ? String(b.cakeOrderedAt) : null;
  if (b.cakeArrivalTime !== undefined) base.cakeArrivalTime = b.cakeArrivalTime != null ? String(b.cakeArrivalTime) : null;
  if (b.cakeServedAt !== undefined) base.cakeServedAt = b.cakeServedAt != null ? String(b.cakeServedAt) : null;
  if (b.drinksArrival !== undefined) base.drinksArrival = b.drinksArrival != null ? String(b.drinksArrival) : null;
  if (b.drinksStorage !== undefined) base.drinksStorage = b.drinksStorage != null ? String(b.drinksStorage) : null;
  if (b.champagneStorage !== undefined) base.champagneStorage = b.champagneStorage != null ? String(b.champagneStorage) : null;
  if (b.alcoholUnderStairs !== undefined) base.alcoholUnderStairs = Boolean(b.alcoholUnderStairs);
  if (b.firstBottlesBy !== undefined) base.firstBottlesBy = b.firstBottlesBy != null ? String(b.firstBottlesBy) : null;
  if (b.coolersWithIce !== undefined) base.coolersWithIce = b.coolersWithIce != null ? String(b.coolersWithIce) : null;
  if (b.alcoholServiceBy !== undefined) base.alcoholServiceBy = b.alcoholServiceBy != null ? String(b.alcoholServiceBy) : null;
  if (b.wineLocation !== undefined) base.wineLocation = b.wineLocation != null ? String(b.wineLocation) : null;
  if (b.beerWhen !== undefined) base.beerWhen = b.beerWhen != null ? String(b.beerWhen) : null;
  if (b.alcoholAtTeamTable !== undefined) base.alcoholAtTeamTable = Boolean(b.alcoholAtTeamTable);
  if (b.cakesSwedishTable !== undefined) base.cakesSwedishTable = Boolean(b.cakesSwedishTable);
  if (b.fruitsSwedishTable !== undefined) base.fruitsSwedishTable = Boolean(b.fruitsSwedishTable);
  if (b.ownFlowers !== undefined) base.ownFlowers = Boolean(b.ownFlowers);
  if (b.ownVases !== undefined) base.ownVases = Boolean(b.ownVases);
  if (b.decorationColor !== undefined) base.decorationColor = b.decorationColor != null ? String(b.decorationColor) : null;
  if (b.placeCards !== undefined) base.placeCards = Boolean(b.placeCards);
  if (b.placeCardsLayout !== undefined) base.placeCardsLayout = b.placeCardsLayout != null ? String(b.placeCardsLayout) : null;
  if (b.tableLayout !== undefined) base.tableLayout = b.tableLayout != null ? String(b.tableLayout) : null;
  if (b.breadWelcomeBy !== undefined) base.breadWelcomeBy = b.breadWelcomeBy != null ? String(b.breadWelcomeBy) : null;
  if (b.extraAttractions !== undefined) base.extraAttractions = b.extraAttractions != null ? String(b.extraAttractions) : null;
  if (b.specialRequests !== undefined) base.specialRequests = b.specialRequests != null ? String(b.specialRequests) : null;
  if (b.facebookConsent !== undefined) base.facebookConsent = Boolean(b.facebookConsent);
  if (b.ownNapkins !== undefined) base.ownNapkins = Boolean(b.ownNapkins);
  if (b.dutyPerson !== undefined) base.dutyPerson = b.dutyPerson != null ? String(b.dutyPerson) : null;
  if (b.afterpartyEnabled !== undefined) base.afterpartyEnabled = Boolean(b.afterpartyEnabled);
  if (b.afterpartyTimeFrom !== undefined) base.afterpartyTimeFrom = b.afterpartyTimeFrom != null ? String(b.afterpartyTimeFrom) : null;
  if (b.afterpartyTimeTo !== undefined) base.afterpartyTimeTo = b.afterpartyTimeTo != null ? String(b.afterpartyTimeTo) : null;
  if (b.afterpartyGuests !== undefined) base.afterpartyGuests = typeof b.afterpartyGuests === "number" ? b.afterpartyGuests : (b.afterpartyGuests != null ? parseInt(String(b.afterpartyGuests), 10) : null);
  if (b.afterpartyMenu !== undefined) base.afterpartyMenu = b.afterpartyMenu != null ? String(b.afterpartyMenu) : null;
  if (b.afterpartyMusic !== undefined) base.afterpartyMusic = b.afterpartyMusic != null ? String(b.afterpartyMusic) : null;
  if (b.quoteId !== undefined) base.quoteId = b.quoteId != null ? String(b.quoteId) : null;
  if (b.roomIds !== undefined) base.roomIds = Array.isArray(b.roomIds) ? b.roomIds : null;
  if (dateFrom != null) base.dateFrom = dateFrom;
  if (dateTo != null) base.dateTo = dateTo;
  if (b.status != null && ["DRAFT", "CONFIRMED", "DONE", "CANCELLED"].includes(String(b.status))) base.status = b.status;
  if (b.notes !== undefined) base.notes = b.notes != null ? String(b.notes) : null;

  return base;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await req.json();
    const status = data?.status;
    if (status === "CANCELLED") {
      const event = await prisma.eventOrder.findUnique({
        where: { id },
        select: { googleCalendarEventId: true, googleCalendarCalId: true },
      });
      if (event?.googleCalendarEventId && event?.googleCalendarCalId) {
        try {
          await cancelCalendarEvent(event.googleCalendarEventId, event.googleCalendarCalId);
          await prisma.eventOrder.update({
            where: { id },
            data: { status: "CANCELLED", googleCalendarSynced: true, googleCalendarSyncedAt: new Date(), googleCalendarError: null },
          });
        } catch (err) {
          console.error("Google cancel error:", err);
          await prisma.eventOrder.update({
            where: { id },
            data: { status: "CANCELLED", googleCalendarSynced: false, googleCalendarError: err instanceof Error ? err.message : String(err) },
          });
        }
      } else {
        await prisma.eventOrder.update({ where: { id }, data: { status: "CANCELLED" } });
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "PATCH obsługuje tylko status=CANCELLED" }, { status: 400 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2025") {
      return NextResponse.json({ error: "Impreza nie istnieje" }, { status: 404 });
    }
    console.error("PATCH /api/event-orders/[id]:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await req.json();
    const sanitized = sanitizeEventData(data);
    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: "Brak danych do aktualizacji" }, { status: 400 });
    }

    const event = await prisma.eventOrder.update({
      where: { id },
      data: {
        ...sanitized,
        eventDate: sanitized.eventDate as Date | undefined,
        roomIds: sanitized.roomIds as object | undefined,
      },
    });

    let packageName: string | null = null;
    if (event.packageId) {
      const pkg = await prisma.package.findUnique({
        where: { id: event.packageId },
        select: { name: true },
      });
      packageName = pkg?.name ?? null;
    }

    await Promise.all([
      event.checklistDocId
        ? updateChecklistDoc(event.checklistDocId, event)
        : Promise.resolve(),
      event.googleCalendarEventId && event.googleCalendarCalId
        ? (() => {
            if (event.status === "CANCELLED") {
              return cancelCalendarEvent(event.googleCalendarEventId!, event.googleCalendarCalId!);
            }
            return updateCalendarEvent(
              {
                id: event.id,
                clientName: event.clientName,
                clientPhone: event.clientPhone,
                eventType: event.eventType,
                roomName: event.roomName,
                timeStart: event.timeStart,
                timeEnd: event.timeEnd,
                guestCount: event.guestCount,
                packageId: event.packageId,
                status: event.status,
                notes: event.notes,
                dateFrom: event.dateFrom,
                dateTo: event.dateTo,
              },
              event.googleCalendarEventId,
              event.googleCalendarCalId,
              packageName
            );
          })()
        : Promise.resolve(),
    ]).catch(async (err) => {
      console.error("Google update error:", err);
      await prisma.eventOrder
        .update({
          where: { id },
          data: {
            googleCalendarSynced: false,
            googleCalendarError: err instanceof Error ? err.message : String(err),
          },
        })
        .catch(() => {});
    });

    if (event.googleCalendarEventId && event.googleCalendarCalId && event.status !== "CANCELLED") {
      await prisma.eventOrder
        .update({
          where: { id },
          data: { googleCalendarSynced: true, googleCalendarSyncedAt: new Date(), googleCalendarError: null },
        })
        .catch(() => {});
    }

    return NextResponse.json(event);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2025") {
      return NextResponse.json({ error: "Impreza nie istnieje" }, { status: 404 });
    }
    console.error("PUT /api/event-orders/[id]:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd aktualizacji" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await prisma.eventOrder.findUnique({
      where: { id },
      select: { googleCalendarEventId: true, googleCalendarCalId: true },
    });
    if (event?.googleCalendarEventId && event?.googleCalendarCalId) {
      try {
        await deleteCalendarEvent(event.googleCalendarEventId, event.googleCalendarCalId);
      } catch (err) {
        console.error("Google delete error:", err);
      }
    }
    await prisma.eventOrder.delete({
      where: { id },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2025") {
      return NextResponse.json({ error: "Impreza nie istnieje" }, { status: 404 });
    }
    console.error("DELETE /api/event-orders/[id]:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd usuwania" },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await prisma.eventOrder.findUnique({
      where: { id },
    });
    if (!event) {
      return NextResponse.json({ error: "Impreza nie istnieje" }, { status: 404 });
    }
    return NextResponse.json(event);
  } catch (e) {
    console.error("GET /api/event-orders/[id]:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd pobierania" },
      { status: 500 }
    );
  }
}
