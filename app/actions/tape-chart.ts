"use server";

import { ReservationStatus } from "@prisma/client";
import { computeRateCodePricePerNight } from "@/lib/rate-code-utils";
import { prisma } from "@/lib/db";
import { getEffectivePropertyId } from "@/app/actions/properties";
export interface TapeChartReservation {
  id: string;
  guestName: string;
  guestBlacklisted?: boolean;
  room: string;
  checkIn: string;
  checkOut: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: string;
  pax?: number;
  bedsBooked?: number;
  notes?: string;
  notesVisibleOnChart?: boolean;
  advanceDueDate?: string | null;
  paymentStatus?: "UNPAID" | "PARTIAL" | "PAID";
  rateCodeId?: string;
  rateCode?: string;
  rateCodeName?: string;
  rateCodePrice?: number;
  groupId?: string;
  groupName?: string;
  parkingSpotId?: string;
  parkingSpotNumber?: string;
  companyId?: string | null;
  companyName?: string | null;
  hasConsolidatedInvoice?: boolean;
  eventOrderId?: string | null;
  eventOrderType?: string | null;
  eventOrderClient?: string | null;
  eventOrderDate?: string | null;
  eventOrderStatus?: string | null;
  eventOrderDeposit?: number | null;
  eventOrderDepositPaid?: boolean;
}

export interface TapeChartRoom {
  id: string;
  number: string;
  type: string;
  status: string;
  floor?: string;
  price?: number;
  reason?: string;
  roomFeatures?: string[];
  beds?: number;
  blocks?: Array<{ id: string; startDate: string; endDate: string; reason?: string }>;
}

export interface TapeChartEvent {
  id: string;
  name: string;
  dateFrom: string;
  dateTo: string;
  color: string | null;
  description?: string | null;
}

export interface TapeChartData {
  reservations: TapeChartReservation[];
  rooms: TapeChartRoom[];
  reservationGroups: { id: string; name?: string | null; reservationCount: number }[];
  /** Kolory statusów rezerwacji (CONFIRMED, CHECKED_IN itd.) – ładowane z obiektu */
  reservationStatusColors?: Partial<Record<string, string>> | null;
  /** Etykiety statusów rezerwacji */
  reservationStatusLabels?: Partial<Record<string, string>> | null;
  /** Opisy statusów rezerwacji */
  reservationStatusDescriptions?: Partial<Record<string, string>> | null;
  /** Id obiektu – do przekazania do TapeChart (unika dodatkowego wywołania getEffectivePropertyId) */
  propertyId?: string | null;
  /** Macierz kolorów kombinacji (status rezerwacji × status płatności) */
  statusCombinationColors?: Partial<Record<string, string>> | null;
  /** Wydarzenia specjalne w zakresie dat grafiku (nad siatką) */
  events?: TapeChartEvent[];
}

/** Format daty YYYY-MM-DD w UTC – spójnie z MySQL DATE */
function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Dane do Command Palette: goście (z pierwszą rezerwacją dla "Pokaż na grafiku") i pokoje */
export async function getCommandPaletteData(): Promise<{
  guests: { id: string; name: string; reservationId?: string }[];
  rooms: { number: string; type: string }[];
}> {
  const propertyId = await getEffectivePropertyId();
  const [guests, rooms] = await Promise.all([
    prisma.guest.findMany({
      take: 100,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        reservations: {
          orderBy: { checkIn: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    }),
    prisma.room.findMany({
      where: propertyId ? { propertyId } : {},
      orderBy: { number: "asc" },
      select: { number: true, type: true },
    }),
  ]);
  return {
    guests: guests.map((g) => ({
      id: g.id,
      name: g.name,
      reservationId: g.reservations[0]?.id,
    })),
    rooms: rooms.map((r) => ({ number: r.number, type: r.type })),
  };
}

function mapReservationToTapeChart(r: {
  id: string;
  guestId: string;
  guest: { name: string; isBlacklisted?: boolean };
  room: { number: string };
  checkIn: Date;
  checkOut: Date;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  status: string;
  pax: number | null;
  bedsBooked?: number | null;
  notes?: string | null;
  notesVisibleOnChart?: boolean;
  advanceDueDate?: Date | null;
  paymentStatus?: string | null;
  rateCode?: { id: string; code: string; name: string; price: unknown } | null;
  rateCodePrice?: unknown; // Decimal | null – nadpisanie ceny za dobę (ręczna cena)
  group?: { id: string; name: string | null } | null;
  parkingBookings?: Array<{ parkingSpotId: string; parkingSpot: { number: string } }>;
  companyId?: string | null;
  company?: { id: string; name: string } | null;
  invoiceReservations?: Array<{ id: string }>;
  eventOrderId?: string | null;
  eventOrder?: {
    id: string;
    eventType: string;
    clientName: string | null;
    eventDate: Date | null;
    status: string;
    depositAmount: unknown;
    depositPaid: boolean;
  } | null;
}) {
  const firstParking = r.parkingBookings?.[0];
  return {
    id: r.id,
    guestId: r.guestId,
    guestName: r.guest.name,
    guestBlacklisted: r.guest.isBlacklisted ?? false,
    room: r.room.number,
    checkIn: formatDate(r.checkIn),
    checkOut: formatDate(r.checkOut),
    checkInTime: r.checkInTime ?? undefined,
    checkOutTime: r.checkOutTime ?? undefined,
    status: r.status as string,
    pax: r.pax ?? undefined,
    bedsBooked: r.bedsBooked ?? undefined,
    notes: r.notes ?? undefined,
    notesVisibleOnChart: r.notesVisibleOnChart ?? false,
    advanceDueDate: r.advanceDueDate ? formatDate(r.advanceDueDate) : undefined,
    paymentStatus: (r.paymentStatus as "UNPAID" | "PARTIAL" | "PAID") ?? undefined,
    rateCodeId: r.rateCode?.id ?? undefined,
    rateCode: r.rateCode?.code ?? undefined,
    rateCodeName: r.rateCode?.name ?? undefined,
    rateCodePrice: (() => {
      if (r.rateCodePrice != null) return Number(r.rateCodePrice);
      if (r.rateCode) {
        const pax = Math.max(1, r.pax ?? 1);
        return computeRateCodePricePerNight(
          {
            price: r.rateCode.price != null ? Number(r.rateCode.price) : null,
            basePrice: null,
            pricePerPerson: null,
          },
          pax
        ) ?? undefined;
      }
      return undefined;
    })(),
    groupId: r.group?.id ?? undefined,
    groupName: r.group?.name ?? undefined,
    parkingSpotId: firstParking?.parkingSpotId ?? undefined,
    parkingSpotNumber: firstParking?.parkingSpot?.number ?? undefined,
    companyId: r.companyId ?? undefined,
    companyName: r.company?.name ?? undefined,
    hasConsolidatedInvoice: (r.invoiceReservations?.length ?? 0) > 0,
    eventOrderId: r.eventOrderId ?? r.eventOrder?.id ?? undefined,
    eventOrderType: r.eventOrder?.eventType ?? undefined,
    eventOrderClient: r.eventOrder?.clientName ?? undefined,
    eventOrderDate: r.eventOrder?.eventDate ? formatDate(r.eventOrder.eventDate) : undefined,
    eventOrderStatus: r.eventOrder?.status ?? undefined,
    eventOrderDeposit: r.eventOrder?.depositAmount != null ? Number(r.eventOrder.depositAmount) : undefined,
    eventOrderDepositPaid: r.eventOrder?.depositPaid ?? undefined,
  };
}

/** Opcje dla getTapeChartData – filtr roomIds (np. dla MICE: tylko sale konferencyjne). */
export interface GetTapeChartDataOptions {
  roomIds?: string[];
  /** Początek zakresu dat (YYYY-MM-DD). Domyślnie: 14 dni wstecz. */
  dateFrom?: string;
  /** Koniec zakresu dat (YYYY-MM-DD). Domyślnie: 90 dni w przód. */
  dateTo?: string;
}

/** Wewnętrzna implementacja – bez cache. */
async function fetchTapeChartDataUncached(
  options: GetTapeChartDataOptions | undefined,
  propertyId: string | null
): Promise<TapeChartData> {
  const roomIds = options?.roomIds?.filter(Boolean);
  const filterByRoomIds = roomIds != null && roomIds.length > 0;
  let reservations: Array<{
    id: string;
    guestId: string;
    guest: { name: string };
    room: { number: string };
    checkIn: Date;
    checkOut: Date;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    status: string;
    pax: number | null;
    bedsBooked?: number | null;
    notes?: string | null;
    rateCode?: { id: string; code: string; name: string; price: unknown } | null;
    group?: { id: string; name: string | null } | null;
    parkingBookings?: Array<{ parkingSpotId: string; parkingSpot: { number: string } }>;
  }>;
  let rooms: Array<{
    id: string;
    number: string;
    type: string;
    status: string;
    floor?: string | null;
    price: unknown;
    reason: string | null;
    roomFeatures?: unknown;
    beds?: number;
  }>;
  let roomBlocks: Array<{ id: string; roomId: string; startDate: Date; endDate: Date; reason: string | null }>;
  let groups: Array<{ id: string; name: string | null; _count: { reservations: number } }>;

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 14);
  const defaultTo = new Date(now);
  defaultTo.setDate(defaultTo.getDate() + 90);

  const dateFrom = options?.dateFrom ? new Date(options.dateFrom + "T00:00:00Z") : defaultFrom;
  const dateTo = options?.dateTo ? new Date(options.dateTo + "T23:59:59Z") : defaultTo;

  const roomWhere = {
    activeForSale: true,
    isDeleted: false,
    ...(propertyId ? { propertyId } : {}),
    ...(filterByRoomIds ? { id: { in: roomIds! } } : {}),
  };
  const reservationWhere = {
    ...(filterByRoomIds ? { roomId: { in: roomIds! } } : {}),
    ...(propertyId ? { room: { propertyId } } : {}),
    status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW] },
    checkOut: { gte: dateFrom },
    checkIn: { lte: dateTo },
  };
  const blockWhere = {
    ...(filterByRoomIds ? { roomId: { in: roomIds! } } : {}),
    ...(propertyId ? { room: { propertyId } } : {}),
    endDate: { gte: dateFrom },
    startDate: { lte: dateTo },
  };
  try {
    const [resResult, roomResult, blockResult, groupResult] = await Promise.all([
      prisma.reservation.findMany({
        where: reservationWhere,
        include: {
          guest: { select: { name: true, isBlacklisted: true } },
          room: { select: { number: true } },
          rateCode: { select: { id: true, code: true, name: true, price: true, basePrice: true, pricePerPerson: true } },
          group: { select: { id: true, name: true } },
          parkingBookings: { take: 1, include: { parkingSpot: { select: { number: true } } } },
          company: { select: { id: true, name: true } },
          invoiceReservations: { take: 1, select: { id: true } },
          eventOrder: {
            select: {
              id: true,
              eventType: true,
              clientName: true,
              eventDate: true,
              status: true,
              depositAmount: true,
              depositPaid: true,
            },
          },
        },
        orderBy: { checkIn: "asc" },
      }),
      prisma.room.findMany({
        where: roomWhere,
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          floor: true,
          price: true,
          reason: true,
          roomFeatures: true,
          beds: true,
        },
      }),
      prisma.roomBlock.findMany({
        where: blockWhere,
        orderBy: [{ startDate: "asc" }],
      }),
      prisma.reservationGroup.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { reservations: true } } },
      }),
    ]);
    reservations = resResult;
    rooms = roomResult;
    roomBlocks = blockResult;
    groups = groupResult;
  } catch {
    try {
      const [resResult, roomResult, blockResult, groupResult] = await Promise.all([
        prisma.reservation.findMany({
          where: reservationWhere,
          include: {
            guest: { select: { name: true, isBlacklisted: true } },
            room: { select: { number: true } },
            group: { select: { id: true, name: true } },
            parkingBookings: { take: 1, include: { parkingSpot: { select: { number: true } } } },
            company: { select: { id: true, name: true } },
            invoiceReservations: { take: 1, select: { id: true } },
          },
          orderBy: { checkIn: "asc" },
        }),
        prisma.room.findMany({
          where: { activeForSale: true, isDeleted: false, ...(propertyId ? { propertyId } : {}), ...(filterByRoomIds ? { id: { in: roomIds! } } : {}) },
          orderBy: { number: "asc" },
          select: {
            id: true,
            number: true,
            type: true,
            status: true,
            floor: true,
            price: true,
            reason: true,
            roomFeatures: true,
            beds: true,
          },
        }),
        prisma.roomBlock.findMany({
          where: blockWhere,
          orderBy: [{ startDate: "asc" }],
        }),
        prisma.reservationGroup.findMany({
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { reservations: true } } },
        }),
      ]);
      reservations = resResult as typeof reservations;
      rooms = roomResult;
      roomBlocks = blockResult;
      groups = groupResult;
    } catch (e) {
      throw e;
    }
  }

  if (rooms.length === 0 && propertyId && !filterByRoomIds) {
    const fallbackRooms = await prisma.room.findMany({
      where: { activeForSale: true, isDeleted: false },
      orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          type: true,
          status: true,
          floor: true,
          price: true,
          reason: true,
          roomFeatures: true,
          beds: true,
        },
      });
    if (fallbackRooms.length > 0) rooms = fallbackRooms;
  }

  const blocksByRoomId = new Map<
    string,
    Array<{ id: string; startDate: string; endDate: string; reason?: string }>
  >();
  roomBlocks.forEach((block) => {
    const start = formatDate(block.startDate);
    const end = formatDate(block.endDate);
    const entry = {
      id: block.id,
      startDate: start,
      endDate: end,
      reason: block.reason ?? undefined,
    };
    const existing = blocksByRoomId.get(block.roomId);
    if (existing) existing.push(entry);
    else blocksByRoomId.set(block.roomId, [entry]);
  });

  const filteredGroupIds = filterByRoomIds
    ? new Set(
        reservations
          .map((r) => r.group?.id)
          .filter((id): id is string => Boolean(id))
      )
    : null;

  const [propertyRes, roomTypes, eventsRaw] = await Promise.all([
    propertyId
      ? prisma.property.findUnique({
          where: { id: propertyId },
          select: {
            reservationStatusColors: true,
            reservationStatusLabels: true,
            reservationStatusDescriptions: true,
            statusCombinationColors: true,
          },
        })
      : Promise.resolve(null),
    prisma.roomType.findMany({
      select: {
        name: true,
        basePrice: true,
        rateCodeId: true,
        rateCode: { select: { id: true, code: true, name: true, price: true, basePrice: true, pricePerPerson: true } },
      },
    }).catch(() => [] as Array<{ name: string; basePrice: unknown; rateCodeId: string | null; rateCode: { id: string; code: string; name: string; price: unknown; basePrice: unknown; pricePerPerson: unknown } | null }>),
    prisma.hotelEvent.findMany({
      where: {
        ...(propertyId ? { propertyId } : {}),
        isPublic: true,
        startDate: { lte: dateTo },
        OR: [
          { endDate: { gte: dateFrom } },
          { endDate: null, startDate: { gte: dateFrom } },
        ],
      },
      orderBy: { startDate: "asc" },
      select: { id: true, title: true, startDate: true, endDate: true, color: true, description: true },
    }).catch(() => []),
  ]);
  const parseJsonRecord = (raw: unknown): Record<string, string> | null => {
    if (raw == null) return null;
    const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, string>) : {};
    return Object.keys(obj).length ? obj : null;
  };
  const reservationStatusColors = propertyRes?.reservationStatusColors
    ? parseJsonRecord(propertyRes.reservationStatusColors)
    : null;
  const reservationStatusLabels = propertyRes?.reservationStatusLabels
    ? parseJsonRecord(propertyRes.reservationStatusLabels)
    : null;
  const reservationStatusDescriptions = propertyRes?.reservationStatusDescriptions
    ? parseJsonRecord(propertyRes.reservationStatusDescriptions)
    : null;
  const statusCombinationColors = propertyRes?.statusCombinationColors
    ? parseJsonRecord(propertyRes.statusCombinationColors)
    : null;
  const typePriceMap = new Map<string, number>(
    roomTypes
      .filter((t) => t.basePrice != null)
      .map((t) => [t.name, Number(t.basePrice)])
  );
  const typeToRateCode = new Map(
    roomTypes
      .filter((t) => t.rateCodeId && t.rateCode)
      .map((t) => [t.name, { id: t.rateCode!.id, code: t.rateCode!.code, name: t.rateCode!.name, price: t.rateCode!.price, basePrice: t.rateCode!.basePrice, pricePerPerson: t.rateCode!.pricePerPerson }])
  );
  const events: TapeChartEvent[] = eventsRaw.map((e) => ({
    id: e.id,
    name: e.title,
    dateFrom: formatDate(e.startDate),
    dateTo: e.endDate ? formatDate(e.endDate) : formatDate(e.startDate),
    color: e.color,
    description: e.description ?? undefined,
  }));

  return {
    propertyId,
    events,
    reservations: reservations.map(mapReservationToTapeChart),
    rooms: rooms.map((r) => {
      const roomPrice = r.price != null ? Number(r.price) : typePriceMap.get(r.type);
      const defaultRateCode = typeToRateCode.get(r.type);
      return {
        id: r.id,
        number: r.number,
        type: r.type,
        status: r.status as string,
        floor: r.floor ?? undefined,
        price: roomPrice,
        defaultRateCodeId: defaultRateCode?.id,
        defaultRateCode: defaultRateCode ?? undefined,
        reason: r.reason ?? undefined,
        roomFeatures: Array.isArray(r.roomFeatures)
          ? (r.roomFeatures as string[])
          : r.roomFeatures != null
            ? [String(r.roomFeatures)]
            : undefined,
        beds: r.beds ?? undefined,
        blocks:
          (blocksByRoomId.get(r.id) ?? []).map((block) => ({
            ...block,
            roomNumber: r.number,
          })),
      };
    }),
    reservationGroups: (filteredGroupIds
      ? groups.filter((g) => filteredGroupIds.has(g.id))
      : groups
    ).map((g) => ({
      id: g.id,
      name: g.name,
      reservationCount: g._count.reservations,
    })),
    reservationStatusColors,
    reservationStatusLabels,
    reservationStatusDescriptions,
    statusCombinationColors,
  };
}

/** Pobiera dane do Tape Chart: rezerwacje i pokoje. Bez cache – revalidateTag nie działa z PM2 (wieloma workerami). */
export async function getTapeChartData(options?: GetTapeChartDataOptions): Promise<TapeChartData> {
  const propertyId = await getEffectivePropertyId();
  return fetchTapeChartDataUncached(options, propertyId);
}
