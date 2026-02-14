/**
 * GDS (Global Distribution System): Amadeus, Sabre, Travelport.
 * Integracja wymaga certyfikacji i połączenia przez switch (np. DerbySoft, SiteMinder)
 * lub bezpośrednie API.
 */

import { prisma } from "@/lib/db";

export type GdsProvider = "amadeus" | "sabre" | "travelport";

export interface GdsSyncResult {
  success: boolean;
  message?: string;
  error?: string;
}

function getGdsSwitchUrl(provider: GdsProvider): string | null {
  const envKey =
    provider === "amadeus"
      ? "GDS_AMADEUS_URL"
      : provider === "sabre"
        ? "GDS_SABRE_URL"
        : "GDS_TRAVELPORT_URL";
  return process.env[envKey] ?? process.env.GDS_SWITCH_URL ?? null;
}

/** Buduje inwentarz dostępności dla GDS (analogicznie do B.XML). */
async function buildGdsInventory(
  propertyId: string,
  dateFrom: string,
  dateTo: string
): Promise<
  | { success: true; items: Array<{ roomId: string; date: string; roomsToSell: number; price: number }> }
  | { success: false; error: string }
> {
  const from = new Date(dateFrom + "T00:00:00Z");
  const to = new Date(dateTo + "T00:00:00Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return { success: false, error: "Nieprawidłowy zakres dat (YYYY-MM-DD)." };
  }

  const [rooms, reservations, blocks, mappings, roomTypes, ratePlans] = await Promise.all([
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
      where: { propertyId },
      select: { internalType: true, internalId: true, externalId: true },
    }),
    prisma.roomType.findMany({ select: { id: true, name: true, basePrice: true } }),
    prisma.ratePlan.findMany({
      where: { validFrom: { lte: to }, validTo: { gte: from } },
      select: { roomTypeId: true, validFrom: true, validTo: true, price: true, isWeekendHoliday: true },
    }),
  ]);

  const mappingByRoomType = new Map<string, string>();
  const mappingByRoom = new Map<string, string>();
  for (const m of mappings) {
    if (m.internalType === "room_type") mappingByRoomType.set(m.internalId, m.externalId);
    if (m.internalType === "room") mappingByRoom.set(m.internalId, m.externalId);
  }
  const typeByName = new Map(roomTypes.map((t) => [t.name, t]));

  const items: Array<{ roomId: string; date: string; roomsToSell: number; price: number }> = [];
  const d = new Date(from);

  while (d < to) {
    const dateStr = d.toISOString().slice(0, 10);
    const day = d.getUTCDay();
    const isWeekend = day === 0 || day === 6;

    const occupiedRoomIds = new Set(
      reservations.filter((r) => r.checkIn <= d && r.checkOut > d).map((r) => r.roomId)
    );
    const blockedRoomIds = new Set(
      blocks.filter((b) => b.startDate <= d && b.endDate > d).map((b) => b.roomId)
    );

    const availableByType = new Map<string, { count: number; price: number }>();
    for (const room of rooms) {
      if (occupiedRoomIds.has(room.id) || blockedRoomIds.has(room.id)) continue;
      const rt = typeByName.get(room.type);
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

      const entry = availableByType.get(room.type);
      if (entry) {
        entry.count += 1;
      } else {
        availableByType.set(room.type, { count: 1, price });
      }
    }

    for (const [typeName, { count, price }] of availableByType) {
      if (count === 0) continue;
      const rt = typeByName.get(typeName);
      const extId = rt ? mappingByRoomType.get(rt.id) : null;
      const roomId = extId ?? `type:${typeName}`;
      items.push({
        roomId,
        date: dateStr,
        roomsToSell: Math.min(254, count),
        price: Math.round(price * 100) / 100,
      });
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }

  if (items.length === 0) {
    return { success: false, error: "Brak danych dostępności do synchronizacji." };
  }

  return { success: true, items };
}

/**
 * Synchronizuje dostępność do GDS (przez switch lub bezpośrednie API).
 * Wymaga: GDS_SWITCH_URL lub GDS_AMADEUS_URL / GDS_SABRE_URL / GDS_TRAVELPORT_URL.
 */
export async function syncGdsAvailability(
  propertyId: string,
  dateFrom: string,
  dateTo: string,
  provider: GdsProvider
): Promise<GdsSyncResult> {
  const url = getGdsSwitchUrl(provider);
  if (!url) {
    return {
      success: false,
      error: `Skonfiguruj GDS_${provider.toUpperCase()}_URL lub GDS_SWITCH_URL. Integracja z ${provider} wymaga certyfikacji i połączenia przez switch (np. DerbySoft, SiteMinder).`,
    };
  }

  const build = await buildGdsInventory(propertyId, dateFrom, dateTo);
  if (!build.success) return { success: false, error: build.error };

  const body = {
    provider,
    propertyId,
    dateFrom,
    dateTo,
    inventory: build.items,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `GDS switch HTTP ${res.status}: ${text.slice(0, 150).replace(/\s+/g, " ")}`,
      };
    }

    return {
      success: true,
      message: `Dostępność wysłana do ${provider} (${build.items.length} pozycji).`,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : `Błąd połączenia z GDS (${provider}). Sprawdź GDS_*_URL.`,
    };
  }
}
