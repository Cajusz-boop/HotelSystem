/**
 * Rejestracja i odnawianie kanałów watch Google Calendar.
 */
import { google } from "googleapis";
import { getGoogleAuthClient } from "@/lib/googleAuth";
import { prisma } from "@/lib/db";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://hotel.karczma-labedz.pl";

export async function registerWatchChannel(calendarId: string): Promise<void> {
  const auth = getGoogleAuthClient();
  const calendar = google.calendar({ version: "v3", auth });

  const channelId = `labedz-${calendarId.replace(/@/g, "-").slice(0, 50)}-${Date.now()}`;
  const res = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: `${BASE_URL}/api/webhooks/google-calendar`,
      token: process.env.GOOGLE_CALENDAR_WEBHOOK_SECRET || "",
    },
  });

  const exp = res.data.expiration ? parseInt(res.data.expiration, 10) : Date.now() + 7 * 24 * 60 * 60 * 1000;

  await prisma.googleCalendarWatchChannel.upsert({
    where: { channelId },
    create: {
      channelId,
      resourceId: res.data.resourceId || "",
      calendarId,
      expiration: new Date(exp),
      syncToken: null,
      isActive: true,
    },
    update: {
      resourceId: res.data.resourceId || "",
      expiration: new Date(exp),
      isActive: true,
    },
  });
}

/**
 * Odnawia kanały wygasające w ciągu 24h.
 */
export async function renewWatchChannels(): Promise<number> {
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const expiring = await prisma.googleCalendarWatchChannel.findMany({
    where: { expiration: { lte: in24h }, isActive: true },
  });

  for (const ch of expiring) {
    try {
      await registerWatchChannel(ch.calendarId);
      await prisma.googleCalendarWatchChannel.update({
        where: { channelId: ch.channelId },
        data: { isActive: false },
      });
    } catch (e) {
      console.error("[renewWatchChannels]", ch.calendarId, e);
    }
  }
  return expiring.length;
}
