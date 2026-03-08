import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuthClient } from "@/lib/googleAuth";
import { prisma } from "@/lib/db";
import { processCalendarEvent } from "@/lib/googleCalendarWebhookProcessor";

/**
 * POST /api/webhooks/google-calendar
 * Webhook od Google Calendar (push notifications).
 * Weryfikacja: X-Goog-Channel-Token === GOOGLE_CALENDAR_WEBHOOK_SECRET
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get("x-goog-channel-token") ?? "";
  const secret = process.env.GOOGLE_CALENDAR_WEBHOOK_SECRET ?? "";
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resourceState = request.headers.get("x-goog-resource-state") ?? "";
  const channelId = request.headers.get("x-goog-channel-id") ?? "";

  if (resourceState === "sync") {
    return new NextResponse(null, { status: 200 });
  }

  if (resourceState !== "exists") {
    return new NextResponse(null, { status: 200 });
  }

  const channel = await prisma.googleCalendarWatchChannel.findUnique({
    where: { channelId },
  });
  if (!channel) {
    console.warn("[google-calendar webhook] Nieznany channelId:", channelId);
    return new NextResponse(null, { status: 200 });
  }

  try {
    const auth = getGoogleAuthClient();
    const calendar = google.calendar({ version: "v3", auth });
    const calendarId = channel.calendarId;
    let syncToken = channel.syncToken;
    let nextPageToken: string | undefined;

    do {
      const listParams: {
        calendarId: string;
        syncToken?: string;
        pageToken?: string;
        singleEvents?: boolean;
        timeMin?: string;
      } = { calendarId, singleEvents: true };
      if (syncToken) {
        listParams.syncToken = syncToken;
      } else {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        listParams.timeMin = weekAgo.toISOString();
      }
      if (nextPageToken) listParams.pageToken = nextPageToken;

      const res = await calendar.events.list(listParams);

      if (res.status === 410) {
        syncToken = null;
        nextPageToken = undefined;
        await prisma.googleCalendarWatchChannel.update({
          where: { channelId },
          data: { syncToken: null },
        });
        continue;
      }

      const items = res.data.items ?? [];
      for (const ev of items) {
        if (!ev.id) continue;
        if (!ev.start?.date && !ev.start?.dateTime) continue;
        try {
          await processCalendarEvent(
            {
              id: ev.id ?? undefined,
              summary: ev.summary ?? undefined,
              description: ev.description ?? undefined,
              start: ev.start,
              end: ev.end,
              status: ev.status ?? undefined,
              updated: ev.updated ?? undefined,
              attachments: ev.attachments,
            },
            calendarId
          );
        } catch (e) {
          console.error("[google-calendar webhook] processCalendarEvent:", e);
        }
      }

      nextPageToken = res.data.nextPageToken ?? undefined;
      if (res.data.nextSyncToken && !nextPageToken) {
        syncToken = res.data.nextSyncToken;
        await prisma.googleCalendarWatchChannel.update({
          where: { channelId },
          data: { syncToken },
        });
      }
    } while (nextPageToken);

    return new NextResponse(null, { status: 200 });
  } catch (e) {
    console.error("[google-calendar webhook]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
