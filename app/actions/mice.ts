"use server";

import { prisma } from "@/lib/db";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface GroupQuoteItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/** Tworzy kosztorys grupowy (MICE). */
export async function createGroupQuote(
  name: string,
  validUntil: string | null,
  items: GroupQuoteItem[] | null
): Promise<ActionResult<{ id: string }>> {
  try {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return { success: false, error: "Nazwa kosztorysu jest wymagana" };
    }

    let totalAmount: number | null = null;
    if (items && items.length > 0) {
      totalAmount = items.reduce((sum, it) => sum + (it.amount ?? it.quantity * it.unitPrice), 0);
    }

    const created = await prisma.groupQuote.create({
      data: {
        name: trimmedName,
        validUntil: validUntil ? new Date(validUntil + "T12:00:00Z") : null,
        totalAmount: totalAmount != null ? totalAmount : null,
        items: items && items.length > 0 ? (items as object) : null,
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
  items: GroupQuoteItem[] | null
): Promise<ActionResult> {
  try {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return { success: false, error: "Nazwa kosztorysu jest wymagana" };
    }

    let totalAmount: number | null = null;
    if (items && items.length > 0) {
      totalAmount = items.reduce((sum, it) => sum + (it.amount ?? it.quantity * it.unitPrice), 0);
    }

    await prisma.groupQuote.update({
      where: { id },
      data: {
        name: trimmedName,
        validUntil: validUntil ? new Date(validUntil + "T12:00:00Z") : null,
        totalAmount: totalAmount != null ? totalAmount : null,
        items: items && items.length > 0 ? (items as object) : null,
      },
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
        roomIds: roomIds?.length ? roomIds : null,
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
        roomIds: roomIds?.length ? roomIds : null,
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
