import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireExternalApiKey } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { isFiscalEnabled, printFiscalReceipt, buildReceiptRequest } from "@/lib/fiscal";

interface PostingItem {
  name: string;
  quantity: number;
  unitPrice: number;
  category?: string;
}

interface PostingBody {
  reservationId?: string;
  roomNumber?: string;
  amount: number;
  type?: string;
  description?: string;
  /** Szczegolowe pozycje (np. dania z restauracji Bistro) */
  items?: PostingItem[];
  /** Numer rachunku POS (np. numer rachunku z Bistro) */
  receiptNumber?: string;
  /** Nazwa kelnera / kasjera */
  cashierName?: string;
  /** Zrodlo systemu POS */
  posSystem?: string;
  /** Gdy true, nie zapisuj do listy nieprzypisanych jeśli brak rezerwacji */
  requireReservation?: boolean;
}

/**
 * POST /api/v1/external/posting
 * Dla systemów POS (restauracja Bistro, Symplex) i zewnętrznych softów:
 * obciążenie pokoju/rezerwacji kwotą z opcjonalną listą pozycji.
 *
 * Body (JSON):
 *   roomNumber | reservationId – identyfikacja pokoju/rezerwacji
 *   amount – kwota łączna
 *   type – typ obciążenia (domyślnie POSTING, np. RESTAURANT, BAR)
 *   description – opis (np. "Restauracja – obiad")
 *   items[] – opcjonalna lista pozycji: { name, quantity, unitPrice, category? }
 *   receiptNumber – numer rachunku POS
 *   cashierName – kelner/kasjer
 *   posSystem – nazwa systemu (np. "Symplex Bistro")
 *
 * Autoryzacja: nagłówek X-API-Key lub Authorization: Bearer <key>
 * Rate limit: 100 req/min na klucz API lub IP.
 */
export async function POST(request: NextRequest) {
  const rateLimitRes = checkApiRateLimit(request);
  if (rateLimitRes) return rateLimitRes;
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as PostingBody;
    const {
      reservationId,
      roomNumber,
      amount,
      type = "POSTING",
      description,
      items,
      receiptNumber,
      cashierName,
      posSystem,
      requireReservation = false,
    } = body;

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Kwota (amount) musi być liczbą dodatnią" },
        { status: 400 }
      );
    }

    let resId: string | null = null;
    let roomNumberNormalized: string | null = roomNumber?.trim() || null;

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
        // Pokój nie istnieje w HotelSystem - zapisz jako nieprzypisane
        if (requireReservation) {
          return NextResponse.json(
            { error: "Pokój nie istnieje" },
            { status: 404 }
          );
        }
        // Zapisz do listy nieprzypisanych
        const unassigned = await prisma.unassignedGastronomyCharge.create({
          data: {
            roomNumber: roomNumber,
            amount,
            description,
            posSystem,
            receiptNumber,
            cashierName,
            items: items?.length ? JSON.parse(JSON.stringify(items)) : undefined,
            status: "PENDING",
          },
        });
        revalidatePath("/front-office");
        return NextResponse.json({
          success: true,
          unassigned: true,
          unassignedChargeId: unassigned.id,
          roomNumber,
          amount,
          reason: "Pokój nie istnieje w systemie - zapisano jako nieprzypisane",
        });
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const active = room.reservations.find(
        (r) =>
          r.status === "CHECKED_IN" &&
          r.checkIn <= today &&
          r.checkOut >= today
      );
      
      if (!active) {
        // Brak aktywnej rezerwacji - zapisz jako nieprzypisane
        if (requireReservation) {
          return NextResponse.json(
            { error: "Brak aktywnej rezerwacji dla tego pokoju w dniu dzisiejszym" },
            { status: 404 }
          );
        }
        // Zapisz do listy nieprzypisanych
        const unassigned = await prisma.unassignedGastronomyCharge.create({
          data: {
            roomNumber: roomNumber,
            amount,
            description,
            posSystem,
            receiptNumber,
            cashierName,
            items: items?.length ? JSON.parse(JSON.stringify(items)) : undefined,
            status: "PENDING",
          },
        });
        revalidatePath("/front-office");
        return NextResponse.json({
          success: true,
          unassigned: true,
          unassignedChargeId: unassigned.id,
          roomNumber,
          amount,
          reason: "Brak aktywnej rezerwacji - zapisano jako nieprzypisane",
        });
      }
      resId = active.id;
      roomNumberNormalized = room.number;
    } else {
      return NextResponse.json(
        { error: "Podaj reservationId lub roomNumber" },
        { status: 400 }
      );
    }

    const txType = type.toUpperCase().slice(0, 20);

    // Build description with item details if present
    const itemsDescription = items?.length
      ? items.map((it) => `${it.name} x${it.quantity} (${it.unitPrice.toFixed(2)} PLN)`).join(", ")
      : undefined;

    const fullDescription = [
      description,
      itemsDescription ? `Pozycje: ${itemsDescription}` : null,
      cashierName ? `Kelner: ${cashierName}` : null,
    ]
      .filter(Boolean)
      .join(" | ") || undefined;

    // Store items, receipt and POS metadata as externalRef JSON
    const externalRefData = {
      ...(receiptNumber ? { receiptNumber } : {}),
      ...(cashierName ? { cashierName } : {}),
      ...(posSystem ? { posSystem } : {}),
      ...(items?.length ? { items } : {}),
    };
    const externalRef =
      Object.keys(externalRefData).length > 0
        ? JSON.stringify(externalRefData)
        : undefined;

    const tx = await prisma.transaction.create({
      data: {
        reservationId: resId,
        amount,
        type: txType,
        description: fullDescription,
        category: "F_B",
        subcategory: "RESTAURANT",
        externalRef,
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
        description: fullDescription ?? undefined,
      });
      const fiscalResult = await printFiscalReceipt(receiptRequest);
      if (!fiscalResult.success && fiscalResult.error) {
        fiscalError = fiscalResult.error;
        console.error("[FISCAL] Błąd druku paragonu:", fiscalResult.error);
      }
    }

    // Rewalidacja stron, żeby recepcja zobaczyła nowe obciążenie
    revalidatePath("/front-office");
    revalidatePath("/");

    return NextResponse.json({
      success: true,
      transactionId: tx.id,
      reservationId: resId,
      amount: Number(tx.amount),
      type: tx.type,
      description: fullDescription ?? null,
      itemsCount: items?.length ?? 0,
      fiscalError: fiscalError ?? undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd serwera" },
      { status: 500 }
    );
  }
}
