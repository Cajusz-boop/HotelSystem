/**
 * API route do uruchamiania testów flow recepcyjnego.
 * GET /api/test/reception-flow
 * Uruchamia pełny cykl: gość → rezerwacja → check-in → charge → payment → check-out → faktura → cleanup.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createReservation, updateReservationStatus } from "@/app/actions/reservations";
import { addFolioCharge, addFolioPayment, createVatInvoice } from "@/app/actions/finance";

type StepResult = {
  step: string;
  ok: boolean;
  message?: string;
  data?: unknown;
};

function ok(step: string, data?: unknown): StepResult {
  return { step, ok: true, data };
}
function fail(step: string, message: string): StepResult {
  return { step, ok: false, message };
}

export async function GET() {
  const results: StepResult[] = [];
  let guestId: string | null = null;
  let reservationId: string | null = null;
  let invoiceId: string | null = null;

  try {
    // 3.1 — Tworzenie gościa (przez createReservation — tworzy gościa jeśli nie istnieje)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const checkOutDate = new Date(tomorrow);
    checkOutDate.setDate(checkOutDate.getDate() + 2);
    const checkIn = tomorrow.toISOString().slice(0, 10);
    const checkOut = checkOutDate.toISOString().slice(0, 10);

    const room = await prisma.room.findFirst({
      where: { activeForSale: true },
      select: { number: true },
      orderBy: { number: "asc" },
    });
    if (!room) {
      results.push(fail("3.1 Tworzenie gościa", "Brak dostępnych pokoi w bazie"));
      return NextResponse.json({ results });
    }

    const createRes = await createReservation({
      guestName: "Jan Testowy",
      guestEmail: "jan.testowy@test.pl",
      guestPhone: "+48500100200",
      room: room.number,
      checkIn,
      checkOut,
      status: "CONFIRMED",
      source: "PHONE",
      mealPlan: "BB",
      adults: 2,
      children: 0,
      pax: 2,
      companyData: { nip: "5260250995", name: "Test Sp. z o.o.", address: "Testowa 1", postalCode: "00-001", city: "Warszawa", country: "PL" },
    });

    if (!createRes.success) {
      results.push(fail("3.1 Tworzenie gościa", createRes.error));
      return NextResponse.json({ results });
    }

    const resData = createRes.data as { id: string; guestId?: string };
    reservationId = resData.id;
    guestId = resData.guestId ?? null;
    results.push(ok("3.1 Tworzenie gościa", { guestId, reservationId }));

    // 3.2 — Rezerwacja już utworzona powyżej
    results.push(ok("3.2 Tworzenie rezerwacji", { reservationId }));

    // 3.3 — Check-in
    const checkInRes = await updateReservationStatus(reservationId, "CHECKED_IN");
    if (!checkInRes.success) {
      results.push(fail("3.3 Check-in", checkInRes.error));
      await cleanup(guestId, reservationId, invoiceId);
      return NextResponse.json({ results });
    }
    results.push(ok("3.3 Check-in", { status: "CHECKED_IN" }));

    // 3.4 — Dodanie obciążenia (Minibar)
    const chargeRes = await addFolioCharge({
      reservationId: reservationId!,
      type: "MINIBAR",
      amount: 45,
      description: "Minibar",
      category: "MINIBAR",
    });
    if (!chargeRes.success) {
      results.push(fail("3.4 Dodanie obciążenia", chargeRes.error));
      await cleanup(guestId, reservationId, invoiceId);
      return NextResponse.json({ results });
    }
    results.push(ok("3.4 Dodanie obciążenia", chargeRes.data));

    // 3.5 — Rejestracja płatności
    const paymentRes = await addFolioPayment({
      reservationId: reservationId!,
      amount: 500,
      paymentMethod: "CARD",
      description: "Zaliczka",
    });
    if (!paymentRes.success) {
      results.push(fail("3.5 Płatność", paymentRes.error));
      await cleanup(guestId, reservationId, invoiceId);
      return NextResponse.json({ results });
    }
    results.push(ok("3.5 Płatność", paymentRes.data));

    // 3.6 — Check-out
    const checkOutRes = await updateReservationStatus(reservationId, "CHECKED_OUT");
    if (!checkOutRes.success) {
      results.push(fail("3.6 Check-out", checkOutRes.error));
      await cleanup(guestId, reservationId, invoiceId);
      return NextResponse.json({ results });
    }
    results.push(ok("3.6 Check-out", { status: "CHECKED_OUT" }));

    // 3.7 — Wystawienie faktury
    const invoiceRes = await createVatInvoice(reservationId);
    if (!invoiceRes.success) {
      results.push(fail("3.7 Faktura", invoiceRes.error));
    } else {
      invoiceId = (invoiceRes.data as { id?: string })?.id ?? null;
      results.push(ok("3.7 Faktura", invoiceRes.data));
    }

    // 3.8 — Sprzątanie
    await cleanup(guestId, reservationId, invoiceId);
    results.push(ok("3.8 Sprzątanie", {}));
  } catch (e) {
    results.push(fail("BŁĄD", e instanceof Error ? e.message : String(e)));
    await cleanup(guestId, reservationId, invoiceId);
  }

  return NextResponse.json({ results });
}

async function cleanup(
  guestId: string | null,
  reservationId: string | null,
  invoiceId: string | null
): Promise<void> {
  try {
    if (reservationId) {
      await prisma.transaction.deleteMany({ where: { reservationId } });
      await prisma.reservation.delete({ where: { id: reservationId } });
    }
    if (guestId) {
      const otherRes = await prisma.reservation.count({ where: { guestId } });
      if (otherRes === 0) {
        await prisma.guest.delete({ where: { id: guestId } });
      }
    }
    if (invoiceId) {
      await prisma.invoice.deleteMany({ where: { id: invoiceId } }).catch(() => {});
    }
  } catch {
    // Ignore cleanup errors
  }
}
