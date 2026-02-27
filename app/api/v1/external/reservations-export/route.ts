import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireExternalApiKey } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/v1/external/reservations-export
 * Eksport rezerwacji dla synchronizacji z KWHotel.
 * 
 * Query params:
 *   from - data od (YYYY-MM-DD), domyślnie dzisiaj
 *   to - data do (YYYY-MM-DD), domyślnie +30 dni
 *   modifiedSince - tylko rezerwacje zmodyfikowane po tej dacie (ISO)
 * 
 * Autoryzacja: nagłówek X-API-Key lub Authorization: Bearer <key>
 */
export async function GET(request: NextRequest) {
  const rateLimitRes = checkApiRateLimit(request);
  if (rateLimitRes) return rateLimitRes;
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const modifiedSinceParam = searchParams.get("modifiedSince");
    
    const fromDate = fromParam ? new Date(fromParam) : today;
    const toDate = toParam ? new Date(toParam) : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const modifiedSince = modifiedSinceParam ? new Date(modifiedSinceParam) : null;

    const whereClause: Record<string, unknown> = {
      OR: [
        { checkIn: { gte: fromDate, lte: toDate } },
        { checkOut: { gte: fromDate, lte: toDate } },
        { AND: [{ checkIn: { lte: fromDate } }, { checkOut: { gte: toDate } }] },
      ],
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
    };

    if (modifiedSince) {
      whereClause.updatedAt = { gte: modifiedSince };
    }

    const reservations = await prisma.reservation.findMany({
      where: whereClause,
      include: {
        room: { select: { id: true, number: true } },
        guest: { 
          select: { 
            id: true, 
            name: true, 
            email: true, 
            phone: true,
            company: { select: { id: true, name: true } }
          } 
        },
        group: { select: { id: true, name: true } },
      },
      orderBy: { checkIn: "asc" },
    });

    const exportData = reservations.map((r) => ({
      id: r.id,
      roomNumber: r.room.number,
      checkIn: r.checkIn.toISOString().split("T")[0],
      checkOut: r.checkOut.toISOString().split("T")[0],
      status: r.status,
      guestName: r.guest?.name || null,
      guestEmail: r.guest?.email || null,
      guestPhone: r.guest?.phone || null,
      companyName: r.guest?.company?.name || null,
      groupName: r.group?.name || null,
      adults: r.adults,
      children: r.children,
      totalPrice: r.totalPrice ? Number(r.totalPrice) : null,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      count: exportData.length,
      from: fromDate.toISOString().split("T")[0],
      to: toDate.toISOString().split("T")[0],
      reservations: exportData,
    });
  } catch (e) {
    console.error("[reservations-export] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd serwera" },
      { status: 500 }
    );
  }
}
