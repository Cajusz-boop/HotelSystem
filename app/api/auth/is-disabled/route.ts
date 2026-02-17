import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { setAuthDisabledCache } from "@/lib/auth-disabled-cache";

export const dynamic = "force-dynamic";

/**
 * Publiczny endpoint — zwraca czy logowanie jest wyłączone.
 * Wywoływany przez middleware przy pierwszym żądaniu po starcie serwera
 * (aby załadować cache z bazy). Potem middleware czyta z globalThis cache.
 */
export async function GET() {
  try {
    const row = await prisma.hotelConfig.findUnique({
      where: { id: "default" },
      select: { authDisabled: true },
    });
    const disabled = row?.authDisabled ?? false;
    setAuthDisabledCache(disabled);
    return NextResponse.json({ disabled });
  } catch {
    return NextResponse.json({ disabled: false });
  }
}
