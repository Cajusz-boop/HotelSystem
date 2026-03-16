import Link from "next/link";
import { prisma } from "@/lib/db";
import { getEffectivePropertyId } from "@/app/actions/properties";
import { EventyClient } from "./eventy-client";

export const metadata = { title: "Eventy", description: "Wesela, konferencje, bankiety" };

const EVENT_TYPE_LABELS: Record<string, string> = {
  WEDDING: "Wesele",
  CONFERENCE: "Konferencja",
  BANQUET: "Bankiet",
  OTHER: "Inne",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Szkic",
  CONFIRMED: "Potwierdzone",
  DONE: "Wykonane",
  CANCELLED: "Anulowane",
};

export default async function EventyPage() {
  const propertyId = await getEffectivePropertyId();
  const [orders, invoicesForEvents, salaRooms] = await Promise.all([
    prisma.eventOrder.findMany({
      orderBy: { dateFrom: "desc" },
      take: 200,
      select: { id: true, name: true, eventType: true, roomIds: true, dateFrom: true, dateTo: true, status: true, receiptNumber: true },
    }),
    prisma.invoice.findMany({
      where: { sourceType: "EVENT" },
      select: { sourceId: true },
    }),
    prisma.room.findMany({
      where: {
        type: "Sala",
        activeForSale: true,
        ...(propertyId ? { propertyId } : {}),
      },
      select: { id: true, number: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const roomMap = Object.fromEntries(salaRooms.map((r) => [r.id, r.number]));
  const eventIdsWithInvoice = new Set(invoicesForEvents.map((i) => i.sourceId).filter(Boolean));

  const ordersWithRooms = orders.map((o) => {
    const hasInvoice = eventIdsWithInvoice.has(o.id);
    const hasReceipt = o.receiptNumber != null && String(o.receiptNumber).trim() !== "";
    const documentStatus: "invoice" | "receipt" | "none" = hasInvoice ? "invoice" : hasReceipt ? "receipt" : "none";
    return {
      id: o.id,
      name: o.name,
      eventType: o.eventType ?? "OTHER",
      roomIds: (Array.isArray(o.roomIds) ? o.roomIds : []) as string[],
      dateFrom: o.dateFrom.toISOString().slice(0, 10),
      dateTo: o.dateTo.toISOString().slice(0, 10),
      status: o.status,
      roomNumbers: ((Array.isArray(o.roomIds) ? o.roomIds : []) as string[])
        .map((id) => roomMap[id])
        .filter(Boolean)
        .join(", "),
      documentStatus,
      receiptNumber: o.receiptNumber ?? null,
    };
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex gap-2 text-sm text-muted-foreground">
        <Link href="/mice" className="hover:text-foreground">MICE</Link>
        <span>/</span>
        <span>Eventy</span>
      </div>
      <h1 className="text-2xl font-semibold mb-2">Eventy – Wesela, konferencje, bankiety</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Przegląd zleceń realizacji według typu eventu. <Link href="/mice/zlecenia" className="text-primary hover:underline">Zarządzaj zleceniami</Link>
      </p>
      <EventyClient
        orders={ordersWithRooms}
        eventTypeLabels={EVENT_TYPE_LABELS}
        statusLabels={STATUS_LABELS}
      />
    </div>
  );
}
