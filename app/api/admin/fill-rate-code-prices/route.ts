import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getEffectivePriceForRoomOnDate } from "@/app/actions/rooms";

/**
 * POST /api/admin/fill-rate-code-prices
 *
 * Jednorazowa akcja zbiorcza: dla rezerwacji z rateCodePrice = null pobiera cenę
 * z cennika (getEffectivePriceForRoomOnDate) i zapisuje jako rateCodePrice.
 * Po odświeżeniu strony ceny będą widoczne w dialogu edycji i u kontrahentów.
 *
 * Wymaga admin.settings permission.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const reservations = await prisma.reservation.findMany({
      where: {
        rateCodePrice: null,
      },
      include: {
        room: { select: { number: true } },
      },
    });

    const logs: string[] = [];
    logs.push(`Znaleziono ${reservations.length} rezerwacji bez zapisanej ceny (rateCodePrice = null)`);

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const res of reservations) {
      const checkInStr = res.checkIn instanceof Date
        ? res.checkIn.toISOString().slice(0, 10)
        : String(res.checkIn).slice(0, 10);

      const price = await getEffectivePriceForRoomOnDate(res.room.number, checkInStr);

      if (price != null && price > 0) {
        await prisma.reservation.update({
          where: { id: res.id },
          data: { rateCodePrice: price },
        });
        updated++;
        logs.push(`Zaktualizowano: ${res.confirmationNumber ?? res.id} (pokój ${res.room.number}, ${checkInStr}) → ${price} PLN/dobę`);
      } else {
        skipped++;
        logs.push(`Pominięto: ${res.confirmationNumber ?? res.id} (pokój ${res.room.number}) – brak ceny w cenniku dla ${checkInStr}`);
      }
    }

    logs.push(`---`);
    logs.push(`Zaktualizowano: ${updated}`);
    logs.push(`Pominięto (brak ceny): ${skipped}`);

    return NextResponse.json({
      success: true,
      updated,
      skipped,
      total: reservations.length,
      logs,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Fill failed", detail: msg }, { status: 500 });
  }
}
