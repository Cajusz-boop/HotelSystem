"use server";

import { prisma } from "@/lib/db";
import {
  syncToBookingCom,
  syncToAirbnb,
  syncToExpedia,
  fetchBookingReservationsApi,
  type ChannelSyncOptions,
} from "@/lib/channel-manager";
import { syncGdsAvailability, type GdsProvider } from "@/lib/gds";
import { sendReservationCreatedWebhook } from "@/lib/webhooks";
import { getSelectedPropertyId } from "@/app/actions/properties";

export type ChannelMappingRow = {
  id: string;
  channel: string;
  internalType: string;
  internalId: string;
  externalId: string;
};

/** Lista mapowań Room/RoomType → zewnętrzne ID (Booking room id itd.) dla obiektu i opcjonalnie kanału. */
export async function getChannelMappings(
  propertyId: string,
  channel?: string
): Promise<{ success: true; data: ChannelMappingRow[] } | { success: false; error: string }> {
  try {
    const list = await prisma.channelMapping.findMany({
      where: { propertyId, ...(channel ? { channel } : {}) },
      orderBy: [{ channel: "asc" }, { internalType: "asc" }, { internalId: "asc" }],
    });
    return {
      success: true,
      data: list.map((m) => ({
        id: m.id,
        channel: m.channel,
        internalType: m.internalType,
        internalId: m.internalId,
        externalId: m.externalId,
      })),
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd odczytu mapowań" };
  }
}

/** Zwraca zewnętrzne ID (np. Booking room id) dla Room.id lub RoomType.id. Gdy brak mapowania – null. */
export async function getExternalId(
  propertyId: string,
  channel: string,
  internalType: "room" | "room_type",
  internalId: string
): Promise<string | null> {
  const m = await prisma.channelMapping.findUnique({
    where: {
      propertyId_channel_internalType_internalId: {
        propertyId,
        channel,
        internalType,
        internalId,
      },
    },
  });
  return m?.externalId ?? null;
}

/** Zapisuje lub aktualizuje mapowanie Room/RoomType → zewnętrzne ID. */
export async function upsertChannelMapping(
  propertyId: string,
  channel: string,
  internalType: "room" | "room_type",
  internalId: string,
  externalId: string
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const row = await prisma.channelMapping.upsert({
      where: {
        propertyId_channel_internalType_internalId: {
          propertyId,
          channel,
          internalType,
          internalId,
        },
      },
      create: { propertyId, channel, internalType, internalId, externalId: externalId.trim() },
      update: { externalId: externalId.trim() },
    });
    return { success: true, id: row.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd zapisu mapowania" };
  }
}

/** Konfiguracja kanału na obiekt: externalPropertyId + roomTypeMappings (JSON). */
export type ChannelPropertyConfigRow = {
  id: string;
  propertyId: string;
  channel: string;
  externalPropertyId: string;
  roomTypeMappings: Record<string, string> | null;
};

/** Pobiera konfigurację kanału (externalPropertyId, roomTypeMappings) dla obiektu i kanału. */
export async function getChannelPropertyConfig(
  propertyId: string,
  channel: string
): Promise<{ success: true; data: ChannelPropertyConfigRow | null } | { success: false; error: string }> {
  try {
    const row = await prisma.channelPropertyConfig.findUnique({
      where: { propertyId_channel: { propertyId, channel } },
    });
    if (!row) return { success: true, data: null };
    return {
      success: true,
      data: {
        id: row.id,
        propertyId: row.propertyId,
        channel: row.channel,
        externalPropertyId: row.externalPropertyId,
        roomTypeMappings: row.roomTypeMappings as Record<string, string> | null,
      },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd odczytu konfiguracji kanału" };
  }
}

/** Zapisuje lub aktualizuje konfigurację kanału (externalPropertyId, roomTypeMappings). */
export async function upsertChannelPropertyConfig(
  propertyId: string,
  channel: string,
  externalPropertyId: string,
  roomTypeMappings: Record<string, string> | null
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const row = await prisma.channelPropertyConfig.upsert({
      where: { propertyId_channel: { propertyId, channel } },
      create: { propertyId, channel, externalPropertyId: externalPropertyId.trim(), roomTypeMappings: roomTypeMappings ?? undefined },
      update: { externalPropertyId: externalPropertyId.trim(), roomTypeMappings: roomTypeMappings ?? undefined },
    });
    return { success: true, id: row.id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd zapisu konfiguracji kanału" };
  }
}

export type ChannelSyncActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

/** Wywołuje synchronizację z wybranym kanałem (Booking.com, Airbnb, Expedia, GDS). */
export async function syncChannel(
  dateFrom: string,
  dateTo: string,
  channel: "booking_com" | "airbnb" | "expedia" | "amadeus" | "sabre" | "travelport"
): Promise<ChannelSyncActionResult> {
  const propertyId = await getSelectedPropertyId();
  if (!propertyId) {
    return { success: false, error: "Wybierz obiekt (cookie pms_property_id)." };
  }

  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return { success: false, error: "Nieprawidłowy zakres dat (YYYY-MM-DD)." };
  }

  const options = {
    propertyId,
    dateFrom,
    dateTo,
  };

  if (channel === "booking_com") {
    const result = await syncAvailabilityToBooking(propertyId, dateFrom, dateTo);
    return result.success
      ? { success: true, message: result.message }
      : { success: false, error: result.error ?? "Błąd synchronizacji" };
  }

  if (channel === "airbnb") {
    const listingId = process.env.AIRBNB_LISTING_ID;
    if (listingId) {
      const calendar: Array<{ date: string; available: boolean; price: number }> = [];
      const d = new Date(from);
      while (d < to) {
        calendar.push({
          date: d.toISOString().slice(0, 10),
          available: true,
          price: 100,
        });
        d.setDate(d.getDate() + 1);
      }
      const result = await syncToAirbnb({
        ...options,
        airbnbListingId: listingId,
        airbnbCalendar: calendar,
      } as Parameters<typeof syncToAirbnb>[0]);
      return result.success
        ? { success: true, message: result.message }
        : { success: false, error: result.error ?? "Błąd synchronizacji" };
    }
    const result = await syncToAirbnb(options as Parameters<typeof syncToAirbnb>[0]);
    return result.success
      ? { success: true, message: result.message }
      : { success: false, error: result.error ?? "Błąd synchronizacji" };
  }

  if (channel === "expedia") {
    const propertyIdExp = process.env.EXPEDIA_PROPERTY_ID;
    if (propertyIdExp) {
      const updates: Array<{
        roomTypeId: string;
        ratePlanId: string;
        date: string;
        inventory: number;
        rate: number;
      }> = [];
      const d = new Date(from);
      while (d < to) {
        updates.push({
          roomTypeId: process.env.EXPEDIA_DEFAULT_ROOM_TYPE_ID ?? "1",
          ratePlanId: process.env.EXPEDIA_DEFAULT_RATE_PLAN_ID ?? "1",
          date: d.toISOString().slice(0, 10),
          inventory: 1,
          rate: 100,
        });
        d.setDate(d.getDate() + 1);
      }
      const result = await syncToExpedia({
        ...options,
        expediaPropertyId: propertyIdExp,
        expediaUpdates: updates,
      } as Parameters<typeof syncToExpedia>[0]);
      return result.success
        ? { success: true, message: result.message }
        : { success: false, error: result.error ?? "Błąd synchronizacji" };
    }
    const result = await syncToExpedia(options as Parameters<typeof syncToExpedia>[0]);
    return result.success
      ? { success: true, message: result.message }
      : { success: false, error: result.error ?? "Błąd synchronizacji" };
  }

  if (channel === "amadeus" || channel === "sabre" || channel === "travelport") {
    const result = await syncGdsAvailability(
      propertyId,
      dateFrom,
      dateTo,
      channel as GdsProvider
    );
    return result.success
      ? { success: true, message: result.message }
      : { success: false, error: result.error ?? "Błąd synchronizacji GDS" };
  }

  return { success: false, error: "Nieznany kanał." };
}

/** Buduje inventoryAndRates z danych PMS: pokoje, rezerwacje, blokady, mapowania, ceny. */
async function buildInventoryForBooking(
  propertyId: string,
  dateFrom: string,
  dateTo: string
): Promise<
  | { success: true; inventory: ChannelSyncOptions["inventoryAndRates"] }
  | { success: false; error: string }
> {
  const from = new Date(dateFrom + "T00:00:00Z");
  const to = new Date(dateTo + "T00:00:00Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return { success: false, error: "Nieprawidłowy zakres dat (YYYY-MM-DD)." };
  }

  const [
    rooms,
    reservations,
    blocks,
    mappings,
    roomTypes,
    ratePlans,
  ] = await Promise.all([
    prisma.room.findMany({
      where: {
        propertyId,
        activeForSale: true,
        status: { in: ["CLEAN", "INSPECTED"] },
      },
      select: { id: true, number: true, type: true, price: true },
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lt: to },
        checkOut: { gt: from },
      },
      select: { roomId: true, checkIn: true, checkOut: true },
    }),
    prisma.roomBlock.findMany({
      where: {
        room: { propertyId },
        startDate: { lt: to },
        endDate: { gt: from },
      },
      select: { roomId: true, startDate: true, endDate: true },
    }),
    prisma.channelMapping.findMany({
      where: { propertyId, channel: "booking_com" },
      select: { internalType: true, internalId: true, externalId: true },
    }),
    prisma.roomType.findMany({ select: { id: true, name: true, basePrice: true } }),
    prisma.ratePlan.findMany({
      where: { validFrom: { lte: to }, validTo: { gte: from } },
      select: { roomTypeId: true, validFrom: true, validTo: true, price: true, isWeekendHoliday: true },
    }),
  ]);

  const mappingByRoom = new Map<string, string>();
  const mappingByRoomType = new Map<string, string>();
  for (const m of mappings) {
    if (m.internalType === "room") mappingByRoom.set(m.internalId, m.externalId);
    if (m.internalType === "room_type") mappingByRoomType.set(m.internalId, m.externalId);
  }
  type RoomTypeRow = { id: string; name: string; basePrice: number | null };
  const typeByName = new Map<string, RoomTypeRow>(roomTypes.map((t) => [t.name, t as RoomTypeRow]));
  const defaultRoomId = Number(process.env.BOOKING_COM_DEFAULT_ROOM_ID ?? "0");
  const defaultRateId = Number(process.env.BOOKING_COM_DEFAULT_RATE_ID ?? "0");

  const inventory: NonNullable<ChannelSyncOptions["inventoryAndRates"]> = [];
  const d = new Date(from);

  while (d < to) {
    const dateStr = d.toISOString().slice(0, 10);
    const day = d.getUTCDay();
    const isWeekend = day === 0 || day === 6;

    const occupiedRoomIds = new Set(
      reservations
        .filter((r) => r.checkIn <= d && r.checkOut > d)
        .map((r) => r.roomId)
    );
    const blockedRoomIds = new Set(
      blocks
        .filter((b) => b.startDate <= d && b.endDate > d)
        .map((b) => b.roomId)
    );

    const availableByType = new Map<string, { count: number; roomIds: string[]; price: number }>();
    for (const room of rooms) {
      if (occupiedRoomIds.has(room.id) || blockedRoomIds.has(room.id)) continue;
      const typeName = room.type;
      const rt = typeByName.get(typeName);
      let price = room.price != null ? Number(room.price) : 0;
      if (rt) {
        const plans = ratePlans.filter(
          (p) => p.roomTypeId === rt.id && p.validFrom <= d && p.validTo >= d
        );
        const preferred = plans.find((x) => x.isWeekendHoliday === isWeekend) ?? plans[0];
        if (preferred?.price != null) price = Number(preferred.price);
        else if (rt.basePrice != null) price = Number(rt.basePrice);
        else if (price === 0) price = 100;
      } else if (price === 0) price = 100;

      const entry = availableByType.get(typeName);
      if (entry) {
        entry.count += 1;
        entry.roomIds.push(room.id);
      } else {
        availableByType.set(typeName, { count: 1, roomIds: [room.id], price });
      }
    }

    if (mappingByRoomType.size > 0) {
      for (const [typeName, { count, price }] of availableByType) {
        if (count === 0) continue;
        const rt = typeByName.get(typeName);
        const bookingRoomIdStr = rt ? mappingByRoomType.get(rt.id) : null;
        if (!bookingRoomIdStr) continue;
        const bookingRoomId = Number(bookingRoomIdStr);
        if (bookingRoomId > 0 && defaultRateId > 0) {
          inventory.push({
            bookingRoomId,
            bookingRateId: defaultRateId,
            dateFrom: dateStr,
            dateTo: dateStr,
            roomsToSell: Math.min(254, count),
            price: Math.round(price * 100) / 100,
          });
        }
      }
    } else if (mappingByRoom.size > 0) {
      for (const room of rooms) {
        if (occupiedRoomIds.has(room.id) || blockedRoomIds.has(room.id)) continue;
        const extId = mappingByRoom.get(room.id);
        if (!extId) continue;
        const bid = Number(extId);
        if (bid <= 0 || defaultRateId <= 0) continue;
        const rt = typeByName.get(room.type);
        let price = room.price != null ? Number(room.price) : 0;
        if (rt) {
          const plans = ratePlans.filter(
            (p) => p.roomTypeId === rt.id && p.validFrom <= d && p.validTo >= d
          );
          const preferred = plans.find((x) => x.isWeekendHoliday === isWeekend) ?? plans[0];
          if (preferred?.price != null) price = Number(preferred.price);
          else if (rt.basePrice != null) price = Number(rt.basePrice);
        }
        if (price === 0) price = 100;
        inventory.push({
          bookingRoomId: bid,
          bookingRateId: defaultRateId,
          dateFrom: dateStr,
          dateTo: dateStr,
          roomsToSell: 1,
          price: Math.round(price * 100) / 100,
        });
      }
    } else if (defaultRoomId > 0 && defaultRateId > 0) {
      const total = Array.from(availableByType.values()).reduce((s, x) => s + x.count, 0);
      if (total > 0) {
        const avgPrice =
          Array.from(availableByType.values()).reduce((s, x) => s + x.count * x.price, 0) /
          total;
        inventory.push({
          bookingRoomId: defaultRoomId,
          bookingRateId: defaultRateId,
          dateFrom: dateStr,
          dateTo: dateStr,
          roomsToSell: Math.min(254, total),
          price: Math.round(avgPrice * 100) / 100,
        });
      }
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }

  if (inventory.length === 0) {
    return {
      success: false,
      error:
        "Brak danych do synchronizacji. Skonfiguruj mapowania (Room/RoomType → Booking room id) lub BOOKING_COM_DEFAULT_ROOM_ID i BOOKING_COM_DEFAULT_RATE_ID.",
    };
  }

  return { success: true, inventory };
}

/** Synchronizuje dostępność i ceny do Booking.com (B.XML) na podstawie Room/RoomType. */
export async function syncAvailabilityToBooking(
  propertyId: string,
  dateFrom: string,
  dateTo: string
): Promise<ChannelSyncActionResult> {
  const build = await buildInventoryForBooking(propertyId, dateFrom, dateTo);
  if (!build.success) return { success: false, error: build.error };

  const result = await syncToBookingCom({
    propertyId,
    dateFrom,
    dateTo,
    inventoryAndRates: build.inventory,
  });

  return result.success
    ? { success: true, message: result.message }
    : { success: false, error: result.error ?? "Błąd synchronizacji z Booking.com" };
}

/** Pobiera rezerwacje z API Booking.com i tworzy Reservation w DB. */
export async function fetchReservationsFromBooking(
  propertyId: string
): Promise<
  | { success: true; created: number; skipped: number; errors: string[] }
  | { success: false; error: string }
> {
  const config = await getChannelPropertyConfig(propertyId, "booking_com");
  if (!config.success || !config.data?.externalPropertyId) {
    return {
      success: false,
      error: "Skonfiguruj Channel Property Config dla booking_com (externalPropertyId = hotel_id z Booking.com).",
    };
  }

  const apiResult = await fetchBookingReservationsApi(config.data.externalPropertyId);
  if (!apiResult.success) {
    return { success: false, error: apiResult.error };
  }

  const mappings = await prisma.channelMapping.findMany({
    where: { propertyId, channel: "booking_com" },
    select: { internalType: true, internalId: true, externalId: true },
  });

  const externalToRoomId = new Map<string, string>();
  const externalToRoomTypeId = new Map<string, string>();
  for (const m of mappings) {
    if (m.internalType === "room") externalToRoomId.set(m.externalId, m.internalId);
    if (m.internalType === "room_type") externalToRoomTypeId.set(m.externalId, m.internalId);
  }

  const rooms = await prisma.room.findMany({
    where: { propertyId, activeForSale: true },
    select: { id: true, number: true, type: true },
  });
  const roomsByTypeId = new Map<string, typeof rooms>();
  const roomTypes = await prisma.roomType.findMany({ select: { id: true, name: true } });
  type RoomTypeBasic = { id: string; name: string };
  const typeByName = new Map<string, RoomTypeBasic>(roomTypes.map((t) => [t.name, t as RoomTypeBasic]));
  for (const r of rooms) {
    const rt = typeByName.get(r.type);
    if (rt) {
      const list = roomsByTypeId.get(rt.id) ?? [];
      list.push(r);
      roomsByTypeId.set(rt.id, list);
    }
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of apiResult.data) {
    if (item.status === "cancelled") continue;

    const confirmationNum = `BK${item.bookingId}`;
    const existing = await prisma.reservation.findUnique({
      where: { confirmationNumber: confirmationNum },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    if (!item.checkIn || !item.checkOut) {
      errors.push(`Rezerwacja ${item.bookingId}: brak dat check-in/check-out`);
      continue;
    }

    let roomId: string | null = externalToRoomId.get(item.bookingRoomId) ?? null;
    if (!roomId) {
      const roomTypeId = externalToRoomTypeId.get(item.bookingRoomId);
      if (roomTypeId) {
        const list = roomsByTypeId.get(roomTypeId) ?? [];
        const checkIn = new Date(item.checkIn + "T12:00:00Z");
        const checkOut = new Date(item.checkOut + "T12:00:00Z");
        for (const r of list) {
          const overlap = await prisma.reservation.findFirst({
            where: {
              roomId: r.id,
              status: { in: ["CONFIRMED", "CHECKED_IN"] },
              checkIn: { lt: checkOut },
              checkOut: { gt: checkIn },
            },
          });
          if (!overlap) {
            roomId = r.id;
            break;
          }
        }
      }
    }
    if (!roomId) {
      errors.push(`Rezerwacja ${item.bookingId}: brak mapowania room ${item.bookingRoomId} na lokalny pokój`);
      continue;
    }

    const guestName = [item.guestFirstName, item.guestLastName].filter(Boolean).join(" ").trim() || "Gość Booking.com";
    let guest = await prisma.guest.findFirst({ where: { name: guestName } });
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          name: guestName,
          ...(item.guestEmail ? { email: item.guestEmail } : {}),
          ...(item.guestPhone ? { phone: item.guestPhone } : {}),
        },
      });
    }

    try {
      const res = await prisma.reservation.create({
        data: {
          confirmationNumber: confirmationNum,
          guestId: guest.id,
          roomId,
          checkIn: new Date(item.checkIn + "T12:00:00Z"),
          checkOut: new Date(item.checkOut + "T12:00:00Z"),
          status: "CONFIRMED",
          source: "OTA",
          channel: "BOOKING_COM",
          pax: item.pax,
          mealPlan: item.mealPlan ?? null,
        },
        include: { guest: true, room: true },
      });
      created += 1;
      void sendReservationCreatedWebhook({
        event: "reservation.created",
        id: res.id,
        confirmationNumber: res.confirmationNumber,
        guestName: res.guest.name,
        roomNumber: res.room.number,
        checkIn: item.checkIn,
        checkOut: item.checkOut,
        status: res.status,
        source: res.source,
        channel: res.channel,
        pax: res.pax,
        createdAt: res.createdAt.toISOString(),
      });
    } catch (e) {
      errors.push(
        `Rezerwacja ${item.bookingId}: ${e instanceof Error ? e.message : "Błąd zapisu"}`
      );
    }
  }

  return {
    success: true,
    created,
    skipped,
    errors,
  };
}
