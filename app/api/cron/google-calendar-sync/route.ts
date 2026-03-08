import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuthClient } from "@/lib/googleAuth";
import { prisma } from "@/lib/db";
import { processCalendarEvent } from "@/lib/googleCalendarWebhookProcessor";

/**
 * GET /api/cron/google-calendar-sync
 * Polling backup – pobiera zmiany od ostatniego syncToken dla wszystkich kanałów.
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

  const channels = await prisma.googleCalendarWatchChannel.findMany({
    where: { isActive: true },
  });

  let totalProcessed = 0;
  const auth = getGoogleAuthClient();
  const calendar = google.calendar({ version: "v3", auth });

  for (const ch of channels) {
    try {
      let syncToken = ch.syncToken;
      let nextPageToken: string | undefined;

      if (!syncToken) continue;

      do {
        const listParams: {
          calendarId: string;
          syncToken: string;
          pageToken?: string;
          singleEvents?: boolean;
        } = { calendarId: ch.calendarId, syncToken, singleEvents: true };
        if (nextPageToken) listParams.pageToken = nextPageToken;

        const res = await calendar.events.list(listParams);

        if (res.status === 410) {
          await prisma.googleCalendarWatchChannel.update({
            where: { channelId: ch.channelId },
            data: { syncToken: null },
          });
          break;
        }

        const items = res.data.items ?? [];
        for (const ev of items) {
          if (!ev.id || (!ev.start?.date && !ev.start?.dateTime)) continue;
          try {
            await processCalendarEvent(
              {
                id: ev.id,
                summary: ev.summary ?? undefined,
                description: ev.description ?? undefined,
                start: ev.start,
                end: ev.end,
                status: ev.status ?? undefined,
                updated: ev.updated ?? undefined,
                attachments: ev.attachments,
              },
              ch.calendarId
            );
            totalProcessed++;
          } catch {
            /* skip */
          }
        }

        nextPageToken = res.data.nextPageToken ?? undefined;
        if (res.data.nextSyncToken && !nextPageToken) {
          await prisma.googleCalendarWatchChannel.update({
            where: { channelId: ch.channelId },
            data: { syncToken: res.data.nextSyncToken },
          });
        }
      } while (nextPageToken);
    } catch (e) {
      console.error("[cron/google-calendar-sync]", ch.calendarId, e);
    }
  }

  return NextResponse.json({ channels: channels.length, processed: totalProcessed });
}
