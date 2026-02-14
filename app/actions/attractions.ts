"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

const STATUSES = ["BOOKED", "CONFIRMED", "DONE", "CANCELLED"] as const;

/** Lista atrakcji/wycieczek (cennik). */
export async function getAttractions(): Promise<
  ActionResult<Array<{ id: string; name: string; price: number; description: string | null }>>
> {
  try {
    const list = await prisma.attraction.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true, description: true },
    });
    return {
      success: true,
      data: list.map((a) => ({ id: a.id, name: a.name, price: Number(a.price), description: a.description })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu atrakcji",
    };
  }
}

/** Dodaje atrakcję do cennika. */
export async function createAttraction(
  name: string,
  price: number,
  description?: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const trimmedName = name?.trim();
    if (!trimmedName) return { success: false, error: "Nazwa jest wymagana" };
    if (typeof price !== "number" || price < 0) return { success: false, error: "Cena musi być liczbą nieujemną" };

    const created = await prisma.attraction.create({
      data: { name: trimmedName, price, description: description?.trim() || null },
    });
    revalidatePath("/attractions");
    return { success: true, data: { id: created.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd dodawania atrakcji",
    };
  }
}

/** Lista rezerwacji wycieczek/atrakcji. */
export async function getAttractionBookings(limit = 80): Promise<
  ActionResult<
    Array<{
      id: string;
      reservationId: string;
      roomNumber: string;
      guestName: string;
      attractionName: string;
      scheduledAt: string;
      quantity: number;
      amount: number;
      status: string;
      chargedAt: string | null;
    }>
  >
> {
  try {
    const list = await prisma.attractionBooking.findMany({
      orderBy: { scheduledAt: "desc" },
      take: limit,
      include: {
        reservation: { include: { guest: true, room: true } },
        attraction: true,
      },
    });
    return {
      success: true,
      data: list.map((b) => ({
        id: b.id,
        reservationId: b.reservationId,
        roomNumber: b.reservation.room?.number ?? "—",
        guestName: b.reservation.guest.name,
        attractionName: b.attraction.name,
        scheduledAt: b.scheduledAt.toISOString(),
        quantity: b.quantity,
        amount: Number(b.amount),
        status: b.status,
        chargedAt: b.chargedAt?.toISOString() ?? null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu rezerwacji",
    };
  }
}

/** Tworzy rezerwację wycieczki/atrakcji. */
export async function createAttractionBooking(
  reservationId: string,
  attractionId: string,
  scheduledAt: Date,
  quantity: number,
  notes?: string
): Promise<ActionResult<{ id: string }>> {
  try {
    if (quantity < 1) return { success: false, error: "Liczba osób musi być co najmniej 1" };

    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };

    const attraction = await prisma.attraction.findUnique({ where: { id: attractionId } });
    if (!attraction) return { success: false, error: "Atrakcja nie istnieje" };

    const unitPrice = attraction.price;
    const amount = Number(unitPrice) * quantity;

    const created = await prisma.attractionBooking.create({
      data: {
        reservationId,
        attractionId,
        scheduledAt,
        quantity,
        unitPrice,
        amount,
        status: "BOOKED",
        notes: notes?.trim() || null,
      },
    });
    revalidatePath("/attractions");
    return { success: true, data: { id: created.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia rezerwacji",
    };
  }
}

/** Aktualizuje status rezerwacji. Gdy status = DONE, dolicza do rachunku. */
export async function updateAttractionBookingStatus(
  id: string,
  status: string
): Promise<ActionResult<{ charged?: boolean }>> {
  try {
    if (!STATUSES.includes(status as (typeof STATUSES)[number]))
      return { success: false, error: "Nieprawidłowy status" };

    const booking = await prisma.attractionBooking.findUnique({ where: { id } });
    if (!booking) return { success: false, error: "Rezerwacja nie istnieje" };

    await prisma.attractionBooking.update({
      where: { id },
      data: { status },
    });

    let charged = false;
    if (status === "DONE" && booking.reservationId) {
      const { chargeAttractionBookingToReservation } = await import("@/app/actions/finance");
      const result = await chargeAttractionBookingToReservation(id);
      charged = result.success === true && !(result as { skipped?: boolean }).skipped;
    }

    revalidatePath("/attractions");
    return { success: true, data: { charged } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji statusu",
    };
  }
}

export { STATUSES };
