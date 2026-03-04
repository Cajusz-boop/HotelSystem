import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireExternalApiKey } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/rate-limit";

/** Normalizuje numer pokoju do porównań (bez spacji, uppercase). */
function normalizeRoom(r: string): string {
  return r.replace(/\s+/g, "").trim().toUpperCase();
}

/**
 * GET /api/v1/external/room-charges
 *
 * Lista obciążeń gastronomicznych (posiłków) na pokoje — do użycia przez POS
 * przy wyświetlaniu historii zamówień na pokoje (fallback gdy POS nie ma lokalnych danych).
 *
 * Query params:
 *   roomNumber  — filtr po numerze pokoju (np. "SI 020")
 *   dateFrom    — YYYY-MM-DD (opcjonalny)
 *   dateTo      — YYYY-MM-DD (opcjonalny)
 *
 * Odpowiedź:
 *   { orders: [{ orderId, orderNumber, roomNumber, amount, createdAt, waiterName, items }] }
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
    const roomNumberFilter = searchParams.get("roomNumber")?.trim() ?? "";
    const dateFromParam = searchParams.get("dateFrom");
    const dateToParam = searchParams.get("dateTo");

    const dateFrom = dateFromParam
      ? new Date(dateFromParam + "T00:00:00.000Z")
      : null;
    const dateTo = dateToParam
      ? new Date(dateToParam + "T23:59:59.999Z")
      : null;

    const whereTx: {
      OR: Array<Record<string, unknown>>;
      createdAt?: { gte?: Date; lte?: Date };
      NOT?: { status: string };
    } = {
      OR: [
        { category: "F_B" },
        { type: { in: ["RESTAURANT", "GASTRONOMY", "POSTING"] } },
      ],
      NOT: { status: "VOIDED" },
    };
    if (dateFrom) whereTx.createdAt = { ...whereTx.createdAt, gte: dateFrom };
    if (dateTo)
      whereTx.createdAt = {
        ...whereTx.createdAt,
        lte: dateTo as Date,
      };

    const transactions = await prisma.transaction.findMany({
      where: whereTx,
      include: {
        reservation: {
          include: {
            room: { select: { number: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const unassignedWhere: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (dateFrom) unassignedWhere.createdAt = { gte: dateFrom };
    if (dateTo)
      unassignedWhere.createdAt = {
        ...unassignedWhere.createdAt,
        lte: dateTo,
      };

    const unassigned = await prisma.unassignedGastronomyCharge.findMany({
      where: unassignedWhere,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const normFilter = roomNumberFilter ? normalizeRoom(roomNumberFilter) : "";

    const mapTx = (
      tx: (typeof transactions)[0]
    ): {
      orderId: string;
      orderNumber: number;
      roomNumber: string;
      amount: number;
      createdAt: string;
      waiterName: string;
      items: Array<{ productName: string; quantity: number; unitPrice: number; note: string | null }>;
    } | null => {
      const roomNumber =
        tx.reservation?.room?.number ?? "";
      if (!roomNumber) return null;
      if (normFilter && normalizeRoom(roomNumber) !== normFilter) return null;

      let receiptNumber = "";
      let cashierName = "";
      const items: Array<{
        productName: string;
        quantity: number;
        unitPrice: number;
        note: string | null;
      }> = [];

      if (tx.externalRef) {
        try {
          const ref = JSON.parse(tx.externalRef) as Record<string, unknown>;
          receiptNumber = String(ref.receiptNumber ?? "");
          cashierName = String(ref.cashierName ?? "");
          if (Array.isArray(ref.items)) {
            for (const it of ref.items as Array<{
              name?: unknown;
              quantity?: unknown;
              unitPrice?: unknown;
            }>) {
              items.push({
                productName: String(it.name ?? "Pozycja"),
                quantity: Number(it.quantity ?? 1),
                unitPrice: Number(it.unitPrice ?? 0),
                note: null,
              });
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      const orderNumMatch = receiptNumber.match(/(\d+)/);
      const orderNumber = orderNumMatch
        ? parseInt(orderNumMatch[1], 10)
        : 0;

      return {
        orderId: tx.id,
        orderNumber: orderNumber || 0,
        roomNumber,
        amount: Number(tx.amount),
        createdAt: tx.createdAt.toISOString(),
        waiterName: cashierName || "",
        items:
          items.length > 0
            ? items
            : [
                {
                  productName: tx.description ?? "Obciążenie",
                  quantity: 1,
                  unitPrice: Number(tx.amount),
                  note: null,
                },
              ],
      };
    };

    const mapUnassigned = (
      c: (typeof unassigned)[0]
    ): {
      orderId: string;
      orderNumber: number;
      roomNumber: string;
      amount: number;
      createdAt: string;
      waiterName: string;
      items: Array<{
        productName: string;
        quantity: number;
        unitPrice: number;
        note: string | null;
      }>;
    } | null => {
      if (normFilter && normalizeRoom(c.roomNumber) !== normFilter)
        return null;
      if (dateFrom && c.createdAt < dateFrom) return null;
      if (dateTo && c.createdAt > dateTo) return null;

      const items: Array<{
        productName: string;
        quantity: number;
        unitPrice: number;
        note: string | null;
      }> = [];
      const rawItems = c.items as
        | Array<{ name?: string; quantity?: number; unitPrice?: number }>
        | null
        | undefined;
      if (Array.isArray(rawItems)) {
        for (const it of rawItems) {
          items.push({
            productName: String(it.name ?? "Pozycja"),
            quantity: Number(it.quantity ?? 1),
            unitPrice: Number(it.unitPrice ?? 0),
            note: null,
          });
        }
      }
      if (items.length === 0) {
        items.push({
          productName: c.description ?? "Obciążenie",
          quantity: 1,
          unitPrice: Number(c.amount),
          note: null,
        });
      }

      const orderNumMatch = (c.receiptNumber ?? "").match(/(\d+)/);
      const orderNumber = orderNumMatch
        ? parseInt(orderNumMatch[1], 10)
        : 0;

      return {
        orderId: c.id,
        orderNumber,
        roomNumber: c.roomNumber,
        amount: Number(c.amount),
        createdAt: c.createdAt.toISOString(),
        waiterName: c.cashierName ?? "",
        items,
      };
    };

    const fromTx = transactions
      .map(mapTx)
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const fromUnassigned = unassigned
      .map(mapUnassigned)
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const combined = [...fromTx, ...fromUnassigned].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ orders: combined });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd serwera" },
      { status: 500 }
    );
  }
}
