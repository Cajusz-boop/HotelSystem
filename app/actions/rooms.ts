"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createAuditLog, getClientIp } from "@/lib/audit";
import {
  roomStatusSchema,
  createRoomSchema,
  type RoomStatusInput,
  type CreateRoomInput,
} from "@/lib/validations/schemas";
import type { RoomStatus } from "@prisma/client";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function toUiRoom(r: {
  number: string;
  type: string;
  status: RoomStatus;
  price: unknown;
  reason: string | null;
  activeForSale?: boolean;
}) {
  return {
    number: r.number,
    type: r.type,
    status: r.status as string,
    price: r.price != null ? Number(r.price) : undefined,
    reason: r.reason ?? undefined,
    activeForSale: r.activeForSale ?? true,
  };
}

/** Cena efektywna na datę: RatePlan (jeśli data w okresie) → Room.price → RoomType.basePrice */
export async function getEffectivePriceForRoomOnDate(
  roomNumber: string,
  dateStr: string
): Promise<number | undefined> {
  const date = new Date(dateStr + "T12:00:00Z");
  if (Number.isNaN(date.getTime())) return undefined;
  const room = await prisma.room.findUnique({ where: { number: roomNumber } });
  if (!room) return undefined;
  const roomType = await prisma.roomType.findUnique({ where: { name: room.type } }).catch(() => null);
  const ratePlan = await prisma.ratePlan.findFirst({
    where: {
      roomTypeId: roomType?.id ?? "",
      validFrom: { lte: date },
      validTo: { gte: date },
    },
    orderBy: { validFrom: "desc" },
  }).catch(() => null);
  if (ratePlan?.price != null) return Number(ratePlan.price);
  if (room.price != null) return Number(room.price);
  if (roomType?.basePrice != null) return Number(roomType.basePrice);
  return undefined;
}

/** Batch: ceny efektywne na daty (klucz `${roomNumber}-${dateStr}`) */
export async function getEffectivePricesBatch(
  requests: { roomNumber: string; dateStr: string }[]
): Promise<Record<string, number>> {
  if (requests.length === 0) return {};
  const result: Record<string, number> = {};
  const rooms = await prisma.room.findMany({
    where: { number: { in: Array.from(new Set(requests.map((r) => r.roomNumber))) } },
    select: { number: true, type: true, price: true },
  });
  const roomByNumber = new Map(rooms.map((r) => [r.number, r]));
  const typeNames = Array.from(new Set(rooms.map((r) => r.type)));
  const roomTypes = await prisma.roomType.findMany({
    where: { name: { in: typeNames } },
    select: { id: true, name: true, basePrice: true },
  }).catch(() => []);
  const typeByName = new Map(roomTypes.map((t) => [t.name, t]));
  const ratePlans = typeNames.length > 0
    ? await prisma.ratePlan.findMany({
        where: { roomType: { name: { in: typeNames } } },
        select: { roomTypeId: true, validFrom: true, validTo: true, price: true },
      }).catch(() => [])
    : [];
  for (const { roomNumber, dateStr } of requests) {
    const key = `${roomNumber}-${dateStr}`;
    const room = roomByNumber.get(roomNumber);
    if (!room) continue;
    const date = new Date(dateStr + "T12:00:00Z");
    const type = typeByName.get(room.type);
    const plan = ratePlans.find(
      (p) => p.roomTypeId === type?.id && date >= p.validFrom && date <= p.validTo
    );
    const price = plan?.price != null
      ? Number(plan.price)
      : room.price != null
        ? Number(room.price)
        : type?.basePrice != null
          ? Number(type.basePrice)
          : undefined;
    if (price != null && price >= 0) result[key] = price;
  }
  return result;
}

/** Informacja o stawce sezonowej na dany dzień (np. non-refund) – do wyświetlenia przy rezerwacji */
export async function getRatePlanInfoForRoomDate(
  roomNumber: string,
  dateStr: string
): Promise<{ isNonRefundable: boolean }> {
  const date = new Date(dateStr + "T12:00:00Z");
  if (Number.isNaN(date.getTime())) return { isNonRefundable: false };
  const room = await prisma.room.findUnique({ where: { number: roomNumber } });
  if (!room) return { isNonRefundable: false };
  const roomType = await prisma.roomType.findUnique({ where: { name: room.type } }).catch(() => null);
  if (!roomType) return { isNonRefundable: false };
  const plan = await prisma.ratePlan.findFirst({
    where: {
      roomTypeId: roomType.id,
      validFrom: { lte: date },
      validTo: { gte: date },
    },
    orderBy: { validFrom: "desc" },
  }).catch(() => null);
  return { isNonRefundable: plan?.isNonRefundable ?? false };
}

/** Pobiera listę pokoi do sprzedaży (tylko activeForSale) – dla grafiku, dostępności */
export async function getRooms(): Promise<
  ActionResult<Array<{ number: string; type: string; status: string; price?: number; reason?: string }>>
> {
  try {
    const [rooms, roomTypes] = await Promise.all([
      prisma.room.findMany({
        where: { activeForSale: true },
        orderBy: { number: "asc" },
      }),
      prisma.roomType.findMany({ select: { name: true, basePrice: true } }).catch(() => []),
    ]);
    const typePrice = new Map(
      roomTypes.map((t) => [t.name, t.basePrice != null ? Number(t.basePrice) : undefined])
    );
    return {
      success: true,
      data: rooms.map((r) => {
        const effectivePrice =
          r.price != null ? Number(r.price) : typePrice.get(r.type);
        return {
          ...toUiRoom(r),
          price: effectivePrice ?? toUiRoom(r).price,
        };
      }),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu pokoi",
    };
  }
}

export interface RoomForManagement {
  id: string;
  number: string;
  type: string;
  status: string;
  price?: number;
  reason?: string;
  activeForSale: boolean;
}

/** Pobiera wszystkie pokoje (w tym wycofane ze sprzedaży) – do zarządzania */
export async function getRoomsForManagement(): Promise<
  ActionResult<RoomForManagement[]>
> {
  try {
    const [rooms, roomTypes] = await Promise.all([
      prisma.room.findMany({ orderBy: { number: "asc" } }),
      prisma.roomType.findMany({ select: { name: true, basePrice: true } }).catch(() => []),
    ]);
    const typePrice = new Map(
      roomTypes.map((t) => [t.name, t.basePrice != null ? Number(t.basePrice) : undefined])
    );
    return {
      success: true,
      data: rooms.map((r) => {
        const effectivePrice =
          r.price != null ? Number(r.price) : typePrice.get(r.type);
        return {
          id: r.id,
          number: r.number,
          type: r.type,
          status: r.status as string,
          price: effectivePrice ?? (r.price != null ? Number(r.price) : undefined),
          reason: r.reason ?? undefined,
          activeForSale: r.activeForSale,
        };
      }),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu pokoi",
    };
  }
}

/** Tworzy nowy pokój. Typ musi istnieć (RoomType) lub zostanie utworzony. */
export async function createRoom(data: CreateRoomInput): Promise<
  ActionResult<RoomForManagement>
> {
  const parsed = createRoomSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Błąd walidacji" };
  }
  const { number, type, price } = parsed.data;
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    await ensureRoomTypes();
    await prisma.roomType.upsert({
      where: { name: type.trim() },
      create: { name: type.trim(), basePrice: null },
      update: {},
    });
    const existing = await prisma.room.findUnique({ where: { number: number.trim() } });
    if (existing) {
      return { success: false, error: `Pokój o numerze ${number} już istnieje.` };
    }
    const created = await prisma.room.create({
      data: {
        number: number.trim(),
        type: type.trim(),
        status: "CLEAN",
        price: price != null ? price : null,
        activeForSale: true,
      },
    });
    await createAuditLog({
      actionType: "CREATE",
      entityType: "Room",
      entityId: created.id,
      newValue: {
        number: created.number,
        type: created.type,
        status: created.status,
        price: created.price != null ? Number(created.price) : null,
        activeForSale: created.activeForSale,
      },
      ipAddress: ip,
    });
    revalidatePath("/front-office");
    revalidatePath("/pokoje");
    revalidatePath("/cennik");
    const roomTypes = await prisma.roomType.findMany({ select: { name: true, basePrice: true } });
    const typePrice = roomTypes.find((t) => t.name === created.type)?.basePrice;
    return {
      success: true,
      data: {
        id: created.id,
        number: created.number,
        type: created.type,
        status: created.status as string,
        price: created.price != null ? Number(created.price) : typePrice != null ? Number(typePrice) : undefined,
        reason: created.reason ?? undefined,
        activeForSale: created.activeForSale,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia pokoju",
    };
  }
}

/** Ustawia pokój jako dostępny / wycofany ze sprzedaży */
export async function updateRoomActiveForSale(
  roomId: string,
  activeForSale: boolean
): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const prev = await prisma.room.findUnique({ where: { id: roomId } });
    if (!prev) return { success: false, error: "Pokój nie istnieje" };

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: { activeForSale },
    });
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Room",
      entityId: roomId,
      oldValue: { ...toUiRoom(prev), activeForSale: prev.activeForSale },
      newValue: { ...toUiRoom(updated), activeForSale: updated.activeForSale },
      ipAddress: ip,
    });
    revalidatePath("/front-office");
    revalidatePath("/pokoje");
    revalidatePath("/cennik");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji pokoju",
    };
  }
}

/** Usuwa pokój na stałe. Możliwe tylko gdy brak rezerwacji powiązanych z tym pokojem. */
export async function deleteRoom(roomId: string): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { _count: { select: { reservations: true } } },
    });
    if (!room) return { success: false, error: "Pokój nie istnieje" };
    if (room._count.reservations > 0) {
      return {
        success: false,
        error: "Nie można usunąć pokoju z istniejącymi rezerwacjami. Wycofaj go ze sprzedaży zamiast usuwać.",
      };
    }
    await createAuditLog({
      actionType: "DELETE",
      entityType: "Room",
      entityId: roomId,
      oldValue: { number: room.number, type: room.type, status: room.status },
      ipAddress: ip,
    });
    await prisma.room.delete({ where: { id: roomId } });
    revalidatePath("/front-office");
    revalidatePath("/pokoje");
    revalidatePath("/cennik");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania pokoju",
    };
  }
}

export interface CennikRoom {
  id: string;
  number: string;
  type: string;
  status: string;
  price: number | null;
  /** Cena bazowa z typu pokoju (gdy brak nadpisania na pokój) */
  typeBasePrice?: number | null;
}

/** Pobiera cennik na wybrany dzień (cena efektywna z RatePlan / Room / Type) */
export async function getCennikForDate(dateStr: string): Promise<ActionResult<CennikRoom[]>> {
  try {
    const date = new Date(dateStr + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) {
      return { success: false, error: "Nieprawidłowa data." };
    }
    const [rooms, roomTypes, ratePlans] = await Promise.all([
      prisma.room.findMany({
        orderBy: { number: "asc" },
        select: { id: true, number: true, type: true, status: true, price: true },
      }),
      prisma.roomType.findMany({ select: { id: true, name: true, basePrice: true } }),
      prisma.ratePlan.findMany({
        where: { validFrom: { lte: date }, validTo: { gte: date } },
        select: { roomTypeId: true, price: true },
      }),
    ]);
    const typeByName = new Map(roomTypes.map((t) => [t.name, t]));
    const planByTypeId = new Map(ratePlans.map((p) => [p.roomTypeId, Number(p.price)]));
    return {
      success: true,
      data: rooms.map((r) => {
        const type = typeByName.get(r.type);
        const planPrice = type ? planByTypeId.get(type.id) : undefined;
        const effectivePrice =
          planPrice ?? (r.price != null ? Number(r.price) : null) ?? (type?.basePrice != null ? Number(type.basePrice) : null);
        return {
          id: r.id,
          number: r.number,
          type: r.type,
          status: r.status as string,
          price: effectivePrice,
          typeBasePrice: type?.basePrice != null ? Number(type.basePrice) : null,
        };
      }),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu cennika na dzień",
    };
  }
}

/** Pobiera pokoje z cenami dla modułu Cennik (z ceną bazową typu) */
export async function getRoomsForCennik(): Promise<ActionResult<CennikRoom[]>> {
  try {
    const [rooms, roomTypes] = await Promise.all([
      prisma.room.findMany({
        orderBy: { number: "asc" },
        select: { id: true, number: true, type: true, status: true, price: true },
      }),
      prisma.roomType.findMany({ select: { name: true, basePrice: true } }),
    ]);
    const typePriceByName = new Map(
      roomTypes.map((t) => [t.name, t.basePrice != null ? Number(t.basePrice) : null])
    );
    return {
      success: true,
      data: rooms.map((r) => ({
        id: r.id,
        number: r.number,
        type: r.type,
        status: r.status as string,
        price: r.price != null ? Number(r.price) : null,
        typeBasePrice: typePriceByName.get(r.type) ?? null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu cennika",
    };
  }
}

export interface RoomTypeForCennik {
  id: string;
  name: string;
  basePrice: number | null;
  sortOrder: number;
}

/** Pobiera typy pokoi z cenami bazowymi */
export async function getRoomTypes(): Promise<ActionResult<RoomTypeForCennik[]>> {
  try {
    const types = await prisma.roomType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, basePrice: true, sortOrder: true },
    });
    return {
      success: true,
      data: types.map((t) => ({
        id: t.id,
        name: t.name,
        basePrice: t.basePrice != null ? Number(t.basePrice) : null,
        sortOrder: t.sortOrder ?? 0,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu typów pokoi",
    };
  }
}

/** Tworzy brakujące typy pokoi na podstawie Room.type */
export async function ensureRoomTypes(): Promise<ActionResult> {
  try {
    const distinct = await prisma.room.findMany({
      select: { type: true },
      distinct: ["type"],
    });
    for (const { type } of distinct) {
      await prisma.roomType.upsert({
        where: { name: type },
        create: { name: type, basePrice: null },
        update: {},
      });
    }
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd synchronizacji typów",
    };
  }
}

/** Aktualizuje cenę bazową typu pokoju */
export async function updateRoomTypeBasePrice(
  roomTypeId: string,
  basePrice: number
): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  if (basePrice < 0 || !Number.isFinite(basePrice)) {
    return { success: false, error: "Cena musi być liczbą nieujemną." };
  }
  try {
    const prev = await prisma.roomType.findUnique({ where: { id: roomTypeId } });
    if (!prev) return { success: false, error: "Typ pokoju nie istnieje" };
    await prisma.roomType.update({
      where: { id: roomTypeId },
      data: { basePrice: basePrice },
    });
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "RoomType",
      entityId: roomTypeId,
      oldValue: { basePrice: prev.basePrice != null ? Number(prev.basePrice) : null } as unknown as Record<string, unknown>,
      newValue: { basePrice } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });
    revalidatePath("/cennik");
    revalidatePath("/front-office");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji ceny typu",
    };
  }
}

/** Aktualizuje nazwę typu pokoju */
export async function updateRoomTypeName(
  roomTypeId: string,
  name: string
): Promise<ActionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Nazwa wymagana." };
  try {
    await prisma.roomType.update({
      where: { id: roomTypeId },
      data: { name: trimmed },
    });
    revalidatePath("/cennik");
    revalidatePath("/front-office");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji nazwy typu",
    };
  }
}

/** Kopiuje stawki sezonowe z roku na rok (przesunięcie dat) */
export async function copyRatePlansFromYearToYear(
  fromYear: number,
  toYear: number
): Promise<ActionResult<{ copied: number }>> {
  try {
    const plans = await prisma.ratePlan.findMany({
      where: {
        validFrom: { gte: new Date(`${fromYear}-01-01`) },
        validTo: { lte: new Date(`${fromYear}-12-31`) },
      },
      include: { roomType: true },
    });
    let copied = 0;
    for (const p of plans) {
      const from = new Date(p.validFrom);
      const to = new Date(p.validTo);
      const shiftYears = toYear - fromYear;
      from.setFullYear(from.getFullYear() + shiftYears);
      to.setFullYear(to.getFullYear() + shiftYears);
      await prisma.ratePlan.create({
        data: {
          roomTypeId: p.roomTypeId,
          validFrom: from,
          validTo: to,
          price: p.price,
          minStayNights: p.minStayNights,
          maxStayNights: p.maxStayNights,
          isNonRefundable: p.isNonRefundable,
        },
      });
      copied++;
    }
    revalidatePath("/cennik");
    return { success: true, data: { copied } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd kopiowania stawek",
    };
  }
}

export interface RatePlanForCennik {
  id: string;
  roomTypeName: string;
  roomTypeId: string;
  validFrom: string;
  validTo: string;
  price: number;
  minStayNights: number | null;
  maxStayNights: number | null;
  isNonRefundable: boolean;
}

/** Lista stawek sezonowych */
export async function getRatePlans(): Promise<ActionResult<RatePlanForCennik[]>> {
  try {
    const plans = await prisma.ratePlan.findMany({
      orderBy: [{ validFrom: "asc" }, { roomTypeId: "asc" }],
      include: { roomType: { select: { name: true } } },
    });
    return {
      success: true,
      data: plans.map((p) => ({
        id: p.id,
        roomTypeName: p.roomType.name,
        roomTypeId: p.roomTypeId,
        validFrom: p.validFrom.toISOString().slice(0, 10),
        validTo: p.validTo.toISOString().slice(0, 10),
        price: Number(p.price),
        minStayNights: p.minStayNights,
        maxStayNights: p.maxStayNights,
        isNonRefundable: p.isNonRefundable ?? false,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu stawek sezonowych",
    };
  }
}

/** Dodaje stawkę sezonową */
export async function createRatePlan(data: {
  roomTypeId: string;
  validFrom: string;
  validTo: string;
  price: number;
  minStayNights?: number | null;
  maxStayNights?: number | null;
  isNonRefundable?: boolean;
}): Promise<ActionResult<RatePlanForCennik>> {
  if (data.price < 0 || !Number.isFinite(data.price)) {
    return { success: false, error: "Cena musi być liczbą nieujemną." };
  }
  const from = new Date(data.validFrom + "T12:00:00Z");
  const to = new Date(data.validTo + "T12:00:00Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return { success: false, error: "Nieprawidłowy zakres dat." };
  }
  try {
    const created = await prisma.ratePlan.create({
      data: {
        roomTypeId: data.roomTypeId,
        validFrom: from,
        validTo: to,
        price: data.price,
        minStayNights: data.minStayNights ?? null,
        maxStayNights: data.maxStayNights ?? null,
        isNonRefundable: data.isNonRefundable ?? false,
      },
      include: { roomType: { select: { name: true } } },
    });
    revalidatePath("/cennik");
    return {
      success: true,
      data: {
        id: created.id,
        roomTypeName: created.roomType.name,
        roomTypeId: created.roomTypeId,
        validFrom: created.validFrom.toISOString().slice(0, 10),
        validTo: created.validTo.toISOString().slice(0, 10),
        price: Number(created.price),
        minStayNights: created.minStayNights,
        maxStayNights: created.maxStayNights,
        isNonRefundable: created.isNonRefundable ?? false,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu stawki sezonowej",
    };
  }
}

/** Usuwa stawkę sezonową */
export async function deleteRatePlan(id: string): Promise<ActionResult> {
  try {
    await prisma.ratePlan.delete({ where: { id } });
    revalidatePath("/cennik");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usunięcia stawki",
    };
  }
}

/** Aktualizuje cenę pokoju (Cennik); zapis do AuditLog */
export async function updateRoomPrice(roomId: string, price: number): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  if (price < 0 || !Number.isFinite(price)) {
    return { success: false, error: "Cena musi być liczbą nieujemną." };
  }

  try {
    const prev = await prisma.room.findUnique({ where: { id: roomId } });
    if (!prev) return { success: false, error: "Pokój nie istnieje" };

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: { price },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Room",
      entityId: roomId,
      oldValue: { price: prev.price != null ? Number(prev.price) : null } as unknown as Record<string, unknown>,
      newValue: { price } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/cennik");
    revalidatePath("/front-office");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji ceny",
    };
  }
}

export interface PriceChangeEntry {
  roomId: string;
  roomNumber: string;
  timestamp: string;
  oldPrice: number | null;
  newPrice: number | null;
}

/** Ostatnie zmiany cen (z AuditLog) – do podglądu w Cenniku */
export async function getPriceChangeHistory(
  limit = 30
): Promise<ActionResult<PriceChangeEntry[]>> {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { entityType: "Room", entityId: { not: null } },
      orderBy: { timestamp: "desc" },
      take: limit * 2,
    });
    const withPrice = logs.filter((log) => {
      const o = log.oldValue as Record<string, unknown> | null;
      const n = log.newValue as Record<string, unknown> | null;
      return (o && "price" in o) || (n && "price" in n);
    }).slice(0, limit);
    const roomIds = Array.from(new Set(withPrice.map((l) => l.entityId).filter(Boolean))) as string[];
    const rooms = await prisma.room.findMany({
      where: { id: { in: roomIds } },
      select: { id: true, number: true },
    });
    const byId = new Map(rooms.map((r) => [r.id, r.number]));
    const data: PriceChangeEntry[] = withPrice.map((log) => {
      const o = log.oldValue as { price?: number } | null;
      const n = log.newValue as { price?: number } | null;
      return {
        roomId: log.entityId!,
        roomNumber: byId.get(log.entityId!) ?? log.entityId!,
        timestamp: log.timestamp.toISOString(),
        oldPrice: o?.price ?? null,
        newPrice: n?.price ?? null,
      };
    });
    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu historii cen",
    };
  }
}

/** Pobiera tylko wolne pokoje w danym terminie (Gap 2.1 – meldunek) */
export async function getAvailableRoomsForDates(
  checkIn: string,
  checkOut: string
): Promise<
  ActionResult<Array<{ number: string; type: string; status: string; price?: number; reason?: string }>>
> {
  try {
    const from = new Date(checkIn + "T00:00:00.000Z");
    const to = new Date(checkOut + "T00:00:00.000Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const rooms = await prisma.room.findMany({
      where: { status: "CLEAN", activeForSale: true },
      orderBy: { number: "asc" },
    });

    const reservations = await prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkIn: { lt: to },
        checkOut: { gt: from },
      },
      select: { roomId: true },
    });

    const occupiedRoomIds = new Set(reservations.map((r) => r.roomId));
    const available = rooms.filter((r) => !occupiedRoomIds.has(r.id));
    return { success: true, data: available.map(toUiRoom) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu dostępności pokoi",
    };
  }
}

export interface HousekeepingRoom {
  id: string;
  number: string;
  type: string;
  status: string;
  reason?: string;
  updatedAt: string;
}

/** Pobiera pokoje dla Housekeeping (z id i updatedAt do sync) */
export async function getRoomsForHousekeeping(): Promise<
  ActionResult<HousekeepingRoom[]>
> {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: { number: "asc" },
      select: { id: true, number: true, type: true, status: true, reason: true, updatedAt: true },
    });
    return {
      success: true,
      data: rooms.map((r) => ({
        id: r.id,
        number: r.number,
        type: r.type,
        status: r.status as string,
        reason: r.reason ?? undefined,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu pokoi",
    };
  }
}

/** Aktualizuje status pokoju (Housekeeping) */
export async function updateRoomStatus(input: RoomStatusInput): Promise<ActionResult> {
  const parsed = roomStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Błąd walidacji" };
  }
  const { roomId, status, reason } = parsed.data;

  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const prev = await prisma.room.findUnique({ where: { id: roomId } });
    if (!prev) return { success: false, error: "Pokój nie istnieje" };

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: { status, reason: reason ?? null },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Room",
      entityId: roomId,
      oldValue: toUiRoom(prev) as unknown as Record<string, unknown>,
      newValue: toUiRoom(updated) as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/front-office");
    revalidatePath("/housekeeping");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji statusu pokoju",
    };
  }
}
