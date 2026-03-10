/**
 * Pobiera wydarzenia z kalendarzy Google: Wstępna rezerwacja i Rezygnacje.
 * Używane przez Centrum Sprzedaży do wyświetlania ich obok imprez z bazy.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuthClient } from "@/lib/googleAuth";

export type GCalExternalEvent = {
  id: string;
  calId: string;
  source: "wstepna" | "rezygnacje";
  summary: string;
  date: string; // YYYY-MM-DD
  dateFrom: string;
  dateTo: string;
  description?: string | null;
};

function parseGCalDate(
  start: { date?: string | null; dateTime?: string | null } | null | undefined
): string {
  if (!start) return "";
  const raw = start.date ?? start.dateTime;
  if (!raw) return "";
  const d = new Date(raw);
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  try {
    const auth = getGoogleAuthClient();
    const calendar = google.calendar({ version: "v3", auth });

    const wstepnaId = process.env.GOOGLE_CALENDAR_WSTEPNA_REZERWACJA;
    const rezygnacjeId = process.env.GOOGLE_CALENDAR_REZYGNACJE;

    if (!wstepnaId && !rezygnacjeId) {
      return NextResponse.json([]);
    }

    const { searchParams } = new URL(req.url);
    const timeMin = searchParams.get("timeMin");
    const timeMax = searchParams.get("timeMax");

    const now = new Date();
    const rangeStart = timeMin ? new Date(timeMin) : new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const rangeEnd = timeMax ? new Date(timeMax) : new Date(now.getFullYear(), now.getMonth() + 4, 0);

    const allEvents: GCalExternalEvent[] = [];

    const fetchFromCalendar = async (
      calId: string,
      source: "wstepna" | "rezygnacje"
    ) => {
      const res = await calendar.events.list({
        calendarId: calId,
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });
      const items = res.data.items ?? [];
      for (const ev of items) {
        if (ev.status === "cancelled") continue;
        const start = ev.start;
        const end = ev.end;
        const dateStr = parseGCalDate(start);
        if (!dateStr) continue;
        const dateToStr = parseGCalDate(end) || dateStr;
        allEvents.push({
          id: ev.id ?? `gcal-${source}-${Date.now()}`,
          calId,
          source,
          summary: ev.summary ?? "(bez tytułu)",
          date: dateStr,
          dateFrom: dateStr,
          dateTo: dateToStr,
          description: ev.description ?? null,
        });
      }
    };

    if (wstepnaId) await fetchFromCalendar(wstepnaId, "wstepna");
    if (rezygnacjeId) await fetchFromCalendar(rezygnacjeId, "rezygnacje");

    allEvents.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(allEvents);
  } catch (err) {
    console.error("GCal external-events error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Błąd pobierania kalendarzy" },
      { status: 500 }
    );
  }
}
