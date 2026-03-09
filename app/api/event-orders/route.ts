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
    dateFrom: dateFrom ?? new Date(),
    dateTo: dateTo ?? new Date(),
    status: ["DRAFT", "CONFIRMED", "DONE", "CANCELLED"].includes(String(b.status ?? "")) ? String(b.status) : "DRAFT",
    notes: b.notes != null ? String(b.notes) : null,
    depositAmount: typeof b.depositAmount === "number" ? b.depositAmount : (b.depositAmount != null ? parseFloat(String(b.depositAmount)) : null),
    depositPaid: Boolean(b.depositPaid),
    isPoprawiny: Boolean(b.isPoprawiny),
    parentEventId: b.parentEventId != null ? String(b.parentEventId) : null,
    addPoprawiny: Boolean(b.addPoprawiny),
    poprawinyDate: b.poprawinyDate ? toDate(b.poprawinyDate) : null,
    poprawinyGuestCount: typeof b.poprawinyGuestCount === "number" ? b.poprawinyGuestCount : (b.poprawinyGuestCount != null ? parseInt(String(b.poprawinyGuestCount), 10) : null),
    menu: b.menu != null && typeof b.menu === "object" && !Array.isArray(b.menu) ? (b.menu as Prisma.InputJsonValue) : undefined,
  };
}

function parseRooms(roomName: string | null): string[] {
  if (!roomName?.trim()) return [];
  return roomName.split(/,\s*/).map((r) => r.trim()).filter(Boolean);
}

async function syncEventToGoogle(
  event: { id: string; clientName: string | null; clientPhone: string | null; eventType: string; roomName: string | null; timeStart: string | null; timeEnd: string | null; guestCount: number | null; status: string | null; notes: string | null; dateFrom: Date; dateTo: Date; depositAmount?: unknown; depositPaid?: boolean | null; isPoprawiny?: boolean | null },
  packageName: string | null,
  checklist: { docId: string },
  menu: { docId: string }
): Promise<{ calendarEventId: string; calId: string }[]> {
  const rooms = parseRooms(event.roomName);
  const depAmount = event.depositAmount != null ? (typeof event.depositAmount === "object" && event.depositAmount !== null && "toNumber" in event.depositAmount
    ? (event.depositAmount as { toNumber: () => number }).toNumber()
    : Number(event.depositAmount)) : null;
  const calPayload = {
    id: event.id,
    clientName: event.clientName,
    clientPhone: event.clientPhone,
    eventType: event.eventType,
    timeStart: event.timeStart,
    timeEnd: event.timeEnd,
    guestCount: event.guestCount,
    status: event.status,
    notes: event.notes,
    dateFrom: event.dateFrom,
    dateTo: event.dateTo,
    depositAmount: depAmount,
    depositPaid: event.depositPaid,
    isPoprawiny: event.isPoprawiny,
  };
  const results: { calendarEventId: string; calId: string }[] = [];
  const roomList = rooms.length > 0 ? rooms : (event.roomName ? [event.roomName] : []);
  for (const room of roomList) {
    const calId = getCalendarIdForEventOrder(event.eventType, room, event.isPoprawiny ?? false);
    const eventId = await createCalendarEvent(
      { ...calPayload, roomName: room },
      packageName,
      checklist.docId,
      menu.docId
    );
    results.push({ calendarEventId: eventId, calId });
  }
  return results;
}

function toCreateData(sanitized: ReturnType<typeof sanitizeEventData>): Prisma.EventOrderCreateInput {
  const { addPoprawiny, poprawinyDate, poprawinyGuestCount, menu, ...rest } = sanitized;
  const data: Prisma.EventOrderCreateInput = {
    ...rest,
    eventDate: sanitized.eventDate,
    depositAmount: sanitized.depositAmount != null ? new Prisma.Decimal(sanitized.depositAmount) : null,
    depositPaid: sanitized.depositPaid,
    isPoprawiny: sanitized.isPoprawiny,
    parentEventId: sanitized.parentEventId,
    ...(menu != null && { menu: menu as Prisma.InputJsonValue }),
  };
  return data;
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const clientName = data.clientName != null && String(data.clientName).trim() ? String(data.clientName).trim() : "Nowa impreza";
    const roomName = data.roomName != null && String(data.roomName).trim() ? String(data.roomName).trim() : "Do ustalenia";
    const payload = { ...data, clientName, roomName };
    if (!payload.dateFrom && !payload.eventDate) {
      return NextResponse.json(
        { error: "Brakuje wymaganego pola: dateFrom lub eventDate" },
        { status: 400 }
      );
    }
    const sanitized = sanitizeEventData(payload);
    if (!sanitized.dateFrom || !sanitized.dateTo) {
      return NextResponse.json({ error: "Nieprawidłowe daty" }, { status: 400 });
    }

    const addPoprawiny = Boolean(sanitized.addPoprawiny) && sanitized.eventType === "WESELE";
    const poprawinyDate = sanitized.poprawinyDate;
    const poprawinyGuestCount = sanitized.poprawinyGuestCount;

    const createMainEvent = async () => {
      const mainData = toCreateData({ ...sanitized, isPoprawiny: false, parentEventId: null });
      return prisma.eventOrder.create({ data: mainData });
    };

    let event = await createMainEvent();

    if (addPoprawiny && poprawinyDate) {
      const poprawinyDateFrom = poprawinyDate instanceof Date ? poprawinyDate : new Date(poprawinyDate);
      const poprawinyData = toCreateData({
        ...sanitized,
        name: `Poprawiny ${sanitized.clientName ?? ""} – ${poprawinyDateFrom.toLocaleDateString("pl-PL")}`,
        eventDate: poprawinyDateFrom,
        dateFrom: poprawinyDateFrom,
        dateTo: poprawinyDateFrom,
        guestCount: poprawinyGuestCount ?? sanitized.guestCount,
        isPoprawiny: true,
        parentEventId: event.id,
      });
      const poprawinyEvent = await prisma.eventOrder.create({
        data: poprawinyData,
      });

      let packageName: string | null = null;
      if (event.packageId) {
        const pkg = await prisma.package.findUnique({
          where: { id: event.packageId },
          select: { name: true },
        });
        packageName = pkg?.name ?? null;
      }

      try {
        const [mainChecklist, mainMenu, popChecklist, popMenu] = await Promise.all([
          createChecklistDoc(event),
          createMenuDoc({ ...event, packageName, packageId: event.packageId, cakesAndDesserts: event.cakesAndDesserts }),
          createChecklistDoc(poprawinyEvent),
          createMenuDoc({ ...poprawinyEvent, packageName: null, packageId: null, cakesAndDesserts: null }),
        ]);

        const mainResults = await syncEventToGoogle(
          { ...event, depositAmount: event.depositAmount, depositPaid: event.depositPaid, isPoprawiny: false },
          packageName,
          mainChecklist,
          mainMenu
        );
        const popResults = await syncEventToGoogle(
          { ...poprawinyEvent, depositAmount: null, depositPaid: false, isPoprawiny: true },
          null,
          popChecklist,
          popMenu
        );

        const mainFirst = mainResults[0];
        const mainRooms = parseRooms(event.roomName);
        const mainCalEvents = mainResults.map((r, i) => ({ roomName: mainRooms[i] ?? event.roomName, eventId: r.calendarEventId, calId: r.calId }));
        await prisma.eventOrder.update({
          where: { id: event.id },
          data: {
            googleCalendarEventId: mainFirst?.calendarEventId,
            googleCalendarCalId: mainFirst?.calId,
            googleCalendarEvents: mainCalEvents as unknown as Prisma.InputJsonValue,
            googleCalendarSynced: true,
            googleCalendarSyncedAt: new Date(),
            googleCalendarError: null,
            checklistDocId: mainChecklist.docId,
            checklistDocUrl: mainChecklist.docUrl,
            menuDocId: mainMenu.docId,
            menuDocUrl: mainMenu.docUrl,
          },
        });

        const popFirst = popResults[0];
        const popCalEvents = popResults.map((r, i) => ({ roomName: parseRooms(poprawinyEvent.roomName)[i] ?? poprawinyEvent.roomName, eventId: r.calendarEventId, calId: r.calId }));
        await prisma.eventOrder.update({
          where: { id: poprawinyEvent.id },
          data: {
            googleCalendarEventId: popFirst?.calendarEventId,
            googleCalendarCalId: popFirst?.calId,
            googleCalendarEvents: popCalEvents as unknown as Prisma.InputJsonValue,
            googleCalendarSynced: true,
            googleCalendarSyncedAt: new Date(),
            googleCalendarError: null,
            checklistDocId: popChecklist.docId,
            checklistDocUrl: popChecklist.docUrl,
            menuDocId: popMenu.docId,
            menuDocUrl: popMenu.docUrl,
          },
        });

        return NextResponse.json(event, { status: 201 });
      } catch (err) {
        console.error("Google API error (wesele+poprawiny):", err);
        return NextResponse.json({ ...event, googlePending: true }, { status: 201 });
      }
    }

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

      const results = await syncEventToGoogle(
        { ...event, depositAmount: event.depositAmount, depositPaid: event.depositPaid, isPoprawiny: event.isPoprawiny },
        packageName,
        checklist,
        menu
      );

      const first = results[0];
      const calEvents = parseRooms(event.roomName).map((room, i) => ({
        roomName: room,
        eventId: results[i]?.calendarEventId,
        calId: results[i]?.calId,
      }));

      const updated = await prisma.eventOrder.update({
        where: { id: event.id },
        data: {
          googleCalendarEventId: first?.calendarEventId,
          googleCalendarCalId: first?.calId,
          googleCalendarEvents: (results.length > 1 ? calEvents : undefined) as unknown as Prisma.InputJsonValue | undefined,
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

const FULL_SELECT = {
  id: true,
  eventType: true,
  clientName: true,
  clientPhone: true,
  eventDate: true,
  dateFrom: true,
  dateTo: true,
  timeStart: true,
  timeEnd: true,
  guestCount: true,
  adultsCount: true,
  children03: true,
  children47: true,
  orchestraCount: true,
  cameramanCount: true,
  photographerCount: true,
  churchTime: true,
  brideGroomTable: true,
  orchestraTable: true,
  packageId: true,
  cakesAndDesserts: true,
  cakeOrderedAt: true,
  cakeArrivalTime: true,
  cakeServedAt: true,
  drinksArrival: true,
  drinksStorage: true,
  champagneStorage: true,
  firstBottlesBy: true,
  alcoholAtTeamTable: true,
  cakesSwedishTable: true,
  fruitsSwedishTable: true,
  ownFlowers: true,
  ownVases: true,
  decorationColor: true,
  placeCards: true,
  placeCardsLayout: true,
  tableLayout: true,
  breadWelcomeBy: true,
  extraAttractions: true,
  specialRequests: true,
  facebookConsent: true,
  ownNapkins: true,
  dutyPerson: true,
  afterpartyEnabled: true,
  afterpartyTimeFrom: true,
  afterpartyTimeTo: true,
  afterpartyGuests: true,
  afterpartyMenu: true,
  afterpartyMusic: true,
  status: true,
  roomName: true,
  depositAmount: true,
  depositPaid: true,
  notes: true,
  isPoprawiny: true,
  parentEventId: true,
  menu: true,
  quoteId: true,
  roomIds: true,
  checklistDocId: true,
  menuDocId: true,
  googleCalendarEventId: true,
  googleCalendarCalId: true,
  googleCalendarSynced: true,
  googleCalendarSyncedAt: true,
  googleCalendarError: true,
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const upcoming = searchParams.get("upcoming");
    const status = searchParams.get("status");
    const all = searchParams.get("all") === "1";

    const where = all
      ? {}
      : {
          ...(status ? { status } : { status: { not: "CANCELLED" as const } }),
          ...(upcoming === "1" ? { dateFrom: { gte: new Date() } } : {}),
        };

    const events = await prisma.eventOrder.findMany({
      where,
      select: all ? FULL_SELECT : {
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

    return NextResponse.json(events, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Błąd pobierania imprez";
    const errStack = e instanceof Error ? e.stack : undefined;
    console.error("GET /api/event-orders:", e);
    return NextResponse.json(
      { error: errMsg, ...(process.env.NODE_ENV === "development" && errStack ? { debug: errStack } : {}) },
      { status: 500 }
    );
  }
}
