"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { headers } from "next/headers";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface RentalAvailabilityDay {
  date: string;
  available: number;
}

/**
 * Zwraca dostępność wypożyczalni dla danego itemu w zadanym zakresie dat.
 * Dla każdego dnia: dostępna liczba sztuk = quantity itemu − suma quantity rezerwacji obejmujących ten dzień.
 */
export async function getRentalAvailability(
  itemId: string,
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<RentalAvailabilityDay[]>> {
  try {
    const from = new Date(dateFrom + "T00:00:00Z");
    const to = new Date(dateTo + "T00:00:00Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const item = await prisma.rentalItem.findUnique({
      where: { id: itemId },
      select: { id: true, quantity: true, name: true },
    });
    if (!item) {
      return { success: false, error: "Pozycja wypożyczalni nie istnieje" };
    }

    const bookings = await prisma.rentalBooking.findMany({
      where: {
        rentalItemId: itemId,
        startDate: { lt: new Date(to.getTime() + 86400000) },
        endDate: { gte: from },
      },
      select: { startDate: true, endDate: true, quantity: true },
    });

    const result: RentalAvailabilityDay[] = [];
    const totalQuantity = item.quantity;
    for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      const dayStart = new Date(d);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      let booked = 0;
      for (const b of bookings) {
        const bStart = new Date(b.startDate);
        const bEnd = new Date(b.endDate);
        // endDate is inclusive (last day of rental); day is [dayStart, dayEnd)
        if (bStart < dayEnd && bEnd >= dayStart) {
          booked += b.quantity;
        }
      }
      const available = Math.max(0, totalQuantity - booked);
      result.push({ date: formatDate(dayStart), available });
    }

    return { success: true, data: result };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu dostępności wypożyczalni",
    };
  }
}

export interface CreateRentalBookingInput {
  rentalItemId: string;
  reservationId?: string | null;
  guestId?: string | null;
  startDate: Date;
  endDate: Date;
  quantity?: number;
}

/**
 * Tworzy rezerwację wypożyczenia. Sprawdza dostępność w każdym dniu zakresu.
 */
export async function createRentalBooking(
  input: CreateRentalBookingInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const quantity = input.quantity ?? 1;
    if (quantity < 1) {
      return { success: false, error: "Liczba sztuk musi być co najmniej 1" };
    }

    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);
    if (end < start) {
      return { success: false, error: "Data końca musi być późniejsza lub równa dacie początku" };
    }

    const item = await prisma.rentalItem.findUnique({
      where: { id: input.rentalItemId },
      select: { id: true, name: true, quantity: true },
    });
    if (!item) {
      return { success: false, error: "Pozycja wypożyczalni nie istnieje" };
    }
    if (quantity > item.quantity) {
      return { success: false, error: `Maksymalna liczba sztuk dla "${item.name}" to ${item.quantity}` };
    }

    const avail = await getRentalAvailability(
      input.rentalItemId,
      formatDate(start),
      formatDate(end)
    );
    if (!avail.success) return avail;
    const minAvailable = Math.min(...avail.data.map((d) => d.available));
    if (minAvailable < quantity) {
      return {
        success: false,
        error: `Niewystarczająca dostępność w wybranym terminie (dostępne: ${minAvailable} szt.)`,
      };
    }

    const booking = await prisma.rentalBooking.create({
      data: {
        rentalItemId: input.rentalItemId,
        reservationId: input.reservationId ?? null,
        guestId: input.guestId ?? null,
        startDate: start,
        endDate: end,
        quantity,
      },
    });

    const reqHeaders = await headers();
    await createAuditLog({
      actionType: "CREATE",
      entityType: "RentalBooking",
      entityId: booking.id,
      newValue: {
        rentalItemId: input.rentalItemId,
        rentalItemName: item.name,
        reservationId: input.reservationId ?? null,
        guestId: input.guestId ?? null,
        startDate: formatDate(start),
        endDate: formatDate(end),
        quantity,
      },
      ipAddress: getClientIp(reqHeaders),
    });

    revalidatePath("/rentals");
    return { success: true, data: { id: booking.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia rezerwacji wypożyczalni",
    };
  }
}

export interface RentalBookingForList {
  id: string;
  rentalItemName: string;
  startDate: string;
  endDate: string;
  quantity: number;
  reservationId: string | null;
  guestName: string | null;
}

/** Lista rezerwacji wypożyczeń dla danej rezerwacji (pobyt). */
export async function getRentalBookingsForReservation(
  reservationId: string
): Promise<ActionResult<RentalBookingForList[]>> {
  try {
    const list = await prisma.rentalBooking.findMany({
      where: { reservationId },
      include: { rentalItem: true, guest: true },
      orderBy: { startDate: "asc" },
    });
    return {
      success: true,
      data: list.map((b) => ({
        id: b.id,
        rentalItemName: b.rentalItem.name,
        startDate: formatDate(b.startDate),
        endDate: formatDate(b.endDate),
        quantity: b.quantity,
        reservationId: b.reservationId,
        guestName: b.guest?.name ?? null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu rezerwacji wypożyczeń",
    };
  }
}

/** Lista wszystkich rezerwacji wypożyczeń (np. do ekranu wypożyczalni). */
export async function getRentalBookings(
  dateFrom?: string,
  dateTo?: string
): Promise<ActionResult<RentalBookingForList[]>> {
  try {
    const where: { startDate?: { gte?: Date }; endDate?: { lte?: Date } } = {};
    if (dateFrom) {
      where.startDate = { gte: new Date(dateFrom + "T00:00:00Z") };
    }
    if (dateTo) {
      where.endDate = { lte: new Date(dateTo + "T23:59:59.999Z") };
    }
    const list = await prisma.rentalBooking.findMany({
      where,
      include: { rentalItem: true, guest: true },
      orderBy: { startDate: "asc" },
      take: 500,
    });
    return {
      success: true,
      data: list.map((b) => ({
        id: b.id,
        rentalItemName: b.rentalItem.name,
        startDate: formatDate(b.startDate),
        endDate: formatDate(b.endDate),
        quantity: b.quantity,
        reservationId: b.reservationId,
        guestName: b.guest?.name ?? null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu rezerwacji wypożyczeń",
    };
  }
}
