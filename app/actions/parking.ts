"use server";

import { prisma } from "@/lib/db";
import { getEffectivePropertyId } from "@/app/actions/properties";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { headers } from "next/headers";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface ParkingSpotForGrafik {
  id: string;
  number: string;
}

export interface ParkingBookingForGrafik {
  id: string;
  spotNumber: string;
  startDate: string;
  endDate: string;
  reservationId?: string;
  guestName?: string;
}

export interface ParkingGrafikData {
  spots: ParkingSpotForGrafik[];
  bookings: ParkingBookingForGrafik[];
}

/** Lista miejsc parkingowych dla selecta (np. przy rezerwacji) */
export async function getParkingSpotsForSelect(): Promise<
  ActionResult<Array<{ id: string; number: string }>>
> {
  try {
    const propertyId = await getEffectivePropertyId();
    if (!propertyId) {
      return { success: true, data: [] };
    }
    const spots = await prisma.parkingSpot.findMany({
      where: { propertyId },
      orderBy: { number: "asc" },
      select: { id: true, number: true },
    });
    return { success: true, data: spots };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu miejsc parkingowych",
    };
  }
}

/** Dane do grafiku parkingowego (oś czasu vs miejsca) */
export async function getParkingGrafikData(
  fromStr: string,
  toStr: string
): Promise<ActionResult<ParkingGrafikData>> {
  try {
    const propertyId = await getEffectivePropertyId();
    if (!propertyId) {
      return { success: true, data: { spots: [], bookings: [] } };
    }
    const from = new Date(fromStr + "T00:00:00Z");
    const to = new Date(toStr + "T00:00:00Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const [spots, bookingsRaw] = await Promise.all([
      prisma.parkingSpot.findMany({
        where: { propertyId },
        orderBy: { number: "asc" },
        select: { id: true, number: true },
      }),
      prisma.parkingBooking.findMany({
        where: {
          parkingSpot: { propertyId },
          startDate: { lt: to },
          endDate: { gt: from },
        },
        include: {
          parkingSpot: true,
          reservation: { include: { guest: true } },
        },
      }),
    ]);

    const bookings: ParkingBookingForGrafik[] = bookingsRaw.map((b) => ({
      id: b.id,
      spotNumber: b.parkingSpot.number,
      startDate: formatDate(b.startDate),
      endDate: formatDate(b.endDate),
      reservationId: b.reservationId ?? undefined,
      guestName: b.reservation?.guest?.name ?? undefined,
    }));

    return {
      success: true,
      data: {
        spots: spots.map((s) => ({ id: s.id, number: s.number })),
        bookings,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu parkingu",
    };
  }
}

export interface CreateParkingBookingInput {
  parkingSpotId: string;
  reservationId: string;
  startDate: Date;
  endDate: Date;
}

/** Tworzy rezerwację miejsca parkingowego z audit logiem */
export async function createParkingBooking(
  input: CreateParkingBookingInput
): Promise<ActionResult<{ id: string }>> {
  try {
    // Walidacja dat
    if (input.endDate <= input.startDate) {
      return { success: false, error: "Data końca musi być późniejsza niż data początku" };
    }

    // Sprawdzenie czy miejsce istnieje
    const spot = await prisma.parkingSpot.findUnique({
      where: { id: input.parkingSpotId },
      select: { id: true, number: true, propertyId: true },
    });
    if (!spot) {
      return { success: false, error: "Miejsce parkingowe nie istnieje" };
    }

    // Sprawdzenie konfliktów z innymi rezerwacjami
    const conflict = await prisma.parkingBooking.findFirst({
      where: {
        parkingSpotId: input.parkingSpotId,
        reservationId: { not: input.reservationId },
        startDate: { lt: input.endDate },
        endDate: { gt: input.startDate },
      },
    });
    if (conflict) {
      return {
        success: false,
        error: `Miejsce ${spot.number} jest już zajęte w tym terminie`,
      };
    }

    const booking = await prisma.parkingBooking.create({
      data: {
        parkingSpotId: input.parkingSpotId,
        reservationId: input.reservationId,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });

    const reqHeaders = await headers();
    await createAuditLog({
      actionType: "CREATE",
      entityType: "ParkingBooking",
      entityId: booking.id,
      newValue: {
        parkingSpotId: input.parkingSpotId,
        parkingSpotNumber: spot.number,
        reservationId: input.reservationId,
        startDate: input.startDate.toISOString(),
        endDate: input.endDate.toISOString(),
      },
      ipAddress: getClientIp(reqHeaders),
    });

    return { success: true, data: { id: booking.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia rezerwacji parkingu",
    };
  }
}

/** Usuwa rezerwację miejsca parkingowego z audit logiem */
export async function deleteParkingBooking(
  bookingId: string
): Promise<ActionResult<void>> {
  try {
    const existing = await prisma.parkingBooking.findUnique({
      where: { id: bookingId },
      include: { parkingSpot: { select: { number: true } } },
    });
    if (!existing) {
      return { success: false, error: "Rezerwacja parkingu nie istnieje" };
    }

    await prisma.parkingBooking.delete({ where: { id: bookingId } });

    const reqHeaders = await headers();
    await createAuditLog({
      actionType: "DELETE",
      entityType: "ParkingBooking",
      entityId: bookingId,
      oldValue: {
        parkingSpotId: existing.parkingSpotId,
        parkingSpotNumber: existing.parkingSpot.number,
        reservationId: existing.reservationId,
        startDate: existing.startDate.toISOString(),
        endDate: existing.endDate.toISOString(),
      },
      ipAddress: getClientIp(reqHeaders),
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania rezerwacji parkingu",
    };
  }
}

/** Usuwa wszystkie rezerwacje parkingowe dla danej rezerwacji (z audit logiem dla każdej) */
export async function deleteParkingBookingsByReservation(
  reservationId: string
): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    const bookings = await prisma.parkingBooking.findMany({
      where: { reservationId },
      include: { parkingSpot: { select: { number: true } } },
    });

    if (bookings.length === 0) {
      return { success: true, data: { deletedCount: 0 } };
    }

    await prisma.parkingBooking.deleteMany({ where: { reservationId } });

    const reqHeaders = await headers();
    // Logujemy usunięcie każdej rezerwacji parkingowej
    await Promise.all(
      bookings.map((b) =>
        createAuditLog({
          actionType: "DELETE",
          entityType: "ParkingBooking",
          entityId: b.id,
          oldValue: {
            parkingSpotId: b.parkingSpotId,
            parkingSpotNumber: b.parkingSpot.number,
            reservationId: b.reservationId,
            startDate: b.startDate.toISOString(),
            endDate: b.endDate.toISOString(),
          },
          ipAddress: getClientIp(reqHeaders),
        })
      )
    );

    return { success: true, data: { deletedCount: bookings.length } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania rezerwacji parkingu",
    };
  }
}
