"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { TRANSFER_TYPES, DIRECTIONS, STATUSES } from "@/lib/transfers-constants";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Lista rezerwacji transferów (ostatnie). */
export async function getTransferBookings(limit = 80): Promise<
  ActionResult<
    Array<{
      id: string;
      reservationId: string;
      roomNumber: string;
      guestName: string;
      type: string;
      direction: string;
      scheduledAt: string;
      place: string;
      price: number;
      status: string;
      chargedAt: string | null;
    }>
  >
> {
  try {
    const list = await prisma.transferBooking.findMany({
      orderBy: { scheduledAt: "desc" },
      take: limit,
      include: {
        reservation: { include: { guest: true, room: true } },
      },
    });
    return {
      success: true,
      data: list.map((b) => ({
        id: b.id,
        reservationId: b.reservationId,
        roomNumber: b.reservation.room?.number ?? "—",
        guestName: b.reservation.guest.name,
        type: b.type,
        direction: b.direction,
        scheduledAt: b.scheduledAt.toISOString(),
        place: b.place,
        price: Number(b.price),
        status: b.status,
        chargedAt: b.chargedAt?.toISOString() ?? null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu rezerwacji transferów",
    };
  }
}

/** Tworzy rezerwację transferu. */
export async function createTransferBooking(
  reservationId: string,
  data: {
    type: string;
    direction: string;
    scheduledAt: Date;
    place: string;
    price: number;
    notes?: string;
  }
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!TRANSFER_TYPES.includes(data.type as (typeof TRANSFER_TYPES)[number]))
      return { success: false, error: "Nieprawidłowy typ (AIRPORT lub STATION)" };
    if (!DIRECTIONS.includes(data.direction as (typeof DIRECTIONS)[number]))
      return { success: false, error: "Nieprawidłowy kierunek (ARRIVAL lub DEPARTURE)" };
    if (!data.place?.trim()) return { success: false, error: "Miejsce jest wymagane" };
    if (typeof data.price !== "number" || data.price < 0)
      return { success: false, error: "Cena musi być liczbą nieujemną" };

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };

    const created = await prisma.transferBooking.create({
      data: {
        reservationId,
        type: data.type,
        direction: data.direction,
        scheduledAt: data.scheduledAt,
        place: data.place.trim(),
        price: data.price,
        notes: data.notes?.trim() || null,
        status: "BOOKED",
      },
    });
    revalidatePath("/transfers");
    return { success: true, data: { id: created.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia rezerwacji transferu",
    };
  }
}

/** Aktualizuje status rezerwacji transferu. Gdy status = DONE, dolicza do rachunku. */
export async function updateTransferBookingStatus(
  id: string,
  status: string
): Promise<ActionResult<{ charged?: boolean }>> {
  try {
    if (!STATUSES.includes(status as (typeof STATUSES)[number]))
      return { success: false, error: "Nieprawidłowy status" };

    const booking = await prisma.transferBooking.findUnique({
      where: { id },
    });
    if (!booking) return { success: false, error: "Rezerwacja transferu nie istnieje" };

    await prisma.transferBooking.update({
      where: { id },
      data: { status },
    });

    let charged = false;
    if (status === "DONE" && booking.reservationId) {
      const { chargeTransferBookingToReservation } = await import("@/app/actions/finance");
      const result = await chargeTransferBookingToReservation(id);
      charged = result.success === true && !(result as { skipped?: boolean }).skipped;
    }

    revalidatePath("/transfers");
    return { success: true, data: { charged } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji statusu",
    };
  }
}
