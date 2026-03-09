#!/usr/bin/env npx tsx
/**
 * Preview wydarzeń z Google Calendar — pobiera przyszłe wydarzenia ze wszystkich
 * kalendarzy GOOGLE_CALENDAR_* i zapisuje do JSON. NIE zapisuje do bazy.
 *
 * Uruchom: npm run gcal:preview
 * lub:     npx tsx scripts/preview-gcal-events.ts
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { google } from "googleapis";
import { getGoogleAuthClient } from "../lib/googleAuth";

type GCalEventOut = {
  id: string;
  summary: string | null;
  description: string | null;
  start: { dateTime?: string; date?: string } | null;
  end: { dateTime?: string; date?: string } | null;
  location: string | null;
  attachments: Array<{ title?: string; fileUrl?: string; mimeType?: string }>;
  calendarId: string;
  calendarName: string;
  status: string | null;
};

function getCalendarEntries(): Array<{ key: string; id: string }> {
  const entries: Array<{ key: string; id: string }> = [];
  for (const [key, value] of Object.entries(process.env)) {
    if (
      key.startsWith("GOOGLE_CALENDAR_") &&
      key !== "GOOGLE_CALENDAR_WEBHOOK_SECRET" &&
      typeof value === "string" &&
      value.trim().length > 0
    ) {
      const id = value.trim();
      if (id.includes("@") || id.includes(".calendar.google.com")) {
        entries.push({ key, id });
      }
    }
  }
  return entries;
}

function envKeyToName(key: string): string {
  return key.replace(/^GOOGLE_CALENDAR_/, "").replace(/_/g, " ");
}

async function main() {
  const timeMin = new Date().toISOString();
  const timeMax = "2027-12-31T23:59:59.999Z";
  const entries = getCalendarEntries();

  if (entries.length === 0) {
    console.log("Brak kalendarzy GOOGLE_CALENDAR_* w .env");
    process.exit(1);
  }

  const auth = getGoogleAuthClient();
  const calendar = google.calendar({ version: "v3", auth });

  const allEvents: GCalEventOut[] = [];
  const counts: Record<string, number> = {};

  for (const { key, id } of entries) {
    const calendarName = envKeyToName(key);
    let pageToken: string | undefined;
    let total = 0;

    do {
      const res = await calendar.events.list({
        calendarId: id,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        pageToken,
      });

      const items = res.data.items ?? [];
      for (const ev of items) {
        if (!ev.id) continue;

        const attachments = (ev.attachments ?? []).map((a) => ({
          title: typeof a.title === "string" ? a.title : undefined,
          fileUrl: typeof a.fileUrl === "string" ? a.fileUrl : undefined,
          mimeType: typeof a.mimeType === "string" ? a.mimeType : undefined,
        }));

        allEvents.push({
          id: ev.id,
          summary: ev.summary ?? null,
          description: ev.description ?? null,
          start: ev.start ?? null,
          end: ev.end ?? null,
          location: ev.location ?? null,
          attachments,
          calendarId: id,
          calendarName,
          status: ev.status ?? null,
        });
        total++;
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    counts[calendarName] = total;
  }

  const outputPath = "gcal-preview-output.json";
  writeFileSync(outputPath, JSON.stringify(allEvents, null, 2), "utf-8");

  for (const [name, count] of Object.entries(counts)) {
    console.log(`Kalendarz ${name}: ${count} wydarzeń`);
  }
  console.log(`\nŁącznie: ${allEvents.length} wydarzeń → zapisano do ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
