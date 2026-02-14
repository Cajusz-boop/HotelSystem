"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { getEffectivePropertyId } from "@/app/actions/properties";
import { getCennikForDate } from "@/app/actions/rooms";
import { createReservation } from "@/app/actions/reservations";
import { sendReservationConfirmation } from "@/app/actions/mailing";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Dostępność i ceny dla Booking Engine: zakres dat, opcjonalnie typ pokoju. */
export async function getBookingAvailability(
  checkIn: string,
  checkOut: string,
  roomType?: string
): Promise<
  ActionResult<
    Array<{ roomNumber: string; type: string; pricePerNight: number; totalNights: number; totalAmount: number }>
  >
> {
  const from = new Date(checkIn + "T00:00:00Z");
  const to = new Date(checkOut + "T00:00:00Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return { success: false, error: "Nieprawidłowy zakres dat" };
  }
  const propertyId = await getEffectivePropertyId();
  const rooms = await prisma.room.findMany({
    where: {
      ...(propertyId ? { propertyId } : {}),
      status: "CLEAN",
      activeForSale: true,
      ...(roomType ? { type: roomType } : {}),
    },
    select: { id: true, number: true, type: true },
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
  const occupiedIds = new Set(reservations.map((r) => r.roomId));
  const available = rooms.filter((r) => !occupiedIds.has(r.id));
  const nights = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  const result: Array<{
    roomNumber: string;
    type: string;
    pricePerNight: number;
    totalNights: number;
    totalAmount: number;
  }> = [];
  const firstDate = checkIn;
  const cennikRes = await getCennikForDate(firstDate);
  const priceByRoom = new Map<string, number>();
  if (cennikRes.success && cennikRes.data) {
    for (const r of cennikRes.data) {
      if (r.price != null) priceByRoom.set(r.number, r.price);
    }
  }
  for (const r of available) {
    const pricePerNight = priceByRoom.get(r.number) ?? 0;
    result.push({
      roomNumber: r.number,
      type: r.type,
      pricePerNight,
      totalNights: nights,
      totalAmount: pricePerNight * nights,
    });
  }
  return { success: true, data: result };
}

/** Typy pokoi do wyboru w formularzu (unikalne z aktywnych). */
export async function getRoomTypesForBooking(): Promise<ActionResult<Array<{ type: string }>>> {
  const propertyId = await getEffectivePropertyId();
  const rooms = await prisma.room.findMany({
    where: { ...(propertyId ? { propertyId } : {}), activeForSale: true },
    select: { type: true },
    distinct: ["type"],
    orderBy: { type: "asc" },
  });
  return { success: true, data: rooms.map((r) => ({ type: r.type })) };
}

const MAX_BOOKING_DAYS = 365;

/** Złożenie rezerwacji z Booking Engine (gość podaje dane). */
export async function submitBookingFromEngine(
  guestName: string,
  email: string,
  phone: string,
  roomNumber: string,
  checkIn: string,
  checkOut: string
): Promise<ActionResult<{ reservationId: string; message: string }>> {
  const name = guestName?.trim();
  if (!name) return { success: false, error: "Imię i nazwisko jest wymagane." };

  const from = new Date(checkIn + "T00:00:00Z");
  const to = new Date(checkOut + "T00:00:00Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { success: false, error: "Nieprawidłowy format dat (oczekiwano YYYY-MM-DD)." };
  }
  if (to <= from) {
    return { success: false, error: "Data wymeldowania musi być po dacie zameldowania." };
  }
  const nights = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (nights > MAX_BOOKING_DAYS) {
    return { success: false, error: `Maksymalna długość rezerwacji to ${MAX_BOOKING_DAYS} dni.` };
  }

  const availability = await getBookingAvailability(checkIn, checkOut);
  if (!availability.success) return availability;
  const option = availability.data.find((o) => o.roomNumber === roomNumber);
  if (!option) return { success: false, error: "Wybrany pokój nie jest już dostępny. Wybierz inne daty lub pokój." };
  const res = await createReservation({
    guestName: name,
    room: roomNumber,
    checkIn,
    checkOut,
    status: "CONFIRMED",
  });
  if (!res.success) return res;
  const data = res.data as { id: string; guestId?: string };
  const guestId = data.guestId;
  if (guestId && (email?.trim() || phone?.trim())) {
    await prisma.guest.update({
      where: { id: guestId },
      data: {
        ...(email?.trim() && { email: email.trim() }),
        ...(phone?.trim() && { phone: phone.trim() }),
      },
    }).catch(() => {});
  }

  const headersList = await headers();
  await createAuditLog({
    actionType: "CREATE",
    entityType: "BookingEngine",
    entityId: data.id,
    newValue: { guestName: name, roomNumber, checkIn, checkOut, source: "BOOKING_ENGINE" },
    ipAddress: getClientIp(headersList),
  });

  const confirmationResult = await sendReservationConfirmation(data.id);
  const message = confirmationResult.success
    ? "Rezerwacja została złożona. Oczekuj na potwierdzenie e-mailem."
    : "Rezerwacja została złożona." + (email?.trim() ? " Nie udało się wysłać potwierdzenia e-mailem." : "");

  return {
    success: true,
    data: {
      reservationId: data.id,
      message,
    },
  };
}
