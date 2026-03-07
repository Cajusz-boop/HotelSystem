/**
 * GET /api/test/get-reservation?id=xxx
 * Zwraca checkIn, checkOut, roomId, room.number dla weryfikacji TEST 5, 6.
 * Tylko do testów E2E.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "Brak parametru id" }, { status: 400 });
  }
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: { room: { select: { number: true } } },
  });
  if (!r) {
    return NextResponse.json({ success: false, error: "Rezerwacja nie istnieje" }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    checkIn: formatDate(r.checkIn),
    checkOut: formatDate(r.checkOut),
    roomId: r.roomId,
    room: r.room.number,
  });
}
