import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function subDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() - n);
  return out;
}
import { createChecklistDoc, createMenuDoc } from "@/lib/googleDocs";
import { createCalendarEvent } from "@/lib/googleCalendarEvents";
import { getCalendarIdForEventOrder } from "@/lib/calendarMapping";

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
        const depAmount = event.depositAmount != null ? (typeof event.depositAmount === "object" && event.depositAmount !== null && "toNumber" in event.depositAmount ? (event.depositAmount as { toNumber: () => number }).toNumber() : Number(event.depositAmount)) : null;
        const calendarEventId = await createCalendarEvent(
          {
            id: event.id,
            clientName: event.clientName,
            clientPhone: event.clientPhone,
            eventType: event.eventType,
            roomName: event.roomName,
            timeStart: event.timeStart,
            timeEnd: event.timeEnd,
            guestCount: event.guestCount,
            packageId: event.packageId,
            status: event.status,
            notes: event.notes,
            dateFrom: event.dateFrom,
            dateTo: event.dateTo,
            depositAmount: depAmount,
            depositPaid: event.depositPaid,
            isPoprawiny: event.isPoprawiny,
          },
          packageName,
          checklist.docId,
          menu.docId
        );
        const calId = getCalendarIdForEventOrder(event.eventType, event.roomName, event.isPoprawiny ?? false);
        await prisma.eventOrder.update({
          where: { id: event.id },
          data: {
            googleCalendarEventId: calendarEventId,
            googleCalendarCalId: calId,
            googleCalendarSynced: true,
            googleCalendarSyncedAt: new Date(),
            googleCalendarError: null,
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
