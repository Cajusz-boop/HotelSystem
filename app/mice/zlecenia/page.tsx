import Link from "next/link";
import { prisma } from "@/lib/db";
import { getEffectivePropertyId } from "@/app/actions/properties";
import { ZlecenieForm } from "./zlecenie-form";

export const metadata = { title: "Zlecenia realizacji", description: "MICE" };

export default async function ZleceniaPage() {
  const propertyId = await getEffectivePropertyId();
  const [orders, invoicesForEvents, quotes, salaRooms] = await Promise.all([
    prisma.eventOrder.findMany({
      orderBy: { dateFrom: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        eventType: true,
        quoteId: true,
        roomIds: true,
        dateFrom: true,
        dateTo: true,
        status: true,
        notes: true,
        receiptNumber: true,
      },
    }),
    prisma.invoice.findMany({
      where: { sourceType: "EVENT" },
      select: { sourceId: true },
    }),
    prisma.groupQuote.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, name: true },
    }),
    prisma.room.findMany({
      where: {
        type: "Sala",
        activeForSale: true,
        ...(propertyId ? { propertyId } : {}),
      },
      select: { id: true, number: true, type: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const eventIdsWithInvoice = new Set(invoicesForEvents.map((i) => i.sourceId).filter(Boolean));

  return (
    <div className="p-8">
      <div className="mb-6 flex gap-2 text-sm text-muted-foreground">
        <Link href="/mice" className="hover:text-foreground">MICE</Link>
        <span>/</span>
        <span>Zlecenia</span>
      </div>
      <h1 className="text-2xl font-semibold mb-6">Zlecenia realizacji</h1>
      <ZlecenieForm
        salaRooms={salaRooms}
        quotes={quotes}
        orders={orders.map((o) => {
          const hasInvoice = eventIdsWithInvoice.has(o.id);
          const hasReceipt = o.receiptNumber != null && String(o.receiptNumber).trim() !== "";
          const documentStatus: "invoice" | "receipt" | "none" = hasInvoice ? "invoice" : hasReceipt ? "receipt" : "none";
          return {
            id: o.id,
            name: o.name,
            eventType: o.eventType ?? "OTHER",
            quoteId: o.quoteId ?? "",
            roomIds: (Array.isArray(o.roomIds) ? o.roomIds : []) as string[],
            dateFrom: o.dateFrom.toISOString().slice(0, 10),
            dateTo: o.dateTo.toISOString().slice(0, 10),
            status: o.status,
            notes: o.notes ?? "",
            documentStatus,
            receiptNumber: o.receiptNumber ?? null,
          };
        })}
      />
    </div>
  );
}
