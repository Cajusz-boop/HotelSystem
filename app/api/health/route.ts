import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/health
 * Lekki endpoint do:
 *  1) Sprawdzania stanu aplikacji (monitoring).
 *  2) Rozgrzewania (warm-up) – utrzymuje proces Passenger żywy.
 *  3) Utrzymywania połączenia z bazą danych (zapobiega timeout).
 */
export async function GET() {
  const start = Date.now();
  let dbOk = false;

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    dbOk = true;
  } catch {
    // DB niedostępna – raportujemy w odpowiedzi
  }

  return NextResponse.json({
    status: dbOk ? "ok" : "degraded",
    db: dbOk,
    uptime: process.uptime(),
    latencyMs: Date.now() - start,
  });
}

export const dynamic = "force-dynamic";
