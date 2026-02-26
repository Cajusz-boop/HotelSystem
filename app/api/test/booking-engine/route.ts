/**
 * API route do testów Booking Engine.
 * GET /api/test/booking-engine
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBookingAvailability, submitBookingFromEngine } from "@/app/actions/booking-engine";

export async function GET() {
  const results: Array<{ step: string; ok: boolean; message?: string; data?: unknown }> = [];
  let reservationId: string | null = null;

  const checkIn = "2026-03-20";
  const checkOut = "2026-03-22";

  try {
    // 1. Pobierz dostępność
    const availRes = await getBookingAvailability(checkIn, checkOut);
    if (!availRes.success) {
      results.push({ step: "1. Dostępność", ok: false, message: availRes.error });
      return NextResponse.json({ results });
    }
    const rooms = availRes.data ?? [];
    results.push({ step: "1. Dostępność", ok: true, data: { count: rooms.length } });

    if (rooms.length === 0) {
      results.push({ step: "2. Rezerwacja", ok: false, message: "Brak dostępnych pokoi" });
      return NextResponse.json({ results });
    }

    // 2. Pobierz typy pokoi (roomTypeId)
    const roomType = rooms[0];
    const rt = await prisma.roomType.findFirst({
      where: { name: roomType.type },
      select: { id: true },
    });
    const roomTypeId = rt?.id;
    if (!roomTypeId) {
      results.push({ step: "2. Rezerwacja", ok: false, message: "Brak RoomType w bazie" });
      return NextResponse.json({ results });
    }

    // 3. Złóż rezerwację
    const submitRes = await submitBookingFromEngine({
      roomTypeId,
      checkIn,
      checkOut,
      adults: 2,
      children: 0,
      mealPlan: "BB",
      guestName: "Anna Online",
      guestEmail: "anna.online@test.pl",
      guestPhone: "+48600200300",
      bookingType: "INSTANT",
      paymentIntent: "NONE",
      totalAmount: roomType.totalAmount || 0,
    });

    if (!submitRes.success) {
      results.push({ step: "2. Rezerwacja", ok: false, message: submitRes.error });
      return NextResponse.json({ results });
    }

    reservationId = (submitRes.data as { reservationId?: string })?.reservationId ?? null;
    results.push({ step: "2. Rezerwacja", ok: true, data: { reservationId, confirmationNumber: (submitRes.data as { confirmationNumber?: string })?.confirmationNumber } });

    // 4. Sprawdź czy rezerwacja jest w bazie
    if (reservationId) {
      const res = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: { id: true, status: true },
      });
      results.push({ step: "3. Weryfikacja w bazie", ok: !!res, data: res ? { status: res.status } : undefined });

      // Cleanup — usuń rezerwację testową
      await prisma.reservation.delete({ where: { id: reservationId } }).catch(() => {});
      const guest = await prisma.guest.findFirst({ where: { email: "anna.online@test.pl" }, select: { id: true } });
      if (guest) {
        const otherRes = await prisma.reservation.count({ where: { guestId: guest.id } });
        if (otherRes === 0) await prisma.guest.delete({ where: { id: guest.id } }).catch(() => {});
      }
    }
  } catch (e) {
    results.push({ step: "BŁĄD", ok: false, message: e instanceof Error ? e.message : String(e) });
  }

  return NextResponse.json({ results });
}
