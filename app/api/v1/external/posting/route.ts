import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireExternalApiKey } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { isFiscalEnabled, printFiscalReceipt, buildReceiptRequest } from "@/lib/fiscal";

interface PostingBody {
  reservationId?: string;
  roomNumber?: string;
  amount: number;
  type?: string;
  description?: string;
}

/**
 * POST /api/v1/external/posting
 * Dla systemów POS (restauracja) i zewnętrznych softów konferencyjnych:
 * obciążenie pokoju/rezerwacji kwotą.
 * Opcjonalna autoryzacja: jeśli ustawiono EXTERNAL_API_KEY w .env, wymagany nagłówek X-API-Key lub Authorization: Bearer <key>
 * Rate limit: 100 req/min na klucz API lub IP.
 */
export async function POST(request: NextRequest) {
  const rateLimitRes = checkApiRateLimit(request);
  if (rateLimitRes) return rateLimitRes;
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as PostingBody;
    const { reservationId, roomNumber, amount, type = "POSTING", description } = body;

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Kwota (amount) musi być liczbą dodatnią" },
        { status: 400 }
      );
    }

    let resId: string | null = null;

    if (reservationId) {
      const res = await prisma.reservation.findUnique({
        where: { id: reservationId },
      });
      if (!res) {
        return NextResponse.json(
          { error: "Rezerwacja nie istnieje" },
          { status: 404 }
        );
      }
      resId = res.id;
    } else if (roomNumber) {
      const room = await prisma.room.findUnique({
        where: { number: roomNumber },
        include: { reservations: true },
      });
      if (!room) {
        return NextResponse.json(
          { error: "Pokój nie istnieje" },
          { status: 404 }
        );
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const active = room.reservations.find(
        (r) =>
          r.status === "CHECKED_IN" &&
          r.checkIn <= today &&
          r.checkOut > today
      );
      if (!active) {
        return NextResponse.json(
          { error: "Brak aktywnej rezerwacji dla tego pokoju w dniu dzisiejszym" },
          { status: 404 }
        );
      }
      resId = active.id;
    } else {
      return NextResponse.json(
        { error: "Podaj reservationId lub roomNumber" },
        { status: 400 }
      );
    }

    const txType = type.toUpperCase().slice(0, 20);
    const tx = await prisma.transaction.create({
      data: {
        reservationId: resId,
        amount,
        type: txType,
        isReadOnly: false,
      },
    });

    let fiscalError: string | undefined;
    if (await isFiscalEnabled()) {
      const receiptRequest = await buildReceiptRequest({
        transactionId: tx.id,
        reservationId: resId,
        amount: Number(tx.amount),
        type: txType,
        description: description ?? undefined,
      });
      const fiscalResult = await printFiscalReceipt(receiptRequest);
      if (!fiscalResult.success && fiscalResult.error) {
        fiscalError = fiscalResult.error;
        console.error("[FISCAL] Błąd druku paragonu:", fiscalResult.error);
      }
    }

    return NextResponse.json({
      success: true,
      transactionId: tx.id,
      reservationId: resId,
      amount: Number(tx.amount),
      type: tx.type,
      description: description ?? null,
      fiscalError: fiscalError ?? undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd serwera" },
      { status: 500 }
    );
  }
}
