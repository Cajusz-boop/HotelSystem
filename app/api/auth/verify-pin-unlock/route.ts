import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { verifyPin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST – weryfikacja PIN do odblokowania ekranu (bez tworzenia nowej sesji).
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (!pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "PIN musi składać się z 4 cyfr" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { pin: true, isActive: true },
  });

  if (!user || !user.isActive || !user.pin) {
    return NextResponse.json({ error: "PIN nie skonfigurowany" }, { status: 401 });
  }

  const valid = await verifyPin(pin, user.pin);
  if (!valid) {
    return NextResponse.json({ error: "Błędny PIN" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
