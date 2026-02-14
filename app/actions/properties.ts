"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

const PROPERTY_COOKIE = "pms_property_id";

export async function getProperties() {
  try {
    const list = await prisma.property.findMany({
      orderBy: { code: "asc" },
      select: { id: true, name: true, code: true },
    });
    return { success: true as const, data: list };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Błąd" };
  }
}

export async function getSelectedPropertyId(): Promise<string | null> {
  const cookieStore = await cookies();
  const id = cookieStore.get(PROPERTY_COOKIE)?.value;
  return id || null;
}

export async function setSelectedProperty(propertyId: string): Promise<ActionResult> {
  try {
    const exists = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!exists) return { success: false, error: "Obiekt nie istnieje" };
    const cookieStore = await cookies();
    cookieStore.set(PROPERTY_COOKIE, propertyId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd" };
  }
}

/** Id obiektu do filtrów (z ciasteczka lub pierwszy z bazy) */
export async function getEffectivePropertyId(): Promise<string | null> {
  const fromCookie = await getSelectedPropertyId();
  if (fromCookie) return fromCookie;
  const first = await prisma.property.findFirst({
    orderBy: { code: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

export type ReservationStatusColorMap = Partial<Record<string, string>>;

/** Paleta kolorów statusów rezerwacji dla obiektu (tła pasków na grafiku). */
export async function getPropertyReservationColors(
  propertyId: string | null
): Promise<ActionResult<ReservationStatusColorMap | null>> {
  if (!propertyId) return { success: true, data: null };
  try {
    const p = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { reservationStatusColors: true },
    });
    const raw = p?.reservationStatusColors;
    if (raw == null) return { success: true, data: null };
    const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, string>) : {};
    return { success: true, data: Object.keys(obj).length ? obj : null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd odczytu" };
  }
}

/** Zapisuje paletę kolorów statusów rezerwacji dla obiektu. */
export async function updatePropertyReservationColors(
  propertyId: string,
  colors: ReservationStatusColorMap
): Promise<ActionResult> {
  try {
    await prisma.property.update({
      where: { id: propertyId },
      data: {
        reservationStatusColors:
          Object.keys(colors).length > 0 ? (colors as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd zapisu" };
  }
}

/** Limit overbookingu (%, 0 = wyłączony) dla obiektu. */
export async function getPropertyOverbookingLimit(
  propertyId: string | null
): Promise<ActionResult<number>> {
  if (!propertyId) return { success: true, data: 0 };
  try {
    const p = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { overbookingLimitPercent: true },
    });
    return { success: true, data: p?.overbookingLimitPercent ?? 0 };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd odczytu" };
  }
}

/** Zapisuje limit overbookingu (%, 0 = wyłączony). */
export async function updatePropertyOverbookingLimit(
  propertyId: string,
  percent: number
): Promise<ActionResult> {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  try {
    await prisma.property.update({
      where: { id: propertyId },
      data: { overbookingLimitPercent: value },
    });
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd zapisu" };
  }
}

/** Lista pokoi obiektu (do formularza rezerwacji właścicielskiej). */
export async function getRoomsForProperty(
  propertyId: string
): Promise<ActionResult<Array<{ id: string; number: string; type: string }>>> {
  try {
    const rooms = await prisma.room.findMany({
      where: { propertyId },
      orderBy: { number: "asc" },
      select: { id: true, number: true, type: true },
    });
    return { success: true, data: rooms };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd odczytu" };
  }
}

/** Lista obiektów przypisanych do właściciela (Portal Właściciela). */
export async function getPropertiesForOwner(
  ownerId: string
): Promise<ActionResult<Array<{ id: string; name: string; code: string }>>> {
  try {
    const list = await prisma.property.findMany({
      where: { ownerId },
      orderBy: { code: "asc" },
      select: { id: true, name: true, code: true },
    });
    return { success: true, data: list };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd odczytu" };
  }
}

/** Przychody, koszty i prowizje obiektu (Portal Właściciela). Dla zakresu dat. */
export async function getRevenueAndCostsForProperty(
  propertyId: string,
  options?: { dateFrom?: string; dateTo?: string }
): Promise<
  ActionResult<{ revenue: number; costs: number; commission: number; currency: string }>
> {
  try {
    const now = new Date();
    let start: Date;
    let end: Date;
    if (options?.dateFrom && options?.dateTo) {
      start = new Date(options.dateFrom + "T00:00:00Z");
      end = new Date(options.dateTo + "T23:59:59.999Z");
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return { success: false, error: "Nieprawidłowy zakres dat" };
      }
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const roomIds = (
      await prisma.room.findMany({
        where: { propertyId },
        select: { id: true },
      })
    ).map((r) => r.id);
    if (roomIds.length === 0) {
      return { success: true, data: { revenue: 0, costs: 0, commission: 0, currency: "PLN" } };
    }

    const [revenueAgg, reservationsWithAgents] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          reservation: { roomId: { in: roomIds } },
          postedAt: { gte: start, lte: end },
          type: "ROOM",
          status: "ACTIVE",
        },
        _sum: { amount: true },
      }),
      prisma.reservation.findMany({
        where: {
          roomId: { in: roomIds },
          checkOut: { gte: start, lte: end },
          status: { in: ["CHECKED_OUT", "CHECKED_IN", "CONFIRMED"] },
          travelAgentId: { not: null },
        },
        include: {
          travelAgent: true,
          transactions: {
            where: { status: "ACTIVE" },
            select: { amount: true },
          },
        },
      }),
    ]);

    const revenue = Number(revenueAgg._sum.amount ?? 0);
    let commission = 0;
    for (const res of reservationsWithAgents) {
      const agentRevenue = res.transactions.reduce((s, t) => s + Number(t.amount), 0);
      const pct = res.agentCommission != null ? Number(res.agentCommission) : Number(res.travelAgent?.commissionPercent ?? 0);
      commission += (agentRevenue * pct) / 100;
    }

    return {
      success: true,
      data: { revenue, costs: 0, commission, currency: "PLN" },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu",
    };
  }
}

/** Rozliczenia z właścicielami – lista miesięcy z kwotą (stub: ostatnie 3 miesiące). */
export async function getOwnerSettlements(
  ownerId: string
): Promise<
  ActionResult<Array<{ period: string; amount: number; status: string }>>
> {
  try {
    const props = await prisma.property.findMany({
      where: { ownerId },
      select: { id: true },
    });
    if (props.length === 0) return { success: true, data: [] };
    const roomIds = (
      await prisma.room.findMany({
        where: { propertyId: { in: props.map((p) => p.id) } },
        select: { id: true },
      })
    ).map((r) => r.id);
    const result: Array<{ period: string; amount: number; status: string }> = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const start = new Date(y, d.getMonth(), 1);
      const end = new Date(y, d.getMonth() + 1, 0, 23, 59, 59);
      const agg = await prisma.transaction.aggregate({
        where: {
          reservation: { roomId: { in: roomIds } },
          createdAt: { gte: start, lte: end },
          type: "ROOM",
        },
        _sum: { amount: true },
      });
      result.push({
        period: `${y}-${m}`,
        amount: Number(agg._sum.amount ?? 0),
        status: i === 0 ? "Do rozliczenia" : "Rozliczono",
      });
    }
    return { success: true, data: result };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu",
    };
  }
}

/** Obłożenie obiektu: liczba pokoi, zajęte dziś, % obłożenia. */
export async function getOccupancyForProperty(
  propertyId: string
): Promise<ActionResult<{ totalRooms: number; occupiedToday: number; occupancyPercent: number }>> {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const [totalRooms, occupied] = await Promise.all([
      prisma.room.count({ where: { propertyId } }),
      prisma.reservation.count({
        where: {
          room: { propertyId },
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
          checkIn: { lt: tomorrow },
          checkOut: { gt: today },
        },
      }),
    ]);
    const occupancyPercent = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
    return {
      success: true,
      data: { totalRooms, occupiedToday: occupied, occupancyPercent },
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd odczytu" };
  }
}

/** Opłata miejscowa (PLN za osobę za noc); null/0 = wyłączone. */
export async function getPropertyLocalTax(
  propertyId: string | null
): Promise<ActionResult<number | null>> {
  if (!propertyId) return { success: true, data: null };
  try {
    const p = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { localTaxPerPersonPerNight: true },
    });
    const v = p?.localTaxPerPersonPerNight;
    return { success: true, data: v != null ? Number(v) : null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd odczytu" };
  }
}

/** Zapisuje opłatę miejscową (PLN za osobę za noc); null/0 = wyłączone. */
export async function updatePropertyLocalTax(
  propertyId: string,
  value: number | null
): Promise<ActionResult> {
  try {
    await prisma.property.update({
      where: { id: propertyId },
      data: {
        localTaxPerPersonPerNight:
          value == null || value <= 0 ? null : new Prisma.Decimal(value),
      },
    });
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd zapisu" };
  }
}
