import { NextRequest, NextResponse } from "next/server";
import { renewWatchChannels } from "@/lib/googleCalendarWatch";

/**
 * GET /api/cron/renew-calendar-watch
 * Odnawia kanały watch wygasające w ciągu 24h.
 * Wymaga: Authorization: Bearer CRON_SECRET lub JWT_SECRET
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.JWT_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const renewed = await renewWatchChannels();
    return NextResponse.json({ renewed });
  } catch (e) {
    console.error("[cron/renew-calendar-watch]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd" },
      { status: 500 }
    );
  }
}
