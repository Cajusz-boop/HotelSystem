"use server";

import { headers } from "next/headers";
import { getEffectivePropertyId } from "@/app/actions/properties";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createAuditLog, getClientIp } from "@/lib/audit";
import {
  roomStatusSchema,
  createRoomSchema,
  roomBlockSchema,
  type RoomStatusInput,
  type CreateRoomInput,
  type RoomBlockInput,
} from "@/lib/validations/schemas";
import type { RoomStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

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

/**
 * Cena efektywna na datę: RatePlan (jeśli data w okresie) → Room.price → RoomType.basePrice.
 * @param roomNumber - numer pokoju
 * @param dateStr - data YYYY-MM-DD
 * @returns cena (number) lub undefined gdy brak pokoju/nieprawidłowa data
 */
export async function getEffectivePriceForRoomOnDate(
  roomNumber: string,
  dateStr: string
): Promise<number | undefined> {
  if (!roomNumber?.trim() || !dateStr?.trim()) return undefined;
  const date = new Date(dateStr.trim() + "T12:00:00Z");
  if (Number.isNaN(date.getTime())) return undefined;
  const room = await prisma.room.findUnique({ where: { number: roomNumber.trim() } });
  if (!room) return undefined;
  let roomType: Awaited<ReturnType<typeof prisma.roomType.findUnique>> = null;
  try {
    roomType = await prisma.roomType.findUnique({ where: { name: room.type } });
  } catch (error) {
    console.error("[getEffectivePriceForRoom] roomType.findUnique error:", error instanceof Error ? error.message : String(error));
  }
  let ratePlan: Awaited<ReturnType<typeof prisma.ratePlan.findFirst>> = null;
  try {
    ratePlan = await prisma.ratePlan.findFirst({
      where: {
        roomTypeId: roomType?.id ?? "",
        validFrom: { lte: date },
        validTo: { gte: date },
      },
      orderBy: { validFrom: "desc" },
    });
  } catch (error) {
    console.error("[getEffectivePriceForRoom] ratePlan.findFirst error:", error instanceof Error ? error.message : String(error));
  }
  if (ratePlan?.price != null) return Number(ratePlan.price);
  if (room.price != null) return Number(room.price);
  if (roomType?.basePrice != null) return Number(roomType.basePrice);
  return undefined;
}

/**
 * Batch: ceny efektywne na daty (klucz `${roomNumber}-${dateStr}`).
 * @param requests - tablica { roomNumber, dateStr }
 * @returns obiekt Record<key, price>
 */
export async function getEffectivePricesBatch(
  requests: { roomNumber: string; dateStr: string }[]
): Promise<Record<string, number>> {
  if (!Array.isArray(requests) || requests.length === 0) return {};
  const result: Record<string, number> = {};
  const rooms = await prisma.room.findMany({
    where: { number: { in: Array.from(new Set(requests.map((r) => r.roomNumber))) } },
    select: { number: true, type: true, price: true },
  });
  const roomByNumber = new Map(rooms.map((r) => [r.number, r]));
  const typeNames = Array.from(new Set(rooms.map((r) => r.type)));
  let roomTypes: Array<{ id: string; name: string; basePrice: Prisma.Decimal | null }> = [];
  try {
    roomTypes = await prisma.roomType.findMany({
      where: { name: { in: typeNames } },
      select: { id: true, name: true, basePrice: true },
    });
  } catch (error) {
    console.error("[getEffectivePricesBatch] roomType.findMany error:", error instanceof Error ? error.message : String(error));
  }
  const typeByName = new Map(roomTypes.map((t) => [t.name, t]));
  let ratePlans: Array<{ roomTypeId: string; validFrom: Date; validTo: Date; price: Prisma.Decimal }> = [];
  if (typeNames.length > 0) {
    try {
      ratePlans = await prisma.ratePlan.findMany({
        where: { roomType: { name: { in: typeNames } } },
        select: { roomTypeId: true, validFrom: true, validTo: true, price: true },
      });
    } catch (error) {
      console.error("[getEffectivePricesBatch] ratePlan.findMany error:", error instanceof Error ? error.message : String(error));
    }
  }
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
  let roomType: Awaited<ReturnType<typeof prisma.roomType.findUnique>> = null;
  try {
    roomType = await prisma.roomType.findUnique({ where: { name: room.type } });
  } catch (error) {
    console.error("[getRatePlanInfoForRoomDate] roomType.findUnique error:", error instanceof Error ? error.message : String(error));
  }
  if (!roomType) return { isNonRefundable: false };
  let plan: Awaited<ReturnType<typeof prisma.ratePlan.findFirst>> = null;
  try {
    plan = await prisma.ratePlan.findFirst({
      where: {
        roomTypeId: roomType.id,
        validFrom: { lte: date },
        validTo: { gte: date },
      },
      orderBy: { validFrom: "desc" },
    });
  } catch (error) {
    console.error("[getRatePlanInfoForRoomDate] ratePlan.findFirst error:", error instanceof Error ? error.message : String(error));
  }
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
      prisma.roomType.findMany({ select: { name: true, basePrice: true } }).catch(() => [] as { name: string; basePrice: unknown }[]),
    ]);
    const typePrice = new Map<string, number | undefined>(
      roomTypes.map((t) => [t.name, t.basePrice != null ? Number(t.basePrice) : undefined] as [string, number | undefined])
    );
    return {
      success: true,
      data: rooms.map((r) => {
        const effectivePrice =
          r.price != null ? Number(r.price) : typePrice.get(r.type);
        return {
          ...toUiRoom(r),
          price: effectivePrice ?? undefined,
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

export interface InventoryItem {
  item: string;
  count: number;
}

export interface RoomForManagement {
  id: string;
  number: string;
  type: string;
  status: string;
  price: number | null;
  reason?: string;
  beds: number;
  bedTypes: string[];
  photos: string[];
  amenities: string[];
  inventory: InventoryItem[];
  connectedRooms: string[];
  floor: string | null;
  building: string | null;
  view: string | null;
  exposure: string | null;
  maxOccupancy: number;
  surfaceArea: number | null;
  description: string | null;
  technicalNotes: string | null;
  nextServiceDate: string | null;
  nextServiceNote: string | null;
  roomFeatures: string[];
  roomTypeId: string | null;
  activeForSale: boolean;
}

/** Pobiera wszystkie pokoje (w tym wycofane ze sprzedaży) – do zarządzania */
export async function getRoomsForManagement(): Promise<
  ActionResult<RoomForManagement[]>
> {
  try {
    const propertyId = await getEffectivePropertyId();
    const [rooms, roomTypes] = await Promise.all([
      prisma.room.findMany({
        where: propertyId ? { propertyId } : {},
        orderBy: { number: "asc" },
      }),
      prisma.roomType.findMany({ select: { id: true, name: true, basePrice: true } }).catch(() => [] as { id: string; name: string; basePrice: unknown }[]),
    ]);
    const typeData = new Map<string, { basePrice: number | null; id: string }>(
      roomTypes.map((t) => [t.name, { basePrice: t.basePrice != null ? Number(t.basePrice) : null, id: t.id }]) as [string, { basePrice: number | null; id: string }][]
    );
    return {
      success: true,
      data: rooms.map((r) => {
        const rtData = typeData.get(r.type);
        const effectivePrice = r.price != null ? Number(r.price) : rtData?.basePrice ?? null;
        return {
          id: r.id,
          number: r.number,
          type: r.type,
          status: r.status as string,
          price: effectivePrice,
          reason: r.reason ?? undefined,
          beds: r.beds,
          bedTypes: (r.bedTypes as string[] | null) ?? [],
          photos: (r.photos as string[] | null) ?? [],
          amenities: (r.amenities as string[] | null) ?? [],
          inventory: (r.inventory as InventoryItem[] | null) ?? [],
          connectedRooms: (r.connectedRooms as string[] | null) ?? [],
          floor: r.floor,
          building: r.building,
          view: r.view,
          exposure: r.exposure,
          maxOccupancy: r.maxOccupancy,
          surfaceArea: r.surfaceArea != null ? Number(r.surfaceArea) : null,
          description: r.description,
          technicalNotes: r.technicalNotes,
          nextServiceDate: r.nextServiceDate?.toISOString().slice(0, 10) ?? null,
          nextServiceNote: r.nextServiceNote,
          roomFeatures: (r.roomFeatures as string[] | null) ?? [],
          roomTypeId: rtData?.id ?? null,
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
  const { number, type, price, beds } = parsed.data;
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
    const propertyId = await getEffectivePropertyId();
    const created = await prisma.room.create({
      data: {
        ...(propertyId ? { propertyId } : {}),
        number: number.trim(),
        type: type.trim(),
        status: "CLEAN",
        price: price != null ? price : null,
        beds: beds ?? 1,
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
        price: created.price != null ? Number(created.price) : typePrice != null ? Number(typePrice) : null,
        reason: created.reason ?? undefined,
        beds: created.beds ?? 1,
        bedTypes: [],
        photos: [],
        amenities: [],
        inventory: [],
        connectedRooms: [],
        floor: created.floor ?? null,
        building: created.building ?? null,
        view: created.view ?? null,
        exposure: created.exposure ?? null,
        maxOccupancy: created.maxOccupancy ?? 2,
        surfaceArea: created.surfaceArea != null ? Number(created.surfaceArea) : null,
        description: created.description ?? null,
        technicalNotes: created.technicalNotes ?? null,
        nextServiceDate: created.nextServiceDate?.toISOString().slice(0, 10) ?? null,
        nextServiceNote: created.nextServiceNote ?? null,
        roomFeatures: (created.roomFeatures as string[] | null) ?? [],
        roomTypeId: null,
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

export type RoomBlockType = "RENOVATION" | "MAINTENANCE" | "VIP_HOLD" | "OVERBOOKING" | "OWNER_HOLD" | "OTHER";

export interface RoomBlockItem {
  id: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  blockType: RoomBlockType;
  createdAt: string;
}

/** Tworzy blokadę pokoju (OOO) na podane daty. */
export async function createRoomBlock(
  input: RoomBlockInput & { blockType?: RoomBlockType }
): Promise<
  ActionResult<{ id: string; roomNumber: string; startDate: string; endDate: string; reason?: string; blockType: RoomBlockType }>
> {
  const parsed = roomBlockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Błąd walidacji" };
  }
  const { roomNumber, startDate, endDate, reason } = parsed.data;
  const blockType = input.blockType ?? "OTHER";
  try {
    const room = await prisma.room.findUnique({ where: { number: roomNumber } });
    if (!room) return { success: false, error: `Pokój ${roomNumber} nie istnieje` };
    const block = await prisma.roomBlock.create({
      data: {
        roomId: room.id,
        startDate: new Date(startDate + "T12:00:00Z"),
        endDate: new Date(endDate + "T12:00:00Z"),
        reason: reason?.trim() || null,
        blockType,
      },
    });
    revalidatePath("/front-office");
    revalidatePath("/pokoje");
    return {
      success: true,
      data: {
        id: block.id,
        roomNumber: room.number,
        startDate,
        endDate,
        reason: block.reason ?? undefined,
        blockType: block.blockType as RoomBlockType,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia blokady",
    };
  }
}

/** Usuwa blokadę pokoju. */
export async function deleteRoomBlock(blockId: string): Promise<ActionResult> {
  try {
    await prisma.roomBlock.delete({ where: { id: blockId } });
    revalidatePath("/front-office");
    revalidatePath("/pokoje");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania blokady",
    };
  }
}

/** Pobiera aktywne blokady pokoi (trwające lub nadchodzące). */
export async function getActiveRoomBlocks(): Promise<ActionResult<RoomBlockItem[]>> {
  try {
    const propertyId = await getEffectivePropertyId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const blocks = await prisma.roomBlock.findMany({
      where: {
        endDate: { gte: today },
        room: propertyId ? { propertyId } : undefined,
      },
      include: {
        room: { select: { number: true, type: true } },
      },
      orderBy: { startDate: "asc" },
    });

    return {
      success: true,
      data: blocks.map((b) => ({
        id: b.id,
        roomId: b.roomId,
        roomNumber: b.room.number,
        roomType: b.room.type,
        startDate: b.startDate.toISOString().slice(0, 10),
        endDate: b.endDate.toISOString().slice(0, 10),
        reason: b.reason,
        blockType: b.blockType as RoomBlockType,
        createdAt: b.createdAt.toISOString(),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania blokad",
    };
  }
}

/** Pobiera blokady pokoi kończące się w najbliższych dniach (powiadomienia o zakończeniu remontu). */
export async function getRoomBlocksEndingSoon(
  daysAhead: number = 3
): Promise<ActionResult<RoomBlockItem[]>> {
  try {
    const propertyId = await getEffectivePropertyId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysAhead);

    const blocks = await prisma.roomBlock.findMany({
      where: {
        endDate: { gte: today, lte: endDate },
        room: propertyId ? { propertyId } : undefined,
      },
      include: {
        room: { select: { number: true, type: true } },
      },
      orderBy: { endDate: "asc" },
    });

    return {
      success: true,
      data: blocks.map((b) => ({
        id: b.id,
        roomId: b.roomId,
        roomNumber: b.room.number,
        roomType: b.room.type,
        startDate: b.startDate.toISOString().slice(0, 10),
        endDate: b.endDate.toISOString().slice(0, 10),
        reason: b.reason,
        blockType: b.blockType as RoomBlockType,
        createdAt: b.createdAt.toISOString(),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania blokad kończących się wkrótce",
    };
  }
}

/** Pobiera blokady dla konkretnego pokoju. */
export async function getRoomBlocksForRoom(roomId: string): Promise<ActionResult<RoomBlockItem[]>> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { number: true, type: true },
    });
    if (!room) {
      return { success: false, error: "Pokój nie istnieje" };
    }

    const blocks = await prisma.roomBlock.findMany({
      where: { roomId },
      orderBy: { startDate: "desc" },
    });

    return {
      success: true,
      data: blocks.map((b) => ({
        id: b.id,
        roomId: b.roomId,
        roomNumber: room.number,
        roomType: room.type,
        startDate: b.startDate.toISOString().slice(0, 10),
        endDate: b.endDate.toISOString().slice(0, 10),
        reason: b.reason,
        blockType: b.blockType as RoomBlockType,
        createdAt: b.createdAt.toISOString(),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania blokad pokoju",
    };
  }
}

/** Grupy pokoi (wirtualne pokoje, np. Apartament Rodzinny = 101+102). */
export async function getRoomGroups(): Promise<
  ActionResult<Array<{ id: string; name: string; roomNumbers: string[] }>>
> {
  try {
    const propertyId = await getEffectivePropertyId();
    const groups = await prisma.roomGroup.findMany({
      where: propertyId ? { propertyId } : {},
      orderBy: { name: "asc" },
      include: {
        rooms: { include: { room: { select: { number: true } } } },
      },
    });
    return {
      success: true,
      data: groups.map((g) => ({
        id: g.id,
        name: g.name,
        roomNumbers: g.rooms.map((r) => r.room.number).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu grup pokoi",
    };
  }
}

/** Tworzy grupę pokoi (wirtualny pokój). */
export async function createRoomGroup(
  name: string,
  roomNumbers: string[]
): Promise<ActionResult<{ id: string; name: string; roomNumbers: string[] }>> {
  const trimmedName = name.trim();
  if (!trimmedName) return { success: false, error: "Nazwa grupy wymagana" };
  if (roomNumbers.length < 2) return { success: false, error: "Wybierz co najmniej 2 pokoje" };
  try {
    const propertyId = await getEffectivePropertyId();
    const roomIds = await prisma.room.findMany({
      where: { number: { in: roomNumbers } },
      select: { id: true, number: true },
    });
    if (roomIds.length !== roomNumbers.length) {
      const found = new Set(roomIds.map((r) => r.number));
      const missing = roomNumbers.filter((n) => !found.has(n));
      return { success: false, error: `Nie znaleziono pokoi: ${missing.join(", ")}` };
    }
    const existingInGroup = await prisma.roomGroupRoom.findMany({
      where: { roomId: { in: roomIds.map((r) => r.id) } },
      include: { room: { select: { number: true } }, roomGroup: { select: { name: true } } },
    });
    if (existingInGroup.length > 0) {
      return {
        success: false,
        error: `Pokój ${existingInGroup[0].room.number} należy już do grupy "${existingInGroup[0].roomGroup.name}". Każdy pokój może być tylko w jednej grupie.`,
      };
    }
    const group = await prisma.roomGroup.create({
      data: {
        name: trimmedName,
        ...(propertyId ? { propertyId } : {}),
        rooms: {
          create: roomIds.map((r) => ({ roomId: r.id })),
        },
      },
      include: { rooms: { include: { room: { select: { number: true } } } } },
    });
    revalidatePath("/front-office");
    revalidatePath("/pokoje");
    return {
      success: true,
      data: {
        id: group.id,
        name: group.name,
        roomNumbers: group.rooms.map((r) => r.room.number).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia grupy",
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

/** Stawka sezonowa obowiązująca w danym dniu (do wydruku cennika) */
export interface RatePlanOnDate {
  id: string;
  roomTypeName: string;
  validFrom: string;
  validTo: string;
  price: number;
  isNonRefundable: boolean;
}

/** Pobiera stawki sezonowe obowiązujące w podanym dniu */
export async function getRatePlansForDate(dateStr: string): Promise<ActionResult<RatePlanOnDate[]>> {
  try {
    const date = new Date(dateStr + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) {
      return { success: false, error: "Nieprawidłowa data." };
    }
    const plans = await prisma.ratePlan.findMany({
      where: { validFrom: { lte: date }, validTo: { gte: date } },
      orderBy: [{ roomType: { sortOrder: "asc" } }, { roomType: { name: "asc" } }],
      include: { roomType: { select: { name: true } } },
    });
    return {
      success: true,
      data: plans.map((p) => ({
        id: p.id,
        roomTypeName: p.roomType.name,
        validFrom: p.validFrom.toISOString().slice(0, 10),
        validTo: p.validTo.toISOString().slice(0, 10),
        price: Number(p.price),
        isNonRefundable: p.isNonRefundable ?? false,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu stawek na dzień",
    };
  }
}

/** Pobiera cennik na wybrany dzień (cena efektywna z RatePlan / Room / Type) */
export async function getCennikForDate(dateStr: string): Promise<ActionResult<CennikRoom[]>> {
  try {
    const date = new Date(dateStr + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) {
      return { success: false, error: "Nieprawidłowa data." };
    }
    const propertyId = await getEffectivePropertyId();
    const [rooms, roomTypes, ratePlans] = await Promise.all([
      prisma.room.findMany({
        where: propertyId ? { propertyId } : {},
        orderBy: { number: "asc" },
        select: { id: true, number: true, type: true, status: true, price: true },
      }),
      prisma.roomType.findMany({ select: { id: true, name: true, basePrice: true } }),
      prisma.ratePlan.findMany({
        where: { validFrom: { lte: date }, validTo: { gte: date } },
        select: { roomTypeId: true, price: true, isWeekendHoliday: true },
      }),
    ]);
    const typeByName = new Map(roomTypes.map((t) => [t.name, t]));
    const day = date.getUTCDay();
    const isWeekend = day === 0 || day === 6;
    const plansByTypeId = new Map<string, { price: number; isWeekendHoliday: boolean }[]>();
    for (const p of ratePlans) {
      const list = plansByTypeId.get(p.roomTypeId) ?? [];
      list.push({ price: Number(p.price), isWeekendHoliday: p.isWeekendHoliday });
      plansByTypeId.set(p.roomTypeId, list);
    }
    const planByTypeId = new Map<string, number>();
    for (const [typeId, list] of plansByTypeId) {
      const preferred = list.find((x) => x.isWeekendHoliday === isWeekend) ?? list[0];
      if (preferred) planByTypeId.set(typeId, preferred.price);
    }
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
    const propertyId = await getEffectivePropertyId();
    const [rooms, roomTypes] = await Promise.all([
      prisma.room.findMany({
        where: propertyId ? { propertyId } : {},
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

/** Aktualizuje kolejność wyświetlania typu pokoju */
export async function updateRoomTypeSortOrder(
  roomTypeId: string,
  sortOrder: number
): Promise<ActionResult> {
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    return { success: false, error: "Kolejność musi być liczbą całkowitą nieujemną." };
  }
  try {
    await prisma.roomType.update({
      where: { id: roomTypeId },
      data: { sortOrder },
    });
    revalidatePath("/cennik");
    revalidatePath("/front-office");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji kolejności typu",
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
  isWeekendHoliday: boolean;
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
        isWeekendHoliday: p.isWeekendHoliday ?? false,
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
  isWeekendHoliday?: boolean;
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
        isWeekendHoliday: data.isWeekendHoliday ?? false,
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
        isWeekendHoliday: created.isWeekendHoliday ?? false,
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

    await prisma.room.update({
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

/** Aktualizacja cech pokoju (roomFeatures) */
export async function updateRoomFeatures(
  roomId: string,
  features: string[]
): Promise<ActionResult<{ features: string[] }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return { success: false, error: "Pokój nie istnieje." };
    }

    const oldFeatures = (room.roomFeatures as string[] | null) ?? [];

    await prisma.room.update({
      where: { id: roomId },
      data: { roomFeatures: features },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Room",
      entityId: roomId,
      oldValue: { roomFeatures: oldFeatures },
      newValue: { roomFeatures: features },
      ipAddress: ip,
    });

    revalidatePath("/pokoje");
    revalidatePath("/front-office");
    return { success: true, data: { features } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji cech pokoju",
    };
  }
}

/** Ogólna aktualizacja pokoju (wiele pól naraz) */
export async function updateRoom(
  roomId: string,
  data: {
    number?: string;
    type?: string;
    price?: number | null;
    beds?: number;
    bedTypes?: string[];
    photos?: string[];
    amenities?: string[];
    inventory?: InventoryItem[];
    floor?: string | null;
    building?: string | null;
    view?: string | null;
    exposure?: string | null;
    maxOccupancy?: number;
    surfaceArea?: number | null;
    roomFeatures?: string[];
    description?: string | null;
    technicalNotes?: string | null;
    nextServiceDate?: string | null;
    nextServiceNote?: string | null;
  }
): Promise<ActionResult<RoomForManagement>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return { success: false, error: "Pokój nie istnieje." };
    }

    // Sprawdź unikalność numeru jeśli zmieniony
    if (data.number && data.number !== room.number) {
      const existing = await prisma.room.findUnique({ where: { number: data.number } });
      if (existing) {
        return { success: false, error: `Pokój o numerze ${data.number} już istnieje.` };
      }
    }

    const updateData: {
      number?: string;
      type?: string;
      price?: number | null;
      beds?: number;
      bedTypes?: string[];
      photos?: string[];
      amenities?: string[];
      inventory?: InventoryItem[];
      floor?: string | null;
      building?: string | null;
      view?: string | null;
      exposure?: string | null;
      maxOccupancy?: number;
      surfaceArea?: number | null;
      roomFeatures?: string[];
      description?: string | null;
      technicalNotes?: string | null;
      nextServiceDate?: Date | null;
      nextServiceNote?: string | null;
    } = {};

    if (data.number !== undefined) updateData.number = data.number;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.price !== undefined) {
      if (data.price != null && (data.price < 0 || !Number.isFinite(data.price))) {
        return { success: false, error: "Cena pokoju nie może być ujemna" };
      }
      updateData.price = data.price;
    }
    if (data.beds !== undefined) updateData.beds = data.beds;
    if (data.bedTypes !== undefined) updateData.bedTypes = data.bedTypes;
    if (data.photos !== undefined) updateData.photos = data.photos;
    if (data.amenities !== undefined) updateData.amenities = data.amenities;
    if (data.inventory !== undefined) updateData.inventory = data.inventory;
    if (data.floor !== undefined) updateData.floor = data.floor;
    if (data.building !== undefined) updateData.building = data.building;
    if (data.view !== undefined) updateData.view = data.view;
    if (data.exposure !== undefined) updateData.exposure = data.exposure;
    if (data.maxOccupancy !== undefined) updateData.maxOccupancy = data.maxOccupancy;
    if (data.surfaceArea !== undefined) updateData.surfaceArea = data.surfaceArea;
    if (data.roomFeatures !== undefined) updateData.roomFeatures = data.roomFeatures;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.technicalNotes !== undefined) updateData.technicalNotes = data.technicalNotes;
    if (data.nextServiceDate !== undefined) {
      updateData.nextServiceDate = data.nextServiceDate ? new Date(data.nextServiceDate + "T00:00:00Z") : null;
    }
    if (data.nextServiceNote !== undefined) updateData.nextServiceNote = data.nextServiceNote;

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: updateData as Prisma.RoomUpdateInput,
    });

    // Pobierz RoomType ID na podstawie nazwy typu
    const roomType = await prisma.roomType.findUnique({ where: { name: updated.type } });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Room",
      entityId: roomId,
      oldValue: {
        number: room.number,
        type: room.type,
        price: room.price ? Number(room.price) : null,
        beds: room.beds,
        bedTypes: room.bedTypes,
        photos: room.photos,
        amenities: room.amenities,
        inventory: room.inventory,
        floor: room.floor,
        building: room.building,
        view: room.view,
        exposure: room.exposure,
        maxOccupancy: room.maxOccupancy,
        surfaceArea: room.surfaceArea ? Number(room.surfaceArea) : null,
        roomFeatures: room.roomFeatures,
      },
      newValue: updateData,
      ipAddress: ip,
    });

    revalidatePath("/pokoje");
    revalidatePath("/front-office");
    revalidatePath("/cennik");

    return {
      success: true,
      data: {
        id: updated.id,
        number: updated.number,
        type: updated.type,
        status: updated.status,
        price: updated.price ? Number(updated.price) : null,
        activeForSale: updated.activeForSale,
        beds: updated.beds,
        bedTypes: (updated.bedTypes as string[] | null) ?? [],
        photos: (updated.photos as string[] | null) ?? [],
        amenities: (updated.amenities as string[] | null) ?? [],
        inventory: (updated.inventory as InventoryItem[] | null) ?? [],
        connectedRooms: (updated.connectedRooms as string[] | null) ?? [],
        floor: updated.floor,
        building: updated.building,
        view: updated.view,
        exposure: updated.exposure,
        maxOccupancy: updated.maxOccupancy,
        surfaceArea: updated.surfaceArea ? Number(updated.surfaceArea) : null,
        description: updated.description,
        technicalNotes: updated.technicalNotes,
        nextServiceDate: updated.nextServiceDate?.toISOString().slice(0, 10) ?? null,
        nextServiceNote: updated.nextServiceNote,
        roomFeatures: (updated.roomFeatures as string[] | null) ?? [],
        roomTypeId: roomType?.id ?? null,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji pokoju",
    };
  }
}

/** Łączy dwa pokoje (symetrycznie – aktualizuje oba). Używane dla pokoi z drzwiami wewnętrznymi. */
export async function connectRooms(
  roomNumber1: string,
  roomNumber2: string
): Promise<ActionResult<{ room1: string; room2: string }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  if (roomNumber1 === roomNumber2) {
    return { success: false, error: "Nie można połączyć pokoju ze sobą." };
  }

  try {
    const [room1, room2] = await Promise.all([
      prisma.room.findUnique({ where: { number: roomNumber1 } }),
      prisma.room.findUnique({ where: { number: roomNumber2 } }),
    ]);

    if (!room1) return { success: false, error: `Pokój ${roomNumber1} nie istnieje.` };
    if (!room2) return { success: false, error: `Pokój ${roomNumber2} nie istnieje.` };

    const connected1 = (room1.connectedRooms as string[] | null) ?? [];
    const connected2 = (room2.connectedRooms as string[] | null) ?? [];

    // Sprawdź czy już połączone
    if (connected1.includes(roomNumber2)) {
      return { success: false, error: `Pokoje ${roomNumber1} i ${roomNumber2} są już połączone.` };
    }

    // Dodaj symetryczną relację
    const newConnected1 = [...connected1, roomNumber2];
    const newConnected2 = [...connected2, roomNumber1];

    await Promise.all([
      prisma.room.update({
        where: { id: room1.id },
        data: { connectedRooms: newConnected1 },
      }),
      prisma.room.update({
        where: { id: room2.id },
        data: { connectedRooms: newConnected2 },
      }),
    ]);

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Room",
      entityId: room1.id,
      oldValue: { connectedRooms: connected1 },
      newValue: { connectedRooms: newConnected1, action: "connect", targetRoom: roomNumber2 },
      ipAddress: ip,
    });

    revalidatePath("/pokoje");
    return { success: true, data: { room1: roomNumber1, room2: roomNumber2 } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd łączenia pokoi",
    };
  }
}

/** Rozłącza dwa pokoje (symetrycznie). */
export async function disconnectRooms(
  roomNumber1: string,
  roomNumber2: string
): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const [room1, room2] = await Promise.all([
      prisma.room.findUnique({ where: { number: roomNumber1 } }),
      prisma.room.findUnique({ where: { number: roomNumber2 } }),
    ]);

    if (!room1) return { success: false, error: `Pokój ${roomNumber1} nie istnieje.` };
    if (!room2) return { success: false, error: `Pokój ${roomNumber2} nie istnieje.` };

    const connected1 = (room1.connectedRooms as string[] | null) ?? [];
    const connected2 = (room2.connectedRooms as string[] | null) ?? [];

    // Sprawdź czy w ogóle połączone
    if (!connected1.includes(roomNumber2)) {
      return { success: false, error: `Pokoje ${roomNumber1} i ${roomNumber2} nie są połączone.` };
    }

    // Usuń symetryczną relację
    const newConnected1 = connected1.filter((n) => n !== roomNumber2);
    const newConnected2 = connected2.filter((n) => n !== roomNumber1);

    await Promise.all([
      prisma.room.update({
        where: { id: room1.id },
        data: { connectedRooms: newConnected1 },
      }),
      prisma.room.update({
        where: { id: room2.id },
        data: { connectedRooms: newConnected2 },
      }),
    ]);

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Room",
      entityId: room1.id,
      oldValue: { connectedRooms: connected1 },
      newValue: { connectedRooms: newConnected1, action: "disconnect", targetRoom: roomNumber2 },
      ipAddress: ip,
    });

    revalidatePath("/pokoje");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd rozłączania pokoi",
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
    const propertyId = await getEffectivePropertyId();
    const rooms = await prisma.room.findMany({
      where: {
        status: "CLEAN",
        activeForSale: true,
        ...(propertyId ? { propertyId } : {}),
      },
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

export type CleaningPriority = "VIP_ARRIVAL" | "DEPARTURE" | "STAY_OVER" | "NORMAL";

export interface HousekeepingRoom {
  id: string;
  number: string;
  type: string;
  status: string;
  floor?: string;
  assignedHousekeeper?: string;
  estimatedCleaningMinutes?: number;
  reason?: string;
  cleaningPriority?: CleaningPriority;
  updatedAt: string;
}

/** Pobiera pokoje dla Housekeeping (z id i updatedAt do sync) */
export async function getRoomsForHousekeeping(): Promise<
  ActionResult<HousekeepingRoom[]>
> {
  try {
    const propertyId = await getEffectivePropertyId();
    const rooms = await prisma.room.findMany({
      where: propertyId ? { propertyId } : {},
      orderBy: { number: "asc" },
      select: { id: true, number: true, type: true, status: true, floor: true, assignedHousekeeper: true, estimatedCleaningMinutes: true, reason: true, cleaningPriority: true, updatedAt: true },
    });
    return {
      success: true,
      data: rooms.map((r) => ({
        id: r.id,
        number: r.number,
        type: r.type,
        status: r.status as string,
        floor: r.floor ?? undefined,
        assignedHousekeeper: r.assignedHousekeeper ?? undefined,
        estimatedCleaningMinutes: r.estimatedCleaningMinutes ?? undefined,
        reason: r.reason ?? undefined,
        cleaningPriority: (r.cleaningPriority as CleaningPriority) ?? undefined,
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

    // Po inspekcji (INSPECTED) automatycznie ustaw pokój na CLEAN – gotowy do zameldowania
    const statusToSave = status === "INSPECTED" ? "CLEAN" : status;

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: { status: statusToSave, reason: reason ?? null },
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

/** Przypisuje pokojową do pokoju */
export async function updateRoomHousekeeper(
  roomId: string,
  assignedHousekeeper: string | null
): Promise<ActionResult> {
  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return { success: false, error: "Pokój nie istnieje" };
    await prisma.room.update({
      where: { id: roomId },
      data: { assignedHousekeeper: assignedHousekeeper?.trim() || null },
    });
    revalidatePath("/housekeeping");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd przypisania" };
  }
}

/** Aktualizuje szacowany czas sprzątania pokoju (minuty) */
export async function updateRoomCleaningTime(
  roomId: string,
  estimatedCleaningMinutes: number | null
): Promise<ActionResult> {
  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return { success: false, error: "Pokój nie istnieje" };
    const value = estimatedCleaningMinutes != null && estimatedCleaningMinutes >= 0 ? estimatedCleaningMinutes : null;
    await prisma.room.update({
      where: { id: roomId },
      data: { estimatedCleaningMinutes: value },
    });
    revalidatePath("/housekeeping");
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd aktualizacji czasu sprzątania" };
  }
}

/** Przypisuje pokojową do wszystkich pokoi na piętrze */
export async function assignHousekeeperToFloor(
  propertyId: string,
  floor: string,
  housekeeperName: string
): Promise<ActionResult<{ updated: number }>> {
  try {
    const result = await prisma.room.updateMany({
      where: { propertyId, floor: floor || null },
      data: { assignedHousekeeper: housekeeperName.trim() || null },
    });
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { housekeepingFloorAssignments: true },
    });
    const current = (property?.housekeepingFloorAssignments as Record<string, string>) ?? {};
    const updated = { ...current, [floor]: housekeeperName.trim() || null };
    await prisma.property.update({
      where: { id: propertyId },
      data: { housekeepingFloorAssignments: updated },
    });
    revalidatePath("/housekeeping");
    return { success: true, data: { updated: result.count } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd przypisania" };
  }
}

/** Lista użytkowników z rolą HOUSEKEEPING (do dropdown) */
export async function getHousekeepingStaff(): Promise<ActionResult<Array<{ id: string; name: string }>>> {
  try {
    const users = await prisma.user.findMany({
      where: { role: "HOUSEKEEPING" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return { success: true, data: users };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Błąd odczytu" };
  }
}

// === Harmonogram sprzątania ===

export type CleaningScheduleStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export interface CleaningScheduleItem {
  id: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  assignedTo: string | null;
  scheduledDate: string;
  scheduledTime: string | null;
  estimatedDuration: number | null;
  status: CleaningScheduleStatus;
  priority: CleaningPriority | null;
  notes: string | null;
  completedAt: string | null;
  completedBy: string | null;
}

/** Pobiera harmonogram sprzątania na dany dzień */
export async function getCleaningScheduleForDate(
  dateStr: string
): Promise<ActionResult<CleaningScheduleItem[]>> {
  try {
    const date = new Date(dateStr + "T00:00:00Z");
    if (Number.isNaN(date.getTime())) {
      return { success: false, error: "Nieprawidłowa data" };
    }

    const propertyId = await getEffectivePropertyId();
    const schedules = await prisma.cleaningSchedule.findMany({
      where: {
        scheduledDate: date,
        ...(propertyId ? { propertyId } : {}),
      },
      include: {
        room: { select: { number: true, type: true } },
      },
      orderBy: [{ scheduledTime: "asc" }, { room: { number: "asc" } }],
    });

    return {
      success: true,
      data: schedules.map((s) => ({
        id: s.id,
        roomId: s.roomId,
        roomNumber: s.room.number,
        roomType: s.room.type,
        assignedTo: s.assignedTo,
        scheduledDate: s.scheduledDate.toISOString().slice(0, 10),
        scheduledTime: s.scheduledTime,
        estimatedDuration: s.estimatedDuration,
        status: s.status as CleaningScheduleStatus,
        priority: s.priority as CleaningPriority | null,
        notes: s.notes,
        completedAt: s.completedAt?.toISOString() ?? null,
        completedBy: s.completedBy,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu harmonogramu",
    };
  }
}

/** Dodaje wpis do harmonogramu sprzątania */
export async function createCleaningScheduleEntry(data: {
  roomId: string;
  scheduledDate: string;
  scheduledTime?: string;
  assignedTo?: string;
  estimatedDuration?: number;
  priority?: CleaningPriority;
  notes?: string;
}): Promise<ActionResult<CleaningScheduleItem>> {
  try {
    const room = await prisma.room.findUnique({ where: { id: data.roomId } });
    if (!room) {
      return { success: false, error: "Pokój nie istnieje" };
    }

    const date = new Date(data.scheduledDate + "T00:00:00Z");
    if (Number.isNaN(date.getTime())) {
      return { success: false, error: "Nieprawidłowa data" };
    }

    const propertyId = await getEffectivePropertyId();
    const created = await prisma.cleaningSchedule.create({
      data: {
        roomId: data.roomId,
        scheduledDate: date,
        scheduledTime: data.scheduledTime ?? null,
        assignedTo: data.assignedTo ?? null,
        estimatedDuration: data.estimatedDuration ?? null,
        priority: data.priority ?? null,
        notes: data.notes ?? null,
        ...(propertyId ? { propertyId } : {}),
      },
      include: {
        room: { select: { number: true, type: true } },
      },
    });

    revalidatePath("/housekeeping");
    return {
      success: true,
      data: {
        id: created.id,
        roomId: created.roomId,
        roomNumber: created.room.number,
        roomType: created.room.type,
        assignedTo: created.assignedTo,
        scheduledDate: created.scheduledDate.toISOString().slice(0, 10),
        scheduledTime: created.scheduledTime,
        estimatedDuration: created.estimatedDuration,
        status: created.status as CleaningScheduleStatus,
        priority: created.priority as CleaningPriority | null,
        notes: created.notes,
        completedAt: null,
        completedBy: null,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia wpisu harmonogramu",
    };
  }
}

/** Aktualizuje status wpisu harmonogramu */
export async function updateCleaningScheduleStatus(
  scheduleId: string,
  status: CleaningScheduleStatus,
  completedBy?: string
): Promise<ActionResult> {
  try {
    const updateData: { status: string; completedAt?: Date; completedBy?: string | null } = { status };
    if (status === "COMPLETED") {
      updateData.completedAt = new Date();
      let session: Awaited<ReturnType<typeof getSession>> = null;
      if (!completedBy) {
        try {
          session = await getSession();
        } catch (error) {
          console.error("[updateCleaningScheduleStatus] getSession error:", error instanceof Error ? error.message : String(error));
        }
      }
      updateData.completedBy = completedBy ?? session?.name ?? null;
    } else {
      updateData.completedAt = undefined;
      updateData.completedBy = null;
    }

    await prisma.cleaningSchedule.update({
      where: { id: scheduleId },
      data: updateData,
    });

    revalidatePath("/housekeeping");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji harmonogramu",
    };
  }
}

/** Raport wydajności pokojowych – liczba posprzątanych pokoi w okresie */
export interface HousekeeperPerformanceRow {
  name: string;
  roomsCompleted: number;
  totalEstimatedMinutes: number;
}

export async function getHousekeeperPerformanceReport(
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<HousekeeperPerformanceRow[]>> {
  try {
    const from = new Date(dateFrom + "T00:00:00Z");
    const to = new Date(dateTo + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const propertyId = await getEffectivePropertyId();
    const schedules = await prisma.cleaningSchedule.findMany({
      where: {
        status: "COMPLETED",
        completedAt: { gte: from, lte: to },
        ...(propertyId ? { propertyId } : {}),
      },
      select: { completedBy: true, assignedTo: true, estimatedDuration: true },
    });

    const byName = new Map<string, { roomsCompleted: number; totalEstimatedMinutes: number }>();
    for (const s of schedules) {
      const name = (s.completedBy ?? s.assignedTo)?.trim() || "Nieprzypisano";
      const row = byName.get(name) ?? { roomsCompleted: 0, totalEstimatedMinutes: 0 };
      row.roomsCompleted += 1;
      row.totalEstimatedMinutes += s.estimatedDuration ?? 0;
      byName.set(name, row);
    }

    const data = Array.from(byName.entries())
      .map(([name, row]) => ({ name, ...row }))
      .sort((a, b) => b.roomsCompleted - a.roomsCompleted);

    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd raportu wydajności",
    };
  }
}

/** Usuwa wpis harmonogramu */
export async function deleteCleaningScheduleEntry(scheduleId: string): Promise<ActionResult> {
  try {
    await prisma.cleaningSchedule.delete({ where: { id: scheduleId } });
    revalidatePath("/housekeeping");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania wpisu harmonogramu",
    };
  }
}

/** Generuje harmonogram sprzątania na podstawie dzisiejszych rezerwacji */
export async function generateDailyCleaningSchedule(
  dateStr: string
): Promise<ActionResult<{ created: number }>> {
  try {
    const date = new Date(dateStr + "T00:00:00Z");
    if (Number.isNaN(date.getTime())) {
      return { success: false, error: "Nieprawidłowa data" };
    }

    const propertyId = await getEffectivePropertyId();
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // Znajdź pokoje które wymagają sprzątania:
    // 1. Wymeldowania dziś (checkout = date)
    // 2. Pokoje ze statusem DIRTY lub CHECKOUT_PENDING
    const [checkouts, dirtyRooms] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          checkOut: { gte: date, lt: nextDay },
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
        },
        select: { roomId: true },
      }),
      prisma.room.findMany({
        where: {
          status: { in: ["DIRTY", "CHECKOUT_PENDING"] },
          ...(propertyId ? { propertyId } : {}),
        },
        select: { id: true },
      }),
    ]);

    const roomIdsToClean = new Set([
      ...checkouts.map((c) => c.roomId),
      ...dirtyRooms.map((r) => r.id),
    ]);

    // Sprawdź które już mają wpisy na dziś
    const existingSchedules = await prisma.cleaningSchedule.findMany({
      where: {
        scheduledDate: date,
        roomId: { in: Array.from(roomIdsToClean) },
      },
      select: { roomId: true },
    });

    const alreadyScheduled = new Set(existingSchedules.map((s) => s.roomId));
    const toCreate = Array.from(roomIdsToClean).filter((id) => !alreadyScheduled.has(id));

    // Stwórz wpisy dla brakujących (z estimatedDuration z pokoju)
    if (toCreate.length > 0) {
      const roomsWithTime = await prisma.room.findMany({
        where: { id: { in: toCreate } },
        select: { id: true, estimatedCleaningMinutes: true },
      });
      const timeByRoom = new Map(roomsWithTime.map((r) => [r.id, r.estimatedCleaningMinutes]));
      await prisma.cleaningSchedule.createMany({
        data: toCreate.map((roomId) => ({
          roomId,
          scheduledDate: date,
          status: "PENDING",
          priority: checkouts.some((c) => c.roomId === roomId) ? "DEPARTURE" : "NORMAL",
          estimatedDuration: timeByRoom.get(roomId) ?? null,
          ...(propertyId ? { propertyId } : {}),
        })),
      });
    }

    revalidatePath("/housekeeping");
    return { success: true, data: { created: toCreate.length } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania harmonogramu",
    };
  }
}

/** Aktualizuje priorytet sprzątania pokoju */
export async function updateRoomCleaningPriority(
  roomId: string,
  priority: CleaningPriority | null
): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const prev = await prisma.room.findUnique({ where: { id: roomId } });
    if (!prev) return { success: false, error: "Pokój nie istnieje" };

    await prisma.room.update({
      where: { id: roomId },
      data: { cleaningPriority: priority },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Room",
      entityId: roomId,
      oldValue: { cleaningPriority: prev.cleaningPriority },
      newValue: { cleaningPriority: priority },
      ipAddress: ip,
    });

    revalidatePath("/housekeeping");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji priorytetu sprzątania",
    };
  }
}

// === Historia usterek/awarii pokoi ===

export type MaintenanceCategory =
  | "ELECTRICAL"
  | "PLUMBING"
  | "HVAC"
  | "FURNITURE"
  | "CLEANING"
  | "APPLIANCE"
  | "OTHER";

export type MaintenancePriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

export type MaintenanceStatus =
  | "REPORTED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "RESOLVED"
  | "CANCELLED";

export interface MaintenanceIssueItem {
  id: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  title: string;
  description: string | null;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reportedBy: string | null;
  reportedAt: string;
  assignedTo: string | null;
  assignedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  roomWasOOO: boolean;
  isScheduled: boolean;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
}

/** Pobiera historię usterek dla pokoju */
export async function getMaintenanceIssuesForRoom(
  roomId: string
): Promise<ActionResult<MaintenanceIssueItem[]>> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { number: true, type: true },
    });
    if (!room) {
      return { success: false, error: "Pokój nie istnieje" };
    }

    const issues = await prisma.maintenanceIssue.findMany({
      where: { roomId },
      orderBy: { reportedAt: "desc" },
    });

    return {
      success: true,
      data: issues.map((i) => ({
        id: i.id,
        roomId: i.roomId,
        roomNumber: room.number,
        roomType: room.type,
        title: i.title,
        description: i.description,
        category: i.category as MaintenanceCategory,
        priority: i.priority as MaintenancePriority,
        status: i.status as MaintenanceStatus,
        reportedBy: i.reportedBy,
        reportedAt: i.reportedAt.toISOString(),
        assignedTo: i.assignedTo,
        assignedAt: i.assignedAt?.toISOString() ?? null,
        resolvedAt: i.resolvedAt?.toISOString() ?? null,
        resolvedBy: i.resolvedBy,
        resolutionNotes: i.resolutionNotes,
        estimatedCost: i.estimatedCost ? Number(i.estimatedCost) : null,
        actualCost: i.actualCost ? Number(i.actualCost) : null,
        roomWasOOO: i.roomWasOOO,
        isScheduled: i.isScheduled,
        scheduledStartDate: i.scheduledStartDate?.toISOString().slice(0, 10) ?? null,
        scheduledEndDate: i.scheduledEndDate?.toISOString().slice(0, 10) ?? null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu historii usterek",
    };
  }
}

/** Pobiera wszystkie aktywne usterki (niezamknięte) */
export async function getActiveMaintenanceIssues(): Promise<
  ActionResult<MaintenanceIssueItem[]>
> {
  try {
    const propertyId = await getEffectivePropertyId();
    const issues = await prisma.maintenanceIssue.findMany({
      where: {
        status: { in: ["REPORTED", "IN_PROGRESS", "ON_HOLD"] },
        room: propertyId ? { propertyId } : undefined,
      },
      include: {
        room: { select: { number: true, type: true } },
      },
      orderBy: [{ priority: "asc" }, { reportedAt: "desc" }],
    });

    return {
      success: true,
      data: issues.map((i) => ({
        id: i.id,
        roomId: i.roomId,
        roomNumber: i.room.number,
        roomType: i.room.type,
        title: i.title,
        description: i.description,
        category: i.category as MaintenanceCategory,
        priority: i.priority as MaintenancePriority,
        status: i.status as MaintenanceStatus,
        reportedBy: i.reportedBy,
        reportedAt: i.reportedAt.toISOString(),
        assignedTo: i.assignedTo,
        assignedAt: i.assignedAt?.toISOString() ?? null,
        resolvedAt: i.resolvedAt?.toISOString() ?? null,
        resolvedBy: i.resolvedBy,
        resolutionNotes: i.resolutionNotes,
        estimatedCost: i.estimatedCost ? Number(i.estimatedCost) : null,
        actualCost: i.actualCost ? Number(i.actualCost) : null,
        roomWasOOO: i.roomWasOOO,
        isScheduled: i.isScheduled,
        scheduledStartDate: i.scheduledStartDate?.toISOString().slice(0, 10) ?? null,
        scheduledEndDate: i.scheduledEndDate?.toISOString().slice(0, 10) ?? null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu aktywnych usterek",
    };
  }
}

/** Tworzy nowe zgłoszenie usterki */
export async function createMaintenanceIssue(data: {
  roomId: string;
  title: string;
  description?: string;
  category: MaintenanceCategory;
  priority?: MaintenancePriority;
  reportedBy?: string;
  assignedTo?: string;
  estimatedCost?: number;
  setRoomOOO?: boolean;
  isScheduled?: boolean;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
}): Promise<ActionResult<MaintenanceIssueItem>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
      select: { id: true, number: true, type: true, status: true },
    });
    if (!room) {
      return { success: false, error: "Pokój nie istnieje" };
    }

    if (!data.title.trim()) {
      return { success: false, error: "Tytuł usterki jest wymagany" };
    }

    // Dla planowanych konserwacji, sprawdź czy podano daty
    const isScheduled = data.isScheduled ?? false;
    let scheduledStartDate: Date | null = null;
    let scheduledEndDate: Date | null = null;
    if (isScheduled) {
      if (!data.scheduledStartDate || !data.scheduledEndDate) {
        return { success: false, error: "Dla planowanej konserwacji wymagane są daty rozpoczęcia i zakończenia" };
      }
      scheduledStartDate = new Date(data.scheduledStartDate + "T00:00:00Z");
      scheduledEndDate = new Date(data.scheduledEndDate + "T00:00:00Z");
      if (scheduledEndDate < scheduledStartDate) {
        return { success: false, error: "Data zakończenia nie może być wcześniejsza niż data rozpoczęcia" };
      }
    }

    // Rozpocznij transakcję: stwórz usterkę i opcjonalnie ustaw pokój jako OOO
    const [issue] = await prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceIssue.create({
        data: {
          roomId: data.roomId,
          title: data.title.trim(),
          description: data.description?.trim() || null,
          category: data.category,
          priority: data.priority ?? "MEDIUM",
          status: "REPORTED",
          reportedBy: data.reportedBy?.trim() || null,
          assignedTo: data.assignedTo?.trim() || null,
          assignedAt: data.assignedTo ? new Date() : null,
          estimatedCost: data.estimatedCost ?? null,
          roomWasOOO: data.setRoomOOO ?? false,
          isScheduled,
          scheduledStartDate,
          scheduledEndDate,
        },
      });

      // Opcjonalnie ustaw pokój jako OOO
      if (data.setRoomOOO && room.status !== "OOO") {
        await tx.room.update({
          where: { id: data.roomId },
          data: {
            status: "OOO",
            reason: data.title.trim(),
          },
        });
      }

      return [created];
    });

    await createAuditLog({
      actionType: "CREATE",
      entityType: "MaintenanceIssue",
      entityId: issue.id,
      newValue: {
        roomId: data.roomId,
        roomNumber: room.number,
        title: data.title,
        category: data.category,
        priority: data.priority ?? "MEDIUM",
        setRoomOOO: data.setRoomOOO,
        isScheduled,
        scheduledStartDate: data.scheduledStartDate,
        scheduledEndDate: data.scheduledEndDate,
      },
      ipAddress: ip,
    });

    revalidatePath("/pokoje");
    revalidatePath("/housekeeping");

    return {
      success: true,
      data: {
        id: issue.id,
        roomId: issue.roomId,
        roomNumber: room.number,
        roomType: room.type,
        title: issue.title,
        description: issue.description,
        category: issue.category as MaintenanceCategory,
        priority: issue.priority as MaintenancePriority,
        status: issue.status as MaintenanceStatus,
        reportedBy: issue.reportedBy,
        reportedAt: issue.reportedAt.toISOString(),
        assignedTo: issue.assignedTo,
        assignedAt: issue.assignedAt?.toISOString() ?? null,
        resolvedAt: null,
        resolvedBy: null,
        resolutionNotes: null,
        estimatedCost: issue.estimatedCost ? Number(issue.estimatedCost) : null,
        actualCost: null,
        roomWasOOO: issue.roomWasOOO,
        isScheduled: issue.isScheduled,
        scheduledStartDate: issue.scheduledStartDate?.toISOString().slice(0, 10) ?? null,
        scheduledEndDate: issue.scheduledEndDate?.toISOString().slice(0, 10) ?? null,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia zgłoszenia usterki",
    };
  }
}

/** Aktualizuje status usterki */
export async function updateMaintenanceIssueStatus(
  issueId: string,
  status: MaintenanceStatus,
  options?: {
    resolvedBy?: string;
    resolutionNotes?: string;
    actualCost?: number;
    restoreRoomStatus?: RoomStatus;
  }
): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const issue = await prisma.maintenanceIssue.findUnique({
      where: { id: issueId },
      include: { room: { select: { id: true, status: true } } },
    });
    if (!issue) {
      return { success: false, error: "Usterka nie istnieje" };
    }

    const updateData: {
      status: string;
      resolvedAt?: Date | null;
      resolvedBy?: string | null;
      resolutionNotes?: string | null;
      actualCost?: number | null;
      assignedAt?: Date;
    } = { status };

    if (status === "RESOLVED" || status === "CANCELLED") {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = options?.resolvedBy?.trim() || null;
      updateData.resolutionNotes = options?.resolutionNotes?.trim() || null;
      if (options?.actualCost !== undefined) {
        updateData.actualCost = options.actualCost;
      }
    } else if (status === "IN_PROGRESS" && !issue.assignedAt) {
      updateData.assignedAt = new Date();
    }

    await prisma.$transaction(async (tx) => {
      await tx.maintenanceIssue.update({
        where: { id: issueId },
        data: updateData,
      });

      // Opcjonalnie przywróć status pokoju po zamknięciu usterki
      if (
        (status === "RESOLVED" || status === "CANCELLED") &&
        issue.roomWasOOO &&
        issue.room.status === "OOO" &&
        options?.restoreRoomStatus
      ) {
        await tx.room.update({
          where: { id: issue.roomId },
          data: {
            status: options.restoreRoomStatus,
            reason: null,
          },
        });
      }
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "MaintenanceIssue",
      entityId: issueId,
      oldValue: { status: issue.status },
      newValue: {
        status,
        ...(options?.resolvedBy ? { resolvedBy: options.resolvedBy } : {}),
        ...(options?.actualCost !== undefined ? { actualCost: options.actualCost } : {}),
      },
      ipAddress: ip,
    });

    revalidatePath("/pokoje");
    revalidatePath("/housekeeping");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji statusu usterki",
    };
  }
}

/** Aktualizuje dane usterki */
export async function updateMaintenanceIssue(
  issueId: string,
  data: {
    title?: string;
    description?: string;
    category?: MaintenanceCategory;
    priority?: MaintenancePriority;
    assignedTo?: string;
    estimatedCost?: number | null;
  }
): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const issue = await prisma.maintenanceIssue.findUnique({
      where: { id: issueId },
    });
    if (!issue) {
      return { success: false, error: "Usterka nie istnieje" };
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) {
      if (!data.title.trim()) {
        return { success: false, error: "Tytuł usterki jest wymagany" };
      }
      updateData.title = data.title.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description.trim() || null;
    }
    if (data.category !== undefined) {
      updateData.category = data.category;
    }
    if (data.priority !== undefined) {
      updateData.priority = data.priority;
    }
    if (data.assignedTo !== undefined) {
      updateData.assignedTo = data.assignedTo.trim() || null;
      if (data.assignedTo && !issue.assignedAt) {
        updateData.assignedAt = new Date();
      }
    }
    if (data.estimatedCost !== undefined) {
      updateData.estimatedCost = data.estimatedCost;
    }

    await prisma.maintenanceIssue.update({
      where: { id: issueId },
      data: updateData,
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "MaintenanceIssue",
      entityId: issueId,
      oldValue: {
        title: issue.title,
        description: issue.description,
        category: issue.category,
        priority: issue.priority,
        assignedTo: issue.assignedTo,
        estimatedCost: issue.estimatedCost ? Number(issue.estimatedCost) : null,
      },
      newValue: data,
      ipAddress: ip,
    });

    revalidatePath("/pokoje");
    revalidatePath("/housekeeping");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji usterki",
    };
  }
}

/** Usuwa zgłoszenie usterki */
export async function deleteMaintenanceIssue(issueId: string): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const issue = await prisma.maintenanceIssue.findUnique({
      where: { id: issueId },
    });
    if (!issue) {
      return { success: false, error: "Usterka nie istnieje" };
    }

    await prisma.maintenanceIssue.delete({ where: { id: issueId } });

    await createAuditLog({
      actionType: "DELETE",
      entityType: "MaintenanceIssue",
      entityId: issueId,
      oldValue: {
        roomId: issue.roomId,
        title: issue.title,
        category: issue.category,
        status: issue.status,
      },
      ipAddress: ip,
    });

    revalidatePath("/pokoje");
    revalidatePath("/housekeeping");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania usterki",
    };
  }
}

/** Pobiera statystyki usterek dla pokoju */
export async function getMaintenanceStatsForRoom(roomId: string): Promise<
  ActionResult<{
    total: number;
    resolved: number;
    active: number;
    avgResolutionTimeHours: number | null;
    totalCost: number;
    byCategory: Record<MaintenanceCategory, number>;
  }>
> {
  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return { success: false, error: "Pokój nie istnieje" };
    }

    const issues = await prisma.maintenanceIssue.findMany({
      where: { roomId },
      select: {
        status: true,
        category: true,
        reportedAt: true,
        resolvedAt: true,
        actualCost: true,
      },
    });

    const resolved = issues.filter((i) => i.status === "RESOLVED");
    const active = issues.filter((i) =>
      ["REPORTED", "IN_PROGRESS", "ON_HOLD"].includes(i.status)
    );

    // Średni czas rozwiązania (tylko dla zamkniętych z resolvedAt)
    const resolutionTimes = resolved
      .filter((i) => i.resolvedAt)
      .map((i) => (i.resolvedAt!.getTime() - i.reportedAt.getTime()) / (1000 * 60 * 60));
    const avgResolutionTimeHours =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : null;

    // Suma kosztów
    const totalCost = issues.reduce(
      (sum, i) => sum + (i.actualCost ? Number(i.actualCost) : 0),
      0
    );

    // Podział wg kategorii
    const byCategory: Record<MaintenanceCategory, number> = {
      ELECTRICAL: 0,
      PLUMBING: 0,
      HVAC: 0,
      FURNITURE: 0,
      CLEANING: 0,
      APPLIANCE: 0,
      OTHER: 0,
    };
    for (const i of issues) {
      byCategory[i.category as MaintenanceCategory]++;
    }

    return {
      success: true,
      data: {
        total: issues.length,
        resolved: resolved.length,
        active: active.length,
        avgResolutionTimeHours,
        totalCost,
        byCategory,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania statystyk usterek",
    };
  }
}

/** Pobiera planowane konserwacje kończące się dzisiaj lub w najbliższych dniach */
export async function getMaintenanceEndingSoon(
  daysAhead: number = 1
): Promise<ActionResult<MaintenanceIssueItem[]>> {
  try {
    const propertyId = await getEffectivePropertyId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysAhead);

    const issues = await prisma.maintenanceIssue.findMany({
      where: {
        isScheduled: true,
        scheduledEndDate: {
          gte: today,
          lte: endDate,
        },
        status: { in: ["REPORTED", "IN_PROGRESS"] },
        room: propertyId ? { propertyId } : undefined,
      },
      include: {
        room: { select: { number: true, type: true } },
      },
      orderBy: { scheduledEndDate: "asc" },
    });

    return {
      success: true,
      data: issues.map((i) => ({
        id: i.id,
        roomId: i.roomId,
        roomNumber: i.room.number,
        roomType: i.room.type,
        title: i.title,
        description: i.description,
        category: i.category as MaintenanceCategory,
        priority: i.priority as MaintenancePriority,
        status: i.status as MaintenanceStatus,
        reportedBy: i.reportedBy,
        reportedAt: i.reportedAt.toISOString(),
        assignedTo: i.assignedTo,
        assignedAt: i.assignedAt?.toISOString() ?? null,
        resolvedAt: i.resolvedAt?.toISOString() ?? null,
        resolvedBy: i.resolvedBy,
        resolutionNotes: i.resolutionNotes,
        estimatedCost: i.estimatedCost ? Number(i.estimatedCost) : null,
        actualCost: i.actualCost ? Number(i.actualCost) : null,
        roomWasOOO: i.roomWasOOO,
        isScheduled: i.isScheduled,
        scheduledStartDate: i.scheduledStartDate?.toISOString().slice(0, 10) ?? null,
        scheduledEndDate: i.scheduledEndDate?.toISOString().slice(0, 10) ?? null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania kończących się konserwacji",
    };
  }
}

/** Pobiera wszystkie planowane konserwacje (scheduled maintenance) */
export async function getScheduledMaintenance(): Promise<ActionResult<MaintenanceIssueItem[]>> {
  try {
    const propertyId = await getEffectivePropertyId();
    const issues = await prisma.maintenanceIssue.findMany({
      where: {
        isScheduled: true,
        status: { in: ["REPORTED", "IN_PROGRESS", "ON_HOLD"] },
        room: propertyId ? { propertyId } : undefined,
      },
      include: {
        room: { select: { number: true, type: true } },
      },
      orderBy: { scheduledStartDate: "asc" },
    });

    return {
      success: true,
      data: issues.map((i) => ({
        id: i.id,
        roomId: i.roomId,
        roomNumber: i.room.number,
        roomType: i.room.type,
        title: i.title,
        description: i.description,
        category: i.category as MaintenanceCategory,
        priority: i.priority as MaintenancePriority,
        status: i.status as MaintenanceStatus,
        reportedBy: i.reportedBy,
        reportedAt: i.reportedAt.toISOString(),
        assignedTo: i.assignedTo,
        assignedAt: i.assignedAt?.toISOString() ?? null,
        resolvedAt: i.resolvedAt?.toISOString() ?? null,
        resolvedBy: i.resolvedBy,
        resolutionNotes: i.resolutionNotes,
        estimatedCost: i.estimatedCost ? Number(i.estimatedCost) : null,
        actualCost: i.actualCost ? Number(i.actualCost) : null,
        roomWasOOO: i.roomWasOOO,
        isScheduled: i.isScheduled,
        scheduledStartDate: i.scheduledStartDate?.toISOString().slice(0, 10) ?? null,
        scheduledEndDate: i.scheduledEndDate?.toISOString().slice(0, 10) ?? null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania planowanych konserwacji",
    };
  }
}
