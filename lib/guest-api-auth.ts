import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface GuestApiContext {
  guestId: string;
  guestName: string;
  guestEmail: string | null;
}

/**
 * Weryfikuje token aplikacji gościa (Authorization: Bearer <token> lub X-Guest-Token).
 * Zwraca kontekst gościa lub Response 401.
 */
export async function requireGuestToken(
  request: NextRequest
): Promise<{ context: GuestApiContext } | NextResponse> {
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const headerToken = request.headers.get("x-guest-token")?.trim();
  const token = bearer ?? headerToken ?? null;

  if (!token) {
    return NextResponse.json(
      { error: "Brak tokenu. Użyj Authorization: Bearer <token> lub nagłówka X-Guest-Token." },
      { status: 401 }
    );
  }

  const tokenRecord = await prisma.guestAppToken.findUnique({
    where: { token },
    include: { guest: true },
  });

  if (!tokenRecord || new Date() > tokenRecord.expiresAt) {
    return NextResponse.json(
      { error: "Token nieprawidłowy lub wygasły." },
      { status: 401 }
    );
  }

  return {
    context: {
      guestId: tokenRecord.guestId,
      guestName: tokenRecord.guest.name,
      guestEmail: tokenRecord.guest.email ?? null,
    },
  };
}
