/**
 * POST /api/test/create-e2e-reservation
 * Tworzy rezerwację testową E2E Telefon do testów Playwright.
 * Używane przez tests/plan-v3-faza2-11.spec.ts
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createReservation } from "@/app/actions/reservations";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function POST() {
  const today = new Date().toISOString().slice(0, 10);
  const rooms = await prisma.room.findMany({
    where: { activeForSale: true },
    select: { number: true },
    orderBy: { number: "asc" },
  });
  if (rooms.length === 0) {
    return NextResponse.json({ success: false, error: "Brak dostępnych pokoi" }, { status: 500 });
  }

  for (let offset = 7; offset <= 35; offset += 7) {
    const checkIn = addDays(today, offset);
    const checkOut = addDays(checkIn, 3);
    for (const room of rooms) {
      const res = await createReservation({
    guestName: "E2E Telefon",
    guestEmail: "e2e.telefon@test.pl",
    guestPhone: "+48500111222",
        room: room.number,
        checkIn,
        checkOut,
        status: "CONFIRMED",
        source: "PHONE",
        mealPlan: "BB",
        adults: 2,
        children: 0,
        pax: 2,
        notes: "Prosi o wysoki pokój",
      });

      if (res.success) {
        const data = res.data as { id: string; guestId?: string };
        return NextResponse.json({
          success: true,
          reservationId: data.id,
          guestId: data.guestId,
          checkIn,
          checkOut,
          room: room.number,
        });
      }
    }
  }

  return NextResponse.json(
    { success: false, error: "Nie znaleziono wolnego pokoju w ciągu 35 dni" },
    { status: 400 }
  );
}
