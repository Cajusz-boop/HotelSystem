/**
 * API do testu pełnego flow recepcyjnego.
 * GET /api/test/full-reception-flow
 * Uruchamia pełny cykl: dostępność → rezerwacja → check-in → obciążenia → płatność → dokument → check-out → weryfikacja → cleanup.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchAvailableRooms } from "@/app/actions/rooms";
import { createReservation, updateReservationStatus } from "@/app/actions/reservations";
import {
  addFolioCharge,
  addFolioPayment,
  postRoomChargeOnCheckout,
  getFolioSummary,
  printFiscalReceiptForReservation,
  createVatInvoice,
} from "@/app/actions/finance";

const TEST_GUEST = "Test Recepcja";

export async function GET() {
  const results: Array<{ step: string; ok: boolean; message?: string; data?: unknown }> = [];
  let guestId: string | null = null;
  let reservationId: string | null = null;
  let invoiceId: string | null = null;

  const ok = (step: string, data?: unknown) => results.push({ step, ok: true, data });
  const fail = (step: string, message: string) => results.push({ step, ok: false, message });

  try {
    const property = await prisma.property.findFirst({ select: { id: true } });
    const propertyId = property?.id ?? null;

    // 1. SZUKANIE DOSTĘPNOŚCI
    let found: { roomNumber: string; checkIn: string; checkOut: string; totalPrice: number } | null = null;
    for (let offset = 0; offset <= 60; offset += 7) {
      const ci = new Date();
      ci.setDate(ci.getDate() + 7 + offset);
      const co = new Date(ci);
      co.setDate(co.getDate() + 3);
      const ciStr = ci.toISOString().slice(0, 10);
      const coStr = co.toISOString().slice(0, 10);
      const search = await searchAvailableRooms({ propertyId, checkIn: ciStr, checkOut: coStr, adults: 1 });
      if (search.success && search.data?.available?.length) {
        const r = search.data.available[0];
        found = { roomNumber: r.roomNumber, checkIn: ciStr, checkOut: coStr, totalPrice: r.totalPrice ?? 0 };
        break;
      }
    }
    if (!found) {
      fail("1. SZUKANIE", "Nie znaleziono wolnego pokoju");
      return NextResponse.json({ results });
    }
    ok("1. SZUKANIE", found);

    // 2. TWORZENIE REZERWACJI
    const createRes = await createReservation({
      guestName: TEST_GUEST,
      guestEmail: "test.recepcja@test.pl",
      guestPhone: "+48000000000",
      room: found.roomNumber,
      checkIn: found.checkIn,
      checkOut: found.checkOut,
      status: "CONFIRMED",
      source: "PHONE",
      adults: 1,
      children: 0,
      pax: 1,
    });
    if (!createRes.success) {
      fail("2. TWORZENIE", createRes.error);
      return NextResponse.json({ results });
    }
    if (!createRes.data) {
      fail("2. TWORZENIE", "Brak danych");
      return NextResponse.json({ results });
    }
    const resData = createRes.data as { id: string; guestId?: string };
    reservationId = resData.id;
    guestId = resData.guestId ?? null;
    ok("2. TWORZENIE", { id: reservationId, pokój: found.roomNumber, daty: `${found.checkIn} – ${found.checkOut}` });

    // 3. CHECK-IN
    const checkInRes = await updateReservationStatus(reservationId, "CHECKED_IN");
    if (!checkInRes.success) {
      fail("3. CHECK-IN", checkInRes.error ?? "Błąd");
      await cleanup(reservationId, invoiceId);
      return NextResponse.json({ results });
    }
    ok("3. CHECK-IN", { status: "CHECKED_IN" });

    // 4. OBCIĄŻENIA
    await postRoomChargeOnCheckout(reservationId);
    const minibar = await addFolioCharge({ reservationId, type: "MINIBAR", amount: 45, description: "Minibar" });
    if (!minibar.success) {
      fail("4. OBCIĄŻENIA", minibar.error ?? "Minibar");
      await cleanup(reservationId, invoiceId);
      return NextResponse.json({ results });
    }
    const gastro = await addFolioCharge({ reservationId, type: "GASTRONOMY", amount: 120, description: "Restauracja" });
    if (!gastro.success) {
      fail("4. OBCIĄŻENIA", gastro.error ?? "Gastronomia");
      await cleanup(reservationId, invoiceId);
      return NextResponse.json({ results });
    }
    const summary = await getFolioSummary(reservationId);
    const totalCharges = summary.success && summary.data ? (summary.data as { totalCharges?: number }).totalCharges ?? 0 : 0;
    ok("4. OBCIĄŻENIA", { nocleg: "naliczony", minibar: 45, gastronomia: 120, suma: totalCharges });

    // 5. PŁATNOŚĆ
    const amountToPay = Math.max(totalCharges, 1);
    const payment = await addFolioPayment({ reservationId, amount: amountToPay, paymentMethod: "CARD", description: "Płatność pełna (test)" });
    if (!payment.success) {
      fail("5. PŁATNOŚĆ", payment.error ?? "Błąd");
      await cleanup(reservationId, invoiceId);
      return NextResponse.json({ results });
    }
    const summary2 = await getFolioSummary(reservationId);
    const bal = summary2.success && summary2.data ? (summary2.data as { balance?: number }).balance ?? 0 : 0;
    ok("5. PŁATNOŚĆ", { zapłacono: amountToPay, saldo: bal });

    // 6. PARAGON / FAKTURA
    let docNumber = "";
    const receipt = await printFiscalReceiptForReservation(reservationId, "CARD");
    if (receipt.success && receipt.data?.receiptNumber) {
      docNumber = receipt.data.receiptNumber;
      ok("6. DOKUMENT", { typ: "paragon", numer: docNumber });
    } else {
      const inv = await createVatInvoice(reservationId);
      if (inv.success && inv.data) {
        const d = inv.data as { number?: string; amountGross?: number; id?: string };
        docNumber = d.number ?? "";
        invoiceId = d.id ?? null;
        ok("6. DOKUMENT", { typ: "faktura VAT", numer: docNumber, kwota: d.amountGross });
      } else {
        fail("6. DOKUMENT", "Paragon i faktura niedostępne");
      }
    }

    // 7. CHECK-OUT
    const checkOutRes = await updateReservationStatus(reservationId, "CHECKED_OUT");
    if (!checkOutRes.success) {
      fail("7. CHECK-OUT", checkOutRes.error ?? "Błąd");
      await cleanup(reservationId, invoiceId);
      return NextResponse.json({ results });
    }
    ok("7. CHECK-OUT", { status: "CHECKED_OUT" });

    // 8. WERYFIKACJA
    const finalRes = await prisma.reservation.findUnique({ where: { id: reservationId }, select: { status: true } });
    const statusOk = finalRes?.status === "CHECKED_OUT";
    const folioFinal = await getFolioSummary(reservationId);
    const balFinal = folioFinal.success && folioFinal.data ? (folioFinal.data as { balance?: number }).balance ?? 999 : 999;
    const balanceOk = Math.abs(balFinal) < 0.01;
    const docOk = docNumber.length > 0;
    ok("8. WERYFIKACJA", { status: statusOk ? "PASS" : "FAIL", saldo: balanceOk ? "PASS" : "FAIL", dokument: docOk ? "PASS" : "FAIL" });

    // 9. SPRZĄTANIE
    await cleanup(reservationId, invoiceId);
    ok("9. SPRZĄTANIE", {});

    return NextResponse.json({ results });
  } catch (e) {
    fail("BŁĄD", e instanceof Error ? e.message : String(e));
    await cleanup(reservationId, invoiceId);
    return NextResponse.json({ results });
  }
}

async function cleanup(reservationId: string | null, invoiceId: string | null): Promise<void> {
  try {
    if (reservationId) {
      await prisma.transaction.deleteMany({ where: { reservationId } });
      await prisma.reservation.delete({ where: { id: reservationId } }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
