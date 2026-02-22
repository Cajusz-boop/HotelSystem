"use server";

import { prisma } from "@/lib/db";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Lista gości do selecta (np. w formularzu rezerwacji działki). */
export async function getGuestsForSelect(limit = 200): Promise<
  ActionResult<Array<{ id: string; name: string }>>
> {
  try {
    const list = await prisma.guest.findMany({
      orderBy: { name: "asc" },
      take: limit,
      select: { id: true, name: true },
    });
    return { success: true, data: list };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu gości",
    };
  }
}

/** Lista miejsc campingowych (działki, przyczepy, namioty). */
export async function getCampsites(): Promise<
  ActionResult<
    Array<{
      id: string;
      number: string;
      type: string;
      pricePerDay: number;
      active: boolean;
    }>
  >
> {
  try {
    const list = await prisma.campsite.findMany({
      orderBy: [{ type: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        type: true,
        pricePerDay: true,
        active: true,
      },
    });
    return {
      success: true,
      data: list.map((c: typeof list[number]) => ({
        id: c.id,
        number: c.number,
        type: c.type,
        pricePerDay: Number(c.pricePerDay),
        active: c.active,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu miejsc campingowych",
    };
  }
}

/** Dostępność miejsc w podanym zakresie dat. Dla każdego miejsca zwraca czy jest wolne (brak nakładającej się rezerwacji). */
export async function getCampsiteAvailability(
  dateFrom: string,
  dateTo: string
): Promise<
  ActionResult<
    Array<{
      id: string;
      number: string;
      type: string;
      pricePerDay: number;
      active: boolean;
      available: boolean;
    }>
  >
> {
  try {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))
      return { success: false, error: "Nieprawidłowy zakres dat" };
    if (from > to) return { success: false, error: "Data początku musi być przed datą końca" };

    const campsites = await prisma.campsite.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { number: "asc" }],
      include: {
        bookings: {
          where: {
            startDate: { lte: to },
            endDate: { gte: from },
          },
        },
      },
    });

    const data = campsites.map((c) => ({
      id: c.id,
      number: c.number,
      type: c.type,
      pricePerDay: Number(c.pricePerDay),
      active: c.active,
      available: c.bookings.length === 0,
    }));

    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu dostępności",
    };
  }
}

/** Tworzy rezerwację miejsca campingowego. Gość lub rezerwacja pobytu (opcjonalnie). */
export async function createCampsiteBooking(
  campsiteId: string,
  startDate: string,
  endDate: string,
  reservationId?: string | null,
  guestId?: string | null
): Promise<ActionResult<{ id: string }>> {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
      return { success: false, error: "Nieprawidłowe daty" };
    if (start > end) return { success: false, error: "Data początku musi być przed datą końca" };

    const campsite = await prisma.campsite.findUnique({
      where: { id: campsiteId },
    });
    if (!campsite) return { success: false, error: "Miejsce nie istnieje" };
    if (!campsite.active) return { success: false, error: "Miejsce jest nieaktywne" };

    const overlapping = await prisma.campsiteBooking.findFirst({
      where: {
        campsiteId,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlapping) return { success: false, error: "Miejsce jest zajęte w podanym terminie" };

    if (reservationId) {
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
      });
      if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    }
    if (guestId) {
      const guest = await prisma.guest.findUnique({
        where: { id: guestId },
      });
      if (!guest) return { success: false, error: "Gość nie istnieje" };
    }

    const created = await prisma.campsiteBooking.create({
      data: {
        campsiteId,
        startDate: start,
        endDate: end,
        reservationId: reservationId?.trim() || null,
        guestId: guestId?.trim() || null,
      },
    });

    return { success: true, data: { id: created.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia rezerwacji",
    };
  }
}

/** Rezerwacje miejsc w podanym zakresie dat (do grafiku). */
export async function getCampsiteBookingsInRange(
  dateFrom: string,
  dateTo: string
): Promise<
  ActionResult<
    Array<{
      id: string;
      campsiteId: string;
      campsiteNumber: string;
      startDate: string;
      endDate: string;
      reservationId: string | null;
      guestId: string | null;
      guestName: string | null;
      roomNumber: string | null;
    }>
  >
> {
  try {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))
      return { success: false, error: "Nieprawidłowy zakres dat" };

    const list = await prisma.campsiteBooking.findMany({
      where: {
        startDate: { lte: to },
        endDate: { gte: from },
      },
      include: {
        campsite: { select: { number: true } },
        reservation: { include: { guest: true, room: true } },
        guest: { select: { name: true } },
      },
      orderBy: [{ campsiteId: "asc" }, { startDate: "asc" }],
    });

    const data = list.map((b) => ({
      id: b.id,
      campsiteId: b.campsiteId,
      campsiteNumber: b.campsite.number,
      startDate: b.startDate.toISOString().slice(0, 10),
      endDate: b.endDate.toISOString().slice(0, 10),
      reservationId: b.reservationId,
      guestId: b.guestId,
      guestName: b.reservation?.guest?.name ?? b.guest?.name ?? null,
      roomNumber: b.reservation?.room?.number ?? null,
    }));

    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu rezerwacji",
    };
  }
}
