import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireGuestToken } from "@/lib/guest-api-auth";

/**
 * GET /api/guest/reservations
 * Lista rezerwacji gościa (dla aplikacji mobilnej).
 * Autoryzacja: Authorization: Bearer <guest_app_token> lub X-Guest-Token.
 */
export async function GET(request: NextRequest) {
  const auth = await requireGuestToken(request);
  if (auth instanceof NextResponse) return auth;

  const list = await prisma.reservation.findMany({
    where: { guestId: auth.context.guestId },
    include: { room: true, transactions: true },
    orderBy: { checkIn: "desc" },
    take: 50,
  });

  const reservations = list.map((r) => ({
    id: r.id,
    checkIn: r.checkIn.toISOString().slice(0, 10),
    checkOut: r.checkOut.toISOString().slice(0, 10),
    roomNumber: r.room.number,
    roomType: r.room.type,
    status: r.status,
    confirmationNumber: r.confirmationNumber,
    digitalKeyCode: (r.digitalKeyCode as { code?: string } | null)?.code ?? null,
    totalAmount: r.transactions.reduce((s, t) => s + Number(t.amount), 0),
  }));

  return NextResponse.json({ reservations });
}
