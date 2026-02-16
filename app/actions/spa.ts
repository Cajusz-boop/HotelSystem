"use server";

import { prisma } from "@/lib/db";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface SpaResourceForGrafik {
  id: string;
  name: string;
  price: number;
}

export interface SpaBookingForGrafik {
  id: string;
  resourceId: string;
  resourceName: string;
  reservationId: string | null;
  guestName: string | null;
  start: string;
  end: string;
  status: string;
}

export interface SpaGrafikData {
  resources: SpaResourceForGrafik[];
  bookings: SpaBookingForGrafik[];
}

/** Aktywne rezerwacje (CONFIRMED, CHECKED_IN) – do powiązania z SpaBooking i doliczenia do rachunku. */
export async function getActiveReservationsForCharge(): Promise<
  ActionResult<Array<{ id: string; guestName: string; roomNumber: string; confirmationNumber: string | null }>>
> {
  try {
    const list = await prisma.reservation.findMany({
      where: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
      include: { guest: true, room: true },
      orderBy: { checkIn: "asc" },
      take: 200,
    });
    return {
      success: true,
      data: list.map((r) => ({
        id: r.id,
        guestName: r.guest.name,
        roomNumber: r.room?.number ?? "—",
        confirmationNumber: r.confirmationNumber,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu rezerwacji",
    };
  }
}

/** Lista zasobów SPA (do selecta i grafiku). */
export async function getSpaResources(): Promise<
  ActionResult<Array<{ id: string; name: string; price: number }>>
> {
  try {
    const resources = await prisma.spaResource.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true },
    });
    return { success: true, data: resources.map((r) => ({ id: r.id, name: r.name, price: Number(r.price) })) };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu zasobów SPA",
    };
  }
}

/** Liczba rezerwacji SPA per dzień w zadanym miesiącu (do kalendarza). */
export async function getSpaBookingsCountByDay(
  year: number,
  month: number
): Promise<ActionResult<Record<string, number>>> {
  try {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const bookings = await prisma.spaBooking.findMany({
      where: {
        start: { lt: end },
        end: { gt: start },
        status: { notIn: ["CANCELLED"] },
      },
      select: { start: true, end: true },
    });

    const counts: Record<string, number> = {};
    for (const b of bookings) {
      const bStart = new Date(b.start);
      const bEnd = new Date(b.end);
      const d = new Date(Math.max(bStart.getTime(), start.getTime()));
      d.setUTCHours(0, 0, 0, 0);
      const lastDay = new Date(Math.min(bEnd.getTime(), end.getTime()));
      lastDay.setUTCHours(0, 0, 0, 0);
      while (d <= lastDay) {
        const key = d.toISOString().slice(0, 10);
        counts[key] = (counts[key] ?? 0) + 1;
        d.setUTCDate(d.getUTCDate() + 1);
      }
    }
    return { success: true, data: counts };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu kalendarza SPA",
    };
  }
}

/** Dane do grafiku SPA (oś czasu vs zasoby) – dla danego dnia. */
export async function getSpaGrafikData(dateStr: string): Promise<
  ActionResult<SpaGrafikData>
> {
  try {
    const date = new Date(dateStr + "T00:00:00Z");
    if (Number.isNaN(date.getTime())) {
      return { success: false, error: "Nieprawidłowa data" };
    }
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const [resources, bookingsRaw] = await Promise.all([
      prisma.spaResource.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, price: true },
      }),
      prisma.spaBooking.findMany({
        where: {
          start: { lt: dayEnd },
          end: { gt: dayStart },
        },
        include: {
          resource: true,
          reservation: { include: { guest: true } },
        },
        orderBy: { start: "asc" },
      }),
    ]);

    const bookings: SpaBookingForGrafik[] = bookingsRaw.map((b) => ({
      id: b.id,
      resourceId: b.resourceId,
      resourceName: b.resource.name,
      reservationId: b.reservationId,
      guestName: b.reservation?.guest?.name ?? null,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      status: b.status,
    }));

    return {
      success: true,
      data: {
        resources: resources.map((r) => ({
          id: r.id,
          name: r.name,
          price: Number(r.price),
        })),
        bookings,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu grafiku SPA",
    };
  }
}

/** Tworzy zasób SPA (np. masaż, sauna). */
export async function createSpaResource(
  name: string,
  price: number
): Promise<ActionResult<{ id: string }>> {
  try {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return { success: false, error: "Nazwa zasobu jest wymagana" };
    }
    if (typeof price !== "number" || price < 0) {
      return { success: false, error: "Cena musi być liczbą nieujemną" };
    }

    const created = await prisma.spaResource.create({
      data: {
        name: trimmedName,
        price,
      },
    });

    return { success: true, data: { id: created.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia zasobu SPA",
    };
  }
}

/** Aktualizuje zasób SPA. */
export async function updateSpaResource(
  id: string,
  name: string,
  price: number
): Promise<ActionResult> {
  try {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return { success: false, error: "Nazwa zasobu jest wymagana" };
    }
    if (typeof price !== "number" || price < 0) {
      return { success: false, error: "Cena musi być liczbą nieujemną" };
    }

    await prisma.spaResource.update({
      where: { id },
      data: { name: trimmedName, price },
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji zasobu SPA",
    };
  }
}

/** Rezerwacje SPA dla danego dnia (wszystkie nakładające się na ten dzień). */
export async function getSpaBookings(
  dateStr: string
): Promise<
  ActionResult<
    Array<{
      id: string;
      resourceId: string;
      resourceName: string;
      reservationId: string | null;
      guestName: string | null;
      start: string;
      end: string;
      status: string;
    }>
  >
> {
  try {
    const date = new Date(dateStr + "T00:00:00Z");
    if (Number.isNaN(date.getTime())) {
      return { success: false, error: "Nieprawidłowa data" };
    }
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const bookings = await prisma.spaBooking.findMany({
      where: {
        start: { lt: dayEnd },
        end: { gt: dayStart },
      },
      include: {
        resource: true,
        reservation: { include: { guest: true } },
      },
      orderBy: [{ resource: { name: "asc" } }, { start: "asc" }],
    });

    const data = bookings.map((b) => ({
      id: b.id,
      resourceId: b.resourceId,
      resourceName: b.resource.name,
      reservationId: b.reservationId,
      guestName: b.reservation?.guest?.name ?? null,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      status: b.status,
    }));

    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu rezerwacji SPA",
    };
  }
}

/** Tworzy rezerwację SPA. */
export async function createSpaBooking(
  resourceId: string,
  start: string,
  end: string,
  reservationId: string | null,
  status?: string
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!resourceId?.trim()) {
      return { success: false, error: "Zasób jest wymagany" };
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return { success: false, error: "Nieprawidłowe daty" };
    }
    if (endDate <= startDate) {
      return { success: false, error: "Data końca musi być po dacie początku" };
    }

    const [resource, overlapping] = await Promise.all([
      prisma.spaResource.findUnique({ where: { id: resourceId } }),
      prisma.spaBooking.count({
        where: {
          resourceId,
          start: { lt: endDate },
          end: { gt: startDate },
          status: { notIn: ["CANCELLED"] },
        },
      }),
    ]);
    if (!resource) {
      return { success: false, error: "Zasób nie istnieje" };
    }
    if (overlapping > 0) {
      return { success: false, error: "Zasób jest zajęty w podanym terminie" };
    }

    const validStatus = ["BOOKED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].includes(
      status ?? ""
    )
      ? status
      : "BOOKED";

    const created = await prisma.spaBooking.create({
      data: {
        resourceId,
        reservationId: reservationId?.trim() || null,
        start: startDate,
        end: endDate,
        status: validStatus,
      },
    });

    return { success: true, data: { id: created.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia rezerwacji SPA",
    };
  }
}
