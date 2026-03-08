import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { registerWatchChannel } from "@/lib/googleCalendarWatch";
import { getAllCalendarIds } from "@/lib/calendarMapping";

/**
 * POST /api/admin/google-calendar/watch/register
 * Rejestruje kanały watch dla wszystkich kalendarzy z .env.
 * Wymaga: admin.settings
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const calendarIds = getAllCalendarIds();
  if (calendarIds.length === 0) {
    return NextResponse.json(
      { error: "Brak skonfigurowanych kalendarzy Google w .env" },
      { status: 400 }
    );
  }

  const results: { calendarId: string; ok: boolean; error?: string }[] = [];
  for (const calId of calendarIds) {
    try {
      await registerWatchChannel(calId);
      results.push({ calendarId: calId, ok: true });
    } catch (e) {
      results.push({
        calendarId: calId,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    total: calendarIds.length,
    success: results.filter((r) => r.ok).length,
    results,
  });
}
