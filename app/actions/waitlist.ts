"use server";

import { prisma } from "@/lib/db";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { headers } from "next/headers";
import type { ActionResult } from "./reservations";

// -------------------------------------------------------------------
// Typy
// -------------------------------------------------------------------

export interface WaitlistInput {
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestId?: string; // powiązanie z istniejącym gościem
  roomTypeId?: string;
  desiredCheckIn: string; // YYYY-MM-DD
  desiredCheckOut: string;
  pax?: number;
  flexibleDates?: boolean;
  flexibilityDays?: number;
  priority?: number;
  notes?: string;
  expiresAt?: string; // YYYY-MM-DD
}

export interface WaitlistEntry {
  id: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestId: string | null;
  roomTypeId: string | null;
  roomTypeName?: string;
  desiredCheckIn: string;
  desiredCheckOut: string;
  pax: number;
  flexibleDates: boolean;
  flexibilityDays: number;
  priority: number;
  status: string;
  notes: string | null;
  notifiedAt: Date | null;
  convertedReservationId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type WaitlistStatus =
  | "WAITING"
  | "NOTIFIED"
  | "CONVERTED"
  | "EXPIRED"
  | "CANCELLED";

// -------------------------------------------------------------------
// Helpery
// -------------------------------------------------------------------

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDate(s: string): Date {
  return new Date(s + "T00:00:00.000Z");
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// -------------------------------------------------------------------
// CRUD operacje
// -------------------------------------------------------------------

/**
 * Pobiera listę wpisów wait-listy z opcjonalnym filtrowaniem.
 */
export async function getWaitlistEntries(filters?: {
  status?: WaitlistStatus | WaitlistStatus[];
  roomTypeId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<WaitlistEntry[]> {
  const where: Record<string, unknown> = {};

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      where.status = { in: filters.status };
    } else {
      where.status = filters.status;
    }
  }

  if (filters?.roomTypeId) {
    where.roomTypeId = filters.roomTypeId;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    where.desiredCheckIn = {};
    if (filters.dateFrom) {
      (where.desiredCheckIn as Record<string, Date>).gte = parseDate(
        filters.dateFrom
      );
    }
    if (filters.dateTo) {
      (where.desiredCheckIn as Record<string, Date>).lte = parseDate(
        filters.dateTo
      );
    }
  }

  const entries = await prisma.waitlistEntry.findMany({
    where,
    include: {
      roomType: true,
      guest: true,
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return entries.map((e) => ({
    id: e.id,
    guestName: e.guestName,
    guestEmail: e.guestEmail,
    guestPhone: e.guestPhone,
    guestId: e.guestId,
    roomTypeId: e.roomTypeId,
    roomTypeName: e.roomType?.name,
    desiredCheckIn: formatDate(e.desiredCheckIn),
    desiredCheckOut: formatDate(e.desiredCheckOut),
    pax: e.pax,
    flexibleDates: e.flexibleDates,
    flexibilityDays: e.flexibilityDays,
    priority: e.priority,
    status: e.status,
    notes: e.notes,
    notifiedAt: e.notifiedAt,
    convertedReservationId: e.convertedReservationId,
    expiresAt: e.expiresAt,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));
}

/**
 * Pobiera pojedynczy wpis wait-listy.
 */
export async function getWaitlistEntry(id: string): Promise<WaitlistEntry | null> {
  const entry = await prisma.waitlistEntry.findUnique({
    where: { id },
    include: {
      roomType: true,
      guest: true,
    },
  });

  if (!entry) return null;

  return {
    id: entry.id,
    guestName: entry.guestName,
    guestEmail: entry.guestEmail,
    guestPhone: entry.guestPhone,
    guestId: entry.guestId,
    roomTypeId: entry.roomTypeId,
    roomTypeName: entry.roomType?.name,
    desiredCheckIn: formatDate(entry.desiredCheckIn),
    desiredCheckOut: formatDate(entry.desiredCheckOut),
    pax: entry.pax,
    flexibleDates: entry.flexibleDates,
    flexibilityDays: entry.flexibilityDays,
    priority: entry.priority,
    status: entry.status,
    notes: entry.notes,
    notifiedAt: entry.notifiedAt,
    convertedReservationId: entry.convertedReservationId,
    expiresAt: entry.expiresAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

/**
 * Tworzy nowy wpis na wait-liście.
 */
export async function createWaitlistEntry(
  input: WaitlistInput
): Promise<ActionResult<WaitlistEntry>> {
  // Walidacja dat
  const checkIn = parseDate(input.desiredCheckIn);
  const checkOut = parseDate(input.desiredCheckOut);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (checkIn < today) {
    return { success: false, error: "Data przyjazdu nie może być w przeszłości." };
  }

  if (checkOut <= checkIn) {
    return { success: false, error: "Data wyjazdu musi być późniejsza niż data przyjazdu." };
  }

  // Walidacja długości pobytu
  const nights =
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24);
  if (nights > 365) {
    return { success: false, error: "Maksymalny okres oczekiwania to 365 dni." };
  }

  // Walidacja gościa
  if (!input.guestName || input.guestName.trim().length < 2) {
    return { success: false, error: "Imię i nazwisko gościa jest wymagane." };
  }

  if (!input.guestEmail && !input.guestPhone) {
    return {
      success: false,
      error: "Wymagany jest przynajmniej jeden sposób kontaktu (email lub telefon).",
    };
  }

  // Walidacja typu pokoju
  if (input.roomTypeId) {
    const roomType = await prisma.roomType.findUnique({
      where: { id: input.roomTypeId },
    });
    if (!roomType) {
      return { success: false, error: "Wybrany typ pokoju nie istnieje." };
    }
  }

  // Walidacja elastyczności dat
  if (input.flexibleDates && (input.flexibilityDays ?? 0) <= 0) {
    return {
      success: false,
      error: "Dla elastycznych dat należy podać liczbę dni tolerancji.",
    };
  }

  // Sprawdzenie czy gość już jest na wait-liście dla tych dat
  const existingEntry = await prisma.waitlistEntry.findFirst({
    where: {
      OR: [
        { guestEmail: input.guestEmail },
        { guestPhone: input.guestPhone },
      ],
      desiredCheckIn: checkIn,
      desiredCheckOut: checkOut,
      status: "WAITING",
    },
  });

  if (existingEntry) {
    return {
      success: false,
      error: "Ten gość jest już na wait-liście dla podanego terminu.",
    };
  }

  const entry = await prisma.waitlistEntry.create({
    data: {
      guestName: input.guestName.trim(),
      guestEmail: input.guestEmail?.trim() || null,
      guestPhone: input.guestPhone?.trim() || null,
      guestId: input.guestId || null,
      roomTypeId: input.roomTypeId || null,
      desiredCheckIn: checkIn,
      desiredCheckOut: checkOut,
      pax: input.pax ?? 2,
      flexibleDates: input.flexibleDates ?? false,
      flexibilityDays: input.flexibilityDays ?? 0,
      priority: input.priority ?? 0,
      notes: input.notes?.trim() || null,
      expiresAt: input.expiresAt ? parseDate(input.expiresAt) : null,
      status: "WAITING",
    },
    include: {
      roomType: true,
    },
  });

  // Audit log
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  await createAuditLog({
    actionType: "CREATE",
    entityType: "WaitlistEntry",
    entityId: entry.id,
    newValue: {
      guestName: entry.guestName,
      desiredCheckIn: formatDate(entry.desiredCheckIn),
      desiredCheckOut: formatDate(entry.desiredCheckOut),
      roomTypeId: entry.roomTypeId,
      priority: entry.priority,
    },
    ipAddress: ip,
  });

  return {
    success: true,
    data: {
      id: entry.id,
      guestName: entry.guestName,
      guestEmail: entry.guestEmail,
      guestPhone: entry.guestPhone,
      guestId: entry.guestId,
      roomTypeId: entry.roomTypeId,
      roomTypeName: entry.roomType?.name,
      desiredCheckIn: formatDate(entry.desiredCheckIn),
      desiredCheckOut: formatDate(entry.desiredCheckOut),
      pax: entry.pax,
      flexibleDates: entry.flexibleDates,
      flexibilityDays: entry.flexibilityDays,
      priority: entry.priority,
      status: entry.status,
      notes: entry.notes,
      notifiedAt: entry.notifiedAt,
      convertedReservationId: entry.convertedReservationId,
      expiresAt: entry.expiresAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    },
  };
}

/**
 * Aktualizuje wpis na wait-liście.
 */
export async function updateWaitlistEntry(
  id: string,
  input: Partial<WaitlistInput>
): Promise<ActionResult<WaitlistEntry>> {
  const existing = await prisma.waitlistEntry.findUnique({
    where: { id },
  });

  if (!existing) {
    return { success: false, error: "Wpis nie istnieje." };
  }

  if (existing.status !== "WAITING") {
    return {
      success: false,
      error: "Można edytować tylko wpisy ze statusem WAITING.",
    };
  }

  const updateData: Record<string, unknown> = {};

  if (input.guestName !== undefined) {
    if (input.guestName.trim().length < 2) {
      return { success: false, error: "Imię i nazwisko gościa jest wymagane." };
    }
    updateData.guestName = input.guestName.trim();
  }

  if (input.guestEmail !== undefined) {
    updateData.guestEmail = input.guestEmail?.trim() || null;
  }

  if (input.guestPhone !== undefined) {
    updateData.guestPhone = input.guestPhone?.trim() || null;
  }

  if (input.guestId !== undefined) {
    updateData.guestId = input.guestId || null;
  }

  if (input.roomTypeId !== undefined) {
    if (input.roomTypeId) {
      const roomType = await prisma.roomType.findUnique({
        where: { id: input.roomTypeId },
      });
      if (!roomType) {
        return { success: false, error: "Wybrany typ pokoju nie istnieje." };
      }
    }
    updateData.roomTypeId = input.roomTypeId || null;
  }

  if (input.desiredCheckIn !== undefined || input.desiredCheckOut !== undefined) {
    const checkIn = input.desiredCheckIn
      ? parseDate(input.desiredCheckIn)
      : existing.desiredCheckIn;
    const checkOut = input.desiredCheckOut
      ? parseDate(input.desiredCheckOut)
      : existing.desiredCheckOut;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
      return { success: false, error: "Data przyjazdu nie może być w przeszłości." };
    }

    if (checkOut <= checkIn) {
      return { success: false, error: "Data wyjazdu musi być późniejsza niż data przyjazdu." };
    }

    if (input.desiredCheckIn !== undefined) {
      updateData.desiredCheckIn = checkIn;
    }
    if (input.desiredCheckOut !== undefined) {
      updateData.desiredCheckOut = checkOut;
    }
  }

  if (input.pax !== undefined) {
    updateData.pax = input.pax;
  }

  if (input.flexibleDates !== undefined) {
    updateData.flexibleDates = input.flexibleDates;
  }

  if (input.flexibilityDays !== undefined) {
    updateData.flexibilityDays = input.flexibilityDays;
  }

  if (input.priority !== undefined) {
    updateData.priority = input.priority;
  }

  if (input.notes !== undefined) {
    updateData.notes = input.notes?.trim() || null;
  }

  if (input.expiresAt !== undefined) {
    updateData.expiresAt = input.expiresAt ? parseDate(input.expiresAt) : null;
  }

  const entry = await prisma.waitlistEntry.update({
    where: { id },
    data: updateData,
    include: {
      roomType: true,
    },
  });

  // Audit log
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  await createAuditLog({
    actionType: "UPDATE",
    entityType: "WaitlistEntry",
    entityId: entry.id,
    oldValue: {
      guestName: existing.guestName,
      desiredCheckIn: formatDate(existing.desiredCheckIn),
      desiredCheckOut: formatDate(existing.desiredCheckOut),
    },
    newValue: updateData,
    ipAddress: ip,
  });

  return {
    success: true,
    data: {
      id: entry.id,
      guestName: entry.guestName,
      guestEmail: entry.guestEmail,
      guestPhone: entry.guestPhone,
      guestId: entry.guestId,
      roomTypeId: entry.roomTypeId,
      roomTypeName: entry.roomType?.name,
      desiredCheckIn: formatDate(entry.desiredCheckIn),
      desiredCheckOut: formatDate(entry.desiredCheckOut),
      pax: entry.pax,
      flexibleDates: entry.flexibleDates,
      flexibilityDays: entry.flexibilityDays,
      priority: entry.priority,
      status: entry.status,
      notes: entry.notes,
      notifiedAt: entry.notifiedAt,
      convertedReservationId: entry.convertedReservationId,
      expiresAt: entry.expiresAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    },
  };
}

/**
 * Zmienia status wpisu na wait-liście.
 */
export async function changeWaitlistStatus(
  id: string,
  newStatus: WaitlistStatus
): Promise<ActionResult<void>> {
  const existing = await prisma.waitlistEntry.findUnique({
    where: { id },
  });

  if (!existing) {
    return { success: false, error: "Wpis nie istnieje." };
  }

  // Walidacja dozwolonych przejść statusów
  const allowedTransitions: Record<string, WaitlistStatus[]> = {
    WAITING: ["NOTIFIED", "CONVERTED", "EXPIRED", "CANCELLED"],
    NOTIFIED: ["WAITING", "CONVERTED", "EXPIRED", "CANCELLED"],
    CONVERTED: [], // Stan końcowy
    EXPIRED: ["WAITING"], // Można reaktywować
    CANCELLED: ["WAITING"], // Można reaktywować
  };

  const allowed = allowedTransitions[existing.status] || [];
  if (!allowed.includes(newStatus)) {
    return {
      success: false,
      error: `Nie można zmienić statusu z ${existing.status} na ${newStatus}.`,
    };
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
  };

  if (newStatus === "NOTIFIED") {
    updateData.notifiedAt = new Date();
  }

  if (newStatus === "WAITING") {
    updateData.notifiedAt = null;
  }

  await prisma.waitlistEntry.update({
    where: { id },
    data: updateData,
  });

  // Audit log
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  await createAuditLog({
    actionType: "UPDATE",
    entityType: "WaitlistEntry",
    entityId: id,
    oldValue: { status: existing.status },
    newValue: { status: newStatus },
    ipAddress: ip,
  });

  return { success: true, data: undefined };
}

/**
 * Konwertuje wpis wait-listy na rezerwację.
 */
export async function convertWaitlistToReservation(
  id: string,
  reservationId: string
): Promise<ActionResult<void>> {
  const existing = await prisma.waitlistEntry.findUnique({
    where: { id },
  });

  if (!existing) {
    return { success: false, error: "Wpis nie istnieje." };
  }

  if (existing.status === "CONVERTED") {
    return { success: false, error: "Wpis został już przekonwertowany." };
  }

  if (existing.status === "CANCELLED") {
    return { success: false, error: "Nie można przekonwertować anulowanego wpisu." };
  }

  // Sprawdź czy rezerwacja istnieje
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
  });

  if (!reservation) {
    return { success: false, error: "Rezerwacja nie istnieje." };
  }

  await prisma.waitlistEntry.update({
    where: { id },
    data: {
      status: "CONVERTED",
      convertedReservationId: reservationId,
    },
  });

  // Audit log
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  await createAuditLog({
    actionType: "UPDATE",
    entityType: "WaitlistEntry",
    entityId: id,
    oldValue: { status: existing.status },
    newValue: { status: "CONVERTED", convertedReservationId: reservationId },
    ipAddress: ip,
  });

  return { success: true, data: undefined };
}

/**
 * Usuwa wpis z wait-listy.
 */
export async function deleteWaitlistEntry(id: string): Promise<ActionResult<void>> {
  const existing = await prisma.waitlistEntry.findUnique({
    where: { id },
  });

  if (!existing) {
    return { success: false, error: "Wpis nie istnieje." };
  }

  if (existing.status === "CONVERTED") {
    return { success: false, error: "Nie można usunąć przekonwertowanego wpisu." };
  }

  await prisma.waitlistEntry.delete({
    where: { id },
  });

  // Audit log
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  await createAuditLog({
    actionType: "DELETE",
    entityType: "WaitlistEntry",
    entityId: id,
    oldValue: {
      guestName: existing.guestName,
      desiredCheckIn: formatDate(existing.desiredCheckIn),
      desiredCheckOut: formatDate(existing.desiredCheckOut),
      status: existing.status,
    },
    ipAddress: ip,
  });

  return { success: true, data: undefined };
}

// -------------------------------------------------------------------
// Sprawdzanie dostępności
// -------------------------------------------------------------------

export interface AvailabilityCheckResult {
  isAvailable: boolean;
  availableRooms: Array<{
    id: string;
    number: string;
    type: string;
  }>;
  matchedDates?: {
    checkIn: string;
    checkOut: string;
  };
}

/**
 * Sprawdza dostępność dla wpisu wait-listy.
 * Uwzględnia elastyczne daty jeśli są włączone.
 */
export async function checkAvailabilityForWaitlist(
  entryId: string
): Promise<ActionResult<AvailabilityCheckResult>> {
  const entry = await prisma.waitlistEntry.findUnique({
    where: { id: entryId },
    include: {
      roomType: true,
    },
  });

  if (!entry) {
    return { success: false, error: "Wpis nie istnieje." };
  }

  // Budujemy listę zakresów dat do sprawdzenia
  const dateRanges: Array<{ checkIn: Date; checkOut: Date }> = [];
  const checkIn = entry.desiredCheckIn;
  const checkOut = entry.desiredCheckOut;
  const nights =
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24);

  // Oryginalne daty
  dateRanges.push({ checkIn, checkOut });

  // Jeśli elastyczne daty, dodaj alternatywne zakresy
  if (entry.flexibleDates && entry.flexibilityDays > 0) {
    for (let offset = 1; offset <= entry.flexibilityDays; offset++) {
      // Wcześniej
      dateRanges.push({
        checkIn: addDays(checkIn, -offset),
        checkOut: addDays(checkIn, -offset + nights),
      });
      // Później
      dateRanges.push({
        checkIn: addDays(checkIn, offset),
        checkOut: addDays(checkIn, offset + nights),
      });
    }
  }

  // Filtruj daty przeszłe
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validDateRanges = dateRanges.filter((r) => r.checkIn >= today);

  // Pobierz pokoje do sprawdzenia
  const roomWhere: Record<string, unknown> = {
    activeForSale: true,
    status: { not: "OOO" },
  };

  if (entry.roomTypeId) {
    roomWhere.type = entry.roomType?.name;
  }

  const rooms = await prisma.room.findMany({
    where: roomWhere,
    select: {
      id: true,
      number: true,
      type: true,
    },
  });

  if (rooms.length === 0) {
    return {
      success: true,
      data: {
        isAvailable: false,
        availableRooms: [],
      },
    };
  }

  // Sprawdź dostępność dla każdego zakresu dat
  for (const range of validDateRanges) {
    const roomIds = rooms.map((r) => r.id);

    // Znajdź rezerwacje kolidujące
    const conflictingReservations = await prisma.reservation.findMany({
      where: {
        roomId: { in: roomIds },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        checkIn: { lt: range.checkOut },
        checkOut: { gt: range.checkIn },
      },
      select: {
        roomId: true,
      },
    });

    // Znajdź blokady pokoi
    const conflictingBlocks = await prisma.roomBlock.findMany({
      where: {
        roomId: { in: roomIds },
        startDate: { lt: range.checkOut },
        endDate: { gt: range.checkIn },
      },
      select: {
        roomId: true,
      },
    });

    const occupiedRoomIds = new Set([
      ...conflictingReservations.map((r) => r.roomId),
      ...conflictingBlocks.map((b) => b.roomId),
    ]);

    const availableRooms = rooms.filter((r) => !occupiedRoomIds.has(r.id));

    if (availableRooms.length > 0) {
      return {
        success: true,
        data: {
          isAvailable: true,
          availableRooms,
          matchedDates: {
            checkIn: formatDate(range.checkIn),
            checkOut: formatDate(range.checkOut),
          },
        },
      };
    }
  }

  return {
    success: true,
    data: {
      isAvailable: false,
      availableRooms: [],
    },
  };
}

/**
 * Sprawdza dostępność i zwraca wpisy wait-listy, dla których są wolne pokoje.
 * Przydatne do codziennego powiadamiania gości.
 */
export async function findWaitlistEntriesWithAvailability(): Promise<
  Array<{
    entry: WaitlistEntry;
    availability: AvailabilityCheckResult;
  }>
> {
  const entries = await getWaitlistEntries({ status: "WAITING" });
  const results: Array<{
    entry: WaitlistEntry;
    availability: AvailabilityCheckResult;
  }> = [];

  for (const entry of entries) {
    const result = await checkAvailabilityForWaitlist(entry.id);
    if (result.success && result.data?.isAvailable) {
      results.push({
        entry,
        availability: result.data,
      });
    }
  }

  return results;
}

/**
 * Automatycznie wygasza wpisy wait-listy, które przekroczyły datę wygaśnięcia.
 */
export async function expireOldWaitlistEntries(): Promise<ActionResult<number>> {
  const now = new Date();

  // Wygaś wpisy z ustawionym expiresAt
  const expiredByDate = await prisma.waitlistEntry.updateMany({
    where: {
      status: "WAITING",
      expiresAt: { lt: now },
    },
    data: {
      status: "EXPIRED",
    },
  });

  // Wygaś wpisy, gdzie desiredCheckIn już minął
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiredByCheckIn = await prisma.waitlistEntry.updateMany({
    where: {
      status: "WAITING",
      desiredCheckIn: { lt: today },
      flexibleDates: false,
    },
    data: {
      status: "EXPIRED",
    },
  });

  // Dla elastycznych dat – wygaś jeśli nawet z tolerancją jest za późno
  const expiredFlexible = await prisma.waitlistEntry.updateMany({
    where: {
      status: "WAITING",
      flexibleDates: true,
      AND: [
        {
          desiredCheckIn: { lt: today },
        },
      ],
    },
    data: {
      status: "EXPIRED",
    },
  });

  const totalExpired =
    expiredByDate.count + expiredByCheckIn.count + expiredFlexible.count;

  return { success: true, data: totalExpired };
}

/**
 * Statystyki wait-listy.
 */
export async function getWaitlistStats(): Promise<{
  waiting: number;
  notified: number;
  converted: number;
  expired: number;
  cancelled: number;
  total: number;
}> {
  const stats = await prisma.waitlistEntry.groupBy({
    by: ["status"],
    _count: true,
  });

  const result = {
    waiting: 0,
    notified: 0,
    converted: 0,
    expired: 0,
    cancelled: 0,
    total: 0,
  };

  for (const s of stats) {
    const count = s._count;
    result.total += count;

    switch (s.status) {
      case "WAITING":
        result.waiting = count;
        break;
      case "NOTIFIED":
        result.notified = count;
        break;
      case "CONVERTED":
        result.converted = count;
        break;
      case "EXPIRED":
        result.expired = count;
        break;
      case "CANCELLED":
        result.cancelled = count;
        break;
    }
  }

  return result;
}
