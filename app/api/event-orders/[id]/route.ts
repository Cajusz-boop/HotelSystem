import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { updateChecklistDoc } from "@/lib/googleDocs";
import {
  updateCalendarEvent,
  cancelCalendarEvent,
} from "@/lib/googleCalendarEvents";

const EVENT_TYPES = ["WESELE", "KOMUNIA", "CHRZCINY", "URODZINY", "STYPA", "FIRMOWA", "SYLWESTER", "INNE"];

function sanitizeEventData(body: Record<string, unknown>) {
  const b = body as Record<string, unknown>;
  const toDate = (v: unknown): Date | null => {
    if (v instanceof Date) return v;
    if (typeof v === "string") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };
  const dateFrom = toDate(b.dateFrom);
  const dateTo = toDate(b.dateTo);
  const eventDate = b.eventDate ? toDate(b.eventDate) : dateFrom;

  const base: Record<string, unknown> = {};
  if (b.name != null) base.name = String(b.name);
  if (b.eventType != null && EVENT_TYPES.includes(String(b.eventType))) base.eventType = b.eventType;
  if (b.clientName !== undefined) base.clientName = b.clientName != null ? String(b.clientName) : null;
  if (b.clientPhone !== undefined) base.clientPhone = b.clientPhone != null ? String(b.clientPhone) : null;
  if (b.clientEmail !== undefined) base.clientEmail = b.clientEmail != null ? String(b.clientEmail) : null;
  if (b.eventDate !== undefined) base.eventDate = eventDate;
  if (b.timeStart !== undefined) base.timeStart = b.timeStart != null ? String(b.timeStart) : null;
  if (b.timeEnd !== undefined) base.timeEnd = b.timeEnd != null ? String(b.timeEnd) : null;
  if (b.roomName !== undefined) base.roomName = b.roomName != null ? String(b.roomName) : null;
  if (b.guestCount !== undefined) base.guestCount = typeof b.guestCount === "number" ? b.guestCount : (b.guestCount != null ? parseInt(String(b.guestCount), 10) : null);
  if (b.adultsCount !== undefined) base.adultsCount = typeof b.adultsCount === "number" ? b.adultsCount : (b.adultsCount != null ? parseInt(String(b.adultsCount), 10) : null);
  if (b.children03 !== undefined) base.children03 = typeof b.children03 === "number" ? b.children03 : (b.children03 != null ? parseInt(String(b.children03), 10) : null);
  if (b.children47 !== undefined) base.children47 = typeof b.children47 === "number" ? b.children47 : (b.children47 != null ? parseInt(String(b.children47), 10) : null);
  if (b.orchestraCount !== undefined) base.orchestraCount = typeof b.orchestraCount === "number" ? b.orchestraCount : (b.orchestraCount != null ? parseInt(String(b.orchestraCount), 10) : null);
  if (b.cameramanCount !== undefined) base.cameramanCount = typeof b.cameramanCount === "number" ? b.cameramanCount : (b.cameramanCount != null ? parseInt(String(b.cameramanCount), 10) : null);
  if (b.photographerCount !== undefined) base.photographerCount = typeof b.photographerCount === "number" ? b.photographerCount : (b.photographerCount != null ? parseInt(String(b.photographerCount), 10) : null);
  if (b.churchTime !== undefined) base.churchTime = b.churchTime != null ? String(b.churchTime) : null;
  if (b.brideGroomTable !== undefined) base.brideGroomTable = b.brideGroomTable != null ? String(b.brideGroomTable) : null;
  if (b.orchestraTable !== undefined) base.orchestraTable = b.orchestraTable != null ? String(b.orchestraTable) : null;
  if (b.packageId !== undefined) base.packageId = b.packageId != null ? String(b.packageId) : null;
  if (b.cakesAndDesserts !== undefined) base.cakesAndDesserts = b.cakesAndDesserts != null ? String(b.cakesAndDesserts) : null;
  if (b.cakeOrderedAt !== undefined) base.cakeOrderedAt = b.cakeOrderedAt != null ? String(b.cakeOrderedAt) : null;
  if (b.cakeArrivalTime !== undefined) base.cakeArrivalTime = b.cakeArrivalTime != null ? String(b.cakeArrivalTime) : null;
  if (b.cakeServedAt !== undefined) base.cakeServedAt = b.cakeServedAt != null ? String(b.cakeServedAt) : null;
  if (b.drinksArrival !== undefined) base.drinksArrival = b.drinksArrival != null ? String(b.drinksArrival) : null;
  if (b.drinksStorage !== undefined) base.drinksStorage = b.drinksStorage != null ? String(b.drinksStorage) : null;
  if (b.champagneStorage !== undefined) base.champagneStorage = b.champagneStorage != null ? String(b.champagneStorage) : null;
  if (b.alcoholUnderStairs !== undefined) base.alcoholUnderStairs = Boolean(b.alcoholUnderStairs);
  if (b.firstBottlesBy !== undefined) base.firstBottlesBy = b.firstBottlesBy != null ? String(b.firstBottlesBy) : null;
  if (b.coolersWithIce !== undefined) base.coolersWithIce = b.coolersWithIce != null ? String(b.coolersWithIce) : null;
  if (b.alcoholServiceBy !== undefined) base.alcoholServiceBy = b.alcoholServiceBy != null ? String(b.alcoholServiceBy) : null;
  if (b.wineLocation !== undefined) base.wineLocation = b.wineLocation != null ? String(b.wineLocation) : null;
  if (b.beerWhen !== undefined) base.beerWhen = b.beerWhen != null ? String(b.beerWhen) : null;
  if (b.alcoholAtTeamTable !== undefined) base.alcoholAtTeamTable = Boolean(b.alcoholAtTeamTable);
  if (b.cakesSwedishTable !== undefined) base.cakesSwedishTable = Boolean(b.cakesSwedishTable);
  if (b.fruitsSwedishTable !== undefined) base.fruitsSwedishTable = Boolean(b.fruitsSwedishTable);
  if (b.ownFlowers !== undefined) base.ownFlowers = Boolean(b.ownFlowers);
  if (b.ownVases !== undefined) base.ownVases = Boolean(b.ownVases);
  if (b.decorationColor !== undefined) base.decorationColor = b.decorationColor != null ? String(b.decorationColor) : null;
  if (b.placeCards !== undefined) base.placeCards = Boolean(b.placeCards);
  if (b.placeCardsLayout !== undefined) base.placeCardsLayout = b.placeCardsLayout != null ? String(b.placeCardsLayout) : null;
  if (b.tableLayout !== undefined) base.tableLayout = b.tableLayout != null ? String(b.tableLayout) : null;
  if (b.breadWelcomeBy !== undefined) base.breadWelcomeBy = b.breadWelcomeBy != null ? String(b.breadWelcomeBy) : null;
  if (b.extraAttractions !== undefined) base.extraAttractions = b.extraAttractions != null ? String(b.extraAttractions) : null;
  if (b.specialRequests !== undefined) base.specialRequests = b.specialRequests != null ? String(b.specialRequests) : null;
  if (b.facebookConsent !== undefined) base.facebookConsent = Boolean(b.facebookConsent);
  if (b.ownNapkins !== undefined) base.ownNapkins = Boolean(b.ownNapkins);
  if (b.dutyPerson !== undefined) base.dutyPerson = b.dutyPerson != null ? String(b.dutyPerson) : null;
  if (b.assignedTo !== undefined) base.assignedTo = b.assignedTo != null ? String(b.assignedTo) : null;
  if (b.afterpartyEnabled !== undefined) base.afterpartyEnabled = Boolean(b.afterpartyEnabled);
  if (b.afterpartyTimeFrom !== undefined) base.afterpartyTimeFrom = b.afterpartyTimeFrom != null ? String(b.afterpartyTimeFrom) : null;
  if (b.afterpartyTimeTo !== undefined) base.afterpartyTimeTo = b.afterpartyTimeTo != null ? String(b.afterpartyTimeTo) : null;
  if (b.afterpartyGuests !== undefined) base.afterpartyGuests = typeof b.afterpartyGuests === "number" ? b.afterpartyGuests : (b.afterpartyGuests != null ? parseInt(String(b.afterpartyGuests), 10) : null);
  if (b.afterpartyMenu !== undefined) base.afterpartyMenu = b.afterpartyMenu != null ? String(b.afterpartyMenu) : null;
  if (b.afterpartyMusic !== undefined) base.afterpartyMusic = b.afterpartyMusic != null ? String(b.afterpartyMusic) : null;
  if (b.quoteId !== undefined) base.quoteId = b.quoteId != null ? String(b.quoteId) : null;
  if (b.roomIds !== undefined) base.roomIds = Array.isArray(b.roomIds) ? b.roomIds : null;
  if (dateFrom != null) {
    base.dateFrom = dateFrom;
    base.eventDate = dateFrom;
  }
  if (dateTo != null) base.dateTo = dateTo;
  if (b.status != null && ["DRAFT", "CONFIRMED", "DONE", "CANCELLED"].includes(String(b.status))) base.status = b.status;
  if (b.notes !== undefined) base.notes = b.notes != null ? String(b.notes) : null;
  if (b.depositAmount !== undefined) base.depositAmount = typeof b.depositAmount === "number" ? b.depositAmount : (b.depositAmount != null ? parseFloat(String(b.depositAmount)) : null);
  if (b.depositPaid !== undefined) base.depositPaid = Boolean(b.depositPaid);
  if (b.depositDueDate !== undefined) base.depositDueDate = b.depositDueDate ? (typeof b.depositDueDate === "string" ? new Date(b.depositDueDate) : b.depositDueDate instanceof Date ? b.depositDueDate : null) : null;
  if (b.isPoprawiny !== undefined) base.isPoprawiny = Boolean(b.isPoprawiny);
  if (b.parentEventId !== undefined) base.parentEventId = b.parentEventId != null ? String(b.parentEventId) : null;
  if (b.menu !== undefined) base.menu = b.menu != null && typeof b.menu === "object" && !Array.isArray(b.menu) ? (b.menu as object) : undefined;

  return base;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await req.json() as Record<string, unknown>;
    const status = data?.status as string | undefined;
    const depositAmount = data?.depositAmount;
    const depositPaid = data?.depositPaid;
    const notes = data?.notes;

    const patchData: Record<string, unknown> = {};
    if (status !== undefined) {
      const allowed = ["DRAFT", "CONFIRMED", "DONE", "CANCELLED"];
      if (!allowed.includes(String(status))) {
        return NextResponse.json({ error: "Nieprawidłowy status" }, { status: 400 });
      }
      patchData.status = status;
    }
    if (depositAmount !== undefined) {
      const val = typeof depositAmount === "number" ? depositAmount : (depositAmount != null ? parseFloat(String(depositAmount)) : null);
      if (val != null && (isNaN(val) || val < 0 || val > 99999999.99)) {
        return NextResponse.json({ error: "Nieprawidłowa kwota zadatku" }, { status: 400 });
      }
      patchData.depositAmount = val != null ? new Prisma.Decimal(val) : null;
    }
    if (depositPaid !== undefined) {
      patchData.depositPaid = Boolean(depositPaid);
    }
    if (notes !== undefined) {
      patchData.notes = notes != null ? String(notes) : null;
    }
    const clientEmail = data?.clientEmail;
    if (clientEmail !== undefined) {
      patchData.clientEmail = clientEmail != null ? String(clientEmail) : null;
    }
    const assignedTo = data?.assignedTo;
    if (assignedTo !== undefined) {
      patchData.assignedTo = assignedTo != null ? String(assignedTo) : null;
    }
    const depositDueDate = data?.depositDueDate;
    if (depositDueDate !== undefined) {
      patchData.depositDueDate = depositDueDate != null ? (typeof depositDueDate === "string" ? new Date(depositDueDate) : depositDueDate instanceof Date ? depositDueDate : null) : null;
    }
    const checklist = data?.checklist;
    if (checklist !== undefined) {
      patchData.checklist = checklist != null && typeof checklist === "object" ? checklist : null;
    }
    const menu = data?.menu;
    if (menu !== undefined) {
      patchData.menu = menu;
    }

    const forceGcalSync = data?.forceGcalSync === true;
    if (Object.keys(patchData).length === 0 && !forceGcalSync) {
      return NextResponse.json({ error: "Brak danych do aktualizacji" }, { status: 400 });
    }

    if (status === "CANCELLED") {
      const ev = await prisma.eventOrder.findUnique({
        where: { id },
        select: { googleCalendarEventId: true, googleCalendarCalId: true },
      });
      if (ev?.googleCalendarEventId && ev?.googleCalendarCalId) {
        try {
          await cancelCalendarEvent(ev.googleCalendarEventId, ev.googleCalendarCalId);
        } catch (err) {
          console.error("Google cancel error:", err);
        }
      }
    }

    const existing = Object.keys(patchData).length > 0
      ? await prisma.eventOrder.findUnique({ where: { id } })
      : null;

    let updated;
    if (Object.keys(patchData).length > 0) {
      updated = await prisma.eventOrder.update({
        where: { id },
        data: {
          ...patchData,
          ...(status === "CANCELLED" ? { googleCalendarSynced: true, googleCalendarSyncedAt: new Date(), googleCalendarError: null } : {}),
        },
      });
    } else {
      const ev = await prisma.eventOrder.findUnique({ where: { id } });
      if (!ev) return NextResponse.json({ error: "Impreza nie istnieje" }, { status: 404 });
      updated = ev;
    }

    if (existing && updated) {
      try {
        await createAuditLog({
          actionType: "UPDATE",
          entityType: "EventOrder",
          entityId: id,
          oldValue: JSON.parse(JSON.stringify(existing)) as Record<string, unknown>,
          newValue: JSON.parse(JSON.stringify(updated)) as Record<string, unknown>,
        });
      } catch (e) {
        console.error("AuditLog EventOrder UPDATE:", e);
      }
    }

    // Google Calendar sync — update description when status/notes/deposit changed or forceGcalSync (non-CANCELLED)
    const gcalChanged = forceGcalSync || status !== undefined || notes !== undefined || depositAmount !== undefined || depositPaid !== undefined;
    if (updated.status !== "CANCELLED" && gcalChanged && updated.googleCalendarEventId && updated.googleCalendarCalId) {
      let packageName: string | null = null;
      if (updated.packageId) {
        const pkg = await prisma.package.findUnique({ where: { id: updated.packageId }, select: { name: true } });
        packageName = pkg?.name ?? null;
      }
      const depNum = updated.depositAmount != null
        ? (typeof updated.depositAmount === "object" && "toNumber" in updated.depositAmount
          ? (updated.depositAmount as { toNumber: () => number }).toNumber()
          : Number(updated.depositAmount))
        : null;
      try {
        await updateCalendarEvent(
          {
            id: updated.id,
            clientName: updated.clientName,
            clientPhone: updated.clientPhone,
            eventType: updated.eventType,
            roomName: updated.roomName,
            timeStart: updated.timeStart,
            timeEnd: updated.timeEnd,
            guestCount: updated.guestCount,
            status: updated.status,
            notes: updated.notes,
            dateFrom: updated.dateFrom,
            dateTo: updated.dateTo,
            depositAmount: depNum,
            depositPaid: updated.depositPaid,
            isPoprawiny: updated.isPoprawiny,
          },
          updated.googleCalendarEventId,
          updated.googleCalendarCalId,
          packageName
        );
        await prisma.eventOrder.update({
          where: { id },
          data: { googleCalendarSynced: true, googleCalendarSyncedAt: new Date(), googleCalendarError: null },
        });
      } catch (err) {
        console.error("Google Calendar update error:", err);
        await prisma.eventOrder.update({
          where: { id },
          data: {
            googleCalendarSynced: false,
            googleCalendarError: err instanceof Error ? err.message : String(err),
          },
        }).catch(() => {});
      }
    }

    return NextResponse.json(updated);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2025") {
      return NextResponse.json({ error: "Impreza nie istnieje" }, { status: 404 });
    }
    console.error("PATCH /api/event-orders/[id]:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await req.json();
    const sanitized = sanitizeEventData(data);
    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: "Brak danych do aktualizacji" }, { status: 400 });
    }

    const existing = await prisma.eventOrder.findUnique({ where: { id } });
    const event = await prisma.eventOrder.update({
      where: { id },
      data: {
        ...sanitized,
        eventDate: sanitized.eventDate as Date | undefined,
        roomIds: sanitized.roomIds as object | undefined,
      },
    });

    try {
      await createAuditLog({
        actionType: "UPDATE",
        entityType: "EventOrder",
        entityId: id,
        oldValue: existing ? (JSON.parse(JSON.stringify(existing)) as Record<string, unknown>) : null,
        newValue: JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
      });
    } catch (e) {
      console.error("AuditLog EventOrder PUT:", e);
    }

    let packageName: string | null = null;
    if (event.packageId) {
      const pkg = await prisma.package.findUnique({
        where: { id: event.packageId },
        select: { name: true },
      });
      packageName = pkg?.name ?? null;
    }

    await Promise.all([
      event.checklistDocId
        ? updateChecklistDoc(event.checklistDocId, event)
        : Promise.resolve(),
      event.googleCalendarEventId && event.googleCalendarCalId
        ? (() => {
            if (event.status === "CANCELLED") {
              return cancelCalendarEvent(event.googleCalendarEventId!, event.googleCalendarCalId!);
            }
            const depAmount = event.depositAmount != null ? (typeof event.depositAmount === "object" && "toNumber" in event.depositAmount ? (event.depositAmount as { toNumber: () => number }).toNumber() : Number(event.depositAmount)) : null;
            return updateCalendarEvent(
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
              event.googleCalendarEventId,
              event.googleCalendarCalId,
              packageName
            );
          })()
        : Promise.resolve(),
    ]).catch(async (err) => {
      console.error("Google update error:", err);
      await prisma.eventOrder
        .update({
          where: { id },
          data: {
            googleCalendarSynced: false,
            googleCalendarError: err instanceof Error ? err.message : String(err),
          },
        })
        .catch(() => {});
    });

    if (event.googleCalendarEventId && event.googleCalendarCalId && event.status !== "CANCELLED") {
      await prisma.eventOrder
        .update({
          where: { id },
          data: { googleCalendarSynced: true, googleCalendarSyncedAt: new Date(), googleCalendarError: null },
        })
        .catch(() => {});
    }

    return NextResponse.json(event);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2025") {
      return NextResponse.json({ error: "Impreza nie istnieje" }, { status: 404 });
    }
    console.error("PUT /api/event-orders/[id]:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd aktualizacji" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.eventOrder.findUnique({ where: { id } });
    const updated = await prisma.eventOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    if (updated.googleCalendarEventId && updated.googleCalendarCalId) {
      try {
        await cancelCalendarEvent(updated.googleCalendarEventId, updated.googleCalendarCalId);
      } catch (err) {
        console.log("GCal cancel (event possibly already deleted):", (err as Error).message);
      }
    }
    try {
      await createAuditLog({
        actionType: "DELETE",
        entityType: "EventOrder",
        entityId: id,
        oldValue: existing ? (JSON.parse(JSON.stringify(existing)) as Record<string, unknown>) : null,
        newValue: null,
      });
    } catch (e) {
      console.error("AuditLog EventOrder DELETE:", e);
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2025") {
      return NextResponse.json({ error: "Impreza nie istnieje" }, { status: 404 });
    }
    console.error("DELETE /api/event-orders/[id]:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd usuwania" },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await prisma.eventOrder.findUnique({
      where: { id },
    });
    if (!event) {
      return NextResponse.json({ error: "Impreza nie istnieje" }, { status: 404 });
    }
    return NextResponse.json(event);
  } catch (e) {
    console.error("GET /api/event-orders/[id]:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd pobierania" },
      { status: 500 }
    );
  }
}
