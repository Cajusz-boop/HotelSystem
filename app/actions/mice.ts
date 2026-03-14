"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  type GroupQuoteItem,
  recalcGroupQuoteItem,
  isAutoSource,
} from "@/lib/mice-quote-utils";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type { GroupQuoteItem };

export interface GroupQuoteMeta {
  clientName?: string | null;
  clientNip?: string | null;
  eventDate?: string | null; // YYYY-MM-DD
  depositAmount?: number | null;
  notes?: string | null;
}

/** Tworzy kosztorys grupowy (MICE). */
export async function createGroupQuote(
  name: string,
  validUntil: string | null,
  items: GroupQuoteItem[] | null,
  meta?: GroupQuoteMeta | null
): Promise<ActionResult<{ id: string }>> {
  try {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return { success: false, error: "Nazwa kosztorysu jest wymagana" };
    }

    const normalizedItems =
      items && items.length > 0
        ? items.map((it) => recalcGroupQuoteItem(it as Partial<GroupQuoteItem>))
        : null;
    let totalAmount: number | null = null;
    if (normalizedItems && normalizedItems.length > 0) {
      totalAmount = normalizedItems.reduce((sum, it) => sum + it.grossAmount, 0);
    }

    const created = await prisma.groupQuote.create({
      data: {
        name: trimmedName,
        validUntil: validUntil ? new Date(validUntil + "T12:00:00Z") : null,
        totalAmount: totalAmount != null ? totalAmount : null,
        items: (normalizedItems && normalizedItems.length > 0 ? normalizedItems : Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        clientName: meta?.clientName?.trim() || null,
        clientNip: meta?.clientNip?.trim() || null,
        eventDate: meta?.eventDate ? new Date(meta.eventDate + "T12:00:00Z") : null,
        depositAmount: meta?.depositAmount != null ? meta.depositAmount : null,
        notes: meta?.notes?.trim() || null,
      },
    });

    return { success: true, data: { id: created.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia kosztorysu",
    };
  }
}

/** Aktualizuje kosztorys grupowy. */
export async function updateGroupQuote(
  id: string,
  name: string,
  validUntil: string | null,
  items: GroupQuoteItem[] | null,
  meta?: GroupQuoteMeta | null
): Promise<ActionResult> {
  try {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return { success: false, error: "Nazwa kosztorysu jest wymagana" };
    }

    const normalizedItems =
      items && items.length > 0
        ? items.map((it) => recalcGroupQuoteItem(it as Partial<GroupQuoteItem>))
        : null;
    let totalAmount: number | null = null;
    if (normalizedItems && normalizedItems.length > 0) {
      totalAmount = normalizedItems.reduce((sum, it) => sum + it.grossAmount, 0);
    }

    const updateData: Prisma.GroupQuoteUpdateInput = {
      name: trimmedName,
      validUntil: validUntil ? new Date(validUntil + "T12:00:00Z") : null,
      totalAmount: totalAmount != null ? totalAmount : null,
      items: (normalizedItems && normalizedItems.length > 0 ? normalizedItems : Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
    };
    if (meta) {
      if (meta.clientName !== undefined) updateData.clientName = meta.clientName?.trim() || null;
      if (meta.clientNip !== undefined) updateData.clientNip = meta.clientNip?.trim() || null;
      if (meta.eventDate !== undefined) updateData.eventDate = meta.eventDate ? new Date(String(meta.eventDate) + "T12:00:00Z") : null;
      if (meta.depositAmount !== undefined) updateData.depositAmount = meta.depositAmount != null ? meta.depositAmount : null;
      if (meta.notes !== undefined) updateData.notes = meta.notes?.trim() || null;
    }
    await prisma.groupQuote.update({
      where: { id },
      data: updateData,
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji kosztorysu",
    };
  }
}

/** Usuwa kosztorys grupowy. */
export async function deleteGroupQuote(id: string): Promise<ActionResult> {
  try {
    await prisma.groupQuote.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania kosztorysu",
    };
  }
}

export type EventType = "WEDDING" | "CONFERENCE" | "BANQUET" | "OTHER";

/** Tworzy zlecenie realizacji (konferencja, bankiet, wesele). */
export async function createEventOrder(
  name: string,
  quoteId: string | null,
  roomIds: string[],
  dateFrom: string,
  dateTo: string,
  status: string,
  notes: string | null,
  eventType?: EventType
): Promise<ActionResult<{ id: string }>> {
  try {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return { success: false, error: "Nazwa zlecenia jest wymagana" };
    }

    const from = new Date(dateFrom + "T12:00:00Z");
    const to = new Date(dateTo + "T12:00:00Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return { success: false, error: "Nieprawidłowe daty" };
    }
    if (to < from) {
      return { success: false, error: "Data zakończenia musi być po dacie rozpoczęcia" };
    }

    const validStatus = ["DRAFT", "CONFIRMED", "DONE", "CANCELLED"].includes(status)
      ? status
      : "DRAFT";
    const validType = ["WEDDING", "CONFERENCE", "BANQUET", "OTHER"].includes(eventType ?? "")
      ? (eventType as EventType)
      : "OTHER";

    const created = await prisma.eventOrder.create({
      data: {
        name: trimmedName,
        eventType: validType,
        quoteId: quoteId?.trim() || null,
        roomIds: (roomIds?.length ? roomIds : Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        dateFrom: from,
        dateTo: to,
        status: validStatus,
        notes: notes?.trim() || null,
      },
    });

    return { success: true, data: { id: created.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia zlecenia",
    };
  }
}

/** Aktualizuje zlecenie realizacji. */
export async function updateEventOrder(
  id: string,
  name: string,
  quoteId: string | null,
  roomIds: string[],
  dateFrom: string,
  dateTo: string,
  status: string,
  notes: string | null,
  eventType?: EventType
): Promise<ActionResult> {
  try {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return { success: false, error: "Nazwa zlecenia jest wymagana" };
    }

    const from = new Date(dateFrom + "T12:00:00Z");
    const to = new Date(dateTo + "T12:00:00Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return { success: false, error: "Nieprawidłowe daty" };
    }
    if (to < from) {
      return { success: false, error: "Data zakończenia musi być po dacie rozpoczęcia" };
    }

    const validStatus = ["DRAFT", "CONFIRMED", "DONE", "CANCELLED"].includes(status)
      ? status
      : "DRAFT";
    const validType = ["WEDDING", "CONFERENCE", "BANQUET", "OTHER"].includes(eventType ?? "")
      ? (eventType as EventType)
      : undefined;

    await prisma.eventOrder.update({
      where: { id },
      data: {
        name: trimmedName,
        ...(validType ? { eventType: validType } : {}),
        quoteId: quoteId?.trim() || null,
        roomIds: (roomIds?.length ? roomIds : Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        dateFrom: from,
        dateTo: to,
        status: validStatus,
        notes: notes?.trim() || null,
      },
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji zlecenia",
    };
  }
}

/** Usuwa zlecenie realizacji. */
export async function deleteEventOrder(id: string): Promise<ActionResult> {
  try {
    await prisma.eventOrder.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania zlecenia",
    };
  }
}

/** Synchronizuje GroupQuote powiązany z EventOrder. Jeśli event nie ma quoteId — tworzy kosztorys i ustawia event.quoteId. */
export async function syncEventQuote(eventOrderId: string): Promise<ActionResult> {
  try {
    const event = await prisma.eventOrder.findUnique({
      where: { id: eventOrderId },
      select: {
        id: true,
        name: true,
        quoteId: true,
        packageId: true,
        guestCount: true,
        adultsCount: true,
        dateTo: true,
        eventDate: true,
        clientName: true,
        clientEmail: true,
        depositAmount: true,
        menu: true,
      },
    });
    if (!event) return { success: false, error: "Impreza nie istnieje" };

    let quoteId = event.quoteId;
    if (!quoteId) {
      const created = await prisma.groupQuote.create({
        data: {
          name: event.name,
          validUntil: null,
          totalAmount: null,
          items: Prisma.JsonNull,
          clientName: null,
          clientNip: null,
          eventDate: null,
          depositAmount: null,
          notes: null,
        },
      });
      quoteId = created.id;
      await prisma.eventOrder.update({
        where: { id: eventOrderId },
        data: { quoteId },
      });
    }

    // POPRAWKA 2: Pobierz istniejące pozycje MANUAL (chronione)
    const existingQuote = await prisma.groupQuote.findUnique({
      where: { id: quoteId },
    });
    const existingItems = (existingQuote?.items as GroupQuoteItem[] | null) ?? [];
    const manualItems = existingItems.filter((i) => !isAutoSource(i.source));

    const items: GroupQuoteItem[] = [];
    const guestCount = event.guestCount ?? event.adultsCount ?? 0;
    const menu = event.menu as {
      doplaty?: Record<string, boolean>;
      dodatkiDan?: Record<string, { nazwa: string; cena: number }[]>;
    } | null;

    if (event.packageId) {
      const pkg = await prisma.menuPackage.findFirst({
        where: { code: event.packageId },
        include: { surcharges: true },
      });
      if (pkg) {
        const pricePerPerson = Number(pkg.price) || 0;
        if (guestCount > 0 && pricePerPerson > 0) {
          items.push(
            recalcGroupQuoteItem({
              name: pkg.name,
              unit: "os.",
              quantity: guestCount,
              unitPriceNet: pricePerPerson,
              vatRate: 8,
              source: "MENU_PACKAGE",
              sourceId: pkg.id,
              sourceItemId: null,
            })
          );
        }
        const selectedSurcharges = pkg.surcharges.filter((s) => menu?.doplaty?.[s.code]);
        for (const s of selectedSurcharges) {
          const pricePerPerson = s.pricePerPerson != null ? Number(s.pricePerPerson) : null;
          const flatPrice = s.flatPrice != null ? Number(s.flatPrice) : null;
          const isPP = pricePerPerson != null && pricePerPerson > 0;
          const isFlat = flatPrice != null && flatPrice > 0;
          // POPRAWKA 4: guestCount = 0 → pomiń surcharge per person
          if (isPP && guestCount <= 0) continue;
          const qty = isPP ? guestCount : 1;
          const unitPrice = isPP ? pricePerPerson! : isFlat ? flatPrice! : 0;
          if (unitPrice > 0) {
            items.push(
              recalcGroupQuoteItem({
                name: s.label,
                unit: isPP ? "os." : "szt",
                quantity: qty,
                unitPriceNet: unitPrice,
                vatRate: 8,
                source: "MENU_PACKAGE_SURCHARGE",
                sourceId: pkg.id,
                sourceItemId: s.id,
              })
            );
          }
        }
      }
    }

    if (menu?.dodatkiDan) {
      for (const dishItems of Object.values(menu.dodatkiDan)) {
        for (const d of dishItems) {
          if (d.cena > 0 && guestCount > 0) {
            items.push(
              recalcGroupQuoteItem({
                name: d.nazwa,
                unit: "os.",
                quantity: guestCount,
                unitPriceNet: d.cena,
                vatRate: 8,
                source: "MENU_PACKAGE_EXTRA",
                sourceId: null,
                sourceItemId: null,
              })
            );
          }
        }
      }
    }

    // POPRAWKA 1: Pozycje z transakcji rezerwacji powiązanych z imprezą
    const reservations = await prisma.reservation.findMany({
      where: { eventOrderId },
      include: {
        transactions: { where: { status: { not: "VOIDED" } } },
        room: { select: { number: true } },
      },
    });
    const excludeTxTypes = ["PAYMENT", "DISCOUNT", "REFUND"];
    // TODO: rozważyć wykluczenie status "TRANSFERRED"
    // (ryzyko podwójnego liczenia po transferze między folio)
    for (const res of reservations) {
      for (const tx of res.transactions) {
        const amount = Number(tx.amount);
        if (amount <= 0 || excludeTxTypes.includes(tx.type)) continue;
        // UWAGA: tx.amount = brutto; preferuj tx.unitPrice/tx.netAmount (netto)
        const unitPriceNet = Number(tx.unitPrice ?? tx.netAmount) || Number(tx.amount) || 0;
        items.push(
          recalcGroupQuoteItem({
            name: tx.description || `Nocleg pok. ${res.room?.number ?? "?"}`,
            unit: tx.type === "ROOM" ? "noc" : "szt",
            quantity: Number(tx.quantity) || 1,
            unitPriceNet: unitPriceNet > 0 ? unitPriceNet : Number(tx.amount),
            vatRate: Number(tx.vatRate) || 8,
            source: "RESERVATION",
            sourceId: res.id,
            sourceItemId: tx.id,
          })
        );
      }
    }

    const allItems = [...manualItems, ...items];
    const validUntil = event.dateTo ? event.dateTo.toISOString().slice(0, 10) : null;
    await updateGroupQuote(quoteId, event.name, validUntil, allItems.length > 0 ? allItems : null, {
      eventDate: event.eventDate ? event.eventDate.toISOString().slice(0, 10) : undefined,
      clientName: event.clientName ?? undefined,
      clientNip: undefined,
      depositAmount: event.depositAmount != null ? Number(event.depositAmount) : undefined,
      notes: undefined,
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd synchronizacji kosztorysu imprezy",
    };
  }
}
