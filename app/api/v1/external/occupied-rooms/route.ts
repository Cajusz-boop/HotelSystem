import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireExternalApiKey } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/v1/external/occupied-rooms
 *
 * Lista aktualnie zajętych pokoi z danymi gościa — do użycia przez
 * systemy POS (Symplex Bistro), żeby kelner mógł wybrać pokój
 * przy nabijaniu rachunku "na pokój".
 *
 * Odpowiedź:
 * {
 *   date: "2026-02-16",
 *   rooms: [
 *     { roomNumber: "101", roomType: "Queen", guestName: "Jan Kowalski", reservationId: "abc123", checkIn: "2026-02-14", checkOut: "2026-02-18", pax: 2 },
 *     ...
 *   ]
 * }
 *
 * Opcjonalny query param:
 *   ?date=2026-02-16  (domyślnie: dzisiaj)
 *
 * Autoryzacja: X-API-Key lub Authorization: Bearer <key>
 * Rate limit: 100 req/min.
 */
export async function GET(request: NextRequest) {
  const rateLimitRes = checkApiRateLimit(request);
  if (rateLimitRes) return rateLimitRes;
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    const targetDate = dateParam
      ? new Date(dateParam + "T00:00:00.000Z")
      : new Date();

    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { error: "Nieprawidłowa data (oczekiwany format: YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Normalizuj do początku dnia
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    // Znajdź rezerwacje CHECKED_IN lub CONFIRMED, których pobyt obejmuje dany dzień
    // CONFIRMED akceptujemy bo gość może być fizycznie w pokoju, ale bez formalnego check-in w systemie
    const reservations = await prisma.reservation.findMany({
      where: {
        status: { in: ["CHECKED_IN", "CONFIRMED"] },
        checkIn: { lte: dayStart },
        checkOut: { gt: dayStart },
      },
      include: {
        guest: { select: { name: true } },
        room: { select: { number: true, type: true } },
      },
      orderBy: { room: { number: "asc" } },
    });

    const dateStr = dayStart.toISOString().slice(0, 10);

    const rooms = reservations.map((r) => ({
      roomNumber: r.room.number,
      roomType: r.room.type,
      guestName: r.guest.name,
      reservationId: r.id,
      checkIn: r.checkIn.toISOString().slice(0, 10),
      checkOut: r.checkOut.toISOString().slice(0, 10),
      pax: r.pax ?? 1,
      status: r.status, // CHECKED_IN lub CONFIRMED
    }));

    return NextResponse.json({
      date: dateStr,
      occupiedCount: rooms.length,
      rooms,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd serwera" },
      { status: 500 }
    );
  }
}
