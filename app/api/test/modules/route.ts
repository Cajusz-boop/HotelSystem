/**
 * API route do testów modułów dodatkowych (Faza 5).
 * GET /api/test/modules
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const results: Array<{ step: string; ok: boolean; message?: string }> = [];

  try {
    // 5.1 — CRM: wyszukiwanie gościa, karta gościa, historia rezerwacji
    const guest = await prisma.guest.findFirst({ select: { id: true, name: true } });
    if (!guest) {
      results.push({ step: "5.1 CRM — wyszukiwanie gościa", ok: false, message: "Brak gości w bazie" });
    } else {
      const guestWithRes = await prisma.guest.findUnique({
        where: { id: guest.id },
        include: { reservations: { take: 5, orderBy: { checkIn: "desc" }, select: { id: true, checkIn: true, checkOut: true } } },
      });
      results.push({ step: "5.1 CRM — karta gościa + historia", ok: !!guestWithRes });
    }

    // 5.2 — Finanse: lista faktur
    const invoices = await prisma.invoice.findMany({ take: 5 });
    results.push({ step: "5.2 Finanse — lista faktur", ok: true, message: `${invoices.length} faktur` });

    // 5.3 — Księga meldunkowa: rezerwacje z dzisiaj (checkIn lub checkOut)
    const today = new Date().toISOString().slice(0, 10);
    const todayStart = new Date(today + "T00:00:00Z");
    const todayEnd = new Date(today + "T23:59:59Z");
    const resToday = await prisma.reservation.count({
      where: {
        OR: [
          { checkIn: { lte: todayEnd }, checkOut: { gt: todayStart } },
        ],
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
      },
    });
    results.push({ step: "5.3 Księga meldunkowa — wpisy z dziś", ok: true, message: `${resToday} rezerwacji` });

    // 5.4 — Przekazanie zmiany: lista wpisów z dziś
    const handovers = await prisma.shiftHandover.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
    });
    results.push({ step: "5.4 Przekazanie zmiany — pobranie wpisów", ok: true, message: `${handovers.length} wpisów` });
  } catch (e) {
    results.push({ step: "BŁĄD", ok: false, message: e instanceof Error ? e.message : String(e) });
  }

  return NextResponse.json({ results });
}
