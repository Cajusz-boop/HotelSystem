import { NextRequest, NextResponse } from "next/server";
import { generateDigitalKey } from "@/app/actions/guest-app";
import { requireGuestToken } from "@/lib/guest-api-auth";

/**
 * POST /api/guest/digital-key
 * Body: { "reservationId": "..." }
 * Generuje kod dostępu do pokoju (wymaga tokena w Authorization lub X-Guest-Token).
 */
export async function POST(request: NextRequest) {
  const auth = await requireGuestToken(request);
  if (auth instanceof NextResponse) return auth;

  let body: { reservationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy JSON" }, { status: 400 });
  }

  const reservationId = body.reservationId?.trim();
  if (!reservationId) {
    return NextResponse.json({ error: "reservationId jest wymagane" }, { status: 400 });
  }

  const token =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ??
    request.headers.get("x-guest-token")?.trim() ??
    "";

  const result = await generateDigitalKey(reservationId, token);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error?.includes("dostępu") ? 403 : 400 }
    );
  }

  return NextResponse.json({
    code: result.data.code,
    validFrom: result.data.validFrom,
    validTo: result.data.validTo,
  });
}
