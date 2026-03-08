import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createChecklistDoc, createMenuDoc } from "@/lib/googleDocs";
import { createCalendarEvent } from "@/lib/googleCalendarEvents";
import { getCalendarIdForEventOrder } from "@/lib/calendarMapping";

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

  return {
    name: String(b.name ?? (b.clientName ? `${b.clientName} – ${eventDate?.toLocaleDateString("pl-PL") ?? ""}` : "Impreza")),
    eventType: EVENT_TYPES.includes(String(b.eventType ?? "")) ? String(b.eventType) : "INNE",
    clientName: b.clientName != null ? String(b.clientName) : null,
    clientPhone: b.clientPhone != null ? String(b.clientPhone) : null,
    eventDate: eventDate,
    timeStart: b.timeStart != null ? String(b.timeStart) : null,
    timeEnd: b.timeEnd != null ? String(b.timeEnd) : null,
    roomName: b.roomName != null ? String(b.roomName) : null,
    guestCount: typeof b.guestCount === "number" ? b.guestCount : (b.guestCount != null ? parseInt(String(b.guestCount), 10) : null),
    adultsCount: typeof b.adultsCount === "number" ? b.adultsCount : (b.adultsCount != null ? parseInt(String(b.adultsCount), 10) : null),
    children03: typeof b.children03 === "number" ? b.children03 : (b.children03 != null ? parseInt(String(b.children03), 10) : null),
    children47: typeof b.children47 === "number" ? b.children47 : (b.children47 != null ? parseInt(String(b.children47), 10) : null),
    orchestraCount: typeof b.orchestraCount === "number" ? b.orchestraCount : (b.orchestraCount != null ? parseInt(String(b.orchestraCount), 10) : null),
    cameramanCount: typeof b.cameramanCount === "number" ? b.cameramanCount : (b.cameramanCount != null ? parseInt(String(b.cameramanCount), 10) : null),
    photographerCount: typeof b.photographerCount === "number" ? b.photographerCount : (b.photographerCount != null ? parseInt(String(b.photographerCount), 10) : null),
    churchTime: b.churchTime != null ? String(b.churchTime) : null,
    brideGroomTable: b.brideGroomTable != null ? String(b.brideGroomTable) : null,
    orchestraTable: b.orchestraTable != null ? String(b.orchestraTable) : null,
    packageId: b.packageId != null ? String(b.packageId) : null,
    cakesAndDesserts: b.cakesAndDesserts != null ? String(b.cakesAndDesserts) : null,
    cakeOrderedAt: b.cakeOrderedAt != null ? String(b.cakeOrderedAt) : null,
    cakeArrivalTime: b.cakeArrivalTime != null ? String(b.cakeArrivalTime) : null,
    cakeServedAt: b.cakeServedAt != null ? String(b.cakeServedAt) : null,
    drinksArrival: b.drinksArrival != null ? String(b.drinksArrival) : null,
    drinksStorage: b.drinksStorage != null ? String(b.drinksStorage) : null,
    champagneStorage: b.champagneStorage != null ? String(b.champagneStorage) : null,
    alcoholUnderStairs: Boolean(b.alcoholUnderStairs),
    firstBottlesBy: b.firstBottlesBy != null ? String(b.firstBottlesBy) : null,
    coolersWithIce: b.coolersWithIce != null ? String(b.coolersWithIce) : null,
    alcoholServiceBy: b.alcoholServiceBy != null ? String(b.alcoholServiceBy) : null,
    wineLocation: b.wineLocation != null ? String(b.wineLocation) : null,
    beerWhen: b.beerWhen != null ? String(b.beerWhen) : null,
    alcoholAtTeamTable: Boolean(b.alcoholAtTeamTable),
    cakesSwedishTable: Boolean(b.cakesSwedishTable),
    fruitsSwedishTable: Boolean(b.fruitsSwedishTable),
    ownFlowers: Boolean(b.ownFlowers),
    ownVases: Boolean(b.ownVases),
    decorationColor: b.decorationColor != null ? String(b.decorationColor) : null,
    placeCards: Boolean(b.placeCards),
    placeCardsLayout: b.placeCardsLayout != null ? String(b.placeCardsLayout) : null,
    tableLayout: b.tableLayout != null ? String(b.tableLayout) : null,
    breadWelcomeBy: b.breadWelcomeBy != null ? String(b.breadWelcomeBy) : null,
    extraAttractions: b.extraAttractions != null ? String(b.extraAttractions) : null,
    specialRequests: b.specialRequests != null ? String(b.specialRequests) : null,
    facebookConsent: Boolean(b.facebookConsent),
    ownNapkins: Boolean(b.ownNapkins),
    dutyPerson: b.dutyPerson != null ? String(b.dutyPerson) : null,
    afterpartyEnabled: Boolean(b.afterpartyEnabled),
    afterpartyTimeFrom: b.afterpartyTimeFrom != null ? String(b.afterpartyTimeFrom) : null,
    afterpartyTimeTo: b.afterpartyTimeTo != null ? String(b.afterpartyTimeTo) : null,
    afterpartyGuests: typeof b.afterpartyGuests === "number" ? b.afterpartyGuests : (b.afterpartyGuests != null ? parseInt(String(b.afterpartyGuests), 10) : null),
    afterpartyMenu: b.afterpartyMenu != null ? String(b.afterpartyMenu) : null,
    afterpartyMusic: b.afterpartyMusic != null ? String(b.afterpartyMusic) : null,
    quoteId: b.quoteId != null ? String(b.quoteId) : null,
    roomIds: Array.isArray(b.roomIds) ? b.roomIds : null,
    dateFrom: dateFrom ?? new Date(),
    dateTo: dateTo ?? new Date(),
    status: ["DRAFT", "CONFIRMED", "DONE", "CANCELLED"].includes(String(b.status ?? "")) ? String(b.status) : "DRAFT",
    notes: b.notes != null ? String(b.notes) : null,
  };
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    if (!data.clientName || !data.roomName) {
      return NextResponse.json(
        { error: "Brakuje wymaganych pól: clientName, roomName" },
        { status: 400 }
      );
    }
    if (!data.dateFrom && !data.eventDate) {
      return NextResponse.json(
        { error: "Brakuje wymaganego pola: dateFrom lub eventDate" },
        { status: 400 }
      );
    }
    const sanitized = sanitizeEventData(data);
    if (!sanitized.dateFrom || !sanitized.dateTo) {
      return NextResponse.json({ error: "Nieprawidłowe daty" }, { status: 400 });
    }

    const event = await prisma.eventOrder.create({
      data: {
        ...sanitized,
        eventDate: sanitized.eventDate,
        roomIds: sanitized.roomIds === null ? Prisma.JsonNull : (sanitized.roomIds as Prisma.InputJsonValue),
      },
    });

    try {
      let packageName: string | null = null;
      if (event.packageId) {
        const pkg = await prisma.package.findUnique({
          where: { id: event.packageId },
          select: { name: true },
        });
        packageName = pkg?.name ?? null;
      }
      const [checklist, menu] = await Promise.all([
        createChecklistDoc(event),
        createMenuDoc({
          ...event,
          packageName,
          packageId: event.packageId,
          cakesAndDesserts: event.cakesAndDesserts,
        }),
      ]);

      const calendarEventId = await createCalendarEvent(
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
        packageName,
        checklist.docId,
        menu.docId
      );
      const calId = getCalendarIdForEventOrder(event.eventType, event.roomName);

      const updated = await prisma.eventOrder.update({
        where: { id: event.id },
        data: {
          googleCalendarEventId: calendarEventId,
          googleCalendarCalId: calId,
          googleCalendarSynced: true,
          googleCalendarSyncedAt: new Date(),
          googleCalendarError: null,
          checklistDocId: checklist.docId,
          checklistDocUrl: checklist.docUrl,
          menuDocId: menu.docId,
          menuDocUrl: menu.docUrl,
        },
      });

      return NextResponse.json(updated, { status: 201 });
    } catch (err) {
      console.error("Google API error:", err);
      try {
        await prisma.eventOrder.update({
          where: { id: event.id },
          data: {
            googleCalendarSynced: false,
            googleCalendarError: err instanceof Error ? err.message : String(err),
          },
        });
      } catch (updateErr) {
        console.error("Nie udało się zapisać błędu Google do bazy:", updateErr);
      }
      return NextResponse.json(
        { ...event, googlePending: true },
        { status: 201 }
      );
    }
  } catch (e) {
    console.error("POST /api/event-orders:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd tworzenia imprezy" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const upcoming = searchParams.get("upcoming");
    const status = searchParams.get("status");

    const events = await prisma.eventOrder.findMany({
      where: {
        ...(status ? { status } : { status: { not: "CANCELLED" } }),
        ...(upcoming === "1" ? { dateFrom: { gte: new Date() } } : {}),
      },
      select: {
        id: true,
        eventType: true,
        clientName: true,
        dateFrom: true,
        dateTo: true,
        guestCount: true,
        status: true,
        packageId: true,
        roomName: true,
      },
      orderBy: { dateFrom: "asc" },
    });

    return NextResponse.json(events);
  } catch (e) {
    console.error("GET /api/event-orders:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd pobierania imprez" },
      { status: 500 }
    );
  }
}
