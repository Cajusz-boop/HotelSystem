import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function subDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() - n);
  return out;
}
import { createChecklistDoc, createMenuDoc } from "@/lib/googleDocs";
import { createEventWithDocs } from "@/lib/googleCalendar";

/**
 * Cron: ponowienie tworzenia dokumentów Google dla imprez z googlePending.
 * Wywołaj np. przez external cron: GET /api/cron/retry-google
 * Zabezpiecz np. przez Authorization header lub IP whitelist.
 */
export async function GET() {
  try {
    const pending = await prisma.eventOrder.findMany({
      where: {
        status: { in: ["DRAFT", "CONFIRMED"] },
        googleCalendarEventId: null,
        createdAt: { gte: subDays(new Date(), 7) },
      },
    });

    let retried = 0;
    for (const event of pending) {
      try {
        let packageName: string | null = null;
        if (event.packageId) {
          const pkg = await prisma.package.findUnique({
            where: { id: event.packageId },
            select: { name: true },
          });
          packageName = pkg?.name ?? null;
        }
        const [checklist, menu] = await Promise.all([
          createChecklistDoc(event),
          createMenuDoc({
            ...event,
            packageName,
            packageId: event.packageId,
            cakesAndDesserts: event.cakesAndDesserts,
          }),
        ]);
        const calendarId = await createEventWithDocs(
          event,
          checklist.docId,
          menu.docId
        );
        await prisma.eventOrder.update({
          where: { id: event.id },
          data: {
            googleCalendarEventId: calendarId,
            checklistDocId: checklist.docId,
            checklistDocUrl: checklist.docUrl,
            menuDocId: menu.docId,
            menuDocUrl: menu.docUrl,
          },
        });
        retried++;
      } catch (err) {
        console.error(`Retry failed for event ${event.id}:`, err);
      }
    }

    return NextResponse.json({ retried, total: pending.length });
  } catch (e) {
    console.error("GET /api/cron/retry-google:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd" },
      { status: 500 }
    );
  }
}
