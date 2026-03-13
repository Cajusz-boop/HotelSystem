"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  type GroupQuoteItem,
  recalcGroupQuoteItem,
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

    await prisma.groupQuote.update({
      where: { id },
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
