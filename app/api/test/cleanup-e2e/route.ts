/**
 * POST /api/test/cleanup-e2e
 * FAZA 12: Sprzątanie danych testowych (prefix E2E w nazwisku gościa).
 * Usuwa rezerwacje, transakcje, faktury, paragony, gości.
 * Używane przez tests/plan-v3-faza2-11.spec.ts test.afterAll.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const E2E_PREFIX = "E2E";

export async function POST() {
  try {
    const guests = await prisma.guest.findMany({
      where: { name: { contains: E2E_PREFIX } },
      select: { id: true },
    });
    const guestIds = guests.map((g) => g.id);

    if (guestIds.length === 0) {
      return NextResponse.json({ success: true, deleted: { reservations: 0, guests: 0 } });
    }

    const reservations = await prisma.reservation.findMany({
      where: { guestId: { in: guestIds } },
      select: { id: true },
    });
    const reservationIds = reservations.map((r) => r.id);

    if (reservationIds.length > 0) {
      await prisma.transaction.deleteMany({ where: { reservationId: { in: reservationIds } } });
      await prisma.invoice.deleteMany({ where: { reservationId: { in: reservationIds } } });
      await prisma.receipt.deleteMany({ where: { reservationId: { in: reservationIds } } });
      await prisma.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    }
    await prisma.guest.deleteMany({ where: { id: { in: guestIds } } });

    return NextResponse.json({
      success: true,
      deleted: { reservations: reservationIds.length, guests: guestIds.length },
    });
  } catch (e) {
    console.error("cleanup-e2e:", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
