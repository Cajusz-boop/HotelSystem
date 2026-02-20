"use server";

import { prisma } from "@/lib/db";
import { getEffectivePropertyId, getPropertyReservationColors } from "@/app/actions/properties";
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
  rateCodeId?: string;
  rateCode?: string;
  rateCodeName?: string;
  rateCodePrice?: number;
  groupId?: string;
  groupName?: string;
  parkingSpotId?: string;
  parkingSpotNumber?: string;
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

export interface TapeChartData {
  reservations: TapeChartReservation[];
  rooms: TapeChartRoom[];
  reservationGroups: { id: string; name?: string | null; reservationCount: number }[];
  /** Kolory statusów rezerwacji (CONFIRMED, CHECKED_IN itd.) – ładowane z obiektu */
  reservationStatusColors?: Partial<Record<string, string>> | null;
  /** Id obiektu – do przekazania do TapeChart (unika dodatkowego wywołania getEffectivePropertyId) */
  propertyId?: string | null;
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
  rateCode?: { id: string; code: string; name: string; price: unknown } | null;
  group?: { id: string; name: string | null } | null;
  parkingBookings?: Array<{ parkingSpotId: string; parkingSpot: { number: string } }>;
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
    rateCodeId: r.rateCode?.id ?? undefined,
    rateCode: r.rateCode?.code ?? undefined,
    rateCodeName: r.rateCode?.name ?? undefined,
    rateCodePrice: r.rateCode?.price != null ? Number(r.rateCode.price) : undefined,
    groupId: r.group?.id ?? undefined,
    groupName: r.group?.name ?? undefined,
    parkingSpotId: firstParking?.parkingSpotId ?? undefined,
    parkingSpotNumber: firstParking?.parkingSpot?.number ?? undefined,
  };
}

/** Opcje dla getTapeChartData – filtr roomIds (np. dla MICE: tylko sale konferencyjne). */
export interface GetTapeChartDataOptions {
  roomIds?: string[];
  /** Początek zakresu dat (YYYY-MM-DD). Domyślnie: 90 dni wstecz. */
  dateFrom?: string;
  /** Koniec zakresu dat (YYYY-MM-DD). Domyślnie: 400 dni w przód. */
  dateTo?: string;
}

/** Pobiera dane do Tape Chart: rezerwacje i pokoje. Działa także gdy w bazie brak RateCode / rateCodeId (stary schemat). */
export async function getTapeChartData(options?: GetTapeChartDataOptions): Promise<TapeChartData> {
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

  const propertyId = await getEffectivePropertyId();

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 90);
  const defaultTo = new Date(now);
  defaultTo.setDate(defaultTo.getDate() + 400);

  const dateFrom = options?.dateFrom ? new Date(options.dateFrom + "T00:00:00Z") : defaultFrom;
  const dateTo = options?.dateTo ? new Date(options.dateTo + "T23:59:59Z") : defaultTo;

  const roomWhere = {
    activeForSale: true,
    ...(propertyId ? { propertyId } : {}),
    ...(filterByRoomIds ? { id: { in: roomIds! } } : {}),
  };
  const reservationWhere = {
    ...(filterByRoomIds ? { roomId: { in: roomIds! } } : {}),
    checkOut: { gte: dateFrom },
    checkIn: { lte: dateTo },
  };
  const blockWhere = {
    ...(filterByRoomIds ? { roomId: { in: roomIds! } } : {}),
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
          rateCode: true,
          group: true,
          parkingBookings: { include: { parkingSpot: true } },
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
            group: true,
            parkingBookings: { include: { parkingSpot: true } },
          },
          orderBy: { checkIn: "asc" },
        }),
        prisma.room.findMany({
          where: { ...(propertyId ? { propertyId } : {}), ...(filterByRoomIds ? { id: { in: roomIds! } } : {}) },
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
      where: { activeForSale: true },
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

  const [colorsRes, roomTypes] = await Promise.all([
    getPropertyReservationColors(propertyId),
    prisma.roomType.findMany({ select: { name: true, basePrice: true } }).catch(() => [] as { name: string; basePrice: unknown }[]),
  ]);
  const reservationStatusColors = colorsRes.success && colorsRes.data && Object.keys(colorsRes.data).length > 0
    ? colorsRes.data
    : null;
  const typePriceMap = new Map<string, number>(
    roomTypes
      .filter((t) => t.basePrice != null)
      .map((t) => [t.name, Number(t.basePrice)])
  );

  return {
    propertyId,
    reservations: reservations.map(mapReservationToTapeChart),
    rooms: rooms.map((r) => {
      const roomPrice = r.price != null ? Number(r.price) : typePriceMap.get(r.type);
      return {
        id: r.id,
        number: r.number,
        type: r.type,
        status: r.status as string,
        floor: r.floor ?? undefined,
        price: roomPrice,
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
  };
}
