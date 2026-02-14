import { NextRequest, NextResponse } from "next/server";
import { processKsefPendingQueue } from "@/app/actions/ksef";

/**
 * GET/POST /api/cron/ksef-retry-queue
 * Przetwarza kolejkę faktur KSeF (fallback offline – gdy brak połączenia lub bramka 5xx).
 * Wysyłka przy przywróceniu połączenia. Wywoływane przez crona co kilka minut.
 * Opcjonalnie: Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  return runRetry(request);
}

export async function POST(request: NextRequest) {
  return runRetry(request);
}

async function runRetry(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await processKsefPendingQueue();
  return NextResponse.json(result);
}
