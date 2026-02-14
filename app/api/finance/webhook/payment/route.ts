import { NextRequest, NextResponse } from "next/server";
import { registerPaymentFromLink } from "@/app/actions/finance";

/**
 * POST /api/finance/webhook/payment
 * Webhook od bramki płatności (PayU, Przelewy24, Stripe). Body: { token, amount, provider? }.
 * Weryfikacja sygnatury (PayU/Przelewy24) – do dodania w produkcji (np. HMAC z klucza).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Nieprawidłowy payload (oczekiwany JSON)" },
      { status: 400 }
    );
  }
  if (body == null || typeof body !== "object") {
    return NextResponse.json(
      { success: false, error: "Nieprawidłowy payload (oczekiwany obiekt)" },
      { status: 400 }
    );
  }
  const b = body as Record<string, unknown>;
  const token = typeof b.token === "string" ? b.token.trim() : "";
  const amount = typeof b.amount === "number" ? b.amount : parseFloat(String(b.amount ?? ""));
  const provider = typeof b.provider === "string" ? b.provider : undefined;

  if (!token) {
    return NextResponse.json({ success: false, error: "Brak tokenu" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ success: false, error: "Nieprawidłowa kwota" }, { status: 400 });
  }

  try {
    const result = await registerPaymentFromLink(token, amount, provider);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    return NextResponse.json({
      success: true,
      transactionId: result.data?.transactionId,
    });
  } catch (e) {
    console.error("[webhook/payment]", e);
    return NextResponse.json(
      { success: false, error: "Błąd przetwarzania webhooka" },
      { status: 500 }
    );
  }
}
