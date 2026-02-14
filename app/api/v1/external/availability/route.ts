import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireExternalApiKey } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/v1/external/availability
 * Dla Channel Managera: dostępność pokoi w podanym zakresie dat.
 * Query: from (YYYY-MM-DD), to (YYYY-MM-DD), roomType (opcjonalnie)
 * Opcjonalna autoryzacja: jeśli ustawiono EXTERNAL_API_KEY w .env, wymagany nagłówek X-API-Key lub Authorization: Bearer <key>
 * Rate limit: 100 req/min na klucz API lub IP.
 */
export async function GET(request: NextRequest) {
  const rateLimitRes = checkApiRateLimit(request);
  if (rateLimitRes) return rateLimitRes;
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const roomType = searchParams.get("roomType") ?? undefined;

    if (!fromStr || !toStr) {
      return NextResponse.json(
        { error: "Parametry from i to (YYYY-MM-DD) są wymagane" },
        { status: 400 }
      );
    }

    const from = new Date(fromStr + "T00:00:00.000Z");
    const to = new Date(toStr + "T00:00:00.000Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return NextResponse.json(
        { error: "Nieprawidłowy zakres dat" },
        { status: 400 }
      );
    }

    const rooms = await prisma.room.findMany({
      where: {
        status: "CLEAN",
        activeForSale: true,
        ...(roomType ? { type: roomType } : {}),
      },
      select: { id: true, number: true, type: true, status: true },
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

    const occupiedRoomIds = new Set(reservations.map((r) => r.roomId));
    const available = rooms.filter((r) => !occupiedRoomIds.has(r.id));

    const byType = available.reduce<Record<string, number>>((acc, r) => {
      acc[r.type] = (acc[r.type] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      from: fromStr,
      to: toStr,
      roomType: roomType ?? "all",
      totalAvailable: available.length,
      byType,
      rooms: available.map((r) => ({ number: r.number, type: r.type })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd serwera" },
      { status: 500 }
    );
  }
}
