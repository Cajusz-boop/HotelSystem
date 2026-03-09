#!/usr/bin/env npx tsx
/**
 * Import wydarzeń z pliku gcal-import-data.json do bazy HotelSystem.
 * Dla każdego rekordu tworzy EventOrder i aktualizuje opis w Google Calendar.
 *
 * Uruchom: npm run gcal:import
 * lub:     npx tsx scripts/import-gcal-events.ts
 *
 * Dane wejściowe: gcal-import-data.json w katalogu głównym projektu
 * (skopiuj z outputs/gcal-import-data.json jeśli tam istnieje)
 */
import "dotenv/config";
import { existsSync, copyFileSync, readFileSync } from "fs";
import { join } from "path";
import { google } from "googleapis";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { getGoogleAuthClient } from "../lib/googleAuth";

const EVENT_TYPES = ["WESELE", "KOMUNIA", "CHRZCINY", "URODZINY", "STYPA", "FIRMOWA", "SYLWESTER", "INNE"];

type GcalImportRecord = {
  gcalId: string;
  calendarName: string;
  eventType: string;
  isPoprawiny?: boolean;
  clientName?: string | null;
  originalSummary?: string | null;
  date: string;
  dateEnd?: string | null;
  roomName?: string | null;
  guestCount?: number | null;
  clientPhone?: string | null;
  depositAmount?: number | null;
  depositPaid?: boolean | null;
  notes?: string | null;
  attachments?: unknown[] | null;
};

const CALENDAR_NAME_TO_ENV: Record<string, string> = {
  CHRZCINY: "GOOGLE_CALENDAR_CHRZCINY",
  KOMUNIA: "GOOGLE_CALENDAR_KOMUNIA",
  "WESELA ZLOTA": "GOOGLE_CALENDAR_WESELA_ZLOTA",
  "WESELA DIAMENTOWA": "GOOGLE_CALENDAR_WESELA_DIAMENTOWA",
  URODZINY: "GOOGLE_CALENDAR_URODZINY",
  POPRAWINY: "GOOGLE_CALENDAR_POPRAWINY",
  "IMPREZY FIRMOWE": "GOOGLE_CALENDAR_IMPREZY_FIRMOWE",
  "IMPREZY ZAPISOWE": "GOOGLE_CALENDAR_IMPREZY_ZAPISOWE",
  "PRZYJECIA WESELNE": "GOOGLE_CALENDAR_PRZYJECIA_WESELNE",
  STYPY: "GOOGLE_CALENDAR_STYPY",
  SYLWESTER: "GOOGLE_CALENDAR_SYLWESTER",
};

function getCalendarIdForName(calendarName: string): string | null {
  const envKey = CALENDAR_NAME_TO_ENV[calendarName?.trim() ?? ""];
  if (!envKey) return null;
  return process.env[envKey]?.trim() ?? null;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function patchGcalDescription(
  calendarId: string,
  eventId: string,
  labedzEventId: string
): Promise<void> {
  const auth = getGoogleAuthClient();
  const calendar = google.calendar({ version: "v3", auth });
  const ev = await calendar.events.get({ calendarId, eventId });
  const currentDesc = ev.data.description ?? null;
  const prefix = `[LABEDZ_EVENT_ID:${labedzEventId}]\n`;
  const newDesc = currentDesc ? `${prefix}${currentDesc}` : prefix;
  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: { description: newDesc },
  });
}

async function main() {
  const rootDir = join(process.cwd());
  const inputPath = join(rootDir, "gcal-import-data.json");
  const outputsPath = join(rootDir, "outputs", "gcal-import-data.json");

  if (!existsSync(inputPath) && existsSync(outputsPath)) {
    copyFileSync(outputsPath, inputPath);
    console.log(`Skopiowano ${outputsPath} → ${inputPath}\n`);
  }

  if (!existsSync(inputPath)) {
    console.error(
      "Brak pliku gcal-import-data.json. Skopiuj plik do katalogu głównego projektu (np. z outputs/gcal-import-data.json)."
    );
    process.exit(1);
  }

  const raw = readFileSync(inputPath, "utf-8");
  const records: GcalImportRecord[] = JSON.parse(raw);
  if (!Array.isArray(records)) {
    console.error("Plik musi zawierać tablicę rekordów JSON.");
    process.exit(1);
  }

  let imported = 0;
  let skipped = 0;
  let dbErrors = 0;
  let gcalErrors = 0;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!r?.gcalId) {
      console.warn(`[${i + 1}] Pominięto – brak gcalId`);
      skipped++;
      continue;
    }

    const existing = await prisma.eventOrder.findFirst({
      where: { googleCalendarEventId: r.gcalId },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const dateFrom = new Date(r.date);
    const dateTo = r.dateEnd ? new Date(r.dateEnd) : new Date(r.date);
    const eventType = EVENT_TYPES.includes(String(r.eventType ?? "").trim().toUpperCase())
      ? String(r.eventType).trim().toUpperCase()
      : "INNE";

    const notes =
      (r.originalSummary || r.notes)
        ? (r.originalSummary ?? "") + "\n---\n" + (r.notes ?? "")
        : null;

    const name =
      (r.clientName ? `${r.clientName} – ${formatDate(dateFrom)}` : null) ||
      (r.originalSummary ? `${r.originalSummary} (${formatDate(dateFrom)})` : null) ||
      `Impreza – ${formatDate(dateFrom)}`;

    const calId = getCalendarIdForName(r.calendarName ?? "");

    try {
      const created = await prisma.eventOrder.create({
        data: {
          name,
          clientName: r.clientName ?? null,
          eventType,
          roomName: r.roomName ?? "Do ustalenia",
          eventDate: dateFrom,
          dateFrom,
          dateTo,
          guestCount: r.guestCount ?? 0,
          clientPhone: r.clientPhone ?? null,
          depositAmount: r.depositAmount != null ? new Prisma.Decimal(r.depositAmount) : null,
          depositPaid: Boolean(r.depositPaid),
          isPoprawiny: Boolean(r.isPoprawiny),
          status: "CONFIRMED",
          notes,
          googleCalendarEventId: r.gcalId,
          googleCalendarCalId: calId ?? null,
          googleCalendarSynced: true,
          googleAttachments: Array.isArray(r.attachments) && r.attachments.length > 0 ? r.attachments : null,
        },
      });
      imported++;

      if (calId) {
        try {
          await patchGcalDescription(calId, r.gcalId, created.id);
        } catch (err) {
          gcalErrors++;
          console.error(`[${i + 1}] GCal patch błąd (gcalId=${r.gcalId}):`, (err as Error).message);
        }
      }
    } catch (err) {
      dbErrors++;
      console.error(`[${i + 1}] Błąd bazy (gcalId=${r.gcalId}):`, (err as Error).message);
    }
  }

  console.log("\n--- Podsumowanie ---");
  console.log(`✅ Zaimportowano: ${imported}`);
  console.log(`⏭️  Pominięto (już istnieją): ${skipped}`);
  console.log(`❌ Błędy bazy: ${dbErrors}`);
  console.log(`⚠️  Błędy GCal (ID dodane do bazy ale nie do GCal): ${gcalErrors}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
