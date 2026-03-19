import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { printFiscalReceiptForReservation, printFiscalReceiptForReservations } from "@/app/actions/finance";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { reservationId, reservationIds, paymentMethod, amount } = body as {
      reservationId?: string;
      reservationIds?: string[];
      paymentMethod?: string;
      amount?: number;
    };

    if (reservationIds && reservationIds.length > 0) {
      const result = await printFiscalReceiptForReservations(
        reservationIds,
        paymentMethod || "CASH",
        amount && amount > 0 ? amount : undefined
      );
      return NextResponse.json(result);
    }

    if (reservationId) {
      const result = await printFiscalReceiptForReservation(
        reservationId,
        paymentMethod || "CASH",
        amount && amount > 0 ? amount : undefined
      );
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: "Brak reservationId" },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Błąd druku paragonu" },
      { status: 500 }
    );
  }
}
