import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getEffectivePriceForRoomOnDate } from "@/app/actions/rooms";

/**
 * POST /api/admin/fill-rate-code-prices
 *
 * Uzupełnia rateCodePrice dla rezerwacji z checkIn w zakresie: od 7 dni w przeszłość do przyszłości.
 * Cofa błędne uzupełnienia dla bardzo starych rezerwacji (checkIn < 2022).
 *
 * Wymaga admin.settings permission.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const cutoffOld = "2022-01-01";
    const daysAgo7 = new Date(today);
    daysAgo7.setUTCDate(daysAgo7.getUTCDate() - 7);
    const fromDateStr = daysAgo7.toISOString().slice(0, 10);

    // Cofnij błędne uzupełnienia tylko dla bardzo starych rezerwacji (np. 2017) – bez naruszania ostatnich lat
    const revertPast = await prisma.reservation.updateMany({
      where: {
        checkIn: { lt: new Date(cutoffOld + "T00:00:00.000Z") },
        rateCodePrice: { not: null },
      },
      data: { rateCodePrice: null },
    });

    // Uzupełnij tylko: 7 dni w przeszłość ≤ checkIn oraz przyszłość
    const reservations = await prisma.reservation.findMany({
      where: {
        rateCodePrice: null,
        checkIn: { gte: new Date(fromDateStr + "T00:00:00.000Z") },
      },
      include: {
        room: { select: { number: true } },
      },
    });

    const paxFor = (r: { adults?: number | null; children?: number | null }) =>
      Math.max(1, (r.adults ?? 1) + (r.children ?? 0));

    const logs: string[] = [];
    if (revertPast.count > 0) {
      logs.push(`Cofnięto rateCodePrice dla ${revertPast.count} rezerwacji ze starych dat (checkIn < ${cutoffOld}).`);
    }
    logs.push(`Znaleziono ${reservations.length} rezerwacji bez ceny (checkIn od ${fromDateStr} w przód)`);

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const res of reservations) {
      const checkInStr = res.checkIn instanceof Date
        ? res.checkIn.toISOString().slice(0, 10)
        : String(res.checkIn).slice(0, 10);

      const pax = paxFor(res);
      const price = await getEffectivePriceForRoomOnDate(res.room.number, checkInStr, pax);

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
