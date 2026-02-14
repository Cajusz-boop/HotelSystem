import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { keepAliveKsefSession } from "@/app/actions/ksef";

const KEEPALIVE_THRESHOLD_MS = 10 * 60 * 1000; // 10 min – odśwież jeśli ostatni KeepAlive starszy

/**
 * GET/POST /api/cron/ksef-keepalive
 * Odświeża aktywne sesje KSeF (KeepAlive) przed wygaśnięciem (timeout MF ~20 min).
 * Wywoływane przez crona co np. 10 min. Opcjonalnie: nagłówek Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  return runKeepAlive(request);
}

export async function POST(request: NextRequest) {
  return runKeepAlive(request);
}

async function runKeepAlive(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const threshold = new Date(now.getTime() - KEEPALIVE_THRESHOLD_MS);

  const sessions = await prisma.ksefSession.findMany({
    where: {
      tokenExpiresAt: { gt: now },
      OR: [
        { lastKeepAliveAt: null },
        { lastKeepAliveAt: { lt: threshold } },
      ],
    },
    select: { id: true },
  });

  let ok = 0;
  let err = 0;
  for (const s of sessions) {
    const result = await keepAliveKsefSession(s.id);
    if (result.success) ok++;
    else err++;
  }

  return NextResponse.json({
    refreshed: ok,
    failed: err,
    total: sessions.length,
  });
}
