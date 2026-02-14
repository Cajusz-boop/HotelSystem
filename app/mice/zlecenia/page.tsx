import Link from "next/link";
import { prisma } from "@/lib/db";
import { getEffectivePropertyId } from "@/app/actions/properties";
import { ZlecenieForm } from "./zlecenie-form";

export const metadata = { title: "Zlecenia realizacji", description: "MICE" };

export default async function ZleceniaPage() {
  const propertyId = await getEffectivePropertyId();
  const [orders, quotes, salaRooms] = await Promise.all([
    prisma.eventOrder.findMany({
      orderBy: { dateFrom: "desc" },
      take: 100,
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
        orders={orders.map((o) => ({
          id: o.id,
          name: o.name,
          eventType: o.eventType ?? "OTHER",
          quoteId: o.quoteId ?? "",
          roomIds: (Array.isArray(o.roomIds) ? o.roomIds : []) as string[],
          dateFrom: o.dateFrom.toISOString().slice(0, 10),
          dateTo: o.dateTo.toISOString().slice(0, 10),
          status: o.status,
          notes: o.notes ?? "",
        }))}
      />
    </div>
  );
}
